// src/middleware/errorHandler.js

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  console.error('错误详情:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // 参数验证错误
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      error: '参数验证失败',
      details: err.array()
    });
  }

  // 数据库错误
  if (err.code) {
    switch (err.code) {
      case '23505': // 唯一约束冲突
        return res.status(409).json({ error: '数据已存在' });
      case '23503': // 外键约束冲突
        return res.status(400).json({ error: '关联数据不存在' });
      case '22P02': // 无效的数据类型
        return res.status(400).json({ error: '数据格式错误' });
      default:
        break;
    }
  }

  // 自定义错误
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // 默认服务器错误
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  });
};

/**
 * 异步处理包装器
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 创建自定义错误
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError
};

