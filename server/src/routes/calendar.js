const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authenticate } = require('../middleware/auth');

/**
 * 获取日程列表
 */
router.get('/events', authenticate, calendarController.getEvents);

/**
 * 创建日程
 */
router.post('/events', authenticate, calendarController.createEvent);

/**
 * 更新日程
 */
router.put('/events/:id', authenticate, calendarController.updateEvent);

/**
 * 删除日程
 */
router.delete('/events/:id', authenticate, calendarController.deleteEvent);

module.exports = router;
