// pages/moments/moments.js - 支持图片上传
const app = getApp();
const { postApi, familyApi } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm, formatRelativeTime, isLoggedIn } = require('../../utils/util');

Page({
  data: {
    familyInfo: null,
    userInfo: null,
    posts: [],
    showPublishModal: false,
    postContent: '',
    hasContent: false, // 是否有文字内容
    selectedImages: [], // 已选择的图片
    isAnonymous: false,
    isPublishing: false,
    isLoadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    currentUserId: null,
    showActionSheet: false,
    showImageSourceSheet: false,
    currentPostId: null,
    currentPostIndex: null,
    expandedCommentPostId: null, // 展开评论输入的帖子ID
    quickCommentContent: '' // 快速评论内容
  },

  onLoad() {
    this.setData({ isLoggedIn: isLoggedIn() });
    if (isLoggedIn()) {
      this.loadFamilyInfo();
    }
  },

  onShow() {
    const loggedIn = isLoggedIn();
    this.setData({ isLoggedIn: loggedIn });
    
    if (!loggedIn) return;
    
    this.loadPosts(true);
  },
  
  // 去登录
  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    this.loadPosts(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.isLoadingMore && this.data.hasMore) {
      this.loadPosts();
    }
  },

  async loadFamilyInfo() {
    try {
      // 获取当前用户信息
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ 
          currentUserId: userInfo.id,
          userInfo: userInfo
        });
      }
      
      // 首先检查用户信息中的 familyId（最可靠的判断）
      if (!userInfo || !userInfo.familyId) {
        console.log('用户信息显示未加入家庭');
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          posts: []
        });
        return;
      }
      
      const familiesRes = await familyApi.getMyFamilies();
      if (familiesRes.data && familiesRes.data.length > 0) {
        const familyInfo = familiesRes.data[0];
        
        // 同步更新本地存储
        wx.setStorageSync('familyInfo', familyInfo);
        app.globalData.familyInfo = familyInfo;
        
        this.setData({ familyInfo });
      } else {
        // 清理本地存储中的旧家庭信息
        wx.removeStorageSync('familyInfo');
        app.globalData.familyInfo = null;
        
        this.setData({ 
          familyInfo: null,
          posts: []
        });
      }
    } catch (error) {
      console.error('加载家庭信息失败:', error);
    }
  },

  // 加载评论预览
  async loadCommentsPreview(posts) {
    for (let i = 0; i < posts.length; i++) {
      try {
        const res = await postApi.getComments(posts[i].id);
        const comments = res.data || [];
        posts[i].comments = comments.slice(0, 2); // 只取前2条
      } catch (error) {
        console.warn('加载评论预览失败:', error);
        posts[i].comments = [];
      }
    }
  },

  async loadPosts(reset = false) {
    if (!this.data.familyInfo) return;

    if (reset) {
      this.setData({ page: 1, hasMore: true, posts: [] });
    }

    if (!this.data.hasMore) return;

    try {
      this.setData({ isLoadingMore: true });
      
      const res = await postApi.getList({
        familyId: this.data.familyInfo.id,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      let newPosts = res.data || [];
      
      // 格式化时间和处理图片
      newPosts = newPosts.map(post => ({
        ...post,
        createdAtText: formatRelativeTime(post.createdAt || post.created_at),
        images: post.images || [],
        user: post.user || { nickname: '用户', avatarUrl: '' },
        comments: post.comments || [] // 评论预览
      }));
      
      // 为每个帖子加载评论预览（最多2条）
      await this.loadCommentsPreview(newPosts);

      this.setData({
        posts: reset ? newPosts : [...this.data.posts, ...newPosts],
        hasMore: newPosts.length === this.data.pageSize,
        page: this.data.page + 1,
        isLoadingMore: false
      });
    } catch (error) {
      console.error('加载动态失败:', error);
      this.setData({ isLoadingMore: false });
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
      hasContent: false,
      selectedImages: [],
      isAnonymous: false
    });
  },

  // 阻止事件冒泡
  preventClose() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 输入内容
  onContentInput(e) {
    const value = e.detail.value;
    this.setData({ 
      postContent: value,
      hasContent: value.trim().length > 0
    });
  },

  // 切换匿名
  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous });
  },

  // ================ 图片相关功能 ================

  // 显示图片来源菜单
  showImageSourceMenu() {
    this.setData({ showImageSourceSheet: true });
  },

  // 隐藏图片来源菜单
  hideImageSourceMenu() {
    this.setData({ showImageSourceSheet: false });
  },

  // 拍照
  takePhoto() {
    this.hideImageSourceMenu();
    
    const remainingCount = 9 - this.data.selectedImages.length;
    if (remainingCount <= 0) {
      showError('最多只能上传9张图片');
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath);
        this.setData({
          selectedImages: [...this.data.selectedImages, ...tempFiles]
        });
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          showError('拍照失败');
        }
      }
    });
  },

  // 从相册选择
  chooseFromAlbum() {
    this.hideImageSourceMenu();
    
    const remainingCount = 9 - this.data.selectedImages.length;
    if (remainingCount <= 0) {
      showError('最多只能上传9张图片');
      return;
    }

    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath);
        this.setData({
          selectedImages: [...this.data.selectedImages, ...tempFiles]
        });
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          showError('选择图片失败');
        }
      }
    });
  },

  // 移除图片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.selectedImages];
    images.splice(index, 1);
    this.setData({ selectedImages: images });
  },

  // 预览已选择的图片
  previewSelectedImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.selectedImages[index],
      urls: this.data.selectedImages
    });
  },

  // 预览动态中的图片
  previewImage(e) {
    const urls = e.currentTarget.dataset.urls;
    const current = e.currentTarget.dataset.current;
    wx.previewImage({
      current: current,
      urls: urls
    });
  },

  // ================ 发布功能 ================

  // 上传图片到服务器
  async uploadImages(tempFilePaths) {
    if (!tempFilePaths || tempFilePaths.length === 0) {
      return [];
    }

    const uploadedUrls = [];
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000/api';

    for (const filePath of tempFilePaths) {
      try {
        const res = await new Promise((resolve, reject) => {
          wx.uploadFile({
            url: `${baseUrl}/upload/image`,
            filePath: filePath,
            name: 'file',
            header: {
              'Authorization': `Bearer ${wx.getStorageSync('token')}`
            },
            success: (res) => {
              if (res.statusCode === 200) {
                const data = JSON.parse(res.data);
                resolve(data);
              } else {
                reject(new Error('上传失败'));
              }
            },
            fail: reject
          });
        });

        if (res.data && res.data.url) {
          uploadedUrls.push(res.data.url);
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        // 开发模式下，直接使用本地路径
        if (app.globalData.isDev) {
          uploadedUrls.push(filePath);
        }
      }
    }

    return uploadedUrls;
  },

  // 发布动态
  async publishPost() {
    const { postContent, selectedImages, isAnonymous, familyInfo, isPublishing } = this.data;

    if (!postContent.trim() && selectedImages.length === 0) {
      showError('请输入内容或添加图片');
      return;
    }

    if (isPublishing) return;

    try {
      this.setData({ isPublishing: true });
      showLoading('发布中...');

      // 上传图片
      let imageUrls = [];
      if (selectedImages.length > 0) {
        // 开发模式下直接使用本地路径（因为没有真正的上传服务）
        imageUrls = selectedImages;
        
        // 如果有真实服务器，使用以下代码：
        // imageUrls = await this.uploadImages(selectedImages);
      }

      await postApi.create({
        familyId: familyInfo.id,
        content: postContent.trim(),
        images: imageUrls,
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
      this.setData({ isPublishing: false });
    }
  },

  // ================ 动态操作 ================

  // 点赞/取消点赞
  async toggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;

    try {
      await postApi.toggleLike(postId);
      
      // 更新本地状态
      const posts = [...this.data.posts];
      const post = posts[index];
      post.isLiked = !post.isLiked;
      post.likesCount = post.isLiked ? (post.likesCount || 0) + 1 : Math.max(0, (post.likesCount || 1) - 1);
      
      this.setData({ posts });
    } catch (error) {
      showError(error.message || '操作失败');
    }
  },

  // 显示动态操作菜单
  showPostActions(e) {
    const postId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    this.setData({
      showActionSheet: true,
      currentPostId: postId,
      currentPostIndex: index
    });
  },

  // 隐藏操作菜单
  hideActionSheet() {
    this.setData({
      showActionSheet: false,
      currentPostId: null,
      currentPostIndex: null
    });
  },

  // 删除当前动态
  async deleteCurrentPost() {
    const { currentPostId, currentPostIndex } = this.data;
    
    this.hideActionSheet();

    const confirmed = await showConfirm({
      title: '删除动态',
      content: '确定要删除这条动态吗？'
    });

    if (!confirmed) return;

    try {
      showLoading('删除中...');
      await postApi.delete(currentPostId);
      hideLoading();

      // 从列表中移除
      const posts = [...this.data.posts];
      posts.splice(currentPostIndex, 1);
      this.setData({ posts });

      showSuccess('已删除');
    } catch (error) {
      hideLoading();
      showError(error.message || '删除失败');
    }
  },

  // 查看评论 - 显示快速评论输入或跳转
  viewComments(e) {
    const postId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    
    // 如果点击的是"查看全部评论"，跳转到评论页
    if (this.data.posts[index] && this.data.posts[index].commentsCount > 2) {
      wx.navigateTo({
        url: `/pages/moments/comments?postId=${postId}`
      });
    } else {
      // 展开/收起快速评论输入
      this.setData({
        expandedCommentPostId: this.data.expandedCommentPostId === postId ? null : postId,
        quickCommentContent: ''
      });
    }
  },

  // 跳转到评论详情页
  goToComments(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/moments/comments?postId=${postId}`
    });
  },

  // 快速评论输入
  onQuickCommentInput(e) {
    this.setData({ quickCommentContent: e.detail.value });
  },

  // 提交快速评论
  async submitQuickComment(e) {
    const postId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    const content = this.data.quickCommentContent.trim();
    
    if (!content) {
      showError('请输入评论内容');
      return;
    }
    
    try {
      await postApi.addComment(postId, content);
      showSuccess('评论成功');
      
      // 更新本地评论数
      const posts = [...this.data.posts];
      posts[index].commentsCount = (posts[index].commentsCount || 0) + 1;
      
      // 添加评论到预览
      if (!posts[index].comments) {
        posts[index].comments = [];
      }
      posts[index].comments.unshift({
        id: Date.now().toString(),
        content: content,
        author: {
          nickname: this.data.userInfo?.nickname || '我'
        }
      });
      
      this.setData({ 
        posts,
        quickCommentContent: '',
        expandedCommentPostId: null
      });
    } catch (error) {
      showError(error.message || '评论失败');
    }
  },

  // 分享动态
  sharePost(e) {
    const postId = e.currentTarget.dataset.id;
    const content = e.currentTarget.dataset.content || '分享一条家庭动态';
    
    wx.showActionSheet({
      itemList: ['分享给家人', '复制内容', '生成图片分享'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            // 分享给家人 - 使用小程序内置转发
            this.shareToFamily(postId, content);
            break;
          case 1:
            // 复制内容
            this.copyContent(content);
            break;
          case 2:
            // 生成图片分享（功能开发中）
            showSuccess('海报功能开发中');
            break;
        }
      }
    });
  },

  // 分享给家人
  shareToFamily(postId, content) {
    // 触发小程序内置分享
    showSuccess('请点击右上角菜单进行分享');
  },

  // 复制内容
  copyContent(content) {
    wx.setClipboardData({
      data: content,
      success: () => {
        showSuccess('已复制到剪贴板');
      }
    });
  },

  // 页面分享配置
  onShareAppMessage(res) {
    // 如果是从分享按钮触发
    if (res.from === 'button') {
      const postId = res.target.dataset.id;
      const content = res.target.dataset.content || '分享一条家庭动态';
      return {
        title: content.length > 30 ? content.substring(0, 30) + '...' : content,
        path: `/pages/moments/moments?sharePostId=${postId}`,
        imageUrl: '' // 可以添加动态的首张图片
      };
    }
    
    // 默认分享
    return {
      title: '家庭动态 - 分享生活点滴',
      path: '/pages/moments/moments'
    };
  }
});
