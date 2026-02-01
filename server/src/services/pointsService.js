// src/services/pointsService.js
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const logger = require('../utils/logger');
const { TRANSACTION_TYPE } = require('../constants/statusCodes');

// 开发模式下的模拟数据
const mockTransactions = global.mockPointTransactions || (global.mockPointTransactions = []);

class PointsService extends BaseService {
  /**
   * 获取用户积分概览
   */
  async getSummary(familyId, userId) {
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟积分概览');
      
      // 从模拟交易中计算
      const userTransactions = mockTransactions.filter(t => t.familyId === familyId && t.userId === userId);
      const totalEarned = userTransactions
        .filter(t => t.type === TRANSACTION_TYPE.EARN)
        .reduce((sum, t) => sum + t.points, 0);
      const totalRedeemed = userTransactions
        .filter(t => t.type === TRANSACTION_TYPE.REDEEM)
        .reduce((sum, t) => sum + Math.abs(t.points), 0);
      
      const availablePoints = totalEarned - totalRedeemed;
      const pointsValue = 0.5;

      // 计算排名
      const familyTransactions = mockTransactions.filter(t => t.familyId === familyId);
      const userPointsMap = new Map();
      familyTransactions.forEach(t => {
        const current = userPointsMap.get(t.userId) || 0;
        userPointsMap.set(t.userId, current + (t.type === TRANSACTION_TYPE.EARN ? t.points : -Math.abs(t.points)));
      });

      const sortedUsers = Array.from(userPointsMap.entries())
        .sort((a, b) => b[1] - a[1]);
      
      const rankIndex = sortedUsers.findIndex(u => u[0] === userId);
      const rank = rankIndex === -1 ? '-' : rankIndex + 1;

      return {
        totalPoints: totalEarned,
        availablePoints,
        redeemedTotal: totalRedeemed,
        rank,
        pointsValue,
        totalValue: (availablePoints * pointsValue).toFixed(2)
      };
    }

    // 1. 获取积分统计
    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = $1 THEN points ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type = $2 THEN ABS(points) ELSE 0 END), 0) as total_redeemed
      FROM point_transactions 
      WHERE family_id = $3 AND user_id = $4
    `;
    const stats = await this.queryOne(sql, [TRANSACTION_TYPE.EARN, TRANSACTION_TYPE.REDEEM, familyId, userId]);
    
    const totalEarned = parseInt(stats.total_earned);
    const totalRedeemed = parseInt(stats.total_redeemed);
    const availablePoints = totalEarned - totalRedeemed;

    // 2. 获取家庭积分价值
    const family = await this.queryOne('SELECT points_value FROM families WHERE id = $1', [familyId]);
    const pointsValue = parseFloat(family?.points_value || 0.5);

    // 3. 计算排名
    const rankingSql = `
      SELECT user_id, 
             COALESCE(SUM(CASE WHEN type = $1 THEN points ELSE 0 END), 0) - 
             COALESCE(SUM(CASE WHEN type = $2 THEN ABS(points) ELSE 0 END), 0) as available
      FROM point_transactions
      WHERE family_id = $3
      GROUP BY user_id
      ORDER BY available DESC
    `;
    const ranking = await this.queryMany(rankingSql, [TRANSACTION_TYPE.EARN, TRANSACTION_TYPE.REDEEM, familyId]);
    
    let rank = '-';
    ranking.forEach((row, index) => {
      if (row.user_id === userId) {
        rank = index + 1;
      }
    });

    return {
      totalPoints: totalEarned,
      availablePoints,
      redeemedTotal: totalRedeemed,
      rank,
      pointsValue,
      totalValue: (availablePoints * pointsValue).toFixed(2)
    };
  }

  /**
   * 获取积分排行榜
   */
  async getRanking(familyId, period = 'all') {
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟积分排行榜');
      
      const familyTransactions = mockTransactions.filter(t => t.familyId === familyId);
      const userMap = new Map();
      
      // 获取模拟用户信息
      const mockUsers = global.mockUsers || new Map();
      
      familyTransactions.forEach(t => {
        if (!userMap.has(t.userId)) {
          let nickname = '模拟用户';
          let avatarUrl = '';
          
          for (const [openid, u] of mockUsers) {
            if (u.id === t.userId) {
              nickname = u.nickname;
              avatarUrl = u.avatar_url;
              break;
            }
          }
          
          userMap.set(t.userId, {
            userId: t.userId,
            nickname,
            avatarUrl,
            totalPoints: 0,
            totalRecords: 0
          });
        }
        
        const userData = userMap.get(t.userId);
        userData.totalPoints += (t.type === TRANSACTION_TYPE.EARN ? t.points : -Math.abs(t.points));
        userData.totalRecords += 1;
      });

      const pointsValue = 0.5;
      return Array.from(userMap.values())
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((u, index) => ({
          rank: index + 1,
          ...u,
          totalValue: (u.totalPoints * pointsValue).toFixed(2)
        }));
    }

    // 构建时间条件
    let timeCondition = '';
    const values = [familyId, familyId];

    if (period === 'week') {
      timeCondition = "AND pt.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      timeCondition = "AND pt.created_at >= date_trunc('month', CURRENT_DATE)";
    }

    const sql = `
      SELECT u.id, u.nickname, u.avatar_url as "avatarUrl",
             COALESCE(SUM(pt.points), 0) as total_points,
             COUNT(pt.id) as total_records
      FROM family_members fm
      JOIN users u ON fm.user_id = u.id
      LEFT JOIN point_transactions pt ON pt.user_id = u.id AND pt.family_id = $1 ${timeCondition}
      WHERE fm.family_id = $2
      GROUP BY u.id, u.nickname, u.avatar_url
      ORDER BY total_points DESC
    `;
    const result = await this.queryMany(sql, values);

    // 获取家庭积分价值
    const family = await this.queryOne('SELECT points_value FROM families WHERE id = $1', [familyId]);
    const pointsValue = parseFloat(family?.points_value || 0.5);

    return result.map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      totalPoints: parseInt(row.total_points),
      totalRecords: parseInt(row.total_records),
      totalValue: (parseInt(row.total_points) * pointsValue).toFixed(2)
    }));
  }

  /**
   * 创建积分交易
   */
  async createTransaction(data, client = null) {
    const { userId, familyId, points, type, description } = data;
    const id = uuidv4();
    
    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：创建模拟积分交易', { userId, points, type });
      mockTransactions.push({
        id,
        userId,
        familyId,
        points,
        type,
        description,
        createdAt: new Date()
      });
      return { id, userId, points, type };
    }

    const sql = `
      INSERT INTO point_transactions (id, user_id, family_id, points, type, description, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
    const params = [id, userId, familyId, points, type, description];

    if (client) {
      await client.query(sql, params);
    } else {
      await this.query(sql, params);
    }

    return { id, userId, points, type };
  }
}

module.exports = new PointsService();
