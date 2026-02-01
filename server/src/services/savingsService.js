// src/services/savingsService.js
// 存款服务层 - 处理存款相关业务逻辑 (PostgreSQL 版本)

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');
const { REVIEW_STATUS, TRANSACTION_TYPE } = require('../constants/statusCodes');

// 开发模式下的模拟数据
const mockSavingsAccounts = global.mockSavingsAccounts || (global.mockSavingsAccounts = new Map());
const mockSavingsTransactions = global.mockSavingsTransactions || (global.mockSavingsTransactions = new Map());
const mockSavingsRequests = global.mockSavingsRequests || (global.mockSavingsRequests = new Map());

// 初始化一些模拟申请数据（如果为空）
if (mockSavingsRequests.size === 0) {
  const demoFamilyId = '37f4dab0-afd6-4cbb-98d7-1102df648d7f'; // 你的测试家庭ID
  const demoUserId = 'user-123';
  
  const demoRequests = [
    {
      id: uuidv4(),
      user_id: demoUserId,
      family_id: demoFamilyId,
      amount: 100.00,
      description: '零花钱存入',
      status: 'pending',
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      user_id: demoUserId,
      family_id: demoFamilyId,
      amount: 50.00,
      description: '家务奖励',
      status: 'approved',
      createdAt: new Date(Date.now() - 86400000)
    }
  ];
  mockSavingsRequests.set(demoFamilyId, demoRequests);
}

class SavingsService extends BaseService {
  /**
   * 格式化请求对象（数据库字段 -> 前端字段）
   */
  formatRequest(r) {
    if (!r) return null;
    return {
      id: r.id,
      userId: r.user_id,
      familyId: r.family_id,
      amount: parseFloat(r.amount || 0),
      type: r.type,
      description: r.description,
      status: r.status,
      rejectReason: r.reject_reason,
      reviewerId: r.reviewer_id,
      createdAt: r.created_at || r.createdAt, // 兼容模拟数据和数据库
      reviewedAt: r.reviewed_at,
      userNickname: r.userNickname || '用户',
      userAvatar: r.userAvatar || ''
    };
  }

  /**
   * 计算待发利息（复利）
   */
  calculatePendingInterest(balance, annualRate, lastInterestDate) {
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
   * 获取或创建用户存款账户
   */
  async getOrCreateAccount(userId, familyId) {
    if (!this.isDatabaseAvailable()) {
      const accountKey = `${userId}_${familyId}`;
      let account = mockSavingsAccounts.get(accountKey);
      if (!account) {
        account = {
          id: uuidv4(),
          user_id: userId,
          family_id: familyId,
          balance: 0,
          total_interest: 0,
          annual_rate: 3.00,
          last_interest_date: new Date(),
          created_at: new Date()
        };
        mockSavingsAccounts.set(accountKey, account);
      }
      return account;
    }

    let account = await this.queryOne(
      'SELECT * FROM savings_accounts WHERE user_id = $1 AND family_id = $2',
      [userId, familyId]
    );

    if (!account) {
      const accountId = uuidv4();
      await this.insert('savings_accounts', {
        id: accountId,
        user_id: userId,
        family_id: familyId,
        balance: 0,
        total_interest: 0,
        annual_rate: 3.00,
        last_interest_date: new Date()
      });
      account = await this.queryOne('SELECT * FROM savings_accounts WHERE id = $1', [accountId]);
    }
    return account;
  }

  /**
   * 获取账户详情
   */
  async getAccountDetail(userId, familyId) {
    const account = await this.getOrCreateAccount(userId, familyId);
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);

    const pendingInterest = this.calculatePendingInterest(
      parseFloat(account.balance),
      parseFloat(account.annual_rate) / 100,
      account.last_interest_date
    );

    if (!this.isDatabaseAvailable()) {
      const mockUsers = global.mockUsers || new Map();
      let user = null;
      for (const [openid, u] of mockUsers) {
        if (u.id === userId) { user = u; break; }
      }
      
      const requests = mockSavingsRequests.get(familyId) || [];
      const pendingCount = requests.filter(r => r.user_id === userId && r.status === REVIEW_STATUS.PENDING).length;

      return {
        id: account.id,
        balance: parseFloat(account.balance),
        totalInterest: parseFloat(account.total_interest),
        annualRate: parseFloat(account.annual_rate),
        dailyRate: parseFloat(account.annual_rate) / 100 / 365,
        lastInterestDate: account.last_interest_date,
        pendingInterest: pendingInterest.interest,
        pendingDays: pendingInterest.days,
        projectedBalance: pendingInterest.newBalance,
        userNickname: user?.nickname || '模拟用户',
        userAvatar: user?.avatar_url || '',
        isAdmin,
        pendingRequestCount: pendingCount,
        createdAt: account.created_at
      };
    }

    const user = await this.queryOne('SELECT nickname, avatar_url FROM users WHERE id = $1', [userId]);
    const pendingCount = await this.queryOne(
      `SELECT COUNT(*) as count FROM savings_requests 
       WHERE user_id = $1 AND family_id = $2 AND status = $3`,
      [userId, familyId, REVIEW_STATUS.PENDING]
    );

    return {
      ...account,
      balance: parseFloat(account.balance),
      totalInterest: parseFloat(account.total_interest),
      annualRate: parseFloat(account.annual_rate),
      pendingInterest: pendingInterest.interest,
      pendingDays: pendingInterest.days,
      userNickname: user?.nickname,
      userAvatar: user?.avatar_url,
      isAdmin,
      pendingRequestCount: parseInt(pendingCount?.count || 0)
    };
  }

