// pages/moments/moments.js
const app = getApp();
const { postApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm, formatRelativeTime, getCurrentFamily } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    posts: [],
    showPublishModal: false,
    postContent: '',
    isAnonymous: false,
    isSubmitting: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    currentUserId: null
  },

  onLoad() {
    this.loadFamilyInfo();
  },

  onShow() {
    this.loadPosts(true);
  },

  onPullDownRefresh() {
    this.loadPosts(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.loadPosts();
  },

  async loadFamilyInfo() {
    try {
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        this.setData({ familyInfo: familiesRes.data[0] });
      }
      
      // 获取当前用户ID
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ currentUserId: userInfo.id });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  async loadPosts(reset = false) {
    if (!this.data.familyInfo) return;

    if (reset) {
      this.setData({ page: 1, hasMore: true, posts: [] });
    }

    if (!this.data.hasMore) return;

    try {
      const res = await postApi.getList({
        familyId: this.data.familyInfo.id,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      let newPosts = res.data || [];
      
      // 格式化时间
      newPosts = newPosts.map(post => ({
        ...post,
        createdAtText: formatRelativeTime(post.createdAt)
      }));

      this.setData({
        posts: reset ? newPosts : [...this.data.posts, ...newPosts],
        hasMore: newPosts.length === this.data.pageSize,
        page: this.data.page + 1
      });
    } catch (error) {
      console.error('加载动态失败:', error);
    }
  },

  // 打开发布弹窗
  openPublishModal() {
    this.setData({ showPublishModal: true });
  },

  // 关闭发布弹窗
  closePublishModal() {
    this.setData({
      showPublishModal: false,
      postContent: '',
      isAnonymous: false
    });
  },

  // 输入内容
  onContentInput(e) {
    this.setData({ postContent: e.detail.value });
  },

  // 切换匿名
  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous });
  },

  // 发布动态
  async publishPost() {
    const { postContent, isAnonymous, familyInfo, isSubmitting } = this.data;

    if (!postContent.trim()) {
      showError('请输入内容');
      return;
    }

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });
      showLoading('发布中...');

      await postApi.create({
        familyId: familyInfo.id,
        content: postContent.trim(),
        isAnonymous
      });

      hideLoading();
      showSuccess('发布成功');
      
      this.closePublishModal();
      this.loadPosts(true);
    } catch (error) {
      hideLoading();
      showError(error.message || '发布失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 点赞/取消点赞
  async toggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;

    try {
      await postApi.toggleLike(postId);
      
      // 更新本地状态
      const posts = this.data.posts;
      const post = posts[index];
      post.isLiked = !post.isLiked;
      post.likesCount = post.isLiked ? post.likesCount + 1 : post.likesCount - 1;
      
      this.setData({ posts });
    } catch (error) {
      showError(error.message || '操作失败');
    }
  },

  // 删除动态
  async deletePost(e) {
    const postId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;

    const confirmed = await showConfirm({
      title: '删除动态',
      content: '确定要删除这条动态吗？'
    });

    if (!confirmed) return;

    try {
      showLoading('删除中...');
      await postApi.delete(postId);
      hideLoading();

      // 从列表中移除
      const posts = this.data.posts;
      posts.splice(index, 1);
      this.setData({ posts });

      showSuccess('已删除');
    } catch (error) {
      hideLoading();
      showError(error.message || '删除失败');
    }
  },

  // 查看评论
  viewComments(e) {
    const postId = e.currentTarget.dataset.id;
    // 可以跳转到评论详情页或打开评论弹窗
    wx.navigateTo({
      url: `/pages/moments/comments?postId=${postId}`
    });
  }
});
