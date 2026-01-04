// src/services/savingsService.js
// 存款服务层 - 处理存款相关业务逻辑

const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');
const { REVIEW_STATUS, TRANSACTION_TYPE } = require('../constants/statusCodes');

class SavingsService extends BaseService {
  /**
   * 计算待发利息（复利）
   * @param {number} balance - 当前余额
   * @param {number} annualRate - 年利率
   * @param {Date} lastInterestDate - 上次计息日期
   * @returns {Object}
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
   * @param {string} userId - 用户ID
   * @param {string} familyId - 家庭ID
   * @returns {Promise<Object>}
   */
  async getOrCreateAccount(userId, familyId) {
    if (!this.isDatabaseAvailable()) {
      throw new Error(ERROR_CODES.DATABASE_NOT_CONFIGURED.message);
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
        annual_rate: 0.03,
        last_interest_date: new Date()
      });

      account = await this.queryOne(
        'SELECT * FROM savings_accounts WHERE id = $1',
        [accountId]
      );
    }

    return account;
  }

  /**
   * 获取账户详情
   * @param {string} userId - 用户ID
   * @param {string} familyId - 家庭ID
   * @returns {Promise<Object>}
   */
  async getAccountDetail(userId, familyId) {
    const account = await this.getOrCreateAccount(userId, familyId);
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);

    // 计算待发利息
    const pendingInterest = this.calculatePendingInterest(
      parseFloat(account.balance),
      parseFloat(account.annual_rate),
      account.last_interest_date
    );

    // 获取用户信息
    const user = await this.queryOne(
      'SELECT nickname, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    // 获取待审核数量
    const pendingCount = await this.queryOne(
      `SELECT COUNT(*) as count FROM savings_requests 
       WHERE account_id = $1 AND status = $2`,
      [account.id, REVIEW_STATUS.PENDING]
    );

    return {
      id: account.id,
      balance: parseFloat(account.balance),
      totalInterest: parseFloat(account.total_interest),
      annualRate: parseFloat(account.annual_rate),
      dailyRate: parseFloat(account.annual_rate) / 365,
      lastInterestDate: account.last_interest_date,
      pendingInterest: pendingInterest.interest,
      pendingDays: pendingInterest.days,
      projectedBalance: pendingInterest.newBalance,
      userNickname: user?.nickname,
      userAvatar: user?.avatar_url,
      isAdmin,
      pendingRequestCount: parseInt(pendingCount?.count || 0),
      createdAt: account.created_at
    };
  }

  /**
   * 获取家庭所有成员的存款账户
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 请求用户ID
   * @returns {Promise<Array>}
   */
  async getFamilyAccounts(familyId, userId) {
    await familyService.validateAdminRole(userId, familyId);

    const accounts = await this.queryMany(
      `SELECT sa.*, u.nickname, u.avatar_url
       FROM savings_accounts sa
       JOIN users u ON sa.user_id = u.id
       WHERE sa.family_id = $1
       ORDER BY sa.balance DESC`,
      [familyId]
    );

    return accounts.map(account => {
      const pendingInterest = this.calculatePendingInterest(
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
  }

  /**
   * 提交存款申请
   * @param {Object} data - 申请数据
   * @returns {Promise<Object>}
   */
  async submitDepositRequest(data) {
    const { accountId, userId, amount, description } = data;

    if (amount <= 0) {
      throw new Error(ERROR_CODES.SAVINGS_AMOUNT_INVALID.message);
    }

    // 验证账户存在
    const account = await this.queryOne(
      'SELECT * FROM savings_accounts WHERE id = $1',
      [accountId]
    );

    if (!account) {
      throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);
    }

    const requestId = uuidv4();
    await this.insert('savings_requests', {
      id: requestId,
      account_id: accountId,
      user_id: userId,
      type: TRANSACTION_TYPE.DEPOSIT,
      amount,
      description: description || '存款申请',
      status: REVIEW_STATUS.PENDING
    });

    logger.audit('提交存款申请', userId, { accountId, amount });

    return {
      requestId,
      type: TRANSACTION_TYPE.DEPOSIT,
      amount,
      status: REVIEW_STATUS.PENDING,
      message: '存款申请已提交，请等待管理员审核'
    };
  }

  /**
   * 审核存款申请
   * @param {Object} data - 审核数据
   * @returns {Promise<Object>}
   */
  async reviewRequest(data) {
    const { requestId, reviewerId, action, rejectReason } = data;

    // 获取申请详情
    const request = await this.queryOne(
      `SELECT sr.*, sa.family_id, sa.balance
       FROM savings_requests sr
       JOIN savings_accounts sa ON sr.account_id = sa.id
       WHERE sr.id = $1`,
      [requestId]
    );

    if (!request) {
      throw new Error(ERROR_CODES.SAVINGS_REQUEST_NOT_FOUND.message);
    }

    if (request.status !== REVIEW_STATUS.PENDING) {
      throw new Error(ERROR_CODES.SAVINGS_REQUEST_ALREADY_PROCESSED.message);
    }

    // 验证审核权限
    await familyService.validateAdminRole(reviewerId, request.family_id);

    if (action === 'approve') {
      const currentBalance = parseFloat(request.balance);
      const amount = parseFloat(request.amount);
      let newBalance;

      if (request.type === TRANSACTION_TYPE.DEPOSIT) {
        newBalance = currentBalance + amount;
      } else {
        if (amount > currentBalance) {
          throw new Error(ERROR_CODES.SAVINGS_BALANCE_INSUFFICIENT.message);
        }
        newBalance = currentBalance - amount;
      }

      // 使用事务更新
      await this.transaction(async (client) => {
        // 更新账户余额
        await client.query(
          'UPDATE savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
          [newBalance, request.account_id]
        );

        // 记录交易
        await client.query(
          `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), request.account_id, request.type, amount, newBalance, request.description, reviewerId]
        );

        // 更新申请状态
        await client.query(
          `UPDATE savings_requests 
           SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
           WHERE id = $3`,
          [REVIEW_STATUS.APPROVED, reviewerId, requestId]
        );
      });

      logger.audit('审核通过存款申请', reviewerId, { requestId, amount, newBalance });

      return {
        requestId,
        status: REVIEW_STATUS.APPROVED,
        newBalance,
        message: '审核通过，金额已到账'
      };
    } else {
      // 拒绝
      await this.update('savings_requests', {
        status: REVIEW_STATUS.REJECTED,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        reject_reason: rejectReason || '审核未通过',
        updated_at: new Date()
      }, { id: requestId });

      logger.audit('拒绝存款申请', reviewerId, { requestId, reason: rejectReason });

      return {
        requestId,
        status: REVIEW_STATUS.REJECTED,
        message: '已拒绝该申请'
      };
    }
  }

  /**
   * 直接存款（管理员）
   * @param {Object} data - 存款数据
   * @returns {Promise<Object>}
   */
  async deposit(data) {
    const { accountId, operatorId, amount, description } = data;

    if (amount <= 0) {
      throw new Error(ERROR_CODES.SAVINGS_AMOUNT_INVALID.message);
    }

    // 获取账户和权限
    const result = await this.queryOne(
      `SELECT sa.*, fm.role 
       FROM savings_accounts sa
       JOIN family_members fm ON fm.family_id = sa.family_id AND fm.user_id = $2
       WHERE sa.id = $1`,
      [accountId, operatorId]
    );

    if (!result) {
      throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);
    }

    const { isAdmin } = await familyService.checkMemberRole(operatorId, result.family_id);
    if (!isAdmin) {
      throw new Error(ERROR_CODES.FAMILY_ADMIN_REQUIRED.message);
    }

    const newBalance = parseFloat(result.balance) + amount;

    // 更新余额并记录交易
    await this.transaction(async (client) => {
      await client.query(
        'UPDATE savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, accountId]
      );

      await client.query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), accountId, TRANSACTION_TYPE.DEPOSIT, amount, newBalance, description || '管理员存款', operatorId]
      );
    });

    logger.audit('管理员存款', operatorId, { accountId, amount, newBalance });

    return {
      type: TRANSACTION_TYPE.DEPOSIT,
      amount,
      balanceAfter: newBalance,
      message: '存款成功'
    };
  }

  /**
   * 直接取款（管理员）
   * @param {Object} data - 取款数据
   * @returns {Promise<Object>}
   */
  async withdraw(data) {
    const { accountId, operatorId, amount, description } = data;

    if (amount <= 0) {
      throw new Error(ERROR_CODES.SAVINGS_AMOUNT_INVALID.message);
    }

    const result = await this.queryOne(
      `SELECT sa.*, fm.role 
       FROM savings_accounts sa
       JOIN family_members fm ON fm.family_id = sa.family_id AND fm.user_id = $2
       WHERE sa.id = $1`,
      [accountId, operatorId]
    );

    if (!result) {
      throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);
    }

    const { isAdmin } = await familyService.checkMemberRole(operatorId, result.family_id);
    if (!isAdmin) {
      throw new Error(ERROR_CODES.FAMILY_ADMIN_REQUIRED.message);
    }

    const currentBalance = parseFloat(result.balance);
    if (amount > currentBalance) {
      throw new Error(ERROR_CODES.SAVINGS_BALANCE_INSUFFICIENT.message);
    }

    const newBalance = currentBalance - amount;

    await this.transaction(async (client) => {
      await client.query(
        'UPDATE savings_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, accountId]
      );

      await client.query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), accountId, TRANSACTION_TYPE.WITHDRAW, amount, newBalance, description || '管理员取款', operatorId]
      );
    });

    logger.audit('管理员取款', operatorId, { accountId, amount, newBalance });

    return {
      type: TRANSACTION_TYPE.WITHDRAW,
      amount,
      balanceAfter: newBalance,
      message: '取款成功'
    };
  }

  /**
   * 结算利息
   * @param {string} accountId - 账户ID
   * @param {string} operatorId - 操作人ID
   * @returns {Promise<Object>}
   */
  async settleInterest(accountId, operatorId) {
    const account = await this.queryOne(
      'SELECT * FROM savings_accounts WHERE id = $1',
      [accountId]
    );

    if (!account) {
      throw new Error(ERROR_CODES.SAVINGS_ACCOUNT_NOT_FOUND.message);
    }

    const pendingInterest = this.calculatePendingInterest(
      parseFloat(account.balance),
      parseFloat(account.annual_rate),
      account.last_interest_date
    );

    if (pendingInterest.interest <= 0) {
      throw new Error(ERROR_CODES.SAVINGS_NO_INTEREST.message);
    }

    const newBalance = pendingInterest.newBalance;
    const newTotalInterest = parseFloat(account.total_interest) + pendingInterest.interest;

    await this.transaction(async (client) => {
      await client.query(
        `UPDATE savings_accounts 
         SET balance = $1, total_interest = $2, last_interest_date = CURRENT_DATE, updated_at = NOW() 
         WHERE id = $3`,
        [newBalance, newTotalInterest, accountId]
      );

      await client.query(
        `INSERT INTO savings_transactions (id, account_id, type, amount, balance_after, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), accountId, TRANSACTION_TYPE.INTEREST, pendingInterest.interest, newBalance,
         `${pendingInterest.days}天利息结算`, operatorId]
      );
    });

    logger.audit('结算利息', operatorId, { 
      accountId, 
      interest: pendingInterest.interest, 
      days: pendingInterest.days 
    });

    return {
      type: TRANSACTION_TYPE.INTEREST,
      amount: pendingInterest.interest,
      days: pendingInterest.days,
      balanceAfter: newBalance,
      totalInterest: newTotalInterest,
      message: '利息结算成功'
    };
  }

  /**
   * 获取交易记录
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>}
   */
  async getTransactions(params) {
    const { accountId, page = 1, pageSize = 20 } = params;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const transactions = await this.queryMany(
      `SELECT st.*, u.nickname as operator_name
       FROM savings_transactions st
       LEFT JOIN users u ON st.created_by = u.id
       WHERE st.account_id = $1
       ORDER BY st.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, parseInt(pageSize), offset]
    );

    const countResult = await this.queryOne(
      'SELECT COUNT(*) as total FROM savings_transactions WHERE account_id = $1',
      [accountId]
    );

    return {
      data: transactions.map(t => ({
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
        total: parseInt(countResult.total)
      }
    };
  }

  /**
   * 更新年利率
   * @param {Object} data - 更新数据
   * @returns {Promise<Object>}
   */
  async updateRate(data) {
    const { accountId, operatorId, annualRate } = data;

    if (annualRate < 0 || annualRate > 1) {
      throw new Error(ERROR_CODES.SAVINGS_RATE_INVALID.message);
    }

    // 检查是否为创建人
    const result = await this.queryOne(
      `SELECT fm.role 
       FROM savings_accounts sa
       JOIN family_members fm ON fm.family_id = sa.family_id AND fm.user_id = $2
       WHERE sa.id = $1`,
      [accountId, operatorId]
    );

    if (!result || result.role !== 'creator') {
      throw new Error(ERROR_CODES.FAMILY_CREATOR_REQUIRED.message);
    }

    await this.update('savings_accounts', {
      annual_rate: annualRate,
      updated_at: new Date()
    }, { id: accountId });

    logger.audit('更新利率', operatorId, { accountId, annualRate });

    return {
      annualRate,
      message: '利率更新成功'
    };
  }

  /**
   * 获取待审核数量
   * @param {string} familyId - 家庭ID
   * @param {string} userId - 用户ID
   * @returns {Promise<number>}
   */
  async getPendingCount(familyId, userId) {
    const { isAdmin } = await familyService.checkMemberRole(userId, familyId);
    if (!isAdmin) {
      return 0;
    }

    const result = await this.queryOne(
      `SELECT COUNT(*) as count 
       FROM savings_requests sr
       JOIN savings_accounts sa ON sr.account_id = sa.id
       WHERE sa.family_id = $1 AND sr.status = $2`,
      [familyId, REVIEW_STATUS.PENDING]
    );

    return parseInt(result?.count || 0);
  }
}

module.exports = new SavingsService();

