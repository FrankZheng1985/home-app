// pages/profile/edit.js
const app = getApp();
const { userApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    userInfo: {
      nickname: '',
      avatarUrl: '',
      gender: 0,
      birthday: ''
    },
    isSubmitting: false
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo: {
        nickname: userInfo.nickname || '',
        avatarUrl: userInfo.avatarUrl || userInfo.avatar_url || '',
        gender: userInfo.gender || 0,
        birthday: userInfo.birthday || ''
      }
    });
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

  // 选择性别
  selectGender(e) {
    const gender = parseInt(e.currentTarget.dataset.gender);
    this.setData({
      'userInfo.gender': gender
    });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'userInfo.birthday': e.detail.value
    });
  },

  // 保存
  async saveProfile() {
    const { userInfo, isSubmitting } = this.data;

    if (!userInfo.nickname.trim()) {
      showError('请输入昵称');
      return;
    }

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('保存中...');

      await userApi.updateProfile({
        nickname: userInfo.nickname.trim(),
        avatarUrl: userInfo.avatarUrl,
        gender: userInfo.gender,
        birthday: userInfo.birthday
      });

      // 更新本地存储
      const storedUserInfo = wx.getStorageSync('userInfo') || {};
      const updatedUserInfo = {
        ...storedUserInfo,
        nickname: userInfo.nickname.trim(),
        avatarUrl: userInfo.avatarUrl,
        avatar_url: userInfo.avatarUrl,
        gender: userInfo.gender,
        birthday: userInfo.birthday
      };
      wx.setStorageSync('userInfo', updatedUserInfo);
      app.globalData.userInfo = updatedUserInfo;

      hideLoading();
      showSuccess('保存成功');

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      hideLoading();
      showError(error.message || '保存失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
