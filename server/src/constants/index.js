// src/constants/index.js
// 常量统一导出

const errorCodes = require('./errorCodes');
const statusCodes = require('./statusCodes');
const roles = require('./roles');

module.exports = {
  ...errorCodes,
  ...statusCodes,
  ...roles
};

