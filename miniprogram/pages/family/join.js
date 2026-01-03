// pages/family/join.js
const app = getApp();
const { familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    inviteCode: '',
    isSubmitting: false
  },

  onLoad(options) {
    // 如果从扫码进入，解析邀请码
    if (options.code) {
      this.setData({ inviteCode: options.code });
    }
  },

  // 输入邀请码
  onCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() });
  },

  // 扫描二维码
  scanQRCode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        // 解析二维码内容，提取邀请码
        const result = res.result;
        // 假设二维码内容格式为: family://join?code=XXXXX
        const match = result.match(/code=([A-Z0-9]+)/i);
        if (match) {
          this.setData({ inviteCode: match[1].toUpperCase() });
          this.joinFamily();
        } else {
          showError('无效的二维码');
        }
      },
      fail: () => {
        showError('扫码失败');
      }
    });
  },

  // 加入家庭
  async joinFamily() {
    const { inviteCode, isSubmitting } = this.data;

    if (!inviteCode.trim()) {
      showError('请输入邀请码');
      return;
    }

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('加入中...');

      const res = await familyApi.joinByCode(inviteCode.trim());

      hideLoading();

      if (res.data) {
        // 保存家庭信息到本地
        wx.setStorageSync('familyInfo', res.data);
        app.globalData.familyInfo = res.data;

        showSuccess('加入成功');
        
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }, 1500);
      }
    } catch (error) {
      hideLoading();
      showError(error.message || '加入失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
