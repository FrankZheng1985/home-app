const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/auth');

/**
 * 获取物资列表
 */
router.get('/items', authenticate, inventoryController.getItems);

/**
 * 获取分类列表
 */
router.get('/categories', authenticate, inventoryController.getCategories);

/**
 * 创建分类
 */
router.post('/categories', authenticate, inventoryController.createCategory);

/**
 * 更新分类
 */
router.put('/categories/:id', authenticate, inventoryController.updateCategory);

/**
 * 删除分类
 */
router.delete('/categories/:id', authenticate, inventoryController.deleteCategory);

/**
 * 创建物资
 */
router.post('/items', authenticate, inventoryController.createItem);

/**
 * 更新库存
 */
router.patch('/items/:id/stock', authenticate, inventoryController.updateStock);

/**
 * 获取采购清单
 */
router.get('/shopping-list', authenticate, inventoryController.getShoppingList);

/**
 * 标记采购项为已买
 */
router.post('/shopping-list/:id/buy', authenticate, inventoryController.toggleShoppingItem);

module.exports = router;
