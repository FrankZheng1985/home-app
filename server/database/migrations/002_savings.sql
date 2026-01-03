-- 家庭存款基金表
-- 用于培养孩子的复利思维

-- 存款账户表
CREATE TABLE IF NOT EXISTS savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) DEFAULT 0.00,           -- 当前余额
  total_interest DECIMAL(12, 2) DEFAULT 0.00,    -- 累计利息
  annual_rate DECIMAL(5, 4) DEFAULT 0.0300,      -- 年利率，默认3%
  last_interest_date DATE,                        -- 上次计息日期
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, family_id)
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS savings_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,                      -- deposit(存款), withdraw(取款), interest(利息)
  amount DECIMAL(12, 2) NOT NULL,                 -- 金额
  balance_after DECIMAL(12, 2) NOT NULL,          -- 交易后余额
  description TEXT,                               -- 备注
  created_by UUID REFERENCES users(id),           -- 操作人（家长）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_savings_accounts_user ON savings_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_family ON savings_accounts(family_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_account ON savings_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_type ON savings_transactions(type);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_created ON savings_transactions(created_at DESC);

-- 更新时间触发器
CREATE TRIGGER update_savings_accounts_updated_at
  BEFORE UPDATE ON savings_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE savings_accounts IS '家庭存款账户 - 培养孩子复利思维';
COMMENT ON TABLE savings_transactions IS '存款交易记录';
COMMENT ON COLUMN savings_accounts.annual_rate IS '年利率，如0.03表示3%';
COMMENT ON COLUMN savings_transactions.type IS '交易类型：deposit存款, withdraw取款, interest利息';

