// pages/register/register.js
const app = getApp();
const { userApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    step: 1, // 1: 基本信息, 2: 喜好设置
    userInfo: {
      nickname: '',
      avatarUrl: ''
    },
    preferences: {
      birthday: '',
      favoriteFood: '',
      favoriteColor: '',
      hobbies: ''
    },
    isSubmitting: false
  },

  onLoad() {
    // 如果有微信用户信息，预填
    const wxUserInfo = app.globalData.wxUserInfo;
    if (wxUserInfo) {
      this.setData({
        'userInfo.nickname': wxUserInfo.nickName,
        'userInfo.avatarUrl': wxUserInfo.avatarUrl
      });
    }
  },

  // 选择头像
  chooseAvatar(e) {
    this.setData({
      'userInfo.avatarUrl': e.detail.avatarUrl
    });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  // 喜好输入
  onPreferenceInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`preferences.${field}`]: e.detail.value
    });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'preferences.birthday': e.detail.value
    });
  },

  // 下一步
  nextStep() {
    const { nickname } = this.data.userInfo;
    
    if (!nickname.trim()) {
      showError('请输入昵称');
      return;
    }

    this.setData({ step: 2 });
  },

  // 上一步
  prevStep() {
    this.setData({ step: 1 });
  },

  // 跳过喜好设置
  skipPreferences() {
    this.saveAndContinue();
  },

  // 完成注册
  async finishRegister() {
    await this.saveAndContinue();
  },

  // 保存并继续
  async saveAndContinue() {
    const { userInfo, preferences, isSubmitting } = this.data;

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('保存中...');

      // 更新用户信息
      await userApi.updateProfile({
        nickname: userInfo.nickname,
        avatarUrl: userInfo.avatarUrl
      });

      // 如果有喜好设置，保存喜好
      const hasPreferences = Object.values(preferences).some(v => v);
      if (hasPreferences) {
        await userApi.updatePreferences(preferences);
      }

      // 更新本地存储
      const updatedUserInfo = {
        ...app.globalData.userInfo,
        ...userInfo
      };
      wx.setStorageSync('userInfo', updatedUserInfo);
      app.globalData.userInfo = updatedUserInfo;

      hideLoading();
      showSuccess('设置完成');

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    } catch (error) {
      hideLoading();
      console.error('保存失败:', error);
      showError(error.message || '保存失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
