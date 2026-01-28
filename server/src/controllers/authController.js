// src/controllers/authController.js
// 认证控制器 - 处理认证相关请求

const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const logger = require('../utils/logger');
const { ERROR_CODES, createError, createSuccess } = require('../constants/errorCodes');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 微信登录
 */
const wxLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { code } = req.body;

  try {
    // 获取微信openid和session_key
    const { openid, sessionKey } = await authService.getWxOpenId(code);

    // 查找用户
    const user = await authService.findUserByOpenId(openid);

    if (user) {
      // 已注册用户，更新session_key并生成token
      await authService.updateSessionKey(user.id, sessionKey);
      const token = authService.generateToken(user.id);
      logger.info('用户登录成功', { userId: user.id, nickname: user.nickname });

      return res.json(createSuccess({
        token,
        user: authService.formatUserResponse(user)
      }));
    } else {
      // 新用户，返回openId让前端跳转注册页（同时传递sessionKey供注册时使用）
      return res.json(createSuccess({
        needRegister: true,
        openId: openid,
        sessionKey: sessionKey
      }));
    }
  } catch (error) {
    logger.error('微信登录错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.AUTH_WX_LOGIN_FAILED, error.message)
    );
  }
};

/**
 * 注册
 */
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: errors.array() });
  }

  const { openId, nickname, avatarUrl, gender, birthday, preferences, sessionKey } = req.body;

  try {
    // 创建用户
    const user = await authService.createUser({
      openId,
      nickname,
      avatarUrl,
      gender,
      birthday,
      preferences
    });

    // 保存 session_key（用于后续微信运动数据解密）
    if (sessionKey) {
      await authService.updateSessionKey(user.id, sessionKey);
    }

    // 生成token
    const token = authService.generateToken(user.id);
    logger.info('用户注册成功', { userId: user.id, nickname });

    return res.json(createSuccess({
      token,
      user: authService.formatUserResponse(user)
    }));
  } catch (error) {
    logger.error('注册错误', error);
    
    if (error.message === ERROR_CODES.USER_ALREADY_EXISTS.message) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        createError(ERROR_CODES.USER_ALREADY_EXISTS)
      );
    }
    
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.USER_REGISTER_FAILED, error.message)
    );
  }
};

/**
 * 验证token
 */
const validate = async (req, res) => {
  // 如果能走到这里，说明token有效（已通过auth中间件）
  return res.json(createSuccess({
    valid: true,
    user: authService.formatUserResponse(req.user)
  }));
};

module.exports = {
  wxLogin,
  register,
  validate
};
