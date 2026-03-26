// 认证路由 - Vercel Serverless 版本
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');
const { DEMO_MODE, DEMO_OTP, SUPABASE_URL, SUPABASE_SERVICE_KEY, UPSTASH_REDIS_URL, ALIYUN } = require('../config');

// 初始化客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const redis = new Redis({ url: UPSTASH_REDIS_URL });

module.exports = async (req, res) => {
  const path = req.url.replace('/auth', '');
  
  if (path === '/send-otp' && req.method === 'POST') {
    return sendOtp(req, res);
  }
  
  if (path === '/verify-otp' && req.method === 'POST') {
    return verifyOtp(req, res);
  }
  
  if (path === '/register-device' && req.method === 'POST') {
    return registerDevice(req, res);
  }
  
  return res.status(404).json({ error: 'Not found' });
};

async function sendOtp(req, res) {
  try {
    const { phone, countryCode = '86', gender } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: '手机号不能为空' });
    }
    
    const fullPhone = `+${countryCode}${phone}`;
    
    // 保存性别
    if (gender) {
      await redis.setex(`user:gender:${fullPhone}`, 86400 * 30, gender);
    }
    
    // 生成验证码
    const code = DEMO_MODE ? DEMO_OTP : Math.random().toString().slice(2, 8);
    
    // 保存验证码到 Redis (5分钟有效)
    await redis.setex(`otp:${fullPhone}`, 300, code);
    
    // 发送短信（生产模式）
    if (!DEMO_MODE) {
      // 这里调用阿里云短信
      console.log(`[SMS] Sending ${code} to ${fullPhone}`);
    }
    
    return res.json({
      success: true,
      message: DEMO_MODE ? '验证码已发送（演示模式: 888888）' : '验证码已发送',
      demo: DEMO_MODE
    });
    
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}

async function verifyOtp(req, res) {
  try {
    const { phone, countryCode = '86', otp, gender } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: '手机号和验证码不能为空' });
    }
    
    const fullPhone = `+${countryCode}${phone}`;
    
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
      // 验证成功后删除验证码
      await redis.del(`otp:${fullPhone}`);
    }
    
    // 查找或创建用户
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', fullPhone)
      .single();
    
    if (!user) {
      // 新用户
      const userGender = gender || await redis.get(`user:gender:${fullPhone}`) || 'MALE';
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ phone: fullPhone, gender: userGender }])
        .select()
        .single();
      
      if (error) throw error;
      user = newUser;
    }
    
    // 生成 Token
    const token = uuidv4();
    
    return res.json({
      success: true,
      userId: user.id,
      token,
      phone: fullPhone
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}

async function registerDevice(req, res) {
  try {
    const { userId, deviceType, deviceId, pushToken, pushType, appVersion, osVersion } = req.body;
    
    if (!userId || !deviceType || !deviceId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const { data: device, error } = await supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_type: deviceType,
        device_id: deviceId,
        push_token: pushToken,
        push_type: pushType,
        app_version: appVersion,
        os_version: osVersion,
        last_active: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'user_id,device_type,device_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return res.json({
      success: true,
      deviceId: device.id
    });
    
  } catch (error) {
    console.error('Register device error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}