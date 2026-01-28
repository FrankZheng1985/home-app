// pages/family/family.js
const app = getApp();
const { familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    members: [],
    isAdmin: false,
    isCreator: false, // 是否是创建者
    currentUserId: null,
    showInviteModal: false,
    inviteCode: '',
    showMemberModal: false,
    selectedMember: null,
    showRoleModal: false // 权限管理弹窗
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
      
      // 首先检查用户信息中的 familyId（最可靠的判断）
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.familyId) {
        console.log('用户信息显示未加入家庭');
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          members: [],
          isAdmin: false,
          isCreator: false
        });
        
        hideLoading();
        wx.showModal({
          title: '提示',
          content: '您尚未加入家庭，请先创建或加入一个家庭',
          confirmText: '去首页',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
        return;
      }
      
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        
        // 同步更新本地存储
        wx.setStorageSync('familyInfo', familyInfo);
        app.globalData.familyInfo = familyInfo;
        
        this.setData({ familyInfo });

        // 获取成员列表
        let membersRes;
        try {
          membersRes = await familyApi.getMembers(familyInfo.id);
        } catch (e) {
          console.error('获取成员列表失败:', e);
          membersRes = { data: [] };
        }
        
        const members = membersRes.data || [];
        
        // 判断当前用户角色（确保返回布尔值，避免 undefined）
        const currentMember = members.find(m => 
          m.userId === this.data.currentUserId || 
          m.id === this.data.currentUserId ||
          m.user_id === this.data.currentUserId
        );
        const isAdmin = !!(currentMember && (currentMember.role === 'admin' || currentMember.role === 'creator'));
        const isCreator = !!(currentMember && currentMember.role === 'creator');
        
        this.setData({ members, isAdmin, isCreator });
      } else {
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          members: [],
          isAdmin: false,
          isCreator: false
        });
        
        hideLoading();
        wx.showModal({
          title: '提示',
          content: '您尚未加入家庭，请先创建或加入一个家庭',
          confirmText: '去首页',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
        return;
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
      inviteCode: familyInfo.invite_code || familyInfo.inviteCode || ''
    });
  },

  // 显示家庭邀请码（快捷方式）
  showFamilyCode() {
    this.showInvite();
  },

  // 关闭邀请弹窗
  closeInviteModal() {
    this.setData({ showInviteModal: false });
  },

  // 复制邀请码
  copyInviteCode() {
    const code = this.data.inviteCode || this.data.familyInfo?.invite_code;
    if (!code) {
      showError('邀请码获取失败');
      return;
    }
    wx.setClipboardData({
      data: code,
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

  // 显示成员操作菜单
  showMemberActions(e) {
    const memberId = e.currentTarget.dataset.memberId;
    const memberName = e.currentTarget.dataset.memberName;
    
    // 获取该成员的角色
    const member = this.data.members.find(m => m.id === memberId);
    const memberRole = member ? member.role : 'member';
    
    this.setData({
      showMemberModal: true,
      selectedMember: { id: memberId, name: memberName, role: memberRole }
    });
  },

  // 关闭成员操作菜单
  closeMemberModal() {
    this.setData({
      showMemberModal: false,
      selectedMember: null
    });
  },

  // 设为管理员
  async setAsAdmin(e) {
    const memberId = e.currentTarget.dataset.memberId;
    
    if (!this.data.isAdmin) {
      showError('只有管理员可以操作');
      return;
    }

    try {
      showLoading('设置中...');
      await familyApi.updateMemberRole(this.data.familyInfo.id, memberId, 'admin');
      hideLoading();
      showSuccess('设置成功');
      this.closeMemberModal();
      this.loadFamilyData();
    } catch (error) {
      hideLoading();
      showError(error.message || '设置失败');
    }
  },

  // 移除成员
  async removeMember(e) {
    const memberId = e.currentTarget.dataset.memberId;
    const memberName = e.currentTarget.dataset.memberName;
    
    if (!this.data.isAdmin) {
      showError('只有管理员可以操作');
      return;
    }

    this.closeMemberModal();

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
  },

  // 显示修改家庭名称弹窗
  showEditName() {
    if (!this.data.isAdmin) {
      showError('只有管理员可以修改家庭名称');
      return;
    }
    
    const currentName = this.data.familyInfo?.name || '';
    
    wx.showModal({
      title: '修改家庭名称',
      editable: true,
      placeholderText: '请输入新的家庭名称',
      content: currentName,
      success: async (res) => {
        if (res.confirm && res.content) {
          const newName = res.content.trim();
          
          if (!newName) {
            showError('家庭名称不能为空');
            return;
          }
          
          if (newName.length > 20) {
            showError('家庭名称不能超过20个字符');
            return;
          }
          
          if (newName === currentName) {
            return; // 名称没有变化
          }
          
          await this.updateFamilyName(newName);
        }
      }
    });
  },

  // 更新家庭名称
  async updateFamilyName(newName) {
    try {
      showLoading('保存中...');
      await familyApi.updateName(this.data.familyInfo.id, newName);
      hideLoading();
      showSuccess('修改成功');
      
      // 更新本地数据
      const familyInfo = { ...this.data.familyInfo, name: newName };
      this.setData({ familyInfo });
      
      // 同步到本地存储和全局
      wx.setStorageSync('familyInfo', familyInfo);
      app.globalData.familyInfo = familyInfo;
      
    } catch (error) {
      hideLoading();
      showError(error.message || '修改失败');
    }
  },

  // ================ 权限管理 ================

  // 显示权限管理弹窗
  showRoleManager() {
    if (!this.data.isCreator) {
      showError('只有创建者可以管理权限');
      return;
    }
    this.setData({ showRoleModal: true });
  },

  // 关闭权限管理弹窗
  closeRoleModal() {
    this.setData({ showRoleModal: false });
  },

  // 切换成员角色
  async toggleMemberRole(e) {
    const memberId = e.currentTarget.dataset.memberId;
    const memberName = e.currentTarget.dataset.memberName;
    const currentRole = e.currentTarget.dataset.currentRole;
    
    if (!this.data.isCreator) {
      showError('只有创建者可以修改权限');
      return;
    }
    
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const actionText = newRole === 'admin' ? '设为子管理员' : '取消管理员权限';
    
    const confirmed = await showConfirm({
      title: '修改权限',
      content: `确定要将 ${memberName} ${actionText}吗？`
    });
    
    if (!confirmed) return;
    
    try {
      showLoading('设置中...');
      await familyApi.updateMemberRole(this.data.familyInfo.id, memberId, newRole);
      hideLoading();
      showSuccess('设置成功');
      this.loadFamilyData();
    } catch (error) {
      hideLoading();
      showError(error.message || '设置失败');
    }
  },

  // 取消管理员（从操作菜单）
  async removeAdmin(e) {
    const memberId = e.currentTarget.dataset.memberId;
    const memberName = this.data.selectedMember?.name || '';
    
    if (!this.data.isCreator) {
      showError('只有创建者可以修改权限');
      return;
    }
    
    this.closeMemberModal();
    
    const confirmed = await showConfirm({
      title: '取消管理员',
      content: `确定要取消 ${memberName} 的管理员权限吗？`
    });
    
    if (!confirmed) return;
    
    try {
      showLoading('设置中...');
      await familyApi.updateMemberRole(this.data.familyInfo.id, memberId, 'member');
      hideLoading();
      showSuccess('已取消管理员权限');
      this.loadFamilyData();
    } catch (error) {
      hideLoading();
      showError(error.message || '操作失败');
    }
  },

  // 分享
  onShareAppMessage() {
    const { familyInfo } = this.data;
    const inviteCode = familyInfo?.invite_code || familyInfo?.inviteCode || '';
    return {
      title: `邀请你加入「${familyInfo?.name || '我的家庭'}」`,
      path: `/pages/family/join?code=${inviteCode}`,
      imageUrl: '/assets/images/share-bg.png'
    };
  }
});
