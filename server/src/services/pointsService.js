// src/services/pointsService.js
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const logger = require('../utils/logger');
const { TRANSACTION_TYPE } = require('../constants/statusCodes');

// 开发模式下的模拟数据
const mockTransactions = global.mockPointTransactions || (global.mockPointTransactions = []);
const mockRedeemRequests = global.mockRedeemRequests || (global.mockRedeemRequests = []);

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

      // 计算待审核积分
      const pendingPoints = mockRedeemRequests
        .filter(r => r.familyId === familyId && r.userId === userId && r.status === 'pending')
        .reduce((sum, r) => sum + r.points, 0);

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
        pendingPoints,
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

    // 获取待审核积分
    const pendingSql = `
      SELECT COALESCE(SUM(points), 0) as pending_points
      FROM point_redeem_requests 
      WHERE family_id = $1 AND user_id = $2 AND status = 'pending'
    `;
    const pendingRes = await this.queryOne(pendingSql, [familyId, userId]);
    const pendingPoints = parseInt(pendingRes.pending_points) || 0;

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
      pendingPoints,
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

  /**
   * 提交兑现申请
   */
  async submitRedeemRequest(data) {
    const { userId, familyId, points, remark, isAdmin } = data;
    const id = uuidv4();
    
    // 获取积分价值
    let pointsValue = 0.5;
    if (this.isDatabaseAvailable()) {
      const family = await this.queryOne('SELECT points_value FROM families WHERE id = $1', [familyId]);
      pointsValue = parseFloat(family?.points_value || 0.5);
    }
    const amount = (points * pointsValue).toFixed(2);

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：提交模拟兑现申请', { userId, points, isAdmin });
      const request = {
        id,
        userId,
        familyId,
        points,
        amount,
        status: isAdmin ? 'approved' : 'pending',
        remark,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (isAdmin) {
        request.reviewedBy = userId;
        request.reviewedAt = new Date();
        
        // 管理员自动通过，创建积分交易
        await this.createTransaction({
          userId,
          familyId,
          points: -Math.abs(points),
          type: TRANSACTION_TYPE.REDEEM,
          description: `积分兑现 - ¥${amount}`
        });
      }
      
      mockRedeemRequests.push(request);
      return { ...request, autoApproved: isAdmin };
    }

    if (isAdmin) {
      // 管理员自动通过
      await this.transaction(async (client) => {
        await client.query(
          `INSERT INTO point_redeem_requests 
           (id, user_id, family_id, points, amount, status, remark, reviewed_by, reviewed_at, created_at)
           VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [id, userId, familyId, points, amount, remark || '', userId]
        );

        await this.createTransaction({
          userId,
          familyId,
          points: -Math.abs(points),
          type: TRANSACTION_TYPE.REDEEM,
          description: `积分兑现 - ¥${amount}`
        }, client);
      });

      return { id, points, amount, autoApproved: true };
    } else {
      // 普通成员待审核
      await this.query(
        `INSERT INTO point_redeem_requests 
         (id, user_id, family_id, points, amount, status, remark, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, CURRENT_TIMESTAMP)`,
        [id, userId, familyId, points, amount, remark || '']
      );

      return { id, points, amount, autoApproved: false };
    }
  }

  /**
   * 获取兑现申请列表
   */
  async getRedeemRequests(params) {
    const { familyId, userId, isAdmin, status, page = 1, pageSize = 20 } = params;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：获取模拟兑现申请列表');
      let filtered = mockRedeemRequests.filter(r => r.familyId === familyId);
      
      if (!isAdmin) {
        filtered = filtered.filter(r => r.userId === userId);
      }
      
      if (status) {
        filtered = filtered.filter(r => r.status === status);
      }

      const total = filtered.length;
      const result = filtered
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(offset, offset + parseInt(pageSize));

      // 补充用户信息
      const mockUsers = global.mockUsers || new Map();
      const enriched = result.map(r => {
        let nickname = '模拟用户';
        let avatarUrl = '';
        for (const [openid, u] of mockUsers) {
          if (u.id === r.userId) {
            nickname = u.nickname;
            avatarUrl = u.avatar_url;
            break;
          }
        }
        return {
          ...r,
          user: { nickname, avatarUrl }
        };
      });

      return { data: enriched, total };
    }

    let whereClause = 'r.family_id = $1';
    const values = [familyId];

    if (!isAdmin) {
      whereClause += ' AND r.user_id = $2';
      values.push(userId);
    }

    if (status) {
      whereClause += ` AND r.status = $${values.length + 1}`;
      values.push(status);
    }

    const countSql = `SELECT COUNT(*) as total FROM point_redeem_requests r WHERE ${whereClause}`;
    const countRes = await this.queryOne(countSql, values);

    const listSql = `
      SELECT r.*, 
             u.nickname as user_nickname, u.avatar_url as user_avatar,
             ru.nickname as reviewer_nickname
      FROM point_redeem_requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users ru ON r.reviewed_by = ru.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const result = await this.queryMany(listSql, [...values, parseInt(pageSize), offset]);

    return {
      data: result.map(row => ({
        id: row.id,
        userId: row.user_id,
        user: {
          nickname: row.user_nickname,
          avatarUrl: row.user_avatar
        },
        points: row.points,
        amount: parseFloat(row.amount),
        status: row.status,
        remark: row.remark,
        rejectReason: row.reject_reason,
        reviewedBy: row.reviewed_by,
        reviewerNickname: row.reviewer_nickname,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at
      })),
      total: parseInt(countRes.total)
    };
  }

  /**
   * 审核兑现申请
   */
  async reviewRedeemRequest(params) {
    const { requestId, adminId, action, rejectReason } = params;

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：审核模拟兑现申请', { requestId, action });
      const index = mockRedeemRequests.findIndex(r => r.id === requestId);
      if (index === -1) throw new Error('申请不存在');
      
      const request = mockRedeemRequests[index];
      if (request.status !== 'pending') throw new Error('该申请已被处理');

      if (action === 'approve') {
        request.status = 'approved';
        // 创建积分交易
        await this.createTransaction({
          userId: request.userId,
          familyId: request.familyId,
          points: -Math.abs(request.points),
          type: TRANSACTION_TYPE.REDEEM,
          description: `积分兑现 - ¥${request.amount}`
        });
      } else {
        request.status = 'rejected';
        request.rejectReason = rejectReason;
      }

      request.reviewedBy = adminId;
      request.reviewedAt = new Date();
      request.updatedAt = new Date();

      return { success: true };
    }

    const request = await this.queryOne('SELECT * FROM point_redeem_requests WHERE id = $1', [requestId]);
    if (!request) throw new Error('申请不存在');
    if (request.status !== 'pending') throw new Error('该申请已被处理');

    if (action === 'approve') {
      await this.transaction(async (client) => {
        await this.createTransaction({
          userId: request.user_id,
          familyId: request.family_id,
          points: -Math.abs(request.points),
          type: TRANSACTION_TYPE.REDEEM,
          description: `积分兑现 - ¥${request.amount}`
        }, client);

        await client.query(
          `UPDATE point_redeem_requests 
           SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [adminId, requestId]
        );
      });
    } else {
      await this.query(
        `UPDATE point_redeem_requests 
         SET status = 'rejected', reject_reason = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [rejectReason, adminId, requestId]
      );
    }

    return { success: true };
  }

  /**
   * 获取待审核数量
   */
  async getPendingRedeemCount(familyId) {
    if (!this.isDatabaseAvailable()) {
      return mockRedeemRequests.filter(r => r.familyId === familyId && r.status === 'pending').length;
    }

    const result = await this.queryOne(
      `SELECT COUNT(*) as count FROM point_redeem_requests 
       WHERE family_id = $1 AND status = 'pending'`,
      [familyId]
    );
    return parseInt(result?.count || 0);
  }
}

module.exports = new PointsService();
