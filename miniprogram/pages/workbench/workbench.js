// pages/workbench/workbench.js
const app = getApp();
const { choreApi, savingsApi, pointsApi, familyApi } = require('../../utils/api');
const { isLoggedIn } = require('../../utils/util');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    familyInfo: null,
    isAdmin: false,
    isCreator: false,
    isLoading: true,
    
    // 待审核数量
    pendingCounts: {
      chores: 0,      // 待审核家务
      savings: 0,     // 待审核储蓄
      redeem: 0       // 待审核兑换
    },
    totalPending: 0,
    
    // 家庭成员数量
    memberCount: 0
  },

  onLoad() {
    const loggedIn = isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    
    if (loggedIn) {
      this.loadData();
    } else {
      this.setData({ isLoading: false });
    }
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    
    const loggedIn = isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    
    if (loggedIn) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ isLoading: true });
    
    try {
      // 获取用户信息
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      const familyInfo = app.globalData.familyInfo || wx.getStorageSync('familyInfo');
      
      if (!familyInfo) {
        this.setData({
          isLoading: false,
          userInfo,
          familyInfo: null
        });
        return;
      }

      // 获取家庭成员列表以确定角色
      const membersRes = await familyApi.getMembers(familyInfo.id);
      const members = membersRes.data || [];
      const currentMember = members.find(m => m.userId === userInfo.id);
      
      const isCreator = currentMember?.role === 'creator';
      const isAdmin = currentMember?.role === 'creator' || currentMember?.role === 'admin';
      
      // 更新全局状态
      app.globalData.isAdmin = isAdmin;
      app.globalData.isCreator = isCreator;
      app.globalData.familyRole = currentMember?.role;
      
      this.setData({
        userInfo,
        familyInfo,
        isAdmin,
        isCreator,
        memberCount: members.length
      });
      
      // 如果是管理员，获取待审核数量
      if (isAdmin) {
        await this.loadPendingCounts(familyInfo.id);
      }
      
    } catch (error) {
      console.error('加载工作台数据失败:', error);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadPendingCounts(familyId) {
    try {
      // 并行获取各项待审核数量
      const [choresRes, savingsRes, redeemRes] = await Promise.all([
        choreApi.getPendingCount(familyId).catch(() => ({ data: { count: 0 } })),
        savingsApi.getPendingCount(familyId).catch(() => ({ data: { count: 0 } })),
        pointsApi.getPendingRedeemCount(familyId).catch(() => ({ data: { count: 0 } }))
      ]);
      
      const pendingCounts = {
        chores: choresRes.data?.count || 0,
        savings: savingsRes.data?.count || 0,
        redeem: redeemRes.data?.count || 0
      };
      
      const totalPending = pendingCounts.chores + pendingCounts.savings + pendingCounts.redeem;
      
      this.setData({ pendingCounts, totalPending });
      
    } catch (error) {
      console.error('获取待审核数量失败:', error);
    }
  },

  // 导航到家务审核
  goToChoreReview() {
    wx.switchTab({
      url: '/pages/chores/chores',
      success: () => {
        // 通知家务页面切换到审核tab
        const pages = getCurrentPages();
        const choresPage = pages.find(p => p.route === 'pages/chores/chores');
        if (choresPage) {
          choresPage.setData({ activeTab: 'review' });
        }
      }
    });
  },

  // 导航到储蓄审核
  goToSavingsReview() {
    wx.navigateTo({
      url: '/pages/savings/savings?tab=review'
    });
  },

  // 导航到兑换审核
  goToRedeemReview() {
    wx.navigateTo({
      url: '/pages/profile/redeem-review'
    });
  },

  // 导航到成员管理
  goToMemberManage() {
    wx.navigateTo({
      url: '/pages/family/family'
    });
  },

  // 导航到运动打卡
  goToSports() {
    wx.switchTab({
      url: '/pages/sports/sports'
    });
  },

  // 导航到物资管理
  goToInventory() {
    wx.navigateTo({
      url: '/pages/inventory/inventory'
    });
  },

  // 导航到奖励设置
  goToRewards() {
    wx.navigateTo({
      url: '/pages/rewards/rewards'
    });
  },

  // 导航到积分明细
  goToPoints() {
    wx.navigateTo({
      url: '/pages/profile/points'
    });
  },

  // 去登录
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  }
});
