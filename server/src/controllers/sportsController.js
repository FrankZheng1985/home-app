// src/controllers/sportsController.js
// 运动控制器 - 处理运动打卡相关请求

const sportsService = require('../services/sportsService');
const authService = require('../services/authService');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取运动类型列表
 */
const getTypes = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    if (!familyId) return res.json({ success: true, data: [] });

    const types = await sportsService.getSportTypes(familyId);
    return res.json({ success: true, data: types });
  } catch (error) {
    console.error('获取运动类型失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '获取运动类型失败' });
  }
};

/**
 * 创建运动类型
 */
const createType = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    const { name, icon, color, caloriesPerMin } = req.body;
    
    if (!familyId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '请先加入家庭' });
    
    const result = await sportsService.createType(familyId, { name, icon, color, caloriesPerMin });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建运动类型失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '创建失败' });
  }
};

/**
 * 删除运动类型
 */
const deleteType = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    const { typeId } = req.params;
    
    await sportsService.deleteType(typeId, familyId);
    return res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除运动类型失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * 创建运动记录
 */
const createRecord = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    if (!familyId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '请先加入家庭' });

    const result = await sportsService.createRecord(userId, familyId, req.body);
    return res.json({ success: true, data: result, message: '打卡成功' });
  } catch (error) {
    console.error('创建运动记录失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: error.message });
  }
};

/**
 * 获取运动记录
 */
const getRecords = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    const { date, limit, offset } = req.query;
    
    if (!familyId) return res.json({ success: true, data: [] });

    // 这里直接调用 Service 层的通用查询或具体方法
    const sql = `
      SELECT sr.id, sr.sport_type as "sportType", sr.icon, sr.color, 
             sr.duration, sr.calories, sr.steps, sr.remark,
             sr.created_at as "createdAt"
      FROM sport_records sr
      WHERE sr.user_id = $1 AND sr.family_id = $2
    `;
    const params = [userId, familyId];
    let query = sql;
    if (date) {
      query += ` AND sr.created_at::date = $3`;
      params.push(date);
    }
    query += ` ORDER BY sr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit || 20), parseInt(offset || 0));

    const result = await sportsService.queryMany(query, params);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取运动记录失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '获取运动记录失败' });
  }
};

/**
 * 获取本周统计
 */
const getWeekStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    if (!familyId) return res.json({ success: true, data: { totalDays: 0, totalMinutes: 0, checkedDates: [] } });

    const stats = await sportsService.getWeekStats(userId, familyId);
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取周统计失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '获取统计失败' });
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

    if (!familyId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '请先加入家庭' });
    if (!encryptedData || !iv) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '缺少加密数据' });

    let sessionKey = null;
    if (code) {
      const wxResult = await authService.getWxOpenId(code);
      sessionKey = wxResult.sessionKey;
      if (sessionKey) await authService.updateSessionKey(userId, sessionKey);
    }

    if (!sessionKey) sessionKey = await authService.getSessionKey(userId);
    if (!sessionKey) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '请重新登录后再同步' });

    const result = await sportsService.syncSteps(userId, familyId, encryptedData, iv, sessionKey);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('同步步数异常:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '同步失败: ' + error.message });
  }
};

/**
 * 获取今日步数
 */
const getTodaySteps = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    if (!sportsService.isDatabaseAvailable()) {
      const stepKey = `${userId}_${today}`;
      const record = global.mockStepRecords?.get(stepKey);
      return res.json({
        success: true,
        data: {
          steps: record?.steps || 0,
          pointsRedeemed: record?.pointsRedeemed || false
        }
      });
    }

    const result = await sportsService.queryOne(
      `SELECT steps, points_redeemed as "pointsRedeemed" FROM step_records 
       WHERE user_id = $1 AND record_date = $2`,
      [userId, today]
    );
    
    return res.json({
      success: true,
      data: {
        steps: result?.steps || 0,
        pointsRedeemed: result?.pointsRedeemed || false
      }
    });
  } catch (error) {
    console.error('获取步数失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '获取步数失败' });
  }
};

/**
 * 步数兑换积分
 */
const redeemStepsPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const familyId = req.user.familyId;
    if (!familyId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '请先加入家庭' });

    const result = await sportsService.redeemStepsPoints(userId, familyId);
    return res.json({ success: true, message: `成功兑换${result.points}积分`, data: result });
  } catch (error) {
    console.error('兑换积分失败:', error);
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

/**
 * 初始化默认运动类型
 */
const initDefaultTypes = async (req, res) => {
  try {
    const familyId = req.user.familyId;
    if (!familyId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: '请先加入家庭' });

    const result = await sportsService.initDefaultTypes(familyId);
    return res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('初始化运动类型失败:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ success: false, message: '初始化失败' });
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
  redeemStepsPoints,
  initDefaultTypes
};
