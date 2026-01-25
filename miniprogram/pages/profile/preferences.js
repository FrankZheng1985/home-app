// pages/profile/preferences.js
const app = getApp();
const { userApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    preferences: {
      favoriteFood: '',
      favoriteColor: '',
      hobbies: ''
    },
    isSubmitting: false
  },

  onLoad() {
    this.loadPreferences();
  },

  async loadPreferences() {
    try {
      showLoading('加载中...');
      const res = await userApi.getProfile();
      hideLoading();

      if (res.data && res.data.preferences) {
        this.setData({ preferences: res.data.preferences });
      }
    } catch (error) {
      hideLoading();
      console.error('加载喜好设置失败:', error);
    }
  },

  // 输入喜好
  onPreferenceInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`preferences.${field}`]: e.detail.value });
  },

  // 保存
  async savePreferences() {
    const { preferences, isSubmitting } = this.data;

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('保存中...');

      await userApi.updatePreferences(preferences);

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
