// src/services/sportsService.js
// 运动服务层 - 处理运动打卡及步数兑换逻辑 (PostgreSQL 版本)

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');
const crypto = require('crypto');

// 开发模式下的模拟数据
const mockSportTypes = global.mockSportTypes || (global.mockSportTypes = new Map());
const mockSportRecords = global.mockSportRecords || (global.mockSportRecords = new Map());
const mockStepRecords = global.mockStepRecords || (global.mockStepRecords = new Map());

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

class SportsService extends BaseService {
  /**
   * 获取运动类型列表
   */
  async getSportTypes(familyId) {
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟运动类型');
      let types = mockSportTypes.get(familyId);
      if (!types) {
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
      return types;
    }

    const sql = `
      SELECT id, name, icon, color, calories_per_min as "caloriesPerMin", 
             description, is_preset as "isPreset"
      FROM sport_types 
      WHERE family_id = $1 
      ORDER BY is_preset DESC, created_at ASC
    `;
    const result = await this.queryMany(sql, [familyId]);
    return result;
  }

  /**
   * 初始化默认运动类型
   */
  async initDefaultTypes(familyId) {
    if (!this.isDatabaseAvailable()) {
      return { message: '模拟模式下无需初始化' };
    }
    
    const existing = await this.queryOne('SELECT COUNT(*) FROM sport_types WHERE family_id = $1', [familyId]);
    if (parseInt(existing.count) > 0) return { message: '已有类型' };
    
    for (const type of PRESET_SPORT_TYPES) {
      await this.insert('sport_types', {
        id: uuidv4(),
        family_id: familyId,
        name: type.name,
        icon: type.icon,
        color: type.color,
        calories_per_min: type.caloriesPerMin,
        is_preset: true
      });
    }
    return { message: '初始化成功' };
  }

  /**
   * 创建运动类型
   */
  async createType(familyId, data) {
    const { name, icon, color, caloriesPerMin } = data;
    const id = uuidv4();
    
    await this.insert('sport_types', {
      id,
      family_id: familyId,
      name: name.trim(),
      icon: icon || '🏋️',
      color: color || '#607d8b',
      calories_per_min: caloriesPerMin || 5,
      is_preset: false
    });
    
    return { id, name, icon, color, caloriesPerMin, isPreset: false };
  }

  /**
   * 删除运动类型
   */
  async deleteType(typeId, familyId) {
    const checkResult = await this.queryOne(
      'SELECT is_preset FROM sport_types WHERE id = $1 AND family_id = $2',
      [typeId, familyId]
    );
    
    if (!checkResult) throw new Error('运动类型不存在');
    if (checkResult.is_preset) throw new Error('预设类型不能删除');
    
    await this.query('DELETE FROM sport_types WHERE id = $1 AND family_id = $2', [typeId, familyId]);
    return true;
  }

  /**
   * 创建运动记录
   */
  async createRecord(userId, familyId, data) {
    const { sportTypeId, sportType, icon, color, duration, calories, steps, remark } = data;
    const id = uuidv4();
    const today = new Date().toISOString().split('T')[0];

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：保存模拟运动记录');
      const userKey = `${userId}_${familyId}`;
      const records = mockSportRecords.get(userKey) || [];
      const newRecord = {
        id, userId, familyId, sportTypeId, sportType, icon, color, duration, calories, steps, remark,
        recordDate: today,
        createdAt: new Date().toISOString()
      };
      records.unshift(newRecord);
      mockSportRecords.set(userKey, records);
      return newRecord;
    }

    await this.insert('sport_records', {
      id,
      user_id: userId,
      family_id: familyId,
      sport_type_id: sportTypeId || null,
      sport_type: sportType,
      icon: icon || '🏃',
      color: color || '#4caf50',
      duration,
      calories: calories || 0,
      steps: steps || 0,
      remark: remark || null
    });

