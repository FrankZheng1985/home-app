-- 存款审核功能
-- 存款需要管理员审核确认
-- MySQL 8.0

-- 存款申请表
CREATE TABLE IF NOT EXISTS savings_requests (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL COMMENT '申请人',
    type VARCHAR(20) NOT NULL DEFAULT 'deposit' COMMENT 'deposit(存款申请), withdraw(取款申请)',
    amount DECIMAL(12, 2) NOT NULL COMMENT '申请金额',
    description TEXT COMMENT '备注说明',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending(待审核), approved(已通过), rejected(已拒绝)',
    reviewed_by VARCHAR(36) COMMENT '审核人',
    reviewed_at TIMESTAMP NULL COMMENT '审核时间',
    reject_reason TEXT COMMENT '拒绝原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES savings_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    INDEX idx_savings_requests_account (account_id),
    INDEX idx_savings_requests_user (user_id),
    INDEX idx_savings_requests_status (status),
    INDEX idx_savings_requests_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='存款/取款申请表，需管理员审核';
