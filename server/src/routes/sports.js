// routes/sports.js - 运动打卡路由
const express = require('express');
const router = express.Router();
const sportsController = require('../controllers/sportsController');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要认证
router.use(authenticate);

// 运动类型
router.get('/types', sportsController.getTypes);
router.post('/types', sportsController.createType);
router.delete('/types/:typeId', sportsController.deleteType);

// 运动记录
router.post('/records', sportsController.createRecord);
router.get('/records', sportsController.getRecords);

// 统计
router.get('/week-stats', sportsController.getWeekStats);

// 步数同步
router.post('/sync-steps', sportsController.syncSteps);
router.get('/today-steps', sportsController.getTodaySteps);

// 初始化默认类型
router.post('/init-types', sportsController.initDefaultTypes);

module.exports = router;

