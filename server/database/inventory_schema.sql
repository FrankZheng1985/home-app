-- 物资清单模块数据库架构 (PostgreSQL)

-- 1. 物资分类表
CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT '📦',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 物资项目表
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    current_stock DECIMAL(10, 2) DEFAULT 0,
    min_stock DECIMAL(10, 2) DEFAULT 0, -- 预警阈值
    unit VARCHAR(20) DEFAULT '个',
    remark TEXT,
    last_updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 采购清单表
CREATE TABLE IF NOT EXISTS shopping_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    item_name VARCHAR(100), -- 冗余字段，防止关联项被删
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending', -- pending: 待买, bought: 已买
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_inventory_items_family ON inventory_items(family_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_family ON shopping_list(family_id);
