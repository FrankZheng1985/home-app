// src/services/choreService.js
// 家务服务层 - 处理家务相关业务逻辑

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');
const { REVIEW_STATUS, TRANSACTION_TYPE } = require('../constants/statusCodes');

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

    updates.updated_at = new Date();

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
      images: JSON.stringify(images || []),
      status,
      final_points: finalPoints,
      completed_at: new Date()
    });

    // 如果是管理员，直接创建积分交易记录
    if (isAdmin) {
      await this.createPointTransaction({
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

    let whereClause = 'cr.family_id = $1';
    const values = [familyId];
    let paramIndex = 2;

    if (userId) {
      whereClause += ` AND cr.user_id = $${paramIndex++}`;
      values.push(userId);
    }

    if (date) {
      whereClause += ` AND DATE(cr.completed_at) = $${paramIndex++}`;
      values.push(date);
    }

    values.push(parseInt(limit), parseInt(offset));

    const records = await this.queryMany(
      `SELECT cr.id, cr.points_earned, cr.note, cr.images, cr.status, 
              cr.final_points, cr.deduction, cr.deduction_reason, cr.completed_at,
              ct.name as chore_name, ct.icon as chore_icon,
              u.nickname as user_name, u.avatar_url
       FROM chore_records cr
       JOIN chore_types ct ON cr.chore_type_id = ct.id
       JOIN users u ON cr.user_id = u.id
       WHERE ${whereClause}
       ORDER BY cr.completed_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return records.map(r => ({
      id: r.id,
      choreType: { name: r.chore_name, icon: r.chore_icon || '🧹' },
      user: { nickname: r.user_name, avatarUrl: r.avatar_url },
      points: r.points_earned,
      finalPoints: r.final_points,
      deduction: r.deduction || 0,
      deductionReason: r.deduction_reason || '',
      remark: r.note,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []),
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
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []),
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

    if (action === 'approve') {
      const originalPoints = record.points_earned;
      const actualDeduction = Math.min(deduction, originalPoints);
      const finalPoints = originalPoints - actualDeduction;

      // 更新记录状态
      await this.update('chore_records', {
        status: REVIEW_STATUS.APPROVED,
        final_points: finalPoints,
        deduction: actualDeduction,
        deduction_reason: deductionReason || '',
        review_note: reviewNote || '',
        reviewed_by: reviewerId,
        reviewed_at: new Date()
      }, { id: recordId });

      // 创建积分交易记录
      if (finalPoints > 0) {
        let description = `完成家务: ${record.chore_name}`;
        if (actualDeduction > 0) {
          description += ` (扣${actualDeduction}分: ${deductionReason || '质量问题'})`;
        }

        await this.createPointTransaction({
          userId: record.user_id,
          familyId: record.family_id,
          points: finalPoints,
          type: TRANSACTION_TYPE.EARN,
          description
        });
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
      await this.update('chore_records', {
        status: REVIEW_STATUS.REJECTED,
        final_points: 0,
        review_note: reviewNote || '审核未通过',
        reviewed_by: reviewerId,
        reviewed_at: new Date()
      }, { id: recordId });

      logger.audit('拒绝家务记录', reviewerId, { recordId });

      return {
        recordId,
        status: REVIEW_STATUS.REJECTED,
        message: '已拒绝，不计分'
      };
    }
  }

  /**
   * 创建积分交易记录
   * @param {Object} data - 交易数据
   */
  async createPointTransaction(data) {
    const { userId, familyId, points, type, description } = data;

    await this.insert('point_transactions', {
      id: uuidv4(),
      user_id: userId,
      family_id: familyId,
      points,
      type,
      description,
      created_at: new Date()
    });
  }

  /**
   * 获取家务统计
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>}
   */
  async getStatistics(familyId, userId) {
    await familyService.validateMembership(userId, familyId);

    const today = new Date().toISOString().split('T')[0];

    const todayStats = await this.queryOne(
      `SELECT 
        COUNT(*) as total_chores,
        COALESCE(SUM(points_earned), 0) as total_points,
        COUNT(*) FILTER (WHERE user_id = $2) as my_chores,
        COALESCE(SUM(points_earned) FILTER (WHERE user_id = $2), 0) as my_points
       FROM chore_records
       WHERE family_id = $1 AND DATE(completed_at) = $3 AND status = 'approved'`,
      [familyId, userId, today]
    );

    const totalPoints = await this.queryOne(
      `SELECT COALESCE(SUM(final_points), 0) as total
       FROM chore_records 
       WHERE family_id = $1 AND user_id = $2 AND status = 'approved'`,
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

