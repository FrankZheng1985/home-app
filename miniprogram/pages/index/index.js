// pages/index/index.js
const app = getApp();
const { userApi, familyApi, choreApi, pointsApi, postApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    userInfo: null,
    hasFamily: false,
    familyInfo: null,
    todayChores: [],
    pointsSummary: {
      totalPoints: 0,
      weekPoints: 0,
      rank: 0
    },
    latestMoments: [],
    familyRanking: [],
    isLoading: true
  },

  onLoad() {
    // 检查登录状态
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadPageData();
  },

  onShow() {
    // 页面显示时刷新数据，但需要先检查登录状态
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    if (!this.data.isLoading) {
      this.loadPageData();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadPageData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadPageData() {
    this.setData({ isLoading: true });

    try {
      // 获取用户信息
      const userRes = await userApi.getProfile();
      const userInfo = userRes.data;
      this.setData({ userInfo });

      // 获取家庭列表
      const familiesRes = await familyApi.getMyFamilies();
      
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        this.setData({
          hasFamily: true,
          familyInfo
        });

        // 获取家务统计
        const choreStatsRes = await choreApi.getStatistics(familyInfo.id, { period: 'today' });
        this.setData({ todayChores: choreStatsRes.data || [] });

        // 获取积分概览
        const pointsRes = await pointsApi.getSummary(familyInfo.id);
        this.setData({ pointsSummary: pointsRes.data || {} });

        // 获取积分排行
        const rankingRes = await pointsApi.getRanking(familyInfo.id);
        this.setData({ familyRanking: (rankingRes.data || []).slice(0, 3) });

        // 获取最新动态
        const momentsRes = await postApi.getList({ familyId: familyInfo.id, limit: 3 });
        this.setData({ latestMoments: momentsRes.data || [] });
      } else {
        this.setData({
          hasFamily: false,
          familyInfo: null
        });
      }
    } catch (error) {
      console.error('加载首页数据失败:', error);
      // 不显示错误提示，使用空状态
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 创建家庭
  goToCreateFamily() {
    wx.navigateTo({ url: '/pages/family/create' });
  },

  // 加入家庭
  goToJoinFamily() {
    wx.navigateTo({ url: '/pages/family/join' });
  },

  // 去记录家务
  goToRecordChore() {
    wx.switchTab({ url: '/pages/chores/chores' });
  },

  // 查看积分详情
  goToPointsDetail() {
    wx.navigateTo({ url: '/pages/profile/points' });
  },

  // 查看动态详情
  goToMoments() {
    wx.switchTab({ url: '/pages/moments/moments' });
  },

  // 查看家庭管理
  goToFamily() {
    wx.navigateTo({ url: '/pages/family/family' });
  },

  // 查看我的存款
  goToSavings() {
    wx.navigateTo({ url: '/pages/savings/savings' });
  },

  // 查看奖励设置
  goToRewards() {
    wx.navigateTo({ url: '/pages/rewards/rewards' });
  }
});
