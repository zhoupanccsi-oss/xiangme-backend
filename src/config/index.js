// 配置文件 - 支持多环境

// 判断环境
const isDocker = process.env.DOCKER_ENV === 'true';
const isVercel = process.env.VERCEL === '1';

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL || (isDocker ? 'http://localhost:5432' : null);
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'dummy-key';

// 数据库配置 (Docker 直接用 PostgreSQL)
const databaseUrl = process.env.DATABASE_URL || 'postgresql://xiangme:xiangme123@localhost:5432/xiangme';

// Redis 配置
const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';

// Firebase 配置 (可选)
const firebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : null;
const firebaseServerKey = process.env.FIREBASE_SERVER_KEY;

// 演示模式
const DEMO_MODE = process.env.DEMO_MODE !== 'false';
const DEMO_OTP = '888888';

// 阿里云短信配置
const ALIYUN = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  signName: process.env.ALIYUN_SMS_SIGN_NAME || '想么',
  templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE
};

// 配对配置
const MATCH_TIMEOUT = 60; // 秒
const MATCH_RADIUS_METERS = 3000; // 3公里

// 端口
const PORT = process.env.PORT || 8080;

module.exports = {
  isDocker,
  isVercel,
  supabaseUrl,
  supabaseKey,
  databaseUrl,
  redisUrl,
  firebaseConfig,
  firebaseServerKey,
  DEMO_MODE,
  DEMO_OTP,
  ALIYUN,
  MATCH_TIMEOUT,
  MATCH_RADIUS_METERS,
  PORT
};