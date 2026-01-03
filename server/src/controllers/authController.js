// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

// 动态导入数据库模块（开发模式可能没有数据库）
let query;
try {
  query = require('../config/database').query;
} catch (e) {
  console.warn('数据库模块未加载，将使用模拟数据');
  query = null;
}

// 开发模式下的模拟用户数据
const mockUsers = new Map();

/**
 * 微信登录
 */
const wxLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { code } = req.body;

  try {
    let openid;

    // 开发模式：使用模拟的openid
    if (process.env.NODE_ENV === 'development' && (!process.env.WX_SECRET || process.env.WX_SECRET === 'your_wx_secret_here')) {
      console.log('🔧 开发模式：使用模拟登录');
      openid = 'dev_openid_' + (code || 'default');
    } else {
      // 生产模式：调用微信接口获取openid和session_key
      const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: process.env.WX_APPID,
          secret: process.env.WX_SECRET,
          js_code: code,
          grant_type: 'authorization_code'
        }
      });

      if (wxRes.data.errcode) {
        return res.status(400).json({ error: '微信登录失败', details: wxRes.data.errmsg });
      }

      openid = wxRes.data.openid;
    }

    // 尝试从数据库或模拟数据中查询用户
    let user = null;
    
    if (query) {
      // 有数据库连接，从数据库查询
      try {
        const userResult = await query(
          'SELECT id, openid, nickname, avatar_url, preferences, created_at FROM users WHERE openid = $1',
          [openid]
        );
        if (userResult.rows.length > 0) {
          user = userResult.rows[0];
        }
      } catch (dbError) {
        console.warn('数据库查询失败，使用模拟数据:', dbError.message);
      }
    }
    
    // 使用模拟数据
    if (!user && mockUsers.has(openid)) {
      user = mockUsers.get(openid);
    }

    if (user) {
      // 已注册用户，生成token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.json({
        data: {
          token,
          user: {
            id: user.id,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
            preferences: user.preferences
          }
        }
      });
    } else {
      // 新用户，返回openId让前端跳转注册页
      return res.json({
        data: {
          needRegister: true,
          openId: openid
        }
      });
    }
  } catch (error) {
    console.error('微信登录错误:', error);
    return res.status(500).json({ error: '登录失败，请重试' });
  }
};

/**
 * 注册
 */
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { openId, nickname, avatarUrl, gender, birthday, preferences } = req.body;

  try {
    const userId = uuidv4();
    let user = null;

    // 尝试使用数据库
    if (query) {
      try {
        // 检查openId是否已存在
        const existResult = await query(
          'SELECT id FROM users WHERE openid = $1',
          [openId]
        );

        if (existResult.rows.length > 0) {
          return res.status(400).json({ error: '用户已存在' });
        }

        // 创建新用户
        const insertResult = await query(
          `INSERT INTO users (id, openid, nickname, avatar_url, gender, birthday, preferences, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING id, openid, nickname, avatar_url, preferences`,
          [userId, openId, nickname, avatarUrl || '', gender || 0, birthday || null, JSON.stringify(preferences || {})]
        );

        user = insertResult.rows[0];
      } catch (dbError) {
        console.warn('数据库操作失败，使用模拟数据:', dbError.message);
      }
    }

    // 数据库不可用时，使用模拟数据
    if (!user) {
      // 检查模拟数据中是否已存在
      if (mockUsers.has(openId)) {
        return res.status(400).json({ error: '用户已存在' });
      }

      user = {
        id: userId,
        openid: openId,
        nickname: nickname,
        avatar_url: avatarUrl || '',
        preferences: preferences || {}
      };
      
      // 保存到模拟数据
      mockUsers.set(openId, user);
      console.log('🔧 开发模式：用户已保存到模拟数据', user.nickname);
    }

    // 生成token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          preferences: user.preferences
        }
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    return res.status(500).json({ error: '注册失败，请重试' });
  }
};

/**
 * 验证token
 */
const validate = async (req, res) => {
  // 如果能走到这里，说明token有效
  return res.json({
    data: {
      valid: true,
      user: {
        id: req.user.id,
        nickname: req.user.nickname,
        avatarUrl: req.user.avatar_url,
        preferences: req.user.preferences
      }
    }
  });
};

module.exports = {
  wxLogin,
  register,
  validate
};

