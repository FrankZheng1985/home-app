// pages/chores/chores.js
const app = getApp();
const { choreApi, familyApi, uploadApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, getCurrentFamily, formatDate, isLoggedIn, formatRelativeTime } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    currentUserId: '',
    isAdmin: false,
    choreTypes: [],        // 当前显示的家务类型（过滤后）
    allChoreTypes: [],     // 所有家务类型（原始数据）
    choreRecords: [],
    pendingRecords: [], // 待审核记录
    pendingCount: 0, // 待审核数量
    selectedDate: '',
    activeTab: 'record', // record | history | review
    showRecordModal: false,
    selectedChoreType: null,
    selectedImages: [], // 选择的照片
    remark: '',
    isSubmitting: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    currentCategory: 'all',
    // 扣分弹窗
    showDeductModal: false,
    deductingRecord: null,
    deductAmount: 0,
    deductReason: '',
    isReviewing: false
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      selectedDate: formatDate(new Date()),
      currentUserId: wx.getStorageSync('userInfo')?.id || ''
    });
    this.loadFamilyInfo();
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadChoreTypes();
    this.loadPendingCount();
    if (this.data.activeTab === 'history') {
      this.loadChoreRecords(true);
    } else if (this.data.activeTab === 'review' && this.data.isAdmin) {
      this.loadPendingRecords();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadChoreTypes();
    this.loadPendingCount();
    if (this.data.activeTab === 'history') {
      this.loadChoreRecords(true);
    } else if (this.data.activeTab === 'review') {
      this.loadPendingRecords();
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
        const family = familiesRes.data[0];
        const currentUserId = wx.getStorageSync('userInfo')?.id;
        
        // 判断是否为管理员
        let isAdmin = false;
        if (family.members) {
          const currentMember = family.members.find(m => m.id === currentUserId || m.userId === currentUserId);
          if (currentMember) {
            isAdmin = currentMember.role === 'creator' || currentMember.role === 'admin';
          }
        }
        
        this.setData({ 
          familyInfo: family,
          isAdmin
        });
        
        // 加载待审核数量
        this.loadPendingCount();
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  // 加载待审核数量
  async loadPendingCount() {
    if (!this.data.familyInfo || !this.data.isAdmin) {
      this.setData({ pendingCount: 0 });
      return;
    }
    
    try {
      const res = await choreApi.getPendingCount(this.data.familyInfo.id);
      this.setData({ pendingCount: res.data?.count || 0 });
    } catch (error) {
      console.error('加载待审核数量失败:', error);
    }
  },

  // 加载家务类型
  async loadChoreTypes() {
    if (!this.data.familyInfo) return;
    
    try {
      const res = await choreApi.getTypes(this.data.familyInfo.id);
      const types = res.data || [];
      // 保存原始数据和显示数据
      this.setData({ 
        allChoreTypes: types,
        choreTypes: types 
      });
      // 应用当前分类过滤
      if (this.data.currentCategory !== 'all') {
        this.filterChoreTypes(this.data.currentCategory);
      }
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

      const newRecords = (res.data || []).map(record => ({
        ...record,
        createdAtText: formatRelativeTime(record.completedAt || record.createdAt)
      }));
      
      this.setData({
        choreRecords: reset ? newRecords : [...this.data.choreRecords, ...newRecords],
        hasMore: newRecords.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('加载家务记录失败:', error);
    }
  },

  // 加载待审核记录
  async loadPendingRecords() {
    if (!this.data.familyInfo || !this.data.isAdmin) return;
    
    try {
      showLoading('加载中...');
      const res = await choreApi.getPendingRecords(this.data.familyInfo.id);
      const records = (res.data || []).map(record => ({
        ...record,
        completedAtText: formatRelativeTime(record.completedAt)
      }));
      this.setData({ pendingRecords: records });
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载待审核记录失败:', error);
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
    } else if (tab === 'review' && this.data.isAdmin) {
      this.loadPendingRecords();
    }
  },

  // 切换分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
    this.filterChoreTypes(category);
  },

  // 过滤家务类型
  filterChoreTypes(category) {
    const { allChoreTypes } = this.data;
    if (!allChoreTypes || allChoreTypes.length === 0) return;

    if (category === 'all') {
      this.setData({ choreTypes: allChoreTypes });
    } else {
      const filtered = allChoreTypes.filter(item => {
        // 根据关键词匹配分类
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        
        switch (category) {
          case 'clean':
            return cat === 'clean' || name.includes('清洁') || name.includes('扫') || 
                   name.includes('拖') || name.includes('擦') || name.includes('洗碗') ||
                   name.includes('整理') || name.includes('倒垃圾');
          case 'cook':
            return cat === 'cook' || name.includes('做饭') || name.includes('烹饪') || 
                   name.includes('煮') || name.includes('炒') || name.includes('厨');
          case 'laundry':
            return cat === 'laundry' || name.includes('洗衣') || name.includes('晾') || 
                   name.includes('叠') || name.includes('衣服') || name.includes('熨');
          case 'other':
            // 其他类别：不属于以上任何类别的
            const isClean = name.includes('清洁') || name.includes('扫') || 
                           name.includes('拖') || name.includes('擦') || name.includes('洗碗') ||
                           name.includes('整理') || name.includes('倒垃圾');
            const isCook = name.includes('做饭') || name.includes('烹饪') || 
                          name.includes('煮') || name.includes('炒') || name.includes('厨');
            const isLaundry = name.includes('洗衣') || name.includes('晾') || 
                             name.includes('叠') || name.includes('衣服') || name.includes('熨');
            return cat === 'other' || (!isClean && !isCook && !isLaundry);
          default:
            return true;
        }
      });
      this.setData({ choreTypes: filtered });
    }
  },

  // 选择家务类型
  selectChoreType(e) {
    const choreType = e.currentTarget.dataset.item;
    this.setData({
      selectedChoreType: choreType,
      showRecordModal: true,
      selectedImages: [],
      remark: ''
    });
  },

  // 关闭记录弹窗
  closeRecordModal() {
    this.setData({
      showRecordModal: false,
      selectedChoreType: null,
      selectedImages: [],
      remark: ''
    });
  },

  // 选择照片
  chooseImage() {
    const remainCount = 3 - this.data.selectedImages.length;
    if (remainCount <= 0) return;

    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => file.tempFilePath);
        this.setData({
          selectedImages: [...this.data.selectedImages, ...newImages]
        });
      }
    });
  },

  // 移除照片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.selectedImages];
    images.splice(index, 1);
    this.setData({ selectedImages: images });
  },

  // 预览照片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.selectedImages
    });
  },

  // 预览记录中的照片
  previewRecordImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls
    });
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 上传图片
  async uploadImages() {
    const { selectedImages } = this.data;
    if (!selectedImages || selectedImages.length === 0) return [];

    const uploadedUrls = [];
    
    for (const imagePath of selectedImages) {
      try {
        // 开发模式模拟上传
        if (!app.globalData.baseUrl || app.globalData.baseUrl.includes('localhost')) {
          uploadedUrls.push(imagePath);
          continue;
        }
        
        const res = await app.uploadFile({
          url: '/upload/image',
          filePath: imagePath,
          name: 'image'
        });
        
        if (res.data?.url) {
          uploadedUrls.push(res.data.url);
        }
      } catch (error) {
        console.error('上传图片失败:', error);
      }
    }
    
    return uploadedUrls;
  },

  // 提交家务记录
  async submitRecord() {
    const { selectedChoreType, remark, familyInfo, isSubmitting, selectedImages } = this.data;
    
    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('提交中...');

      // 上传图片
      let images = [];
      if (selectedImages.length > 0) {
        images = await this.uploadImages();
      }

      const res = await choreApi.createRecord({
        familyId: familyInfo.id,
        choreTypeId: selectedChoreType.id,
        note: remark,
        images
      });

      hideLoading();
      
      // 根据返回的状态显示不同提示
      if (res.data?.status === 'approved') {
        showSuccess(`获得${selectedChoreType.points}积分！`);
      } else {
        showSuccess('已提交，等待家长审核');
      }
      
      this.closeRecordModal();
      
      // 刷新数据
      if (this.data.activeTab === 'history') {
        this.loadChoreRecords(true);
      }
      this.loadPendingCount();
    } catch (error) {
      hideLoading();
      showError(error.message || '提交失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 通过审核
  async approveRecord(e) {
    const record = e.currentTarget.dataset.record;
    
    wx.showModal({
      title: '确认通过',
      content: `确定通过 ${record.userNickname} 的 ${record.choreName}，给予 ${record.points} 积分？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            showLoading('审核中...');
            await choreApi.reviewRecord(record.id, 'approve', 0, '', '');
            hideLoading();
            showSuccess('已通过');
            this.loadPendingRecords();
            this.loadPendingCount();
          } catch (error) {
            hideLoading();
            showError(error.message || '审核失败');
          }
        }
      }
    });
  },

  // 拒绝审核
  async rejectRecord(e) {
    const record = e.currentTarget.dataset.record;
    
    wx.showModal({
      title: '确认拒绝',
      content: `确定拒绝 ${record.userNickname} 的 ${record.choreName}？不计积分。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            showLoading('审核中...');
            await choreApi.reviewRecord(record.id, 'reject', 0, '', '审核未通过');
            hideLoading();
            showSuccess('已拒绝');
            this.loadPendingRecords();
            this.loadPendingCount();
          } catch (error) {
            hideLoading();
            showError(error.message || '审核失败');
          }
        }
      }
    });
  },

  // 显示扣分弹窗
  showDeductModal(e) {
    const record = e.currentTarget.dataset.record;
    this.setData({
      showDeductModal: true,
      deductingRecord: record,
      deductAmount: 0,
      deductReason: ''
    });
  },

  // 关闭扣分弹窗
  closeDeductModal() {
    this.setData({
      showDeductModal: false,
      deductingRecord: null,
      deductAmount: 0,
      deductReason: ''
    });
  },

  // 扣分滑块变化
  onDeductChange(e) {
    this.setData({ deductAmount: e.detail.value });
  },

  // 扣分原因输入
  onDeductReasonInput(e) {
    this.setData({ deductReason: e.detail.value });
  },

  // 确认扣分通过
  async confirmDeduct() {
    const { deductingRecord, deductAmount, deductReason, isReviewing } = this.data;
    
    if (isReviewing) return;
    
    if (deductAmount > 0 && !deductReason.trim()) {
      showError('请填写扣分原因');
      return;
    }

    try {
      this.setData({ isReviewing: true });
      showLoading('审核中...');
      
      await choreApi.reviewRecord(
        deductingRecord.id, 
        'approve', 
        deductAmount, 
        deductReason.trim(),
        ''
      );
      
      hideLoading();
      const finalPoints = deductingRecord.points - deductAmount;
      showSuccess(`已通过，${deductAmount > 0 ? `扣${deductAmount}分，实得${finalPoints}分` : `获得${finalPoints}分`}`);
      
      this.closeDeductModal();
      this.loadPendingRecords();
      this.loadPendingCount();
    } catch (error) {
      hideLoading();
      showError(error.message || '审核失败');
    } finally {
      this.setData({ isReviewing: false });
    }
  },

  // 阻止冒泡
  preventClose() {},

  // 快速记录 - 显示家务类型选择菜单
  showQuickRecord() {
    const { choreTypes, allChoreTypes, isAdmin } = this.data;
    const types = allChoreTypes && allChoreTypes.length > 0 ? allChoreTypes : choreTypes;
    
    if (types.length === 0) {
      // 没有家务类型，引导去添加
      if (isAdmin) {
        wx.showModal({
          title: '提示',
          content: '还没有设置家务类型，是否去添加？',
          confirmText: '去添加',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/rewards/rewards' });
            }
          }
        });
      } else {
        wx.showToast({
          title: '暂无家务类型',
          icon: 'none'
        });
      }
      return;
    }
    
    // 显示家务类型选择菜单（最多显示6个常用的）
    const itemList = types.slice(0, 6).map(t => `${t.icon || '🧹'} ${t.name} (+${t.points}分)`);
    
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const selectedType = types[res.tapIndex];
        if (selectedType) {
          this.selectChoreType({ currentTarget: { dataset: { item: selectedType } } });
        }
      }
    });
  },

  // 去设置家务类型
  goToRewards() {
    wx.navigateTo({ url: '/pages/rewards/rewards' });
  }
});
