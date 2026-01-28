// pages/profile/profile.js
const app = getApp();
const { userApi, familyApi, pointsApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    familyInfo: null,
    isAdmin: false,     // 是否管理员
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
    this.setData({ isLoggedIn: isLoggedIn() });
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
      this.getTabBar().updateTabBar();
    }
    
    const loggedIn = isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    
    if (loggedIn) {
      this.loadUserInfo();
      this.loadFamilyInfo();
      
      // 同步全局管理员状态
      this.setData({ isAdmin: app.globalData.isAdmin || false });
    }
  },
  
  // 去登录
  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 查看协议（未登录可访问）
  viewAgreement(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({ url: `/pages/profile/agreement?type=${type}` });
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
      // 首先检查用户信息中的 familyId（最可靠的判断）
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.familyId) {
        console.log('用户信息显示未加入家庭');
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          pointsSummary: { totalPoints: 0, thisMonth: 0 }
        });
        return;
      }
      
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        
        // 同步更新本地存储
        wx.setStorageSync('familyInfo', familyInfo);
        app.globalData.familyInfo = familyInfo;
        
        this.setData({ familyInfo });

        // 获取积分概览
        try {
          const pointsRes = await pointsApi.getSummary(familyInfo.id);
          this.setData({ pointsSummary: pointsRes.data || {} });
        } catch (e) {
          console.log('获取积分概览失败:', e);
        }
      } else {
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          pointsSummary: { totalPoints: 0, thisMonth: 0 }
        });
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

    // 清除本地存储和全局状态
    app.clearLoginState();

    showSuccess('已退出登录');
    
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/login/login' });
    }, 1000);
  }
});
