// src/controllers/pointsController.js
const { v4: uuidv4 } = require('uuid');

// 动态导入数据库模块
let query;
try {
  query = require('../config/database').query;
} catch (e) {
  console.warn('数据库模块未加载');
  query = null;
}

// 模拟数据（与其他控制器共享）
const mockFamilies = global.mockFamilies || (global.mockFamilies = new Map());
const mockFamilyMembers = global.mockFamilyMembers || (global.mockFamilyMembers = new Map());
const mockChoreRecords = global.mockChoreRecords || (global.mockChoreRecords = new Map());
const mockPointTransactions = global.mockPointTransactions || (global.mockPointTransactions = new Map());

/**
 * 获取积分概览
 */
const getSummary = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 尝试使用数据库
  if (query) {
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

      // 获取获得的总积分和已兑现的总积分
      const pointsStats = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN ABS(points) ELSE 0 END), 0) as total_redeemed
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2`,
        [familyId, req.user.id]
      );

      const totalEarned = parseInt(pointsStats.rows[0].total_earned);
      const totalRedeemed = parseInt(pointsStats.rows[0].total_redeemed);
      const availablePoints = totalEarned - totalRedeemed;

      // 本周积分
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const myWeekPoints = await query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) as total
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2 AND created_at >= $3`,
        [familyId, req.user.id, weekStart.toISOString()]
      );

      // 本月积分
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const myMonthPoints = await query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) as total
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2 AND created_at >= $3`,
        [familyId, req.user.id, monthStart.toISOString()]
      );

      const weekPoints = parseInt(myWeekPoints.rows[0].total);
      const monthPoints = parseInt(myMonthPoints.rows[0].total);

      // 获取排名
      const rankingResult = await query(
        `SELECT user_id, 
                COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) - 
                COALESCE(SUM(CASE WHEN type = 'redeem' THEN ABS(points) ELSE 0 END), 0) as available
         FROM point_transactions
         WHERE family_id = $1
         GROUP BY user_id
         ORDER BY available DESC`,
        [familyId]
      );

      let rank = '-';
      rankingResult.rows.forEach((row, index) => {
        if (row.user_id === req.user.id) {
          rank = index + 1;
        }
      });

      return res.json({
        data: {
          totalPoints: totalEarned,
          availablePoints,
          redeemedTotal: totalRedeemed,
          thisWeek: weekPoints,
          thisMonth: monthPoints,
          rank,
          pointsValue,
          totalValue: (availablePoints * pointsValue).toFixed(2)
        }
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const family = mockFamilies.get(familyId);
    const pointsValue = family ? parseFloat(family.points_value || 0.5) : 0.5;
    
    // 计算用户积分
    let totalEarned = 0;
    let totalRedeemed = 0;
    let weekPoints = 0;
    let monthPoints = 0;
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    for (const [, transaction] of mockPointTransactions) {
      if (transaction.familyId === familyId && transaction.userId === req.user.id) {
        if (transaction.type === 'earn') {
          totalEarned += Math.abs(transaction.points);
          if (new Date(transaction.createdAt) >= weekStart) {
            weekPoints += Math.abs(transaction.points);
          }
          if (new Date(transaction.createdAt) >= monthStart) {
            monthPoints += Math.abs(transaction.points);
          }
        } else if (transaction.type === 'redeem') {
          totalRedeemed += Math.abs(transaction.points);
        }
      }
    }
    
    const availablePoints = totalEarned - totalRedeemed;
    
    return res.json({
      data: {
        totalPoints: totalEarned,
        availablePoints,
        redeemedTotal: totalRedeemed,
        thisWeek: weekPoints,
        thisMonth: monthPoints,
        rank: 1,
        pointsValue,
        totalValue: (availablePoints * pointsValue).toFixed(2)
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

  // 尝试使用数据库
  if (query) {
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
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const transactions = [];
    for (const [, transaction] of mockPointTransactions) {
      if (transaction.familyId === familyId && transaction.userId === req.user.id) {
        if (!type || transaction.type === type) {
          transactions.push({
            id: transaction.id,
            points: transaction.points,
            type: transaction.type,
            description: transaction.description,
            createdAt: transaction.createdAt
          });
        }
      }
    }
    
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return res.json({ 
      data: transactions.slice(parseInt(offset), parseInt(offset) + parseInt(limit)) 
    });
  } catch (error) {
    console.error('获取积分记录错误:', error);
    return res.status(500).json({ error: '获取积分记录失败' });
  }
};

/**
 * 获取月度统计
 */
const getMonthStats = async (req, res) => {
  const { familyId, month } = req.query;

  if (!familyId || !month) {
    return res.status(400).json({ error: '缺少参数' });
  }

  // 解析月份
  const [year, mon] = month.split('-');
  const startDate = new Date(parseInt(year), parseInt(mon) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(mon), 0, 23, 59, 59, 999);

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为家庭成员
      const memberCheck = await query(
        'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      // 获取月度获得积分
      const earnedResult = await query(
        `SELECT COALESCE(SUM(points), 0) as total
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2 AND type = 'earn' 
         AND created_at >= $3 AND created_at <= $4`,
        [familyId, req.user.id, startDate.toISOString(), endDate.toISOString()]
      );

      // 获取月度兑现积分
      const redeemedResult = await query(
        `SELECT COALESCE(SUM(points), 0) as total
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2 AND type = 'redeem' 
         AND created_at >= $3 AND created_at <= $4`,
        [familyId, req.user.id, startDate.toISOString(), endDate.toISOString()]
      );

      // 计算月末余额（该月份之前的所有积分总和）
      const balanceResult = await query(
        `SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE -points END), 0) as total
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2 AND created_at <= $3`,
        [familyId, req.user.id, endDate.toISOString()]
      );

      return res.json({
        data: {
          earned: Math.abs(parseInt(earnedResult.rows[0].total)),
          redeemed: Math.abs(parseInt(redeemedResult.rows[0].total)),
          balance: parseInt(balanceResult.rows[0].total)
        }
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    let earned = 0;
    let redeemed = 0;
    let totalBalance = 0;

    for (const [, transaction] of mockPointTransactions) {
      if (transaction.familyId === familyId && transaction.userId === req.user.id) {
        const txDate = new Date(transaction.createdAt);
        
        if (txDate >= startDate && txDate <= endDate) {
          if (transaction.type === 'earn') {
            earned += Math.abs(transaction.points);
          } else if (transaction.type === 'redeem') {
            redeemed += Math.abs(transaction.points);
          }
        }
        
        if (txDate <= endDate) {
          totalBalance += transaction.type === 'earn' ? transaction.points : -Math.abs(transaction.points);
        }
      }
    }

    return res.json({
      data: { earned, redeemed, balance: totalBalance }
    });
  } catch (error) {
    console.error('获取月度统计错误:', error);
    return res.status(500).json({ error: '获取月度统计失败' });
  }
};

/**
 * 获取成员积分列表
 */
const getMembersPoints = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证用户是否为管理员
      const memberCheck = await query(
        'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, req.user.id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      const role = memberCheck.rows[0].role;
      if (role !== 'creator' && role !== 'admin') {
        return res.status(403).json({ error: '只有管理员才能查看成员积分' });
      }

      // 获取所有成员及其积分
      const result = await query(
        `SELECT fm.id, fm.user_id, fm.role, u.nickname, u.avatar_url,
                COALESCE(SUM(CASE WHEN pt.type = 'earn' THEN pt.points ELSE 0 END), 0) as total_earned,
                COALESCE(SUM(CASE WHEN pt.type = 'redeem' THEN ABS(pt.points) ELSE 0 END), 0) as total_redeemed
         FROM family_members fm
         JOIN users u ON fm.user_id = u.id
         LEFT JOIN point_transactions pt ON pt.user_id = fm.user_id AND pt.family_id = fm.family_id
         WHERE fm.family_id = $1
         GROUP BY fm.id, fm.user_id, fm.role, u.nickname, u.avatar_url
         ORDER BY (COALESCE(SUM(CASE WHEN pt.type = 'earn' THEN pt.points ELSE 0 END), 0) - 
                   COALESCE(SUM(CASE WHEN pt.type = 'redeem' THEN ABS(pt.points) ELSE 0 END), 0)) DESC`,
        [familyId]
      );

      return res.json({
        data: result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          role: row.role,
          user: {
            nickname: row.nickname,
            avatarUrl: row.avatar_url
          },
          totalEarned: parseInt(row.total_earned),
          totalRedeemed: parseInt(row.total_redeemed),
          availablePoints: parseInt(row.total_earned) - parseInt(row.total_redeemed)
        }))
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const members = [];
    
    for (const [, member] of mockFamilyMembers) {
      if (member.family_id === familyId) {
        let totalEarned = 0;
        let totalRedeemed = 0;
        
        for (const [, transaction] of mockPointTransactions) {
          if (transaction.familyId === familyId && transaction.userId === member.user_id) {
            if (transaction.type === 'earn') {
              totalEarned += Math.abs(transaction.points);
            } else if (transaction.type === 'redeem') {
              totalRedeemed += Math.abs(transaction.points);
            }
          }
        }
        
        members.push({
          id: member.id,
          userId: member.user_id,
          role: member.role,
          user: {
            nickname: '家庭成员',
            avatarUrl: ''
          },
          totalEarned,
          totalRedeemed,
          availablePoints: totalEarned - totalRedeemed
        });
      }
    }

    return res.json({ data: members });
  } catch (error) {
    console.error('获取成员积分错误:', error);
    return res.status(500).json({ error: '获取成员积分失败' });
  }
};

/**
 * 积分兑现/结算
 */
const redeemPoints = async (req, res) => {
  const { familyId, memberId, points, remark } = req.body;

  if (!familyId || !memberId || !points || points <= 0) {
    return res.status(400).json({ error: '参数错误' });
  }

  // 尝试使用数据库
  if (query) {
    try {
      // 验证操作者是否为管理员
      const adminCheck = await query(
        'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, req.user.id]
      );

      if (adminCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是该家庭成员' });
      }

      const role = adminCheck.rows[0].role;
      if (role !== 'creator' && role !== 'admin') {
        return res.status(403).json({ error: '只有管理员才能进行积分结算' });
      }

      // 检查目标成员的可用积分
      const pointsCheck = await query(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) as total_earned,
          COALESCE(SUM(CASE WHEN type = 'redeem' THEN ABS(points) ELSE 0 END), 0) as total_redeemed
         FROM point_transactions 
         WHERE family_id = $1 AND user_id = $2`,
        [familyId, memberId]
      );

      const totalEarned = parseInt(pointsCheck.rows[0].total_earned);
      const totalRedeemed = parseInt(pointsCheck.rows[0].total_redeemed);
      const availablePoints = totalEarned - totalRedeemed;

      if (points > availablePoints) {
        return res.status(400).json({ error: `可用积分不足，当前可用：${availablePoints}` });
      }

      // 创建兑现记录
      const transactionId = uuidv4();
      await query(
        `INSERT INTO point_transactions (id, family_id, user_id, points, type, description, created_at)
         VALUES ($1, $2, $3, $4, 'redeem', $5, NOW())`,
        [transactionId, familyId, memberId, points, remark || '积分结算兑现']
      );

      return res.json({
        data: {
          id: transactionId,
          points: points,
          message: '结算成功'
        }
      });
    } catch (dbError) {
      console.error('积分结算错误:', dbError);
      return res.status(500).json({ error: '积分结算失败' });
    }
  }

  // 使用模拟数据
  try {
    const transactionId = uuidv4();
    mockPointTransactions.set(transactionId, {
      id: transactionId,
      familyId,
      userId: memberId,
      points: points,
      type: 'redeem',
      description: remark || '积分结算兑现',
      createdAt: new Date().toISOString()
    });

    return res.json({
      data: {
        id: transactionId,
        points: points,
        message: '结算成功'
      }
    });
  } catch (error) {
    console.error('积分结算错误:', error);
    return res.status(500).json({ error: '积分结算失败' });
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

  // 尝试使用数据库
  if (query) {
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
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const family = mockFamilies.get(familyId);
    const pointsValue = family ? parseFloat(family.points_value || 0.5) : 0.5;
    
    // 计算时间范围
    let startDate = null;
    if (period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }
    
    // 统计各成员积分
    const memberPoints = new Map();
    
    for (const [, member] of mockFamilyMembers) {
      if (member.family_id === familyId) {
        memberPoints.set(member.user_id, {
          userId: member.user_id,
          nickname: '家庭成员',
          avatarUrl: '',
          totalPoints: 0,
          totalRecords: 0
        });
      }
    }
    
    for (const [, transaction] of mockPointTransactions) {
      if (transaction.familyId === familyId) {
        if (!startDate || new Date(transaction.createdAt) >= startDate) {
          const member = memberPoints.get(transaction.userId);
          if (member) {
            member.totalPoints += transaction.points;
            member.totalRecords += 1;
          }
        }
      }
    }
    
    const ranking = Array.from(memberPoints.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
        totalValue: (item.totalPoints * pointsValue).toFixed(2)
      }));
    
    return res.json({ data: ranking });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return res.status(500).json({ error: '获取排行榜失败' });
  }
};

module.exports = {
  getSummary,
  getTransactions,
  getRanking,
  getMonthStats,
  getMembersPoints,
  redeemPoints
};
