// controllers/sportsController.js - 运动打卡控制器
const pool = require('../config/database');
const crypto = require('crypto');

/**
 * 获取运动类型列表
 */
const getTypes = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    
    if (!familyId) {
      return res.json({ success: true, data: [] });
    }
    
    const result = await pool.query(
      `SELECT id, name, icon, color, calories_per_min as "caloriesPerMin", is_preset as "isPreset"
       FROM sport_types 
       WHERE family_id = $1 
       ORDER BY is_preset DESC, created_at ASC`,
      [familyId]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取运动类型失败:', error);
    res.status(500).json({ success: false, message: '获取运动类型失败' });
  }
};

/**
 * 创建运动类型
 */
const createType = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    const { name, icon, color, caloriesPerMin } = req.body;
    
    if (!familyId) {
      return res.status(400).json({ success: false, message: '请先加入家庭' });
    }
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '请输入运动名称' });
    }
    
    const result = await pool.query(
      `INSERT INTO sport_types (family_id, name, icon, color, calories_per_min)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, icon, color, calories_per_min as "caloriesPerMin", is_preset as "isPreset"`,
      [familyId, name.trim(), icon || '🏋️', color || '#607d8b', caloriesPerMin || 5]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('创建运动类型失败:', error);
    res.status(500).json({ success: false, message: '创建运动类型失败' });
  }
};

/**
 * 删除运动类型
 */
const deleteType = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    const { typeId } = req.params;
    
    // 检查是否为预设类型
    const checkResult = await pool.query(
      'SELECT is_preset FROM sport_types WHERE id = $1 AND family_id = $2',
      [typeId, familyId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '运动类型不存在' });
    }
    
    if (checkResult.rows[0].is_preset) {
      return res.status(400).json({ success: false, message: '预设类型不能删除' });
    }
    
    await pool.query(
      'DELETE FROM sport_types WHERE id = $1 AND family_id = $2',
      [typeId, familyId]
    );
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除运动类型失败:', error);
    res.status(500).json({ success: false, message: '删除运动类型失败' });
  }
};

/**
 * 创建运动记录
 */
const createRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    const { sportTypeId, sportType, icon, color, duration, calories, steps, remark } = req.body;
    
    if (!familyId) {
      return res.status(400).json({ success: false, message: '请先加入家庭' });
    }
    
    if (!sportType || duration <= 0) {
      return res.status(400).json({ success: false, message: '请选择运动类型和时长' });
    }
    
    const result = await pool.query(
      `INSERT INTO sport_records 
       (user_id, family_id, sport_type_id, sport_type, icon, color, duration, calories, steps, remark, record_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE)
       RETURNING *`,
      [userId, familyId, sportTypeId || null, sportType, icon || '🏃', color || '#4caf50', 
       duration, calories || 0, steps || 0, remark || null]
    );
    
    res.json({ success: true, data: result.rows[0], message: '打卡成功' });
  } catch (error) {
    console.error('创建运动记录失败:', error);
    res.status(500).json({ success: false, message: '创建运动记录失败' });
  }
};

/**
 * 获取运动记录
 */
const getRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    const { date, limit = 20, offset = 0 } = req.query;
    
    if (!familyId) {
      return res.json({ success: true, data: [] });
    }
    
    let query = `
      SELECT sr.id, sr.sport_type as "sportType", sr.icon, sr.color, 
             sr.duration, sr.calories, sr.steps, sr.remark,
             sr.record_date as "recordDate", sr.created_at as "createdAt"
      FROM sport_records sr
      WHERE sr.user_id = $1 AND sr.family_id = $2
    `;
    const params = [userId, familyId];
    
    if (date) {
      query += ` AND sr.record_date = $3`;
      params.push(date);
    }
    
    query += ` ORDER BY sr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取运动记录失败:', error);
    res.status(500).json({ success: false, message: '获取运动记录失败' });
  }
};

/**
 * 获取本周统计
 */
const getWeekStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    
    if (!familyId) {
      return res.json({ 
        success: true, 
        data: { totalDays: 0, totalMinutes: 0, continuousDays: 0, checkedDates: [] } 
      });
    }
    
    // 获取本周开始日期（周一）
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    // 本周统计
    const weekStatsResult = await pool.query(
      `SELECT 
         COUNT(DISTINCT record_date) as "totalDays",
         COALESCE(SUM(duration), 0) as "totalMinutes",
         COALESCE(SUM(calories), 0) as "totalCalories"
       FROM sport_records 
       WHERE user_id = $1 AND family_id = $2 AND record_date >= $3`,
      [userId, familyId, monday.toISOString().split('T')[0]]
    );
    
    // 获取本周已打卡日期
    const checkedDatesResult = await pool.query(
      `SELECT DISTINCT record_date::text as date
       FROM sport_records 
       WHERE user_id = $1 AND family_id = $2 AND record_date >= $3
       ORDER BY date`,
      [userId, familyId, monday.toISOString().split('T')[0]]
    );
    
    // 计算连续打卡天数
    const continuousDaysResult = await pool.query(
      `WITH dates AS (
         SELECT DISTINCT record_date
         FROM sport_records 
         WHERE user_id = $1 AND family_id = $2
         ORDER BY record_date DESC
       ),
       numbered AS (
         SELECT record_date, 
                record_date - (ROW_NUMBER() OVER (ORDER BY record_date DESC))::int AS grp
         FROM dates
       )
       SELECT COUNT(*) as continuous_days
       FROM numbered
       WHERE grp = (SELECT grp FROM numbered WHERE record_date = CURRENT_DATE)`,
      [userId, familyId]
    );
    
    const stats = weekStatsResult.rows[0];
    const checkedDates = checkedDatesResult.rows.map(r => r.date);
    const continuousDays = parseInt(continuousDaysResult.rows[0]?.continuous_days) || 0;
    
    res.json({
      success: true,
      data: {
        totalDays: parseInt(stats.totalDays) || 0,
        totalMinutes: parseInt(stats.totalMinutes) || 0,
        totalCalories: parseInt(stats.totalCalories) || 0,
        continuousDays,
        checkedDates
      }
    });
  } catch (error) {
    console.error('获取周统计失败:', error);
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
};

/**
 * 同步微信运动步数
 */
const syncSteps = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    const { encryptedData, iv } = req.body;
    
    if (!familyId) {
      return res.status(400).json({ success: false, message: '请先加入家庭' });
    }
    
    // 注意：实际项目中需要使用微信服务端 API 解密数据
    // 这里简化处理，返回模拟数据
    // 真实实现需要：
    // 1. 获取用户的 session_key
    // 2. 使用 session_key + iv 解密 encryptedData
    // 3. 解密后得到步数数据
    
    // 模拟解密后的步数（实际应该从解密数据中获取）
    const todaySteps = Math.floor(Math.random() * 5000) + 3000;
    
    // 保存或更新今日步数
    await pool.query(
      `INSERT INTO step_records (user_id, family_id, steps, record_date)
       VALUES ($1, $2, $3, CURRENT_DATE)
       ON CONFLICT (user_id, record_date) 
       DO UPDATE SET steps = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, familyId, todaySteps]
    );
    
    res.json({
      success: true,
      data: {
        todaySteps,
        syncTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('同步步数失败:', error);
    res.status(500).json({ success: false, message: '同步步数失败' });
  }
};

/**
 * 获取今日步数
 */
const getTodaySteps = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT steps FROM step_records 
       WHERE user_id = $1 AND record_date = CURRENT_DATE`,
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        steps: result.rows[0]?.steps || 0
      }
    });
  } catch (error) {
    console.error('获取步数失败:', error);
    res.status(500).json({ success: false, message: '获取步数失败' });
  }
};

/**
 * 初始化默认运动类型
 */
const initDefaultTypes = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    
    if (!familyId) {
      return res.status(400).json({ success: false, message: '请先加入家庭' });
    }
    
    // 检查是否已有运动类型
    const existingResult = await pool.query(
      'SELECT COUNT(*) FROM sport_types WHERE family_id = $1',
      [familyId]
    );
    
    if (parseInt(existingResult.rows[0].count) > 0) {
      return res.json({ success: true, message: '已有运动类型' });
    }
    
    // 预设运动类型
    const defaultTypes = [
      { name: '跑步', icon: '🏃', color: '#4caf50', caloriesPerMin: 10 },
      { name: '步行', icon: '🚶', color: '#8bc34a', caloriesPerMin: 4 },
      { name: '骑行', icon: '🚴', color: '#03a9f4', caloriesPerMin: 8 },
      { name: '游泳', icon: '🏊', color: '#00bcd4', caloriesPerMin: 12 },
      { name: '瑜伽', icon: '🧘', color: '#9c27b0', caloriesPerMin: 3 },
      { name: '健身', icon: '💪', color: '#ff5722', caloriesPerMin: 8 },
      { name: '球类', icon: '⚽', color: '#ff9800', caloriesPerMin: 9 },
      { name: '跳绳', icon: '🪢', color: '#e91e63', caloriesPerMin: 11 }
    ];
    
    for (const type of defaultTypes) {
      await pool.query(
        `INSERT INTO sport_types (family_id, name, icon, color, calories_per_min, is_preset)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [familyId, type.name, type.icon, type.color, type.caloriesPerMin]
      );
    }
    
    res.json({ success: true, message: '初始化成功' });
  } catch (error) {
    console.error('初始化运动类型失败:', error);
    res.status(500).json({ success: false, message: '初始化失败' });
  }
};

module.exports = {
  getTypes,
  createType,
  deleteType,
  createRecord,
  getRecords,
  getWeekStats,
  syncSteps,
  getTodaySteps,
  initDefaultTypes
};

