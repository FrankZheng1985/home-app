// src/middleware/auth.js
const jwt = require('jsonwebtoken');

// 动态导入数据库模块
let query;
try {
  query = require('../config/database').query;
} catch (e) {
  console.warn('数据库模块未加载');
  query = null;
}

// 开发模式下的模拟用户数据存储（与 authController 共享）
const mockUsers = global.mockUsers || (global.mockUsers = new Map());

/**
 * JWT认证中间件
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user = null;
    
    // 尝试从数据库查询用户信息
    if (query) {
      try {
        const result = await query(
          'SELECT id, openid, nickname, avatar_url, preferences, created_at FROM users WHERE id = $1',
          [decoded.userId]
        );
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      } catch (dbError) {
        console.warn('数据库查询失败，尝试使用模拟数据:', dbError.message);
      }
    }
    
    // 数据库不可用时，使用模拟数据
    if (!user) {
      // 在模拟用户中查找
      for (const [openId, mockUser] of mockUsers) {
        if (mockUser.id === decoded.userId) {
          user = mockUser;
          break;
        }
      }
      
      // 如果找不到，创建一个基于 JWT 的临时用户（开发模式）
      if (!user && process.env.NODE_ENV === 'development') {
        user = {
          id: decoded.userId,
          nickname: '开发用户',
          avatar_url: '',
          preferences: {}
        };
        console.log('🔧 开发模式：使用临时用户数据');
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '认证令牌已过期' });
    }
    console.error('认证错误:', error);
    return res.status(500).json({ error: '认证失败' });
  }
};

/**
 * 检查是否为家庭管理员
 */
const isAdmin = async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user.id;
    
    const result = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }
    
    if (result.rows[0].role !== 'admin' && result.rows[0].role !== 'creator') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    
    req.memberRole = result.rows[0].role;
    next();
  } catch (error) {
    console.error('权限检查错误:', error);
    return res.status(500).json({ error: '权限检查失败' });
  }
};

/**
 * 检查是否为家庭成员
 */
const isFamilyMember = async (req, res, next) => {
  try {
    const familyId = req.params.familyId || req.body.familyId || req.query.familyId;
    const userId = req.user.id;
    
    if (!familyId) {
      return res.status(400).json({ error: '缺少家庭ID' });
    }
    
    const result = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }
    
    req.memberRole = result.rows[0].role;
    req.familyId = familyId;
    next();
  } catch (error) {
    console.error('成员检查错误:', error);
    return res.status(500).json({ error: '成员检查失败' });
  }
};

module.exports = {
  authenticate,
  isAdmin,
  isFamilyMember
};

