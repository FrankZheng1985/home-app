// src/controllers/calendarController.js
// 日历控制器 - 处理家庭日程相关请求

const calendarService = require('../services/calendarService');
const { HTTP_STATUS } = require('../constants/statusCodes');

/**
 * 获取日程列表
 */
const getEvents = async (req, res) => {
  const { familyId, startTime, endTime } = req.query;
  
  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const events = await calendarService.getEvents(familyId, req.user.id, startTime, endTime);
    return res.json({ success: true, data: events });
  } catch (error) {
    console.error('获取日程错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '获取日程失败' });
  }
};

/**
 * 创建日程
 */
const createEvent = async (req, res) => {
  try {
    const result = await calendarService.createEvent({
      ...req.body,
      creatorId: req.user.id
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('创建日程错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '创建日程失败' });
  }
};

/**
 * 更新日程
 */
const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const result = await calendarService.updateEvent(id, {
      ...req.body,
      userId: req.user.id,
      familyId
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('更新日程错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '更新日程失败' });
  }
};

/**
 * 删除日程
 */
const deleteEvent = async (req, res) => {
  const { id } = req.params;
  const { familyId } = req.query;

  if (!familyId) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: '缺少家庭ID' });
  }

  try {
    const result = await calendarService.deleteEvent(id, req.user.id, familyId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('删除日程错误:', error);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: error.message || '删除日程失败' });
  }
};

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent
};
