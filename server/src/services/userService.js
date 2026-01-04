// src/services/userService.js
// 用户服务层 - 处理用户相关业务逻辑

const BaseService = require('./baseService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');

class UserService extends BaseService {
  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    if (!this.isDatabaseAvailable()) {
      throw new Error(ERROR_CODES.DATABASE_NOT_CONFIGURED.message);
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
    if (!this.isDatabaseAvailable()) {
      throw new Error(ERROR_CODES.DATABASE_NOT_CONFIGURED.message);
    }

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

    updates.updated_at = new Date();

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
    if (!this.isDatabaseAvailable()) {
      throw new Error(ERROR_CODES.DATABASE_NOT_CONFIGURED.message);
    }

    const user = await this.queryOne(
      'SELECT preferences FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new Error(ERROR_CODES.USER_NOT_FOUND.message);
    }

    return typeof user.preferences === 'string' 
      ? JSON.parse(user.preferences) 
      : (user.preferences || {});
  }

  /**
   * 更新用户偏好设置
   * @param {string} userId - 用户ID
   * @param {Object} preferences - 偏好设置
   * @returns {Promise<Object>}
   */
  async updatePreferences(userId, preferences) {
    if (!this.isDatabaseAvailable()) {
      throw new Error(ERROR_CODES.DATABASE_NOT_CONFIGURED.message);
    }

    // 获取现有偏好设置并合并
    const existingPrefs = await this.getPreferences(userId);
    const mergedPrefs = { ...existingPrefs, ...preferences };

    await this.update('users', {
      preferences: JSON.stringify(mergedPrefs),
      updated_at: new Date()
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
      preferences: typeof user.preferences === 'string' 
        ? JSON.parse(user.preferences) 
        : (user.preferences || {}),
      createdAt: user.created_at
    };
  }
}

module.exports = new UserService();

