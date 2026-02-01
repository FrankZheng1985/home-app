// custom-tab-bar/index.js
const app = getApp();

// TabBar配置
    const ADMIN_LIST = [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        emoji: "🏠",
        useEmoji: true
      },
      {
        pagePath: "/pages/calendar/calendar",
        text: "日历",
        emoji: "📅",
        useEmoji: true
      },
      {
        pagePath: "/pages/inventory/inventory",
        text: "物资",
        emoji: "📦",
        useEmoji: true
      },
      {
        pagePath: "/pages/chores/chores",
        text: "家务",
        emoji: "🧼",
        useEmoji: true
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        emoji: "👤",
        useEmoji: true
      }
    ];

    const MEMBER_LIST = [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        emoji: "🏠",
        useEmoji: true
      },
      {
        pagePath: "/pages/calendar/calendar",
        text: "日历",
        emoji: "📅",
        useEmoji: true
      },
      {
        pagePath: "/pages/inventory/inventory",
        text: "物资",
        emoji: "📦",
        useEmoji: true
      },
      {
        pagePath: "/pages/chores/chores",
        text: "家务",
        emoji: "🧼",
        useEmoji: true
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        emoji: "👤",
        useEmoji: true
      }
    ];

Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4A90D9",
    isAdmin: false,
    // 默认显示普通成员列表，等角色信息加载后再更新
    list: MEMBER_LIST
  },

  lifetimes: {
    attached() {
      // 立即更新一次
      this.updateTabBar();
    }
  },

  pageLifetimes: {
    show() {
      // 页面显示时也更新TabBar
      this.updateTabBar();
    }
  },

  methods: {
    // 更新TabBar显示
    updateTabBar() {
      const isAdmin = app.globalData.isAdmin || false;
      const list = isAdmin ? ADMIN_LIST : MEMBER_LIST;
      
      this.setData({ isAdmin, list });
    },

    // 切换Tab
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      const index = data.index;

      // 如果点击的是日历或物资（普通页面），使用 navigateTo
      if (url === '/pages/calendar/calendar' || url === '/pages/inventory/inventory') {
        wx.navigateTo({ url });
      } else {
        // 如果点击的是 Tab 页面，使用 switchTab
        wx.switchTab({ url });
      }
    }
  }
});
