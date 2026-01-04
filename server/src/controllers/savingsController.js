// src/controllers/savingsController.js
// 存款控制器 - 处理存款相关请求

const { validationResult } = require('express-validator');
const savingsService = require('../services/savingsService');
const logger = require('../utils/logger');
const { ERROR_CODES, createError, createSuccess } = require('../constants/errorCodes');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取用户的存款账户
 */
const getAccount = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    const account = await savingsService.getAccountDetail(req.user.id, familyId);
    return res.json(createSuccess(account));
  } catch (error) {
    logger.error('获取账户错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 获取家庭所有成员的存款账户（管理员用）
 */
const getFamilyAccounts = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    const accounts = await savingsService.getFamilyAccounts(familyId, req.user.id);
    return res.json(createSuccess(accounts));
  } catch (error) {
    logger.error('获取家庭账户列表错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 提交存款申请（需要管理员审核）
 */
const submitDepositRequest = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { accountId, amount, description } = req.body;

  try {
    const result = await savingsService.submitDepositRequest({
      accountId,
      userId: req.user.id,
      amount,
      description
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('提交存款申请错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SAVINGS_DEPOSIT_FAILED, error.message)
    );
  }
};

/**
 * 获取存款申请列表
 */
const getRequests = async (req, res) => {
  const { familyId, status, page = 1, pageSize = 20 } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    // 此功能需要在savingsService中补充实现
    // 暂时返回空数据
    return res.json(createSuccess({ data: [], isAdmin: false }));
  } catch (error) {
    logger.error('获取申请列表错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 审核存款申请（管理员）
 */
const reviewRequest = async (req, res) => {
  const { requestId, action, rejectReason } = req.body;

  if (!requestId || !action) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.VALIDATION_ERROR, '缺少必要参数')
    );
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.VALIDATION_ERROR, '无效的操作')
    );
  }

  try {
    const result = await savingsService.reviewRequest({
      requestId,
      reviewerId: req.user.id,
      action,
      rejectReason
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('审核存款申请错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 直接存款（管理员专用，无需审核）
 */
const deposit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { accountId, amount, description } = req.body;

  try {
    const result = await savingsService.deposit({
      accountId,
      operatorId: req.user.id,
      amount,
      description
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('存款错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SAVINGS_DEPOSIT_FAILED, error.message)
    );
  }
};

/**
 * 直接取款（管理员专用）
 */
const withdraw = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { accountId, amount, description } = req.body;

  try {
    const result = await savingsService.withdraw({
      accountId,
      operatorId: req.user.id,
      amount,
      description
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('取款错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SAVINGS_WITHDRAW_FAILED, error.message)
    );
  }
};

/**
 * 结算利息
 */
const settleInterest = async (req, res) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.VALIDATION_ERROR, '缺少账户ID')
    );
  }

  try {
    const result = await savingsService.settleInterest(accountId, req.user.id);
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('利息结算错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SAVINGS_INTEREST_FAILED, error.message)
    );
  }
};

/**
 * 获取交易记录
 */
const getTransactions = async (req, res) => {
  const { accountId, page = 1, pageSize = 20 } = req.query;

  if (!accountId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.VALIDATION_ERROR, '缺少账户ID')
    );
  }

  try {
    const result = await savingsService.getTransactions({ accountId, page, pageSize });
    return res.json(result);
  } catch (error) {
    logger.error('获取交易记录错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 更新年利率（仅创建人）
 */
const updateRate = async (req, res) => {
  const { accountId, annualRate } = req.body;

  if (!accountId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.VALIDATION_ERROR, '缺少账户ID')
    );
  }

  try {
    const result = await savingsService.updateRate({
      accountId,
      operatorId: req.user.id,
      annualRate
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('更新利率错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 设置子管理员（仅创建人）
 */
const setSubAdmin = async (req, res) => {
  const { familyId, memberId, isAdmin } = req.body;

  if (!familyId || !memberId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.VALIDATION_ERROR, '缺少必要参数')
    );
  }

  try {
    // 此功能需要调用familyService
    const familyService = require('../services/familyService');
    const newRole = isAdmin ? 'admin' : 'member';
    const result = await familyService.updateMemberRole(req.user.id, familyId, memberId, newRole);
    return res.json(createSuccess({
      memberId,
      role: newRole,
      message: isAdmin ? '已设为子管理员' : '已取消子管理员'
    }));
  } catch (error) {
    logger.error('设置子管理员错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 获取待审核数量（管理员）
 */
const getPendingCount = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.json(createSuccess({ count: 0 }));
  }

  try {
    const count = await savingsService.getPendingCount(familyId, req.user.id);
    return res.json(createSuccess({ count }));
  } catch (error) {
    logger.error('获取待审核数量错误', error);
    return res.json(createSuccess({ count: 0 }));
  }
};

module.exports = {
  getAccount,
  getFamilyAccounts,
  submitDepositRequest,
  getRequests,
  reviewRequest,
  deposit,
  withdraw,
  settleInterest,
  getTransactions,
  updateRate,
  setSubAdmin,
  getPendingCount
};
