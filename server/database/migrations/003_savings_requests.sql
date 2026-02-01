-- 存款审核功能
-- PostgreSQL 版本

-- 存款申请表
CREATE TABLE IF NOT EXISTS savings_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'deposit', -- deposit, withdraw
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reject_reason TEXT,
    reviewer_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_savings_requests_user ON savings_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_requests_family ON savings_requests(family_id);
CREATE INDEX IF NOT EXISTS idx_savings_requests_status ON savings_requests(status);
CREATE INDEX IF NOT EXISTS idx_savings_requests_created ON savings_requests(created_at DESC);
