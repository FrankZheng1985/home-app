// src/routes/points.js
const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');
const { authenticate, isFamilyMember } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取积分概览
router.get('/summary', authenticate, asyncHandler(pointsController.getSummary));

// 获取积分记录
router.get('/transactions', authenticate, asyncHandler(pointsController.getTransactions));

// 获取积分排行榜
router.get('/ranking', authenticate, asyncHandler(pointsController.getRanking));

// 获取月度统计
router.get('/month-stats', authenticate, asyncHandler(pointsController.getMonthStats));

// 获取成员积分列表
router.get('/members', authenticate, asyncHandler(pointsController.getMembersPoints));

// 积分兑现/结算
router.post('/redeem', authenticate, asyncHandler(pointsController.redeemPoints));

module.exports = router;

