// src/services/familyService.js
// 家庭服务层 - 处理家庭相关业务逻辑 (PostgreSQL 版本)

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const logger = require('../utils/logger');
const { generateRandomString } = require('../utils');
const { ERROR_CODES } = require('../constants/errorCodes');
const { FAMILY_ROLES, isAdmin, isCreator } = require('../constants/roles');

// 开发模式下的模拟数据存储（与 familyController 共享）
const mockFamilies = global.mockFamilies || (global.mockFamilies = new Map());
const mockFamilyMembers = global.mockFamilyMembers || (global.mockFamilyMembers = new Map());

class FamilyService extends BaseService {
  /**
   * 创建家庭
   * @param {string} userId - 创建人ID
   * @param {string} name - 家庭名称
   * @returns {Promise<Object>}
   */
  async createFamily(userId, name) {
    const familyId = uuidv4();
    const inviteCode = generateRandomString(6);

    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：创建模拟家庭');
      const family = {
        id: familyId,
        name,
        invite_code: inviteCode,
        creator_id: userId,
        points_value: 0.1,
        created_at: new Date()
      };
      mockFamilies.set(familyId, family);
      
      // 添加创建人为成员
      const memberId = uuidv4();
      mockFamilyMembers.set(memberId, {
        id: memberId,
        family_id: familyId,
        user_id: userId,
        role: FAMILY_ROLES.CREATOR,
        joined_at: new Date()
      });

      logger.audit('创建家庭(模拟)', userId, { familyId, name });
      return { id: familyId, name, inviteCode };
    }

    // 使用事务创建家庭和添加创建人为成员
    const family = await this.transaction(async (client) => {
      // 创建家庭
      await client.query(
        `INSERT INTO families (id, name, invite_code, creator_id, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [familyId, name, inviteCode, userId]
      );

      // 添加创建人为成员
      await client.query(
        `INSERT INTO family_members (id, family_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [uuidv4(), familyId, userId, FAMILY_ROLES.CREATOR]
      );

      // 初始化预设家务类型
      await this.initPresetChoreTypes(client, familyId);

      return {
        id: familyId,
        name,
        inviteCode
      };
    });

    logger.audit('创建家庭', userId, { familyId, name });
    return family;
  }

  /**
   * 初始化预设家务类型
   * @param {Object} client - 数据库客户端
   * @param {string} familyId - 家庭ID
   */
  async initPresetChoreTypes(client, familyId) {
    const presets = [
      { name: '洗碗', points: 5, icon: '🍽️' },
      { name: '扫地', points: 5, icon: '🧹' },
      { name: '拖地', points: 8, icon: '🧹' },
      { name: '做饭', points: 15, icon: '🍳' },
      { name: '洗衣服', points: 10, icon: '👕' },
      { name: '整理房间', points: 10, icon: '🛏️' },
      { name: '倒垃圾', points: 3, icon: '🗑️' },
      { name: '擦桌子', points: 3, icon: '🧽' }
    ];

    for (const preset of presets) {
      await client.query(
        `INSERT INTO chore_types (id, family_id, name, points, icon, is_preset, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, true, CURRENT_TIMESTAMP)`,
        [uuidv4(), familyId, preset.name, preset.points, preset.icon]
      );
    }
  }

  /**
   * 获取家庭信息
   * @param {string} familyId - 家庭ID
   * @returns {Promise<Object>}
   */
  async getFamilyInfo(familyId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      const family = mockFamilies.get(familyId);
      if (!family) {
        throw new Error(ERROR_CODES.FAMILY_NOT_FOUND.message);
      }
      const members = await this.getFamilyMembers(familyId);
      return {
        id: family.id,
        name: family.name,
        inviteCode: family.invite_code,
        creatorId: family.creator_id,
        pointsValue: family.points_value || 0.1,
        members,
        createdAt: family.created_at
      };
    }

    const family = await this.queryOne(
      `SELECT id, name, invite_code, creator_id, points_value, created_at 
       FROM families WHERE id = $1`,
      [familyId]
    );

    if (!family) {
      throw new Error(ERROR_CODES.FAMILY_NOT_FOUND.message);
    }

