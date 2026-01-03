// pages/family/family.js
const app = getApp();
const { familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    members: [],
    isAdmin: false,
    currentUserId: null,
    showInviteModal: false,
    inviteCode: ''
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ currentUserId: userInfo.id });
    }
  },

  onShow() {
    this.loadFamilyData();
  },

  async loadFamilyData() {
    try {
      showLoading('加载中...');
      
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        this.setData({ familyInfo });

        // 获取成员列表
        const membersRes = await familyApi.getMembers(familyInfo.id);
        const members = membersRes.data || [];
        
        // 判断当前用户是否为管理员
        const currentMember = members.find(m => m.userId === this.data.currentUserId);
        const isAdmin = currentMember && (currentMember.role === 'admin' || currentMember.role === 'owner');
        
        this.setData({ members, isAdmin });
      }
      
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载家庭数据失败:', error);
      showError(error.message || '加载失败');
    }
  },

  // 显示邀请弹窗
  showInvite() {
    const { familyInfo } = this.data;
    this.setData({
      showInviteModal: true,
      inviteCode: familyInfo.inviteCode || ''
    });
  },

  // 关闭邀请弹窗
  closeInviteModal() {
    this.setData({ showInviteModal: false });
  },

  // 复制邀请码
  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        showSuccess('已复制邀请码');
      }
    });
  },

  // 生成二维码
  async generateQRCode() {
    try {
      showLoading('生成中...');
      const res = await familyApi.generateQRCode(this.data.familyInfo.id);
      hideLoading();
      
      if (res.data && res.data.qrCodeUrl) {
        wx.previewImage({
          urls: [res.data.qrCodeUrl]
        });
      }
    } catch (error) {
      hideLoading();
      showError(error.message || '生成失败');
    }
  },

  // 设置成员角色
  async setMemberRole(e) {
    const { memberId, role } = e.currentTarget.dataset;
    
    if (!this.data.isAdmin) {
      showError('只有管理员可以操作');
      return;
    }

    try {
      showLoading('设置中...');
      await familyApi.updateMemberRole(this.data.familyInfo.id, memberId, role);
      hideLoading();
      showSuccess('设置成功');
      this.loadFamilyData();
    } catch (error) {
      hideLoading();
      showError(error.message || '设置失败');
    }
  },

  // 移除成员
  async removeMember(e) {
    const { memberId, memberName } = e.currentTarget.dataset;
    
    if (!this.data.isAdmin) {
      showError('只有管理员可以操作');
      return;
    }

    const confirmed = await showConfirm({
      title: '移除成员',
      content: `确定要移除 ${memberName} 吗？`
    });

    if (!confirmed) return;

    try {
      showLoading('移除中...');
      await familyApi.removeMember(this.data.familyInfo.id, memberId);
      hideLoading();
      showSuccess('已移除');
      this.loadFamilyData();
    } catch (error) {
      hideLoading();
      showError(error.message || '移除失败');
    }
  },

  // 退出家庭
  async leaveFamily() {
    const confirmed = await showConfirm({
      title: '退出家庭',
      content: '确定要退出当前家庭吗？退出后积分将保留但无法使用。'
    });

    if (!confirmed) return;

    try {
      showLoading('退出中...');
      await familyApi.leave(this.data.familyInfo.id);
      hideLoading();
      
      // 清除本地家庭信息
      wx.removeStorageSync('familyInfo');
      app.globalData.familyInfo = null;
      
      showSuccess('已退出');
      
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1000);
    } catch (error) {
      hideLoading();
      showError(error.message || '退出失败');
    }
  },

  // 去奖励设置
  goToRewards() {
    wx.navigateTo({ url: '/pages/rewards/rewards' });
  }
});
