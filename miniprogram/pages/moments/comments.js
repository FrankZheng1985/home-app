// pages/moments/comments.js
const app = getApp();
const { postApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm, formatRelativeTime } = require('../../utils/util');

Page({
  data: {
    postId: null,
    post: null,
    comments: [],
    commentContent: '',
    isSubmitting: false,
    inputFocus: false,
    currentUserId: null
  },

  onLoad(options) {
    const { postId } = options;
    if (!postId) {
      showError('参数错误');
      wx.navigateBack();
      return;
    }
    
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ 
      postId,
      currentUserId: userInfo?.id 
    });
    
    this.loadPostDetail();
    this.loadComments();
  },

  onShow() {
    this.loadComments();
  },

  // 加载帖子详情
  async loadPostDetail() {
    try {
      const res = await postApi.getDetail(this.data.postId);
      if (res.data) {
        const post = res.data;
        post.createdAtText = formatRelativeTime(post.createdAt || post.created_at);
        this.setData({ post });
      }
    } catch (error) {
      console.error('加载帖子详情失败:', error);
    }
  },

  // 加载评论列表
  async loadComments() {
    try {
      const res = await postApi.getComments(this.data.postId);
      let comments = res.data || [];
      
      // 格式化时间
      comments = comments.map(c => ({
        ...c,
        createdAtText: formatRelativeTime(c.createdAt || c.created_at)
      }));
      
      this.setData({ comments });
    } catch (error) {
      console.error('加载评论失败:', error);
    }
  },

  // 输入评论
  onCommentInput(e) {
    this.setData({ commentContent: e.detail.value });
  },

  // 提交评论
  async submitComment() {
    const { commentContent, postId, isSubmitting } = this.data;
    
    if (!commentContent.trim()) {
      showError('请输入评论内容');
      return;
    }
    
    if (isSubmitting) return;
    
    try {
      this.setData({ isSubmitting: true });
      
      await postApi.addComment(postId, commentContent.trim());
      
      showSuccess('评论成功');
      this.setData({ commentContent: '', inputFocus: false });
      
      // 重新加载评论
      this.loadComments();
    } catch (error) {
      showError(error.message || '评论失败');
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  // 删除评论
  async deleteComment(e) {
    const { id, index } = e.currentTarget.dataset;
    
    const confirmed = await showConfirm({
      title: '删除评论',
      content: '确定要删除这条评论吗？'
    });
    
    if (!confirmed) return;
    
    try {
      showLoading('删除中...');
      await postApi.deleteComment(this.data.postId, id);
      hideLoading();
      
      // 从列表中移除
      const comments = [...this.data.comments];
      comments.splice(index, 1);
      this.setData({ comments });
      
      showSuccess('已删除');
    } catch (error) {
      hideLoading();
      showError(error.message || '删除失败');
    }
  },

  // 预览图片
  previewImage(e) {
    const urls = e.currentTarget.dataset.urls;
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current,
      urls
    });
  }
});

