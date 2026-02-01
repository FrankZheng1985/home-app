// src/controllers/pointsController.js
const pointsService = require('../services/pointsService');
const familyService = require('../services/familyService');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取积分概览
 */
const getSummary = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户是否为家庭成员
    await familyService.validateMembership(req.user.id, familyId);

    const summary = await pointsService.getSummary(familyId, req.user.id);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('获取积分概览错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取积分概览失败' });
  }
};

/**
 * 获取积分记录
 */
const getTransactions = async (req, res) => {
  const { familyId, type, limit = 20, offset = 0 } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户是否为家庭成员
    await familyService.validateMembership(req.user.id, familyId);

    let sql = `
      SELECT id, points, type, description, created_at as "createdAt"
      FROM point_transactions 
      WHERE family_id = $1 AND user_id = $2
    `;
    const params = [familyId, req.user.id];

    if (type) {
      sql += ` AND type = $3`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pointsService.queryMany(sql, params);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取积分记录错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取积分记录失败' });
  }
};

/**
 * 获取月度统计
 */
const getMonthStats = async (req, res) => {
  const { familyId, month } = req.query;

  if (!familyId || !month) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少参数' });
  }

  try {
    // 验证用户是否为家庭成员
    await familyService.validateMembership(req.user.id, familyId);

    // 解析月份
    const [year, mon] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(mon) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(mon), 0, 23, 59, 59, 999);

    // 获取月度获得积分
    const earnedSql = `
      SELECT COALESCE(SUM(points), 0) as total
      FROM point_transactions 
      WHERE family_id = $1 AND user_id = $2 AND type = 'earn' 
      AND created_at >= $3 AND created_at <= $4
    `;
    const earnedResult = await pointsService.queryOne(earnedSql, [familyId, req.user.id, startDate.toISOString(), endDate.toISOString()]);

    // 获取月度兑现积分
    const redeemedSql = `
      SELECT COALESCE(SUM(points), 0) as total
      FROM point_transactions 
      WHERE family_id = $1 AND user_id = $2 AND type = 'redeem' 
      AND created_at >= $3 AND created_at <= $4
    `;
    const redeemedResult = await pointsService.queryOne(redeemedSql, [familyId, req.user.id, startDate.toISOString(), endDate.toISOString()]);

    // 计算月末余额
    const balanceSql = `
      SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -ABS(points) END), 0) as total
      FROM point_transactions 
      WHERE family_id = $1 AND user_id = $2 AND created_at <= $3
    `;
    const balanceResult = await pointsService.queryOne(balanceSql, [familyId, req.user.id, endDate.toISOString()]);

    return res.json({
      success: true,
      data: {
        earned: Math.abs(parseInt(earnedResult.total)),
        redeemed: Math.abs(parseInt(redeemedResult.total)),
        balance: parseInt(balanceResult.total)
      }
    });
  } catch (error) {
    console.error('获取月度统计错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取月度统计失败' });
  }
};

/**
 * 获取成员积分列表
 */
const getMembersPoints = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户是否为管理员
    await familyService.validateAdminRole(req.user.id, familyId);

    // 获取所有成员及其积分
    const sql = `
      SELECT fm.id, fm.user_id as "userId", fm.role, u.nickname, u.avatar_url as "avatarUrl",
             COALESCE(SUM(CASE WHEN pt.type = 'earn' THEN pt.points ELSE 0 END), 0) as total_earned,
             COALESCE(SUM(CASE WHEN pt.type = 'redeem' THEN ABS(pt.points) ELSE 0 END), 0) as total_redeemed
      FROM family_members fm
      JOIN users u ON fm.user_id = u.id
      LEFT JOIN point_transactions pt ON pt.user_id = fm.user_id AND pt.family_id = fm.family_id
      WHERE fm.family_id = $1
      GROUP BY fm.id, fm.user_id, fm.role, u.nickname, u.avatar_url
      ORDER BY (COALESCE(SUM(CASE WHEN pt.type = 'earn' THEN pt.points ELSE 0 END), 0) - 
                COALESCE(SUM(CASE WHEN pt.type = 'redeem' THEN ABS(pt.points) ELSE 0 END), 0)) DESC
    `;
    const result = await pointsService.queryMany(sql, [familyId]);

    return res.json({
      success: true,
      data: result.map(row => ({
        id: row.id,
        userId: row.userId,
        role: row.role,
        user: {
          nickname: row.nickname,
          avatarUrl: row.avatarUrl
        },
        totalEarned: parseInt(row.total_earned),
        totalRedeemed: parseInt(row.total_redeemed),
        availablePoints: parseInt(row.total_earned) - parseInt(row.total_redeemed)
      }))
    });
  } catch (error) {
    console.error('获取成员积分错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取成员积分失败' });
  }
};

