// src/controllers/postController.js
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * 获取动态列表
 */
const getList = async (req, res) => {
  const { familyId, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
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
              EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $2) as is_liked
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.family_id = $1
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [familyId, req.user.id, parseInt(limit), parseInt(offset)]
    );

    return res.json({
      data: result.rows.map(row => ({
        id: row.id,
        content: row.content,
        images: row.images || [],
        isAnonymous: row.is_anonymous,
        createdAt: row.created_at,
        author: row.is_anonymous ? {
          nickname: '匿名用户',
          avatarUrl: null
        } : {
          id: row.user_id,
          nickname: row.nickname,
          avatarUrl: row.avatar_url
        },
        isOwner: row.user_id === req.user.id,
        likeCount: parseInt(row.like_count),
        commentCount: parseInt(row.comment_count),
        isLiked: row.is_liked
      }))
    });
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

  try {
    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    const postId = uuidv4();
    await query(
      `INSERT INTO posts (id, user_id, family_id, content, images, is_anonymous, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
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

  try {
    // 验证是否为动态作者
    const postResult = await query(
      'SELECT user_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '动态不存在' });
    }

    if (postResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: '只能删除自己的动态' });
    }

    // 删除动态（级联删除点赞和评论）
    await query('DELETE FROM post_likes WHERE post_id = $1', [postId]);
    await query('DELETE FROM post_comments WHERE post_id = $1', [postId]);
    await query('DELETE FROM posts WHERE id = $1', [postId]);

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

  try {
    // 检查动态是否存在
    const postResult = await query(
      'SELECT family_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '动态不存在' });
    }

    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [postResult.rows[0].family_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    // 检查是否已点赞
    const likeCheck = await query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (likeCheck.rows.length > 0) {
      // 取消点赞
      await query(
        'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
      return res.json({ data: { liked: false, message: '已取消点赞' } });
    } else {
      // 点赞
      await query(
        'INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES ($1, $2, $3, NOW())',
        [uuidv4(), postId, userId]
      );
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

  try {
    // 检查动态是否存在并获取家庭ID
    const postResult = await query(
      'SELECT family_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '动态不存在' });
    }

    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [postResult.rows[0].family_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    const result = await query(
      `SELECT c.id, c.content, c.created_at,
              u.id as user_id, u.nickname, u.avatar_url
       FROM post_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
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

  try {
    // 检查动态是否存在并获取家庭ID
    const postResult = await query(
      'SELECT family_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '动态不存在' });
    }

    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [postResult.rows[0].family_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    const commentId = uuidv4();
    await query(
      'INSERT INTO post_comments (id, post_id, user_id, content, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [commentId, postId, userId, content]
    );

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

module.exports = {
  getList,
  create,
  delete: deletePost,
  toggleLike,
  getComments,
  addComment
};

