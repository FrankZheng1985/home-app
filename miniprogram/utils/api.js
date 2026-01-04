// utils/api.js
// API接口封装

const app = getApp();

/**
 * 认证相关接口
 */
const authApi = {
  // 微信登录
  wxLogin: (code) => {
    return app.request({
      url: '/auth/wx-login',
      method: 'POST',
      data: { code }
    });
  },
  
  // 注册/完善信息
  register: (data) => {
    return app.request({
      url: '/auth/register',
      method: 'POST',
      data
    });
  },
  
  // 验证token
  validate: () => {
    return app.request({
      url: '/auth/validate',
      method: 'GET'
    });
  }
};

/**
 * 用户相关接口
 */
const userApi = {
  // 获取用户信息
  getProfile: () => {
    return app.request({
      url: '/users/profile',
      method: 'GET'
    });
  },
  
  // 更新用户信息
  updateProfile: (data) => {
    return app.request({
      url: '/users/profile',
      method: 'PUT',
      data
    });
  },
  
  // 获取喜好设置
  getPreferences: () => {
    return app.request({
      url: '/users/preferences',
      method: 'GET'
    });
  },
  
  // 更新喜好设置
  updatePreferences: (preferences) => {
    return app.request({
      url: '/users/preferences',
      method: 'PUT',
      data: preferences
    });
  }
};

/**
 * 家庭相关接口
 */
const familyApi = {
  // 创建家庭
  create: (data) => {
    return app.request({
      url: '/families',
      method: 'POST',
      data
    });
  },
  
  // 获取家庭信息
  getInfo: (familyId) => {
    return app.request({
      url: `/families/${familyId}`,
      method: 'GET'
    });
  },
  
  // 获取我的家庭列表
  getMyFamilies: () => {
    return app.request({
      url: '/families/my',
      method: 'GET'
    });
  },
  
  // 通过邀请码加入家庭
  joinByCode: (inviteCode) => {
    return app.request({
      url: '/families/join',
      method: 'POST',
      data: { inviteCode }
    });
  },
  
  // 获取家庭成员列表
  getMembers: (familyId) => {
    return app.request({
      url: `/families/${familyId}/members`,
      method: 'GET'
    });
  },
  
  // 更新成员角色
  updateMemberRole: (familyId, memberId, role) => {
    return app.request({
      url: `/families/${familyId}/members/${memberId}/role`,
      method: 'PUT',
      data: { role }
    });
  },
  
  // 移除家庭成员
  removeMember: (familyId, memberId) => {
    return app.request({
      url: `/families/${familyId}/members/${memberId}`,
      method: 'DELETE'
    });
  },
  
  // 退出家庭
  leave: (familyId) => {
    return app.request({
      url: `/families/${familyId}/leave`,
      method: 'POST'
    });
  },
  
  // 生成邀请二维码
  generateQRCode: (familyId) => {
    return app.request({
      url: `/families/${familyId}/qrcode`,
      method: 'GET'
    });
  },
  
  // 更新家庭设置
  updateSettings: (familyId, settings) => {
    return app.request({
      url: `/families/${familyId}/settings`,
      method: 'PUT',
      data: settings
    });
  },
  
  // 更新积分价值
  updatePointsValue: (familyId, pointsValue) => {
    return app.request({
      url: `/families/${familyId}/points-value`,
      method: 'PUT',
      data: { pointsValue }
    });
  }
};

/**
 * 家务相关接口
 */
