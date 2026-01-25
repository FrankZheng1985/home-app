// pages/login/login.js
const app = getApp();
const { authApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    isLogging: false,
    agreedToTerms: false  // 是否同意协议
  },

  onLoad() {
    // 检查是否已登录
    const token = wx.getStorageSync('token');
    if (token) {
      this.validateAndRedirect();
    }
  },

  // 切换协议同意状态
  toggleAgreement() {
    this.setData({
      agreedToTerms: !this.data.agreedToTerms
    });
  },

  // 查看用户协议
  viewUserAgreement() {
    wx.navigateTo({
      url: '/pages/profile/agreement?type=user'
    });
  },

  // 查看隐私政策
  viewPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/profile/agreement?type=privacy'
    });
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
        // 检查是否需要注册（新用户）
        if (result.data.needRegister) {
          hideLoading();
          // 保存openId供注册页使用
          wx.setStorageSync('tempOpenId', result.data.openId);
          showSuccess('欢迎新用户');
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/register/register' });
          }, 1000);
          return;
        }

        const { token, user } = result.data;
        
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
        showSuccess('登录成功');
        setTimeout(() => {
          // 检查是否有页面栈，如果有则返回，否则跳转首页
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            wx.switchTab({ url: '/pages/index/index' });
          }
        }, 1000);
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
    // 检查是否同意协议
    if (!this.data.agreedToTerms) {
      wx.showToast({
        title: '请先同意用户协议和隐私政策',
        icon: 'none',
        duration: 2000
      });
      return;
    }

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
