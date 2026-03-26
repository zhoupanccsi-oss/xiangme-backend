// 想么后端 - 完整版（连接 Supabase + Upstash）
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');
const { v4: uuidv4 } = require('uuid');

// 初始化客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL
});

const DEMO_MODE = process.env.DEMO_MODE !== 'false';
const DEMO_OTP = '888888';
const MATCH_TIMEOUT = 60;
const MATCH_RADIUS = 3000;

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
      // 测试数据库连接
      let dbStatus = 'unknown';
      try {
        await supabase.from('users').select('id').limit(1);
        dbStatus = 'connected';
      } catch (e) {
        dbStatus = 'error: ' + e.message;
      }
      
      // 测试 Redis 连接
      let redisStatus = 'unknown';
      try {
        await redis.ping();
        redisStatus = 'connected';
      } catch (e) {
        redisStatus = 'error: ' + e.message;
      }
      
      return res.json({
        status: 'ok',
        service: 'xiangme-backend',
        version: '1.0.0',
        demo_mode: DEMO_MODE,
        database: dbStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString()
      });
    }
    
    // 发送验证码
    if (path === '/api/auth/send-otp' && req.method === 'POST') {
      const { phone, gender } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: '手机号不能为空' });
      }
      
      const fullPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      
      // 保存性别
      if (gender) {
        await redis.setex(`gender:${fullPhone}`, 86400 * 30, gender);
      }
      
      // 生成验证码
      const code = DEMO_MODE ? DEMO_OTP : Math.random().toString().slice(2, 8);
      await redis.setex(`otp:${fullPhone}`, 300, code);
      
      return res.json({
        success: true,
        message: DEMO_MODE ? '验证码已发送（演示模式: 888888）' : '验证码已发送',
        demo: DEMO_MODE
      });
    }
    
    // 验证登录
    if (path === '/api/auth/verify-otp' && req.method === 'POST') {
      const { phone, otp, gender } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({ error: '手机号和验证码不能为空' });
      }
      
      const fullPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      
      // 验证验证码
      if (DEMO_MODE) {
        if (otp !== DEMO_OTP) {
          return res.status(401).json({ error: '验证码错误' });
        }
      } else {
        const savedOtp = await redis.get(`otp:${fullPhone}`);
        if (!savedOtp || savedOtp !== otp) {
          return res.status(401).json({ error: '验证码错误或已过期' });
        }
        await redis.del(`otp:${fullPhone}`);
      }
      
      // 查找或创建用户
      let { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('phone', fullPhone)
        .single();
      
      if (!user) {
        const userGender = gender || await redis.get(`gender:${fullPhone}`) || 'MALE';
        const { data: newUser, error } = await supabase
          .from('users')
          .insert([{ phone: fullPhone, gender: userGender }])
          .select()
          .single();
        
        if (error) throw error;
        user = newUser;
      }
      
      const token = uuidv4();
      
      return res.json({
        success: true,
        userId: user.id,
        token,
        phone: fullPhone
      });
    }
    
    // 发送配对信号
    if (path === '/api/match/signal' && req.method === 'POST') {
      const { userId, phone, latitude, longitude, gender, fcmToken } = req.body;
      
      if (!userId || !phone || !latitude || !longitude) {
        return res.status(400).json({ error: '缺少必要参数' });
      }
      
      const waitToken = uuidv4();
      
      // 保存到 Redis
      await redis.setex(`wait:${userId}`, MATCH_TIMEOUT, JSON.stringify({
        phone,
        lat: latitude,
        lng: longitude,
        gender,
        fcmToken,
        waitToken
      }));
      
      // 查找附近匹配
      const match = await findNearbyMatch(userId, latitude, longitude, gender);
      
      if (match) {
        const result = {
          matched: true,
          partnerPhone: match.phone,
          distance: match.distance,
          message: '配对成功'
        };
        
        await redis.setex(`match:${waitToken}`, 300, JSON.stringify(result));
        await redis.del(`wait:${userId}`);
        await redis.del(`wait:${match.userId}`);
        
        // 保存到数据库
        try {
          const [aId, bId] = userId < match.userId ? [userId, match.userId] : [match.userId, userId];
          await supabase.from('matches').insert([{
            user_a_id: aId,
            user_b_id: bId,
            distance_meters: match.distance
          }]);
        } catch (e) {
          console.error('Save match error:', e);
        }
        
        return res.json({
          success: true,
          matched: true,
          ...result,
          waitToken
        });
      }
      
      return res.json({
        success: true,
        matched: false,
        waitToken,
        timeout: MATCH_TIMEOUT
      });
    }
    
    // 查询配对结果
    if (path.startsWith('/api/match/result/') && req.method === 'GET') {
      const waitToken = path.replace('/api/match/result/', '');
      
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
      
      return res.json({
        matched: false,
        message: '等待配对中...'
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
async function findNearbyMatch(userId, lat, lng, gender) {
  const targetGender = gender === 'MALE' ? 'FEMALE' : 'MALE';
  
  const keys = await redis.keys('wait:*');
  
  for (const key of keys) {
    const tokenUserId = key.replace('wait:', '');
    if (tokenUserId === userId) continue;
    
    const data = await redis.get(key);
    if (!data) continue;
    
    const waitData = JSON.parse(data);
    
    if (waitData.gender && waitData.gender !== targetGender) continue;
    
    const distance = calculateDistance(lat, lng, waitData.lat, waitData.lng);
    
    if (distance <= MATCH_RADIUS) {
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