// pages/profile/redeem-review.js - 积分兑现审核页面（管理员）
const app = getApp();
const { pointsApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, showConfirm, formatRelativeTime } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    requests: [],
    filterStatus: 'pending', // pending, approved, rejected, all
    hasMore: true,
    page: 1,
    pageSize: 20,
    isLoading: false,
    // 审核弹窗
    showReviewModal: false,
    currentRequest: null,
    rejectReason: '',
    isReviewing: false
  },

  onLoad() {
    this.loadFamilyInfo();
  },

  onPullDownRefresh() {
    this.loadRequests(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.isLoading && this.data.hasMore) {
      this.loadRequests();
    }
  },

  async loadFamilyInfo() {
    try {
      showLoading('加载中...');
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        this.setData({ familyInfo });
        await this.loadRequests(true);
      }
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载家庭信息失败:', error);
    }
  },

  // 切换筛选状态
  switchFilter(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.filterStatus) return;
    
    this.setData({
      filterStatus: status,
      page: 1,
      hasMore: true,
      requests: []
    });
    this.loadRequests(true);
  },

  // 加载申请列表
  async loadRequests(reset = false) {
    if (!this.data.familyInfo) return;
    if (!reset && !this.data.hasMore) return;

    try {
      this.setData({ isLoading: true });
      
      if (reset) {
        this.setData({ page: 1, hasMore: true, requests: [] });
      }

      const res = await pointsApi.getRedeemRequests({
        familyId: this.data.familyInfo.id,
        status: this.data.filterStatus === 'all' ? undefined : this.data.filterStatus,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      let newRequests = res.data || [];
      
      // 格式化时间
      newRequests = newRequests.map(item => ({
        ...item,
        createdAtText: formatRelativeTime(item.createdAt),
        reviewedAtText: item.reviewedAt ? formatRelativeTime(item.reviewedAt) : ''
      }));

      this.setData({
        requests: reset ? newRequests : [...this.data.requests, ...newRequests],
        hasMore: newRequests.length === this.data.pageSize,
        page: this.data.page + 1,
        isLoading: false
      });
    } catch (error) {
      console.error('加载申请列表失败:', error);
      this.setData({ isLoading: false });
    }
  },

  // 显示审核弹窗
  showReviewModal(e) {
    const request = e.currentTarget.dataset.request;
    this.setData({
      showReviewModal: true,
      currentRequest: request,
      rejectReason: ''
    });
  },

  // 关闭审核弹窗
  closeReviewModal() {
    this.setData({
      showReviewModal: false,
      currentRequest: null,
      rejectReason: ''
    });
  },

  // 阻止事件冒泡
  preventClose() {},

  // 输入拒绝原因
  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value });
  },

  // 通过申请
  async approveRequest() {
    const { currentRequest } = this.data;
    
    const confirmed = await showConfirm({
      title: '确认通过',
      content: `确定通过 ${currentRequest.user.nickname} 的兑现申请吗？\n\n将扣除 ${currentRequest.points} 积分，支付 ¥${currentRequest.amount} 现金。`
    });

    if (!confirmed) return;

    try {
      this.setData({ isReviewing: true });
      showLoading('处理中...');

      await pointsApi.reviewRedeemRequest({
        requestId: currentRequest.id,
        action: 'approve'
      });

      hideLoading();
      showSuccess('已通过，请线下支付现金');
      
      this.closeReviewModal();
      this.loadRequests(true);
    } catch (error) {
      hideLoading();
      showError(error.message || '操作失败');
    } finally {
      this.setData({ isReviewing: false });
    }
  },

  // 拒绝申请
  async rejectRequest() {
    const { currentRequest, rejectReason } = this.data;
    
    if (!rejectReason.trim()) {
      showError('请填写拒绝原因');
      return;
    }

    const confirmed = await showConfirm({
      title: '确认拒绝',
      content: `确定拒绝 ${currentRequest.user.nickname} 的兑现申请吗？`
    });

    if (!confirmed) return;

    try {
      this.setData({ isReviewing: true });
      showLoading('处理中...');

      await pointsApi.reviewRedeemRequest({
        requestId: currentRequest.id,
        action: 'reject',
        rejectReason: rejectReason.trim()
      });

      hideLoading();
      showSuccess('已拒绝');
      
      this.closeReviewModal();
      this.loadRequests(true);
    } catch (error) {
      hideLoading();
      showError(error.message || '操作失败');
    } finally {
      this.setData({ isReviewing: false });
    }
  }
});
