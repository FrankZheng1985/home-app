// src/services/userService.js
// 用户服务层 - 处理用户相关业务逻辑 (PostgreSQL 版本)

const BaseService = require('./baseService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');

// 开发模式下的模拟数据
const mockUsers = global.mockUsers || (global.mockUsers = new Map());

class UserService extends BaseService {
  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：获取模拟用户信息');
      // 遍历 mockUsers 查找用户
      for (const [openid, user] of mockUsers) {
        if (user.id === userId) {
          return this.formatUserProfile({
            id: user.id,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            gender: user.gender || 0,
            birthday: user.birthday || null,
            preferences: user.preferences || {},
            created_at: user.createdAt
          });
        }
      }
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    const user = await this.queryOne(
      `SELECT id, nickname, avatar_url, gender, birthday, preferences, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    return this.formatUserProfile(user);
  }

  /**
   * 更新用户信息
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>}
   */
  async updateUserProfile(userId, updateData) {
    const { nickname, avatarUrl, gender, birthday } = updateData;
    const updates = {};

    if (nickname !== undefined) {
      if (!nickname.trim()) {
        throw new Error(ERROR_CODES.USER_NICKNAME_REQUIRED.message);
      }
      if (nickname.length > 12) {
        throw new Error(ERROR_CODES.USER_NICKNAME_TOO_LONG.message);
      }
      updates.nickname = nickname;
    }

    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (gender !== undefined) updates.gender = gender;
    if (birthday !== undefined) updates.birthday = birthday;

    if (Object.keys(updates).length === 0) {
      return this.getUserProfile(userId);
    }

    // 开发模式：更新模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：更新模拟用户信息');
      for (const [openid, user] of mockUsers) {
        if (user.id === userId) {
          if (updates.nickname) user.nickname = updates.nickname;
          if (updates.avatar_url !== undefined) user.avatar_url = updates.avatar_url;
          if (updates.gender !== undefined) user.gender = updates.gender;
          if (updates.birthday !== undefined) user.birthday = updates.birthday;
          user.updatedAt = new Date();
          mockUsers.set(openid, user);
          logger.audit('更新用户信息(模拟)', userId, { fields: Object.keys(updates) });
          return this.getUserProfile(userId);
        }
      }
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    await this.update('users', updates, { id: userId });
    logger.audit('更新用户信息', userId, { fields: Object.keys(updates) });

    return this.getUserProfile(userId);
  }

  /**
   * 获取用户偏好设置
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async getPreferences(userId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：获取模拟用户偏好');
      for (const [openid, user] of mockUsers) {
        if (user.id === userId) {
          return user.preferences || {};
        }
      }
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    const user = await this.queryOne(
      'SELECT preferences FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    return user.preferences || {};
  }

  /**
   * 更新用户偏好设置
   * @param {string} userId - 用户ID
   * @param {Object} preferences - 偏好设置
   * @returns {Promise<Object>}
   */
  async updatePreferences(userId, preferences) {
    // 获取现有偏好设置并合并
    const existingPrefs = await this.getPreferences(userId);
    const mergedPrefs = { ...existingPrefs, ...preferences };

    // 开发模式：更新模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：更新模拟用户偏好');
      for (const [openid, user] of mockUsers) {
        if (user.id === userId) {
          user.preferences = mergedPrefs;
          mockUsers.set(openid, user);
          logger.audit('更新用户偏好设置(模拟)', userId, { preferences });
          return mergedPrefs;
        }
      }
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    await this.update('users', {
      preferences: mergedPrefs
    }, { id: userId });

    logger.audit('更新用户偏好设置', userId, { preferences });
    return mergedPrefs;
  }

  /**
   * 格式化用户信息
   * @param {Object} user - 用户数据
   * @returns {Object}
   */
  formatUserProfile(user) {
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatar_url,
      gender: user.gender,
      birthday: user.birthday,
      preferences: user.preferences || {},
      createdAt: user.created_at
    };
  }
}

module.exports = new UserService();
