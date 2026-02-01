-- 家庭小助手数据库初始化脚本 (PostgreSQL 版)

-- 启用 UUID 扩展 (如果需要)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    openid VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    gender SMALLINT DEFAULT 0, -- 0未知 1男 2女
    birthday DATE,
    session_key VARCHAR(100),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 家庭表
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    invite_code VARCHAR(10) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id),
    points_value DECIMAL(10, 2) DEFAULT 0.50, -- 每积分价值（元）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 家庭成员表
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- creator, admin, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (family_id, user_id)
);

-- 家务类型表
CREATE TABLE IF NOT EXISTS chore_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    is_preset BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 家务记录表
CREATE TABLE IF NOT EXISTS chore_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    chore_type_id UUID NOT NULL REFERENCES chore_types(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    points_earned INTEGER NOT NULL,
    note TEXT,
    images JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'approved', -- pending, approved, rejected
    reject_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- earn(获得), spend(消费), adjust(调整), redeem(兑现)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 存款账户表
CREATE TABLE IF NOT EXISTS savings_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    annual_rate DECIMAL(5, 2) DEFAULT 3.00,
    total_interest DECIMAL(15, 2) DEFAULT 0.00,
    last_interest_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, family_id)
);

-- 存款交易记录表
CREATE TABLE IF NOT EXISTS savings_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(20) NOT NULL, -- deposit, withdraw, interest
    balance_after DECIMAL(15, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 存款申请表
CREATE TABLE IF NOT EXISTS savings_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'deposit',
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reject_reason TEXT,
    reviewer_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 运动记录表
CREATE TABLE IF NOT EXISTS sport_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    sport_type VARCHAR(50) NOT NULL,
    duration INTEGER NOT NULL, -- 分钟
    calories INTEGER DEFAULT 0,
    steps INTEGER DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 动态/朋友圈表
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]',
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 动态点赞表
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (post_id, user_id)
);

-- 动态评论表
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 自动更新 updated_at 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加触发器
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_families_modtime BEFORE UPDATE ON families FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chore_types_modtime BEFORE UPDATE ON chore_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_savings_accounts_modtime BEFORE UPDATE ON savings_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_modtime BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid);
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chore_records_family_id ON chore_records(family_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_family_id ON point_transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_posts_family_id ON posts(family_id);
