// pages/profile/profile.js
const app = getApp();
const { userApi, familyApi, pointsApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    familyInfo: null,
    pointsSummary: {
      totalPoints: 0,
      thisMonth: 0
    },
    menuItems: [
      { id: 'preferences', icon: '💝', title: '我的喜好', url: '/pages/profile/preferences' },
      { id: 'points', icon: '💰', title: '积分明细', url: '/pages/profile/points' },
      { id: 'family', icon: '👥', title: '家庭管理', url: '/pages/family/family' },
      { id: 'feedback', icon: '📝', title: '意见反馈', url: '/pages/profile/feedback' },
      { id: 'about', icon: 'ℹ️', title: '关于我们', url: '/pages/profile/about' }
    ]
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
  },

  onShow() {
    this.loadUserInfo();
    this.loadFamilyInfo();
  },

  async loadUserInfo() {
    try {
      const res = await userApi.getProfile();
      this.setData({ userInfo: res.data });
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  async loadFamilyInfo() {
    try {
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        this.setData({ familyInfo });

        // 获取积分概览
        const pointsRes = await pointsApi.getSummary(familyInfo.id);
        this.setData({ pointsSummary: pointsRes.data || {} });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  // 去编辑资料
  goToEdit() {
    wx.navigateTo({ url: '/pages/profile/edit' });
  },

  // 菜单点击
  onMenuTap(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },

  // 退出登录
  async logout() {
    const confirmed = await showConfirm({
      title: '退出登录',
      content: '确定要退出登录吗？'
    });

    if (!confirmed) return;

    // 清除本地存储
    wx.clearStorageSync();
    app.globalData.userInfo = null;
    app.globalData.familyInfo = null;
    app.globalData.token = null;

    showSuccess('已退出登录');
    
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/login/login' });
    }, 1000);
  }
});
