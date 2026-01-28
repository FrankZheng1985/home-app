-- 009_step_records_redeem.sql - 添加步数兑换积分相关字段
-- MySQL 8.0

-- 添加积分兑换相关字段到 step_records 表
ALTER TABLE step_records 
ADD COLUMN IF NOT EXISTS points_redeemed TINYINT(1) DEFAULT 0 COMMENT '是否已兑换积分',
ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP NULL COMMENT '兑换时间';

-- 如果列已存在会报错，使用存储过程安全添加
DELIMITER //
CREATE PROCEDURE add_step_records_columns()
BEGIN
    -- 检查并添加 points_redeemed 字段
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'step_records' AND COLUMN_NAME = 'points_redeemed'
    ) THEN
        ALTER TABLE step_records ADD COLUMN points_redeemed TINYINT(1) DEFAULT 0 COMMENT '是否已兑换积分';
    END IF;
    
    -- 检查并添加 redeemed_at 字段
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'step_records' AND COLUMN_NAME = 'redeemed_at'
    ) THEN
        ALTER TABLE step_records ADD COLUMN redeemed_at TIMESTAMP NULL COMMENT '兑换时间';
    END IF;
END //
DELIMITER ;

CALL add_step_records_columns();
DROP PROCEDURE IF EXISTS add_step_records_columns;
