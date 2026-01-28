// pages/register/register.js
const app = getApp();
const { authApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    openId: '',
    sessionKey: '',
    userInfo: {
      nickname: '',
      avatarUrl: '',
      gender: 0 // 0: 保密, 1: 男, 2: 女
    },
    isSubmitting: false,
    // 喜好选项
    preferenceOptions: [
      { id: 'reading', name: '阅读', emoji: '📚', selected: false },
      { id: 'sports', name: '运动', emoji: '🏃', selected: false },
      { id: 'music', name: '音乐', emoji: '🎵', selected: false },
      { id: 'cooking', name: '烹饪', emoji: '🍳', selected: false },
      { id: 'travel', name: '旅行', emoji: '✈️', selected: false },
      { id: 'games', name: '游戏', emoji: '🎮', selected: false },
      { id: 'movies', name: '电影', emoji: '🎬', selected: false },
      { id: 'pets', name: '宠物', emoji: '🐱', selected: false },
      { id: 'photography', name: '摄影', emoji: '📷', selected: false },
      { id: 'gardening', name: '园艺', emoji: '🌱', selected: false },
      { id: 'handcraft', name: '手工', emoji: '✂️', selected: false },
      { id: 'shopping', name: '购物', emoji: '🛒', selected: false }
    ]
  },

  onLoad() {
    // 获取临时存储的openId和sessionKey
    const tempOpenId = wx.getStorageSync('tempOpenId');
    const tempSessionKey = wx.getStorageSync('tempSessionKey');
    if (!tempOpenId) {
      showError('登录信息已过期，请重新登录');
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/login/login' });
      }, 1500);
      return;
    }
    
    this.setData({ openId: tempOpenId, sessionKey: tempSessionKey });

    // 如果有微信用户信息，预填
    const wxUserInfo = app.globalData.wxUserInfo;
    if (wxUserInfo) {
      this.setData({
        'userInfo.nickname': wxUserInfo.nickName || '',
        'userInfo.avatarUrl': wxUserInfo.avatarUrl || ''
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

  // 选择性别
  selectGender(e) {
    const gender = parseInt(e.currentTarget.dataset.gender);
    this.setData({
      'userInfo.gender': gender
    });
  },

  // 切换喜好选择
  togglePreference(e) {
    const id = e.currentTarget.dataset.id;
    const options = this.data.preferenceOptions;
    const index = options.findIndex(item => item.id === id);
    
    if (index !== -1) {
      const key = `preferenceOptions[${index}].selected`;
      this.setData({
        [key]: !options[index].selected
      });
    }
  },

  // 获取选中的喜好
  getSelectedPreferences() {
    return this.data.preferenceOptions
      .filter(item => item.selected)
      .map(item => item.id);
  },

  // 跳过注册
  skipRegister() {
    // 使用默认值完成注册
    this.setData({
      'userInfo.nickname': '微信用户'
    });
    this.saveAndContinue();
  },

  // 保存并继续
  async saveAndContinue() {
    const { openId, userInfo, isSubmitting } = this.data;

    if (isSubmitting) return;

    // 验证昵称
    if (!userInfo.nickname || !userInfo.nickname.trim()) {
      showError('请输入昵称');
      return;
    }

    try {
      this.setData({ isSubmitting: true });
      showLoading('保存中...');

      // 获取选中的喜好
      const preferences = this.getSelectedPreferences();

      // 调用注册接口（包含sessionKey用于微信运动数据解密）
      const result = await authApi.register({
        openId: openId,
        sessionKey: this.data.sessionKey,
        nickname: userInfo.nickname.trim(),
        avatarUrl: userInfo.avatarUrl || '',
        gender: userInfo.gender || 0,
        preferences: {
          hobbies: preferences
        }
      });

      if (result.data) {
        const { token, user } = result.data;
        
        // 保存token和用户信息
        wx.setStorageSync('token', token);
        wx.setStorageSync('userInfo', user);
        app.globalData.token = token;
        app.globalData.userInfo = user;
        
        // 清除临时openId和sessionKey
        wx.removeStorageSync('tempOpenId');
        wx.removeStorageSync('tempSessionKey');

        hideLoading();
        showSuccess('注册成功');

        // 检查是否有家庭，没有则跳转创建家庭
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/family/create' });
        }, 1500);
      }
    } catch (error) {
      hideLoading();
      console.error('注册失败:', error);
      showError(error.message || '注册失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
