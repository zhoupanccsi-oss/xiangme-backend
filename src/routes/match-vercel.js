// 配对路由 - Vercel Serverless 版本
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');
const { MATCH_TIMEOUT, MATCH_RADIUS_METERS, SUPABASE_URL, SUPABASE_SERVICE_KEY, UPSTASH_REDIS_URL } = require('../config');

// 初始化客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const redis = new Redis({ url: UPSTASH_REDIS_URL });

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
    
    // 存储到 Redis
    await redis.setex(`wait:${userId}`, MATCH_TIMEOUT, JSON.stringify({
      phone,
      lat: latitude,
      lng: longitude,
      fcmToken,
      gender,
      deviceType,
      timestamp: Date.now(),
      waitToken
    }));
    
    // 立即尝试匹配
    const match = await findNearbyMatch(userId, latitude, longitude, gender);
    
    if (match) {
      // 配对成功
      const result = {
        matched: true,
        partnerPhone: match.phone,
        distance: match.distance,
        message: '配对成功'
      };
      
      // 存储结果
      await redis.setex(`match:${waitToken}`, 300, JSON.stringify(result));
      
      // 删除等待信息
      await redis.del(`wait:${userId}`);
      await redis.del(`wait:${match.userId}`);
      
      // 保存到数据库
      try {
        const [aId, bId] = userId < match.userId ? [userId, match.userId] : [match.userId, userId];
        await supabase.from('matches').insert([{
          user_a_id: aId,
          user_b_id: bId,
          user_a_device: deviceType,
          distance_meters: match.distance
        }]);
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
    const result = await redis.get(`match:${waitToken}`);
    
    if (result) {
      const data = JSON.parse(result);
      return res.json({
        matched: data.matched,
        partnerPhone: data.partnerPhone,
        distance: data.distance,
        message: data.message
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
    
    await redis.del(`wait:${userId}`);
    
    return res.json({
      success: true,
      message: '已取消配对'
    });
    
  } catch (error) {
    console.error('Cancel match error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}

// 查找附近匹配
async function findNearbyMatch(userId, lat, lng, gender) {
  const targetGender = gender === 'MALE' ? 'FEMALE' : 'MALE';
  
  // 扫描所有等待中的用户
  const keys = await redis.keys('wait:*');
  
  for (const key of keys) {
    const tokenUserId = key.replace('wait:', '');
    if (tokenUserId === userId) continue;
    
    const data = await redis.get(key);
    if (!data) continue;
    
    const waitData = JSON.parse(data);
    
    // 性别过滤
    if (waitData.gender && waitData.gender !== targetGender) continue;
    
    // 计算距离
    const distance = calculateDistance(lat, lng, waitData.lat, waitData.lng);
    
    if (distance <= MATCH_RADIUS_METERS) {
      return {
        userId: tokenUserId,
        phone: waitData.phone,
        distance: Math.round(distance)
      };
    }
  }
  
  return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}