    return { id, sportType, duration, recordDate: today };
  }

  /**
   * 同步微信步数
   */
  async syncSteps(userId, familyId, encryptedData, iv, sessionKey) {
    // 检查是否是模拟模式的 sessionKey
    if (sessionKey === 'dev_session_key') {
      logger.info('🔧 开发模式：使用模拟步数同步（跳过解密）');
      const todaySteps = Math.floor(Math.random() * 10000) + 2000; // 模拟 2000-12000 步
      const today = new Date().toISOString().split('T')[0];
      
      if (this.isDatabaseAvailable()) {
        const sql = `
          INSERT INTO step_records (id, user_id, family_id, steps, record_date)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id, record_date) 
          DO UPDATE SET steps = EXCLUDED.steps, updated_at = CURRENT_TIMESTAMP
        `;
        await this.query(sql, [uuidv4(), userId, familyId, todaySteps, today]);
      } else {
        const stepKey = `${userId}_${today}`;
        const existing = mockStepRecords.get(stepKey) || { pointsRedeemed: false };
        mockStepRecords.set(stepKey, {
          ...existing,
          id: uuidv4(),
          userId,
          familyId,
          steps: todaySteps,
          recordDate: today,
          updatedAt: new Date()
        });
      }
      return { todaySteps };
    }

    const wxData = this.decryptWxData(sessionKey, encryptedData, iv);
    if (!wxData || !wxData.stepInfoList) {
      throw new Error('微信数据解密失败');
    }

    const todayData = wxData.stepInfoList[wxData.stepInfoList.length - 1];
    const todaySteps = todayData.step || 0;
    const today = new Date().toISOString().split('T')[0];

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：保存模拟步数', { todaySteps });
      const stepKey = `${userId}_${today}`;
      const existing = mockStepRecords.get(stepKey) || { pointsRedeemed: false };
      mockStepRecords.set(stepKey, {
        ...existing,
        id: uuidv4(),
        userId,
        familyId,
        steps: todaySteps,
        recordDate: today,
        updatedAt: new Date()
      });
      return { todaySteps };
    }

    const sql = `
      INSERT INTO step_records (id, user_id, family_id, steps, record_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, record_date) 
      DO UPDATE SET steps = EXCLUDED.steps, updated_at = CURRENT_TIMESTAMP
    `;
    await this.query(sql, [uuidv4(), userId, familyId, todaySteps, today]);

    return { todaySteps };
  }

  /**
   * 步数兑换积分
   */
  async redeemStepsPoints(userId, familyId) {
    const today = new Date().toISOString().split('T')[0];
    const requiredSteps = 5000;
    const rewardPoints = 50;

    if (!this.isDatabaseAvailable()) {
      const stepKey = `${userId}_${today}`;
      const record = mockStepRecords.get(stepKey);
      
      if (!record) throw new Error('今日还没有步数记录，请先同步步数');
      if (record.steps < requiredSteps) throw new Error(`步数不足${requiredSteps}步`);
      if (record.pointsRedeemed) throw new Error('今日已兑换过积分');

      record.pointsRedeemed = true;
      record.redeemedAt = new Date();
      mockStepRecords.set(stepKey, record);

      const pointsService = require('./pointsService');
      await pointsService.createTransaction({
        userId,
        familyId,
        points: rewardPoints,
        type: 'earn',
        description: `运动步数达标奖励（${record.steps}步）`
      });

      return { points: rewardPoints, steps: record.steps };
    }

    const record = await this.queryOne(
      'SELECT id, steps, points_redeemed FROM step_records WHERE user_id = $1 AND record_date = $2',
      [userId, today]
    );

    if (!record) throw new Error('今日还没有步数记录，请先同步步数');
    if (record.steps < requiredSteps) throw new Error(`步数不足${requiredSteps}步`);
    if (record.points_redeemed) throw new Error('今日已兑换过积分');

    const pointsService = require('./pointsService');
    await this.transaction(async (client) => {
      await client.query('UPDATE step_records SET points_redeemed = true, redeemed_at = NOW() WHERE id = $1', [record.id]);
      await pointsService.createTransaction({
        userId,
        familyId,
        points: rewardPoints,
        type: 'earn',
        description: `运动步数达标奖励（${record.steps}步）`
      }, client);
    });

    return { points: rewardPoints, steps: record.steps };
  }

  /**
   * 获取统计数据
   */
  async getWeekStats(userId, familyId) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    if (!this.isDatabaseAvailable()) {
      return { totalDays: 0, totalMinutes: 0, totalCalories: 0, continuousDays: 0, checkedDates: [] };
    }

    const statsSql = `
      SELECT 
         COUNT(DISTINCT created_at::date) as "totalDays",
         COALESCE(SUM(duration), 0) as "totalMinutes",
         COALESCE(SUM(calories), 0) as "totalCalories"
       FROM sport_records 
       WHERE user_id = $1 AND family_id = $2 AND created_at >= $3
    `;
    const stats = await this.queryOne(statsSql, [userId, familyId, monday]);

    const datesSql = `
      SELECT DISTINCT created_at::date as date
      FROM sport_records 
      WHERE user_id = $1 AND family_id = $2 AND created_at >= $3
      ORDER BY date
    `;
    const dates = await this.queryMany(datesSql, [userId, familyId, monday]);

    return {
      totalDays: parseInt(stats.totalDays) || 0,
      totalMinutes: parseInt(stats.totalMinutes) || 0,
      totalCalories: parseInt(stats.totalCalories) || 0,
      continuousDays: 0,
      checkedDates: dates.map(r => r.date.toISOString().split('T')[0])
    };
  }

  decryptWxData(sessionKey, encryptedData, iv) {
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
      logger.error('解密微信数据失败:', error.message);
      return null;
    }
  }
}

module.exports = new SportsService();
