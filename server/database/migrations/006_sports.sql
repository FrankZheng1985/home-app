-- 006_sports.sql - 运动打卡模块
-- MySQL 8.0

-- 运动类型表
CREATE TABLE IF NOT EXISTS sport_types (
    id VARCHAR(36) PRIMARY KEY,
    family_id VARCHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '🏃',
    color VARCHAR(20) DEFAULT '#4caf50',
    calories_per_min DECIMAL(5, 2) DEFAULT 5.0 COMMENT '每分钟消耗热量（千卡）',
    is_preset TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    INDEX idx_sport_types_family_id (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='运动类型表';

-- 运动记录表
CREATE TABLE IF NOT EXISTS sport_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    family_id VARCHAR(36) NOT NULL,
    sport_type_id VARCHAR(36),
    sport_type VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '🏃',
    color VARCHAR(20) DEFAULT '#4caf50',
    duration INT NOT NULL DEFAULT 0 COMMENT '运动时长（分钟）',
    calories INT DEFAULT 0 COMMENT '消耗热量（千卡）',
    steps INT DEFAULT 0 COMMENT '步数（如果有）',
    remark TEXT,
    record_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (sport_type_id) REFERENCES sport_types(id) ON DELETE SET NULL,
    INDEX idx_sport_records_user_id (user_id),
    INDEX idx_sport_records_family_id (family_id),
    INDEX idx_sport_records_record_date (record_date),
    INDEX idx_sport_records_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='运动记录表';

-- 步数同步记录表（存储每日步数）
CREATE TABLE IF NOT EXISTS step_records (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    family_id VARCHAR(36) NOT NULL,
    steps INT NOT NULL DEFAULT 0,
    record_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_date (user_id, record_date),
    INDEX idx_step_records_user_id (user_id),
    INDEX idx_step_records_record_date (record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='步数同步记录表';
