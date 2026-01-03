// src/controllers/choreController.js
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * 获取家务类型列表
 */
const getTypes = async (req, res) => {
  const { familyId } = req.query;

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

    const result = await query(
      `SELECT id, name, points, is_preset, is_active, created_at
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
        isPreset: row.is_preset,
        isActive: row.is_active,
        createdAt: row.created_at
      }))
    });
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

  const { familyId, name, points } = req.body;

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
      `INSERT INTO chore_types (id, family_id, name, points, is_preset, is_active, created_at)
       VALUES ($1, $2, $3, $4, false, true, NOW())`,
      [typeId, familyId, name, points]
    );

    return res.json({
      data: {
        id: typeId,
        name,
        points,
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
  const { name, points, isActive } = req.body;

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

  const { choreTypeId, familyId, note } = req.body;
  const userId = req.user.id;

  try {
    // 验证用户是否为家庭成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: '您不是该家庭成员' });
    }

    // 获取家务类型信息
    const typeResult = await query(
      'SELECT name, points FROM chore_types WHERE id = $1 AND family_id = $2 AND is_active = true',
      [choreTypeId, familyId]
    );

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ error: '家务类型不存在' });
    }

    const { name: choreName, points } = typeResult.rows[0];

    // 创建家务记录
    const recordId = uuidv4();
    await query(
      `INSERT INTO chore_records (id, user_id, chore_type_id, family_id, points_earned, note, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [recordId, userId, choreTypeId, familyId, points, note || '']
    );

    // 创建积分交易记录
    await query(
      `INSERT INTO point_transactions (id, user_id, family_id, points, type, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), userId, familyId, points, 'earn', `完成家务: ${choreName}`]
    );

    return res.json({
      data: {
        id: recordId,
        choreName,
        points,
        message: '记录成功'
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
      `SELECT cr.id, cr.points_earned, cr.note, cr.completed_at,
              ct.name as chore_name,
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
        choreName: row.chore_name,
        userName: row.user_name,
        userAvatar: row.avatar_url,
        points: row.points_earned,
        note: row.note,
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
  const { familyId, startDate, endDate } = req.query;

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
  } catch (error) {
    console.error('获取家务统计错误:', error);
    return res.status(500).json({ error: '获取家务统计失败' });
  }
};

module.exports = {
  getTypes,
  createType,
  updateType,
  deleteType,
  createRecord,
  getRecords,
  getStatistics
};

