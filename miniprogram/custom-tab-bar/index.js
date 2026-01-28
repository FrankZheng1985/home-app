// custom-tab-bar/index.js
const app = getApp();

Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#4A90D9",
    isAdmin: false,
    // 管理员TabBar配置
    adminList: [
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
        useEmoji: true  // 暂时使用emoji，因为还没有图标文件
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
    ],
    // 普通成员TabBar配置
    memberList: [
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
    ],
    // 当前使用的列表
    list: []
  },

  lifetimes: {
    attached() {
      this.updateTabBar();
    }
  },

  methods: {
    // 更新TabBar显示
    updateTabBar() {
      const isAdmin = app.globalData.isAdmin || false;
      const list = isAdmin ? this.data.adminList : this.data.memberList;
      this.setData({ isAdmin, list });
    },

    // 切换Tab
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      
      wx.switchTab({ url });
    }
  }
});
