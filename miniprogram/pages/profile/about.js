// pages/profile/about.js
Page({
  data: {
    version: '1.0.0',
    features: [
      { icon: '👨‍👩‍👧‍👦', title: '家庭成员管理', desc: '轻松管理家庭成员，共建温馨家庭' },
      { icon: '🧹', title: '家务记录', desc: '记录每一份付出，积累幸福积分' },
      { icon: '💰', title: '积分奖励', desc: '完成家务获得积分，兑换心仪奖励' },
      { icon: '📢', title: '家庭动态', desc: '分享生活点滴，增进家人感情' }
    ]
  },

  // 复制客服微信
  copyWechat() {
    wx.setClipboardData({
      data: 'family_helper_support',
      success: () => {
        wx.showToast({
          title: '已复制微信号',
          icon: 'success'
        });
      }
    });
  }
});
