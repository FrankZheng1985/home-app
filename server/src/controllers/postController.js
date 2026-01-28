// src/controllers/postController.js
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

// 动态导入数据库模块
let query;
try {
  query = require('../config/database').query;
} catch (e) {
  console.warn('数据库模块未加载');
  query = null;
}

// 模拟数据
const mockPosts = global.mockPosts || (global.mockPosts = new Map());
const mockLikes = global.mockLikes || (global.mockLikes = new Map());
const mockComments = global.mockComments || (global.mockComments = new Map());

/**
 * 获取动态列表
 */
const getList = async (req, res) => {
  const { familyId, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为家庭成员
      const memberCheck = await query(
        'SELECT id FROM family_members WHERE family_id = ? AND user_id = ?',
        [familyId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      const result = await query(
        `SELECT p.id, p.content, p.images, p.is_anonymous, p.created_at,
                p.user_id,
                u.nickname, u.avatar_url,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.family_id = ?
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [req.user.id, familyId, parseInt(limit), parseInt(offset)]
      );

      return res.json({
        data: result.rows.map(row => ({
          id: row.id,
          content: row.content,
          images: row.images || [],
          isAnonymous: row.is_anonymous,
          createdAt: row.created_at,
          userId: row.user_id, // 添加 userId 字段
          user: row.is_anonymous ? {
            nickname: '匿名用户',
            avatarUrl: null
          } : {
            id: row.user_id,
            nickname: row.nickname,
            avatarUrl: row.avatar_url
          },
          isOwner: row.user_id === req.user.id,
          likesCount: parseInt(row.like_count),
          commentsCount: parseInt(row.comment_count),
          isLiked: row.is_liked
        }))
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const posts = [];
    for (const [id, post] of mockPosts) {
      if (post.familyId === familyId) {
        const likeCount = Array.from(mockLikes.values()).filter(l => l.postId === id).length;
        const commentCount = Array.from(mockComments.values()).filter(c => c.postId === id).length;
        const isLiked = Array.from(mockLikes.values()).some(l => l.postId === id && l.userId === req.user.id);
        
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
          isOwner: post.userId === req.user.id,
          likesCount: likeCount,
          commentsCount: commentCount,
          isLiked
        });
      }
    }
    
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return res.json({ data: posts.slice(parseInt(offset), parseInt(offset) + parseInt(limit)) });
  } catch (error) {
    console.error('获取动态列表错误:', error);
    return res.status(500).json({ error: '获取动态列表失败' });
  }
};

/**
 * 发布动态
 */
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { familyId, content, images, isAnonymous } = req.body;
  const userId = req.user.id;

  // 验证：文字或图片至少有一个
  const hasContent = content && content.trim().length > 0;
  const hasImages = images && images.length > 0;
  
  if (!hasContent && !hasImages) {
    return res.status(400).json({ error: '请输入内容或添加图片' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为家庭成员
      const memberCheck = await query(
        'SELECT id FROM family_members WHERE family_id = ? AND user_id = ?',
        [familyId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      const postId = uuidv4();
      await query(
        `INSERT INTO posts (id, user_id, family_id, content, images, is_anonymous, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [postId, userId, familyId, content, JSON.stringify(images || []), isAnonymous || false]
      );

      return res.json({
        data: {
          id: postId,
          content,
          images: images || [],
          isAnonymous: isAnonymous || false,
          message: '发布成功'
        }
      });
    } catch (dbError) {
      console.warn('数据库操作失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const postId = uuidv4();
    const post = {
      id: postId,
      userId,
      familyId,
      content,
      images: images || [],
      isAnonymous: isAnonymous || false,
      createdAt: new Date().toISOString(),
      userNickname: req.user.nickname,
      userAvatar: req.user.avatar_url
    };
    
    mockPosts.set(postId, post);
    console.log('🔧 开发模式：动态已保存');
    
    return res.json({
      data: {
        id: postId,
        content,
        images: images || [],
        isAnonymous: isAnonymous || false,
        message: '发布成功'
      }
    });
  } catch (error) {
    console.error('发布动态错误:', error);
    return res.status(500).json({ error: '发布动态失败' });
  }
};

/**
 * 删除动态
 */
const deletePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      // 验证是否为动态作者
      const postResult = await query(
        'SELECT user_id FROM posts WHERE id = ?',
        [postId]
      );

      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: '动态不存在' });
      }

      if (postResult.rows[0].user_id !== userId) {
        return res.status(403).json({ error: '只能删除自己的动态' });
      }

      // 删除动态（级联删除点赞和评论）
      await query('DELETE FROM post_likes WHERE post_id = ?', [postId]);
      await query('DELETE FROM post_comments WHERE post_id = ?', [postId]);
      await query('DELETE FROM posts WHERE id = ?', [postId]);

      return res.json({ data: { message: '删除成功' } });
    } catch (dbError) {
      console.warn('数据库操作失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const post = mockPosts.get(postId);
    if (!post) {
      return res.status(404).json({ error: '动态不存在' });
    }
    
    if (post.userId !== userId) {
      return res.status(403).json({ error: '只能删除自己的动态' });
    }
    
    mockPosts.delete(postId);
    
    // 删除相关点赞和评论
    for (const [id, like] of mockLikes) {
      if (like.postId === postId) mockLikes.delete(id);
    }
    for (const [id, comment] of mockComments) {
      if (comment.postId === postId) mockComments.delete(id);
    }
    
    return res.json({ data: { message: '删除成功' } });
  } catch (error) {
    console.error('删除动态错误:', error);
    return res.status(500).json({ error: '删除动态失败' });
  }
};

