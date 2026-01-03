# 家庭小助手 - 微信小程序

一个帮助家庭成员管理家务、记录积分、分享生活的微信小程序。

## 功能特点

### 1. 家庭成员管理
- 微信一键登录
- 注册时填写个人喜好（饮食、兴趣、作息等）
- 创建家庭或通过邀请码/二维码加入家庭
- 支持多管理员设置

### 2. 家务记录系统
- 预设常见家务类型（洗碗、扫地、做饭等）
- 管理员可自定义家务类型和积分
- 一键记录完成的家务
- 查看个人/家庭家务历史和统计

### 3. 积分奖励管理
- 完成家务自动获得积分
- 管理员设置积分价值（如1积分=0.5元）
- 积分排行榜
- 自动记账，方便结算

### 4. 朋友圈/匿名发泄
- 发布普通动态分享生活
- 发布匿名动态（仅家庭成员可见）
- 支持点赞和评论

## 技术栈

### 前端
- 原生微信小程序
- WXML + WXSS + JavaScript

### 后端
- Node.js + Express
- PostgreSQL 数据库
- JWT 身份认证

## 项目结构

```
家庭小程序/
├── miniprogram/          # 微信小程序前端
│   ├── pages/           # 页面
│   ├── components/      # 组件
│   ├── utils/           # 工具函数
│   └── app.js           # 应用入口
├── server/              # Node.js 后端
│   ├── src/
│   │   ├── controllers/ # 控制器
│   │   ├── routes/      # 路由
│   │   ├── middleware/  # 中间件
│   │   └── config/      # 配置
│   └── database/        # 数据库迁移
└── design/              # 设计资源
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- PostgreSQL >= 14
- 微信开发者工具

### 后端配置

1. 进入服务器目录
```bash
cd server
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
# 复制配置文件
cp config.example.js .env

# 编辑 .env 文件，填写实际配置
```

4. 创建数据库
```bash
# 在 PostgreSQL 中创建数据库
createdb family_assistant
```

5. 运行数据库迁移
```bash
npm run migrate
```

6. 启动服务器
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 小程序配置

1. 使用微信开发者工具打开 `miniprogram` 目录

2. 在 `app.js` 中配置后端地址
```javascript
globalData: {
  baseUrl: 'http://localhost:3000/api', // 开发环境
  // baseUrl: 'https://your-domain.com/api', // 生产环境
}
```

3. 配置小程序 AppID（在 `project.config.json` 中）

## API 接口

| 模块 | 接口 | 方法 | 描述 |
|------|------|------|------|
| 认证 | /api/auth/wx-login | POST | 微信登录 |
| 认证 | /api/auth/register | POST | 用户注册 |
| 用户 | /api/users/profile | GET/PUT | 获取/更新用户信息 |
| 家庭 | /api/families | POST | 创建家庭 |
| 家庭 | /api/families/join | POST | 加入家庭 |
| 家庭 | /api/families/:id/members | GET | 获取成员列表 |
| 家务 | /api/chores/types | GET/POST | 家务类型管理 |
| 家务 | /api/chores/records | GET/POST | 家务记录管理 |
| 积分 | /api/points/summary | GET | 积分概览 |
| 积分 | /api/points/ranking | GET | 积分排行榜 |
| 动态 | /api/posts | GET/POST | 动态列表/发布 |

## 数据库设计

详见 `server/database/migrations/001_initial.sql`

## 部署

### 后端部署（Render）

1. 在 Render 创建 Web Service
2. 连接 GitHub 仓库
3. 配置环境变量
4. 部署

### 小程序发布

1. 在微信开发者工具中上传代码
2. 在微信公众平台提交审核
3. 审核通过后发布

## 开发规范

- 变量/函数使用小驼峰命名（camelCase）
- 类名使用大驼峰命名（PascalCase）
- 数据库字段使用下划线命名（snake_case）
- 所有 API 响应格式统一：`{ data: {}, error: '' }`

## 许可证

MIT

