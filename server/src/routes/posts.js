// src/routes/posts.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const postController = require('../controllers/postController');
const { authenticate, isFamilyMember } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取家庭活动记录（系统自动生成，非UGC）
router.get('/activities', authenticate, asyncHandler(postController.getActivityList));

// 获取动态列表（旧版UGC，保留兼容）
router.get('/', authenticate, asyncHandler(postController.getList));

// 发布动态（文字或图片至少有一个）
router.post('/', authenticate, [
  body('familyId').notEmpty().withMessage('家庭ID不能为空'),
  body('content').optional().isLength({ max: 1000 }).withMessage('内容不能超过1000个字符')
], asyncHandler(postController.create));

// 获取动态详情
router.get('/:postId', authenticate, asyncHandler(postController.getDetail));

// 删除动态
router.delete('/:postId', authenticate, asyncHandler(postController.delete));

// 点赞/取消点赞
router.post('/:postId/like', authenticate, asyncHandler(postController.toggleLike));

// 获取评论列表
router.get('/:postId/comments', authenticate, asyncHandler(postController.getComments));

// 添加评论
router.post('/:postId/comments', authenticate, [
  body('content').notEmpty().withMessage('评论内容不能为空')
    .isLength({ max: 200 }).withMessage('评论不能超过200个字符')
], asyncHandler(postController.addComment));

// 删除评论
router.delete('/:postId/comments/:commentId', authenticate, asyncHandler(postController.deleteComment));

module.exports = router;

