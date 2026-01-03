// pages/profile/points.js
const app = getApp();
const { pointsApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, formatRelativeTime } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    summary: {
      totalPoints: 0,
      thisWeek: 0,
      thisMonth: 0
    },
    transactions: [],
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.loadTransactions();
  },

  async loadData() {
    try {
      showLoading('加载中...');

      // 获取家庭信息
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        this.setData({ familyInfo });

        // 获取积分概览
        const summaryRes = await pointsApi.getSummary(familyInfo.id);
        this.setData({ summary: summaryRes.data || {} });

        // 获取积分记录
        this.setData({ page: 1, hasMore: true, transactions: [] });
        await this.loadTransactions();
      }

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载数据失败:', error);
    }
  },

  async loadTransactions() {
    if (!this.data.familyInfo || !this.data.hasMore) return;

    try {
      const res = await pointsApi.getTransactions({
        familyId: this.data.familyInfo.id,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      let newTransactions = res.data || [];
      
      // 格式化时间
      newTransactions = newTransactions.map(item => ({
        ...item,
        createdAtText: formatRelativeTime(item.createdAt)
      }));

      this.setData({
        transactions: [...this.data.transactions, ...newTransactions],
        hasMore: newTransactions.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('加载积分记录失败:', error);
    }
  }
});