/**
 * 积分兑现/结算
 */
const redeemPoints = async (req, res) => {
  const { familyId, memberId, points, remark } = req.body;

  if (!familyId || !memberId || !points || points <= 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '参数错误' });
  }

  try {
    // 验证操作者是否为管理员
    await familyService.validateAdminRole(req.user.id, familyId);

    // 检查目标成员的可用积分
    const statsSql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = $1 THEN points ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type = $2 THEN ABS(points) ELSE 0 END), 0) as total_redeemed
      FROM point_transactions 
      WHERE family_id = $3 AND user_id = $4
    `;
    const stats = await pointsService.queryOne(statsSql, [TRANSACTION_TYPE.EARN, TRANSACTION_TYPE.REDEEM, familyId, memberId]);

    const totalEarned = parseInt(stats.total_earned);
    const totalRedeemed = parseInt(stats.total_redeemed);
    const availablePoints = totalEarned - totalRedeemed;

    if (points > availablePoints) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: `可用积分不足，当前可用：${availablePoints}` });
    }

    // 创建兑现记录
    const result = await pointsService.createTransaction({
      userId: memberId,
      familyId,
      points: -Math.abs(points),
      type: TRANSACTION_TYPE.REDEEM,
      description: remark || '积分结算兑现'
    });

    return res.json({
      success: true,
      data: {
        id: result.id,
        points: points,
        message: '结算成功'
      }
    });
  } catch (error) {
    console.error('积分结算错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '积分结算失败' });
  }
};

/**
 * 获取积分排行榜
 */
const getRanking = async (req, res) => {
  const { familyId, period = 'all' } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户是否为家庭成员
    await familyService.validateMembership(req.user.id, familyId);

    const ranking = await pointsService.getRanking(familyId, period);
    return res.json({ success: true, data: ranking });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取排行榜失败' });
  }
};

/**
 * 用户提交兑现申请
 */
const submitRedeemRequest = async (req, res) => {
  const { familyId, points, remark } = req.body;
  const userId = req.user.id;

  if (!familyId || !points || points <= 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '参数错误' });
  }

  try {
    // 验证用户是否为家庭成员
    await familyService.validateMembership(userId, familyId);

    // 检查用户可用积分
    const statsSql = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = $1 THEN points ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type = $2 THEN ABS(points) ELSE 0 END), 0) as total_redeemed
      FROM point_transactions 
      WHERE family_id = $3 AND user_id = $4
    `;
    const stats = await pointsService.queryOne(statsSql, [TRANSACTION_TYPE.EARN, TRANSACTION_TYPE.REDEEM, familyId, userId]);

    const totalEarned = parseInt(stats.total_earned);
    const totalRedeemed = parseInt(stats.total_redeemed);
    const availablePoints = totalEarned - totalRedeemed;

    // 检查是否有待审核的申请
    const pendingSql = `
      SELECT COALESCE(SUM(points), 0) as pending_points
      FROM point_redeem_requests 
      WHERE family_id = $1 AND user_id = $2 AND status = 'pending'
    `;
    const pendingRes = await pointsService.queryOne(pendingSql, [familyId, userId]);
    const pendingPoints = parseInt(pendingRes.pending_points) || 0;

    if (points > availablePoints - pendingPoints) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        error: `可用积分不足，当前可申请：${availablePoints - pendingPoints}` 
      });
    }

    // 获取积分价值
    const family = await pointsService.queryOne('SELECT points_value FROM families WHERE id = $1', [familyId]);
    const pointsValue = parseFloat(family?.points_value || 0.5);
    const amount = (points * pointsValue).toFixed(2);

    // 检查用户是否是管理员
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);

    const requestId = uuidv4();
    if (isAdmin) {
      // 管理员自动通过
      await pointsService.transaction(async (client) => {
        await client.query(
          `INSERT INTO point_redeem_requests 
           (id, user_id, family_id, points, amount, status, remark, reviewed_by, reviewed_at, created_at)
           VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [requestId, userId, familyId, points, amount, remark || '', userId]
        );

        await pointsService.createTransaction({
          userId,
          familyId,
          points: -Math.abs(points),
          type: TRANSACTION_TYPE.REDEEM,
          description: `积分兑现 - ¥${amount}`
        }, client);
      });

      return res.json({
        success: true,
        data: {
          id: requestId,
          points,
          amount,
          message: '兑现成功，积分已扣减',
          autoApproved: true
        }
      });
    } else {
      // 普通成员待审核
      await pointsService.query(
        `INSERT INTO point_redeem_requests 
         (id, user_id, family_id, points, amount, status, remark, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, CURRENT_TIMESTAMP)`,
        [requestId, userId, familyId, points, amount, remark || '']
      );

      return res.json({
        success: true,
        data: {
          id: requestId,
          points,
          amount,
          message: '申请已提交，等待审核'
        }
      });
    }
  } catch (error) {
    console.error('提交兑现申请错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '提交申请失败' });
  }
};

/**
 * 获取兑现申请列表
 */
const getRedeemRequests = async (req, res) => {
  const { familyId, status, page = 1, pageSize = 20 } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户角色
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);

    let whereClause = 'r.family_id = $1';
    const values = [familyId];

    if (!isAdmin) {
      whereClause += ' AND r.user_id = $2';
      values.push(userId);
    }

    if (status && status !== 'undefined') {
      whereClause += ` AND r.status = $${values.length + 1}`;
      values.push(status);
    }

    const countSql = `SELECT COUNT(*) as total FROM point_redeem_requests r WHERE ${whereClause}`;
    const countRes = await pointsService.queryOne(countSql, values);

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
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
    const result = await pointsService.queryMany(listSql, [...values, parseInt(pageSize), offset]);

    return res.json({
      success: true,
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
      total: parseInt(countRes.total),
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    console.error('获取兑现申请列表错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取申请列表失败' });
  }
};

/**
 * 审核兑现申请
 */
const reviewRedeemRequest = async (req, res) => {
  const { requestId, action, rejectReason } = req.body;
  const userId = req.user.id;

  if (!requestId || !action || !['approve', 'reject'].includes(action)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '参数错误' });
  }

  try {
    const request = await pointsService.queryOne('SELECT * FROM point_redeem_requests WHERE id = $1', [requestId]);
    if (!request) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: '申请不存在' });
    }

    if (request.status !== 'pending') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '该申请已被处理' });
    }

    // 验证操作者是否为管理员
    await familyService.validateAdminRole(userId, request.family_id);

    if (action === 'approve') {
      // 再次检查可用积分
      const statsSql = `
        SELECT 
          COALESCE(SUM(CASE WHEN type = $1 THEN points ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN type = $2 THEN ABS(points) ELSE 0 END), 0) as total_redeemed
        FROM point_transactions 
        WHERE family_id = $3 AND user_id = $4
      `;
      const stats = await pointsService.queryOne(statsSql, [TRANSACTION_TYPE.EARN, TRANSACTION_TYPE.REDEEM, request.family_id, request.user_id]);
      const availablePoints = parseInt(stats.total_earned) - parseInt(stats.total_redeemed);

      if (request.points > availablePoints) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: `用户可用积分不足，当前可用：${availablePoints}` });
      }

      await pointsService.transaction(async (client) => {
        await pointsService.createTransaction({
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
          [userId, requestId]
        );
      });

      return res.json({
        success: true,
        data: {
          message: '已通过申请，积分已扣减',
          points: request.points,
          amount: parseFloat(request.amount)
        }
      });
    } else {
      if (!rejectReason) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '请填写拒绝原因' });
      }

      await pointsService.query(
        `UPDATE point_redeem_requests 
         SET status = 'rejected', reject_reason = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [rejectReason, userId, requestId]
      );

      return res.json({
        success: true,
        data: {
          message: '已拒绝申请'
        }
      });
    }
  } catch (error) {
    console.error('审核兑现申请错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '审核失败' });
  }
};

/**
 * 获取待审核兑现申请数量
 */
const getPendingRedeemCount = async (req, res) => {
  const { familyId } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    // 验证用户角色
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);
    if (!isAdmin) {
      return res.json({ success: true, data: { count: 0 } });
    }

    const result = await pointsService.queryOne(
      `SELECT COUNT(*) as count FROM point_redeem_requests 
       WHERE family_id = $1 AND status = 'pending'`,
      [familyId]
    );

    return res.json({
      success: true,
      data: {
        count: parseInt(result?.count || 0)
      }
    });
  } catch (error) {
    console.error('获取待审核数量错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取失败' });
  }
};

module.exports = {
  getSummary,
  getTransactions,
  getRanking,
  getMonthStats,
  getMembersPoints,
  redeemPoints,
  submitRedeemRequest,
  getRedeemRequests,
  reviewRedeemRequest,
  getPendingRedeemCount
};

module.exports = {
  getSummary,
  getTransactions,
  getRanking,
  getMonthStats,
  getMembersPoints,
  redeemPoints,
  submitRedeemRequest,
  getRedeemRequests,
  reviewRedeemRequest,
  getPendingRedeemCount
};