    // 获取成员列表
    const members = await this.getFamilyMembers(familyId);

    return {
      id: family.id,
      name: family.name,
      inviteCode: family.invite_code,
      creatorId: family.creator_id,
      pointsValue: parseFloat(family.points_value),
      members,
      createdAt: family.created_at
    };
  }

  /**
   * 获取用户的家庭列表
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>}
   */
  async getUserFamilies(userId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      const result = [];
      for (const [memberId, member] of mockFamilyMembers) {
        if (member.user_id === userId) {
          const family = mockFamilies.get(member.family_id);
          if (family) {
            const members = await this.getFamilyMembers(family.id);
            result.push({
              id: family.id,
              name: family.name,
              inviteCode: family.invite_code,
              creatorId: family.creator_id,
              pointsValue: family.points_value || 0.1,
              role: member.role,
              members,
              createdAt: family.created_at
            });
          }
        }
      }
      return result;
    }

    const families = await this.queryMany(
      `SELECT f.id, f.name, f.invite_code, f.creator_id, f.points_value, 
              fm.role, f.created_at
       FROM families f
       JOIN family_members fm ON f.id = fm.family_id
       WHERE fm.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    // 获取每个家庭的成员
    const result = [];
    for (const family of families) {
      const members = await this.getFamilyMembers(family.id);
      result.push({
        id: family.id,
        name: family.name,
        inviteCode: family.invite_code,
        creatorId: family.creator_id,
        pointsValue: parseFloat(family.points_value),
        role: family.role,
        members,
        createdAt: family.created_at
      });
    }

    return result;
  }

  /**
   * 获取家庭成员列表
   * @param {string} familyId - 家庭ID
   * @returns {Promise<Array>}
   */
  async getFamilyMembers(familyId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      const members = [];
      const mockUsers = global.mockUsers || new Map();
      for (const [memberId, member] of mockFamilyMembers) {
        if (member.family_id === familyId) {
          // 获取用户信息 - 遍历 mockUsers 查找
          let user = null;
          for (const [openid, u] of mockUsers) {
            if (u.id === member.user_id) {
              user = u;
              break;
            }
          }
          user = user || { nickname: '模拟用户', avatar_url: '' };
          members.push({
            id: member.user_id,
            nickname: user.nickname,
            avatarUrl: user.avatar_url,
            role: member.role,
            joinedAt: member.joined_at
          });
        }
      }
      return members;
    }

    const members = await this.queryMany(
      `SELECT u.id, u.nickname, u.avatar_url, fm.role, fm.joined_at
       FROM family_members fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_id = $1
       ORDER BY 
         CASE fm.role 
           WHEN 'creator' THEN 1 
           WHEN 'admin' THEN 2 
           ELSE 3 
         END,
         fm.joined_at`,
      [familyId]
    );

    return members.map(m => ({
      id: m.id,
      userId: m.id,
      nickname: m.nickname,
      avatarUrl: m.avatar_url,
      role: m.role,
      joinedAt: m.joined_at
    }));
  }

  /**
   * 通过邀请码加入家庭
   * @param {string} userId - 用户ID
   * @param {string} inviteCode - 邀请码
   * @returns {Promise<Object>}
   */
  async joinByInviteCode(userId, inviteCode) {
    if (!this.isDatabaseAvailable()) {
      throw new Error(ERROR_CODES.DATABASE_NOT_CONFIGURED.message);
    }

    // 查找家庭
    const family = await this.queryOne(
      'SELECT id, name FROM families WHERE invite_code = $1',
      [inviteCode.toUpperCase()]
    );

    if (!family) {
      throw new Error(ERROR_CODES.FAMILY_INVITE_CODE_INVALID.message);
    }

    // 检查是否已是成员
    const existingMember = await this.queryOne(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [family.id, userId]
    );

    if (existingMember) {
      throw new Error(ERROR_CODES.FAMILY_ALREADY_MEMBER.message);
    }

    // 添加为成员
    await this.insert('family_members', {
      id: uuidv4(),
      family_id: family.id,
      user_id: userId,
      role: FAMILY_ROLES.MEMBER,
      joined_at: new Date()
    });

    logger.audit('加入家庭', userId, { familyId: family.id, familyName: family.name });

    return this.getFamilyInfo(family.id);
  }

  /**
   * 检查用户在家庭中的角色
   * @param {string} userId - 用户ID
   * @param {string} familyId - 家庭ID
   * @returns {Promise<Object>}
   */
  async checkMemberRole(userId, familyId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      for (const [memberId, member] of mockFamilyMembers) {
        if (member.family_id === familyId && member.user_id === userId) {
          return {
            isMember: true,
            role: member.role,
            isAdmin: isAdmin(member.role),
            isCreator: isCreator(member.role)
          };
        }
      }
      return { isMember: false, role: null, isAdmin: false, isCreator: false };
    }

    const member = await this.queryOne(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (!member) {
      return { isMember: false, role: null, isAdmin: false, isCreator: false };
    }

    return {
      isMember: true,
      role: member.role,
      isAdmin: isAdmin(member.role),
      isCreator: isCreator(member.role)
    };
  }

  /**
   * 验证用户是否为家庭成员
   * @param {string} userId - 用户ID
   * @param {string} familyId - 家庭ID
   * @throws {Error} 如果不是成员
   */
  async validateMembership(userId, familyId) {
    const { isMember } = await this.checkMemberRole(userId, familyId);
    if (!isMember) {
      throw new Error(ERROR_CODES.FAMILY_NOT_MEMBER.message);
    }
  }

  /**
   * 验证用户是否为管理员
   * @param {string} userId - 用户ID
   * @param {string} familyId - 家庭ID
   * @throws {Error} 如果不是管理员
   */
  async validateAdminRole(userId, familyId) {
    const { isMember, isAdmin: admin } = await this.checkMemberRole(userId, familyId);
    if (!isMember) {
      throw new Error(ERROR_CODES.FAMILY_NOT_MEMBER.message);
    }
    if (!admin) {
      throw new Error(ERROR_CODES.FAMILY_ADMIN_REQUIRED.message);
    }
  }

  /**
   * 更新成员角色
   * @param {string} operatorId - 操作人ID
   * @param {string} familyId - 家庭ID
   * @param {string} memberId - 被修改成员ID
   * @param {string} newRole - 新角色
   * @returns {Promise<Object>}
   */
  async updateMemberRole(operatorId, familyId, memberId, newRole) {
    // 验证操作人是创建人
    const { isCreator: operatorIsCreator } = await this.checkMemberRole(operatorId, familyId);
    if (!operatorIsCreator) {
      throw new Error(ERROR_CODES.FAMILY_CREATOR_REQUIRED.message);
    }

    // 检查目标成员
    const { isMember, isCreator: targetIsCreator } = await this.checkMemberRole(memberId, familyId);
    if (!isMember) {
      throw new Error(ERROR_CODES.FAMILY_NOT_MEMBER.message);
    }
    if (targetIsCreator) {
      throw new Error(ERROR_CODES.FAMILY_CANNOT_REMOVE_CREATOR.message);
    }

    // 更新角色
    await this.update('family_members', {
      role: newRole
    }, {
      family_id: familyId,
      user_id: memberId
    });

    logger.audit('更新成员角色', operatorId, { familyId, memberId, newRole });

    return { memberId, role: newRole };
  }

  /**
   * 获取用户所属的家庭信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 家庭信息
   */
  async getUserFamily(userId) {
    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      for (const [memberId, member] of mockFamilyMembers) {
        if (member.user_id === userId) {
          const family = mockFamilies.get(member.family_id);
          if (family) {
            return {
              familyId: family.id,
              role: member.role,
              familyName: family.name
            };
          }
        }
      }
      return null;
    }

    try {
      const result = await this.queryOne(
        `SELECT fm.family_id as familyId, fm.role, f.name as familyName
         FROM family_members fm
         JOIN families f ON fm.family_id = f.id
         WHERE fm.user_id = $1
         LIMIT 1`,
        [userId]
      );
      return result;
    } catch (error) {
      logger.debug('获取用户家庭信息失败:', error.message);
      return null;
    }
  }
}

module.exports = new FamilyService();
