-- 添加 family_id 字段到 users 表 (PostgreSQL 版本)
-- 这个字段用于快速查询用户所属的家庭

-- 1. 添加字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS family_id VARCHAR(36) DEFAULT NULL;

-- 2. 添加索引
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);

-- 3. 同步现有数据：将 family_members 表中的数据同步到 users 表
UPDATE users u
SET family_id = (
    SELECT fm.family_id 
    FROM family_members fm 
    WHERE fm.user_id = u.id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM family_members fm WHERE fm.user_id = u.id
);
