// src/config/database.js
const { Pool } = require('pg');

// 数据库连接配置
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 如果没有DATABASE_URL，使用单独的配置
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'family_assistant',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // 生产环境需要 SSL
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // 连接池配置
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
pool.on('connect', () => {
  console.log('数据库连接成功');
});

pool.on('error', (err) => {
  console.error('数据库连接错误:', err);
});

/**
 * 执行SQL查询
 * @param {string} text SQL语句
 * @param {Array} params 参数
 * @returns {Promise}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('执行查询:', { text, duration, rows: result.rowCount });
    }
    return result;
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
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // 设置超时自动释放
  const timeout = setTimeout(() => {
    console.error('客户端超时，强制释放');
    client.release();
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    release();
  };

  return client;
};

module.exports = {
  query,
  getClient,
  pool
};

