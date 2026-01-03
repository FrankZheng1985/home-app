// src/controllers/choreController.js
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

// 动态导入数据库模块
let query;
try {
  query = require('../config/database').query;
} catch (e) {
  console.warn('数据库模块未加载');
  query = null;
}

// 模拟数据
const mockChoreTypes = global.mockChoreTypes || (global.mockChoreTypes = new Map());
const mockChoreRecords = global.mockChoreRecords || (global.mockChoreRecords = new Map());
const mockFamilyMembers = global.mockFamilyMembers || (global.mockFamilyMembers = new Map());

/**
 * 获取家务类型列表
 */
const getTypes = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为家庭成员
      const memberCheck = await query(
        'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      const result = await query(
        `SELECT id, name, points, icon, description, is_preset, is_active, created_at
         FROM chore_types
         WHERE family_id = $1 AND is_active = true
         ORDER BY is_preset DESC, created_at ASC`,
        [familyId]
      );

      return res.json({
        data: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          points: row.points,
          icon: row.icon || '🧹',
          description: row.description || '',
          isPreset: row.is_preset,
          isActive: row.is_active,
          createdAt: row.created_at
        }))
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据（开发模式）- 返回预设的家务类型
  try {
    const presetChores = [
      { id: uuidv4(), name: '洗碗', points: 5, isPreset: true, isActive: true },
      { id: uuidv4(), name: '扫地', points: 5, isPreset: true, isActive: true },
      { id: uuidv4(), name: '拖地', points: 8, isPreset: true, isActive: true },
      { id: uuidv4(), name: '做饭', points: 15, isPreset: true, isActive: true },
      { id: uuidv4(), name: '洗衣服', points: 10, isPreset: true, isActive: true },
      { id: uuidv4(), name: '整理房间', points: 10, isPreset: true, isActive: true },
      { id: uuidv4(), name: '倒垃圾', points: 3, isPreset: true, isActive: true },
      { id: uuidv4(), name: '擦桌子', points: 3, isPreset: true, isActive: true }
    ];
    
    return res.json({ data: presetChores });
  } catch (error) {
    console.error('获取家务类型错误:', error);
    return res.status(500).json({ error: '获取家务类型失败' });
  }
};

/**
 * 创建家务类型
 */
const createType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { familyId, name, points, icon, description } = req.body;

  try {
    // 验证用户是否为管理员
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    if (memberCheck.rows[0].role !== 'admin' && memberCheck.rows[0].role !== 'creator') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    // 检查名称是否重复
    const nameCheck = await query(
      'SELECT id FROM chore_types WHERE family_id = $1 AND name = $2 AND is_active = true',
      [familyId, name]
    );

    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ error: '家务名称已存在' });
    }

    const typeId = uuidv4();
    await query(
      `INSERT INTO chore_types (id, family_id, name, points, icon, description, is_preset, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, true, NOW())`,
      [typeId, familyId, name, points, icon || '🧹', description || '']
    );

    return res.json({
      data: {
        id: typeId,
        name,
        points,
        icon: icon || '🧹',
        description: description || '',
        isPreset: false,
        isActive: true
      }
    });
  } catch (error) {
    console.error('创建家务类型错误:', error);
    return res.status(500).json({ error: '创建家务类型失败' });
  }
};

/**
 * 更新家务类型
 */
