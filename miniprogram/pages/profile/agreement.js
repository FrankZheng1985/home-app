// pages/profile/agreement.js
// 用户协议和隐私政策页面

Page({
  data: {
    type: 'user' // user: 用户协议, privacy: 隐私政策
  },

  onLoad(options) {
    const type = options.type || 'user';
    this.setData({ type });
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: type === 'privacy' ? '隐私政策' : '用户协议'
    });
  }
});
