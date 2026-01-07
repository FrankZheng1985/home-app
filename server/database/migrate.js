// database/migrate.js
require('dotenv').config({ path: '../.env' });

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库连接配置
const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true // 允许执行多条SQL
};

async function runMigrations() {
  let connection;
  
  try {
    console.log('开始连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');
    
    console.log('开始执行数据库迁移...');
    
    // 读取迁移文件 - 优先使用 init_mysql.sql
    const initFile = path.join(__dirname, 'init_mysql.sql');
    if (fs.existsSync(initFile)) {
      console.log('发现 MySQL 初始化脚本，开始执行...');
      const sql = fs.readFileSync(initFile, 'utf8');
      await connection.query(sql);
      console.log('MySQL 初始化完成！');
    } else {
      console.warn('未找到 init_mysql.sql 文件，跳过初始化');
    }
    
    console.log('所有迁移执行完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigrations();
