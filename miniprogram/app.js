// app.js
App({
  onLaunch() {
    // 恢复登录状态（如果有）
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = wx.getStorageSync('userInfo');
      this.globalData.familyInfo = wx.getStorageSync('familyInfo');
    }
    // 不强制跳转，让用户先浏览首页体验功能

    // 获取系统信息（使用新版 API 避免弃用警告）
    this.initSystemInfo();
  },

  // 初始化系统信息
  initSystemInfo() {
    try {
      // 使用新版 API
      const windowInfo = wx.getWindowInfo();
      const appBaseInfo = wx.getAppBaseInfo();
      const deviceInfo = wx.getDeviceInfo();
      
      this.globalData.systemInfo = {
        ...windowInfo,
        ...appBaseInfo,
        ...deviceInfo
      };
      this.globalData.statusBarHeight = windowInfo.statusBarHeight || 0;
      this.globalData.safeAreaBottom = windowInfo.screenHeight - (windowInfo.safeArea?.bottom || windowInfo.screenHeight);
    } catch (e) {
      // 兼容旧版本，降级使用旧 API
      console.warn('新版 API 不支持，降级使用 getSystemInfoSync');
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      this.globalData.statusBarHeight = systemInfo.statusBarHeight || 0;
      this.globalData.safeAreaBottom = systemInfo.screenHeight - (systemInfo.safeArea?.bottom || systemInfo.screenHeight);
    }
  },

  globalData: {
    userInfo: null,
    familyInfo: null,
    token: null,
    // 角色状态
    isAdmin: false,       // 是否管理员（creator 或 admin）
    isCreator: false,     // 是否创建人
    familyRole: null,     // 'creator' | 'admin' | 'member'
    // ============================================
    // 后端服务地址配置
    // ============================================
    // 📍 本地开发测试：使用下面这组
    backendUrl: 'https://api.family-app.com.cn',
    baseUrl: 'https://api.family-app.com.cn/api',
    // --------------------------------------------
    // 🚀 提交审核/发布：使用下面这组（注释掉上面的，取消注释下面的）
    // backendUrl: 'https://api.family-app.com.cn',
    // baseUrl: 'https://api.family-app.com.cn/api',
    // ============================================
    systemInfo: null,
    statusBarHeight: 0,
    safeAreaBottom: 0
  },

  /**
   * 统一请求方法
   * @param {Object} options 请求配置
   * @returns {Promise}
   */
  request(options) {
    const { url, method = 'GET', data = {}, header = {} } = options;
    const token = this.globalData.token || wx.getStorageSync('token');
    
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.backendUrl + '/api' + url,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...header
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // Token过期，清除登录状态
            this.clearLoginState();
            wx.redirectTo({ url: '/pages/login/login' });
            reject({ message: '登录已过期，请重新登录' });
          } else {
            reject(res.data || { message: '请求失败' });
          }
        },
        fail: (err) => {
          console.error('请求失败:', err);
          reject({ message: '网络请求失败，请检查网络连接' });
        }
      });
    });
  },

  /**
   * 清除登录状态
   */
  clearLoginState() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    this.globalData.familyInfo = null;
    this.globalData.isAdmin = false;
    this.globalData.isCreator = false;
    this.globalData.familyRole = null;
    wx.clearStorageSync();
  },

  /**
   * 更新角色状态
   * @param {string} role - 用户角色 'creator' | 'admin' | 'member'
   */
  updateRoleState(role) {
    this.globalData.familyRole = role;
    this.globalData.isCreator = role === 'creator';
    this.globalData.isAdmin = role === 'creator' || role === 'admin';
    
    // 通知所有页面的TabBar更新
    this.updateAllTabBars();
  },

  /**
   * 更新所有页面的TabBar显示
   */
  updateAllTabBars() {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (typeof page.getTabBar === 'function' && page.getTabBar()) {
        page.getTabBar().updateTabBar();
      }
    });
  },

  /**
   * 检查是否登录
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!this.globalData.token;
  }
});
