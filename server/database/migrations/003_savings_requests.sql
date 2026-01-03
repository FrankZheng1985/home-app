-- 存款审核功能
-- 存款需要管理员审核确认

-- 存款申请表
CREATE TABLE IF NOT EXISTS savings_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),           -- 申请人
  type VARCHAR(20) NOT NULL DEFAULT 'deposit',          -- deposit(存款申请), withdraw(取款申请)
  amount DECIMAL(12, 2) NOT NULL,                       -- 申请金额
  description TEXT,                                      -- 备注说明
  status VARCHAR(20) NOT NULL DEFAULT 'pending',        -- pending(待审核), approved(已通过), rejected(已拒绝)
  reviewed_by UUID REFERENCES users(id),                -- 审核人
  reviewed_at TIMESTAMP WITH TIME ZONE,                 -- 审核时间
  reject_reason TEXT,                                    -- 拒绝原因
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_savings_requests_account ON savings_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_savings_requests_user ON savings_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_requests_status ON savings_requests(status);
CREATE INDEX IF NOT EXISTS idx_savings_requests_created ON savings_requests(created_at DESC);

-- 更新时间触发器
CREATE TRIGGER update_savings_requests_updated_at
  BEFORE UPDATE ON savings_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE savings_requests IS '存款/取款申请表，需管理员审核';
COMMENT ON COLUMN savings_requests.status IS '状态：pending待审核, approved已通过, rejected已拒绝';

