// pages/profile/points.js - 积分统计页面
const app = getApp();
const { pointsApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, showConfirm, formatRelativeTime } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    isAdmin: false,
    summary: {
      availablePoints: 0,
      thisMonth: 0,
      redeemedTotal: 0,
      rank: '-'
    },
    // 月度统计
    selectedMonth: '',
    selectedMonthDisplay: '',
    monthStats: {
      earned: 0,
      redeemed: 0,
      balance: 0
    },
    // 家庭成员列表（用于结算）
    familyMembers: [],
    // 积分明细
    transactions: [],
    filterType: 'all', // all, earn, redeem
    hasMore: true,
    page: 1,
    pageSize: 20,
    // 结算弹窗
    showSettleModal: false,
    settleMember: null,
    settleAmount: '',
    settleRemark: '',
    isSettling: false
  },

  onLoad() {
    // 初始化当前月份
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.setData({
      selectedMonth: currentMonth,
      selectedMonthDisplay: this.formatMonthDisplay(currentMonth)
    });
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

  // 格式化月份显示
  formatMonthDisplay(monthStr) {
    const [year, month] = monthStr.split('-');
    return `${year}年${parseInt(month)}月`;
  },

  // 月份选择变化
  onMonthChange(e) {
    const selectedMonth = e.detail.value;
    this.setData({
      selectedMonth,
      selectedMonthDisplay: this.formatMonthDisplay(selectedMonth)
    });
    this.loadMonthStats();
  },

  async loadData() {
    try {
      showLoading('加载中...');

      // 获取家庭信息
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        const currentUserId = wx.getStorageSync('userInfo')?.id;
        
        // 判断是否为管理员
        let isAdmin = false;
        if (familyInfo.members) {
          const currentMember = familyInfo.members.find(m => 
            m.id === currentUserId || m.userId === currentUserId
          );
          if (currentMember) {
            isAdmin = currentMember.role === 'creator' || currentMember.role === 'admin';
          }
        }
        
        this.setData({ familyInfo, isAdmin });

        // 获取积分概览
        await this.loadSummary();
        
        // 获取月度统计
        await this.loadMonthStats();

        // 如果是管理员，获取家庭成员列表
        if (isAdmin) {
          await this.loadFamilyMembers();
        }

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

  // 获取积分概览
  async loadSummary() {
    try {
      const res = await pointsApi.getSummary(this.data.familyInfo.id);
      const data = res.data || {};
      
      // 计算可用积分 = 总获得 - 已兑现
      const availablePoints = (data.totalPoints || 0) - (data.redeemedTotal || 0);
      
      this.setData({
        summary: {
          availablePoints: availablePoints,
          thisMonth: data.thisMonth || 0,
          redeemedTotal: data.redeemedTotal || 0,
          rank: data.rank || '-'
        }
      });
    } catch (error) {
      console.error('获取积分概览失败:', error);
    }
  },

  // 获取月度统计
  async loadMonthStats() {
    try {
      const { familyInfo, selectedMonth } = this.data;
      if (!familyInfo) return;
      
      const res = await pointsApi.getMonthStats({
        familyId: familyInfo.id,
        month: selectedMonth
      });
      
      this.setData({
        monthStats: res.data || { earned: 0, redeemed: 0, balance: 0 }
      });
    } catch (error) {
      console.error('获取月度统计失败:', error);
      // 使用默认值
      this.setData({
        monthStats: { earned: 0, redeemed: 0, balance: 0 }
      });
    }
  },

  // 获取家庭成员（带积分信息）
  async loadFamilyMembers() {
    try {
      const { familyInfo } = this.data;
      if (!familyInfo) return;
      
      const res = await pointsApi.getMembersPoints(familyInfo.id);
      this.setData({
        familyMembers: res.data || []
      });
    } catch (error) {
      console.error('获取成员积分失败:', error);
    }
  },

  // 切换筛选类型
  switchFilter(e) {
    const filterType = e.currentTarget.dataset.type;
    this.setData({
      filterType,
      page: 1,
      hasMore: true,
      transactions: []
    });
    this.loadTransactions();
  },

  // 加载积分记录
  async loadTransactions() {
    if (!this.data.familyInfo || !this.data.hasMore) return;

    try {
      const res = await pointsApi.getTransactions({
        familyId: this.data.familyInfo.id,
        page: this.data.page,
        pageSize: this.data.pageSize,
        type: this.data.filterType === 'all' ? undefined : this.data.filterType
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
  },

  // 显示结算弹窗
  showSettleModal(e) {
    const member = e.currentTarget.dataset.member;
    this.setData({
      showSettleModal: true,
      settleMember: member,
      settleAmount: '',
      settleRemark: ''
    });
  },

  // 关闭结算弹窗
  closeSettleModal() {
    this.setData({
      showSettleModal: false,
      settleMember: null,
      settleAmount: '',
      settleRemark: ''
    });
  },

  // 阻止事件冒泡
  preventClose() {},

  // 输入结算金额
  onSettleAmountInput(e) {
    let value = parseInt(e.detail.value) || '';
    const max = this.data.settleMember?.availablePoints || 0;
    if (value > max) value = max;
    this.setData({ settleAmount: value });
  },

  // 输入备注
  onSettleRemarkInput(e) {
    this.setData({ settleRemark: e.detail.value });
  },

  // 快速设置金额
  setQuickAmount(e) {
    let amount = parseInt(e.currentTarget.dataset.amount);
    const max = this.data.settleMember?.availablePoints || 0;
    if (amount > max) amount = max;
    this.setData({ settleAmount: amount });
  },

  // 设置全部金额
  setFullAmount() {
    const max = this.data.settleMember?.availablePoints || 0;
    this.setData({ settleAmount: max });
  },

  // 确认结算
  async confirmSettle() {
    const { settleMember, settleAmount, settleRemark, familyInfo } = this.data;
    
    if (!settleAmount || settleAmount <= 0) {
      showError('请输入有效的结算积分');
      return;
    }

    if (settleAmount > settleMember.availablePoints) {
      showError('结算积分不能超过可用积分');
      return;
    }

    const confirmed = await showConfirm({
      title: '确认结算',
      content: `确定给 ${settleMember.user.nickname} 结算 ${settleAmount} 积分吗？结算后将扣除相应积分。`
    });

    if (!confirmed) return;

    try {
      this.setData({ isSettling: true });
      showLoading('处理中...');

      await pointsApi.redeemPoints({
        familyId: familyInfo.id,
        memberId: settleMember.userId || settleMember.id,
        points: settleAmount,
        remark: settleRemark || `${this.data.selectedMonthDisplay}积分结算`
      });

      hideLoading();
      showSuccess('结算成功');
      
      this.closeSettleModal();
      
      // 重新加载数据
      await this.loadData();
    } catch (error) {
      hideLoading();
      showError(error.message || '结算失败');
    } finally {
      this.setData({ isSettling: false });
    }
  }
});
