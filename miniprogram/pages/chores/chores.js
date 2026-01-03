// pages/chores/chores.js
const app = getApp();
const { choreApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, getCurrentFamily, formatDate } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    choreTypes: [],
    choreRecords: [],
    selectedDate: '',
    activeTab: 'record', // record | history
    showRecordModal: false,
    selectedChoreType: null,
    remark: '',
    isSubmitting: false,
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad() {
    this.setData({
      selectedDate: formatDate(new Date())
    });
    this.loadFamilyInfo();
  },

  onShow() {
    this.loadChoreTypes();
    if (this.data.activeTab === 'history') {
      this.loadChoreRecords(true);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadChoreTypes();
    if (this.data.activeTab === 'history') {
      this.loadChoreRecords(true);
    }
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 500);
  },

  // 加载家庭信息
  async loadFamilyInfo() {
    try {
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        this.setData({ familyInfo: familiesRes.data[0] });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  // 加载家务类型
  async loadChoreTypes() {
    if (!this.data.familyInfo) return;
    
    try {
      const res = await choreApi.getTypes(this.data.familyInfo.id);
      this.setData({ choreTypes: res.data || [] });
    } catch (error) {
      console.error('加载家务类型失败:', error);
    }
  },

  // 加载家务记录
  async loadChoreRecords(reset = false) {
    if (!this.data.familyInfo) return;

    if (reset) {
      this.setData({ page: 1, hasMore: true, choreRecords: [] });
    }

    if (!this.data.hasMore) return;

    try {
      const res = await choreApi.getRecords({
        familyId: this.data.familyInfo.id,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      const newRecords = res.data || [];
      this.setData({
        choreRecords: reset ? newRecords : [...this.data.choreRecords, ...newRecords],
        hasMore: newRecords.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('加载家务记录失败:', error);
    }
  },

  // 加载更多
  onReachBottom() {
    if (this.data.activeTab === 'history') {
      this.loadChoreRecords();
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    
    if (tab === 'history' && this.data.choreRecords.length === 0) {
      this.loadChoreRecords(true);
    }
  },

  // 选择家务类型
  selectChoreType(e) {
    const choreType = e.currentTarget.dataset.item;
    this.setData({
      selectedChoreType: choreType,
      showRecordModal: true
    });
  },

  // 关闭记录弹窗
  closeRecordModal() {
    this.setData({
      showRecordModal: false,
      selectedChoreType: null,
      remark: ''
    });
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 提交家务记录
  async submitRecord() {
    const { selectedChoreType, remark, familyInfo, isSubmitting } = this.data;
    
    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('提交中...');

      await choreApi.createRecord({
        familyId: familyInfo.id,
        choreTypeId: selectedChoreType.id,
        remark
      });

      hideLoading();
      showSuccess(`获得${selectedChoreType.points}积分！`);
      
      this.closeRecordModal();
      
      // 刷新记录列表
      if (this.data.activeTab === 'history') {
        this.loadChoreRecords(true);
      }
    } catch (error) {
      hideLoading();
      showError(error.message || '提交失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 去设置家务类型
  goToRewards() {
    wx.navigateTo({ url: '/pages/rewards/rewards' });
  }
});
