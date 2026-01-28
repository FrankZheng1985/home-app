-- 008_point_redeem_requests.sql - 积分兑现申请表
-- MySQL 8.0

-- 积分兑现申请表
CREATE TABLE IF NOT EXISTS point_redeem_requests (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL COMMENT '申请人ID',
    family_id VARCHAR(36) NOT NULL COMMENT '家庭ID',
    points INT NOT NULL COMMENT '申请兑现的积分数量',
    amount DECIMAL(10, 2) NOT NULL COMMENT '对应金额（积分 * 积分价值）',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending(待审核), approved(已通过), rejected(已拒绝)',
    remark TEXT COMMENT '申请备注',
    reject_reason TEXT COMMENT '拒绝原因',
    reviewed_by VARCHAR(36) COMMENT '审核人ID',
    reviewed_at TIMESTAMP NULL COMMENT '审核时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    INDEX idx_redeem_requests_user (user_id),
    INDEX idx_redeem_requests_family (family_id),
    INDEX idx_redeem_requests_status (status),
    INDEX idx_redeem_requests_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分兑现申请表';
