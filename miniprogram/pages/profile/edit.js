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
    isSubmitting: false,
    isLoading: true
  },

  onLoad() {
    // 先从本地存储加载，快速显示
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo: {
        nickname: userInfo.nickname || '',
        avatarUrl: userInfo.avatarUrl || userInfo.avatar_url || '',
        gender: userInfo.gender || 0,
        birthday: userInfo.birthday || ''
      }
    });
    
    // 然后从服务器获取最新数据
    this.fetchLatestProfile();
  },

  // 从服务器获取最新用户信息
  async fetchLatestProfile() {
    try {
      const res = await userApi.getProfile();
      if (res.data) {
        const serverData = res.data;
        this.setData({
          userInfo: {
            nickname: serverData.nickname || '',
            avatarUrl: serverData.avatar_url || serverData.avatarUrl || '',
            gender: serverData.gender || 0,
            birthday: serverData.birthday || ''
          },
          isLoading: false
        });
        
        // 同步更新本地存储
        const storedUserInfo = wx.getStorageSync('userInfo') || {};
        const updatedUserInfo = {
          ...storedUserInfo,
          nickname: serverData.nickname,
          avatarUrl: serverData.avatar_url || serverData.avatarUrl,
          avatar_url: serverData.avatar_url || serverData.avatarUrl,
          gender: serverData.gender,
          birthday: serverData.birthday
        };
        wx.setStorageSync('userInfo', updatedUserInfo);
        app.globalData.userInfo = updatedUserInfo;
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      this.setData({ isLoading: false });
      // 获取失败时使用本地存储的数据，不影响用户体验
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
