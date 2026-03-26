# 部署到 Vercel 生产环境

## 第一步：准备代码

### 1.1 安装依赖
```bash
cd D:\temp\xiangme-deploy\vercel
npm install
```

### 1.2 测试本地运行
```bash
npm run dev
```

## 第二步：部署到 Vercel

### 2.1 登录 Vercel
```bash
npm i -g vercel
vercel login
```

### 2.2 部署
```bash
vercel --prod
```

### 2.3 配置环境变量

在 Vercel Dashboard 中设置：

1. 访问 https://vercel.com/dashboard
2. 进入你的项目
3. Settings → Environment Variables
4. 添加以下变量：

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
UPSTASH_REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
DEMO_MODE=false
ALIYUN_ACCESS_KEY_ID=LTAI...
ALIYUN_ACCESS_KEY_SECRET=...
ALIYUN_SMS_SIGN_NAME=想么
ALIYUN_SMS_TEMPLATE_CODE=SMS_...
```

5. 点击 Save → Redeploy

## 第三步：测试生产环境

```bash
# 替换为你的 Vercel 域名
API_URL=https://xiangme-backend-xxxxx.vercel.app

# 健康检查
curl $API_URL/api/health

# 发送验证码
curl -X POST $API_URL/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","gender":"MALE"}'

# 验证登录
curl -X POST $API_URL/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","otp":"收到的验证码"}'
```

## 第四步：配置自定义域名（可选）

1. Vercel Dashboard → Domains
2. Add Domain: `api.xiangme.com`
3. 按提示配置 DNS

## 第五步：更新 Android 项目

修改 `MatchingRepository.kt`:

```kotlin
// 生产环境
private const val BASE_URL = "https://你的vercel域名/api/"

// 或自定义域名
// private const val BASE_URL = "https://api.xiangme.com/api/"
```

## 完成！

你的后端现在运行在 Vercel 上，使用：
- Supabase 数据库存储用户数据
- Upstash Redis 存储配对状态
- 阿里云短信发送验证码

**费用：¥0/月** (在免费额度内)
