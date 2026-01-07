require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_ADDRESS ? process.env.POSTGRES_ADDRESS.split(':')[0] : (process.env.DB_HOST || 'localhost'),
  port: process.env.POSTGRES_ADDRESS ? process.env.POSTGRES_ADDRESS.split(':')[1] : (process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USERNAME || process.env.DB_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
});

async function runMigrations() {
  let client;
  try {
    console.log('连接数据库...');
    client = await pool.connect();
    console.log('连接成功');

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).sort(); // 按文件名排序执行
      for (const file of files) {
        if (file.endsWith('.sql')) {
          console.log(`正在执行迁移: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await client.query(sql);
          console.log(`${file} 执行成功`);
        }
      }
    } else {
      console.log('未找到迁移文件目录');
    }

    console.log('所有迁移完成');
  } catch (err) {
    console.error('迁移失败:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigrations();
