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
  }
};

module.exports = {
  authApi,
  userApi,
  familyApi,
  choreApi,
  pointsApi,
  postApi
};
