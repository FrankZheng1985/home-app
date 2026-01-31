// src/routes/chores.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const choreController = require('../controllers/choreController');
const { authenticate, isAdmin, isFamilyMember } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取家务类型列表
router.get('/types', authenticate, asyncHandler(choreController.getTypes));

// 创建家务类型
router.post('/types', authenticate, isAdmin, [
  body('familyId').notEmpty().withMessage('家庭ID不能为空'),
  body('name').notEmpty().withMessage('家务名称不能为空')
    .isLength({ max: 20 }).withMessage('家务名称不能超过20个字符'),
  body('points').isInt({ min: 1 }).withMessage('积分必须大于0')
], asyncHandler(choreController.createType));

// 更新家务类型
router.put('/types/:typeId', authenticate, isAdmin, [
  body('name').optional().isLength({ max: 20 }).withMessage('家务名称不能超过20个字符'),
  body('points').optional().isInt({ min: 1 }).withMessage('积分必须大于0')
], asyncHandler(choreController.updateType));

// 删除家务类型
router.delete('/types/:typeId', authenticate, isAdmin, asyncHandler(choreController.deleteType));

// 提交家务记录
router.post('/records', authenticate, [
  body('choreTypeId').notEmpty().withMessage('家务类型ID不能为空'),
  body('familyId').notEmpty().withMessage('家庭ID不能为空')
], asyncHandler(choreController.createRecord));

// 获取家务记录列表
router.get('/records', authenticate, asyncHandler(choreController.getRecords));

// 获取家务统计
router.get('/statistics', authenticate, asyncHandler(choreController.getStatistics));

// 获取待审核的家务记录（管理员）
router.get('/pending', authenticate, asyncHandler(choreController.getPendingRecords));

// 获取待审核数量
router.get('/pending-count', authenticate, asyncHandler(choreController.getPendingCount));

// 审核家务记录（管理员）
router.post('/review', authenticate, [
  body('recordId').notEmpty().withMessage('记录ID不能为空'),
  body('action').isIn(['approve', 'reject']).withMessage('无效的操作')
], asyncHandler(choreController.reviewRecord));

module.exports = router;

