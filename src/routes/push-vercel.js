// 推送路由 - Vercel Serverless 版本

module.exports = async (req, res) => {
  const path = req.url.replace('/push', '');
  
  if (path === '/test' && req.method === 'POST') {
    return res.json({
      success: true,
      message: 'Push service ready (Firebase integration pending)'
    });
  }
  
  return res.status(404).json({ error: 'Not found' });
};