// Vercel Serverless Functions - 想么后端主入口
const authRoutes = require('../src/routes/auth-vercel');
const matchRoutes = require('../src/routes/match-vercel');
const pushRoutes = require('../src/routes/push-vercel');

module.exports = async (req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 路由分发
  const path = req.url.replace('/api', '');
  
  try {
    if (path.startsWith('/auth')) {
      return await authRoutes(req, res);
    }
    if (path.startsWith('/match')) {
      return await matchRoutes(req, res);
    }
    if (path.startsWith('/push')) {
      return await pushRoutes(req, res);
    }
    
    // 健康检查
    if (path === '/health' || path === '/') {
      return res.json({
        status: 'ok',
        service: 'xiangme-backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};