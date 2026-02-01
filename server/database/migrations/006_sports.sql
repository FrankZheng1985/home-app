-- 运动打卡模块
-- PostgreSQL 版本

-- 运动类型表
CREATE TABLE IF NOT EXISTS sport_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '🏃',
    color VARCHAR(20) DEFAULT '#4caf50',
    calories_per_min DECIMAL(5, 2) DEFAULT 5.0,
    is_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 运动记录表
CREATE TABLE IF NOT EXISTS sport_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    sport_type_id UUID REFERENCES sport_types(id) ON DELETE SET NULL,
    sport_type VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '🏃',
    color VARCHAR(20) DEFAULT '#4caf50',
    duration INTEGER NOT NULL DEFAULT 0,
    calories INTEGER DEFAULT 0,
    steps INTEGER DEFAULT 0,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 步数同步记录表
CREATE TABLE IF NOT EXISTS step_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    steps INTEGER NOT NULL DEFAULT 0,
    record_date DATE NOT NULL,
    points_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, record_date)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_sport_types_family_id ON sport_types(family_id);
CREATE INDEX IF NOT EXISTS idx_sport_records_user_id ON sport_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sport_records_family_id ON sport_records(family_id);
CREATE INDEX IF NOT EXISTS idx_step_records_user_id ON step_records(user_id);
CREATE INDEX IF NOT EXISTS idx_step_records_record_date ON step_records(record_date);
