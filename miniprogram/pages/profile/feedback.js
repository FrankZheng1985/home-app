// pages/profile/feedback.js
const { showError, showSuccess } = require('../../utils/util');

Page({
  data: {
    feedbackType: '',
    feedbackContent: '',
    typeOptions: ['功能建议', '问题反馈', '其他'],
    isSubmitting: false
  },

  // 选择类型
  onTypeChange(e) {
    this.setData({
      feedbackType: this.data.typeOptions[e.detail.value]
    });
  },

  // 输入内容
  onContentInput(e) {
    this.setData({ feedbackContent: e.detail.value });
  },

  // 提交反馈
  async submitFeedback() {
    const { feedbackType, feedbackContent, isSubmitting } = this.data;

    if (!feedbackType) {
      showError('请选择反馈类型');
      return;
    }

    if (!feedbackContent.trim()) {
      showError('请输入反馈内容');
      return;
    }

    if (feedbackContent.trim().length < 10) {
      showError('反馈内容至少10个字符');
      return;
    }

    if (isSubmitting) return;

    try {
      this.setData({ isSubmitting: true });

      // 模拟提交（实际项目中调用API）
      await new Promise(resolve => setTimeout(resolve, 1000));

      showSuccess('感谢您的反馈');
      
      // 清空表单
      this.setData({
        feedbackType: '',
        feedbackContent: ''
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      showError('提交失败，请重试');
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});
