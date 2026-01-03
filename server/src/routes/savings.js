// src/routes/savings.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const savingsController = require('../controllers/savingsController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取当前用户的存款账户
router.get('/account', authenticate, asyncHandler(savingsController.getAccount));

// 获取家庭所有成员的存款账户（管理员）
router.get('/family-accounts', authenticate, asyncHandler(savingsController.getFamilyAccounts));

// 获取交易记录
router.get('/transactions', authenticate, asyncHandler(savingsController.getTransactions));

// 获取存款申请列表
router.get('/requests', authenticate, asyncHandler(savingsController.getRequests));

// 获取待审核数量
router.get('/pending-count', authenticate, asyncHandler(savingsController.getPendingCount));

// 提交存款申请（普通用户）
router.post('/request', authenticate, [
  body('accountId').notEmpty().withMessage('账户ID不能为空'),
  body('amount').isFloat({ min: 0.01 }).withMessage('金额必须大于0')
], asyncHandler(savingsController.submitDepositRequest));

// 审核存款申请（管理员）
router.post('/review', authenticate, [
  body('requestId').notEmpty().withMessage('申请ID不能为空'),
  body('action').isIn(['approve', 'reject']).withMessage('无效的操作')
], asyncHandler(savingsController.reviewRequest));

// 直接存款（管理员）
router.post('/deposit', authenticate, [
  body('accountId').notEmpty().withMessage('账户ID不能为空'),
  body('amount').isFloat({ min: 0.01 }).withMessage('存款金额必须大于0')
], asyncHandler(savingsController.deposit));

// 直接取款（管理员）
router.post('/withdraw', authenticate, [
  body('accountId').notEmpty().withMessage('账户ID不能为空'),
  body('amount').isFloat({ min: 0.01 }).withMessage('取款金额必须大于0')
], asyncHandler(savingsController.withdraw));

// 结算利息
router.post('/settle-interest', authenticate, [
  body('accountId').notEmpty().withMessage('账户ID不能为空')
], asyncHandler(savingsController.settleInterest));

// 更新利率（仅创建人）
router.put('/rate', authenticate, [
  body('accountId').notEmpty().withMessage('账户ID不能为空'),
  body('annualRate').isFloat({ min: 0, max: 1 }).withMessage('年利率必须在0-100%之间')
], asyncHandler(savingsController.updateRate));

// 设置子管理员（仅创建人）
router.post('/set-sub-admin', authenticate, [
  body('familyId').notEmpty().withMessage('家庭ID不能为空'),
  body('memberId').notEmpty().withMessage('成员ID不能为空'),
  body('isAdmin').isBoolean().withMessage('请指定是否为管理员')
], asyncHandler(savingsController.setSubAdmin));

module.exports = router;
