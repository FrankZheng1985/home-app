// src/services/postService.js
// 动态服务层 - 处理家庭动态相关业务逻辑 (PostgreSQL 版本)

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');

// 开发模式下的模拟数据
const mockPosts = global.mockPosts || (global.mockPosts = new Map());
const mockLikes = global.mockLikes || (global.mockLikes = new Map());
const mockComments = global.mockComments || (global.mockComments = new Map());

class PostService extends BaseService {
  /**
   * 获取动态列表
   */
  async getList(params) {
    const { familyId, userId, limit = 20, offset = 0 } = params;
    
    // 验证成员身份
    await familyService.validateMembership(userId, familyId);

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟动态列表');
      const posts = [];
      for (const [id, post] of mockPosts) {
        if (post.familyId === familyId) {
          const likeCount = Array.from(mockLikes.values()).filter(l => l.postId === id).length;
          const commentCount = Array.from(mockComments.values()).filter(c => c.postId === id).length;
          const isLiked = Array.from(mockLikes.values()).some(l => l.postId === id && l.userId === userId);
          
          posts.push({
            id: post.id,
            content: post.content,
            images: post.images || [],
            isAnonymous: post.isAnonymous,
            createdAt: post.createdAt,
            userId: post.userId,
            user: post.isAnonymous ? {
              nickname: '匿名用户',
              avatarUrl: null
            } : {
              id: post.userId,
              nickname: post.userNickname || '用户',
              avatarUrl: post.userAvatar || ''
            },
            isOwner: post.userId === userId,
            likesCount: likeCount,
            commentsCount: commentCount,
            isLiked
          });
        }
      }
      
      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return posts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    }

