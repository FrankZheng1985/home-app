// src/utils/index.js
// 工具函数统一导出

const logger = require('./logger');

/**
 * 生成指定长度的随机字符串（用于邀请码等）
 * @param {number} length - 长度
 * @returns {string}
 */
const generateRandomString = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date - 日期对象
 * @returns {string}
 */
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 解析分页参数
 * @param {Object} query - 请求查询参数
 * @returns {Object} { page, pageSize, offset }
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || parseInt(query.limit) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
};

/**
 * 驼峰转下划线（用于数据库字段转换）
 * @param {string} str - 驼峰字符串
 * @returns {string}
 */
const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * 下划线转驼峰（用于返回数据转换）
 * @param {string} str - 下划线字符串
 * @returns {string}
 */
const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * 对象键名转换（下划线转驼峰）
 * @param {Object} obj - 原对象
 * @returns {Object}
 */
const transformKeys = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(transformKeys);
  
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = transformKeys(obj[key]);
    }
  }
  return result;
};

/**
 * 安全解析JSON
 * @param {string} str - JSON字符串
 * @param {any} defaultValue - 默认值
 * @returns {any}
 */
const safeParseJSON = (str, defaultValue = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

/**
 * 延迟执行
 * @param {number} ms - 毫秒数
 * @returns {Promise}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  logger,
  generateRandomString,
  formatDate,
  parsePagination,
  camelToSnake,
  snakeToCamel,
  transformKeys,
  safeParseJSON,
  delay
};

