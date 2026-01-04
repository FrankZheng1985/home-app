// pages/sports/sports.js - 运动打卡页面
const api = require('../../utils/api');

Page({
  data: {
    // 用户状态
    hasFamily: false,
    isLoading: true,
    
    // 步数相关
    todaySteps: 0,
    stepsTarget: 8000,
    stepsProgress: 0,
    
    // 统计
    weekStats: {
      totalDays: 0,
      totalMinutes: 0
    },
    continuousDays: 0,
    
    // 本周日历
    weekDays: [],
    
    // 今日记录
    todayRecords: [],
    
    // 运动类型
    sportTypes: [],
    
    // 历史记录
    historyRecords: [],
    
    // 弹窗控制
    showAddModal: false,
    showTypeModal: false,
    
    // 表单数据
    selectedType: null,
    duration: 30,
    remark: '',
    estimatedCalories: 0,
    isSubmitting: false,
    
    // 新类型表单
    newTypeName: '',
    newTypeCalories: ''
  },

  onLoad() {
    this.initWeekDays();
  },

  onShow() {
    // 每次显示页面时都重新检查用户状态
    this.checkUserStatus();
  },
  
  // 检查用户状态
  async checkUserStatus() {
    this.setData({ isLoading: true });
    
    try {
      // 优先从服务器获取最新用户信息
      const res = await api.userApi.getProfile();
      console.log('获取用户信息响应:', JSON.stringify(res));
      
      // 兼容两种响应格式: { success: true, data: {...} } 或 { data: {...} }
      const userInfo = res.data || res;
      console.log('用户信息:', JSON.stringify(userInfo));
      console.log('familyId:', userInfo.familyId);
      
      if (userInfo && userInfo.id) {
        // 更新全局和本地存储
        const app = getApp();
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
        
        if (userInfo.familyId) {
          console.log('用户已加入家庭，familyId:', userInfo.familyId);
          this.setData({ hasFamily: true, isLoading: false });
          this.loadSportTypes();
          this.loadTodayRecords();
          this.loadHistoryRecords();
          this.loadWeekStats();
          this.syncWechatSteps();
        } else {
          console.log('用户未加入家庭');
          this.setData({ hasFamily: false, isLoading: false });
        }
      } else {
        console.log('API响应无效，尝试本地存储');
        // 如果获取失败，尝试从本地存储读取
        const localUserInfo = wx.getStorageSync('userInfo');
        if (localUserInfo && localUserInfo.familyId) {
          this.setData({ hasFamily: true, isLoading: false });
          this.loadSportTypes();
          this.loadTodayRecords();
          this.loadHistoryRecords();
          this.loadWeekStats();
        } else {
          this.setData({ hasFamily: false, isLoading: false });
        }
      }
    } catch (error) {
      console.log('检查用户状态错误:', error.message || error);
      // 网络错误时尝试从本地存储读取
      const localUserInfo = wx.getStorageSync('userInfo');
      if (localUserInfo && localUserInfo.familyId) {
        this.setData({ hasFamily: true, isLoading: false });
        this.loadSportTypes();
        this.loadTodayRecords();
        this.loadHistoryRecords();
        this.loadWeekStats();
      } else {
        this.setData({ hasFamily: false, isLoading: false });
      }
    }
  },

  onPullDownRefresh() {
    if (!this.data.hasFamily) {
      this.checkUserStatus();
      wx.stopPullDownRefresh();
      return;
    }
    
    Promise.all([
      this.loadTodayRecords(),
      this.loadHistoryRecords(),
      this.loadWeekStats(),
      this.syncWechatSteps()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 初始化本周日历
  initWeekDays() {
    const weekDays = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const today = new Date();
    const currentDay = today.getDay();
    
    // 获取本周一的日期
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDays.push({
        date: this.formatDate(date),
        day: date.getDate(),
        dayName: dayNames[date.getDay()],
        isToday: this.formatDate(date) === this.formatDate(today),
        checked: false
      });
    }
    
    this.setData({ weekDays });
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 同步微信运动步数（简化版 - 从本地存储读取或手动输入）
  async syncWechatSteps() {
    // 如果没有加入家庭，不执行同步
    if (!this.data.hasFamily) {
      return;
    }
    
    try {
      // 从本地存储读取今日步数
      const today = this.formatDate(new Date());
      const savedSteps = wx.getStorageSync(`steps_${today}`) || 0;
      
      if (savedSteps > 0) {
        const stepsProgress = Math.round((savedSteps / this.data.stepsTarget) * 100);
        this.setData({
          todaySteps: savedSteps,
          stepsProgress
        });
      }
    } catch (error) {
      console.log('读取步数:', error.message || error);
    }
  },
  
  // 手动输入步数
  inputSteps() {
    wx.showModal({
      title: '输入今日步数',
      editable: true,
      placeholderText: '请输入步数',
      success: (res) => {
        if (res.confirm && res.content) {
          const steps = parseInt(res.content) || 0;
          if (steps > 0 && steps < 100000) {
            const today = this.formatDate(new Date());
            wx.setStorageSync(`steps_${today}`, steps);
            
            const stepsProgress = Math.round((steps / this.data.stepsTarget) * 100);
            this.setData({
              todaySteps: steps,
              stepsProgress
            });
            wx.showToast({ title: '步数已更新', icon: 'success' });
          } else {
            wx.showToast({ title: '请输入有效步数', icon: 'none' });
          }
        }
      }
    });
  },

  // 加载运动类型
  async loadSportTypes() {
    try {
      const res = await api.sportsApi.getTypes();
      if (res.success) {
        this.setData({ sportTypes: res.data || this.getDefaultTypes() });
      } else {
        this.setData({ sportTypes: this.getDefaultTypes() });
      }
    } catch (error) {
      console.error('加载运动类型失败:', error);
      this.setData({ sportTypes: this.getDefaultTypes() });
    }
  },

  // 默认运动类型
  getDefaultTypes() {
    return [
      { id: 'run', name: '跑步', icon: '🏃', color: '#4caf50', caloriesPerMin: 10, isPreset: true },
      { id: 'walk', name: '步行', icon: '🚶', color: '#8bc34a', caloriesPerMin: 4, isPreset: true },
      { id: 'bike', name: '骑行', icon: '🚴', color: '#03a9f4', caloriesPerMin: 8, isPreset: true },
      { id: 'swim', name: '游泳', icon: '🏊', color: '#00bcd4', caloriesPerMin: 12, isPreset: true },
      { id: 'yoga', name: '瑜伽', icon: '🧘', color: '#9c27b0', caloriesPerMin: 3, isPreset: true },
      { id: 'gym', name: '健身', icon: '💪', color: '#ff5722', caloriesPerMin: 8, isPreset: true },
      { id: 'ball', name: '球类', icon: '⚽', color: '#ff9800', caloriesPerMin: 9, isPreset: true },
      { id: 'jump', name: '跳绳', icon: '🪢', color: '#e91e63', caloriesPerMin: 11, isPreset: true }
    ];
  },

  // 加载今日记录
  async loadTodayRecords() {
    try {
      const today = this.formatDate(new Date());
      const res = await api.sportsApi.getRecords({ date: today });
      
      if (res.success && res.data) {
        const records = res.data.map(record => ({
          ...record,
          timeText: this.formatTime(record.createdAt)
        }));
        this.setData({ todayRecords: records });
        
        // 更新日历打卡状态
        this.updateCalendarChecked();
      }
    } catch (error) {
      console.error('加载今日记录失败:', error);
    }
  },

  // 加载历史记录
  async loadHistoryRecords() {
    try {
      const res = await api.sportsApi.getRecords({ limit: 20 });
      
      if (res.success && res.data) {
        const records = res.data.map(record => {
          const date = new Date(record.createdAt);
          return {
            ...record,
            dayText: date.getDate(),
            weekdayText: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
          };
        });
        this.setData({ historyRecords: records });
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  },

  // 加载周统计
  async loadWeekStats() {
    try {
      const res = await api.sportsApi.getWeekStats();
      
      if (res.success && res.data) {
        this.setData({
          weekStats: res.data,
          continuousDays: res.data.continuousDays || 0
        });
        
        // 更新日历打卡状态
        if (res.data.checkedDates) {
          this.updateCalendarWithDates(res.data.checkedDates);
        }
      }
    } catch (error) {
      console.error('加载周统计失败:', error);
    }
  },

  // 更新日历打卡状态
  updateCalendarChecked() {
    const { weekDays, todayRecords } = this.data;
    const today = this.formatDate(new Date());
    
    if (todayRecords.length > 0) {
      const updatedWeekDays = weekDays.map(day => ({
        ...day,
        checked: day.date === today ? true : day.checked
      }));
      this.setData({ weekDays: updatedWeekDays });
    }
  },

  // 根据日期数组更新日历
  updateCalendarWithDates(checkedDates) {
    const { weekDays } = this.data;
    const updatedWeekDays = weekDays.map(day => ({
      ...day,
      checked: checkedDates.includes(day.date)
    }));
    this.setData({ weekDays: updatedWeekDays });
  },

  // 格式化时间
  formatTime(dateString) {
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({ 
      showAddModal: true,
      selectedType: null,
      duration: 30,
      remark: '',
      estimatedCalories: 0
    });
  },

  // 关闭添加弹窗
  closeAddModal() {
    this.setData({ showAddModal: false });
  },

  // 阻止事件冒泡
  preventClose() {},

  // 选择运动类型
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ 
      selectedType: type,
      estimatedCalories: Math.round(type.caloriesPerMin * this.data.duration)
    });
  },

  // 快速打卡
  quickCheckin(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      showAddModal: true,
      selectedType: type,
      duration: 30,
      estimatedCalories: Math.round(type.caloriesPerMin * 30)
    });
  },

  // 选择运动类型（从类型列表）
  selectSportType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      showAddModal: true,
      selectedType: type,
      duration: 30,
      estimatedCalories: Math.round(type.caloriesPerMin * 30)
    });
  },

  // 增加时长
  increaseDuration() {
    const duration = this.data.duration + 5;
    this.updateDuration(duration);
  },

  // 减少时长
  decreaseDuration() {
    const duration = Math.max(5, this.data.duration - 5);
    this.updateDuration(duration);
  },

  // 输入时长
  onDurationInput(e) {
    const duration = parseInt(e.detail.value) || 0;
    this.updateDuration(duration);
  },

  // 快速设置时长
  setQuickDuration(e) {
    const duration = parseInt(e.currentTarget.dataset.dur);
    this.updateDuration(duration);
  },

  // 更新时长和预估消耗
  updateDuration(duration) {
    const { selectedType } = this.data;
    this.setData({
      duration,
      estimatedCalories: selectedType ? Math.round(selectedType.caloriesPerMin * duration) : 0
    });
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 提交运动记录
  async submitRecord() {
    const { selectedType, duration, remark, todaySteps, isSubmitting } = this.data;
    
    if (isSubmitting || !selectedType || duration <= 0) return;
    
    this.setData({ isSubmitting: true });
    
    try {
      const calories = Math.round(selectedType.caloriesPerMin * duration);
      
      const res = await api.sportsApi.createRecord({
        sportTypeId: selectedType.id,
        sportType: selectedType.name,
        icon: selectedType.icon,
        color: selectedType.color,
        duration,
        calories,
        steps: todaySteps,
        remark
      });
      
      if (res.success) {
        wx.showToast({ title: '打卡成功！', icon: 'success' });
        this.closeAddModal();
        this.loadTodayRecords();
        this.loadHistoryRecords();
        this.loadWeekStats();
      } else {
        wx.showToast({ title: res.message || '打卡失败', icon: 'none' });
      }
    } catch (error) {
      console.error('提交记录失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 显示类型管理弹窗
  showTypeModal() {
    this.setData({ showTypeModal: true });
  },

  // 关闭类型管理弹窗
  closeTypeModal() {
    this.setData({ showTypeModal: false });
  },

  // 输入新类型名称
  onNewTypeNameInput(e) {
    this.setData({ newTypeName: e.detail.value });
  },

  // 输入新类型热量
  onNewTypeCaloriesInput(e) {
    this.setData({ newTypeCalories: e.detail.value });
  },

  // 添加新运动类型
  async addNewType() {
    const { newTypeName, newTypeCalories } = this.data;
    
    if (!newTypeName.trim()) {
      wx.showToast({ title: '请输入运动名称', icon: 'none' });
      return;
    }
    
    const calories = parseFloat(newTypeCalories) || 5;
    
    try {
      const res = await api.sportsApi.createType({
        name: newTypeName.trim(),
        icon: '🏋️',
        color: '#607d8b',
        caloriesPerMin: calories
      });
      
      if (res.success) {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.setData({ newTypeName: '', newTypeCalories: '' });
        this.loadSportTypes();
      } else {
        wx.showToast({ title: res.message || '添加失败', icon: 'none' });
      }
    } catch (error) {
      console.error('添加类型失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // 跳转到家庭页面
  goToFamily() {
    wx.navigateTo({ url: '/pages/family/family' });
  },

  // 删除运动类型
  async deleteType(e) {
    const typeId = e.currentTarget.dataset.id;
    
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这个运动类型吗？',
        success: resolve
      });
    });
    
    if (!res.confirm) return;
    
    try {
      const deleteRes = await api.sportsApi.deleteType(typeId);
      
      if (deleteRes.success) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.loadSportTypes();
      } else {
        wx.showToast({ title: deleteRes.message || '删除失败', icon: 'none' });
      }
    } catch (error) {
      console.error('删除类型失败:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});
