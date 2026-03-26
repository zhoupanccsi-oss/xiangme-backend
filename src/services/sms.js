// 阿里云短信服务
const { ALIYUN, DEMO_MODE } = require('../config');

// 演示模式：直接返回成功
async function sendOTP(phone, code) {
  if (DEMO_MODE) {
    console.log(`[DEMO] SMS to ${phone}: ${code}`);
    return { success: true, demo: true };
  }

  // 生产模式：调用阿里云短信
  if (!ALIYUN.accessKeyId || !ALIYUN.accessKeySecret) {
    throw new Error('阿里云短信配置未设置');
  }

  try {
    // 这里使用阿里云 SDK 发送短信
    // 需要安装 @alicloud/sms-sdk
    const result = await sendAliyunSMS(phone, code);
    return { success: true, result };
  } catch (error) {
    console.error('SMS send failed:', error);
    throw error;
  }
}

// 阿里云短信发送实现
async function sendAliyunSMS(phone, code) {
  // 实际实现需要安装 @alicloud/sms-sdk
  // 示例代码：
  /*
  const SMSClient = require('@alicloud/sms-sdk');
  const smsClient = new SMSClient({
    accessKeyId: ALIYUN.accessKeyId,
    secretAccessKey: ALIYUN.accessKeySecret
  });
  
  return await smsClient.sendSMS({
    PhoneNumbers: phone,
    SignName: ALIYUN.signName,
    TemplateCode: ALIYUN.templateCode,
    TemplateParam: JSON.stringify({ code })
  });
  */
  
  // 临时返回模拟结果
  console.log(`[PROD] Would send SMS to ${phone}: ${code}`);
  return { MessageId: 'mock-message-id' };
}

module.exports = {
  sendOTP
};