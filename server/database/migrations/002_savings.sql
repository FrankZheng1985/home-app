-- 家庭存款基金表
-- 用于培养孩子的复利思维
-- PostgreSQL 版本

-- 存款账户表
CREATE TABLE IF NOT EXISTS savings_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    total_interest DECIMAL(15, 2) DEFAULT 0.00,
    annual_rate DECIMAL(5, 2) DEFAULT 3.00,
    last_interest_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, family_id)
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS savings_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- deposit, withdraw, interest
    amount DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_savings_accounts_user ON savings_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_family ON savings_accounts(family_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_account ON savings_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_created ON savings_transactions(created_at DESC);
