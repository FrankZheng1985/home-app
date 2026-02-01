// src/controllers/familyController.js
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

// 动态导入数据库模块
let query, getClient;
try {
  const db = require('../config/database');
  query = db.query;
  getClient = db.getClient;
} catch (e) {
  console.warn('数据库模块未加载');
  query = null;
  getClient = null;
}

// 开发模式下的模拟数据
const mockFamilies = global.mockFamilies || (global.mockFamilies = new Map());
const mockFamilyMembers = global.mockFamilyMembers || (global.mockFamilyMembers = new Map());

/**
 * 生成邀请码
 */
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * 创建家庭
 */
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name } = req.body;
  const userId = req.user.id;

  // 尝试使用数据库
  if (getClient) {
    try {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // 生成唯一邀请码
        let inviteCode;
        let codeExists = true;
        while (codeExists) {
          inviteCode = generateInviteCode();
          const codeCheck = await client.query(
            'SELECT id FROM families WHERE invite_code = ?',
            [inviteCode]
          );
          codeExists = codeCheck.rows.length > 0;
        }

        // 创建家庭
        const familyId = uuidv4();
        await client.query(
          `INSERT INTO families (id, name, invite_code, creator_id, points_value, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [familyId, name, inviteCode, userId, 0.5]
        );

        // 将创建者添加为家庭成员
        await client.query(
          `INSERT INTO family_members (id, family_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [uuidv4(), familyId, userId, 'creator']
        );
        
        // 更新用户表中的 family_id（重要！）
        await client.query(
          `UPDATE users SET family_id = ? WHERE id = ?`,
          [familyId, userId]
        );

        // 添加预设家务类型
        const presetChores = [
          { name: '洗碗', points: 5 },
          { name: '扫地', points: 5 },
          { name: '拖地', points: 8 },
          { name: '做饭', points: 15 },
          { name: '洗衣服', points: 10 },
          { name: '整理房间', points: 10 },
          { name: '倒垃圾', points: 3 },
          { name: '擦桌子', points: 3 }
        ];

        for (const chore of presetChores) {
          await client.query(
            `INSERT INTO chore_types (id, family_id, name, points, is_preset, is_active, created_at)
             VALUES (?, ?, ?, ?, true, true, NOW())`,
            [uuidv4(), familyId, chore.name, chore.points]
          );
        }

        await client.query('COMMIT');
        client.release();

        return res.json({
          data: {
            id: familyId,
            name,
            inviteCode,
            pointsValue: 0.5
          }
        });
      } catch (dbError) {
        await client.query('ROLLBACK');
        client.release();
        throw dbError;
      }
    } catch (error) {
      console.warn('数据库操作失败，使用模拟数据:', error.message);
    }
  }

  // 使用模拟数据（开发模式）
  try {
    const familyId = uuidv4();
    const inviteCode = generateInviteCode();
    
    const family = {
      id: familyId,
      name,
      invite_code: inviteCode,
      creator_id: userId,
      points_value: 0.5,
      created_at: new Date()
    };
    
    mockFamilies.set(familyId, family);
    
    // 添加创建者为成员
    const memberId = uuidv4();
    mockFamilyMembers.set(memberId, {
      id: memberId,
      family_id: familyId,
      user_id: userId,
      role: 'creator',
      joined_at: new Date()
    });

    // 同时更新 FamilyService 中的模拟数据，保持一致
    const FamilyService = require('../services/familyService');
    if (global.mockFamilies) global.mockFamilies.set(familyId, family);
    if (global.mockFamilyMembers) global.mockFamilyMembers.set(memberId, {
      id: memberId,
      family_id: familyId,
      user_id: userId,
      role: 'creator',
      joined_at: new Date()
    });
    
    console.log('🔧 开发模式：家庭已创建', name, inviteCode);
    
    return res.json({
      data: {
        id: familyId,
        name,
        inviteCode,
        pointsValue: 0.5
      }
    });
  } catch (error) {
    console.error('创建家庭错误:', error);
    return res.status(500).json({ error: '创建家庭失败' });
  }
};

/**
 * 获取我的家庭列表
 */
const getMyFamilies = async (req, res) => {
  const userId = req.user.id;

  // 尝试使用数据库
  if (query) {
    try {
      const result = await query(
        `SELECT f.id, f.name, f.invite_code, f.points_value, f.created_at,
                fm.role, fm.joined_at,
                (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as member_count
         FROM families f
         JOIN family_members fm ON f.id = fm.family_id
         WHERE fm.user_id = ?
         ORDER BY fm.joined_at DESC`,
        [userId]
      );

      return res.json({
        data: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          inviteCode: row.invite_code,
          pointsValue: parseFloat(row.points_value),
          memberCount: parseInt(row.member_count),
          role: row.role,
          joinedAt: row.joined_at,
          createdAt: row.created_at
        }))
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const userFamilies = [];
    
    for (const [memberId, member] of mockFamilyMembers) {
      if (member.user_id === userId) {
        const family = mockFamilies.get(member.family_id);
        if (family) {
          // 计算成员数量
          let memberCount = 0;
          for (const [, m] of mockFamilyMembers) {
            if (m.family_id === family.id) memberCount++;
          }
          
          userFamilies.push({
            id: family.id,
            name: family.name,
            inviteCode: family.invite_code,
            pointsValue: parseFloat(family.points_value),
            memberCount,
            role: member.role,
            joinedAt: member.joined_at,
            createdAt: family.created_at
          });
        }
      }
    }
    
    return res.json({ data: userFamilies });
  } catch (error) {
    console.error('获取家庭列表错误:', error);
    return res.status(500).json({ error: '获取家庭列表失败' });
  }
};

