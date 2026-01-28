// custom-tab-bar/index.js
const app = getApp();

// TabBar配置
const ADMIN_LIST = [
  {
    pagePath: "/pages/index/index",
    text: "首页",
    iconPath: "/assets/icons/home.png",
    selectedIconPath: "/assets/icons/home-active.png",
    emoji: "🏠"
  },
  {
    pagePath: "/pages/chores/chores",
    text: "家务",
    iconPath: "/assets/icons/chores.png",
    selectedIconPath: "/assets/icons/chores-active.png",
    emoji: "🧹"
  },
  {
    pagePath: "/pages/workbench/workbench",
    text: "工作台",
    iconPath: "/assets/icons/workbench.png",
    selectedIconPath: "/assets/icons/workbench-active.png",
    emoji: "📋",
    useEmoji: true
  },
  {
    pagePath: "/pages/moments/moments",
    text: "动态",
    iconPath: "/assets/icons/moments.png",
    selectedIconPath: "/assets/icons/moments-active.png",
    emoji: "💬"
  },
  {
    pagePath: "/pages/profile/profile",
    text: "我的",
    iconPath: "/assets/icons/profile.png",
    selectedIconPath: "/assets/icons/profile-active.png",
    emoji: "👤"
  }
];

const MEMBER_LIST = [
  {
    pagePath: "/pages/index/index",
    text: "首页",
    iconPath: "/assets/icons/home.png",
    selectedIconPath: "/assets/icons/home-active.png",
    emoji: "🏠"
  },
  {
    pagePath: "/pages/chores/chores",
    text: "家务",
    iconPath: "/assets/icons/chores.png",
    selectedIconPath: "/assets/icons/chores-active.png",
    emoji: "🧹"
  },
  {
    pagePath: "/pages/sports/sports",
    text: "运动",
    iconPath: "/assets/icons/sports.png",
    selectedIconPath: "/assets/icons/sports-active.png",
    emoji: "🏃"
  },
  {
    pagePath: "/pages/moments/moments",
    text: "动态",
    iconPath: "/assets/icons/moments.png",
    selectedIconPath: "/assets/icons/moments-active.png",
    emoji: "💬"
  },
  {
    pagePath: "/pages/profile/profile",
    text: "我的",
    iconPath: "/assets/icons/profile.png",
    selectedIconPath: "/assets/icons/profile-active.png",
    emoji: "👤"
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
      
      // 只有当状态变化时才更新
      if (this.data.isAdmin !== isAdmin) {
        console.log('[TabBar] 角色变化，更新TabBar:', isAdmin ? '管理员' : '普通成员');
        this.setData({ isAdmin, list });
      }
    },

    // 切换Tab
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      
      wx.switchTab({ url });
    }
  }
});
