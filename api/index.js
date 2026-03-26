// 想么后端 - 简化版
module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const path = req.url;
  
  // 健康检查
  if (path === '/api/health' || path === '/') {
    return res.json({
      status: 'ok',
      service: 'xiangme-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  }
  
  // 发送验证码
  if (path === '/api/auth/send-otp' && req.method === 'POST') {
    return res.json({
      success: true,
      message: '验证码已发送（演示模式: 888888）',
      demo: true
    });
  }
  
  // 验证登录
  if (path === '/api/auth/verify-otp' && req.method === 'POST') {
    return res.json({
      success: true,
      userId: 'demo-user-id',
      token: 'demo-token',
      phone: '+8613800138000'
    });
  }
  
  // 发送配对信号
  if (path === '/api/match/signal' && req.method === 'POST') {
    return res.json({
      success: true,
      matched: false,
      waitToken: 'demo-wait-token',
      timeout: 60
    });
  }
  
  // 查询配对结果
  if (path.startsWith('/api/match/result/') && req.method === 'GET') {
    return res.json({
      matched: false,
      message: '等待配对中...'
    });
  }
  
  return res.status(404).json({ error: 'Not found' });
};