/**
 * 通过邀请码加入家庭
 */
const joinByCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { inviteCode } = req.body;
  const userId = req.user.id;

  try {
    // 查找家庭
    const familyResult = await query(
      'SELECT id, name FROM families WHERE invite_code = ?',
      [inviteCode.toUpperCase()]
    );

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: '邀请码无效' });
    }

    const family = familyResult.rows[0];

    // 检查是否已是成员
    const memberCheck = await query(
      'SELECT id FROM family_members WHERE family_id = ? AND user_id = ?',
      [family.id, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: '您已是该家庭成员' });
    }

    // 加入家庭
    await query(
      `INSERT INTO family_members (id, family_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [uuidv4(), family.id, userId, 'member']
    );
    
    // 更新用户表中的 family_id（重要！）
    await query(
      `UPDATE users SET family_id = ? WHERE id = ?`,
      [family.id, userId]
    );

    return res.json({
      data: {
        familyId: family.id,
        familyName: family.name,
        message: '加入成功'
      }
    });
  } catch (error) {
    console.error('加入家庭错误:', error);
    return res.status(500).json({ error: '加入家庭失败' });
  }
};

/**
 * 获取家庭信息
 */
const getInfo = async (req, res) => {
  const { familyId } = req.params;

  try {
    const result = await query(
      `SELECT id, name, invite_code, creator_id, points_value, created_at
       FROM families WHERE id = ?`,
      [familyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '家庭不存在' });
    }

    const family = result.rows[0];
    return res.json({
      data: {
        id: family.id,
        name: family.name,
        inviteCode: family.invite_code,
        creatorId: family.creator_id,
        pointsValue: parseFloat(family.points_value),
        createdAt: family.created_at
      }
    });
  } catch (error) {
    console.error('获取家庭信息错误:', error);
    return res.status(500).json({ error: '获取家庭信息失败' });
  }
};

/**
 * 获取家庭成员列表
 */
const getMembers = async (req, res) => {
  const { familyId } = req.params;

  // 尝试使用数据库
  if (query) {
    try {
      const result = await query(
        `SELECT u.id, u.nickname, u.avatar_url, fm.role, fm.joined_at,
                (SELECT COALESCE(SUM(points_earned), 0) FROM chore_records 
                 WHERE user_id = u.id AND family_id = ?) as total_points
         FROM family_members fm
         JOIN users u ON fm.user_id = u.id
         WHERE fm.family_id = ?
         ORDER BY fm.joined_at ASC`,
        [familyId, familyId]
      );

      return res.json({
        data: result.rows.map(row => ({
          id: row.id,
          userId: row.id, // 添加 userId 字段
          nickname: row.nickname,
          avatarUrl: row.avatar_url,
          role: row.role,
          joinedAt: row.joined_at,
          totalPoints: parseInt(row.total_points)
        }))
      });
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
  }

  // 使用模拟数据
  try {
    const members = [];
    for (const [, member] of mockFamilyMembers) {
      if (member.family_id === familyId) {
        // 获取用户信息
        const mockUsers = global.mockUsers || new Map();
        let userInfo = { nickname: '用户', avatar_url: '' };
        for (const [, user] of mockUsers) {
          if (user.id === member.user_id) {
            userInfo = user;
            break;
          }
        }
        
        members.push({
          id: member.user_id,
          userId: member.user_id,
          nickname: userInfo.nickname,
          avatarUrl: userInfo.avatar_url,
          role: member.role,
          joinedAt: member.joined_at,
          totalPoints: 0
        });
      }
    }
    return res.json({ data: members });
  } catch (error) {
    console.error('获取成员列表错误:', error);
    return res.status(500).json({ error: '获取成员列表失败' });
  }
};

/**
 * 更新成员角色
 */
const updateMemberRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { familyId, memberId } = req.params;
  const { role } = req.body;
  const operatorId = req.user.id;

  try {
    // 只有创建者可以修改成员角色
    const operatorCheck = await query(
      'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
      [familyId, operatorId]
    );

    if (operatorCheck.rows.length === 0 || operatorCheck.rows[0].role !== 'creator') {
      return res.status(403).json({ error: '只有创建者可以修改成员角色' });
    }

    // 不能修改创建者角色
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
      [familyId, memberId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: '成员不存在' });
    }

    if (memberCheck.rows[0].role === 'creator') {
      return res.status(400).json({ error: '不能修改创建者角色' });
    }

    await query(
      'UPDATE family_members SET role = ? WHERE family_id = ? AND user_id = ?',
      [role, familyId, memberId]
    );

    return res.json({ data: { message: '更新成功' } });
  } catch (error) {
    console.error('更新成员角色错误:', error);
    return res.status(500).json({ error: '更新成员角色失败' });
  }
};

/**
 * 移除家庭成员
 */
const removeMember = async (req, res) => {
  const { familyId, memberId } = req.params;

  try {
    // 不能移除创建者
    const memberCheck = await query(
      'SELECT role FROM family_members WHERE family_id = ? AND user_id = ?',
      [familyId, memberId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: '成员不存在' });
    }

    if (memberCheck.rows[0].role === 'creator') {
      return res.status(400).json({ error: '不能移除创建者' });
    }

    await query(
      'DELETE FROM family_members WHERE family_id = ? AND user_id = ?',
      [familyId, memberId]
    );
    
    // 清除用户表中的 family_id
    await query(
      'UPDATE users SET family_id = NULL WHERE id = ?',
      [memberId]
    );

    return res.json({ data: { message: '移除成功' } });
  } catch (error) {
    console.error('移除成员错误:', error);
    return res.status(500).json({ error: '移除成员失败' });
  }
};

/**
 * 退出家庭
 */
const leave = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    // 创建者不能退出
    if (req.memberRole === 'creator') {
      return res.status(400).json({ error: '创建者不能退出家庭，请先转让创建者身份' });
    }

    await query(
      'DELETE FROM family_members WHERE family_id = ? AND user_id = ?',
      [familyId, userId]
    );
    
    // 清除用户表中的 family_id
    await query(
      'UPDATE users SET family_id = NULL WHERE id = ?',
      [userId]
    );

    return res.json({ data: { message: '退出成功' } });
  } catch (error) {
    console.error('退出家庭错误:', error);
    return res.status(500).json({ error: '退出家庭失败' });
  }
};

/**
 * 生成邀请二维码
 */
const generateQRCode = async (req, res) => {
  const { familyId } = req.params;

  try {
    const result = await query(
      'SELECT invite_code FROM families WHERE id = ?',
      [familyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '家庭不存在' });
    }

    // 返回邀请码，前端生成二维码
    return res.json({
      data: {
        inviteCode: result.rows[0].invite_code,
        // 实际项目中可以调用微信API生成小程序码
        qrCodeUrl: null
      }
    });
  } catch (error) {
    console.error('生成二维码错误:', error);
    return res.status(500).json({ error: '生成二维码失败' });
  }
};

/**
 * 更新家庭信息（名称等）
 */
const updateFamily = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { familyId } = req.params;
  const { name } = req.body;

  // 尝试使用数据库
  if (query) {
    try {
      // 检查家庭是否存在
      const familyCheck = await query(
        'SELECT id FROM families WHERE id = ?',
        [familyId]
      );

      if (familyCheck.rows.length === 0) {
        return res.status(404).json({ error: '家庭不存在' });
      }

      // 更新家庭名称
      await query(
        'UPDATE families SET name = ? WHERE id = ?',
        [name, familyId]
      );

      return res.json({
        data: {
          id: familyId,
          name,
          message: '更新成功'
        }
      });
    } catch (dbError) {
      console.error('数据库操作失败:', dbError.message);
      return res.status(500).json({ error: '更新家庭信息失败' });
    }
  }

  // 使用模拟数据（开发模式）
  try {
    const family = mockFamilies.get(familyId);
    if (!family) {
      return res.status(404).json({ error: '家庭不存在' });
    }

    family.name = name;
    mockFamilies.set(familyId, family);

    return res.json({
      data: {
        id: familyId,
        name,
        message: '更新成功'
      }
    });
  } catch (error) {
    console.error('更新家庭信息错误:', error);
    return res.status(500).json({ error: '更新家庭信息失败' });
  }
};

/**
 * 更新积分价值
 */
const updatePointsValue = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { familyId } = req.params;
  const { pointsValue } = req.body;

  try {
    await query(
      'UPDATE families SET points_value = ? WHERE id = ?',
      [pointsValue, familyId]
    );

    return res.json({
      data: {
        pointsValue,
        message: '更新成功'
      }
    });
  } catch (error) {
    console.error('更新积分价值错误:', error);
    return res.status(500).json({ error: '更新积分价值失败' });
  }
};

module.exports = {
  create,
  getMyFamilies,
  joinByCode,
  getInfo,
  getMembers,
  updateMemberRole,
  removeMember,
  leave,
  generateQRCode,
  updatePointsValue,
  updateFamily
};

