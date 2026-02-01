// pages/inventory/inventory.js
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    currentTab: 'inventory', // inventory | shopping
    inventoryItems: [],
    shoppingList: [],
    loading: false,

    // 弹窗相关
    showAddModal: false,
    showCategoryModal: false,
    categories: [],
    formData: {
      name: '',
      categoryId: '',
      currentStock: 0,
      minStock: 1,
      unit: '个',
      remark: ''
    },
    newCategory: {
      name: '',
      icon: '📦'
    }
  },

  onLoad() {
    this.loadData();
    this.loadCategories();
  },

  onShow() {
    // 更新自定义TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 }); // 修正：物资在 TabBar 中的索引是 2
      this.getTabBar().updateTabBar();
    }
    // 每次显示页面刷新数据
    this.loadData();
  },

  // 兼容 catchtap="true" 的写法
  true() {},

  async loadCategories() {
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      const familyInfo = wx.getStorageSync('familyInfo');
      familyId = familyInfo ? familyInfo.id : '';
    }
    
    if (!familyId) return;

    try {
      const res = await app.request({
        url: `/inventory/categories?familyId=${familyId}`,
        method: 'GET'
      });
      if (res.success) {
        this.setData({ 
          categories: res.data,
          'formData.categoryId': res.data[0]?.id || ''
        });
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadData();
  },

  async loadData() {
    const { currentTab } = this.data;
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      familyId = wx.getStorageSync('familyInfo')?.id;
    }
    if (!familyId) return;

    this.setData({ loading: true });
    try {
      if (currentTab === 'inventory') {
        const res = await app.request({
          url: `/inventory/items?familyId=${familyId}`,
          method: 'GET'
        });
        if (res.success) {
          this.setData({ inventoryItems: res.data });
        }
      } else {
        const res = await app.request({
          url: `/inventory/shopping-list?familyId=${familyId}`,
          method: 'GET'
        });
        if (res.success) {
          this.setData({ shoppingList: res.data });
        }
      }
    } catch (error) {
      console.error('加载物资数据失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async updateStock(e) {
    const { id, amount } = e.currentTarget.dataset;
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      familyId = wx.getStorageSync('familyInfo')?.id;
    }
    
    try {
      const res = await app.request({
        url: `/inventory/items/${id}/stock`,
        method: 'PATCH',
        data: {
          familyId,
          amount: parseInt(amount)
        }
      });

      if (res.success) {
        // 本地快速更新 UI
        const items = this.data.inventoryItems.map(item => {
          if (item.id === id) {
            const newStock = Math.max(0, item.currentStock + parseInt(amount));
            // 如果库存低于预警值，提示用户
            if (newStock <= item.minStock && parseInt(amount) < 0) {
              wx.showToast({ title: `${item.name}库存不足，已加入采购建议`, icon: 'none' });
            }
            return { ...item, currentStock: newStock };
          }
          return item;
        });
        this.setData({ inventoryItems: items });
      }
    } catch (error) {
      console.error('更新库存失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  showAddItem() {
    this.setData({ 
      showAddModal: true,
      'formData.name': '',
      'formData.currentStock': 0,
      'formData.minStock': 1,
      'formData.remark': ''
    });
  },

  hideAddModal() {
    this.setData({ showAddModal: false });
  },

  showCategoryManage() {
    this.setData({ showCategoryModal: true });
  },

  hideCategoryModal() {
    this.setData({ showCategoryModal: false });
  },

  onNewCategoryInput(e) {
    this.setData({ 'newCategory.name': e.detail.value });
  },

  async addCategory() {
    const { newCategory } = this.data;
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      familyId = wx.getStorageSync('familyInfo')?.id;
    }

    if (!newCategory.name) {
      return wx.showToast({ title: '请输入分类名称', icon: 'none' });
    }

    wx.showLoading({ title: '添加中...' });
    try {
      const res = await app.request({
        url: '/inventory/categories',
        method: 'POST',
        data: { ...newCategory, familyId }
      });

      if (res.success) {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.setData({ 'newCategory.name': '' });
        this.loadCategories();
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.error || '添加失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('添加分类失败:', error);
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  async deleteCategory(e) {
    const { id, name } = e.currentTarget.dataset;
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      familyId = wx.getStorageSync('familyInfo')?.id;
    }

    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除分类“${name}”吗？`,
        success: res => resolve(res.confirm)
      });
    });

    if (!confirm) return;

    wx.showLoading({ title: '删除中...' });
    try {
      const res = await app.request({
        url: `/inventory/categories/${id}?familyId=${familyId}`,
        method: 'DELETE'
      });

      if (res.success) {
        wx.showToast({ title: '已删除', icon: 'success' });
        this.loadCategories();
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.error || '删除失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('删除分类失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  onCategorySelect(e) {
    this.setData({
      'formData.categoryId': e.currentTarget.dataset.id
    });
  },

  async submitItem() {
    const { formData } = this.data;
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      familyId = wx.getStorageSync('familyInfo')?.id;
    }

    if (!formData.name) {
      return wx.showToast({ title: '请输入物资名称', icon: 'none' });
    }

    wx.showLoading({ title: '正在添加...' });
    try {
      const res = await app.request({
        url: '/inventory/items',
        method: 'POST',
        data: {
          ...formData,
          familyId
        }
      });

      if (res.success) {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.setData({ showAddModal: false });
        this.loadData();
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.error || '添加失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('添加物资失败:', error);
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  async toggleBought(e) {
    const id = e.currentTarget.dataset.id;
    let familyId = wx.getStorageSync('familyId');
    if (!familyId) {
      familyId = wx.getStorageSync('familyInfo')?.id;
    }

    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认购买',
        content: '标记为已买将自动补回库存，确定吗？',
        success: res => resolve(res.confirm)
      });
    });

    if (!confirm) return;

    wx.showLoading({ title: '处理中...' });
    try {
      const res = await app.request({
        url: `/inventory/shopping-list/${id}/buy`,
        method: 'POST',
        data: { familyId }
      });

      if (res.success) {
        wx.showToast({ title: '已入库', icon: 'success' });
        this.loadData();
      } else {
        wx.hideLoading();
        wx.showToast({ title: res.error || '操作失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('标记购买失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});
