const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { authenticate } = require('../middleware/auth');

/**
 * 获取物资列表
 */
router.get('/items', authenticate, async (req, res) => {
  try {
    const { familyId } = req.query;
    const items = await inventoryService.getItems(familyId, req.user.id);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取分类列表
 */
router.get('/categories', authenticate, async (req, res) => {
  try {
    const { familyId } = req.query;
    const categories = await inventoryService.getCategories(familyId, req.user.id);
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建分类
 */
router.post('/categories', authenticate, async (req, res) => {
  try {
    const result = await inventoryService.createCategory({
      ...req.body,
      userId: req.user.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新分类
 */
router.put('/categories/:id', authenticate, async (req, res) => {
  try {
    const result = await inventoryService.updateCategory(req.params.id, {
      ...req.body,
      userId: req.user.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除分类
 */
router.delete('/categories/:id', authenticate, async (req, res) => {
  try {
    const { familyId } = req.query;
    const result = await inventoryService.deleteCategory(req.params.id, familyId, req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建物资
 */
router.post('/items', authenticate, async (req, res) => {
  try {
    const result = await inventoryService.createItem({
      ...req.body,
      userId: req.user.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新库存
 */
router.patch('/items/:id/stock', authenticate, async (req, res) => {
  try {
    const { familyId, amount } = req.body;
    const result = await inventoryService.updateStock(req.params.id, familyId, req.user.id, amount);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取采购清单
 */
router.get('/shopping-list', authenticate, async (req, res) => {
  try {
    const { familyId } = req.query;
    const list = await inventoryService.getShoppingList(familyId, req.user.id);
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 标记采购项为已买
 */
router.post('/shopping-list/:id/buy', authenticate, async (req, res) => {
  try {
    const { familyId } = req.body;
    const result = await inventoryService.toggleShoppingItem(req.params.id, familyId, req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
