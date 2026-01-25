const mysql = require('mysql2/promise');

// 开发模式下如果没有配置数据库，直接跳过
const isDev = process.env.NODE_ENV === 'development';
const hasDbConfig = process.env.DB_PASSWORD || process.env.DATABASE_URL;

if (isDev && !hasDbConfig) {
  console.log('🔧 开发模式：未配置数据库，将使用模拟数据');
  module.exports = null;
  return;
}

// 数据库连接配置
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 5000  // 5秒连接超时
});

// 测试数据库连接
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 数据库连接成功');
    connection.release();
  } catch (err) {
    console.error('❌ 数据库连接错误:', err.message);
    if (isDev) {
      console.log('🔧 开发模式：数据库连接失败，将使用模拟数据');
    }
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
    const [rows, fields] = await pool.execute(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('执行查询:', { text, duration, rows: Array.isArray(rows) ? rows.length : rows.affectedRows });
    }
    // 返回兼容 pg 格式的结果
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows,
      affectedRows: rows.affectedRows,
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
  
  // 包装成兼容 pg 的接口
  return {
    query: async (sql, params) => {
      const [rows] = await connection.execute(sql, params);
      return {
        rows: Array.isArray(rows) ? rows : [],
        rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows
      };
    },
    release: () => connection.release()
  };
};

module.exports = {
  query,
  getClient,
  pool
};
