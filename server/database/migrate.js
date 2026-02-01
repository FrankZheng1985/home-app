require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
};

async function runMigrations() {
  const client = new Client(dbConfig);
  try {
    console.log('连接数据库...');
    await client.connect();
    console.log('连接成功');

    // 1. 先执行基础初始化脚本 (PostgreSQL 版)
    const initFile = path.join(__dirname, 'init_pg.sql');
    if (fs.existsSync(initFile)) {
      console.log('正在执行基础初始化脚本: init_pg.sql');
      const sql = fs.readFileSync(initFile, 'utf8');
      await client.query(sql);
      console.log('基础初始化完成');
    }

    // 2. 执行其他迁移文件 (如果有)
    // 注意：由于我们已经把核心逻辑都写进了 init_pg.sql，
    // 这里的迁移文件如果是 MySQL 语法的需要跳过或转换。
    // 目前我们主要依赖 init_pg.sql。

    console.log('所有迁移完成');
  } catch (err) {
    console.error('迁移失败:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
