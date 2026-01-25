// pages/savings/savings.js
const app = getApp();
const { savingsApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    account: null,
    transactions: [],
    requests: [],
    isLoading: true,
    isAdmin: false,
    isCreator: false,
    
    // Tab 切换
    activeTab: 'overview', // overview, requests, members
    
    // 操作弹窗
    showActionModal: false,
    actionType: '', // deposit, withdraw, request
    actionAmount: '',
    actionDescription: '',
    isSubmitting: false,
    
    // 利率设置弹窗
    showRateModal: false,
    newRate: '',
    
    // 审核弹窗
    showReviewModal: false,
    currentRequest: null,
    rejectReason: '',
    
    // 成员管理
    familyMembers: [],
    showMemberModal: false,
    
    // 动画相关
    interestAnimating: false,
    displayedInterest: 0,
    
    // 待审核数量
    pendingCount: 0
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadData();
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    const app = getApp();
    
    try {
      this.setData({ isLoading: true });
      
      // 首先检查用户信息中的 familyId（最可靠的判断）
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo || !userInfo.familyId) {
        console.log('用户信息显示未加入家庭');
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          isLoading: false,
          familyInfo: null,
          account: null
        });
        
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

      // 获取家庭信息
      const familiesRes = await familyApi.getMyFamilies();
      if (!familiesRes.data || familiesRes.data.length === 0) {
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          isLoading: false,
          familyInfo: null,
          account: null
        });
        
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

      const familyInfo = familiesRes.data[0];
      
      // 同步更新本地存储
      wx.setStorageSync('familyInfo', familyInfo);
      app.globalData.familyInfo = familyInfo;
      
      // 检查角色
      let membersRes;
      try {
        membersRes = await familyApi.getMembers(familyInfo.id);
      } catch (e) {
        console.error('获取成员信息失败:', e);
        membersRes = { data: [] };
      }
      
      const currentUserId = wx.getStorageSync('userInfo')?.id;
      const currentMember = membersRes.data?.find(m => 
        m.id === currentUserId || m.userId === currentUserId || m.user_id === currentUserId
      );
      
      const isCreator = !!(currentMember && currentMember.role === 'creator');
      const isAdmin = !!(currentMember && (currentMember.role === 'admin' || currentMember.role === 'creator'));

      this.setData({ 
        familyInfo, 
        isAdmin, 
        isCreator,
        familyMembers: membersRes.data || []
      });

      // 获取存款账户
      const accountRes = await savingsApi.getAccount(familyInfo.id);
      if (accountRes.data) {
        this.setData({ 
          account: accountRes.data,
          pendingCount: accountRes.data.pendingRequestCount || 0
        });
        
        // 加载交易记录
        await this.loadTransactions();
        
        // 如果是管理员，加载申请列表
        if (isAdmin) {
          await this.loadRequests();
        }
        
        // 利息动画
        this.animateInterest(accountRes.data.pendingInterest);
      }

      this.setData({ isLoading: false });
    } catch (error) {
      console.error('加载数据失败:', error);
      this.setData({ isLoading: false });
      showError(error.message || '加载失败');
    }
  },

  async loadTransactions() {
    const { account } = this.data;
    if (!account) return;

    try {
      const res = await savingsApi.getTransactions(account.id, 1, 50);
      this.setData({ transactions: res.data || [] });
    } catch (error) {
      console.error('加载交易记录失败:', error);
    }
  },

  async loadRequests() {
    const { familyInfo } = this.data;
    if (!familyInfo) return;

    try {
      const res = await savingsApi.getRequests(familyInfo.id, null, 1, 50);
      this.setData({ requests: res.data || [] });
    } catch (error) {
      console.error('加载申请列表失败:', error);
    }
  },

  // Tab 切换
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    
    if (tab === 'requests') {
      this.loadRequests();
    }
  },

  // 利息数字动画
  animateInterest(targetValue) {
    if (targetValue <= 0) {
      this.setData({ displayedInterest: '0.00' });
      return;
    }

    this.setData({ interestAnimating: true });
    
    const duration = 1500;
    const steps = 60;
    const stepValue = targetValue / steps;
    const stepDuration = duration / steps;
    
    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= targetValue) {
        current = targetValue;
        clearInterval(timer);
        this.setData({ interestAnimating: false });
      }
      this.setData({ displayedInterest: current.toFixed(2) });
    }, stepDuration);
  },

  // 显示存款申请弹窗（普通用户）
  showDepositRequest() {
    this.setData({
      showActionModal: true,
      actionType: 'request',
      actionAmount: '',
      actionDescription: ''
    });
  },

  // 显示直接存款弹窗（管理员）
  showDeposit() {
    this.setData({
      showActionModal: true,
      actionType: 'deposit',
      actionAmount: '',
      actionDescription: ''
    });
  },

  // 显示取款弹窗（管理员）
  showWithdraw() {
    this.setData({
      showActionModal: true,
      actionType: 'withdraw',
      actionAmount: '',
      actionDescription: ''
    });
  },

  // 关闭操作弹窗
  closeActionModal() {
    this.setData({ showActionModal: false });
  },

  // 输入金额
  onAmountInput(e) {
    this.setData({ actionAmount: e.detail.value });
  },

  // 输入备注
  onDescriptionInput(e) {
    this.setData({ actionDescription: e.detail.value });
  },

  // 确认操作
  async confirmAction() {
    const { account, actionType, actionAmount, actionDescription, isSubmitting } = this.data;
    
    if (isSubmitting) return;
    
    const amount = parseFloat(actionAmount);
    if (!amount || amount <= 0) {
      showError('请输入有效金额');
      return;
    }

    if (actionType === 'withdraw' && amount > account.balance) {
      showError('余额不足');
      return;
    }

    try {
      this.setData({ isSubmitting: true });

      if (actionType === 'request') {
        // 提交存款申请
        showLoading('提交中...');
        await savingsApi.submitRequest(account.id, amount, actionDescription);
        showSuccess('申请已提交，请等待审核');
      } else if (actionType === 'deposit') {
        // 管理员直接存款
        showLoading('存款中...');
        await savingsApi.deposit(account.id, amount, actionDescription);
        showSuccess('存款成功！');
      } else {
        // 管理员取款
        showLoading('取款中...');
        await savingsApi.withdraw(account.id, amount, actionDescription);
        showSuccess('取款成功！');
      }

      this.closeActionModal();
      await this.loadData();
    } catch (error) {
      hideLoading();
      showError(error.message || '操作失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 显示审核弹窗
  showReview(e) {
    const request = e.currentTarget.dataset.request;
    this.setData({
      showReviewModal: true,
      currentRequest: request,
      rejectReason: ''
    });
  },

  // 关闭审核弹窗
  closeReviewModal() {
    this.setData({ showReviewModal: false, currentRequest: null });
  },

  // 输入拒绝原因
  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value });
  },

  // 批准申请
  async approveRequest() {
    const { currentRequest } = this.data;
    if (!currentRequest) return;

    wx.showModal({
      title: '确认批准',
      content: `确定批准 ${currentRequest.userNickname} 的存款申请（¥${currentRequest.amount.toFixed(2)}）吗？\n\n请确认已收到对应金额的转账。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            showLoading('处理中...');
            await savingsApi.reviewRequest(currentRequest.id, 'approve');
            showSuccess('已批准，金额已到账');
            this.closeReviewModal();
            await this.loadData();
          } catch (error) {
            hideLoading();
            showError(error.message || '操作失败');
          }
        }
      }
    });
  },

  // 拒绝申请
  async rejectRequest() {
    const { currentRequest, rejectReason } = this.data;
    if (!currentRequest) return;

    if (!rejectReason.trim()) {
      showError('请填写拒绝原因');
      return;
    }

    try {
      showLoading('处理中...');
      await savingsApi.reviewRequest(currentRequest.id, 'reject', rejectReason);
      showSuccess('已拒绝');
      this.closeReviewModal();
      await this.loadData();
    } catch (error) {
      hideLoading();
      showError(error.message || '操作失败');
    }
  },

  // 结算利息
  async settleInterest() {
    const { account } = this.data;
    
    if (!account || account.pendingInterest <= 0) {
      showError('暂无可结算的利息');
      return;
    }

    wx.showModal({
      title: '结算利息',
      content: `确定将 ¥${account.pendingInterest.toFixed(2)} 利息转入账户吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            showLoading('结算中...');
            await savingsApi.settleInterest(account.id);
            showSuccess('利息已转入账户！');
            await this.loadData();
          } catch (error) {
            hideLoading();
            showError(error.message || '结算失败');
          }
        }
      }
    });
  },

  // 显示利率设置弹窗
  showRateSetting() {
    const { account } = this.data;
    this.setData({
      showRateModal: true,
      newRate: (account.annualRate * 100).toFixed(2)
    });
  },

  // 关闭利率弹窗
  closeRateModal() {
    this.setData({ showRateModal: false });
  },

  // 输入新利率
  onRateInput(e) {
    // 支持快捷选择
    const rate = e.currentTarget.dataset?.rate;
    if (rate) {
      this.setData({ newRate: rate });
    } else {
      this.setData({ newRate: e.detail.value });
    }
  },

  // 确认修改利率
  async confirmRate() {
    const { account, newRate } = this.data;
    
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      showError('请输入0-100之间的利率');
      return;
    }

    try {
      showLoading('保存中...');
      await savingsApi.updateRate(account.id, rate / 100);
      showSuccess('利率已更新！');
      this.closeRateModal();
      await this.loadData();
    } catch (error) {
      hideLoading();
      showError(error.message || '保存失败');
    }
  },

  // 显示成员管理弹窗
  showMemberManage() {
    this.setData({ showMemberModal: true });
  },

  // 关闭成员管理弹窗
  closeMemberModal() {
    this.setData({ showMemberModal: false });
  },

  // 切换子管理员
  async toggleSubAdmin(e) {
    const { member } = e.currentTarget.dataset;
    const { familyInfo, isCreator } = this.data;

    if (!isCreator) {
      showError('只有创建人可以设置子管理员');
      return;
    }

    if (member.role === 'creator') {
      showError('不能修改创建人的权限');
      return;
    }

    const newIsAdmin = member.role !== 'admin';
    const actionText = newIsAdmin ? '设为子管理员' : '取消子管理员';

    wx.showModal({
      title: actionText,
      content: `确定将 ${member.nickname} ${actionText}吗？\n\n子管理员可以审核存款申请。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            showLoading('处理中...');
            const memberId = member.id || member.userId || member.user_id;
            await savingsApi.setSubAdmin(familyInfo.id, memberId, newIsAdmin);
            showSuccess(newIsAdmin ? '已设为子管理员' : '已取消子管理员');
            await this.loadData();
          } catch (error) {
            hideLoading();
            showError(error.message || '操作失败');
          }
        }
      }
    });
  },

  // 阻止冒泡
  preventClose() {},

  // 返回
  goBack() {
    wx.navigateBack();
  }
});
