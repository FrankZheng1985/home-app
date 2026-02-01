// src/services/baseService.js
// 基础服务类 - 提供通用数据库操作 (PostgreSQL 版本)

const logger = require('../utils/logger');

// 动态导入数据库模块
let db = null;
try {
  db = require('../config/database');
} catch (e) {
  logger.warn('数据库模块未加载，将使用模拟数据');
}

/**
 * 基础服务类
 * 提供数据库操作的基础方法
 */
class BaseService {
  constructor() {
    this.db = db;
  }

  /**
   * 检查数据库是否可用
   * @returns {boolean}
   */
  isDatabaseAvailable() {
    return !!this.db && !!this.db.query && this.db.getIsConnected();
  }

  /**
   * 执行数据库查询
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @returns {Promise<Object>}
   */
  async query(sql, params = []) {
    if (!this.isDatabaseAvailable()) {
      throw new Error('数据库未配置');
    }

    const start = Date.now();
    try {
      const result = await this.db.query(sql, params);
      const duration = Date.now() - start;
      logger.query(sql, duration, result.rowCount);
      return result;
    } catch (error) {
      logger.error('数据库查询错误', { sql, params, error: error.message });
      throw error;
    }
  }

  /**
   * 查询单条记录
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @returns {Promise<Object|null>}
   */
  async queryOne(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 查询多条记录
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @returns {Promise<Array>}
   */
  async queryMany(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * 插入记录并返回 (PostgreSQL 版本)
   * @param {string} table - 表名
   * @param {Object} data - 数据对象
   * @param {string} [returning] - 返回字段
   * @returns {Promise<Object>}
   */
  async insert(table, data, returning = '*') {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING ${returning}`;
    const result = await this.query(sql, values);
    return result.rows[0];
  }

  /**
   * 更新记录 (PostgreSQL 版本)
   * @param {string} table - 表名
   * @param {Object} data - 更新数据
   * @param {Object} where - 条件
   * @returns {Promise<number>} 影响行数
   */
  async update(table, data, where) {
    const dataKeys = Object.keys(data);
    const whereKeys = Object.keys(where);
    
    let paramIndex = 1;
    const setClauses = dataKeys.map(key => `${key} = $${paramIndex++}`).join(', ');
    const whereClauses = whereKeys.map(key => `${key} = $${paramIndex++}`).join(' AND ');
    
    const values = [...Object.values(data), ...Object.values(where)];
    const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`;
    
    const result = await this.query(sql, values);
    return result.rowCount;
  }

  /**
   * 获取数据库客户端（用于事务）
   * @returns {Promise<Object>}
   */
  async getClient() {
    if (!this.isDatabaseAvailable()) {
      throw new Error('数据库未配置');
    }
    return this.db.getClient();
  }

  /**
   * 执行事务 (PostgreSQL 版本)
   * @param {Function} callback - 事务回调函数，接收client参数
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = BaseService;