    const sql = `
      SELECT p.id, p.content, p.images, p.is_anonymous, p.created_at,
             p.user_id,
             u.nickname, u.avatar_url,
             (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count,
             EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.family_id = $2
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await this.queryMany(sql, [userId, familyId, parseInt(limit), parseInt(offset)]);

    return result.map(row => ({
      id: row.id,
      content: row.content,
      images: row.images || [],
      isAnonymous: row.is_anonymous,
      createdAt: row.created_at,
      userId: row.user_id,
      user: row.is_anonymous ? {
        nickname: '匿名用户',
        avatarUrl: null
      } : {
        id: row.user_id,
        nickname: row.nickname,
        avatarUrl: row.avatar_url
      },
      isOwner: row.user_id === userId,
      likesCount: parseInt(row.like_count),
      commentsCount: parseInt(row.comment_count),
      isLiked: row.is_liked
    }));
  }

  /**
   * 发布动态
   */
  async create(data) {
    const { familyId, userId, content, images, isAnonymous } = data;
    
    await familyService.validateMembership(userId, familyId);

    const postId = uuidv4();
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：保存模拟动态');
      // 获取用户信息
      const mockUsers = global.mockUsers || new Map();
      let user = null;
      for (const [, u] of mockUsers) if (u.id === userId) { user = u; break; }

      const post = {
        id: postId,
        userId,
        familyId,
        content,
        images: images || [],
        isAnonymous: isAnonymous || false,
        createdAt: new Date().toISOString(),
        userNickname: user?.nickname || '用户',
        userAvatar: user?.avatar_url || ''
      };
      mockPosts.set(postId, post);
      return { id: postId, content, message: '发布成功' };
    }

    await this.insert('posts', {
      id: postId,
      user_id: userId,
      family_id: familyId,
      content,
      images: JSON.stringify(images || []),
      is_anonymous: isAnonymous || false,
      created_at: new Date()
    });

    return { id: postId, content, message: '发布成功' };
  }

  /**
   * 删除动态
   */
  async delete(postId, userId) {
    if (!this.isDatabaseAvailable()) {
      const post = mockPosts.get(postId);
      if (!post) throw new Error('动态不存在');
      if (post.userId !== userId) throw new Error('只能删除自己的动态');
      
      mockPosts.delete(postId);
      // 清理点赞和评论
      for (const [id, like] of mockLikes) if (like.postId === postId) mockLikes.delete(id);
      for (const [id, comment] of mockComments) if (comment.postId === postId) mockComments.delete(id);
      
      return { message: '删除成功' };
    }

    const post = await this.queryOne('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (!post) throw new Error('动态不存在');
    if (post.user_id !== userId) throw new Error('只能删除自己的动态');

    await this.transaction(async (client) => {
      await client.query('DELETE FROM post_likes WHERE post_id = $1', [postId]);
      await client.query('DELETE FROM post_comments WHERE post_id = $1', [postId]);
      await client.query('DELETE FROM posts WHERE id = $1', [postId]);
    });

    return { message: '删除成功' };
  }

  /**
   * 点赞/取消点赞
   */
  async toggleLike(postId, userId) {
    if (!this.isDatabaseAvailable()) {
      let existingLikeId = null;
      for (const [id, like] of mockLikes) {
        if (like.postId === postId && like.userId === userId) {
          existingLikeId = id;
          break;
        }
      }
      
      if (existingLikeId) {
        mockLikes.delete(existingLikeId);
        return { liked: false, message: '已取消点赞' };
      } else {
        const likeId = uuidv4();
        mockLikes.set(likeId, { id: likeId, postId, userId, createdAt: new Date() });
        return { liked: true, message: '点赞成功' };
      }
    }

    const post = await this.queryOne('SELECT id FROM posts WHERE id = $1', [postId]);
    if (!post) throw new Error('动态不存在');

    const existing = await this.queryOne('SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
    
    if (existing) {
      await this.query('DELETE FROM post_likes WHERE id = $1', [existing.id]);
      return { liked: false, message: '已取消点赞' };
    } else {
      await this.insert('post_likes', {
        id: uuidv4(),
        post_id: postId,
        user_id: userId,
        created_at: new Date()
      });
      return { liked: true, message: '点赞成功' };
    }
  }

  /**
   * 获取评论列表
   */
  async getComments(postId) {
    if (!this.isDatabaseAvailable()) {
      const comments = [];
      for (const [id, comment] of mockComments) {
        if (comment.postId === postId) {
          comments.push({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            author: {
              id: comment.userId,
              nickname: comment.userNickname || '用户',
              avatarUrl: comment.userAvatar || ''
            }
          });
        }
      }
      comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return comments;
    }

    const sql = `
      SELECT c.id, c.content, c.created_at,
             u.id as user_id, u.nickname, u.avatar_url
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `;
    const result = await this.queryMany(sql, [postId]);
    return result.map(row => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      author: {
        id: row.user_id,
        nickname: row.nickname,
        avatarUrl: row.avatar_url
      }
    }));
  }

  /**
   * 添加评论
   */
  async addComment(data) {
    const { postId, userId, content } = data;
    
    if (!this.isDatabaseAvailable()) {
      const post = mockPosts.get(postId);
      if (!post) throw new Error('动态不存在');
      
      const mockUsers = global.mockUsers || new Map();
      let user = null;
      for (const [, u] of mockUsers) if (u.id === userId) { user = u; break; }

      const commentId = uuidv4();
      mockComments.set(commentId, {
        id: commentId,
        postId,
        userId,
        content,
        createdAt: new Date().toISOString(),
        userNickname: user?.nickname || '用户',
        userAvatar: user?.avatar_url || ''
      });
      return { id: commentId, content, message: '评论成功' };
    }

    const post = await this.queryOne('SELECT id FROM posts WHERE id = $1', [postId]);
    if (!post) throw new Error('动态不存在');

    const commentId = uuidv4();
    await this.insert('post_comments', {
      id: commentId,
      post_id: postId,
      user_id: userId,
      content,
      created_at: new Date()
    });

    return { id: commentId, content, message: '评论成功' };
  }

  /**
   * 获取动态详情
   */
  async getDetail(postId, userId) {
    if (!this.isDatabaseAvailable()) {
      const post = mockPosts.get(postId);
      if (!post) throw new Error('动态不存在');
      
      const likeCount = Array.from(mockLikes.values()).filter(l => l.postId === postId).length;
      const commentCount = Array.from(mockComments.values()).filter(c => c.postId === postId).length;
      const isLiked = Array.from(mockLikes.values()).some(l => l.postId === postId && l.userId === userId);
      
      return {
        id: post.id,
        content: post.content,
        images: post.images || [],
        isAnonymous: post.isAnonymous,
        createdAt: post.createdAt,
        userId: post.userId,
        user: post.isAnonymous ? {
          nickname: '匿名用户',
          avatarUrl: null
        } : {
          id: post.userId,
          nickname: post.userNickname || '用户',
          avatarUrl: post.userAvatar || ''
        },
        isOwner: post.userId === userId,
        likesCount: likeCount,
        commentsCount: commentCount,
        isLiked
      };
    }

    const sql = `
      SELECT p.id, p.content, p.images, p.is_anonymous, p.created_at,
             p.user_id,
             u.nickname, u.avatar_url,
             (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count,
             EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $2
    `;
    const row = await this.queryOne(sql, [userId, postId]);
    if (!row) throw new Error('动态不存在');

    return {
      id: row.id,
      content: row.content,
      images: row.images || [],
      isAnonymous: row.is_anonymous,
      createdAt: row.created_at,
      userId: row.user_id,
      user: row.is_anonymous ? {
        nickname: '匿名用户',
        avatarUrl: null
      } : {
        id: row.user_id,
        nickname: row.nickname,
        avatarUrl: row.avatar_url
      },
      isOwner: row.user_id === userId,
      likesCount: parseInt(row.like_count),
      commentsCount: parseInt(row.comment_count),
      isLiked: row.is_liked
    };
  }

  /**
   * 获取家庭活动记录
   */
  async getActivityList(params) {
    const { familyId, userId, limit = 20, offset = 0 } = params;
    await familyService.validateMembership(userId, familyId);

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟活动记录');
      const mockActivities = [
        {
          id: '1',
          type: 'chore',
          icon: '🧹',
          title: '完成了家务【洗碗】',
          description: '获得 10 积分',
          userId: 'mock-user-1',
          user: { nickname: '小明', avatarUrl: '' },
          createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
        },
        {
          id: '2',
          type: 'sport',
          icon: '🏃',
          title: '完成了【跑步】运动',
          description: '30分钟，消耗200千卡',
          userId: 'mock-user-2',
          user: { nickname: '妈妈', avatarUrl: '' },
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        }
      ];
      return {
        data: mockActivities.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
        total: mockActivities.length,
        hasMore: parseInt(offset) + parseInt(limit) < mockActivities.length
      };
    }

    // 聚合查询逻辑 (保持原 postController 中的逻辑，但改为 Service 方式)
    // 1. 获取家务完成记录
    const choreRecords = await this.queryMany(
      `SELECT cr.id, 'chore' as type, cr.user_id, u.nickname, u.avatar_url, ct.name as chore_name, cr.points_earned as points, cr.note, cr.completed_at as created_at
       FROM chore_records cr JOIN users u ON cr.user_id = u.id JOIN chore_types ct ON cr.chore_type_id = ct.id
       WHERE cr.family_id = $1 ORDER BY cr.completed_at DESC LIMIT 50`,
      [familyId]
    );

    // 2. 获取积分交易记录
    const pointRecords = await this.queryMany(
      `SELECT pt.id, 'points' as type, pt.user_id, u.nickname, u.avatar_url, pt.points, pt.type as points_type, pt.description, pt.created_at
       FROM point_transactions pt JOIN users u ON pt.user_id = u.id
       WHERE pt.family_id = $1 AND pt.type != 'earn' ORDER BY pt.created_at DESC LIMIT 50`,
      [familyId]
    );

    // 3. 获取储蓄交易记录
    const savingsRecords = await this.queryMany(
      `SELECT st.id, 'savings' as type, sa.user_id, u.nickname, u.avatar_url, st.type as savings_type, st.amount, st.created_at
       FROM savings_transactions st JOIN savings_accounts sa ON st.account_id = sa.id JOIN users u ON sa.user_id = u.id
       WHERE sa.family_id = $1 ORDER BY st.created_at DESC LIMIT 50`,
      [familyId]
    );

    // 4. 获取运动记录
    const sportRecords = await this.queryMany(
      `SELECT sr.id, 'sport' as type, sr.user_id, u.nickname, u.avatar_url, sr.sport_type, sr.icon, sr.duration, sr.calories, sr.created_at
       FROM sport_records sr JOIN users u ON sr.user_id = u.id WHERE sr.family_id = $1 ORDER BY sr.created_at DESC LIMIT 50`,
      [familyId]
    );

    const allActivities = [];
    // ... 格式化逻辑 (同 postController) ...
    choreRecords.forEach(r => allActivities.push({ id: r.id, type: 'chore', icon: '🧹', title: `完成了家务【${r.chore_name}】`, description: `获得 ${r.points} 积分`, note: r.note, userId: r.user_id, user: { nickname: r.nickname, avatarUrl: r.avatar_url }, createdAt: r.created_at }));
    pointRecords.forEach(r => allActivities.push({ id: r.id, type: 'points', icon: r.points_type === 'spend' ? '💸' : '🎁', title: r.points_type === 'spend' ? `消费了 ${Math.abs(r.points)} 积分` : `获得奖励 ${r.points} 积分`, description: r.description || '', userId: r.user_id, user: { nickname: r.nickname, avatarUrl: r.avatar_url }, createdAt: r.created_at }));
    savingsRecords.forEach(r => allActivities.push({ id: r.id, type: 'savings', icon: r.savings_type === 'deposit' ? '💰' : '💸', title: r.savings_type === 'deposit' ? `存入了 ${r.amount} 元` : `取出了 ${r.amount} 元`, description: '', userId: r.user_id, user: { nickname: r.nickname, avatarUrl: r.avatar_url }, createdAt: r.created_at }));
    sportRecords.forEach(r => allActivities.push({ id: r.id, type: 'sport', icon: r.icon || '🏃', title: `完成了【${r.sport_type}】运动`, description: `${r.duration}分钟，消耗${r.calories}千卡`, userId: r.user_id, user: { nickname: r.nickname, avatarUrl: r.avatar_url }, createdAt: r.created_at }));

    allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const paginated = allActivities.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    return {
      data: paginated,
      total: allActivities.length,
      hasMore: parseInt(offset) + parseInt(limit) < allActivities.length
    };
  }
}

module.exports = new PostService();