/**
 * 点赞/取消点赞
 */
const toggleLike = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      // 检查动态是否存在
      const postResult = await query(
        'SELECT family_id FROM posts WHERE id = ?',
        [postId]
      );

      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: '动态不存在' });
      }

      // 检查是否已点赞
      const likeCheck = await query(
        'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
        [postId, userId]
      );

      if (likeCheck.rows.length > 0) {
        // 取消点赞
        await query(
          'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
          [postId, userId]
        );
        return res.json({ data: { liked: false, message: '已取消点赞' } });
      } else {
        // 点赞
        await query(
          'INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, NOW())',
          [uuidv4(), postId, userId]
        );
        return res.json({ data: { liked: true, message: '点赞成功' } });
      }
    } catch (dbError) {
      console.warn('数据库操作失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const post = mockPosts.get(postId);
    if (!post) {
      return res.status(404).json({ error: '动态不存在' });
    }
    
    // 检查是否已点赞
    let existingLikeId = null;
    for (const [id, like] of mockLikes) {
      if (like.postId === postId && like.userId === userId) {
        existingLikeId = id;
        break;
      }
    }
    
    if (existingLikeId) {
      mockLikes.delete(existingLikeId);
      return res.json({ data: { liked: false, message: '已取消点赞' } });
    } else {
      const likeId = uuidv4();
      mockLikes.set(likeId, { id: likeId, postId, userId, createdAt: new Date() });
      return res.json({ data: { liked: true, message: '点赞成功' } });
    }
  } catch (error) {
    console.error('点赞操作错误:', error);
    return res.status(500).json({ error: '点赞操作失败' });
  }
};

/**
 * 获取评论列表
 */
const getComments = async (req, res) => {
  const { postId } = req.params;

  // 尝试使用数据库
  if (query) {
    try {
      // 检查动态是否存在并获取家庭ID
      const postResult = await query(
        'SELECT family_id FROM posts WHERE id = ?',
        [postId]
      );

      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: '动态不存在' });
      }

      const result = await query(
        `SELECT c.id, c.content, c.created_at,
                u.id as user_id, u.nickname, u.avatar_url
         FROM post_comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`,
        [postId]
      );

      return res.json({
        data: result.rows.map(row => ({
          id: row.id,
          content: row.content,
          createdAt: row.created_at,
          author: {
            id: row.user_id,
            nickname: row.nickname,
            avatarUrl: row.avatar_url
          }
        }))
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
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
    
    return res.json({ data: comments });
  } catch (error) {
    console.error('获取评论错误:', error);
    return res.status(500).json({ error: '获取评论失败' });
  }
};

