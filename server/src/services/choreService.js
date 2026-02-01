// src/services/choreService.js
// 家务服务层 - 处理家务相关业务逻辑 (PostgreSQL 版本)

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const pointsService = require('./pointsService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');
const { REVIEW_STATUS, TRANSACTION_TYPE } = require('../constants/statusCodes');

// 开发模式下的模拟数据
const mockChoreTypes = global.mockChoreTypes || (global.mockChoreTypes = new Map());
const mockChoreRecords = global.mockChoreRecords || (global.mockChoreRecords = new Map());

// 预设家务类型
const PRESET_CHORE_TYPES = [
  { name: '洗碗', points: 5, icon: '🍽️' },
  { name: '扫地', points: 5, icon: '🧹' },
  { name: '拖地', points: 8, icon: '🧹' },
  { name: '做饭', points: 15, icon: '🍳' },
  { name: '洗衣服', points: 10, icon: '👕' },
  { name: '整理房间', points: 10, icon: '🛏️' },
  { name: '倒垃圾', points: 3, icon: '🗑️' },
  { name: '擦桌子', points: 3, icon: '🧽' }
];

class ChoreService extends BaseService {
  /**
   * 获取家务类型列表
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 用户ID（用于验证权限）
   * @returns {Promise<Array>}
   */
  async getChoreTypes(familyId, userId) {
    // 验证用户是家庭成员
    await familyService.validateMembership(userId, familyId);

    // 开发模式：返回模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟家务类型');
      // 如果该家庭还没有家务类型，初始化预设类型
      let types = mockChoreTypes.get(familyId);
      if (!types) {
        types = PRESET_CHORE_TYPES.map((t, index) => ({
          id: uuidv4(),
          familyId,
          name: t.name,
          points: t.points,
          icon: t.icon,
          description: '',
          isPreset: true,
          isActive: true,
          createdAt: new Date()
        }));
        mockChoreTypes.set(familyId, types);
      }
      return types;
    }

    const types = await this.queryMany(
      `SELECT id, name, points, icon, description, is_preset, is_active, created_at
       FROM chore_types
       WHERE family_id = $1 AND is_active = true
       ORDER BY is_preset DESC, created_at ASC`,
      [familyId]
    );

