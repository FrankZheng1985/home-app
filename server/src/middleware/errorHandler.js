// src/middleware/errorHandler.js
// 错误处理中间件 - 统一错误处理

const logger = require('../utils/logger');
const { ERROR_CODES, createError } = require('../constants/errorCodes');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error('请求错误', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // 参数验证错误（express-validator）
  if (err.array && typeof err.array === 'function') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ...createError(ERROR_CODES.VALIDATION_ERROR),
      details: err.array()
    });
  }

  // 数据库错误
  if (err.code) {
    switch (err.code) {
      case '23505': // 唯一约束冲突
        return res.status(HTTP_STATUS.CONFLICT).json(
          createError(ERROR_CODES.SYSTEM_ERROR, '数据已存在')
        );
      case '23503': // 外键约束冲突
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          createError(ERROR_CODES.SYSTEM_ERROR, '关联数据不存在')
        );
      case '22P02': // 无效的数据类型
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          createError(ERROR_CODES.VALIDATION_ERROR, '数据格式错误')
        );
      default:
        break;
    }
  }

  // 自定义错误（带状态码）
  if (err.statusCode) {
    return res.status(err.statusCode).json(
      createError({ code: err.statusCode, message: err.message })
    );
  }

  // 已知的业务错误
  const knownError = Object.values(ERROR_CODES).find(e => e.message === err.message);
  if (knownError) {
    const status = knownError.code < 20000 ? HTTP_STATUS.UNAUTHORIZED :
                   knownError.code < 30000 ? HTTP_STATUS.BAD_REQUEST :
                   knownError.code < 90000 ? HTTP_STATUS.BAD_REQUEST :
                   HTTP_STATUS.INTERNAL_ERROR;
    return res.status(status).json(createError(knownError));
  }

  // 默认服务器错误
  res.status(HTTP_STATUS.INTERNAL_ERROR).json(
    createError(
      ERROR_CODES.SYSTEM_ERROR,
      process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
    )
  );
};

/**
 * 异步处理包装器
 * 自动捕获异步函数中的错误并传递给错误处理中间件
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 创建自定义错误
 */
class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_ERROR) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 请求日志中间件
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // 响应结束时记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req, res.statusCode, duration);
  });
  
  next();
};

/**
 * 404 处理中间件
 */
const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json(
    createError(ERROR_CODES.API_NOT_FOUND)
  );
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  requestLogger,
  notFoundHandler
};