const choreApi = {
  // 获取家务类型列表
  getTypes: (familyId) => {
    return app.request({
      url: `/chores/types`,
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 创建家务类型
  createType: (data) => {
    return app.request({
      url: '/chores/types',
      method: 'POST',
      data
    });
  },
  
  // 更新家务类型
  updateType: (typeId, data) => {
    return app.request({
      url: `/chores/types/${typeId}`,
      method: 'PUT',
      data
    });
  },
  
  // 删除家务类型
  deleteType: (typeId) => {
    return app.request({
      url: `/chores/types/${typeId}`,
      method: 'DELETE'
    });
  },
  
  // 提交家务记录
  createRecord: (data) => {
    return app.request({
      url: '/chores/records',
      method: 'POST',
      data
    });
  },
  
  // 获取家务记录列表
  getRecords: (params) => {
    return app.request({
      url: '/chores/records',
      method: 'GET',
      data: params
    });
  },
  
  // 获取家务统计
  getStatistics: (familyId, params) => {
    return app.request({
      url: `/chores/statistics`,
      method: 'GET',
      data: { familyId, ...params }
    });
  },
  
  // 获取待审核的家务记录（管理员）
  getPendingRecords: (familyId) => {
    return app.request({
      url: '/chores/pending',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 获取待审核数量
  getPendingCount: (familyId) => {
    return app.request({
      url: '/chores/pending-count',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 审核家务记录（管理员）
  reviewRecord: (recordId, action, deduction, deductionReason, reviewNote) => {
    return app.request({
      url: '/chores/review',
      method: 'POST',
      data: { recordId, action, deduction, deductionReason, reviewNote }
    });
  }
};

/**
 * 积分相关接口
 */
const pointsApi = {
  // 获取积分概览
  getSummary: (familyId) => {
    return app.request({
      url: '/points/summary',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 获取积分统计
  getStatistics: () => {
    return app.request({
      url: '/points/statistics',
      method: 'GET'
    });
  },
  
  // 获取积分记录
  getTransactions: (params) => {
    return app.request({
      url: '/points/transactions',
      method: 'GET',
      data: params
    });
  },
  
  // 获取积分排行榜
  getRanking: (familyId) => {
    return app.request({
      url: '/points/ranking',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 获取月度统计
  getMonthStats: (params) => {
    return app.request({
      url: '/points/month-stats',
      method: 'GET',
      data: params
    });
  },
  
  // 获取成员积分列表
  getMembersPoints: (familyId) => {
    return app.request({
      url: '/points/members',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 积分兑现/结算
  redeemPoints: (data) => {
    return app.request({
      url: '/points/redeem',
      method: 'POST',
      data
    });
  }
};

/**
 * 动态相关接口
 */
const postApi = {
  // 获取动态列表
  getList: (params) => {
    return app.request({
      url: '/posts',
      method: 'GET',
      data: params
    });
  },
  
  // 发布动态
  create: (data) => {
    return app.request({
      url: '/posts',
      method: 'POST',
      data
    });
  },
  
  // 删除动态
  delete: (postId) => {
    return app.request({
      url: `/posts/${postId}`,
      method: 'DELETE'
    });
  },
  
  // 点赞/取消点赞
  like: (postId) => {
    return app.request({
      url: `/posts/${postId}/like`,
      method: 'POST'
    });
  },
  
  // 点赞/取消点赞（别名）
  toggleLike: (postId) => {
    return app.request({
      url: `/posts/${postId}/like`,
      method: 'POST'
    });
  },
  
  // 获取评论列表
  getComments: (postId) => {
    return app.request({
      url: `/posts/${postId}/comments`,
      method: 'GET'
    });
  },
  
  // 添加评论
  addComment: (postId, content) => {
    return app.request({
      url: `/posts/${postId}/comments`,
      method: 'POST',
      data: { content }
    });
  },
  
  // 删除评论
  deleteComment: (postId, commentId) => {
    return app.request({
      url: `/posts/${postId}/comments/${commentId}`,
      method: 'DELETE'
    });
  },
  
  // 获取动态详情
  getDetail: (postId) => {
    return app.request({
      url: `/posts/${postId}`,
      method: 'GET'
    });
  }
};

/**
 * 上传相关接口
 */
const uploadApi = {
  /**
   * 上传单张图片
   * @param {string} filePath 本地临时文件路径
   * @returns {Promise} 上传结果
   */
  uploadImage: (filePath) => {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      const baseUrl = app.globalData.baseUrl;
      
      wx.uploadFile({
        url: `${baseUrl}/upload/image`,
        filePath: filePath,
        name: 'file',
        header: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        success: (res) => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data);
              resolve(data);
            } catch (e) {
              reject(new Error('解析响应失败'));
            }
          } else {
            try {
              const data = JSON.parse(res.data);
              reject(new Error(data.error || '上传失败'));
            } catch (e) {
              reject(new Error('上传失败'));
            }
          }
        },
        fail: (err) => {
          console.error('上传图片失败:', err);
          reject(new Error('网络错误，上传失败'));
        }
      });
    });
  },
  
  /**
   * 批量上传图片
   * @param {Array<string>} filePaths 本地临时文件路径数组
   * @returns {Promise<Array>} 上传结果数组
   */
  uploadImages: async (filePaths) => {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const result = await uploadApi.uploadImage(filePath);
        results.push(result.data.url);
      } catch (error) {
        console.error('上传图片失败:', filePath, error);
        // 继续上传其他图片
      }
    }
    return results;
  }
};

/**
 * 存款相关接口
 */
const savingsApi = {
  // 获取存款账户
  getAccount: (familyId) => {
    return app.request({
      url: '/savings/account',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 获取家庭所有成员的存款账户（管理员）
  getFamilyAccounts: (familyId) => {
    return app.request({
      url: '/savings/family-accounts',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 获取交易记录
  getTransactions: (accountId, page = 1, pageSize = 20) => {
    return app.request({
      url: '/savings/transactions',
      method: 'GET',
      data: { accountId, page, pageSize }
    });
  },
  
  // 提交存款申请（普通用户）
  submitRequest: (accountId, amount, description) => {
    return app.request({
      url: '/savings/request',
      method: 'POST',
      data: { accountId, amount, description }
    });
  },
  
  // 获取申请列表
  getRequests: (familyId, status, page = 1, pageSize = 20) => {
    return app.request({
      url: '/savings/requests',
      method: 'GET',
      data: { familyId, status, page, pageSize }
    });
  },
  
  // 审核申请（管理员）
  reviewRequest: (requestId, action, rejectReason) => {
    return app.request({
      url: '/savings/review',
      method: 'POST',
      data: { requestId, action, rejectReason }
    });
  },
  
  // 获取待审核数量
  getPendingCount: (familyId) => {
    return app.request({
      url: '/savings/pending-count',
      method: 'GET',
      data: { familyId }
    });
  },
  
  // 直接存款（管理员）
  deposit: (accountId, amount, description) => {
    return app.request({
      url: '/savings/deposit',
      method: 'POST',
      data: { accountId, amount, description }
    });
  },
  
  // 直接取款（管理员）
  withdraw: (accountId, amount, description) => {
    return app.request({
      url: '/savings/withdraw',
      method: 'POST',
      data: { accountId, amount, description }
    });
  },
  
  // 结算利息
  settleInterest: (accountId) => {
    return app.request({
      url: '/savings/settle-interest',
      method: 'POST',
      data: { accountId }
    });
  },
  
  // 更新利率（仅创建人）
  updateRate: (accountId, annualRate) => {
    return app.request({
      url: '/savings/rate',
      method: 'PUT',
      data: { accountId, annualRate }
    });
  },
  
  // 设置子管理员（仅创建人）
  setSubAdmin: (familyId, memberId, isAdmin) => {
    return app.request({
      url: '/savings/set-sub-admin',
      method: 'POST',
      data: { familyId, memberId, isAdmin }
    });
  }
};

/**
 * 运动打卡相关接口
 */
const sportsApi = {
  // 获取运动类型列表
  getTypes: () => {
    return app.request({
      url: '/sports/types',
      method: 'GET'
    });
  },
  
  // 创建运动类型
  createType: (data) => {
    return app.request({
      url: '/sports/types',
      method: 'POST',
      data
    });
  },
  
  // 删除运动类型
  deleteType: (typeId) => {
    return app.request({
      url: `/sports/types/${typeId}`,
      method: 'DELETE'
    });
  },
  
  // 创建运动记录
  createRecord: (data) => {
    return app.request({
      url: '/sports/records',
      method: 'POST',
      data
    });
  },
  
  // 获取运动记录
  getRecords: (params) => {
    return app.request({
      url: '/sports/records',
      method: 'GET',
      data: params
    });
  },
  
  // 获取本周统计
  getWeekStats: () => {
    return app.request({
      url: '/sports/week-stats',
      method: 'GET'
    });
  },
  
  // 同步微信运动步数
  syncSteps: (data) => {
    return app.request({
      url: '/sports/sync-steps',
      method: 'POST',
      data
    });
  },
  
  // 获取今日步数
  getTodaySteps: () => {
    return app.request({
      url: '/sports/today-steps',
      method: 'GET'
    });
  },
  
  // 初始化默认运动类型
  initTypes: () => {
    return app.request({
      url: '/sports/init-types',
      method: 'POST'
    });
  },
  
  // 步数兑换积分
  redeemPoints: () => {
    return app.request({
      url: '/sports/redeem-points',
      method: 'POST'
    });
  }
};

module.exports = {
  authApi,
  userApi,
  familyApi,
  choreApi,
  pointsApi,
  postApi,
  uploadApi,
  savingsApi,
  sportsApi
};
