// src/services/calendarService.js
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./baseService');
const familyService = require('./familyService');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../constants/errorCodes');

class CalendarService extends BaseService {
  /**
   * 获取家庭日程列表
   */
  async getEvents(familyId, userId, startTime, endTime) {
    await familyService.validateMembership(userId, familyId);

    if (!this.isDatabaseAvailable()) {
      logger.info('🔧 开发模式：返回模拟日历日程');
      return [
        {
          id: uuidv4(),
          title: '家庭聚餐',
          description: '周末老地方见',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          location: '外婆家',
          categoryName: '生活',
          categoryColor: '#4facfe'
        }
      ];
    }

    const sql = `
      SELECT ce.*, cc.name as category_name, cc.color as category_color
      FROM calendar_events ce
      LEFT JOIN calendar_categories cc ON ce.category_id = cc.id
      WHERE ce.family_id = $1 AND ce.start_time >= $2 AND ce.end_time <= $3
      ORDER BY ce.start_time ASC
    `;
    const events = await this.queryMany(sql, [familyId, startTime, endTime]);
    
    return events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.start_time,
      endTime: e.end_time,
      isAllDay: e.is_all_day,
      location: e.location,
      categoryId: e.category_id,
      categoryName: e.category_name,
      categoryColor: e.category_color
    }));
  }

  /**
   * 创建日程
   */
  async createEvent(data) {
    const { familyId, creatorId, title, description, startTime, endTime, isAllDay, location, categoryId } = data;
    
    await familyService.validateMembership(creatorId, familyId);

    const eventId = uuidv4();
    if (this.isDatabaseAvailable()) {
      await this.insert('calendar_events', {
        id: eventId,
        family_id: familyId,
        creator_id: creatorId,
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        is_all_day: isAllDay || false,
        location,
        category_id: categoryId
      });
    }

    return { id: eventId, title, message: '日程创建成功' };
  }

  /**
   * 删除日程
   */
  async deleteEvent(eventId, userId, familyId) {
    await familyService.validateMembership(userId, familyId);

    if (this.isDatabaseAvailable()) {
      await this.query('DELETE FROM calendar_events WHERE id = $1 AND family_id = $2', [eventId, familyId]);
    }

    return { success: true, message: '日程已删除' };
  }

  /**
   * 更新日程
   */
  async updateEvent(eventId, data) {
    const { familyId, userId, title, description, startTime, endTime, isAllDay, location, categoryId } = data;
    
    await familyService.validateMembership(userId, familyId);

    if (this.isDatabaseAvailable()) {
      await this.update('calendar_events', {
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        is_all_day: isAllDay || false,
        location,
        category_id: categoryId,
        updated_at: CURRENT_TIMESTAMP
      }, { id: eventId, family_id: familyId });
    }

    return { id: eventId, title, message: '日程更新成功' };
  }
}

module.exports = new CalendarService();
