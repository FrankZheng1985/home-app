// src/routes/users.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取当前用户信息
router.get('/profile', authenticate, asyncHandler(userController.getProfile));

// 更新用户信息
router.put('/profile', authenticate, [
  body('nickname').optional().isLength({ max: 12 }).withMessage('昵称不能超过12个字符')
], asyncHandler(userController.updateProfile));

// 获取用户喜好
router.get('/preferences', authenticate, asyncHandler(userController.getPreferences));

// 更新用户喜好
router.put('/preferences', authenticate, asyncHandler(userController.updatePreferences));

module.exports = router;

