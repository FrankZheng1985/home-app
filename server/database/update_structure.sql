-- 数据库结构完善脚本 - PostgreSQL
-- 目标：添加缺失的字段，确保系统功能完整性

-- 1. 为 savings_transactions 添加 description 字段
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='savings_transactions' AND column_name='description') THEN
        ALTER TABLE savings_transactions ADD COLUMN description TEXT;
    END IF;
END $$;

-- 2. 为 chore_records 添加 deduction 和 deduction_reason 字段（用于审核时的扣分逻辑）
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chore_records' AND column_name='deduction') THEN
        ALTER TABLE chore_records ADD COLUMN deduction INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chore_records' AND column_name='deduction_reason') THEN
        ALTER TABLE chore_records ADD COLUMN deduction_reason TEXT;
    END IF;
END $$;

-- 3. 为 chore_records 添加审核人字段
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chore_records' AND column_name='reviewed_by') THEN
        ALTER TABLE chore_records ADD COLUMN reviewed_by UUID REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chore_records' AND column_name='reviewed_at') THEN
        ALTER TABLE chore_records ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 4. 为 chore_types 添加 icon 字段
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chore_types' AND column_name='icon') THEN
        ALTER TABLE chore_types ADD COLUMN icon VARCHAR(50) DEFAULT '🧹';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chore_types' AND column_name='description') THEN
        ALTER TABLE chore_types ADD COLUMN description TEXT;
    END IF;
END $$;

-- 5. 为 sport_records 添加 icon 和 color 字段（用于视觉展示）
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sport_records' AND column_name='icon') THEN
        ALTER TABLE sport_records ADD COLUMN icon VARCHAR(50) DEFAULT '🏃';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sport_records' AND column_name='color') THEN
        ALTER TABLE sport_records ADD COLUMN color VARCHAR(20) DEFAULT '#4caf50';
    END IF;
END $$;

-- 6. 确保所有 UUID 字段都有默认值（如果之前遗漏了）
ALTER TABLE users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE families ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE family_members ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE chore_types ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE chore_records ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE point_transactions ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE savings_accounts ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE savings_transactions ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE savings_requests ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE sport_records ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE posts ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE post_likes ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE post_comments ALTER COLUMN id SET DEFAULT uuid_generate_v4();
