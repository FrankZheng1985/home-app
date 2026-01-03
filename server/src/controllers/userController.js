// src/controllers/userController.js
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * 获取当前用户信息
 */
const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, openid, nickname, avatar_url, gender, birthday, preferences, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = result.rows[0];
    return res.json({
      data: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        gender: user.gender,
        birthday: user.birthday,
        preferences: user.preferences,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return res.status(500).json({ error: '获取用户信息失败' });
  }
};

/**
 * 更新用户信息
 */
const updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { nickname, avatarUrl, gender, birthday } = req.body;
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (nickname !== undefined) {
    updates.push(`nickname = $${paramIndex++}`);
    values.push(nickname);
  }
  if (avatarUrl !== undefined) {
    updates.push(`avatar_url = $${paramIndex++}`);
    values.push(avatarUrl);
  }
  if (gender !== undefined) {
    updates.push(`gender = $${paramIndex++}`);
    values.push(gender);
  }
  if (birthday !== undefined) {
    updates.push(`birthday = $${paramIndex++}`);
    values.push(birthday);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的内容' });
  }

  values.push(req.user.id);

  try {
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, nickname, avatar_url, gender, birthday, preferences`,
      values
    );

    const user = result.rows[0];
    return res.json({
      data: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        gender: user.gender,
        birthday: user.birthday,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    return res.status(500).json({ error: '更新用户信息失败' });
  }
};

/**
 * 更新用户喜好
 */
const updatePreferences = async (req, res) => {
  const { preferences } = req.body;

  if (!preferences) {
    return res.status(400).json({ error: '喜好数据不能为空' });
  }

  try {
    const result = await query(
      `UPDATE users SET preferences = $1 WHERE id = $2
       RETURNING id, nickname, avatar_url, preferences`,
      [JSON.stringify(preferences), req.user.id]
    );

    const user = result.rows[0];
    return res.json({
      data: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('更新用户喜好错误:', error);
    return res.status(500).json({ error: '更新用户喜好失败' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePreferences
};

