// src/routes/families.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const familyController = require('../controllers/familyController');
const { authenticate, isAdmin, isFamilyMember } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 创建家庭
router.post('/', authenticate, [
  body('name').notEmpty().withMessage('家庭名称不能为空')
    .isLength({ max: 20 }).withMessage('家庭名称不能超过20个字符')
], asyncHandler(familyController.create));

// 获取我的家庭列表
router.get('/my', authenticate, asyncHandler(familyController.getMyFamilies));

// 通过邀请码加入家庭
router.post('/join', authenticate, [
  body('inviteCode').notEmpty().withMessage('邀请码不能为空')
], asyncHandler(familyController.joinByCode));

// 获取家庭信息
router.get('/:familyId', authenticate, isFamilyMember, asyncHandler(familyController.getInfo));

// 获取家庭成员列表
router.get('/:familyId/members', authenticate, isFamilyMember, asyncHandler(familyController.getMembers));

// 更新成员角色
router.put('/:familyId/members/:memberId/role', authenticate, isAdmin, [
  body('role').isIn(['member', 'admin']).withMessage('无效的角色')
], asyncHandler(familyController.updateMemberRole));

// 移除家庭成员
router.delete('/:familyId/members/:memberId', authenticate, isAdmin, asyncHandler(familyController.removeMember));

// 退出家庭
router.post('/:familyId/leave', authenticate, isFamilyMember, asyncHandler(familyController.leave));

// 生成邀请二维码
router.get('/:familyId/qrcode', authenticate, isFamilyMember, asyncHandler(familyController.generateQRCode));

// 更新积分价值
router.put('/:familyId/points-value', authenticate, isAdmin, [
  body('pointsValue').isFloat({ min: 0 }).withMessage('积分价值必须大于等于0')
], asyncHandler(familyController.updatePointsValue));

module.exports = router;

