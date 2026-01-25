require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'family_assistant',
  multipleStatements: true  // 允许执行多条 SQL 语句
};

async function runMigrations() {
  let connection;
  try {
    console.log('连接数据库...');
    console.log(`Host: ${dbConfig.host}, Port: ${dbConfig.port}, Database: ${dbConfig.database}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('连接成功');

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).sort(); // 按文件名排序执行
      for (const file of files) {
        if (file.endsWith('.sql')) {
          console.log(`正在执行迁移: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await connection.query(sql);
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
    if (connection) await connection.end();
  }
}

runMigrations();
