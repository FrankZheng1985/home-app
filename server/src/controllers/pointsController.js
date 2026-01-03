// src/controllers/pointsController.js
const { query } = require('../config/database');

/**
 * 获取积分概览
 */
const getSummary = async (req, res) => {
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

    // 获取家庭积分价值
    const familyResult = await query(
      'SELECT points_value FROM families WHERE id = $1',
      [familyId]
    );

    const pointsValue = parseFloat(familyResult.rows[0]?.points_value || 0);

    // 今日统计
    const today = new Date().toISOString().split('T')[0];
    
    const todayStats = await query(
      `SELECT 
        COUNT(*) as total_chores,
        COALESCE(SUM(points_earned), 0) as total_points,
        COUNT(*) FILTER (WHERE user_id = $2) as my_chores,
        COALESCE(SUM(points_earned) FILTER (WHERE user_id = $2), 0) as my_today_points
       FROM chore_records
       WHERE family_id = $1 AND DATE(completed_at) = $3`,
      [familyId, req.user.id, today]
    );

    // 我的总积分
    const myTotalPoints = await query(
      `SELECT COALESCE(SUM(points), 0) as total
       FROM point_transactions 
       WHERE family_id = $1 AND user_id = $2`,
      [familyId, req.user.id]
    );

    // 本月积分
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const myMonthPoints = await query(
      `SELECT COALESCE(SUM(points), 0) as total
       FROM point_transactions 
       WHERE family_id = $1 AND user_id = $2 AND created_at >= $3`,
      [familyId, req.user.id, monthStart.toISOString()]
    );

    const totalPoints = parseInt(myTotalPoints.rows[0].total);
    const monthPoints = parseInt(myMonthPoints.rows[0].total);

    return res.json({
      data: {
        totalChores: parseInt(todayStats.rows[0].total_chores),
        totalPoints: parseInt(todayStats.rows[0].total_points),
        myChores: parseInt(todayStats.rows[0].my_chores),
        myPoints: totalPoints,
        myTodayPoints: parseInt(todayStats.rows[0].my_today_points),
        myMonthPoints: monthPoints,
        pointsValue,
        totalValue: (totalPoints * pointsValue).toFixed(2),
        monthValue: (monthPoints * pointsValue).toFixed(2)
      }
    });
  } catch (error) {
    console.error('获取积分概览错误:', error);
    return res.status(500).json({ error: '获取积分概览失败' });
  }
};

/**
 * 获取积分记录
 */
const getTransactions = async (req, res) => {
  const { familyId, type, limit = 20, offset = 0 } = req.query;

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
    let whereClause = 'pt.family_id = $1 AND pt.user_id = $2';
    const values = [familyId, req.user.id];
    let paramIndex = 3;

    if (type) {
      whereClause += ` AND pt.type = $${paramIndex++}`;
      values.push(type);
    }

    values.push(parseInt(limit), parseInt(offset));

    const result = await query(
      `SELECT pt.id, pt.points, pt.type, pt.description, pt.created_at
       FROM point_transactions pt
       WHERE ${whereClause}
       ORDER BY pt.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return res.json({
      data: result.rows.map(row => ({
        id: row.id,
        points: row.points,
        type: row.type,
        description: row.description,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error('获取积分记录错误:', error);
    return res.status(500).json({ error: '获取积分记录失败' });
  }
};

/**
 * 获取积分排行榜
 */
const getRanking = async (req, res) => {
  const { familyId, period = 'all' } = req.query;

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

    // 构建时间条件
    let timeCondition = '';
    const values = [familyId];

    if (period === 'week') {
      timeCondition = 'AND pt.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
    } else if (period === 'month') {
      timeCondition = 'AND pt.created_at >= DATE_TRUNC(\'month\', CURRENT_DATE)';
    }

    const result = await query(
      `SELECT u.id, u.nickname, u.avatar_url,
              COALESCE(SUM(pt.points), 0) as total_points,
              COUNT(pt.id) as total_records
       FROM family_members fm
       JOIN users u ON fm.user_id = u.id
       LEFT JOIN point_transactions pt ON pt.user_id = u.id AND pt.family_id = $1 ${timeCondition}
       WHERE fm.family_id = $1
       GROUP BY u.id, u.nickname, u.avatar_url
       ORDER BY total_points DESC`,
      values
    );

    // 获取家庭积分价值
    const familyResult = await query(
      'SELECT points_value FROM families WHERE id = $1',
      [familyId]
    );
    const pointsValue = parseFloat(familyResult.rows[0]?.points_value || 0);

    return res.json({
      data: result.rows.map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        nickname: row.nickname,
        avatarUrl: row.avatar_url,
        totalPoints: parseInt(row.total_points),
        totalRecords: parseInt(row.total_records),
        totalValue: (parseInt(row.total_points) * pointsValue).toFixed(2)
      }))
    });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return res.status(500).json({ error: '获取排行榜失败' });
  }
};

module.exports = {
  getSummary,
  getTransactions,
  getRanking
};

