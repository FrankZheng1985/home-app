// src/controllers/inventoryController.js
// 物资控制器 - 处理家庭物资相关请求

const inventoryService = require('../services/inventoryService');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取物资列表
 */
const getItems = async (req, res) => {
  const { familyId } = req.query;
  
  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const items = await inventoryService.getItems(familyId, req.user.id);
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('获取物资列表错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取物资列表失败' });
  }
};

/**
 * 获取分类列表
 */
const getCategories = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const categories = await inventoryService.getCategories(familyId, req.user.id);
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error('获取分类列表错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取分类列表失败' });
  }
};

/**
 * 创建分类
 */
const createCategory = async (req, res) => {
  try {
    const result = await inventoryService.createCategory({
      ...req.body,
      userId: req.user.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建分类错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '创建分类失败' });
  }
};

/**
 * 更新分类
 */
const updateCategory = async (req, res) => {
  try {
    const result = await inventoryService.updateCategory(req.params.id, {
      ...req.body,
      userId: req.user.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('更新分类错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '更新分类失败' });
  }
};

/**
 * 删除分类
 */
const deleteCategory = async (req, res) => {
  const { familyId } = req.query;

  try {
    const result = await inventoryService.deleteCategory(req.params.id, familyId, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('删除分类错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '删除分类失败' });
  }
};

/**
 * 创建物资
 */
const createItem = async (req, res) => {
  try {
    const result = await inventoryService.createItem({
      ...req.body,
      userId: req.user.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建物资错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '创建物资失败' });
  }
};

/**
 * 更新库存
 */
const updateStock = async (req, res) => {
  try {
    const { familyId, amount } = req.body;
    const result = await inventoryService.updateStock(req.params.id, familyId, req.user.id, amount);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('更新库存错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '更新库存失败' });
  }
};

/**
 * 获取采购清单
 */
const getShoppingList = async (req, res) => {
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const list = await inventoryService.getShoppingList(familyId, req.user.id);
    return res.json({ success: true, data: list });
  } catch (error) {
    console.error('获取采购清单错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取采购清单失败' });
  }
};

/**
 * 标记采购项为已买
 */
const toggleShoppingItem = async (req, res) => {
  try {
    const { familyId } = req.body;
    const result = await inventoryService.toggleShoppingItem(req.params.id, familyId, req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('标记购买错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '标记购买失败' });
  }
};

module.exports = {
  getItems,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateStock,
  getShoppingList,
  toggleShoppingItem
};
