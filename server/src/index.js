// src/index.js
// 应用入口 - ERP标准架构
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入日志工具
const logger = require('./utils/logger');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const familyRoutes = require('./routes/families');
const choreRoutes = require('./routes/chores');
const pointsRoutes = require('./routes/points');
const postRoutes = require('./routes/posts');
const uploadRoutes = require('./routes/upload');
const savingsRoutes = require('./routes/savings');
const sportsRoutes = require('./routes/sports');

// 导入中间件
const { errorHandler, requestLogger, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ 基础中间件配置 ============
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件（开发环境启用）
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============ API路由 ============
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/chores', choreRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/sports', sportsRoutes);

// ============ 健康检查 ============
// Render 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 健康检查（详细版）
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    env: process.env.NODE_ENV || 'development',
    architecture: 'ERP-Style'
  });
});

// ============ 错误处理 ============
// 404处理
app.use(notFoundHandler);

// 全局错误处理中间件
app.use(errorHandler);

// ============ 启动服务器 ============
app.listen(PORT, '0.0.0.0', () => {
  logger.info('🚀 服务器启动成功', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    architecture: 'ERP-Style'
  });
  
  console.log('');
  console.log('='.repeat(50));
  console.log(`  🏠 家庭小助手 API 服务器`);
  console.log('='.repeat(50));
  console.log(`  📍 本地访问: http://localhost:${PORT}`);
  console.log(`  📍 局域网访问: http://192.168.31.226:${PORT}`);
  console.log(`  🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📦 架构: ERP-Style (Service层分离)`);
  console.log('='.repeat(50));
  console.log('');
});

module.exports = app;
