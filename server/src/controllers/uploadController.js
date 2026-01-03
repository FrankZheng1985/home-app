// src/controllers/uploadController.js
const path = require('path');
const fs = require('fs');

/**
 * 单图片上传
 */
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 生成访问URL
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const imageUrl = `${baseUrl}/uploads/images/${req.file.filename}`;

    console.log('📷 图片上传成功:', req.file.filename);

    return res.json({
      data: {
        url: imageUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    return res.status(500).json({ error: '图片上传失败' });
  }
};

/**
 * 多图片上传
 */
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 生成访问URLs
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const images = req.files.map(file => ({
      url: `${baseUrl}/uploads/images/${file.filename}`,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size
    }));

    console.log(`📷 批量上传成功: ${req.files.length} 张图片`);

    return res.json({
      data: {
        images,
        count: images.length
      }
    });
  } catch (error) {
    console.error('批量图片上传错误:', error);
    return res.status(500).json({ error: '图片上传失败' });
  }
};

/**
 * 删除图片
 */
const deleteImage = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: '缺少文件名' });
    }

    const filePath = path.join(__dirname, '../../uploads/images', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ 图片删除成功:', filename);
      return res.json({ data: { message: '删除成功' } });
    } else {
      return res.status(404).json({ error: '文件不存在' });
    }
  } catch (error) {
    console.error('图片删除错误:', error);
    return res.status(500).json({ error: '图片删除失败' });
  }
};

module.exports = {
  uploadImage,
  uploadImages,
  deleteImage
};

