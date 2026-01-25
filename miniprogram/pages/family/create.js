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
    console.log('创建家庭按钮被点击');
    const { familyName, isSubmitting } = this.data;
    console.log('当前状态:', { familyName, isSubmitting });

    if (!familyName || !familyName.trim()) {
      showError('请输入家庭名称');
      return;
    }

    if (familyName.length < 2 || familyName.length > 20) {
      showError('家庭名称需要2-20个字符');
      return;
    }

    if (isSubmitting) {
      console.log('正在提交中，跳过');
      return;
    }

    try {
      this.setData({ isSubmitting: true });
      showLoading('创建中...');
      console.log('开始调用 API 创建家庭...');

      const res = await familyApi.create({
        name: familyName.trim()
      });

      console.log('创建家庭响应:', res);
      hideLoading();

      if (res.data) {
        // 保存家庭信息到本地
        wx.setStorageSync('familyInfo', res.data);
        app.globalData.familyInfo = res.data;
        
        // 更新用户信息中的 familyId（重要！）
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.familyId = res.data.id;
        userInfo.familyRole = 'creator';
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;
        console.log('已更新用户信息，familyId:', res.data.id);

        showSuccess('创建成功');
        
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      }
    } catch (error) {
      console.error('创建家庭失败:', error);
      hideLoading();
      showError(error.message || '创建失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
