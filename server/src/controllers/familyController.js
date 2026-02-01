// src/controllers/familyController.js
// 家庭控制器 - 处理家庭相关请求 (ERP 风格，调用 Service 层)

const familyService = require('../services/familyService');
const { validationResult } = require('express-validator');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 创建家庭
 */
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { name } = req.body;
  const userId = req.user.id;

  try {
    const result = await familyService.createFamily(userId, name);
    
    // 同步更新 mockUsers 中的用户信息（开发模式）
    if (!familyService.isDatabaseAvailable()) {
      const mockUsers = global.mockUsers || new Map();
      for (const [openId, u] of mockUsers) {
        if (u.id === userId) {
          u.familyId = result.id;
          u.familyRole = 'creator';
          break;
        }
      }
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建家庭错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '创建家庭失败' });
  }
};

/**
 * 获取我的家庭列表
 */
const getMyFamilies = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await familyService.getUserFamilies(userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取家庭列表错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: '获取家庭列表失败' });
  }
};

/**
 * 通过邀请码加入家庭
 */
const joinByCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { inviteCode } = req.body;
  const userId = req.user.id;

  try {
    const result = await familyService.joinByInviteCode(userId, inviteCode);
    
    // 同步更新 mockUsers 中的用户信息（开发模式）
    if (!familyService.isDatabaseAvailable()) {
      const mockUsers = global.mockUsers || new Map();
      for (const [openId, u] of mockUsers) {
        if (u.id === userId) {
          u.familyId = result.id;
          u.familyRole = 'member';
          break;
        }
      }
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('加入家庭错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '加入家庭失败' });
  }
};

/**
 * 获取家庭信息
 */
const getInfo = async (req, res) => {
  const { familyId } = req.params;

  try {
    const result = await familyService.getFamilyInfo(familyId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取家庭信息错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取家庭信息失败' });
  }
};

/**
 * 获取家庭成员列表
 */
const getMembers = async (req, res) => {
  const { familyId } = req.params;

  try {
    const result = await familyService.getFamilyMembers(familyId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取成员列表错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: '获取成员列表失败' });
  }
};

/**
 * 更新成员角色
 */
const updateMemberRole = async (req, res) => {
  const { familyId, memberId } = req.params;
  const { role } = req.body;
  const operatorId = req.user.id;

  try {
    const result = await familyService.updateMemberRole(operatorId, familyId, memberId, role);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('更新成员角色错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '更新成员角色失败' });
  }
};

/**
 * 移除家庭成员
 */
const removeMember = async (req, res) => {
  const { familyId, memberId } = req.params;
  // TODO: Implement in service if needed
  return res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({ error: '功能开发中' });
};

/**
 * 退出家庭
 */
const leave = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;
  // TODO: Implement in service
  return res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({ error: '功能开发中' });
};

/**
 * 生成邀请二维码
 */
const generateQRCode = async (req, res) => {
  const { familyId } = req.params;
  try {
    const info = await familyService.getFamilyInfo(familyId);
    return res.json({
      success: true,
      data: {
        inviteCode: info.inviteCode,
        qrCodeUrl: null
      }
    });
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: '生成失败' });
  }
};

/**
 * 更新家庭信息
 */
const updateFamily = async (req, res) => {
  const { familyId } = req.params;
  const { name } = req.body;
  // TODO: Implement in service
  return res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({ error: '功能开发中' });
};

/**
 * 更新积分价值
 */
const updatePointsValue = async (req, res) => {
  const { familyId } = req.params;
  const { pointsValue } = req.body;
  const userId = req.user.id;

  try {
    // 验证管理员权限
    await familyService.validateAdminRole(userId, familyId);
    
    if (familyService.isDatabaseAvailable()) {
      await familyService.query('UPDATE families SET points_value = $1 WHERE id = $2', [pointsValue, familyId]);
    } else {
      const family = global.mockFamilies.get(familyId);
      if (family) family.points_value = pointsValue;
    }

    return res.json({ success: true, data: { pointsValue, message: '更新成功' } });
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '更新失败' });
  }
};

module.exports = {
  create,
  getMyFamilies,
  joinByCode,
  getInfo,
  getMembers,
  updateMemberRole,
  removeMember,
  leave,
  generateQRCode,
  updatePointsValue,
  updateFamily
};
