// pages/rewards/rewards.js
const app = getApp();
const { choreApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    choreTypes: [],
    isAdmin: false,
    showEditModal: false,
    editMode: 'add', // add | edit
    editingType: {
      id: null,
      name: '',
      icon: '🧹',
      points: 10,
      description: ''
    },
    iconOptions: ['🧹', '🧽', '🍳', '🧺', '🛒', '🗑️', '🚿', '🧼', '🛏️', '🪴', '🐕', '🚗', '🧸', '📦', '🪥', '🍽️'],
    isSubmitting: false
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadChoreTypes();
  },

  async loadData() {
    try {
      showLoading('加载中...');
      
      // 获取家庭信息
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        this.setData({ familyInfo });

        // 检查是否为管理员
        const membersRes = await familyApi.getMembers(familyInfo.id);
        const currentUserId = wx.getStorageSync('userInfo')?.id;
        const currentMember = membersRes.data?.find(m => m.userId === currentUserId);
        const isAdmin = currentMember && (currentMember.role === 'admin' || currentMember.role === 'owner');
        this.setData({ isAdmin });

        // 获取家务类型
        await this.loadChoreTypes();
      }
      
      hideLoading();
    } catch (error) {
      hideLoading();
      showError(error.message || '加载失败');
    }
  },

  async loadChoreTypes() {
    if (!this.data.familyInfo) return;

    try {
      const res = await choreApi.getTypes(this.data.familyInfo.id);
      this.setData({ choreTypes: res.data || [] });
    } catch (error) {
      console.error('加载家务类型失败:', error);
    }
  },

  // 打开添加弹窗
  openAddModal() {
    this.setData({
      showEditModal: true,
      editMode: 'add',
      editingType: {
        id: null,
        name: '',
        icon: '🧹',
        points: 10,
        description: ''
      }
    });
  },

  // 打开编辑弹窗
  openEditModal(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditModal: true,
      editMode: 'edit',
      editingType: { ...item }
    });
  },

  // 关闭弹窗
  closeEditModal() {
    this.setData({
      showEditModal: false,
      editingType: {
        id: null,
        name: '',
        icon: '🧹',
        points: 10,
        description: ''
      }
    });
  },

  // 输入名称
  onNameInput(e) {
    this.setData({ 'editingType.name': e.detail.value });
  },

  // 选择图标
  selectIcon(e) {
    const icon = e.currentTarget.dataset.icon;
    this.setData({ 'editingType.icon': icon });
  },

  // 输入积分
  onPointsInput(e) {
    const points = parseInt(e.detail.value) || 0;
    this.setData({ 'editingType.points': points });
  },

  // 输入描述
  onDescInput(e) {
    this.setData({ 'editingType.description': e.detail.value });
  },

  // 保存
  async saveChoreType() {
    const { editMode, editingType, familyInfo, isSubmitting } = this.data;

    if (!editingType.name.trim()) {
      showError('请输入家务名称');
      return;
    }

    if (editingType.points <= 0) {
      showError('积分必须大于0');
      return;
    }

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('保存中...');

      if (editMode === 'add') {
        await choreApi.createType({
          familyId: familyInfo.id,
          name: editingType.name.trim(),
          icon: editingType.icon,
          points: editingType.points,
          description: editingType.description.trim()
        });
      } else {
        await choreApi.updateType(editingType.id, {
          name: editingType.name.trim(),
          icon: editingType.icon,
          points: editingType.points,
          description: editingType.description.trim()
        });
      }

      hideLoading();
      showSuccess('保存成功');
      this.closeEditModal();
      this.loadChoreTypes();
    } catch (error) {
      hideLoading();
      showError(error.message || '保存失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 删除
  async deleteChoreType(e) {
    const typeId = e.currentTarget.dataset.id;
    const typeName = e.currentTarget.dataset.name;

    const confirmed = await showConfirm({
      title: '删除家务类型',
      content: `确定要删除"${typeName}"吗？删除后相关记录的类型将显示为已删除。`
    });

    if (!confirmed) return;

    try {
      showLoading('删除中...');
      await choreApi.deleteType(typeId);
      hideLoading();
      showSuccess('已删除');
      this.loadChoreTypes();
    } catch (error) {
      hideLoading();
      showError(error.message || '删除失败');
    }
  }
});
