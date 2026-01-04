// src/middleware/auth.js
// 认证中间件 - 处理JWT认证和权限检查

const authService = require('../services/authService');
const familyService = require('../services/familyService');
const logger = require('../utils/logger');
const { ERROR_CODES, createError } = require('../constants/errorCodes');
const { HTTP_STATUS } = require('../constants/statusCodes');

// 开发模式下的模拟用户数据存储（与 authService 共享）
const mockUsers = global.mockUsers || (global.mockUsers = new Map());

/**
 * JWT认证中间件
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createError(ERROR_CODES.AUTH_TOKEN_MISSING)
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // 验证token
    let decoded;
    try {
      decoded = authService.verifyToken(token);
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          createError(ERROR_CODES.AUTH_TOKEN_INVALID)
        );
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json(
          createError(ERROR_CODES.AUTH_TOKEN_EXPIRED)
        );
      }
      throw error;
    }
    
    // 查找用户
    let user = await authService.findUserById(decoded.userId);
    
    // 数据库不可用时，尝试模拟数据
    if (!user) {
      for (const [, mockUser] of mockUsers) {
        if (mockUser.id === decoded.userId) {
          user = mockUser;
          break;
        }
      }
      
      // 开发模式下创建临时用户
      if (!user && process.env.NODE_ENV === 'development') {
        user = {
          id: decoded.userId,
          nickname: '开发用户',
          avatar_url: '',
          preferences: {}
        };
        logger.debug('🔧 开发模式：使用临时用户数据');
      }
    }
    
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(
        createError(ERROR_CODES.AUTH_USER_NOT_FOUND)
      );
    }
    
    req.user = user;
    next();
  } catch (error) {
    logger.error('认证错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, '认证失败')
    );
  }
};

/**
 * 检查是否为家庭管理员
 */
const isAdmin = async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const userId = req.user.id;
    
    const { isMember, isAdmin: admin } = await familyService.checkMemberRole(userId, familyId);
    
    if (!isMember) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        createError(ERROR_CODES.FAMILY_NOT_MEMBER)
      );
    }
    
    if (!admin) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        createError(ERROR_CODES.FAMILY_ADMIN_REQUIRED)
      );
    }
    
    req.memberRole = admin ? 'admin' : 'member';
    next();
  } catch (error) {
    logger.error('权限检查错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, '权限检查失败')
    );
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        createError(ERROR_CODES.FAMILY_ID_REQUIRED)
      );
    }
    
    const { isMember, role } = await familyService.checkMemberRole(userId, familyId);
    
    if (!isMember) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(
        createError(ERROR_CODES.FAMILY_NOT_MEMBER)
      );
    }
    
    req.memberRole = role;
    req.familyId = familyId;
    next();
  } catch (error) {
    logger.error('成员检查错误', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json(
      createError(ERROR_CODES.SYSTEM_ERROR, '成员检查失败')
    );
  }
};

module.exports = {
  authenticate,
  isAdmin,
  isFamilyMember
};
