// src/controllers/choreController.js
// 家务控制器 - 处理家务相关请求

const { validationResult } = require('express-validator');
const choreService = require('../services/choreService');
const logger = require('../utils/logger');
const { ERROR_CODES, createError, createSuccess } = require('../constants/errorCodes');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取家务类型列表
 */
const getTypes = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    const types = await choreService.getChoreTypes(familyId, req.user.id);
    return res.json(createSuccess(types));
  } catch (error) {
    logger.error('获取家务类型错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 创建家务类型
 */
const createType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { familyId, name, points, icon, description } = req.body;

  try {
    const type = await choreService.createChoreType({
      familyId,
      userId: req.user.id,
      name,
      points,
      icon,
      description
    });
    return res.json(createSuccess(type));
  } catch (error) {
    logger.error('创建家务类型错误', error);
    
    if (error.message === ERROR_CODES.CHORE_TYPE_NAME_EXISTS.message) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        createError(ERROR_CODES.CHORE_TYPE_NAME_EXISTS)
      );
    }
    
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.CHORE_TYPE_CREATE_FAILED, error.message)
    );
  }
};

/**
 * 更新家务类型
 */
const updateType = async (req, res) => {
  const { typeId } = req.params;
  const { name, points, icon, description, isActive } = req.body;

  try {
    const result = await choreService.updateChoreType(typeId, req.user.id, {
      name,
      points,
      icon,
      description,
      isActive
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('更新家务类型错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 删除家务类型（软删除）
 */
const deleteType = async (req, res) => {
  const { typeId } = req.params;

  try {
    const result = await choreService.deleteChoreType(typeId, req.user.id);
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('删除家务类型错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 提交家务记录
 */
const createRecord = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { choreTypeId, familyId, note, images } = req.body;

  try {
    const result = await choreService.createChoreRecord({
      choreTypeId,
      familyId,
      userId: req.user.id,
      note,
      images
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('提交家务记录错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.CHORE_RECORD_CREATE_FAILED, error.message)
    );
  }
};

/**
 * 获取家务记录列表
 */
const getRecords = async (req, res) => {
  const { familyId, userId, date, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    const records = await choreService.getChoreRecords({
      familyId,
      userId,
      requestUserId: req.user.id,
      date,
      limit,
      offset
    });
    return res.json(createSuccess(records));
  } catch (error) {
    logger.error('获取家务记录错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 获取家务统计
 */
const getStatistics = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    const stats = await choreService.getStatistics(familyId, req.user.id);
    return res.json(createSuccess(stats));
  } catch (error) {
    logger.error('获取家务统计错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 获取待审核的家务记录（管理员）
 */
const getPendingRecords = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json(
      createError(ERROR_CODES.FAMILY_ID_REQUIRED)
    );
  }

  try {
    const records = await choreService.getPendingRecords(familyId, req.user.id);
    return res.json(createSuccess(records));
  } catch (error) {
    logger.error('获取待审核记录错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, error.message)
    );
  }
};

/**
 * 审核家务记录（管理员）
 */
const reviewRecord = async (req, res) => {
  const { recordId, action, deduction, deductionReason, reviewNote } = req.body;

  if (!recordId || !action) {
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
    const result = await choreService.reviewRecord({
      recordId,
      reviewerId: req.user.id,
      action,
      deduction,
      deductionReason,
      reviewNote
    });
    return res.json(createSuccess(result));
  } catch (error) {
    logger.error('审核家务记录错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.CHORE_REVIEW_FAILED, error.message)
    );
  }
};

/**
 * 获取待审核数量
 */
const getPendingCount = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.json(createSuccess({ count: 0 }));
  }

  try {
    const count = await choreService.getPendingCount(familyId, req.user.id);
    return res.json(createSuccess({ count }));
  } catch (error) {
    logger.error('获取待审核数量错误', error);
    return res.json(createSuccess({ count: 0 }));
  }
};

module.exports = {
  getTypes,
  createType,
  updateType,
  deleteType,
  createRecord,
  getRecords,
  getStatistics,
  getPendingRecords,
  reviewRecord,
  getPendingCount
};
