// 想么后端 - 稳定版
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');
const { v4: uuidv4 } = require('uuid');

// 环境变量检查
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// 初始化（带错误处理）
let supabase = null;
let redis = null;

try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error('Supabase init error:', e.message);
}

try {
  if (REDIS_URL) {
    redis = new Redis({ url: REDIS_URL });
  }
} catch (e) {
  console.error('Redis init error:', e.message);
}

// 内存备用
const memoryStore = new Map();

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
        version: '1.0.0',
        demo_mode: DEMO_MODE,
        supabase_connected: !!supabase,
        redis_connected: !!redis,
        timestamp: new Date().toISOString()
      });
    }
    
    // 发送验证码
    if (path === '/api/auth/send-otp' && req.method === 'POST') {
      const { phone, gender } = req.body || {};
      
      if (!phone) {
        return res.status(400).json({ error: '手机号不能为空' });
      }
      
      const fullPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      const code = DEMO_MODE ? '888888' : Math.random().toString().slice(2, 8);
      
      // 保存到内存或 Redis
      memoryStore.set(`otp:${fullPhone}`, { code, time: Date.now() });
      if (redis) {
        try {
          await redis.setex(`otp:${fullPhone}`, 300, code);
        } catch (e) {
          console.error('Redis set error:', e.message);
        }
      }
      
      return res.json({
        success: true,
        message: DEMO_MODE ? '验证码已发送（演示模式: 888888）' : '验证码已发送',
        demo: DEMO_MODE
      });
    }
    
    // 验证登录
    if (path === '/api/auth/verify-otp' && req.method === 'POST') {
      const { phone, otp } = req.body || {};
      
      if (!phone || !otp) {
        return res.status(400).json({ error: '手机号和验证码不能为空' });
      }
      
      const fullPhone = phone.startsWith('+') ? phone : `+86${phone}`;
      
      // 验证
      let valid = false;
      if (DEMO_MODE && otp === '888888') {
        valid = true;
      } else {
        const saved = memoryStore.get(`otp:${fullPhone}`);
        if (saved && saved.code === otp) {
          valid = true;
          memoryStore.delete(`otp:${fullPhone}`);
        }
      }
      
      if (!valid) {
        return res.status(401).json({ error: '验证码错误' });
      }
      
      // 创建用户（简化版）
      const userId = uuidv4();
      
      return res.json({
        success: true,
        userId: userId,
        token: uuidv4(),
        phone: fullPhone
      });
    }
    
    // 发送配对信号
    if (path === '/api/match/signal' && req.method === 'POST') {
      const { userId, phone, latitude, longitude } = req.body || {};
      
      if (!userId || !phone) {
        return res.status(400).json({ error: '缺少必要参数' });
      }
      
      const waitToken = uuidv4();
      
      // 保存到内存
      memoryStore.set(`wait:${userId}`, {
        phone,
        lat: latitude,
        lng: longitude,
        time: Date.now(),
        waitToken
      });
      
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
      
      // 简化：直接返回未匹配
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