// src/controllers/userController.js
const { validationResult } = require('express-validator');

// 动态导入数据库模块
let query;
try {
  query = require('../config/database').query;
} catch (e) {
  console.warn('数据库模块未加载');
  query = null;
}

// 开发模式下的模拟用户数据（全局共享）
const mockUsers = global.mockUsers || (global.mockUsers = new Map());

/**
 * 获取当前用户信息
 */
const getProfile = async (req, res) => {
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      // 查询用户信息和家庭成员关系
      const result = await query(
        `SELECT u.id, u.openid, u.nickname, u.avatar_url, u.gender, u.birthday, u.preferences, u.created_at,
                fm.family_id, fm.role as family_role
         FROM users u
         LEFT JOIN family_members fm ON u.id = fm.user_id
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        return res.json({
          success: true,
          data: {
            id: user.id,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
            gender: user.gender,
            birthday: user.birthday,
            preferences: user.preferences,
            createdAt: user.created_at,
            familyId: user.family_id,
            familyRole: user.family_role
          }
        });
      }
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据或 req.user（来自认证中间件）
  try {
    // 先从模拟用户中查找
    let user = null;
    for (const [openId, mockUser] of mockUsers) {
      if (mockUser.id === userId) {
        user = mockUser;
        break;
      }
    }

    // 如果没找到，使用 req.user
    if (!user) {
      user = req.user;
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        nickname: user.nickname || '开发用户',
        avatarUrl: user.avatar_url || '',
        gender: user.gender || 0,
        birthday: user.birthday || null,
        preferences: user.preferences || {},
        createdAt: user.created_at || new Date(),
        familyId: user.familyId || user.family_id || null,
        familyRole: user.familyRole || user.family_role || null
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return res.status(500).json({ success: false, error: '获取用户信息失败' });
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

  const userId = req.user.id;
  const { nickname, avatarUrl, gender, birthday } = req.body;

  // 尝试使用数据库
  if (query) {
    try {
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

      values.push(userId);

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
    } catch (dbError) {
      console.warn('数据库更新失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    // 查找并更新模拟用户
    for (const [openId, mockUser] of mockUsers) {
      if (mockUser.id === userId) {
        if (nickname !== undefined) mockUser.nickname = nickname;
        if (avatarUrl !== undefined) mockUser.avatar_url = avatarUrl;
        if (gender !== undefined) mockUser.gender = gender;
        if (birthday !== undefined) mockUser.birthday = birthday;
        
        console.log('🔧 开发模式：用户信息已更新', mockUser.nickname);
        
        return res.json({
          data: {
            id: mockUser.id,
            nickname: mockUser.nickname,
            avatarUrl: mockUser.avatar_url,
            gender: mockUser.gender,
            birthday: mockUser.birthday,
            preferences: mockUser.preferences
          }
        });
      }
    }

    // 如果没有找到用户，返回 req.user 的更新版本
    return res.json({
      data: {
        id: userId,
        nickname: nickname || req.user.nickname,
        avatarUrl: avatarUrl || req.user.avatar_url,
        gender: gender !== undefined ? gender : req.user.gender,
        birthday: birthday !== undefined ? birthday : req.user.birthday,
        preferences: req.user.preferences || {}
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
  const userId = req.user.id;

  if (!preferences) {
    return res.status(400).json({ error: '喜好数据不能为空' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      const result = await query(
        `UPDATE users SET preferences = $1 WHERE id = $2
         RETURNING id, nickname, avatar_url, preferences`,
        [JSON.stringify(preferences), userId]
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
    } catch (dbError) {
      console.warn('数据库更新失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    for (const [openId, mockUser] of mockUsers) {
      if (mockUser.id === userId) {
        mockUser.preferences = preferences;
        
        console.log('🔧 开发模式：用户喜好已更新');
        
        return res.json({
          data: {
            id: mockUser.id,
            nickname: mockUser.nickname,
            avatarUrl: mockUser.avatar_url,
            preferences: mockUser.preferences
          }
        });
      }
    }

    // 返回更新后的数据
    return res.json({
      data: {
        id: userId,
        nickname: req.user.nickname,
        avatarUrl: req.user.avatar_url,
        preferences: preferences
      }
    });
  } catch (error) {
    console.error('更新用户喜好错误:', error);
    return res.status(500).json({ error: '更新用户喜好失败' });
  }
};

/**
 * 获取用户喜好
 */
const getPreferences = async (req, res) => {
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      const result = await query(
        'SELECT preferences FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return res.json({
          data: result.rows[0].preferences || {}
        });
      }
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    for (const [openId, mockUser] of mockUsers) {
      if (mockUser.id === userId) {
        return res.json({
          data: mockUser.preferences || {}
        });
      }
    }

    return res.json({
      data: req.user.preferences || {}
    });
  } catch (error) {
    console.error('获取用户喜好错误:', error);
    return res.status(500).json({ error: '获取用户喜好失败' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updatePreferences,
  getPreferences
};
