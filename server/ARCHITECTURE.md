# 家庭小助手 - 服务端架构文档

## 📁 目录结构（ERP标准架构）

```
server/src/
├── config/              # 配置层
│   └── database.js      # 数据库连接配置
│
├── constants/           # 常量层 ⭐ 新增
│   ├── index.js         # 常量统一导出
│   ├── errorCodes.js    # 错误码定义
│   ├── statusCodes.js   # 状态码定义
│   └── roles.js         # 角色权限定义
│
├── controllers/         # 控制器层
│   ├── authController.js
│   ├── choreController.js
│   ├── familyController.js
│   ├── pointsController.js
│   ├── postController.js
│   ├── savingsController.js
│   ├── uploadController.js
│   └── userController.js
│
├── services/            # 服务层 ⭐ 新增
│   ├── index.js         # 服务统一导出
│   ├── baseService.js   # 基础服务类
│   ├── authService.js   # 认证服务
│   ├── userService.js   # 用户服务
│   ├── familyService.js # 家庭服务
│   ├── choreService.js  # 家务服务
│   └── savingsService.js# 存款服务
│
├── middleware/          # 中间件层
│   ├── auth.js          # JWT认证中间件
│   └── errorHandler.js  # 错误处理中间件
│
├── routes/              # 路由层
│   ├── auth.js
│   ├── chores.js
│   ├── families.js
│   ├── points.js
│   ├── posts.js
│   ├── savings.js
│   ├── upload.js
│   └── users.js
│
├── utils/               # 工具层 ⭐ 扩展
│   ├── index.js         # 工具函数导出
│   └── logger.js        # 日志工具
│
└── index.js             # 应用入口
```

## 🏗️ 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────┐
│                   客户端请求                      │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Routes（路由层）                    │
│  - 定义API端点                                   │
│  - 参数验证（express-validator）                 │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│           Controllers（控制器层）                │
│  - 接收请求参数                                  │
│  - 调用Service处理业务                           │
│  - 返回响应数据                                  │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│             Services（服务层）⭐                 │
│  - 核心业务逻辑                                  │
│  - 数据处理和转换                                │
│  - 调用数据库操作                                │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│         BaseService（基础服务）                  │
│  - 通用数据库操作                                │
│  - 事务管理                                     │
│  - 查询封装                                     │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Database（数据库）                  │
│  - PostgreSQL                                   │
└─────────────────────────────────────────────────┘
```

## 📋 常量定义

### 错误码规范

| 范围 | 分类 | 说明 |
|------|------|------|
| 1xxxx | 认证相关 | AUTH_TOKEN_MISSING, AUTH_TOKEN_INVALID 等 |
| 2xxxx | 用户相关 | USER_NOT_FOUND, USER_ALREADY_EXISTS 等 |
| 3xxxx | 家庭相关 | FAMILY_NOT_FOUND, FAMILY_ADMIN_REQUIRED 等 |
| 4xxxx | 家务相关 | CHORE_TYPE_NOT_FOUND 等 |
| 5xxxx | 积分相关 | POINTS_INSUFFICIENT 等 |
| 6xxxx | 存款相关 | SAVINGS_BALANCE_INSUFFICIENT 等 |
| 7xxxx | 动态相关 | POST_NOT_FOUND 等 |
| 9xxxx | 系统错误 | SYSTEM_ERROR, DATABASE_ERROR 等 |

### 使用示例

```javascript
const { ERROR_CODES, createError, createSuccess } = require('../constants/errorCodes');

// 返回错误
return res.status(400).json(createError(ERROR_CODES.FAMILY_NOT_MEMBER));

// 返回成功
return res.json(createSuccess({ user: userData }));
```

## 📝 日志系统

### 日志级别

- `ERROR` - 错误日志（红色）
- `WARN` - 警告日志（黄色）
- `INFO` - 信息日志（青色）
- `DEBUG` - 调试日志（灰色）

### 使用示例

```javascript
const logger = require('../utils/logger');

// 基础日志
logger.info('用户登录成功', { userId: '123' });
logger.error('数据库错误', error);
logger.warn('配置缺失', { key: 'WX_SECRET' });
logger.debug('调试信息', { data });

// 审计日志
logger.audit('创建家庭', userId, { familyId, name });

// 数据库查询日志（仅开发环境）
logger.query('SELECT * FROM users', 15, 10);
```

## 🔐 角色权限

### 角色定义

| 角色 | 权限等级 | 说明 |
|------|---------|------|
| creator | 3 | 创建人，最高权限 |
| admin | 2 | 管理员，可管理成员和审核 |
| member | 1 | 普通成员 |

### 权限检查

```javascript
const { FAMILY_ROLES, isAdmin, isCreator } = require('../constants/roles');

// 检查是否为管理员
if (isAdmin(role)) {
  // 允许操作
}

// 检查是否为创建人
if (isCreator(role)) {
  // 允许最高权限操作
}
```

## 🔄 服务层使用

### 基础服务方法

```javascript
class MyService extends BaseService {
  async myMethod() {
    // 单条查询
    const user = await this.queryOne('SELECT * FROM users WHERE id = $1', [id]);
    
    // 多条查询
    const users = await this.queryMany('SELECT * FROM users');
    
    // 插入数据
    const newUser = await this.insert('users', { name, email });
    
    // 更新数据
    await this.update('users', { name: 'new' }, { id: userId });
    
    // 事务操作
    await this.transaction(async (client) => {
      await client.query('INSERT ...');
      await client.query('UPDATE ...');
    });
  }
}
```

## ✅ 改进清单

- [x] 创建常量层（错误码、状态码、角色）
- [x] 创建日志工具
- [x] 创建Service层（业务逻辑分离）
- [x] 重构Controller层
- [x] 更新中间件
- [x] 统一错误处理

## 📌 开发规范

1. **Controller只做**：接收参数、调用Service、返回响应
2. **Service负责**：业务逻辑、数据转换、数据库操作
3. **错误处理**：使用统一的ERROR_CODES
4. **日志记录**：重要操作使用audit日志
5. **权限检查**：使用familyService.validateXxx方法

