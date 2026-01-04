-- 006_sports.sql - 运动打卡模块

-- 运动类型表
CREATE TABLE IF NOT EXISTS sport_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '🏃',
    color VARCHAR(20) DEFAULT '#4caf50',
    calories_per_min NUMERIC(5, 2) DEFAULT 5.0,
    is_preset BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sport_types_family_id ON sport_types(family_id);

-- 运动记录表
CREATE TABLE IF NOT EXISTS sport_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    sport_type_id UUID REFERENCES sport_types(id) ON DELETE SET NULL,
    sport_type VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '🏃',
    color VARCHAR(20) DEFAULT '#4caf50',
    duration INTEGER NOT NULL DEFAULT 0, -- 运动时长（分钟）
    calories INTEGER DEFAULT 0, -- 消耗热量（千卡）
    steps INTEGER DEFAULT 0, -- 步数（如果有）
    remark TEXT,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sport_records_user_id ON sport_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sport_records_family_id ON sport_records(family_id);
CREATE INDEX IF NOT EXISTS idx_sport_records_record_date ON sport_records(record_date);
CREATE INDEX IF NOT EXISTS idx_sport_records_created_at ON sport_records(created_at DESC);

-- 步数同步记录表（存储每日步数）
CREATE TABLE IF NOT EXISTS step_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    steps INTEGER NOT NULL DEFAULT 0,
    record_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_step_records_user_id ON step_records(user_id);
CREATE INDEX IF NOT EXISTS idx_step_records_record_date ON step_records(record_date);

-- 更新触发器
CREATE TRIGGER update_sport_types_updated_at
BEFORE UPDATE ON sport_types
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sport_records_updated_at
BEFORE UPDATE ON sport_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_step_records_updated_at
BEFORE UPDATE ON step_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 注释
COMMENT ON TABLE sport_types IS '运动类型表';
COMMENT ON TABLE sport_records IS '运动记录表';
COMMENT ON TABLE step_records IS '步数同步记录表';
COMMENT ON COLUMN sport_types.calories_per_min IS '每分钟消耗热量（千卡）';
COMMENT ON COLUMN sport_records.duration IS '运动时长（分钟）';
COMMENT ON COLUMN sport_records.calories IS '消耗热量（千卡）';
COMMENT ON COLUMN sport_records.steps IS '同步的步数';