  /**
   * 直接存款（管理员）
   */
  async deposit(data) {
    const { accountId, operatorId, amount, description } = data;
    if (amount <= 0) throw new Error(ERROR_CODES.SAVINGS_AMOUNT_INVALID.message);

    if (!this.isDatabaseAvailable()) {
      let targetAccount = null;
      let accountKey = null;
      
      for (const [key, acc] of mockSavingsAccounts) {
        if (acc.id === accountId) { 
          targetAccount = acc; 
          accountKey = key; 
          break; 
        }
      }
      
      if (!targetAccount) throw new Error('找不到该存款账户');

      targetAccount.balance = parseFloat(targetAccount.balance) + amount;
      mockSavingsAccounts.set(accountKey, targetAccount);

      const trans = mockSavingsTransactions.get(accountId) || [];
      trans.unshift({
        id: uuidv4(),
        type: TRANSACTION_TYPE.DEPOSIT,
        amount,
        balanceAfter: targetAccount.balance,
        description: description || '管理员存款',
        createdAt: new Date()
      });
      mockSavingsTransactions.set(accountId, trans);

      return { 
        type: TRANSACTION_TYPE.DEPOSIT, 
        amount, 
        balanceAfter: targetAccount.balance, 
        message: '存款成功 (Mock)' 
      };
    }

    const account = await this.queryOne('SELECT * FROM savings_accounts WHERE id = $1', [accountId]);
    if (!account) throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);
    await familyService.validateAdminRole(operatorId, account.family_id);

