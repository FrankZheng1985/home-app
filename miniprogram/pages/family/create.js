// pages/family/create.js
const app = getApp();
const { familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    familyName: '',
    isSubmitting: false
  },

  // 输入家庭名称
  onNameInput(e) {
    this.setData({ familyName: e.detail.value });
  },

  // 创建家庭
  async createFamily() {
    const { familyName, isSubmitting } = this.data;

    if (!familyName.trim()) {
      showError('请输入家庭名称');
      return;
    }

    if (familyName.length < 2 || familyName.length > 20) {
      showError('家庭名称需要2-20个字符');
      return;
    }

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('创建中...');

      const res = await familyApi.create({
        name: familyName.trim()
      });

      hideLoading();

      if (res.data) {
        // 保存家庭信息到本地
        wx.setStorageSync('familyInfo', res.data);
        app.globalData.familyInfo = res.data;

        showSuccess('创建成功');
        
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      }
    } catch (error) {
      hideLoading();
      showError(error.message || '创建失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
