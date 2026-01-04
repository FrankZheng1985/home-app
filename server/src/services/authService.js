// src/services/authService.js
// 认证服务层 - 处理认证相关业务逻辑

const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');

// 开发模式下的模拟用户数据
const mockUsers = global.mockUsers || (global.mockUsers = new Map());

class AuthService extends BaseService {
  /**
   * 微信登录获取openid
   * @param {string} code - 微信登录code
   * @returns {Promise<string>} openid
   */
  async getWxOpenId(code) {
    // 开发模式：使用模拟的openid
    if (process.env.NODE_ENV === 'development' && 
        (!process.env.WX_SECRET || process.env.WX_SECRET === 'your_wx_secret_here')) {
      logger.info('🔧 开发模式：使用模拟登录');
      return 'dev_openid_' + (code || 'default');
    }

    // 生产模式：调用微信接口
    const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WX_APPID,
        secret: process.env.WX_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (wxRes.data.errcode) {
      logger.error('微信登录失败', { errcode: wxRes.data.errcode, errmsg: wxRes.data.errmsg });
      throw new Error(ERROR_CODES.AUTH_WX_LOGIN_FAILED.message);
    }

    return wxRes.data.openid;
  }

  /**
   * 根据openid查找用户
   * @param {string} openid - 微信openid
   * @returns {Promise<Object|null>}
   */
  async findUserByOpenId(openid) {
    // 尝试从数据库查询
    if (this.isDatabaseAvailable()) {
      try {
        const user = await this.queryOne(
          'SELECT id, openid, nickname, avatar_url, preferences, created_at FROM users WHERE openid = $1',
          [openid]
        );
        if (user) return user;
      } catch (error) {
        logger.warn('数据库查询失败，尝试使用模拟数据', { error: error.message });
      }
    }

    // 使用模拟数据
    if (mockUsers.has(openid)) {
      return mockUsers.get(openid);
    }

    return null;
  }

  /**
   * 根据ID查找用户
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>}
   */
  async findUserById(userId) {
    if (this.isDatabaseAvailable()) {
      try {
        return await this.queryOne(
          'SELECT id, openid, nickname, avatar_url, preferences, created_at FROM users WHERE id = $1',
          [userId]
        );
      } catch (error) {
        logger.warn('数据库查询失败', { error: error.message });
      }
    }

    // 在模拟数据中查找
    for (const [, user] of mockUsers) {
      if (user.id === userId) return user;
    }

    return null;
  }

  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>}
   */
  async createUser(userData) {
    const { openId, nickname, avatarUrl, gender, birthday, preferences } = userData;
    const userId = uuidv4();

    // 尝试使用数据库
    if (this.isDatabaseAvailable()) {
      try {
        // 检查是否已存在
        const existing = await this.queryOne(
          'SELECT id FROM users WHERE openid = $1',
          [openId]
        );

        if (existing) {
          throw new Error(ERROR_CODES.USER_ALREADY_EXISTS.message);
        }

        // 创建用户
        const user = await this.insert('users', {
          id: userId,
          openid: openId,
          nickname,
          avatar_url: avatarUrl || '',
          gender: gender || 0,
          birthday: birthday || null,
          preferences: JSON.stringify(preferences || {}),
          created_at: new Date()
        });

        logger.audit('用户注册', userId, { nickname });
        return user;
      } catch (error) {
        if (error.message === ERROR_CODES.USER_ALREADY_EXISTS.message) {
          throw error;
        }
        logger.warn('数据库操作失败，使用模拟数据', { error: error.message });
      }
    }

    // 使用模拟数据
    if (mockUsers.has(openId)) {
      throw new Error(ERROR_CODES.USER_ALREADY_EXISTS.message);
    }

    const user = {
      id: userId,
      openid: openId,
      nickname,
      avatar_url: avatarUrl || '',
      preferences: preferences || {}
    };

    mockUsers.set(openId, user);
    logger.info('🔧 开发模式：用户已保存到模拟数据', { nickname });
    return user;
  }

  /**
   * 生成JWT令牌
   * @param {string} userId - 用户ID
   * @returns {string}
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  /**
   * 验证JWT令牌
   * @param {string} token - JWT令牌
   * @returns {Object} 解码后的payload
   */
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  /**
   * 格式化用户数据（用于返回给前端）
   * @param {Object} user - 用户数据
   * @returns {Object}
   */
  formatUserResponse(user) {
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatar_url,
      preferences: typeof user.preferences === 'string' 
        ? JSON.parse(user.preferences) 
        : user.preferences
    };
  }
}

module.exports = new AuthService();

