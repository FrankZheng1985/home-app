// src/constants/errorCodes.js
// 错误码定义 - ERP标准错误码规范

/**
 * 错误码规则：
 * - 1xxxx: 认证相关错误
 * - 2xxxx: 用户相关错误
 * - 3xxxx: 家庭相关错误
 * - 4xxxx: 家务相关错误
 * - 5xxxx: 积分相关错误
 * - 6xxxx: 存款相关错误
 * - 7xxxx: 动态相关错误
 * - 9xxxx: 系统错误
 */

const ERROR_CODES = {
  // ============ 认证相关 1xxxx ============
  AUTH_TOKEN_MISSING: { code: 10001, message: '未提供认证令牌' },
  AUTH_TOKEN_INVALID: { code: 10002, message: '无效的认证令牌' },
  AUTH_TOKEN_EXPIRED: { code: 10003, message: '认证令牌已过期' },
  AUTH_WX_LOGIN_FAILED: { code: 10004, message: '微信登录失败' },
  AUTH_USER_NOT_FOUND: { code: 10005, message: '用户不存在' },
  AUTH_PERMISSION_DENIED: { code: 10006, message: '权限不足' },

  // ============ 用户相关 2xxxx ============
  USER_ALREADY_EXISTS: { code: 20001, message: '用户已存在' },
  USER_NOT_FOUND: { code: 20002, message: '用户不存在' },
  USER_REGISTER_FAILED: { code: 20003, message: '注册失败' },
  USER_UPDATE_FAILED: { code: 20004, message: '更新用户信息失败' },
  USER_NICKNAME_REQUIRED: { code: 20005, message: '昵称不能为空' },
  USER_NICKNAME_TOO_LONG: { code: 20006, message: '昵称不能超过12个字符' },

  // ============ 家庭相关 3xxxx ============
  FAMILY_NOT_FOUND: { code: 30001, message: '家庭不存在' },
  FAMILY_CREATE_FAILED: { code: 30002, message: '创建家庭失败' },
  FAMILY_JOIN_FAILED: { code: 30003, message: '加入家庭失败' },
  FAMILY_INVITE_CODE_INVALID: { code: 30004, message: '邀请码无效' },
  FAMILY_ALREADY_MEMBER: { code: 30005, message: '您已是该家庭成员' },
  FAMILY_NOT_MEMBER: { code: 30006, message: '您不是该家庭成员' },
  FAMILY_ADMIN_REQUIRED: { code: 30007, message: '需要管理员权限' },
  FAMILY_CREATOR_REQUIRED: { code: 30008, message: '需要创建人权限' },
  FAMILY_CANNOT_REMOVE_CREATOR: { code: 30009, message: '不能移除创建人' },
  FAMILY_ID_REQUIRED: { code: 30010, message: '缺少家庭ID' },

  // ============ 家务相关 4xxxx ============
  CHORE_TYPE_NOT_FOUND: { code: 40001, message: '家务类型不存在' },
  CHORE_TYPE_NAME_EXISTS: { code: 40002, message: '家务名称已存在' },
  CHORE_TYPE_CREATE_FAILED: { code: 40003, message: '创建家务类型失败' },
  CHORE_RECORD_NOT_FOUND: { code: 40004, message: '家务记录不存在' },
  CHORE_RECORD_CREATE_FAILED: { code: 40005, message: '提交家务记录失败' },
  CHORE_RECORD_ALREADY_REVIEWED: { code: 40006, message: '该记录已处理' },
  CHORE_REVIEW_FAILED: { code: 40007, message: '审核失败' },
  CHORE_TYPE_ID_REQUIRED: { code: 40008, message: '家务类型ID不能为空' },
  CHORE_POINTS_INVALID: { code: 40009, message: '积分必须大于0' },

  // ============ 积分相关 5xxxx ============
  POINTS_INSUFFICIENT: { code: 50001, message: '积分不足' },
  POINTS_REDEEM_FAILED: { code: 50002, message: '积分兑换失败' },
  POINTS_TRANSACTION_FAILED: { code: 50003, message: '积分交易失败' },

  // ============ 存款相关 6xxxx ============
  SAVINGS_ACCOUNT_NOT_FOUND: { code: 60001, message: '账户不存在' },
  SAVINGS_BALANCE_INSUFFICIENT: { code: 60002, message: '余额不足' },
  SAVINGS_AMOUNT_INVALID: { code: 60003, message: '金额必须大于0' },
  SAVINGS_RATE_INVALID: { code: 60004, message: '年利率必须在0-100%之间' },
  SAVINGS_REQUEST_NOT_FOUND: { code: 60005, message: '申请不存在' },
  SAVINGS_REQUEST_ALREADY_PROCESSED: { code: 60006, message: '该申请已处理' },
  SAVINGS_DEPOSIT_FAILED: { code: 60007, message: '存款失败' },
  SAVINGS_WITHDRAW_FAILED: { code: 60008, message: '取款失败' },
  SAVINGS_INTEREST_FAILED: { code: 60009, message: '利息结算失败' },
  SAVINGS_NO_INTEREST: { code: 60010, message: '暂无可结算的利息' },

  // ============ 动态相关 7xxxx ============
  POST_NOT_FOUND: { code: 70001, message: '动态不存在' },
  POST_CREATE_FAILED: { code: 70002, message: '发布动态失败' },
  POST_DELETE_FAILED: { code: 70003, message: '删除动态失败' },
  POST_NO_PERMISSION: { code: 70004, message: '无权操作此动态' },
  COMMENT_NOT_FOUND: { code: 70005, message: '评论不存在' },
  COMMENT_CREATE_FAILED: { code: 70006, message: '评论失败' },

  // ============ 系统错误 9xxxx ============
  SYSTEM_ERROR: { code: 90001, message: '系统内部错误' },
  DATABASE_ERROR: { code: 90002, message: '数据库错误' },
  DATABASE_NOT_CONFIGURED: { code: 90003, message: '数据库未配置' },
  VALIDATION_ERROR: { code: 90004, message: '参数验证失败' },
  API_NOT_FOUND: { code: 90005, message: '接口不存在' },
  UPLOAD_FAILED: { code: 90006, message: '上传失败' },
  NETWORK_ERROR: { code: 90007, message: '网络错误' }
};

/**
 * 创建错误响应对象
 * @param {Object} errorCode - 错误码对象
 * @param {string} [customMessage] - 自定义消息（可选）
 * @returns {Object} 错误响应对象
 */
const createError = (errorCode, customMessage) => {
  return {
    code: errorCode.code,
    error: customMessage || errorCode.message
  };
};

/**
 * 创建成功响应对象
 * @param {any} data - 返回数据
 * @param {string} [message] - 成功消息
 * @returns {Object} 成功响应对象
 */
const createSuccess = (data, message) => {
  const response = { data };
  if (message) {
    response.message = message;
  }
  return response;
};

module.exports = {
  ERROR_CODES,
  createError,
  createSuccess
};

