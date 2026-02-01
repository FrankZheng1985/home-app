const express = require('express');
const router = express.Router();
const calendarService = require('../services/calendarService');
const { authenticate } = require('../middleware/auth');

/**
 * 获取日程列表
 */
router.get('/events', authenticate, async (req, res) => {
  try {
    const { familyId, startTime, endTime } = req.query;
    if (!familyId) {
      return res.status(400).json({ error: '缺少 familyId' });
    }
    const events = await calendarService.getEvents(familyId, req.user.id, startTime, endTime);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 创建日程
 */
router.post('/events', authenticate, async (req, res) => {
  try {
    const result = await calendarService.createEvent({
      ...req.body,
      creatorId: req.user.id
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新日程
 */
router.put('/events/:id', authenticate, async (req, res) => {
  try {
    const { familyId } = req.query;
    if (!familyId) {
      return res.status(400).json({ error: '缺少 familyId' });
    }
    const result = await calendarService.updateEvent(req.params.id, {
      ...req.body,
      userId: req.user.id,
      familyId
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除日程
 */
router.delete('/events/:id', authenticate, async (req, res) => {
  try {
    const { familyId } = req.query;
    if (!familyId) {
      return res.status(400).json({ error: '缺少 familyId' });
    }
    const result = await calendarService.deleteEvent(req.params.id, req.user.id, familyId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