    return types.map(t => ({
      id: t.id,
      name: t.name,
      points: t.points,
      icon: t.icon || '🧹',
      description: t.description || '',
      isPreset: t.is_preset,
      isActive: t.is_active,
      createdAt: t.created_at
    }));
  }

  /**
   * 创建家务类型
   * @param {Object} data - 家务类型数据
   * @returns {Promise<Object>}
   */
  async createChoreType(data) {
    const { familyId, userId, name, points, icon, description } = data;

    // 验证用户是管理员
    await familyService.validateAdminRole(userId, familyId);

    // 检查名称是否重复
    const existing = await this.queryOne(
      'SELECT id FROM chore_types WHERE family_id = $1 AND name = $2 AND is_active = true',
      [familyId, name]
    );

    if (existing) {
      throw new Error(ERROR_CODES.CHORE_TYPE_NAME_EXISTS.message);
    }

    const typeId = uuidv4();
    await this.insert('chore_types', {
      id: typeId,
      family_id: familyId,
      name,
      points,
      icon: icon || '🧹',
      description: description || '',
      is_preset: false,
      is_active: true,
      created_at: new Date()
    });

    logger.audit('创建家务类型', userId, { familyId, name, points });

    return {
      id: typeId,
      name,
      points,
      icon: icon || '🧹',
      description: description || '',
      isPreset: false,
      isActive: true
    };
  }

  /**
   * 更新家务类型
   * @param {string} typeId - 类型ID
   * @param {string} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>}
   */
  async updateChoreType(typeId, userId, updateData) {
    // 开发模式：更新模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：更新模拟家务类型');
      
      // 查找家务类型
      for (const [familyId, types] of mockChoreTypes) {
        const typeIndex = types.findIndex(t => t.id === typeId);
        if (typeIndex !== -1) {
          const type = types[typeIndex];
          
          // 验证管理员权限
          await familyService.validateAdminRole(userId, familyId);
          
          // 更新数据
          const { name, points, icon, description, isActive } = updateData;
          if (name !== undefined) type.name = name;
          if (points !== undefined) type.points = points;
          if (icon !== undefined) type.icon = icon;
          if (description !== undefined) type.description = description;
          if (isActive !== undefined) type.isActive = isActive;
          
          types[typeIndex] = type;
          mockChoreTypes.set(familyId, types);
          
          logger.audit('更新家务类型(模拟)', userId, { typeId });
          return { message: '更新成功' };
        }
      }
      throw new Error(ERROR_CODES.CHORE_TYPE_NOT_FOUND.message);
    }

    // 获取类型信息
    const type = await this.queryOne(
      'SELECT family_id FROM chore_types WHERE id = $1',
      [typeId]
    );

    if (!type) {
      throw new Error(ERROR_CODES.CHORE_TYPE_NOT_FOUND.message);
    }

    // 验证管理员权限
    await familyService.validateAdminRole(userId, type.family_id);

    // 构建更新数据
    const updates = {};
    const { name, points, icon, description, isActive } = updateData;

    if (name !== undefined) updates.name = name;
    if (points !== undefined) updates.points = points;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.is_active = isActive;

    if (Object.keys(updates).length === 0) {
      return { message: '没有要更新的内容' };
    }

    await this.update('chore_types', updates, { id: typeId });
    logger.audit('更新家务类型', userId, { typeId, updates: Object.keys(updates) });

    return { message: '更新成功' };
  }

  /**
   * 删除家务类型（软删除）
   * @param {string} typeId - 类型ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async deleteChoreType(typeId, userId) {
    const type = await this.queryOne(
      'SELECT family_id FROM chore_types WHERE id = $1',
      [typeId]
    );

    if (!type) {
      throw new Error(ERROR_CODES.CHORE_TYPE_NOT_FOUND.message);
    }

    await familyService.validateAdminRole(userId, type.family_id);

    await this.update('chore_types', { is_active: false }, { id: typeId });
    logger.audit('删除家务类型', userId, { typeId });

    return { message: '删除成功' };
  }

  /**
   * 提交家务记录
   * @param {Object} data - 记录数据
   * @returns {Promise<Object>}
   */
  async createChoreRecord(data) {
    const { choreTypeId, familyId, userId, note, images } = data;

    // 验证用户角色
    const { role, isAdmin } = await familyService.checkMemberRole(userId, familyId);
    if (!role) {
      throw new Error(ERROR_CODES.FAMILY_NOT_MEMBER.message);
    }

    // 开发模式：使用模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：创建模拟家务记录');
      
      // 从模拟家务类型中获取信息
      const choreTypes = mockChoreTypes.get(familyId) || [];
      const choreType = choreTypes.find(t => t.id === choreTypeId);
      
      if (!choreType) {
        throw new Error(ERROR_CODES.CHORE_TYPE_NOT_FOUND.message);
      }

      const recordId = uuidv4();
      const status = isAdmin ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.PENDING;
      const finalPoints = isAdmin ? choreType.points : null;

      // 获取用户信息
      const mockUsers = global.mockUsers || new Map();
      let user = null;
      for (const [openid, u] of mockUsers) {
        if (u.id === userId) {
          user = u;
          break;
        }
      }

      const newRecord = {
        id: recordId,
        choreType: { name: choreType.name, icon: choreType.icon },
        user: { nickname: user?.nickname || '模拟用户', avatarUrl: user?.avatar_url || '' },
        userId: userId,
        points: choreType.points,
        finalPoints,
        deduction: 0,
        deductionReason: '',
        remark: note || '',
        images: images || [],
        status,
        completedAt: new Date()
      };

      // 存储记录
      let records = mockChoreRecords.get(familyId) || [];
      records.unshift(newRecord);
      mockChoreRecords.set(familyId, records);

      // 如果是管理员，直接创建模拟积分交易
      if (isAdmin) {
        await pointsService.createTransaction({
          userId,
          familyId,
          points: choreType.points,
          type: TRANSACTION_TYPE.EARN,
          description: `完成家务: ${choreType.name}`
        });
      }

      return {
        id: recordId,
        choreName: choreType.name,
        points: choreType.points,
        status,
        message: isAdmin ? '记录成功，积分已到账' : '记录已提交，等待家长审核'
      };
    }

    // 获取家务类型信息
    const choreType = await this.queryOne(
      'SELECT name, points FROM chore_types WHERE id = $1 AND family_id = $2 AND is_active = true',
      [choreTypeId, familyId]
    );

    if (!choreType) {
      throw new Error(ERROR_CODES.CHORE_TYPE_NOT_FOUND.message);
    }

    const recordId = uuidv4();
    const status = isAdmin ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.PENDING;
    const finalPoints = isAdmin ? choreType.points : null;

    // 创建记录
    await this.insert('chore_records', {
      id: recordId,
      user_id: userId,
      chore_type_id: choreTypeId,
      family_id: familyId,
      points_earned: choreType.points,
      note: note || '',
      images: images || [],
      status,
      completed_at: new Date()
    });

    // 如果是管理员，直接创建积分交易记录
    if (isAdmin) {
      await pointsService.createTransaction({
        userId,
        familyId,
        points: choreType.points,
        type: TRANSACTION_TYPE.EARN,
        description: `完成家务: ${choreType.name}`
      });
    }

    logger.audit('提交家务记录', userId, { 
      familyId, 
      choreType: choreType.name, 
      points: choreType.points,
      status 
    });

    return {
      id: recordId,
      choreName: choreType.name,
      points: choreType.points,
      status,
      message: isAdmin ? '记录成功，积分已到账' : '记录已提交，等待家长审核'
    };
  }

  /**
   * 获取家务记录列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Array>}
   */
  async getChoreRecords(params) {
    const { familyId, userId, requestUserId, date, limit = 20, offset = 0 } = params;

    // 验证权限
    await familyService.validateMembership(requestUserId, familyId);

    // 开发模式：返回模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟家务记录');
      let records = mockChoreRecords.get(familyId) || [];
      // 按时间倒序
      records = records.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
      return records.slice(offset, offset + limit);
    }

    let whereClause = 'cr.family_id = $1';
    const values = [familyId];
    let paramIndex = 2;

    if (userId) {
      whereClause += ` AND cr.user_id = $${paramIndex++}`;
      values.push(userId);
    }

    if (date) {
      whereClause += ` AND cr.completed_at::date = $${paramIndex++}`;
      values.push(date);
    }

    const limitIndex = paramIndex++;
    const offsetIndex = paramIndex++;
    values.push(parseInt(limit), parseInt(offset));

    const records = await this.queryMany(
      `SELECT cr.id, cr.points_earned, cr.note, cr.images, cr.status, 
              cr.deduction, cr.deduction_reason, cr.completed_at,
              ct.name as chore_name, ct.icon as chore_icon,
              u.nickname as user_name, u.avatar_url
       FROM chore_records cr
       JOIN chore_types ct ON cr.chore_type_id = ct.id
       JOIN users u ON cr.user_id = u.id
       WHERE ${whereClause}
       ORDER BY cr.completed_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );

    return records.map(r => ({
      id: r.id,
      choreType: { name: r.chore_name, icon: r.chore_icon || '🧹' },
      user: { nickname: r.user_name, avatarUrl: r.avatar_url },
      points: r.points_earned,
      deduction: r.deduction || 0,
      deductionReason: r.deduction_reason || '',
      remark: r.note,
      images: r.images || [],
      status: r.status || REVIEW_STATUS.APPROVED,
      completedAt: r.completed_at
    }));
  }

  /**
   * 获取待审核记录
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>}
   */
  async getPendingRecords(familyId, userId) {
    await familyService.validateAdminRole(userId, familyId);

    // 开发模式：返回模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟待审核记录');
      const records = mockChoreRecords.get(familyId) || [];
      return records
        .filter(r => r.status === REVIEW_STATUS.PENDING)
        .map(r => ({
          id: r.id,
          choreName: r.choreType.name,
          choreIcon: r.choreType.icon || '🧹',
          points: r.points,
          note: r.remark,
          images: r.images || [],
          status: r.status,
          completedAt: r.completedAt,
          userNickname: r.user.nickname,
          userAvatar: r.user.avatarUrl
        }));
    }

    const records = await this.queryMany(
      `SELECT cr.id, cr.points_earned, cr.note, cr.images, cr.status, cr.completed_at,
              ct.name as chore_name, ct.icon,
              u.nickname, u.avatar_url
       FROM chore_records cr
       JOIN chore_types ct ON cr.chore_type_id = ct.id
       JOIN users u ON cr.user_id = u.id
       WHERE cr.family_id = $1 AND cr.status = $2
       ORDER BY cr.completed_at DESC`,
      [familyId, REVIEW_STATUS.PENDING]
    );

    return records.map(r => ({
      id: r.id,
      choreName: r.chore_name,
      choreIcon: r.icon || '🧹',
      points: r.points_earned,
      note: r.note,
      images: r.images || [],
      status: r.status,
      completedAt: r.completed_at,
      userNickname: r.nickname,
      userAvatar: r.avatar_url
    }));
  }

  /**
   * 获取待审核数量
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 用户ID
   * @returns {Promise<number>}
   */
  async getPendingCount(familyId, userId) {
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);
    if (!isAdmin) {
      return 0;
    }

    // 开发模式：返回模拟数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟待审核数量');
      const records = mockChoreRecords.get(familyId) || [];
      return records.filter(r => r.status === REVIEW_STATUS.PENDING).length;
    }

    const result = await this.queryOne(
      `SELECT COUNT(*) as count FROM chore_records WHERE family_id = $1 AND status = $2`,
      [familyId, REVIEW_STATUS.PENDING]
    );

    return parseInt(result?.count || 0);
  }

  /**
   * 审核家务记录
   * @param {Object} data - 审核数据
   * @returns {Promise<Object>}
   */
  async reviewRecord(data) {
    const { recordId, reviewerId, action, deduction = 0, deductionReason, reviewNote } = data;

    // 开发模式：模拟审核
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：模拟审核家务记录');
      
      let foundRecord = null;
      let familyId = null;
      
      for (const [fid, records] of mockChoreRecords) {
        const index = records.findIndex(r => r.id === recordId);
        if (index !== -1) {
          foundRecord = records[index];
          familyId = fid;
          break;
        }
      }

      if (!foundRecord) {
        throw new Error(ERROR_CODES.CHORE_RECORD_NOT_FOUND.message);
      }

      if (foundRecord.status !== REVIEW_STATUS.PENDING) {
        throw new Error(ERROR_CODES.CHORE_RECORD_ALREADY_REVIEWED.message);
      }

      if (action === 'approve') {
        const originalPoints = foundRecord.points;
        const actualDeduction = Math.min(deduction, originalPoints);
        const finalPoints = originalPoints - actualDeduction;

        foundRecord.status = REVIEW_STATUS.APPROVED;
        foundRecord.deduction = actualDeduction;
        foundRecord.deductionReason = deductionReason || '';
        foundRecord.finalPoints = finalPoints;

        // 创建模拟积分交易
        if (finalPoints > 0) {
          await pointsService.createTransaction({
            userId: foundRecord.userId,
            familyId: familyId,
            points: finalPoints,
            type: TRANSACTION_TYPE.EARN,
            description: `完成家务: ${foundRecord.choreType.name}`
          });
        }

        return {
          recordId,
          status: REVIEW_STATUS.APPROVED,
          originalPoints,
          deduction: actualDeduction,
          finalPoints,
          message: actualDeduction > 0 
            ? `已通过，扣${actualDeduction}分，实得${finalPoints}分`
            : `已通过，获得${finalPoints}分`
        };
      } else {
        foundRecord.status = REVIEW_STATUS.REJECTED;
        return {
          recordId,
          status: REVIEW_STATUS.REJECTED,
          message: '已拒绝，不计分'
        };
      }
    }

    // 获取记录详情
    const record = await this.queryOne(
      `SELECT cr.*, ct.name as chore_name
       FROM chore_records cr
       JOIN chore_types ct ON cr.chore_type_id = ct.id
       WHERE cr.id = $1`,
      [recordId]
    );

    if (!record) {
      throw new Error(ERROR_CODES.CHORE_RECORD_NOT_FOUND.message);
    }

    if (record.status !== REVIEW_STATUS.PENDING) {
      throw new Error(ERROR_CODES.CHORE_RECORD_ALREADY_REVIEWED.message);
    }

    // 验证审核权限
    await familyService.validateAdminRole(reviewerId, record.family_id);

    return await this.transaction(async (client) => {
      if (action === 'approve') {
        const originalPoints = record.points_earned;
        const actualDeduction = Math.min(deduction, originalPoints);
        const finalPoints = originalPoints - actualDeduction;

        // 更新记录状态
        await client.query(
          `UPDATE chore_records 
           SET status = $1, deduction = $2, deduction_reason = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP 
           WHERE id = $5`,
          [REVIEW_STATUS.APPROVED, actualDeduction, deductionReason || '', reviewerId, recordId]
        );

        // 创建积分交易记录
        if (finalPoints > 0) {
          let description = `完成家务: ${record.chore_name}`;
          if (actualDeduction > 0) {
            description += ` (扣${actualDeduction}分: ${deductionReason || '质量问题'})`;
          }

          await pointsService.createTransaction({
            userId: record.user_id,
            familyId: record.family_id,
            points: finalPoints,
            type: TRANSACTION_TYPE.EARN,
            description
          }, client);
        }

        logger.audit('审核通过家务记录', reviewerId, { 
          recordId, 
          originalPoints, 
          finalPoints, 
          deduction: actualDeduction 
        });

        return {
          recordId,
          status: REVIEW_STATUS.APPROVED,
          originalPoints,
          deduction: actualDeduction,
          finalPoints,
          message: actualDeduction > 0 
            ? `已通过，扣${actualDeduction}分，实得${finalPoints}分`
            : `已通过，获得${finalPoints}分`
        };
      } else {
        // 拒绝
        await client.query(
          `UPDATE chore_records 
           SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP 
           WHERE id = $3`,
          [REVIEW_STATUS.REJECTED, reviewerId, recordId]
        );

        logger.audit('拒绝家务记录', reviewerId, { recordId });

        return {
          recordId,
          status: REVIEW_STATUS.REJECTED,
          message: '已拒绝，不计分'
        };
      }
    });
  }

  /**
   * 获取家务统计 (PostgreSQL 版本)
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async getStatistics(familyId, userId) {
    await familyService.validateMembership(userId, familyId);

    // 开发模式：返回模拟统计数据
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟家务统计');
      
      const records = mockChoreRecords.get(familyId) || [];
      const today = new Date().toISOString().split('T')[0];
      
      const todayApprovedRecords = records.filter(r => 
        r.status === REVIEW_STATUS.APPROVED && 
        new Date(r.completedAt).toISOString().split('T')[0] === today
      );

      const totalChores = todayApprovedRecords.length;
      const totalPoints = todayApprovedRecords.reduce((sum, r) => sum + (r.finalPoints || 0), 0);
      
      const myTodayRecords = todayApprovedRecords.filter(r => r.userId === userId);
      const myChores = myTodayRecords.length;
      
      // 获取总积分概览
      const summary = await pointsService.getSummary(familyId, userId);

      return {
        totalChores,
        totalPoints,
        myChores,
        myPoints: summary.availablePoints
      };
    }

    const today = new Date().toISOString().split('T')[0];

    const todayStats = await this.queryOne(
      `SELECT 
        COUNT(*) as total_chores,
        COALESCE(SUM(points_earned), 0) as total_points,
        COUNT(*) FILTER (WHERE user_id = $1) as my_chores,
        COALESCE(SUM(points_earned) FILTER (WHERE user_id = $2), 0) as my_points
       FROM chore_records
       WHERE family_id = $3 AND completed_at::date = $4 AND status = 'approved'`,
      [userId, userId, familyId, today]
    );

    const totalPoints = await this.queryOne(
      `SELECT COALESCE(SUM(points), 0) as total
       FROM point_transactions 
       WHERE family_id = $1 AND user_id = $2`,
      [familyId, userId]
    );

    return {
      totalChores: parseInt(todayStats.total_chores),
      totalPoints: parseInt(todayStats.total_points),
      myChores: parseInt(todayStats.my_chores),
      myPoints: parseInt(totalPoints.total)
    };
  }
}

module.exports = new ChoreService();
