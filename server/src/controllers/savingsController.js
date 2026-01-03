// src/controllers/savingsController.js
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

// 数据库连接
let query;
try {
  const db = require('../config/database');
  query = db.query;
} catch (e) {
  console.warn('数据库未配置，存款功能将使用模拟数据');
}

/**
 * 计算从上次计息到现在应该获得的利息（复利）
 */
function calculatePendingInterest(balance, annualRate, lastInterestDate) {
  if (!lastInterestDate || balance <= 0) {
    return { days: 0, interest: 0, newBalance: balance };
  }

  const lastDate = new Date(lastInterestDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);

  const diffTime = today - lastDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { days: 0, interest: 0, newBalance: balance };
  }

  const dailyRate = annualRate / 365;
  const newBalance = balance * Math.pow(1 + dailyRate, diffDays);
  const interest = newBalance - balance;

  return {
    days: diffDays,
    interest: Math.round(interest * 100) / 100,
    newBalance: Math.round(newBalance * 100) / 100
  };
}

/**
 * 检查用户是否是管理员（创建人或子管理员）
 */
async function checkIsAdmin(userId, familyId) {
  if (!query) return false;
  
  try {
    const result = await query(
      `SELECT role FROM family_members WHERE user_id = $1 AND family_id = $2`,
      [userId, familyId]
    );
    if (result.rows.length === 0) return false;
    const role = result.rows[0].role;
    return role === 'creator' || role === 'admin';
  } catch (error) {
    console.error('检查管理员权限失败:', error);
    return false;
  }
}

/**
 * 获取用户的存款账户
 */
