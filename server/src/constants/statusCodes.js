// src/constants/statusCodes.js
// 状态码定义 - ERP标准状态码规范

/**
 * 审核状态
 */
const REVIEW_STATUS = {
  PENDING: 'pending',       // 待审核
  APPROVED: 'approved',     // 已通过
  REJECTED: 'rejected'      // 已拒绝
};

/**
 * 交易类型
 */
const TRANSACTION_TYPE = {
  // 积分交易类型
  EARN: 'earn',             // 获得积分
  SPEND: 'spend',           // 消费积分
  ADJUST: 'adjust',         // 调整积分
  
  // 存款交易类型
  DEPOSIT: 'deposit',       // 存款
  WITHDRAW: 'withdraw',     // 取款
  INTEREST: 'interest'      // 利息
};

/**
 * HTTP状态码
 */
const HTTP_STATUS = {
  OK: 200,                  // 成功
  CREATED: 201,             // 创建成功
  BAD_REQUEST: 400,         // 请求错误
  UNAUTHORIZED: 401,        // 未授权
  FORBIDDEN: 403,           // 禁止访问
  NOT_FOUND: 404,           // 未找到
  CONFLICT: 409,            // 冲突
  INTERNAL_ERROR: 500       // 服务器内部错误
};

/**
 * 分页默认值
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
};

module.exports = {
  REVIEW_STATUS,
  TRANSACTION_TYPE,
  HTTP_STATUS,
  PAGINATION
};

