// config.example.js
// 复制此文件为 .env 并填写实际配置

module.exports = {
  // 服务器配置
  PORT: 3000,
  NODE_ENV: 'development',

  // 数据库配置 (PostgreSQL)
  DATABASE_URL: 'postgresql://username:password@localhost:5432/family_assistant',
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_NAME: 'family_assistant',
  DB_USER: 'your_username',
  DB_PASSWORD: 'your_password',

  // JWT配置
  JWT_SECRET: 'your_jwt_secret_key_here_should_be_long_and_random',
  JWT_EXPIRES_IN: '7d',

  // 微信小程序配置
  WX_APPID: 'your_wx_appid',
  WX_SECRET: 'your_wx_secret',

  // 文件上传配置
  UPLOAD_DIR: './uploads',
  MAX_FILE_SIZE: 5242880 // 5MB
};

