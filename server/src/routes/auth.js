// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 微信登录
router.post('/wx-login', [
  body('code').notEmpty().withMessage('code不能为空')
], asyncHandler(authController.wxLogin));

// 注册/完善信息
router.post('/register', [
  body('openId').notEmpty().withMessage('openId不能为空'),
  body('nickname').notEmpty().withMessage('昵称不能为空')
    .isLength({ max: 12 }).withMessage('昵称不能超过12个字符')
], asyncHandler(authController.register));

// 验证token
router.get('/validate', authenticate, asyncHandler(authController.validate));

module.exports = router;

