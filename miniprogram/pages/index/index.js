// pages/index/index.js
const app = getApp();
const { userApi, familyApi, choreApi, pointsApi, postApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    isLoggedIn: false,      // 是否已登录
    userInfo: null,
    hasFamily: false,
    familyInfo: null,
    isAdmin: false,         // 是否管理员
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
    // 检查登录状态，但不强制跳转
    const loggedIn = isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    
    if (loggedIn) {
      // 已登录，加载用户数据
      this.loadPageData();
    } else {
      // 未登录，显示引导页面
      this.setData({ isLoading: false });
    }
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
      this.getTabBar().updateTabBar();
    }
    
    // 页面显示时检查登录状态
    const loggedIn = isLoggedIn();
    const wasLoggedIn = this.data.isLoggedIn;
    
    this.setData({ isLoggedIn: loggedIn });
    
    if (loggedIn) {
      // 登录状态变化或已登录，刷新数据
      if (!wasLoggedIn || !this.data.isLoading) {
        this.loadPageData();
      }
    } else {
      this.setData({ isLoading: false });
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
      // 获取用户信息（最权威的数据来源）
      const userRes = await userApi.getProfile();
      const userInfo = userRes.data;
      this.setData({ userInfo });
      
      // 更新本地存储的用户信息
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.userInfo = userInfo;
      
      // 首先检查用户信息中的 familyId（最可靠的判断）
      if (!userInfo || !userInfo.familyId) {
        console.log('用户信息显示未加入家庭，清理本地缓存');
        // 用户没有家庭，清理旧数据
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({
          hasFamily: false,
          familyInfo: null,
          todayChores: [],
          pointsSummary: { totalPoints: 0, weekPoints: 0, rank: 0 },
          latestMoments: [],
          familyRanking: [],
          isLoading: false
        });
        return;
      }

      // 获取家庭列表
      const familiesRes = await familyApi.getMyFamilies();
      
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        
        // 同步更新本地存储
        wx.setStorageSync('familyInfo', familyInfo);
        app.globalData.familyInfo = familyInfo;
        
        this.setData({
          hasFamily: true,
          familyInfo
        });

        // 获取家庭成员列表，确定当前用户角色
        try {
          const membersRes = await familyApi.getMembers(familyInfo.id);
          const members = membersRes.data || [];
          const currentMember = members.find(m => m.userId === userInfo.id);
          
          if (currentMember) {
            const role = currentMember.role;
            const isAdmin = role === 'creator' || role === 'admin';
            
            app.globalData.familyRole = role;
            app.globalData.isCreator = role === 'creator';
            app.globalData.isAdmin = isAdmin;
            
            // 更新页面状态
            this.setData({ isAdmin });
            
            console.log('[首页] 用户角色:', role, 'isAdmin:', isAdmin);
            
            // 更新TabBar显示
            if (typeof this.getTabBar === 'function' && this.getTabBar()) {
              this.getTabBar().updateTabBar();
            }
          }
        } catch (e) {
          console.log('获取成员列表失败:', e);
        }

        // 获取家务统计
        try {
          const choreStatsRes = await choreApi.getStatistics(familyInfo.id, { period: 'today' });
          this.setData({ todayChores: choreStatsRes.data || [] });
        } catch (e) {
          console.log('获取家务统计失败:', e);
        }

        // 获取积分概览
        try {
          const pointsRes = await pointsApi.getSummary(familyInfo.id);
          this.setData({ pointsSummary: pointsRes.data || {} });
        } catch (e) {
          console.log('获取积分概览失败:', e);
        }

        // 获取积分排行
        try {
          const rankingRes = await pointsApi.getRanking(familyInfo.id);
          this.setData({ familyRanking: (rankingRes.data || []).slice(0, 3) });
        } catch (e) {
          console.log('获取积分排行失败:', e);
        }

        // 获取最新动态
        try {
          const momentsRes = await postApi.getList({ familyId: familyInfo.id, limit: 3 });
          this.setData({ latestMoments: momentsRes.data || [] });
        } catch (e) {
          console.log('获取最新动态失败:', e);
        }
      } else {
        // 清理本地存储中的旧家庭信息，保持数据一致性
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({
          hasFamily: false,
          familyInfo: null,
          todayChores: [],
          pointsSummary: { totalPoints: 0, weekPoints: 0, rank: 0 },
          latestMoments: [],
          familyRanking: []
        });
      }
    } catch (error) {
      console.error('加载首页数据失败:', error);
      // 不显示错误提示，使用空状态
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 检查登录状态，未登录则引导登录
  checkLoginAndGo(callback) {
    if (!isLoggedIn()) {
      wx.showModal({
        title: '需要登录',
        content: '该功能需要登录后才能使用，是否前往登录？',
        confirmText: '去登录',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return false;
    }
    if (callback) callback();
    return true;
  },

  // 去登录
  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 预览家务功能（未登录）
  previewChores() {
    wx.switchTab({ url: '/pages/chores/chores' });
  },

  // 预览运动功能（未登录）
  previewSports() {
    wx.switchTab({ url: '/pages/sports/sports' });
  },

  // 预览奖励功能（未登录）
  previewRewards() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/rewards/rewards' });
    });
  },

  // 预览动态功能（未登录）
  previewMoments() {
    wx.switchTab({ url: '/pages/moments/moments' });
  },

  // 创建家庭
  goToCreateFamily() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/family/create' });
    });
  },

  // 加入家庭
  goToJoinFamily() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/family/join' });
    });
  },

  // 去记录家务
  goToRecordChore() {
    this.checkLoginAndGo(() => {
      wx.switchTab({ url: '/pages/chores/chores' });
    });
  },

  // 查看积分详情
  goToPointsDetail() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/profile/points' });
    });
  },

  // 查看动态列表
  goToMoments() {
    this.checkLoginAndGo(() => {
      wx.switchTab({ url: '/pages/moments/moments' });
    });
  },

  // 查看动态详情
  goToMomentDetail(e) {
    this.checkLoginAndGo(() => {
      const postId = e.currentTarget.dataset.id;
      wx.navigateTo({ url: `/pages/moments/comments?postId=${postId}` });
    });
  },

  // 查看家庭管理
  goToFamily() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/family/family' });
    });
  },

  // 查看我的存款
  goToSavings() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/savings/savings' });
    });
  },

  // 查看奖励设置
  goToRewards() {
    this.checkLoginAndGo(() => {
      wx.navigateTo({ url: '/pages/rewards/rewards' });
    });
  },

  // 运动打卡
  goToSports() {
    this.checkLoginAndGo(() => {
      wx.switchTab({ url: '/pages/sports/sports' });
    });
  }
});