const getAccount = async (req, res) => {
  const userId = req.user.id;
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  if (query) {
    try {
      // 获取或创建账户
      let accountRes = await query(
        `SELECT * FROM savings_accounts WHERE user_id = $1 AND family_id = $2`,
        [userId, familyId]
      );

      let account;
      if (accountRes.rows.length === 0) {
        const accountId = uuidv4();
        await query(
          `INSERT INTO savings_accounts (id, user_id, family_id, balance, total_interest, annual_rate, last_interest_date)
           VALUES ($1, $2, $3, 0, 0, 0.03, CURRENT_DATE)`,
          [accountId, userId, familyId]
        );
        accountRes = await query(
          `SELECT * FROM savings_accounts WHERE id = $1`,
          [accountId]
        );
      }

      account = accountRes.rows[0];

      // 计算待发利息
      const pendingInterest = calculatePendingInterest(
        parseFloat(account.balance),
        parseFloat(account.annual_rate),
        account.last_interest_date
      );

      // 获取用户信息
      const userRes = await query(
        `SELECT nickname, avatar_url FROM users WHERE id = $1`,
        [userId]
      );

      // 检查是否为管理员
      const isAdmin = await checkIsAdmin(userId, familyId);

      // 获取待审核的存款申请数量
      const pendingCountRes = await query(
        `SELECT COUNT(*) as count FROM savings_requests 
         WHERE account_id = $1 AND status = 'pending'`,
        [account.id]
      );

      return res.json({
        data: {
          id: account.id,
          balance: parseFloat(account.balance),
          totalInterest: parseFloat(account.total_interest),
          annualRate: parseFloat(account.annual_rate),
          dailyRate: parseFloat(account.annual_rate) / 365,
          lastInterestDate: account.last_interest_date,
          pendingInterest: pendingInterest.interest,
          pendingDays: pendingInterest.days,
          projectedBalance: pendingInterest.newBalance,
          userNickname: userRes.rows[0]?.nickname,
          userAvatar: userRes.rows[0]?.avatar_url,
          isAdmin,
          pendingRequestCount: parseInt(pendingCountRes.rows[0]?.count || 0),
          createdAt: account.created_at
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '获取账户失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 获取家庭所有成员的存款账户（管理员用）
 */
const getFamilyAccounts = async (req, res) => {
  const { familyId } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  // 检查权限
  const isAdmin = await checkIsAdmin(userId, familyId);
  if (!isAdmin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  if (query) {
    try {
      const accountsRes = await query(
        `SELECT sa.*, u.nickname, u.avatar_url
         FROM savings_accounts sa
         JOIN users u ON sa.user_id = u.id
         WHERE sa.family_id = $1
         ORDER BY sa.balance DESC`,
        [familyId]
      );

      const accounts = accountsRes.rows.map(account => {
        const pendingInterest = calculatePendingInterest(
          parseFloat(account.balance),
          parseFloat(account.annual_rate),
          account.last_interest_date
        );

        return {
          id: account.id,
          userId: account.user_id,
          balance: parseFloat(account.balance),
          totalInterest: parseFloat(account.total_interest),
          annualRate: parseFloat(account.annual_rate),
          pendingInterest: pendingInterest.interest,
          projectedBalance: pendingInterest.newBalance,
          userNickname: account.nickname,
          userAvatar: account.avatar_url
        };
      });

      return res.json({ data: accounts });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '获取账户列表失败' });
    }
  }

  return res.json({ data: [] });
};

/**
 * 提交存款申请（需要管理员审核）
 */
const submitDepositRequest = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { accountId, amount, description } = req.body;
  const userId = req.user.id;

  if (amount <= 0) {
    return res.status(400).json({ error: '存款金额必须大于0' });
  }

  if (query) {
    try {
      // 验证账户存在
      const accountRes = await query(
        `SELECT * FROM savings_accounts WHERE id = $1`,
        [accountId]
      );

      if (accountRes.rows.length === 0) {
        return res.status(404).json({ error: '账户不存在' });
      }

      // 创建存款申请
      const requestId = uuidv4();
      await query(
        `INSERT INTO savings_requests (id, account_id, user_id, type, amount, description, status)
         VALUES ($1, $2, $3, 'deposit', $4, $5, 'pending')`,
        [requestId, accountId, userId, amount, description || '存款申请']
      );

      return res.json({
        data: {
          requestId,
          type: 'deposit',
          amount,
          status: 'pending',
          message: '存款申请已提交，请等待管理员审核'
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '提交申请失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 获取存款申请列表
 */
const getRequests = async (req, res) => {
  const { familyId, status, page = 1, pageSize = 20 } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const isAdmin = await checkIsAdmin(userId, familyId);

  if (query) {
    try {
      let queryStr, queryParams;
      
      if (isAdmin) {
        // 管理员可以看到所有申请
        queryStr = `
          SELECT sr.*, sa.user_id as account_user_id, u.nickname, u.avatar_url,
                 reviewer.nickname as reviewer_name
          FROM savings_requests sr
          JOIN savings_accounts sa ON sr.account_id = sa.id
          JOIN users u ON sr.user_id = u.id
          LEFT JOIN users reviewer ON sr.reviewed_by = reviewer.id
          WHERE sa.family_id = $1
          ${status ? 'AND sr.status = $4' : ''}
          ORDER BY sr.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = status 
          ? [familyId, parseInt(pageSize), offset, status]
          : [familyId, parseInt(pageSize), offset];
      } else {
        // 普通用户只能看到自己的申请
        queryStr = `
          SELECT sr.*, u.nickname, u.avatar_url,
                 reviewer.nickname as reviewer_name
          FROM savings_requests sr
          JOIN users u ON sr.user_id = u.id
          LEFT JOIN users reviewer ON sr.reviewed_by = reviewer.id
          WHERE sr.user_id = $1
          ${status ? 'AND sr.status = $4' : ''}
          ORDER BY sr.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        queryParams = status 
          ? [userId, parseInt(pageSize), offset, status]
          : [userId, parseInt(pageSize), offset];
      }

      const requestsRes = await query(queryStr, queryParams);

      return res.json({
        data: requestsRes.rows.map(r => ({
          id: r.id,
          accountId: r.account_id,
          userId: r.user_id,
          type: r.type,
          amount: parseFloat(r.amount),
          description: r.description,
          status: r.status,
          reviewedBy: r.reviewed_by,
          reviewerName: r.reviewer_name,
          reviewedAt: r.reviewed_at,
          rejectReason: r.reject_reason,
          userNickname: r.nickname,
          userAvatar: r.avatar_url,
          createdAt: r.created_at
        })),
        isAdmin
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '获取申请列表失败' });
    }
  }

  return res.json({ data: [], isAdmin: false });
};

/**
 * 审核存款申请（管理员）
 */
const reviewRequest = async (req, res) => {
  const { requestId, action, rejectReason } = req.body;
  const reviewerId = req.user.id;

  if (!requestId || !action) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '无效的操作' });
  }

  if (query) {
    try {
      // 获取申请详情
      const requestRes = await query(
        `SELECT sr.*, sa.family_id, sa.balance
         FROM savings_requests sr
         JOIN savings_accounts sa ON sr.account_id = sa.id
         WHERE sr.id = $1`,
        [requestId]
      );

      if (requestRes.rows.length === 0) {
        return res.status(404).json({ error: '申请不存在' });
      }

      const request = requestRes.rows[0];

      if (request.status !== 'pending') {
        return res.status(400).json({ error: '该申请已处理' });
      }

      // 检查审核权限
      const isAdmin = await checkIsAdmin(reviewerId, request.family_id);
      if (!isAdmin) {
        return res.status(403).json({ error: '需要管理员权限' });
      }

      if (action === 'approve') {
        // 批准：更新账户余额并记录交易
        const currentBalance = parseFloat(request.balance);
        const amount = parseFloat(request.amount);
        let newBalance;
        
        if (request.type === 'deposit') {
          newBalance = currentBalance + amount;
        } else {
          if (amount > currentBalance) {
            return res.status(400).json({ error: '账户余额不足' });
          }
          newBalance = currentBalance - amount;
        }

        // 更新账户余额
        await query(
          `UPDATE savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
          [newBalance, request.account_id]
        );

        // 记录交易
        const transactionId = uuidv4();
        await query(
          `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [transactionId, request.account_id, request.type, amount, newBalance, 
           request.description, reviewerId]
        );

        // 更新申请状态
        await query(
          `UPDATE savings_requests 
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [reviewerId, requestId]
        );

        return res.json({
          data: {
            requestId,
            status: 'approved',
            newBalance,
            message: '审核通过，金额已到账'
          }
        });
      } else {
        // 拒绝
        await query(
          `UPDATE savings_requests 
           SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), 
               reject_reason = $2, updated_at = NOW()
           WHERE id = $3`,
          [reviewerId, rejectReason || '审核未通过', requestId]
        );

        return res.json({
          data: {
            requestId,
            status: 'rejected',
            message: '已拒绝该申请'
          }
        });
      }
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '审核失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 直接存款（管理员专用，无需审核）
 */
const deposit = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { accountId, amount, description } = req.body;
  const operatorId = req.user.id;

  if (amount <= 0) {
    return res.status(400).json({ error: '存款金额必须大于0' });
  }

  if (query) {
    try {
      // 获取账户信息
      const accountRes = await query(
        `SELECT sa.*, fm.role 
         FROM savings_accounts sa
         JOIN family_members fm ON fm.family_id = sa.family_id AND fm.user_id = $2
         WHERE sa.id = $1`,
        [accountId, operatorId]
      );

      if (accountRes.rows.length === 0) {
        return res.status(404).json({ error: '账户不存在或无权限' });
      }

      const account = accountRes.rows[0];
      
      // 检查是否为管理员
      if (account.role !== 'creator' && account.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
      }

      const newBalance = parseFloat(account.balance) + amount;

      // 更新余额
      await query(
        `UPDATE savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance, accountId]
      );

      // 记录交易
      const transactionId = uuidv4();
      await query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
         VALUES ($1, $2, 'deposit', $3, $4, $5, $6)`,
        [transactionId, accountId, amount, newBalance, description || '管理员存款', operatorId]
      );

      return res.json({
        data: {
          transactionId,
          type: 'deposit',
          amount,
          balanceAfter: newBalance,
          message: '存款成功'
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '存款失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 直接取款（管理员专用）
 */
const withdraw = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { accountId, amount, description } = req.body;
  const operatorId = req.user.id;

  if (amount <= 0) {
    return res.status(400).json({ error: '取款金额必须大于0' });
  }

  if (query) {
    try {
      // 获取账户信息和权限
      const accountRes = await query(
        `SELECT sa.*, fm.role 
         FROM savings_accounts sa
         JOIN family_members fm ON fm.family_id = sa.family_id AND fm.user_id = $2
         WHERE sa.id = $1`,
        [accountId, operatorId]
      );

      if (accountRes.rows.length === 0) {
        return res.status(404).json({ error: '账户不存在或无权限' });
      }

      const account = accountRes.rows[0];
      
      // 检查是否为管理员
      if (account.role !== 'creator' && account.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
      }

      const currentBalance = parseFloat(account.balance);

      if (amount > currentBalance) {
        return res.status(400).json({ error: '余额不足' });
      }

      const newBalance = currentBalance - amount;

      // 更新余额
      await query(
        `UPDATE savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance, accountId]
      );

      // 记录交易
      const transactionId = uuidv4();
      await query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
         VALUES ($1, $2, 'withdraw', $3, $4, $5, $6)`,
        [transactionId, accountId, amount, newBalance, description || '管理员取款', operatorId]
      );

      return res.json({
        data: {
          transactionId,
          type: 'withdraw',
          amount,
          balanceAfter: newBalance,
          message: '取款成功'
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '取款失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 结算利息
 */
const settleInterest = async (req, res) => {
  const { accountId } = req.body;
  const operatorId = req.user.id;

  if (query) {
    try {
      // 获取账户
      const accountRes = await query(
        `SELECT * FROM savings_accounts WHERE id = $1`,
        [accountId]
      );

      if (accountRes.rows.length === 0) {
        return res.status(404).json({ error: '账户不存在' });
      }

      const account = accountRes.rows[0];
      const pendingInterest = calculatePendingInterest(
        parseFloat(account.balance),
        parseFloat(account.annual_rate),
        account.last_interest_date
      );

      if (pendingInterest.interest <= 0) {
        return res.status(400).json({ error: '暂无可结算的利息' });
      }

      const newBalance = pendingInterest.newBalance;
      const newTotalInterest = parseFloat(account.total_interest) + pendingInterest.interest;

      // 更新账户
      await query(
        `UPDATE savings_accounts 
         SET balance = $1, total_interest = $2, last_interest_date = CURRENT_DATE, updated_at = NOW() 
         WHERE id = $3`,
        [newBalance, newTotalInterest, accountId]
      );

      // 记录利息交易
      const transactionId = uuidv4();
      await query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
         VALUES ($1, $2, 'interest', $3, $4, $5, $6)`,
        [transactionId, accountId, pendingInterest.interest, newBalance, 
         `${pendingInterest.days}天利息结算`, operatorId]
      );

      return res.json({
        data: {
          transactionId,
          type: 'interest',
          amount: pendingInterest.interest,
          days: pendingInterest.days,
          balanceAfter: newBalance,
          totalInterest: newTotalInterest,
          message: '利息结算成功'
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '利息结算失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 获取交易记录
 */
const getTransactions = async (req, res) => {
  const { accountId, page = 1, pageSize = 20 } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: '缺少账户ID' });
  }

  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  if (query) {
    try {
      const transactionsRes = await query(
        `SELECT st.*, u.nickname as operator_name
         FROM savings_transactions st
         LEFT JOIN users u ON st.created_by = u.id
         WHERE st.account_id = $1
         ORDER BY st.created_at DESC
         LIMIT $2 OFFSET $3`,
        [accountId, parseInt(pageSize), offset]
      );

      const countRes = await query(
        `SELECT COUNT(*) as total FROM savings_transactions WHERE account_id = $1`,
        [accountId]
      );

      return res.json({
        data: transactionsRes.rows.map(t => ({
          id: t.id,
          type: t.type,
          amount: parseFloat(t.amount),
          balanceAfter: parseFloat(t.balance_after),
          description: t.description,
          operatorName: t.operator_name,
          createdAt: t.created_at
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: parseInt(countRes.rows[0].total)
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '获取交易记录失败' });
    }
  }

  return res.json({ data: [], pagination: { page: 1, pageSize: 20, total: 0 } });
};

/**
 * 更新年利率（仅创建人）
 */
const updateRate = async (req, res) => {
  const { accountId, annualRate } = req.body;
  const operatorId = req.user.id;

  if (annualRate < 0 || annualRate > 1) {
    return res.status(400).json({ error: '年利率必须在0-100%之间' });
  }

  if (query) {
    try {
      // 检查是否为创建人
      const checkRes = await query(
        `SELECT fm.role 
         FROM savings_accounts sa
         JOIN family_members fm ON fm.family_id = sa.family_id AND fm.user_id = $2
         WHERE sa.id = $1`,
        [accountId, operatorId]
      );

      if (checkRes.rows.length === 0 || checkRes.rows[0].role !== 'creator') {
        return res.status(403).json({ error: '只有创建人可以修改利率' });
      }

      await query(
        `UPDATE savings_accounts SET annual_rate = $1, updated_at = NOW() WHERE id = $2`,
        [annualRate, accountId]
      );

      return res.json({
        data: {
          annualRate,
          message: '利率更新成功'
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '更新利率失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 设置子管理员（仅创建人）
 */
const setSubAdmin = async (req, res) => {
  const { familyId, memberId, isAdmin } = req.body;
  const operatorId = req.user.id;

  if (query) {
    try {
      // 检查操作者是否为创建人
      const creatorCheck = await query(
        `SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2`,
        [familyId, operatorId]
      );

      if (creatorCheck.rows.length === 0 || creatorCheck.rows[0].role !== 'creator') {
        return res.status(403).json({ error: '只有创建人可以设置子管理员' });
      }

      // 不能修改创建人的角色
      const targetCheck = await query(
        `SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2`,
        [familyId, memberId]
      );

      if (targetCheck.rows.length === 0) {
        return res.status(404).json({ error: '成员不存在' });
      }

      if (targetCheck.rows[0].role === 'creator') {
        return res.status(400).json({ error: '不能修改创建人的角色' });
      }

      // 更新角色
      const newRole = isAdmin ? 'admin' : 'member';
      await query(
        `UPDATE family_members SET role = $1, updated_at = NOW() WHERE family_id = $2 AND user_id = $3`,
        [newRole, familyId, memberId]
      );

      return res.json({
        data: {
          memberId,
          role: newRole,
          message: isAdmin ? '已设为子管理员' : '已取消子管理员'
        }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '操作失败' });
    }
  }

  return res.status(500).json({ error: '数据库未配置' });
};

/**
 * 获取待审核数量（管理员）
 */
const getPendingCount = async (req, res) => {
  const { familyId } = req.query;
  const userId = req.user.id;

  if (!familyId) {
    return res.status(400).json({ error: '缺少家庭ID' });
  }

  const isAdmin = await checkIsAdmin(userId, familyId);
  
  if (!isAdmin) {
    return res.json({ data: { count: 0 } });
  }

  if (query) {
    try {
      const countRes = await query(
        `SELECT COUNT(*) as count 
         FROM savings_requests sr
         JOIN savings_accounts sa ON sr.account_id = sa.id
         WHERE sa.family_id = $1 AND sr.status = 'pending'`,
        [familyId]
      );

      return res.json({
        data: { count: parseInt(countRes.rows[0]?.count || 0) }
      });
    } catch (dbError) {
      console.error('数据库错误:', dbError);
      return res.status(500).json({ error: '获取数量失败' });
    }
  }

  return res.json({ data: { count: 0 } });
};

module.exports = {
  getAccount,
  getFamilyAccounts,
  submitDepositRequest,
  getRequests,
  reviewRequest,
  deposit,
  withdraw,
  settleInterest,
  getTransactions,
  updateRate,
  setSubAdmin,
  getPendingCount
};
