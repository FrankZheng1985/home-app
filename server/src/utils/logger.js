// src/utils/logger.js
// 日志工具 - ERP标准日志规范

const path = require('path');
const fs = require('fs');

/**
 * 日志级别
 */
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * 日志级别优先级
 */
const LEVEL_PRIORITY = {
  [LOG_LEVELS.ERROR]: 0,
  [LOG_LEVELS.WARN]: 1,
  [LOG_LEVELS.INFO]: 2,
  [LOG_LEVELS.DEBUG]: 3
};

// 当前日志级别（从环境变量获取，默认INFO）
const currentLevel = process.env.LOG_LEVEL || LOG_LEVELS.INFO;

/**
 * 格式化日期时间
 * @returns {string} 格式化的日期时间字符串
 */
const formatDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

/**
 * 获取调用者信息
 * @returns {string} 调用位置信息
 */
const getCallerInfo = () => {
  const stack = new Error().stack;
  if (!stack) return '';
  
  const lines = stack.split('\n');
  // 跳过 Error、getCallerInfo、log函数，找到实际调用位置
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (line && !line.includes('logger.js')) {
      const match = line.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/) ||
                   line.match(/at\s+(.+):(\d+):(\d+)/);
      if (match) {
        const fileName = match[2] || match[1];
        const lineNum = match[3] || match[2];
        return `[${path.basename(fileName)}:${lineNum}]`;
      }
    }
  }
  return '';
};

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} [meta] - 元数据
 * @returns {string} 格式化的日志字符串
 */
const formatLog = (level, message, meta) => {
  const timestamp = formatDateTime();
  const caller = process.env.NODE_ENV === 'development' ? getCallerInfo() : '';
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  
  return `[${timestamp}] [${level.padEnd(5)}] ${caller} ${message}${metaStr}`;
};

/**
 * 检查是否应该输出该级别的日志
 * @param {string} level - 日志级别
 * @returns {boolean}
 */
const shouldLog = (level) => {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[currentLevel];
};

/**
 * 输出日志
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} [meta] - 元数据
 */
const log = (level, message, meta) => {
  if (!shouldLog(level)) return;
  
  const formattedLog = formatLog(level, message, meta);
  
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error('\x1b[31m%s\x1b[0m', formattedLog); // 红色
      break;
    case LOG_LEVELS.WARN:
      console.warn('\x1b[33m%s\x1b[0m', formattedLog); // 黄色
      break;
    case LOG_LEVELS.INFO:
      console.info('\x1b[36m%s\x1b[0m', formattedLog); // 青色
      break;
    case LOG_LEVELS.DEBUG:
      console.log('\x1b[90m%s\x1b[0m', formattedLog); // 灰色
      break;
    default:
      console.log(formattedLog);
  }
};

/**
 * 日志记录器
 */
const logger = {
  /**
   * 错误日志
   * @param {string} message - 错误消息
   * @param {Error|Object} [error] - 错误对象或元数据
   */
  error: (message, error) => {
    const meta = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    log(LOG_LEVELS.ERROR, message, meta);
  },

  /**
   * 警告日志
   * @param {string} message - 警告消息
   * @param {Object} [meta] - 元数据
   */
  warn: (message, meta) => {
    log(LOG_LEVELS.WARN, message, meta);
  },

  /**
   * 信息日志
   * @param {string} message - 信息消息
   * @param {Object} [meta] - 元数据
   */
  info: (message, meta) => {
    log(LOG_LEVELS.INFO, message, meta);
  },

  /**
   * 调试日志
   * @param {string} message - 调试消息
   * @param {Object} [meta] - 元数据
   */
  debug: (message, meta) => {
    log(LOG_LEVELS.DEBUG, message, meta);
  },

  /**
   * 请求日志（用于记录API请求）
   * @param {Object} req - Express请求对象
   * @param {number} [statusCode] - 响应状态码
   * @param {number} [duration] - 请求耗时(ms)
   */
  request: (req, statusCode, duration) => {
    const meta = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.id,
      statusCode,
      duration: duration ? `${duration}ms` : undefined
    };
    log(LOG_LEVELS.INFO, `${req.method} ${req.path}`, meta);
  },

  /**
   * 数据库查询日志
   * @param {string} query - SQL查询
   * @param {number} duration - 查询耗时(ms)
   * @param {number} [rowCount] - 影响行数
   */
  query: (query, duration, rowCount) => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const meta = {
      duration: `${duration}ms`,
      rows: rowCount
    };
    // 截断过长的查询
    const shortQuery = query.length > 200 ? query.substring(0, 200) + '...' : query;
    log(LOG_LEVELS.DEBUG, `SQL: ${shortQuery}`, meta);
  },

  /**
   * 业务操作日志
   * @param {string} action - 操作名称
   * @param {string} userId - 用户ID
   * @param {Object} [details] - 操作详情
   */
  audit: (action, userId, details) => {
    const meta = {
      userId,
      action,
      ...details,
      timestamp: new Date().toISOString()
    };
    log(LOG_LEVELS.INFO, `[AUDIT] ${action}`, meta);
  }
};

module.exports = logger;

