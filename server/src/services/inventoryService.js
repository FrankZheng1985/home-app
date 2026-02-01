// src/services/inventoryService.js
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');

class InventoryService extends BaseService {
  /**
   * 获取物资列表
   */
  async getItems(familyId, userId) {
    await familyService.validateMembership(userId, familyId);

    if (!this.isDatabaseAvailable()) {
      return [
        { id: '1', name: '牛奶', currentStock: 2, minStock: 3, unit: '盒', categoryName: '食品', icon: '🥛' },
        { id: '2', name: '卫生纸', currentStock: 10, minStock: 5, unit: '卷', categoryName: '日用', icon: '🧻' }
      ];
    }

    const sql = `
      SELECT ii.*, ic.name as category_name, ic.icon as category_icon
      FROM inventory_items ii
      LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.family_id = $1
      ORDER BY ic.sort_order ASC, ii.name ASC
    `;
    const items = await this.queryMany(sql, [familyId]);
    return items.map(item => ({
      id: item.id,
      name: item.name,
      currentStock: parseFloat(item.current_stock),
      minStock: parseFloat(item.min_stock),
      unit: item.unit,
      remark: item.remark,
      categoryId: item.category_id,
      categoryName: item.category_name,
      categoryIcon: item.category_icon
    }));
  }

  /**
   * 更新库存
   */
  async updateStock(itemId, familyId, userId, amount) {
    await familyService.validateMembership(userId, familyId);

    if (this.isDatabaseAvailable()) {
      await this.transaction(async (client) => {
        // 1. 更新库存
        const res = await client.query(
          'UPDATE inventory_items SET current_stock = current_stock + $1, last_updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND family_id = $4 RETURNING *',
          [amount, userId, itemId, familyId]
        );
        const item = res.rows[0];

        // 2. 如果库存低于预警值且是减少库存操作，自动加入采购清单（如果清单中尚不存在该项）
        if (item && parseFloat(item.current_stock) <= parseFloat(item.min_stock) && amount < 0) {
          const checkRes = await client.query(
            'SELECT id FROM shopping_list WHERE item_id = $1 AND family_id = $2 AND status = $3',
            [itemId, familyId, 'pending']
          );
          
          if (checkRes.rowCount === 0) {
            await client.query(
              'INSERT INTO shopping_list (id, family_id, item_id, item_name, quantity, unit, added_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [uuidv4(), familyId, itemId, item.name, 1, item.unit, userId]
            );
          }
        }
      });
    }
    return { success: true };
  }

  /**
   * 获取所有分类
   */
  async getCategories(familyId, userId) {
    await familyService.validateMembership(userId, familyId);

    if (!this.isDatabaseAvailable()) {
      return [
        { id: '1', name: '食品', icon: '🥛' },
        { id: '2', name: '日用', icon: '🧻' },
        { id: '3', name: '药品', icon: '💊' },
        { id: '4', name: '其他', icon: '📦' }
      ];
    }

    return await this.queryMany(
      'SELECT * FROM inventory_categories WHERE family_id = $1 ORDER BY sort_order ASC',
      [familyId]
    );
  }

  /**
   * 创建分类
   */
  async createCategory(data) {
    const { familyId, userId, name, icon, sortOrder } = data;
    await familyService.validateAdminRole(userId, familyId);

    const id = uuidv4();
    if (this.isDatabaseAvailable()) {
      await this.insert('inventory_categories', {
        id,
        family_id: familyId,
        name,
        icon: icon || '📦',
        sort_order: sortOrder || 0
      });
    }
    return { id, name };
  }

  /**
   * 更新分类
   */
  async updateCategory(categoryId, data) {
    const { familyId, userId, name, icon, sortOrder } = data;
    await familyService.validateAdminRole(userId, familyId);

    if (this.isDatabaseAvailable()) {
      await this.update('inventory_categories', {
        name,
        icon,
        sort_order: sortOrder
      }, { id: categoryId, family_id: familyId });
    }
    return { success: true };
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId, familyId, userId) {
    await familyService.validateAdminRole(userId, familyId);

    if (this.isDatabaseAvailable()) {
      await this.query('DELETE FROM inventory_categories WHERE id = $1 AND family_id = $2', [categoryId, familyId]);
    }
    return { success: true };
  }

  /**
   * 创建物资项目
   */
  async createItem(data) {
    const { familyId, userId, name, categoryId, currentStock, minStock, unit, remark } = data;
    await familyService.validateMembership(userId, familyId);

    const itemId = uuidv4();
    if (this.isDatabaseAvailable()) {
      await this.insert('inventory_items', {
        id: itemId,
        family_id: familyId,
        category_id: categoryId,
        name,
        current_stock: currentStock || 0,
        min_stock: minStock || 0,
        unit: unit || '个',
        remark,
        last_updated_by: userId
      });
    }

    return { id: itemId, name, message: '物资添加成功' };
  }

  /**
   * 勾选采购项目（标记为已买并补回库存）
   */
  async toggleShoppingItem(shoppingId, familyId, userId) {
    await familyService.validateMembership(userId, familyId);

    if (this.isDatabaseAvailable()) {
      await this.transaction(async (client) => {
        // 1. 获取采购项详情
        const itemRes = await client.query(
          'SELECT * FROM shopping_list WHERE id = $1 AND family_id = $2',
          [shoppingId, familyId]
        );
        const shoppingItem = itemRes.rows[0];
        if (!shoppingItem || shoppingItem.status === 'bought') return;

        // 2. 更新采购项状态
        await client.query(
          'UPDATE shopping_list SET status = $1 WHERE id = $2',
          ['bought', shoppingId]
        );

        // 3. 如果有关联的库存项，补回库存
        if (shoppingItem.item_id) {
          await client.query(
            'UPDATE inventory_items SET current_stock = current_stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [shoppingItem.quantity, shoppingItem.item_id]
          );
        }
      });
    }

    return { success: true };
  }

  /**
   * 获取采购清单
   */
  async getShoppingList(familyId, userId) {
    await familyService.validateMembership(userId, familyId);

    if (!this.isDatabaseAvailable()) {
      return [
        { id: 's1', itemName: '鸡蛋', quantity: 1, unit: '打', status: 'pending' }
      ];
    }

    const sql = `
      SELECT sl.*, u.nickname as added_by_name
      FROM shopping_list sl
      LEFT JOIN users u ON sl.added_by = u.id
      WHERE sl.family_id = $1 AND sl.status = 'pending'
      ORDER BY sl.created_at DESC
    `;
    const list = await this.queryMany(sql, [familyId]);
    return list.map(item => ({
      id: item.id,
      itemId: item.item_id,
      itemName: item.item_name,
      quantity: parseFloat(item.quantity),
      unit: item.unit,
      status: item.status,
      addedByName: item.added_by_name
    }));
  }
}

module.exports = new InventoryService();
