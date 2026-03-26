// 想么后端 - 完整配对版
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');
const { v4: uuidv4 } = require('uuid');

// 环境变量
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// 初始化 Supabase
let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error('Supabase init error:', e.message);
}

// 内存存储（等待配对的用户）
const waitingUsers = new Map(); // userId -> {phone, lat, lng, gender, waitToken, time}
const matchResults = new Map(); // waitToken -> {matched, partnerPhone, distance}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const path = req.url;
  
  try {
    // 健康检查
    if (path === '/api/health' || path === '/') {
      return res.json({
        status: 'ok',
        service: 'xiangme-backend',
        version: '1.0.1',
        demo_mode: DEMO_MODE,
        waiting_count: waitingUsers.size,
        timestamp: new Date().toISOString()
      });
    }
    
    // 发送验证码
    if (path === '/api/auth/send-otp' && req.method === 'POST') {
      const { phone, gender } = req.body || {};
      
      if (!phone) {
        return res.status(400).json({ error: '手机号不能为空' });
      }
      
      return res.json({
        success: true,
        message: '验证码已发送（演示模式: 888888）',
        demo: true
      });
    }
    
    // 验证登录
    if (path === '/api/auth/verify-otp' && req.method === 'POST') {
      const { phone, otp } = req.body || {};
      
      if (!phone || !otp) {
        return res.status(400).json({ error: '手机号和验证码不能为空' });
      }
      
      if (otp !== '888888') {
        return res.status(401).json({ error: '验证码错误' });
      }
      
      const userId = 'user_' + Date.now();
      
      return res.json({
        success: true,
        userId: userId,
        token: uuidv4(),
        phone: phone
      });
    }
    
    // 发送配对信号
    if (path === '/api/match/signal' && req.method === 'POST') {
      const { userId, phone, latitude, longitude, gender } = req.body || {};
      
      if (!userId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: '缺少必要参数' });
      }
      
      const waitToken = uuidv4();
      // 使用前端传来的 gender，默认为 MALE
      const userGender = gender || 'MALE';
      
      console.log(`User ${userId} (${userGender}) waiting at ${latitude},${longitude}`);
      
      // 保存到等待列表
      waitingUsers.set(userId, {
        phone,
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        gender: userGender,
        waitToken,
        time: Date.now()
      });
      
      console.log(`User ${userId} waiting, total: ${waitingUsers.size}`);
      
      // 立即查找匹配
      const match = findNearbyMatch(userId, parseFloat(latitude), parseFloat(longitude), userGender);
      
      if (match) {
        // 配对成功！
        const result = {
          matched: true,
          partnerPhone: match.phone,
          distance: match.distance,
          message: '配对成功'
        };
        
        // 保存配对结果
        matchResults.set(waitToken, result);
        matchResults.set(match.waitToken, {
          matched: true,
          partnerPhone: phone,
          distance: match.distance,
          message: '配对成功'
        });
        
        // 从等待列表移除
        waitingUsers.delete(userId);
        waitingUsers.delete(match.userId);
        
        console.log(`Match success: ${userId} <-> ${match.userId}`);
        
        return res.json({
          success: true,
          matched: true,
          ...result,
          waitToken
        });
      }
      
      // 未匹配，返回等待
      return res.json({
        success: true,
        matched: false,
        waitToken,
        timeout: 60
      });
    }
    
    // 查询配对结果
    if (path.startsWith('/api/match/result/') && req.method === 'GET') {
      const waitToken = path.replace('/api/match/result/', '');
      
      const result = matchResults.get(waitToken);
      
      if (result) {
        return res.json({
          matched: result.matched,
          partnerPhone: result.partnerPhone,
          distance: result.distance,
          message: result.message
        });
      }
      
      return res.json({
        matched: false,
        message: '等待配对中...'
      });
    }
    
    // 取消配对
    if (path === '/api/match/cancel' && req.method === 'POST') {
      const { userId } = req.body || {};
      
      if (userId) {
        waitingUsers.delete(userId);
      }
      
      return res.json({
        success: true,
        message: '已取消配对'
      });
    }
    
    return res.status(404).json({ error: 'Not found' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

// 查找附近匹配
function findNearbyMatch(userId, lat, lng, gender) {
  const targetGender = gender === 'MALE' ? 'FEMALE' : 'MALE';
  const MATCH_RADIUS = 10000; // 10公里
  
  for (const [otherId, other] of waitingUsers.entries()) {
    if (otherId === userId) continue;
    
    // 性别匹配
    if (other.gender !== targetGender) continue;
    
    // 计算距离
    const distance = calculateDistance(lat, lng, other.lat, other.lng);
    
    if (distance <= MATCH_RADIUS) {
      return {
        userId: otherId,
        phone: other.phone,
        waitToken: other.waitToken,
        distance: Math.round(distance)
      };
    }
  }
  
  return null;
}

// 计算距离（Haversine公式）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
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