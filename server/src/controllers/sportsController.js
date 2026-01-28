// controllers/sportsController.js - 运动打卡控制器
// 更新时间: 2026-01-25 15:08
const crypto = require('crypto');

let pool;
try {
  pool = require('../config/database');
} catch (e) {
  console.warn('数据库模块未加载');
  pool = null;
}

let authService;
try {
  authService = require('../services/authService');
} catch (e) {
  console.warn('authService 模块未加载');
  authService = null;
}

const { v4: uuidv4 } = require('uuid');

// 开发模式下的模拟数据
const mockSportTypes = global.mockSportTypes || (global.mockSportTypes = new Map());
const mockSportRecords = global.mockSportRecords || (global.mockSportRecords = new Map());
const mockStepRecords = global.mockStepRecords || (global.mockStepRecords = new Map());

// 预设运动类型
const PRESET_SPORT_TYPES = [
  { name: '跑步', icon: '🏃', color: '#4caf50', caloriesPerMin: 10 },
  { name: '步行', icon: '🚶', color: '#8bc34a', caloriesPerMin: 4 },
  { name: '骑行', icon: '🚴', color: '#03a9f4', caloriesPerMin: 8 },
  { name: '游泳', icon: '🏊', color: '#00bcd4', caloriesPerMin: 12 },
  { name: '瑜伽', icon: '🧘', color: '#9c27b0', caloriesPerMin: 3 },
  { name: '健身', icon: '💪', color: '#ff5722', caloriesPerMin: 8 },
  { name: '球类', icon: '⚽', color: '#ff9800', caloriesPerMin: 9 },
  { name: '跳绳', icon: '🪢', color: '#e91e63', caloriesPerMin: 11 }
];

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
    
    // 开发模式：返回模拟数据
    if (!pool || !pool.query) {
      console.log('🔧 开发模式：返回模拟运动类型');
      let types = mockSportTypes.get(familyId);
      if (!types) {
        // 初始化预设运动类型
        types = PRESET_SPORT_TYPES.map(t => ({
          id: uuidv4(),
          familyId,
          name: t.name,
          icon: t.icon,
          color: t.color,
          caloriesPerMin: t.caloriesPerMin,
          isPreset: true
        }));
        mockSportTypes.set(familyId, types);
      }
      return res.json({ success: true, data: types });
    }
    
    const result = await pool.query(
      `SELECT id, name, icon, color, calories_per_min as caloriesPerMin, 
              description, is_preset as isPreset
       FROM sport_types 
       WHERE family_id = ? 
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
    
    const id = uuidv4();
    await pool.query(
      `INSERT INTO sport_types (id, family_id, name, icon, color, calories_per_min)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, familyId, name.trim(), icon || '🏋️', color || '#607d8b', caloriesPerMin || 5]
    );
    
    res.json({ success: true, data: {
      id,
      name: name.trim(),
      icon: icon || '🏋️',
      color: color || '#607d8b',
      caloriesPerMin: caloriesPerMin || 5,
      isPreset: false
    }});
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
      'SELECT is_preset FROM sport_types WHERE id = ? AND family_id = ?',
      [typeId, familyId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '运动类型不存在' });
    }
    
    if (checkResult.rows[0].is_preset) {
      return res.status(400).json({ success: false, message: '预设类型不能删除' });
    }
    
    await pool.query(
      'DELETE FROM sport_types WHERE id = ? AND family_id = ?',
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
    
    const id = uuidv4();
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO sport_records 
       (id, user_id, family_id, sport_type_id, sport_type, icon, color, duration, calories, steps, remark, record_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, familyId, sportTypeId || null, sportType, icon || '🏃', color || '#4caf50', 
       duration, calories || 0, steps || 0, remark || null, today]
    );
    
    res.json({ success: true, data: {
      id,
      sportType,
      icon: icon || '🏃',
      color: color || '#4caf50',
      duration,
      calories: calories || 0,
      steps: steps || 0,
      remark: remark || null,
      recordDate: today
    }, message: '打卡成功' });
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
    
    // 开发模式：返回模拟数据
    if (!pool || !pool.query) {
      console.log('🔧 开发模式：返回模拟运动记录');
      const userKey = `${userId}_${familyId}`;
      let records = mockSportRecords.get(userKey) || [];
      
      // 按日期筛选
      if (date) {
        records = records.filter(r => r.recordDate === date);
      }
      
      // 分页
      records = records.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
      return res.json({ success: true, data: records });
    }
    
    let query = `
      SELECT sr.id, sr.sport_type as sportType, sr.icon, sr.color, 
             sr.duration, sr.calories, sr.steps, sr.remark,
             sr.record_date as recordDate, sr.created_at as createdAt
      FROM sport_records sr
      WHERE sr.user_id = ? AND sr.family_id = ?
    `;
    const params = [userId, familyId];
    
    if (date) {
      query += ` AND sr.record_date = ?`;
      params.push(date);
    }
    
    query += ` ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`;
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
    
    // 开发模式：返回模拟数据
    if (!pool || !pool.query) {
      console.log('🔧 开发模式：返回模拟周统计');
      return res.json({
        success: true,
        data: {
          totalDays: 0,
          totalMinutes: 0,
          totalCalories: 0,
          continuousDays: 0,
          checkedDates: []
        }
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
         COUNT(DISTINCT record_date) as totalDays,
         COALESCE(SUM(duration), 0) as totalMinutes,
         COALESCE(SUM(calories), 0) as totalCalories
       FROM sport_records 
       WHERE user_id = ? AND family_id = ? AND record_date >= ?`,
      [userId, familyId, monday.toISOString().split('T')[0]]
    );
    
    // 获取本周已打卡日期
    const checkedDatesResult = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(record_date, '%Y-%m-%d') as date
       FROM sport_records 
       WHERE user_id = ? AND family_id = ? AND record_date >= ?
       ORDER BY date`,
      [userId, familyId, monday.toISOString().split('T')[0]]
    );
    
    // 连续打卡天数简化计算（MySQL兼容）
    const continuousDays = 0; // 简化处理，后续可优化
    
    const stats = weekStatsResult.rows[0];
    const checkedDates = checkedDatesResult.rows.map(r => r.date);
    
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
 * 解密微信数据
 */
const decryptWxData = (sessionKey, encryptedData, iv) => {
  try {
    const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
    const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer);
    decipher.setAutoPadding(true);
    
    let decoded = decipher.update(encryptedDataBuffer, 'binary', 'utf8');
    decoded += decipher.final('utf8');
    
    return JSON.parse(decoded);
  } catch (error) {
    console.error('解密微信数据失败:', error);
    return null;
  }
};

/**
 * 同步微信运动步数
 */
const syncSteps = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    const { code, encryptedData, iv } = req.body;
    
    console.log('[syncSteps] 开始同步, userId:', userId, 'familyId:', familyId, 'hasCode:', !!code);
    
    if (!familyId) {
      return res.status(400).json({ success: false, message: '请先加入家庭' });
    }
    
    if (!encryptedData || !iv) {
      return res.status(400).json({ success: false, message: '缺少加密数据' });
    }
    
    if (!authService) {
      return res.status(500).json({ success: false, message: '认证服务未初始化' });
    }
    
    let sessionKey = null;
    let sessionKeySource = 'none';
    
    // 如果前端传了 code，实时获取最新的 session_key（推荐方式）
    if (code) {
      try {
        console.log('[syncSteps] 尝试用 code 获取 session_key...');
        const wxResult = await authService.getWxOpenId(code);
        sessionKey = wxResult.sessionKey;
        sessionKeySource = 'realtime';
        // 同时更新数据库中的 session_key
        if (sessionKey) {
          await authService.updateSessionKey(userId, sessionKey);
          console.log('[syncSteps] session_key 获取成功并已更新到数据库');
        }
      } catch (wxError) {
        console.error('[syncSteps] 实时获取 session_key 失败:', wxError.message);
        // 返回具体错误信息
        return res.status(400).json({ 
          success: false, 
          message: '获取session_key失败: ' + wxError.message 
        });
      }
    }
    
    // 如果没有传 code 或实时获取失败，尝试使用数据库中保存的 session_key
    if (!sessionKey) {
      sessionKey = await authService.getSessionKey(userId);
      sessionKeySource = 'database';
      console.log('[syncSteps] 从数据库获取 session_key, 结果:', sessionKey ? '有' : '无');
    }
    
    if (!sessionKey) {
      console.log('[syncSteps] 未找到 session_key');
      return res.status(400).json({ success: false, message: '请重新登录后再同步' });
    }
    
    // 解密微信运动数据
    console.log('[syncSteps] 开始解密数据, sessionKeySource:', sessionKeySource);
    const wxData = decryptWxData(sessionKey, encryptedData, iv);
    
    if (!wxData) {
      console.log('[syncSteps] 解密失败, wxData 为 null');
      return res.status(400).json({ 
        success: false, 
        message: '数据解密失败(session_key可能已过期)，请退出小程序后重新进入再试' 
      });
    }
    
    if (!wxData.stepInfoList || wxData.stepInfoList.length === 0) {
      console.log('[syncSteps] 解密成功但无步数数据, wxData:', JSON.stringify(wxData));
      return res.status(400).json({ success: false, message: '未获取到步数数据' });
    }
    
    // 获取今日步数（stepInfoList 最后一条是今天的数据）
    const todayData = wxData.stepInfoList[wxData.stepInfoList.length - 1];
    const todaySteps = todayData.step || 0;
    console.log('[syncSteps] 解密成功，今日步数:', todaySteps);
    
    // 保存或更新今日步数 (MySQL用ON DUPLICATE KEY UPDATE)
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO step_records (id, user_id, family_id, steps, record_date)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE steps = VALUES(steps), updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), userId, familyId, todaySteps, today]
    );
    
    console.log('[syncSteps] 同步完成');
    res.json({
      success: true,
      data: {
        todaySteps,
        syncTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[syncSteps] 同步步数异常:', error);
    res.status(500).json({ success: false, message: '同步步数失败: ' + error.message });
  }
};

/**
 * 获取今日步数
 */
const getTodaySteps = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 开发模式：返回模拟数据
    if (!pool || !pool.query) {
      console.log('🔧 开发模式：返回模拟步数');
      const today = new Date().toISOString().split('T')[0];
      const stepRecord = mockStepRecords.get(`${userId}_${today}`);
      return res.json({
        success: true,
        data: {
          steps: stepRecord?.steps || 0,
          pointsRedeemed: stepRecord?.pointsRedeemed || false
        }
      });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT steps, points_redeemed as pointsRedeemed FROM step_records 
       WHERE user_id = ? AND record_date = ?`,
      [userId, today]
    );
    
    res.json({
      success: true,
      data: {
        steps: result.rows[0]?.steps || 0,
        pointsRedeemed: result.rows[0]?.points_redeemed || false
      }
    });
  } catch (error) {
    console.error('获取步数失败:', error);
    res.status(500).json({ success: false, message: '获取步数失败' });
  }
};

/**
 * 步数兑换积分
 * 规则：每5000步可兑换50积分，每天只能兑换一次
 */
const redeemStepsPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    
    if (!familyId) {
      return res.status(400).json({ success: false, message: '请先加入家庭' });
    }
    
    // 获取今日步数记录
    const today = new Date().toISOString().split('T')[0];
    const stepRecord = await pool.query(
      `SELECT id, steps, points_redeemed FROM step_records 
       WHERE user_id = ? AND record_date = ?`,
      [userId, today]
    );
    
    if (stepRecord.rows.length === 0) {
      return res.status(400).json({ success: false, message: '今日还没有步数记录，请先同步步数' });
    }
    
    const record = stepRecord.rows[0];
    
    // 检查是否已兑换
    if (record.points_redeemed) {
      return res.status(400).json({ success: false, message: '今日已兑换过积分' });
    }
    
    // 检查步数是否达标
    const requiredSteps = 5000;
    const rewardPoints = 50;
    
    if (record.steps < requiredSteps) {
      return res.status(400).json({ 
        success: false, 
        message: `步数不足，需要${requiredSteps}步才能兑换，当前${record.steps}步`
      });
    }
    
    // 开始事务：更新兑换状态并添加积分
    const client = await pool.getClient();
    try {
      await client.query('BEGIN');
      
      // 更新步数记录为已兑换
      await client.query(
        `UPDATE step_records SET points_redeemed = true, redeemed_at = NOW() 
         WHERE id = ?`,
        [record.id]
      );
      
      // 添加积分记录
      await client.query(
        `INSERT INTO point_transactions (id, user_id, family_id, points, type, description, created_at)
         VALUES (?, ?, ?, ?, 'earn', ?, NOW())`,
        [uuidv4(), userId, familyId, rewardPoints, `运动达标奖励（${record.steps}步）`]
      );
      
      // 更新用户总积分（如果有积分汇总表）
      // 这里假设积分是通过 point_transactions 表计算的
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `恭喜！成功兑换${rewardPoints}积分`,
        data: {
          points: rewardPoints,
          steps: record.steps
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('兑换积分失败:', error);
    res.status(500).json({ success: false, message: '兑换积分失败: ' + error.message });
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
      'SELECT COUNT(*) FROM sport_types WHERE family_id = ?',
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
         VALUES (?, ?, ?, ?, ?, true)`,
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
  initDefaultTypes,
  redeemStepsPoints
};

