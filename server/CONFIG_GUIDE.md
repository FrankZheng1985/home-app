# 家庭小助手 - 配置指南

## 1. 数据库配置 ✅ 已完成

数据库 `family_assistant` 已创建，包含以下表：
- `users` - 用户表
- `families` - 家庭表
- `family_members` - 家庭成员表
- `chore_types` - 家务类型表
- `chore_records` - 家务记录表
- `point_transactions` - 积分交易记录表
- `posts` - 动态/朋友圈表
- `post_likes` - 动态点赞表
- `post_comments` - 动态评论表

## 2. 环境变量配置

请在 `server/.env` 文件中配置以下内容：

```env
# 服务器配置
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000/api

# PostgreSQL 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=family_assistant
DB_USER=fengzheng
DB_PASSWORD=

# JWT 配置
JWT_SECRET=your_super_secret_key_change_in_production_12345
JWT_EXPIRES_IN=7d

# 微信小程序配置
WX_APP_ID=你的微信AppID
WX_APP_SECRET=你的微信AppSecret
```

## 3. 微信小程序配置

### 获取 AppID 和 AppSecret

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发」->「开发管理」->「开发设置」
3. 获取 **AppID(小程序ID)** 和 **AppSecret(小程序密钥)**
4. 将这两个值填入 `.env` 文件

### 配置服务器域名

在开发阶段，需要在微信开发者工具中：
1. 点击右上角「详情」
2. 选择「本地设置」
3. 勾选「不校验合法域名...」

正式上线时，需要在微信公众平台配置：
- request合法域名：`https://your-domain.com`
- uploadFile合法域名：`https://your-domain.com`

## 4. 启动服务

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

## 5. 数据库操作命令

```bash
# 重新运行迁移
cd server/database
DB_HOST=localhost DB_PORT=5432 DB_NAME=family_assistant DB_USER=fengzheng node migrate.js

# 连接数据库
psql -d family_assistant

# 查看所有表
\dt

# 查看用户表结构
\d users
```

