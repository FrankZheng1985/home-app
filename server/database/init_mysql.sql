-- 家庭小助手数据库初始化脚本
-- MySQL 版本

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `openid` VARCHAR(100) NOT NULL,
  `nickname` VARCHAR(50) NOT NULL,
  `avatar_url` TEXT,
  `gender` TINYINT DEFAULT 0 COMMENT '0未知 1男 2女',
  `birthday` DATE,
  `preferences` JSON COMMENT 'JSON存储',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 家庭表
CREATE TABLE IF NOT EXISTS `families` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(50) NOT NULL,
  `invite_code` VARCHAR(10) NOT NULL,
  `creator_id` CHAR(36) NOT NULL,
  `points_value` DECIMAL(10, 2) DEFAULT 0.50 COMMENT '每积分价值（元）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_invite_code` (`invite_code`),
  KEY `idx_creator_id` (`creator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 家庭成员表
CREATE TABLE IF NOT EXISTS `family_members` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `family_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'member' COMMENT 'creator, admin, member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_family_user` (`family_id`, `user_id`),
  KEY `idx_family_id` (`family_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 家务类型表
CREATE TABLE IF NOT EXISTS `chore_types` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `family_id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `points` INT NOT NULL DEFAULT 1,
  `is_preset` BOOLEAN DEFAULT FALSE COMMENT '是否为预设类型',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_id` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 家务记录表
CREATE TABLE IF NOT EXISTS `chore_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `chore_type_id` CHAR(36) NOT NULL,
  `family_id` CHAR(36) NOT NULL,
  `points_earned` INT NOT NULL,
  `note` TEXT,
  `completed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_id` (`family_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_completed_at` (`completed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 积分交易记录表
CREATE TABLE IF NOT EXISTS `point_transactions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `family_id` CHAR(36) NOT NULL,
  `points` INT NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT 'earn(获得), spend(消费), adjust(调整)',
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_id` (`family_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 动态/朋友圈表
CREATE TABLE IF NOT EXISTS `posts` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `family_id` CHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `images` JSON COMMENT 'JSON存储',
  `is_anonymous` BOOLEAN DEFAULT FALSE COMMENT '是否匿名',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_id` (`family_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 动态点赞表
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `post_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_post_user` (`post_id`, `user_id`),
  KEY `idx_post_id` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 动态评论表
CREATE TABLE IF NOT EXISTS `post_comments` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `post_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_post_id` (`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 存款/心愿金表
CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `family_id` CHAR(36) NOT NULL,
  `creator_id` CHAR(36) NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `target_amount` DECIMAL(10, 2) NOT NULL,
  `current_amount` DECIMAL(10, 2) DEFAULT 0,
  `description` TEXT,
  `status` VARCHAR(20) DEFAULT 'active' COMMENT 'active, completed, cancelled',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_id` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 存款记录表
CREATE TABLE IF NOT EXISTS `savings_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `goal_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `type` VARCHAR(20) NOT NULL COMMENT 'deposit, withdraw',
  `note` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_goal_id` (`goal_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 运动类型表
CREATE TABLE IF NOT EXISTS `sport_types` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `family_id` CHAR(36) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `icon` VARCHAR(50) DEFAULT '🏃',
  `color` VARCHAR(20) DEFAULT '#4caf50',
  `calories_per_min` DECIMAL(5, 1) DEFAULT 0,
  `description` TEXT,
  `is_preset` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_family_id` (`family_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 运动记录表
CREATE TABLE IF NOT EXISTS `sport_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `family_id` CHAR(36) NOT NULL,
  `sport_type_id` CHAR(36),
  `sport_type` VARCHAR(50) NOT NULL,
  `icon` VARCHAR(50),
  `color` VARCHAR(20),
  `duration` INT NOT NULL COMMENT '分钟',
  `calories` INT DEFAULT 0,
  `steps` INT DEFAULT 0,
  `remark` TEXT,
  `record_date` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_family` (`user_id`, `family_id`),
  KEY `idx_record_date` (`record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 步数记录表（每日同步）
CREATE TABLE IF NOT EXISTS `step_records` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `family_id` CHAR(36) NOT NULL,
  `steps` INT NOT NULL DEFAULT 0,
  `record_date` DATE NOT NULL,
  `points_redeemed` BOOLEAN DEFAULT FALSE COMMENT '是否已兑换积分',
  `redeemed_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