/**
 * 添加评论
 */
const addComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      // 检查动态是否存在
      const postResult = await query(
        'SELECT family_id FROM posts WHERE id = ?',
        [postId]
      );

      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: '动态不存在' });
      }

      const commentId = uuidv4();
      await query(
        'INSERT INTO post_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, NOW())',
        [commentId, postId, userId, content]
      );

      return res.json({
        data: {
          id: commentId,
          content,
          message: '评论成功'
        }
      });
    } catch (dbError) {
      console.warn('数据库操作失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const post = mockPosts.get(postId);
    if (!post) {
      return res.status(404).json({ error: '动态不存在' });
    }
    
    const commentId = uuidv4();
    mockComments.set(commentId, {
      id: commentId,
      postId,
      userId,
      content,
      createdAt: new Date().toISOString(),
      userNickname: req.user.nickname,
      userAvatar: req.user.avatar_url
    });
    
    return res.json({
      data: {
        id: commentId,
        content,
        message: '评论成功'
      }
    });
  } catch (error) {
    console.error('添加评论错误:', error);
    return res.status(500).json({ error: '添加评论失败' });
  }
};

/**
 * 获取动态详情
 */
const getDetail = async (req, res) => {
  const { postId } = req.params;

  // 尝试使用数据库
  if (query) {
    try {
      const result = await query(
        `SELECT p.id, p.content, p.images, p.is_anonymous, p.created_at,
                p.user_id,
                u.nickname, u.avatar_url,
                (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
                (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comment_count,
                EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
        [postId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '动态不存在' });
      }

      const row = result.rows[0];
      return res.json({
        data: {
          id: row.id,
          content: row.content,
          images: row.images || [],
          isAnonymous: row.is_anonymous,
          createdAt: row.created_at,
          userId: row.user_id, // 添加 userId 字段
          user: row.is_anonymous ? {
            nickname: '匿名用户',
            avatarUrl: null
          } : {
            id: row.user_id,
            nickname: row.nickname,
            avatarUrl: row.avatar_url
          },
          isOwner: row.user_id === req.user.id,
          likesCount: parseInt(row.like_count),
          commentsCount: parseInt(row.comment_count),
          isLiked: row.is_liked
        }
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const post = mockPosts.get(postId);
    if (!post) {
      return res.status(404).json({ error: '动态不存在' });
    }
    
    const likeCount = Array.from(mockLikes.values()).filter(l => l.postId === postId).length;
    const commentCount = Array.from(mockComments.values()).filter(c => c.postId === postId).length;
    const isLiked = Array.from(mockLikes.values()).some(l => l.postId === postId && l.userId === req.user.id);
    
    return res.json({
      data: {
        userId: post.userId, // 添加 userId 字段
        id: post.id,
        content: post.content,
        images: post.images || [],
        isAnonymous: post.isAnonymous,
        createdAt: post.createdAt,
        user: post.isAnonymous ? {
          nickname: '匿名用户',
          avatarUrl: null
        } : {
          id: post.userId,
          nickname: post.userNickname || '用户',
          avatarUrl: post.userAvatar || ''
        },
        isOwner: post.userId === req.user.id,
        likesCount: likeCount,
        commentsCount: commentCount,
        isLiked
      }
    });
  } catch (error) {
    console.error('获取动态详情错误:', error);
    return res.status(500).json({ error: '获取动态详情失败' });
  }
};

/**
 * 删除评论
 */
const deleteComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      // 检查评论是否存在且属于当前用户
      const commentResult = await query(
        'SELECT user_id FROM post_comments WHERE id = ? AND post_id = ?',
        [commentId, postId]
      );

      if (commentResult.rows.length === 0) {
        return res.status(404).json({ error: '评论不存在' });
      }

      if (commentResult.rows[0].user_id !== userId) {
        return res.status(403).json({ error: '只能删除自己的评论' });
      }

      await query('DELETE FROM post_comments WHERE id = ?', [commentId]);

      return res.json({ data: { message: '删除成功' } });
    } catch (dbError) {
      console.warn('数据库操作失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const comment = mockComments.get(commentId);
    if (!comment || comment.postId !== postId) {
      return res.status(404).json({ error: '评论不存在' });
    }
    
    if (comment.userId !== userId) {
      return res.status(403).json({ error: '只能删除自己的评论' });
    }
    
    mockComments.delete(commentId);
    
    return res.json({ data: { message: '删除成功' } });
  } catch (error) {
    console.error('删除评论错误:', error);
    return res.status(500).json({ error: '删除评论失败' });
  }
};

/**
 * 获取家庭活动记录（系统自动生成，非UGC）
 * 聚合家务完成、积分变动、储蓄记录、运动打卡等
 */
const getActivityList = async (req, res) => {
  const { familyId, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为家庭成员
      const memberCheck = await query(
        'SELECT id FROM family_members WHERE family_id = ? AND user_id = ?',
        [familyId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      // 1. 获取家务完成记录
      const choreRecords = await query(
        `SELECT 
          cr.id,
          'chore' as type,
          cr.user_id,
          u.nickname,
          u.avatar_url,
          ct.name as chore_name,
          cr.points_earned as points,
          cr.note,
          cr.completed_at as created_at
        FROM chore_records cr
        JOIN users u ON cr.user_id = u.id
        JOIN chore_types ct ON cr.chore_type_id = ct.id
        WHERE cr.family_id = ?
        ORDER BY cr.completed_at DESC
        LIMIT 50`,
        [familyId]
      );

      // 2. 获取积分交易记录（排除家务获取的积分，避免重复）
      const pointRecords = await query(
        `SELECT 
          pt.id,
          'points' as type,
          pt.user_id,
          u.nickname,
          u.avatar_url,
          pt.points,
          pt.type as points_type,
          pt.description,
          pt.created_at
        FROM point_transactions pt
        JOIN users u ON pt.user_id = u.id
        WHERE pt.family_id = ? AND pt.type != 'earn'
        ORDER BY pt.created_at DESC
        LIMIT 50`,
        [familyId]
      );

      // 3. 获取储蓄交易记录
      const savingsRecords = await query(
        `SELECT 
          st.id,
          'savings' as type,
          sa.user_id,
          u.nickname,
          u.avatar_url,
          st.type as savings_type,
          st.amount,
          st.created_at
        FROM savings_transactions st
        JOIN savings_accounts sa ON st.account_id = sa.id
        JOIN users u ON sa.user_id = u.id
        WHERE sa.family_id = ?
        ORDER BY st.created_at DESC
        LIMIT 50`,
        [familyId]
      );

      // 4. 获取运动记录
      const sportRecords = await query(
        `SELECT 
          sr.id,
          'sport' as type,
          sr.user_id,
          u.nickname,
          u.avatar_url,
          sr.sport_type,
          sr.icon,
          sr.duration,
          sr.calories,
          sr.created_at
        FROM sport_records sr
        JOIN users u ON sr.user_id = u.id
        WHERE sr.family_id = ?
        ORDER BY sr.created_at DESC
        LIMIT 50`,
        [familyId]
      );

      // 合并并格式化所有记录
      const allActivities = [];

      // 格式化家务记录
      for (const record of choreRecords.rows) {
        allActivities.push({
          id: record.id,
          type: 'chore',
          icon: '🧹',
          title: `完成了家务【${record.chore_name}】`,
          description: `获得 ${record.points} 积分`,
          note: record.note,
          userId: record.user_id,
          user: {
            nickname: record.nickname,
            avatarUrl: record.avatar_url
          },
          createdAt: record.created_at
        });
      }

      // 格式化积分记录
      for (const record of pointRecords.rows) {
        let title = '';
        let icon = '🎁';
        if (record.points_type === 'spend') {
          title = `消费了 ${Math.abs(record.points)} 积分`;
          icon = '💸';
        } else if (record.points_type === 'adjust') {
          title = record.points > 0 ? `获得奖励 ${record.points} 积分` : `扣除 ${Math.abs(record.points)} 积分`;
          icon = record.points > 0 ? '🎁' : '📉';
        }
        
        allActivities.push({
          id: record.id,
          type: 'points',
          icon,
          title,
          description: record.description || '',
          userId: record.user_id,
          user: {
            nickname: record.nickname,
            avatarUrl: record.avatar_url
          },
          createdAt: record.created_at
        });
      }

      // 格式化储蓄记录
      for (const record of savingsRecords.rows) {
        let title = '';
        let icon = '💰';
        if (record.savings_type === 'deposit') {
          title = `存入了 ${record.amount} 元`;
          icon = '💰';
        } else if (record.savings_type === 'withdraw') {
          title = `取出了 ${record.amount} 元`;
          icon = '💸';
        } else if (record.savings_type === 'interest') {
          title = `获得利息 ${record.amount} 元`;
          icon = '📈';
        }
        
        allActivities.push({
          id: record.id,
          type: 'savings',
          icon,
          title,
          description: record.description || '',
          userId: record.user_id,
          user: {
            nickname: record.nickname,
            avatarUrl: record.avatar_url
          },
          createdAt: record.created_at
        });
      }

      // 格式化运动记录
      for (const record of sportRecords.rows) {
        allActivities.push({
          id: record.id,
          type: 'sport',
          icon: record.icon || '🏃',
          title: `完成了【${record.sport_type}】运动`,
          description: `${record.duration}分钟，消耗${record.calories}千卡`,
          userId: record.user_id,
          user: {
            nickname: record.nickname,
            avatarUrl: record.avatar_url
          },
          createdAt: record.created_at
        });
      }

      // 按时间倒序排序
      allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // 分页
      const paginatedActivities = allActivities.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      return res.json({
        data: paginatedActivities,
        total: allActivities.length,
        hasMore: parseInt(offset) + parseInt(limit) < allActivities.length
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据（开发模式）
  try {
    const mockActivities = [
      {
        id: '1',
        type: 'chore',
        icon: '🧹',
        title: '完成了家务【洗碗】',
        description: '获得 10 积分',
        userId: 'mock-user-1',
        user: { nickname: '小明', avatarUrl: '' },
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5分钟前
      },
      {
        id: '2',
        type: 'sport',
        icon: '🏃',
        title: '完成了【跑步】运动',
        description: '30分钟，消耗200千卡',
        userId: 'mock-user-2',
        user: { nickname: '妈妈', avatarUrl: '' },
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30分钟前
      },
      {
        id: '3',
        type: 'savings',
        icon: '💰',
        title: '存入了 100 元',
        description: '旅行基金',
        userId: 'mock-user-1',
        user: { nickname: '小明', avatarUrl: '' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1小时前
      },
      {
        id: '4',
        type: 'points',
        icon: '🎁',
        title: '获得奖励 20 积分',
        description: '表现优秀奖励',
        userId: 'mock-user-1',
        user: { nickname: '小明', avatarUrl: '' },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2小时前
      }
    ];

    return res.json({
      data: mockActivities.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
      total: mockActivities.length,
      hasMore: parseInt(offset) + parseInt(limit) < mockActivities.length
    });
  } catch (error) {
    console.error('获取活动记录错误:', error);
    return res.status(500).json({ error: '获取活动记录失败' });
  }
};

module.exports = {
  getList,
  create,
  delete: deletePost,
  toggleLike,
  getComments,
  addComment,
  getDetail,
  deleteComment,
  getActivityList
};
