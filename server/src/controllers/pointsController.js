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
    const summary = await pointsService.getSummary(familyId, userId);
    const availablePoints = summary.availablePoints;
    const pendingPoints = summary.pendingPoints || 0;

    if (points > availablePoints - pendingPoints) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        error: `可用积分不足，当前可申请：${availablePoints - pendingPoints}` 
      });
    }

    // 检查用户是否是管理员
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);

    const result = await pointsService.submitRedeemRequest({
      userId,
      familyId,
      points,
      remark: remark || '',
      isAdmin
    });

    return res.json({
      success: true,
      data: {
        id: result.id,
        points: result.points,
        amount: result.amount,
        message: result.autoApproved ? '兑现成功，积分已扣减' : '申请已提交，等待审核',
        autoApproved: result.autoApproved
      }
    });
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

    const result = await pointsService.getRedeemRequests({
      familyId,
      userId,
      isAdmin,
      status: (status && status !== 'undefined') ? status : undefined,
      page,
      pageSize
    });

    return res.json({
      success: true,
      data: result.data,
      total: result.total,
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
    // 这里需要先获取申请信息以验证权限
    // 由于 service 层已经处理了大部分逻辑，我们直接调用
    // 但是我们需要知道 familyId 来验证管理员权限
    // 在 service 层中处理更合适
    
    await pointsService.reviewRedeemRequest({
      requestId,
      adminId: userId,
      action,
      rejectReason
    });

    return res.json({
      success: true,
      data: {
        message: action === 'approve' ? '已通过申请，积分已扣减' : '已拒绝申请'
      }
    });
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

    const count = await pointsService.getPendingRedeemCount(familyId);

    return res.json({
      success: true,
      data: { count }
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
