// pages/moments/moments.js - 家庭活动记录（系统自动生成，非UGC）
const app = getApp();
const { postApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, formatRelativeTime, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    userInfo: null,
    activities: [], // 活动记录列表
    isLoadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    currentUserId: null,
    // 活动类型筛选
    filterType: 'all', // all, chore, sport, savings, points
    filterTypes: [
      { key: 'all', name: '全部', icon: '📋' },
      { key: 'chore', name: '家务', icon: '🧹' },
      { key: 'sport', name: '运动', icon: '🏃' },
      { key: 'savings', name: '储蓄', icon: '💰' },
      { key: 'points', name: '积分', icon: '🎁' }
    ]
  },

  onLoad() {
    this.setData({ isLoggedIn: isLoggedIn() });
    if (isLoggedIn()) {
      this.loadFamilyInfo();
    }
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
      this.getTabBar().updateTabBar();
    }
    
    const loggedIn = isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    
    if (!loggedIn) return;
    
    this.loadActivities(true);
  },
  
  // 去登录
  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    this.loadActivities(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.isLoadingMore && this.data.hasMore) {
      this.loadActivities();
    }
  },

  async loadFamilyInfo() {
    try {
      // 获取当前用户信息
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ 
          currentUserId: userInfo.id,
          userInfo: userInfo
        });
      }
      
      // 首先检查用户信息中的 familyId（最可靠的判断）
      if (!userInfo || !userInfo.familyId) {
        console.log('用户信息显示未加入家庭');
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          activities: []
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
      } else {
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          activities: []
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  // 加载活动记录
  async loadActivities(reset = false) {
    if (!this.data.familyInfo) return;

    if (reset) {
      this.setData({ page: 1, hasMore: true, activities: [] });
    }

    if (!this.data.hasMore) return;

    try {
      this.setData({ isLoadingMore: true });
      
      const offset = (this.data.page - 1) * this.data.pageSize;
      
      const res = await postApi.getActivityList({
        familyId: this.data.familyInfo.id,
        limit: this.data.pageSize,
        offset: offset
      });

      let newActivities = res.data || [];
      
      // 根据筛选类型过滤
      if (this.data.filterType !== 'all') {
        newActivities = newActivities.filter(item => item.type === this.data.filterType);
      }
      
      // 格式化时间
      newActivities = newActivities.map(activity => ({
        ...activity,
        createdAtText: formatRelativeTime(activity.createdAt),
        user: activity.user || { nickname: '家人', avatarUrl: '' }
      }));

      this.setData({
        activities: reset ? newActivities : [...this.data.activities, ...newActivities],
        hasMore: res.hasMore !== false && newActivities.length === this.data.pageSize,
        page: this.data.page + 1,
        isLoadingMore: false
      });
    } catch (error) {
      console.error('加载活动记录失败:', error);
      this.setData({ isLoadingMore: false });
    }
  },

  // 切换筛选类型
  onFilterChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.filterType) return;
    
    this.setData({ filterType: type });
    this.loadActivities(true);
  },

  // 跳转到对应模块
  goToModule(e) {
    const type = e.currentTarget.dataset.type;
    const moduleMap = {
      'chore': '/pages/chores/chores',
      'sport': '/pages/sports/sports',
      'savings': '/pages/savings/savings',
      'points': '/pages/profile/points'
    };
    
    const url = moduleMap[type];
    if (url) {
      wx.navigateTo({ url });
    }
  },

  // 页面分享配置
  onShareAppMessage() {
    return {
      title: '家庭活动记录 - 记录每一次努力',
      path: '/pages/moments/moments'
    };
  }
});
