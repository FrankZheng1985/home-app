// utils/util.js
// 工具函数集合

/**
 * 格式化时间
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的时间字符串
 */
const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

/**
 * 格式化日期
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${[year, month, day].map(formatNumber).join('-')}`
}

/**
 * 格式化数字（补零）
 * @param {number} n 数字
 * @returns {string} 格式化后的数字字符串
 */
const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 显示加载中
 * @param {string} title 提示文字
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏加载中
 */
const hideLoading = () => {
  wx.hideLoading()
}

/**
 * 显示成功提示
 * @param {string} title 提示文字
 * @param {number} duration 显示时长
 */
const showSuccess = (title, duration = 1500) => {
  wx.showToast({
    title,
    icon: 'success',
    duration
  })
}

/**
 * 显示错误提示
 * @param {string} title 提示文字
 * @param {number} duration 显示时长
 */
const showError = (title, duration = 2000) => {
  wx.showToast({
    title,
    icon: 'none',
    duration
  })
}

/**
 * 显示确认弹窗
 * @param {object} options 配置项
 * @returns {Promise}
 */
const showConfirm = (options) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: options.title || '提示',
      content: options.content || '',
      showCancel: options.showCancel !== false,
      cancelText: options.cancelText || '取消',
      confirmText: options.confirmText || '确定',
      confirmColor: options.confirmColor || '#4A90D9',
      success: (res) => {
        if (res.confirm) {
          resolve(true)
        } else {
          resolve(false)
        }
      },
      fail: reject
    })
  })
}

/**
 * 防抖函数
 * @param {Function} fn 要执行的函数
 * @param {number} delay 延迟时间
 * @returns {Function}
 */
const debounce = (fn, delay = 300) => {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 * @param {Function} fn 要执行的函数
 * @param {number} delay 延迟时间
 * @returns {Function}
 */
const throttle = (fn, delay = 300) => {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      fn.apply(this, args)
      lastTime = now
    }
  }
}

/**
 * 相对时间格式化
 * @param {string|Date} time 时间
 * @returns {string} 相对时间字符串
 */
const formatRelativeTime = (time) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (seconds < 60) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return formatDate(date)
  }
}

/**
 * 检查是否登录
 * @returns {boolean}
 */
const isLoggedIn = () => {
  return !!wx.getStorageSync('token')
}

/**
 * 获取当前用户信息
 * @returns {object|null}
 */
const getCurrentUser = () => {
  return wx.getStorageSync('userInfo') || null
}

/**
 * 获取当前家庭信息
 * @returns {object|null}
 */
const getCurrentFamily = () => {
  return wx.getStorageSync('familyInfo') || null
}

/**
 * 生成随机字符串
 * @param {number} length 长度
 * @returns {string}
 */
const randomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

module.exports = {
  formatTime,
  formatDate,
  formatNumber,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm,
  debounce,
  throttle,
  formatRelativeTime,
  isLoggedIn,
  getCurrentUser,
  getCurrentFamily,
  randomString
}
