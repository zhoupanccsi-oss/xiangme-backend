// 推送路由
module.exports = async (req, res) => {
  const path = req.url.replace('/push', '');
  
  if (path === '/test' && req.method === 'POST') {
    return testPush(req, res);
  }
  
  return res.status(404).json({ error: 'Not found' });
};

async function testPush(req, res) {
  // 测试推送接口
  return res.json({
    success: true,
    message: 'Push service ready (Firebase integration pending)'
  });
}