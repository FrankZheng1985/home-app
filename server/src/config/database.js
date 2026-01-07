const { Pool } = require('pg');

// 数据库连接配置
const pool = new Pool({
  host: process.env.POSTGRES_ADDRESS ? process.env.POSTGRES_ADDRESS.split(':')[0] : (process.env.DB_HOST || 'localhost'),
  port: process.env.POSTGRES_ADDRESS ? process.env.POSTGRES_ADDRESS.split(':')[1] : (process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USERNAME || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试数据库连接
(async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL 数据库连接成功');
    client.release();
  } catch (err) {
    console.error('数据库连接错误:', err.message);
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
  const query = client.query;
  const release = client.release;
  
  // 覆盖 query 方法以添加日志
  const timeout = 5000;
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };
  
  client.timeout = timeout;
  client.release = () => {
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  
  return client;
};

module.exports = {
  query,
  getClient,
  pool
};
