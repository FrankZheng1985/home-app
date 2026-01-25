-- 家庭存款基金表
-- 用于培养孩子的复利思维
-- MySQL 8.0

-- 存款账户表
CREATE TABLE IF NOT EXISTS savings_accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    family_id VARCHAR(36) NOT NULL,
    balance DECIMAL(12, 2) DEFAULT 0.00 COMMENT '当前余额',
    total_interest DECIMAL(12, 2) DEFAULT 0.00 COMMENT '累计利息',
    annual_rate DECIMAL(5, 4) DEFAULT 0.0300 COMMENT '年利率，默认3%',
    last_interest_date DATE COMMENT '上次计息日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_family (user_id, family_id),
    INDEX idx_savings_accounts_user (user_id),
    INDEX idx_savings_accounts_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='家庭存款账户 - 培养孩子复利思维';

-- 交易记录表
CREATE TABLE IF NOT EXISTS savings_transactions (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'deposit(存款), withdraw(取款), interest(利息)',
    amount DECIMAL(12, 2) NOT NULL COMMENT '金额',
    balance_after DECIMAL(12, 2) NOT NULL COMMENT '交易后余额',
    description TEXT COMMENT '备注',
    created_by VARCHAR(36) COMMENT '操作人（家长）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES savings_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_savings_transactions_account (account_id),
    INDEX idx_savings_transactions_type (type),
    INDEX idx_savings_transactions_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='存款交易记录';
