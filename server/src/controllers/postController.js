// src/controllers/postController.js
// 动态控制器 - 处理家庭动态相关请求

const postService = require('../services/postService');
const { validationResult } = require('express-validator');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取动态列表
 */
const getList = async (req, res) => {
  const { familyId, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const result = await postService.getList({
      familyId,
      userId: req.user.id,
      limit,
      offset
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取动态列表错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取动态列表失败' });
  }
};

/**
 * 发布动态
 */
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { familyId, content, images, isAnonymous } = req.body;
  const userId = req.user.id;

  // 验证：文字或图片至少有一个
  const hasContent = content && content.trim().length > 0;
  const hasImages = images && images.length > 0;
  
  if (!hasContent && !hasImages) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '请输入内容或添加图片' });
  }

  try {
    const result = await postService.create({
      familyId,
      userId,
      content,
      images,
      isAnonymous
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('发布动态错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '发布动态失败' });
  }
};

/**
 * 删除动态
 */
const deletePost = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const result = await postService.delete(postId, userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('删除动态错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '删除动态失败' });
  }
};

/**
 * 点赞/取消点赞
 */
const toggleLike = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const result = await postService.toggleLike(postId, userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('点赞操作错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '点赞操作失败' });
  }
};

/**
 * 获取评论列表
 */
const getComments = async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await postService.getComments(postId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取评论错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取评论失败' });
  }
};

/**
 * 添加评论
 */
const addComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  try {
    const result = await postService.addComment({
      postId,
      userId,
      content
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('添加评论错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '添加评论失败' });
  }
};

/**
 * 获取动态详情
 */
const getDetail = async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const result = await postService.getDetail(postId, userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取动态详情错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取动态详情失败' });
  }
};

/**
 * 删除评论
 */
const deleteComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  try {
    const result = await postService.deleteComment(postId, commentId, userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('删除评论错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '删除评论失败' });
  }
};

/**
 * 获取家庭活动记录
 */
const getActivityList = async (req, res) => {
  const { familyId, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const result = await postService.getActivityList({
      familyId,
      userId: req.user.id,
      limit,
      offset
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('获取活动记录错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取活动记录失败' });
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
