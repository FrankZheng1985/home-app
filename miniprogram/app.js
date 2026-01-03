// app.js
App({
  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = wx.getStorageSync('userInfo');
      this.globalData.familyInfo = wx.getStorageSync('familyInfo');
      // 已登录，跳转到首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 100);
    }
    // 未登录时，停留在登录页（登录页是首页）

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
    // 后端服务地址配置
    // 开发环境用 localhost，生产环境用 Render
    // backendUrl: 'http://localhost:3000', // 本地开发
    backendUrl: 'https://family-assistant-api.onrender.com', // 生产环境 Render
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
    wx.clearStorageSync();
  },

  /**
   * 检查是否登录
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!this.globalData.token;
  }
});
