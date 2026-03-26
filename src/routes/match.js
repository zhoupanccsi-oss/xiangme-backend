// 配对路由
const { v4: uuidv4 } = require('uuid');
const { MATCH_TIMEOUT, MATCH_RADIUS_METERS } = require('../config');
const { setWaitToken, getWaitToken, deleteWaitToken, setMatchResult, getMatchResult, findNearbyMatch } = require('../services/redis');
const { createMatch } = require('../services/supabase');

module.exports = async (req, res) => {
  const path = req.url.replace('/match', '');
  
  if (path === '/signal' && req.method === 'POST') {
    return sendSignal(req, res);
  }
  
  if (path.startsWith('/result/') && req.method === 'GET') {
    const waitToken = path.replace('/result/', '');
    return getResult(req, res, waitToken);
  }
  
  if (path === '/cancel' && req.method === 'POST') {
    return cancelMatch(req, res);
  }
  
  return res.status(404).json({ error: 'Not found' });
};

async function sendSignal(req, res) {
  try {
    const { userId, phone, latitude, longitude, fcmToken, gender, deviceType = 'android' } = req.body;
    
    if (!userId || !phone || !latitude || !longitude) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 生成等待 Token
    const waitToken = uuidv4();
    const timestamp = Date.now();
    
    // 存储到 Redis
    await setWaitToken(userId, {
      phone,
      lat: latitude,
      lng: longitude,
      fcmToken,
      gender,
      deviceType,
      timestamp,
      waitToken
    }, MATCH_TIMEOUT);
    
    // 立即尝试匹配
    const match = await findNearbyMatch(userId, latitude, longitude, gender, MATCH_RADIUS_METERS);
    
    if (match) {
      // 配对成功
      const result = {
        matched: true,
        partnerPhone: match.phone,
        distance: match.distance,
        message: '配对成功'
      };
      
      // 存储结果
      await setMatchResult(waitToken, result);
      
      // 删除等待信息
      await deleteWaitToken(userId);
      await deleteWaitToken(match.userId);
      
      // 保存到数据库
      try {
        await createMatch(userId, match.userId, deviceType, null, match.distance);
      } catch (e) {
        console.error('Save match to DB error:', e);
      }
      
      return res.json({
        success: true,
        matched: true,
        ...result,
        waitToken
      });
    }
    
    // 未立即匹配，返回 waitToken 让客户端轮询
    return res.json({
      success: true,
      matched: false,
      waitToken,
      timeout: MATCH_TIMEOUT
    });
    
  } catch (error) {
    console.error('Send signal error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}

async function getResult(req, res, waitToken) {
  try {
    if (!waitToken) {
      return res.status(400).json({ error: '缺少waitToken' });
    }
    
    // 检查配对结果
    const result = await getMatchResult(waitToken);
    
    if (result) {
      return res.json({
        matched: result.matched,
        partnerPhone: result.partnerPhone,
        distance: result.distance,
        message: result.message
      });
    }
    
    // 还在等待中
    return res.json({
      matched: false,
      message: '等待配对中...'
    });
    
  } catch (error) {
    console.error('Get result error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}

async function cancelMatch(req, res) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少userId' });
    }
    
    await deleteWaitToken(userId);
    
    return res.json({
      success: true,
      message: '已取消配对'
    });
    
  } catch (error) {
    console.error('Cancel match error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}