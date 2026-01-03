// pages/login/login.js
const app = getApp();
const { authApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    isLogging: false
  },

  onLoad() {
    // 检查是否已登录
    const token = wx.getStorageSync('token');
    if (token) {
      this.validateAndRedirect();
    }
  },

  // 验证token并跳转
  async validateAndRedirect() {
    try {
      const result = await authApi.validate();
      if (result.data && result.data.valid) {
        wx.switchTab({ url: '/pages/index/index' });
      }
    } catch (error) {
      // token无效，清除本地存储
      wx.clearStorageSync();
    }
  },

  // 微信登录
  async wxLogin() {
    if (this.data.isLogging) return;

    try {
      this.setData({ isLogging: true });
      showLoading('登录中...');

      // 获取微信登录code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      // 发送code到后端
      const result = await authApi.wxLogin(loginRes.code);

      if (result.data) {
        const { token, user, isNewUser } = result.data;
        
        // 保存token和用户信息
        wx.setStorageSync('token', token);
        wx.setStorageSync('userInfo', user);
        app.globalData.token = token;
        app.globalData.userInfo = user;

        // 获取用户家庭信息
        try {
          const familiesRes = await familyApi.getMyFamilies();
          if (familiesRes.data && familiesRes.data.length > 0) {
            const familyInfo = familiesRes.data[0];
            wx.setStorageSync('familyInfo', familyInfo);
            app.globalData.familyInfo = familyInfo;
          }
        } catch (e) {
          console.log('获取家庭信息失败:', e);
        }

        hideLoading();

        if (isNewUser) {
          // 新用户，跳转到注册完善信息页
          showSuccess('登录成功');
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/register/register' });
          }, 1000);
        } else {
          showSuccess('登录成功');
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' });
          }, 1000);
        }
      }
    } catch (error) {
      hideLoading();
      console.error('登录失败:', error);
      showError(error.message || '登录失败，请重试');
    } finally {
      this.setData({ isLogging: false });
    }
  },

  // 获取用户头像昵称
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;
        app.globalData.wxUserInfo = userInfo;
        this.wxLogin();
      },
      fail: () => {
        // 用户拒绝授权，仍然可以登录
        this.wxLogin();
      }
    });
  }
});
