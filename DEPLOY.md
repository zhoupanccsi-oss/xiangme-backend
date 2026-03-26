# Vercel 部署指南

## 第一步：安装 Vercel CLI

```bash
npm i -g vercel
```

## 第二步：登录 Vercel

```bash
vercel login
```

按提示完成 GitHub 授权。

## 第三步：配置环境变量

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的配置：
```env
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
UPSTASH_REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
DEMO_MODE=true
```

## 第四步：本地测试

```bash
vercel dev
```

访问 http://localhost:3000/api/health 测试。

## 第五步：部署到生产

```bash
vercel --prod
```

部署完成后会获得一个域名：
```
https://xiangme-backend-xxxxx.vercel.app
```

## 第六步：配置环境变量（Vercel Dashboard）

1. 访问 https://vercel.com/dashboard
2. 进入你的项目
3. 点击 "Settings" → "Environment Variables"
4. 添加以下变量：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `UPSTASH_REDIS_URL`
   - `DEMO_MODE`

5. 点击 "Save" 并重新部署

## 第七步：测试 API

```bash
# 健康检查
curl https://your-domain.vercel.app/api/health

# 发送验证码
curl -X POST https://your-domain.vercel.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","gender":"MALE"}'

# 验证登录
curl -X POST https://your-domain.vercel.app/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","otp":"888888"}'
```

## 自定义域名（可选）

1. Vercel Dashboard → Domains
2. 添加你的域名
3. 按提示配置 DNS

## 免费额度

| 资源 | 免费额度 | 你的用量 |
|------|----------|----------|
| 函数调用 | 100万次/月 | ~1万 ✅ |
| 带宽 | 100GB/月 | ~1GB ✅ |
| 构建时间 | 6000分钟/月 | ~10分钟 ✅ |

---

**下一步**: 配置 Firebase 推送
