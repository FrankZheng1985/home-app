const { Pool } = require('pg');
const logger = require('../utils/logger');

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'family_assistant',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (process.env.DATABASE_URL) {
  dbConfig.connectionString = process.env.DATABASE_URL;
}

const pool = new Pool(dbConfig);

// 立即尝试连接并保持状态
let isConnected = false;
let isConnecting = false;

const checkConnection = async () => {
  if (isConnecting) return isConnected;
  isConnecting = true;
  try {
    const client = await pool.connect();
    isConnected = true;
    console.log('✅ PostgreSQL 数据库连接成功');
    client.release();
  } catch (err) {
    console.error('❌ 数据库连接错误:', err.message);
    isConnected = false;
  } finally {
    isConnecting = false;
  }
  return isConnected;
};

// 初始连接
checkConnection();

/**
 * 执行SQL查询
 */
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('查询错误:', error.message);
    if (error.message.includes('connection') || error.message.includes('terminated')) {
      isConnected = false;
      checkConnection(); // 尝试重连
    }
    throw error;
  }
};

const getClient = async () => {
  const client = await pool.connect();
  return client;
};

const getIsConnected = () => isConnected;

module.exports = {
  query,
  getClient,
  getIsConnected,
  pool,
  checkConnection
};
