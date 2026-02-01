// pages/calendar/calendar.js
const api = require('../../utils/api');
const util = require('../../utils/util');
const app = getApp();

Page({
  data: {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    currentMonthText: '',
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    days: [],
    selectedDate: '',
    selectedDateText: '',
    selectedEvents: [],
    allEvents: [], // 存储当前月份的所有日程
    
    // 弹窗相关
    showAddModal: false,
    editMode: 'add', // add | edit
    showDetailModal: false,
    selectedEventDetail: null,
    categories: [
      { id: '1', name: '生活', color: '#4facfe' },
      { id: '2', name: '工作', color: '#00f2fe' },
      { id: '3', name: '纪念日', color: '#f093fb' },
      { id: '4', name: '出行', color: '#5eeff5' }
    ],
    formData: {
      title: '',
      startTime: '',
      endTime: '',
      categoryId: '1',
      location: '',
      description: ''
    },
    timeRange: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
    startTimeIndex: 9,
    endTimeIndex: 10
  },

  onLoad() {
    const now = new Date();
    const today = this.formatDate(now);
    this.setData({
      selectedDate: today,
      selectedDateText: this.formatDateText(now)
    });
    this.initCalendar();
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 }); // 修正：日历在 TabBar 中的索引是 1
      this.getTabBar().updateTabBar();
    }
    this.loadMonthEvents();
  },

  // 初始化日历数据
  initCalendar() {
    const { currentYear, currentMonth } = this.data;
    const days = [];
    
    // 获取当月第一天
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const firstDayWeek = firstDay.getDay();
    
    // 获取当月最后一天
    const lastDay = new Date(currentYear, currentMonth, 0);
    const lastDayDate = lastDay.getDate();
    
    // 填充上个月末尾
    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = firstDayWeek - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 2, prevMonthLastDay - i);
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        fullDate: this.formatDate(d)
      });
    }
    
    // 填充当月
    const today = this.formatDate(new Date());
    for (let i = 1; i <= lastDayDate; i++) {
      const d = new Date(currentYear, currentMonth - 1, i);
      const fullDate = this.formatDate(d);
      days.push({
        day: i,
        isCurrentMonth: true,
        isToday: fullDate === today,
        fullDate: fullDate
      });
    }
    
    // 填充下个月开头
    const nextDays = 42 - days.length;
    for (let i = 1; i <= nextDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      days.push({
        day: i,
        isCurrentMonth: false,
        fullDate: this.formatDate(d)
      });
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    this.setData({ 
      days,
      currentMonthText: monthNames[currentMonth - 1]
    });
  },

  // 加载月度日程
  async loadMonthEvents() {
    const { currentYear, currentMonth } = this.data;
    const startTime = new Date(currentYear, currentMonth - 2, 20).toISOString();
    const endTime = new Date(currentYear, currentMonth, 10).toISOString();
    
    try {
      const familyInfo = wx.getStorageSync('familyInfo');
      if (!familyInfo || !familyInfo.id) return;

      const res = await app.request({
        url: `/calendar/events?familyId=${familyInfo.id}&startTime=${startTime}&endTime=${endTime}`,
        method: 'GET'
      });
      
      if (res.success) {
        this.setData({ allEvents: res.data });
        this.updateDaysWithEvents();
        this.filterSelectedEvents();
      }
    } catch (error) {
      console.error('加载日程失败:', error);
    }
  },

  // 更新日历格子的日程标记
  updateDaysWithEvents() {
    const { days, allEvents } = this.data;
    const updatedDays = days.map(day => {
      const dayEvents = allEvents.filter(e => this.formatDate(new Date(e.startTime)) === day.fullDate);
      return {
        ...day,
        hasEvents: dayEvents.length > 0,
        eventColor: dayEvents[0]?.categoryColor || '#4facfe'
      };
    });
    this.setData({ days: updatedDays });
  },

  // 过滤选中日期的日程
  filterSelectedEvents() {
    const { selectedDate, allEvents } = this.data;
    const selectedEvents = allEvents.filter(e => this.formatDate(new Date(e.startTime)) === selectedDate)
      .map(e => ({
        ...e,
        startTimeText: this.formatTime(new Date(e.startTime))
      }));
    this.setData({ selectedEvents });
  },

  // 选择日期
  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ 
      selectedDate: date,
      selectedDateText: this.formatDateText(new Date(date))
    });
    this.filterSelectedEvents();
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentYear--;
      currentMonth = 12;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.initCalendar();
      this.loadMonthEvents();
    });
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentYear++;
      currentMonth = 1;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.initCalendar();
      this.loadMonthEvents();
    });
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  formatDateText(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${m}月${d}日`;
  },

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  showAddModal() {
    this.setData({ 
      showAddModal: true,
      editMode: 'add',
      'formData.title': '',
      'formData.location': '',
      'formData.description': '',
      'formData.categoryId': '1',
      startTimeIndex: 9,
      endTimeIndex: 10
    });
  },

  showEditModal() {
    const event = this.data.selectedEventDetail;
    if (!event) return;

    // 解析时间索引
    const startTimeStr = event.startTimeText; // HH:mm
    const startTimeIndex = this.data.timeRange.indexOf(startTimeStr) || 9;
    
    this.setData({
      showDetailModal: false,
      showAddModal: true,
      editMode: 'edit',
      'formData.title': event.title,
      'formData.location': event.location || '',
      'formData.description': event.description || '',
      'formData.categoryId': event.categoryId || '1',
      startTimeIndex: startTimeIndex,
      endTimeIndex: Math.min(startTimeIndex + 1, 23)
    });
  },

  hideAddModal() {
    this.setData({ showAddModal: false });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  onCategorySelect(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      'formData.categoryId': id
    });
  },

  onStartTimeChange(e) {
    this.setData({ startTimeIndex: e.detail.value });
  },

  onEndTimeChange(e) {
    this.setData({ endTimeIndex: e.detail.value });
  },

  showEventDetail(e) {
    const id = e.currentTarget.dataset.id;
    const event = this.data.selectedEvents.find(item => item.id === id);
    if (event) {
      this.setData({
        selectedEventDetail: event,
        showDetailModal: true
      });
    }
  },

  hideDetailModal() {
    this.setData({ showDetailModal: false });
  },

  async deleteEvent() {
    const { selectedEventDetail } = this.data;
    if (!selectedEventDetail) return;

    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这个日程吗？',
        confirmColor: '#ff4d4f',
        success: res => resolve(res.confirm)
      });
    });

    if (!confirm) return;

    wx.showLoading({ title: '正在删除...' });
    try {
      const familyInfo = wx.getStorageSync('familyInfo');
      const res = await app.request({
        url: `/calendar/events/${selectedEventDetail.id}?familyId=${familyInfo.id}`,
        method: 'DELETE'
      });

      if (res.success) {
        wx.showToast({ title: '已删除', icon: 'success' });
        this.setData({ showDetailModal: false });
        this.loadMonthEvents();
      }
    } catch (error) {
      console.error('删除日程失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async submitEvent() {
    const { formData, selectedDate, timeRange, startTimeIndex, endTimeIndex, editMode, selectedEventDetail } = this.data;
    
    if (!formData.title) {
      return wx.showToast({ title: '请输入日程标题', icon: 'none' });
    }

    const startTime = `${selectedDate}T${timeRange[startTimeIndex]}:00.000Z`;
    const endTime = `${selectedDate}T${timeRange[endTimeIndex]}:00.000Z`;

    wx.showLoading({ title: editMode === 'add' ? '正在保存...' : '正在更新...' });
    try {
      const familyInfo = wx.getStorageSync('familyInfo');
      const url = editMode === 'add' ? '/calendar/events' : `/calendar/events/${selectedEventDetail.id}`;
      const method = editMode === 'add' ? 'POST' : 'PUT';

      const res = await app.request({
        url: `${url}?familyId=${familyInfo.id}`,
        method: method,
        data: {
          ...formData,
          startTime,
          endTime,
          familyId: familyInfo.id
        }
      });

      if (res.success) {
        wx.showToast({ title: editMode === 'add' ? '添加成功' : '更新成功', icon: 'success' });
        this.setData({ showAddModal: false });
        this.loadMonthEvents();
      }
    } catch (error) {
      console.error('提交日程失败:', error);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