const updateType = async (req, res) => {
  const { typeId } = req.params;
  const { name, points, icon, description, isActive } = req.body;

  try {
    // 获取家务类型信息
    const typeResult = await query(
      'SELECT family_id FROM chore_types WHERE id = $1',
      [typeId]
    );

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ error: '家务类型不存在' });
    }

    const familyId = typeResult.rows[0].family_id;

    // 验证用户是否为管理员
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || 
        (memberCheck.rows[0].role !== 'admin' && memberCheck.rows[0].role !== 'creator')) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    // 构建更新语句
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (points !== undefined) {
      updates.push(`points = $${paramIndex++}`);
      values.push(points);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(icon);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的内容' });
    }

    values.push(typeId);

    await query(
      `UPDATE chore_types SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return res.json({ data: { message: '更新成功' } });
  } catch (error) {
    console.error('更新家务类型错误:', error);
    return res.status(500).json({ error: '更新家务类型失败' });
  }
};

/**
 * 删除家务类型（软删除）
 */
const deleteType = async (req, res) => {
  const { typeId } = req.params;

  try {
    // 获取家务类型信息
    const typeResult = await query(
      'SELECT family_id FROM chore_types WHERE id = $1',
      [typeId]
    );

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ error: '家务类型不存在' });
    }

    const familyId = typeResult.rows[0].family_id;

    // 验证用户是否为管理员
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.id]
    );

    if (memberCheck.rows.length === 0 || 
        (memberCheck.rows[0].role !== 'admin' && memberCheck.rows[0].role !== 'creator')) {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    // 软删除
    await query(
      'UPDATE chore_types SET is_active = false WHERE id = $1',
      [typeId]
    );

    return res.json({ data: { message: '删除成功' } });
  } catch (error) {
    console.error('删除家务类型错误:', error);
    return res.status(500).json({ error: '删除家务类型失败' });
  }
};

/**
 * 提交家务记录
 */
const createRecord = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { choreTypeId, familyId, note, images } = req.body;
  const userId = req.user.id;

  try {
    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    const userRole = memberCheck.rows[0].role;
    const isAdmin = userRole === 'creator' || userRole === 'admin';

    // 获取家务类型信息
    const typeResult = await query(
      'SELECT name, points FROM chore_types WHERE id = $1 AND family_id = $2 AND is_active = true',
      [choreTypeId, familyId]
    );

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ error: '家务类型不存在' });
    }

    const { name: choreName, points } = typeResult.rows[0];

    // 创建家务记录（管理员直接通过，普通用户需要审核）
    const recordId = uuidv4();
    const status = isAdmin ? 'approved' : 'pending';
    const finalPoints = isAdmin ? points : null;
    
    await query(
      `INSERT INTO chore_records (id, user_id, chore_type_id, family_id, points_earned, note, images, status, final_points, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [recordId, userId, choreTypeId, familyId, points, note || '', images || [], status, finalPoints]
    );

    // 如果是管理员，直接创建积分交易记录
    if (isAdmin) {
      await query(
        `INSERT INTO point_transactions (id, user_id, family_id, points, type, description, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [uuidv4(), userId, familyId, points, 'earn', `完成家务: ${choreName}`]
      );
    }

    return res.json({
      data: {
        id: recordId,
        choreName,
        points,
        status,
        message: isAdmin ? '记录成功，积分已到账' : '记录已提交，等待家长审核'
      }
    });
  } catch (error) {
    console.error('提交家务记录错误:', error);
    return res.status(500).json({ error: '提交家务记录失败' });
  }
};

/**
 * 获取家务记录列表
 */
const getRecords = async (req, res) => {
  const { familyId, userId, date, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    // 构建查询
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

    const result = await query(
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

    return res.json({
      data: result.rows.map(row => ({
        id: row.id,
        choreType: {
          name: row.chore_name,
          icon: row.chore_icon || '🧹'
        },
        user: {
          nickname: row.user_name,
          avatarUrl: row.avatar_url
        },
        points: row.points_earned,
        finalPoints: row.final_points,
        deduction: row.deduction || 0,
        deductionReason: row.deduction_reason || '',
        remark: row.note,
        images: row.images || [],
        status: row.status || 'approved',
        completedAt: row.completed_at
      }))
    });
  } catch (error) {
    console.error('获取家务记录错误:', error);
    return res.status(500).json({ error: '获取家务记录失败' });
  }
};

/**
 * 获取家务统计
 */
const getStatistics = async (req, res) => {
  const { familyId, period } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为家庭成员
      const memberCheck = await query(
        'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      // 今日统计
      const today = new Date().toISOString().split('T')[0];
      
      const todayStats = await query(
        `SELECT 
          COUNT(*) as total_chores,
          COALESCE(SUM(points_earned), 0) as total_points,
          COUNT(*) FILTER (WHERE user_id = $2) as my_chores,
          COALESCE(SUM(points_earned) FILTER (WHERE user_id = $2), 0) as my_points
         FROM chore_records
         WHERE family_id = $1 AND DATE(completed_at) = $3`,
        [familyId, req.user.id, today]
      );

      // 总积分
      const totalPoints = await query(
        `SELECT COALESCE(SUM(points_earned), 0) as total
         FROM chore_records WHERE family_id = $1 AND user_id = $2`,
        [familyId, req.user.id]
      );

      return res.json({
        data: {
          totalChores: parseInt(todayStats.rows[0].total_chores),
          totalPoints: parseInt(todayStats.rows[0].total_points),
          myChores: parseInt(todayStats.rows[0].my_chores),
          myPoints: parseInt(totalPoints.rows[0].total)
        }
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据（开发模式）
  try {
    // 返回空统计数据
    return res.json({
      data: {
        totalChores: 0,
        totalPoints: 0,
        myChores: 0,
        myPoints: 0,
        weekPoints: 0
      }
    });
  } catch (error) {
    console.error('获取家务统计错误:', error);
    return res.status(500).json({ error: '获取家务统计失败' });
  }
};

/**
 * 获取待审核的家务记录（管理员）
 */
const getPendingRecords = async (req, res) => {
  const { familyId } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  try {
    // 检查是否为管理员
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'creator' && role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const result = await query(
      `SELECT cr.id, cr.points_earned, cr.note, cr.images, cr.status, cr.completed_at,
              ct.name as chore_name, ct.icon,
              u.nickname, u.avatar_url
       FROM chore_records cr
       JOIN chore_types ct ON cr.chore_type_id = ct.id
       JOIN users u ON cr.user_id = u.id
       WHERE cr.family_id = $1 AND cr.status = 'pending'
       ORDER BY cr.completed_at DESC`,
      [familyId]
    );

    return res.json({
      data: result.rows.map(row => ({
        id: row.id,
        choreName: row.chore_name,
        choreIcon: row.icon || '🧹',
        points: row.points_earned,
        note: row.note,
        images: row.images || [],
        status: row.status,
        completedAt: row.completed_at,
        userNickname: row.nickname,
        userAvatar: row.avatar_url
      }))
    });
  } catch (error) {
    console.error('获取待审核记录错误:', error);
    return res.status(500).json({ error: '获取待审核记录失败' });
  }
};

/**
 * 审核家务记录（管理员）
 */
const reviewRecord = async (req, res) => {
  const { recordId, action, deduction, deductionReason, reviewNote } = req.body;
  const reviewerId = req.user.id;

  if (!recordId || !action) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '无效的操作' });
  }

  try {
    // 获取记录详情
    const recordRes = await query(
      `SELECT cr.*, ct.name as chore_name
       FROM chore_records cr
       JOIN chore_types ct ON cr.chore_type_id = ct.id
       WHERE cr.id = $1`,
      [recordId]
    );

    if (recordRes.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const record = recordRes.rows[0];

    if (record.status !== 'pending') {
      return res.status(400).json({ error: '该记录已处理' });
    }

    // 检查审核权限
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [record.family_id, reviewerId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'creator' && role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    if (action === 'approve') {
      // 计算最终积分
      const originalPoints = record.points_earned;
      const actualDeduction = Math.min(deduction || 0, originalPoints);
      const finalPoints = originalPoints - actualDeduction;

      // 更新记录状态
      await query(
        `UPDATE chore_records 
         SET status = 'approved', 
             final_points = $1, 
             deduction = $2, 
             deduction_reason = $3,
             review_note = $4,
             reviewed_by = $5, 
             reviewed_at = NOW()
         WHERE id = $6`,
        [finalPoints, actualDeduction, deductionReason || '', reviewNote || '', reviewerId, recordId]
      );

      // 创建积分交易记录
      if (finalPoints > 0) {
        let description = `完成家务: ${record.chore_name}`;
        if (actualDeduction > 0) {
          description += ` (扣${actualDeduction}分: ${deductionReason || '质量问题'})`;
        }
        
        await query(
          `INSERT INTO point_transactions (id, user_id, family_id, points, type, description, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [uuidv4(), record.user_id, record.family_id, finalPoints, 'earn', description]
        );
      }

      return res.json({
        data: {
          recordId,
          status: 'approved',
          originalPoints,
          deduction: actualDeduction,
          finalPoints,
          message: actualDeduction > 0 
            ? `已通过，扣${actualDeduction}分，实得${finalPoints}分`
            : `已通过，获得${finalPoints}分`
        }
      });
    } else {
      // 拒绝
      await query(
        `UPDATE chore_records 
         SET status = 'rejected',
             final_points = 0,
             review_note = $1,
             reviewed_by = $2, 
             reviewed_at = NOW()
         WHERE id = $3`,
        [reviewNote || '审核未通过', reviewerId, recordId]
      );

      return res.json({
        data: {
          recordId,
          status: 'rejected',
          message: '已拒绝，不计分'
        }
      });
    }
  } catch (error) {
    console.error('审核家务记录错误:', error);
    return res.status(500).json({ error: '审核失败' });
  }
};

/**
 * 获取待审核数量
 */
const getPendingCount = async (req, res) => {
  const { familyId } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  try {
    // 检查是否为管理员
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.json({ data: { count: 0 } });
    }

    const role = memberCheck.rows[0].role;
    if (role !== 'creator' && role !== 'admin') {
      return res.json({ data: { count: 0 } });
    }

    const result = await query(
      `SELECT COUNT(*) as count FROM chore_records WHERE family_id = $1 AND status = 'pending'`,
      [familyId]
    );

    return res.json({
      data: { count: parseInt(result.rows[0]?.count || 0) }
    });
  } catch (error) {
    console.error('获取待审核数量错误:', error);
    return res.json({ data: { count: 0 } });
  }
};

module.exports = {
  getTypes,
  createType,
  updateType,
  deleteType,
  createRecord,
  getRecords,
  getStatistics,
  getPendingRecords,
  reviewRecord,
  getPendingCount
};

