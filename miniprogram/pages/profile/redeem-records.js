// pages/profile/redeem-records.js
const app = getApp();
const { pointsApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, formatRelativeTime } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    requests: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    isLoading: false
  },

  onLoad() {
    this.loadData();
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

  async loadData() {
    try {
      showLoading('加载中...');
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        this.setData({ familyInfo: familiesRes.data[0] });
        await this.loadRequests(true);
      }
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载数据失败:', error);
    }
  },

  async loadRequests(reset = false) {
    if (!this.data.familyInfo) return;
    
    try {
      this.setData({ isLoading: true });
      if (reset) {
        this.setData({ page: 1, hasMore: true, requests: [] });
      }

      const res = await pointsApi.getRedeemRequests({
        familyId: this.data.familyInfo.id,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      let newRequests = res.data || [];
      newRequests = newRequests.map(item => ({
        ...item,
        createdAtText: formatRelativeTime(item.createdAt)
      }));

      this.setData({
        requests: reset ? newRequests : [...this.data.requests, ...newRequests],
        hasMore: newRequests.length === this.data.pageSize,
        page: this.data.page + 1,
        isLoading: false
      });
    } catch (error) {
      console.error('加载兑现记录失败:', error);
      this.setData({ isLoading: false });
    }
  }
});
