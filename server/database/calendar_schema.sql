-- 家庭共享日历功能表结构 (PostgreSQL)

-- 1. 日程分类表 (可选，用于给日程上色)
CREATE TABLE IF NOT EXISTS calendar_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) DEFAULT '#4facfe',
    icon VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 日程事件表
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id),
    category_id UUID REFERENCES calendar_categories(id) ON DELETE SET NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    remind_before INTEGER DEFAULT 30, -- 提前多少分钟提醒
    repeat_type VARCHAR(20) DEFAULT 'none', -- none, daily, weekly, monthly, yearly
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 事件参与者表 (用于指定哪些成员需要参与或收到提醒)
CREATE TABLE IF NOT EXISTS calendar_event_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined
    UNIQUE (event_id, user_id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);

-- 触发器更新 updated_at
CREATE TRIGGER update_calendar_events_modtime BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
