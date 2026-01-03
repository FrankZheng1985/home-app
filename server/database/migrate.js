// database/migrate.js
require('dotenv').config({ path: '../.env' });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'family_assistant',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行数据库迁移...');
    
    // 读取迁移文件
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      console.log(`执行迁移: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`迁移完成: ${file}`);
    }
    
    console.log('所有迁移执行完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();

