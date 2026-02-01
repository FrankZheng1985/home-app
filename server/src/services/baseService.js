// src/services/baseService.js
// 基础服务类 - 提供通用数据库操作 (PostgreSQL 版本)

const logger = require('../utils/logger');
const db = require('../config/database');

class BaseService {
  constructor() {
    this.db = db;
  }

  /**
   * 检查数据库是否可用
   */
  isDatabaseAvailable() {
    // 只要有配置且连接成功，就认为可用
    return this.db && this.db.getIsConnected();
  }

  /**
   * 执行数据库查询
   */
  async query(sql, params = []) {
    // 如果数据库未连接，尝试等待或报错，而不是直接返回空
    if (!this.isDatabaseAvailable()) {
      const connected = await this.db.checkConnection();
      if (!connected) {
        throw new Error('数据库连接不可用，请检查 PostgreSQL 服务是否启动');
      }
    }

    const start = Date.now();
    try {
      const result = await this.db.query(sql, params);
      const duration = Date.now() - start;
      if (duration > 1000) logger.warn('慢查询:', { sql, duration });
      return result;
    } catch (error) {
      logger.error('数据库查询错误', { sql, params, error: error.message });
      throw error;
    }
  }

  async queryOne(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async queryMany(sql, params = []) {
    const result = await this.query(sql, params);
    return result.rows;
  }

  async insert(table, data, returning = '*') {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING ${returning}`;
    const result = await this.query(sql, values);
    return result.rows[0];
  }

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

  async getClient() {
    return this.db.getClient();
  }

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
