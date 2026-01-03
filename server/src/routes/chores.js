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
router.post('/types', authenticate, [
  body('familyId').notEmpty().withMessage('家庭ID不能为空'),
  body('name').notEmpty().withMessage('家务名称不能为空')
    .isLength({ max: 20 }).withMessage('家务名称不能超过20个字符'),
  body('points').isInt({ min: 1 }).withMessage('积分必须大于0')
], asyncHandler(choreController.createType));

// 更新家务类型
router.put('/types/:typeId', authenticate, [
  body('name').optional().isLength({ max: 20 }).withMessage('家务名称不能超过20个字符'),
  body('points').optional().isInt({ min: 1 }).withMessage('积分必须大于0')
], asyncHandler(choreController.updateType));

// 删除家务类型
router.delete('/types/:typeId', authenticate, asyncHandler(choreController.deleteType));

// 提交家务记录
router.post('/records', authenticate, [
  body('choreTypeId').notEmpty().withMessage('家务类型ID不能为空'),
  body('familyId').notEmpty().withMessage('家庭ID不能为空')
], asyncHandler(choreController.createRecord));

// 获取家务记录列表
router.get('/records', authenticate, asyncHandler(choreController.getRecords));

// 获取家务统计
router.get('/statistics', authenticate, asyncHandler(choreController.getStatistics));

module.exports = router;

