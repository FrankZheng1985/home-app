// src/config/database.js
const mysql = require('mysql2/promise');

// 数据库连接配置
const isProduction = process.env.NODE_ENV === 'production';

// 创建连接池
const pool = mysql.createPool({
  host: process.env.MYSQL_ADDRESS ? process.env.MYSQL_ADDRESS.split(':')[0] : (process.env.DB_HOST || 'localhost'),
  port: process.env.MYSQL_ADDRESS ? process.env.MYSQL_ADDRESS.split(':')[1] : (process.env.DB_PORT || 3306),
  // 优先使用环境变量，如果环境变量是默认的root且存在DB_USER则用DB_USER，否则尝试使用 family_assistant
  user: process.env.MYSQL_USERNAME || process.env.DB_USER || 'family_assistant',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // 保持连接
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 测试数据库连接
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('数据库连接成功');
    connection.release();
  } catch (err) {
    console.error('数据库连接错误:', err);
  }
})();

/**
 * 执行SQL查询
 * @param {string} text SQL语句
 * @param {Array} params 参数
 * @returns {Promise}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    // 转换 PostgreSQL 风格的占位符 ($1, $2) 为 MySQL 风格 (?)
    let sql = text;
    let queryParams = params;

    // 简单替换 $n 为 ?
    if (sql.includes('$')) {
      sql = sql.replace(/\$\d+/g, '?');
    }
    
    // MySQL的 RETURNING 语法处理（MySQL不支持RETURNING，需要改写）
    // 这里仅做简单处理，复杂逻辑需要在业务层修改
    if (sql.includes('RETURNING')) {
       // 移除 RETURNING 子句，后续在业务逻辑中处理 ID 返回
       sql = sql.split('RETURNING')[0];
    }

    const [rows, fields] = await pool.execute(sql, queryParams);
    
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('执行查询:', { text: sql, duration, rows: Array.isArray(rows) ? rows.length : 1 });
    }
    
    // 模拟 PostgreSQL 的返回格式
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : (rows.affectedRows || 0),
      // 如果是插入操作，返回 insertId
      insertId: rows.insertId
    };
  } catch (error) {
    console.error('查询错误:', error);
    throw error;
  }
};

/**
 * 获取数据库客户端（用于事务）
 * @returns {Promise}
 */
const getClient = async () => {
  const connection = await pool.getConnection();
  
  // 包装 query 方法以匹配原有接口
  const originalQuery = connection.query.bind(connection);
  const originalExecute = connection.execute.bind(connection);
  
  connection.query = async (text, params) => {
    let sql = text;
    if (sql.includes('$')) {
      sql = sql.replace(/\$\d+/g, '?');
    }
    if (sql.includes('RETURNING')) {
       sql = sql.split('RETURNING')[0];
    }
    
    // 使用 execute 以支持预编译语句
    const [rows] = await originalExecute(sql, params);
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : (rows.affectedRows || 0),
      insertId: rows.insertId
    };
  };

  return connection;
};

module.exports = {
  query,
  getClient,
  pool
};
