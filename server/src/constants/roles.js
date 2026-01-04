// src/constants/roles.js
// 角色权限定义 - ERP标准角色规范

/**
 * 家庭成员角色
 */
const FAMILY_ROLES = {
  CREATOR: 'creator',       // 创建人 - 最高权限
  ADMIN: 'admin',           // 管理员 - 可管理成员和审核
  MEMBER: 'member'          // 普通成员
};

/**
 * 角色权限等级（数值越大权限越高）
 */
const ROLE_LEVELS = {
  [FAMILY_ROLES.MEMBER]: 1,
  [FAMILY_ROLES.ADMIN]: 2,
  [FAMILY_ROLES.CREATOR]: 3
};

/**
 * 检查是否为管理员（creator 或 admin）
 * @param {string} role - 角色
 * @returns {boolean}
 */
const isAdmin = (role) => {
  return role === FAMILY_ROLES.CREATOR || role === FAMILY_ROLES.ADMIN;
};

/**
 * 检查是否为创建人
 * @param {string} role - 角色
 * @returns {boolean}
 */
const isCreator = (role) => {
  return role === FAMILY_ROLES.CREATOR;
};

/**
 * 比较角色权限
 * @param {string} role1 - 角色1
 * @param {string} role2 - 角色2
 * @returns {number} 1: role1 > role2, -1: role1 < role2, 0: 相等
 */
const compareRoles = (role1, role2) => {
  const level1 = ROLE_LEVELS[role1] || 0;
  const level2 = ROLE_LEVELS[role2] || 0;
  if (level1 > level2) return 1;
  if (level1 < level2) return -1;
  return 0;
};

module.exports = {
  FAMILY_ROLES,
  ROLE_LEVELS,
  isAdmin,
  isCreator,
  compareRoles
};

