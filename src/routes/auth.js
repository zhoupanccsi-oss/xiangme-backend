// 认证路由
const { v4: uuidv4 } = require('uuid');
const { DEMO_MODE, DEMO_OTP } = require('../config');
const { createUser, getUserByPhone, upsertDevice } = require('../services/supabase');
const { setUserGender } = require('../services/redis');

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
      await setUserGender(fullPhone, gender);
    }
    
    // 演示模式
    if (DEMO_MODE) {
      return res.json({
        success: true,
        message: '验证码已发送（演示模式）',
        demo: true
      });
    }
    
    // TODO: 生产模式调用短信服务
    
    return res.json({
      success: true,
      message: '验证码已发送'
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
    
    // 演示模式验证
    if (DEMO_MODE && otp !== DEMO_OTP) {
      return res.status(401).json({ error: '验证码错误' });
    }
    
    // 查找或创建用户
    let user = await getUserByPhone(fullPhone);
    
    if (!user) {
      // 新用户
      const userGender = gender || await getUserGender(fullPhone) || 'MALE';
      user = await createUser(fullPhone, userGender);
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
    
    const device = await upsertDevice(
      userId,
      deviceType,
      deviceId,
      pushToken,
      pushType,
      appVersion,
      osVersion
    );
    
    return res.json({
      success: true,
      deviceId: device.id
    });
    
  } catch (error) {
    console.error('Register device error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}