    const newBalance = parseFloat(account.balance) + amount;
    await this.transaction(async (client) => {
      await client.query('UPDATE savings_accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, accountId]);
      
      await client.query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), accountId, TRANSACTION_TYPE.DEPOSIT, amount, newBalance, description || '管理员存款']
      );
    });

    return { type: TRANSACTION_TYPE.DEPOSIT, amount, balanceAfter: newBalance, message: '存款成功' };
  }

  /**
   * 提交存款申请
   */
  async submitDepositRequest(data) {
    const { accountId, userId, amount, description } = data;
    if (amount <= 0) throw new Error(ERROR_CODES.SAVINGS_AMOUNT_INVALID.message);

    if (!this.isDatabaseAvailable()) {
      let targetAccount = null;
      for (const [, acc] of mockSavingsAccounts) {
        if (acc.id === accountId) { targetAccount = acc; break; }
      }
      if (!targetAccount) throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);

      const requestId = uuidv4();
      const requests = mockSavingsRequests.get(targetAccount.family_id) || [];
      requests.unshift({
        id: requestId,
        user_id: userId,
        family_id: targetAccount.family_id,
        amount,
        description,
        status: REVIEW_STATUS.PENDING,
        createdAt: new Date()
      });
      mockSavingsRequests.set(targetAccount.family_id, requests);
      return { requestId, status: REVIEW_STATUS.PENDING, message: '申请已提交' };
    }

    const account = await this.queryOne('SELECT family_id FROM savings_accounts WHERE id = $1', [accountId]);
    if (!account) throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);

    const requestId = uuidv4();
    await this.insert('savings_requests', {
      id: requestId,
      user_id: userId,
      family_id: account.family_id,
      type: TRANSACTION_TYPE.DEPOSIT,
      amount,
      description: description || '',
      status: REVIEW_STATUS.PENDING
    });
    return { requestId, status: REVIEW_STATUS.PENDING, message: '申请已提交' };
  }

  /**
   * 获取申请列表
   */
  async getRequests(familyId, status, page = 1, pageSize = 20) {
    if (!this.isDatabaseAvailable()) {
      let requests = mockSavingsRequests.get(familyId) || [];
      if (status) requests = requests.filter(r => r.status === status);
      
      const mockUsers = global.mockUsers || new Map();
      const enrichedRequests = requests.map(r => {
        let user = null;
        for (const [, u] of mockUsers) if (u.id === r.user_id) { user = u; break; }
        return this.formatRequest({
          ...r,
          userNickname: user?.nickname || '用户',
          userAvatar: user?.avatar_url || ''
        });
      });

      return {
        data: enrichedRequests.slice((page - 1) * pageSize, page * pageSize),
        total: enrichedRequests.length
      };
    }

    let sql = `SELECT sr.*, u.nickname as "userNickname", u.avatar_url as "userAvatar" 
               FROM savings_requests sr 
               JOIN users u ON sr.user_id = u.id 
               WHERE sr.family_id = $1`;
    const params = [familyId];
    if (status) {
      sql += ` AND sr.status = $2`;
      params.push(status);
    }
    sql += ` ORDER BY sr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, (page - 1) * pageSize);

    const res = await this.queryMany(sql, params);
    const data = res.map(r => this.formatRequest(r));
    return { data, total: data.length };
  }

  /**
   * 审核申请
   */
  async reviewRequest(data) {
    const { requestId, reviewerId, action, rejectReason } = data;
    
    if (!this.isDatabaseAvailable()) {
      let targetRequest = null;
      let familyId = null;
      
      for (const [fid, requests] of mockSavingsRequests) {
        const req = requests.find(r => r.id === requestId);
        if (req) { targetRequest = req; familyId = fid; break; }
      }
      
      if (!targetRequest) throw new Error('申请不存在');
      if (targetRequest.status !== REVIEW_STATUS.PENDING) throw new Error('该申请已被审核');

      targetRequest.status = action === 'approve' ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.REJECTED;
      targetRequest.reject_reason = rejectReason;
      targetRequest.reviewer_id = reviewerId;
      targetRequest.reviewed_at = new Date();

      if (action === 'approve') {
        const accountKey = `${targetRequest.user_id}_${familyId}`;
        let account = mockSavingsAccounts.get(accountKey);
        if (account) {
          account.balance = parseFloat(account.balance) + parseFloat(targetRequest.amount);
          const trans = mockSavingsTransactions.get(account.id) || [];
          trans.unshift({
            id: uuidv4(),
            type: TRANSACTION_TYPE.DEPOSIT,
            amount: targetRequest.amount,
            balanceAfter: account.balance,
            description: targetRequest.description || '存款申请通过',
            createdAt: new Date()
          });
          mockSavingsTransactions.set(account.id, trans);
        }
      }
      return { status: targetRequest.status, message: '审核完成 (Mock)' };
    }

    const request = await this.queryOne('SELECT * FROM savings_requests WHERE id = $1', [requestId]);
    if (!request) throw new Error('申请不存在');
    if (request.status !== REVIEW_STATUS.PENDING) throw new Error('该申请已被审核');

    const newStatus = action === 'approve' ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.REJECTED;
    
    await this.transaction(async (client) => {
      await client.query(
        'UPDATE savings_requests SET status = $1, reject_reason = $2, reviewer_id = $3, reviewed_at = CURRENT_TIMESTAMP WHERE id = $4',
        [newStatus, rejectReason, reviewerId, requestId]
      );

      if (newStatus === REVIEW_STATUS.APPROVED) {
         const account = await this.queryOne('SELECT * FROM savings_accounts WHERE family_id = $1 AND user_id = $2', [request.family_id, request.user_id]);
         if (account) {
           const newBalance = parseFloat(account.balance) + parseFloat(request.amount);
           await client.query('UPDATE savings_accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, account.id]);
           await client.query(
             `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description)
              VALUES ($1, $2, $3, $4, $5, $6)`,
             [uuidv4(), account.id, TRANSACTION_TYPE.DEPOSIT, request.amount, newBalance, request.description || '存款申请通过']
           );
         }
      }
    });

    return { status: newStatus, message: '审核完成' };
  }

  /**
   * 直接取款（管理员）
   */
  async withdraw(data) {
    const { accountId, operatorId, amount, description } = data;
    if (amount <= 0) throw new Error(ERROR_CODES.SAVINGS_AMOUNT_INVALID.message);

    if (!this.isDatabaseAvailable()) {
      let targetAccount = null;
      let accountKey = null;
      for (const [key, acc] of mockSavingsAccounts) {
        if (acc.id === accountId) { targetAccount = acc; accountKey = key; break; }
      }
      if (!targetAccount) throw new Error('找不到账户');
      if (amount > targetAccount.balance) throw new Error(ERROR_CODES.SAVINGS_BALANCE_INSUFFICIENT.message);

      targetAccount.balance -= amount;
      mockSavingsAccounts.set(accountKey, targetAccount);

      const trans = mockSavingsTransactions.get(accountId) || [];
      trans.unshift({
        id: uuidv4(),
        type: TRANSACTION_TYPE.WITHDRAW,
        amount,
        balanceAfter: targetAccount.balance,
        description: description || '管理员取款',
        createdAt: new Date()
      });
      mockSavingsTransactions.set(accountId, trans);

      return { type: TRANSACTION_TYPE.WITHDRAW, amount, balanceAfter: targetAccount.balance, message: '取款成功' };
    }

    const account = await this.queryOne('SELECT * FROM savings_accounts WHERE id = $1', [accountId]);
    if (!account) throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);
    await familyService.validateAdminRole(operatorId, account.family_id);

    if (amount > account.balance) throw new Error(ERROR_CODES.SAVINGS_BALANCE_INSUFFICIENT.message);

    const newBalance = parseFloat(account.balance) - amount;
    await this.transaction(async (client) => {
      await client.query('UPDATE savings_accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, accountId]);
      await client.query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), accountId, TRANSACTION_TYPE.WITHDRAW, amount, newBalance, description || '管理员取款']
      );
    });

    return { type: TRANSACTION_TYPE.WITHDRAW, amount, balanceAfter: newBalance, message: '取款成功' };
  }

  /**
   * 获取交易记录
   */
  async getTransactions(params) {
    const { accountId, page = 1, pageSize = 20 } = params;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    if (!this.isDatabaseAvailable()) {
      const transactions = mockSavingsTransactions.get(accountId) || [];
      const paginatedData = transactions.slice(offset, offset + parseInt(pageSize)).map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString()
      }));
      
      return {
        data: paginatedData,
        pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: transactions.length }
      };
    }

    const transactions = await this.queryMany(
      `SELECT st.* FROM savings_transactions st WHERE st.account_id = $1 ORDER BY st.created_at DESC LIMIT $2 OFFSET $3`,
      [accountId, parseInt(pageSize), offset]
    );

    const countResult = await this.queryOne('SELECT COUNT(*) as total FROM savings_transactions WHERE account_id = $1', [accountId]);

    return {
      data: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        balanceAfter: parseFloat(t.balance_after),
        description: t.description,
        createdAt: t.created_at
      })),
      pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: parseInt(countResult.total) }
    };
  }
}

module.exports = new SavingsService();
