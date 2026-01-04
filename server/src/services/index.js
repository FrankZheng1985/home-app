// src/services/index.js
// 服务层统一导出

const authService = require('./authService');
const userService = require('./userService');
const familyService = require('./familyService');
const choreService = require('./choreService');
const savingsService = require('./savingsService');

module.exports = {
  authService,
  userService,
  familyService,
  choreService,
  savingsService
};

