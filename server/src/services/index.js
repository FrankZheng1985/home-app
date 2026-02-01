// src/services/index.js
// 服务层统一导出

const authService = require('./authService');
const userService = require('./userService');
const familyService = require('./familyService');
const choreService = require('./choreService');
const savingsService = require('./savingsService');
const pointsService = require('./pointsService');
const inventoryService = require('./inventoryService');
const calendarService = require('./calendarService');

module.exports = {
  authService,
  userService,
  familyService,
  choreService,
  savingsService,
  pointsService,
  inventoryService,
  calendarService
};

