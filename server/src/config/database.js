const { Pool } = require('pg');

// 开发模式下如果没有配置数据库，直接跳过
const isDev = process.env.NODE_ENV === 'development';
const hasDbConfig = process.env.DATABASE_URL || process.env.DB_HOST;

if (isDev && !hasDbConfig) {
  console.log('🔧 开发模式：未配置数据库，将使用模拟数据');
  module.exports = null;
  return;
}

// 数据库连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let isConnected = false;

// 测试数据库连接
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL 数据库连接成功');
    isConnected = true;
    client.release();
  } catch (err) {
    console.error('❌ 数据库连接错误:', err.message);
    isConnected = false;
    if (isDev) {
      console.log('🔧 开发模式：数据库连接失败，将使用模拟数据');
    }
  }
})();

/**
 * 检查数据库是否连接
 */
const getIsConnected = () => isConnected;

/**
 * 执行SQL查询
 * @param {string} text SQL语句
 * @param {Array} params 参数
 * @returns {Promise}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('执行查询:', { text, duration, rows: res.rowCount });
    }
    return res;
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
  
  return { query, release };
};

module.exports = {
  query,
  getClient,
  getIsConnected,
  pool
};
