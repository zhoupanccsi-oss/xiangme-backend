// Supabase 客户端
const { createClient } = require('@supabase/supabase-js');
const { supabaseUrl, supabaseKey } = require('../config');

let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 用户相关操作
async function createUser(phone, gender) {
  const { data, error } = await getSupabase()
    .from('users')
    .insert([{ phone, gender }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function getUserByPhone(phone) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// 设备相关操作
async function upsertDevice(userId, deviceType, deviceId, pushToken, pushType, appVersion, osVersion) {
  const { data, error } = await getSupabase()
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
  return data;
}

// 配对记录
async function createMatch(userAId, userBId, userADevice, userBDevice, distance) {
  const { data, error } = await getSupabase()
    .from('matches')
    .insert([{
      user_a_id: userAId < userBId ? userAId : userBId,
      user_b_id: userAId < userBId ? userBId : userAId,
      user_a_device: userAId < userBId ? userADevice : userBDevice,
      user_b_device: userAId < userBId ? userBDevice : userADevice,
      distance_meters: distance
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

module.exports = {
  getSupabase,
  createUser,
  getUserByPhone,
  upsertDevice,
  createMatch
};