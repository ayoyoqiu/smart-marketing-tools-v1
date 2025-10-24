import express from 'express';
import axios from 'axios';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// === 定时任务调度相关 ===
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';

// ES模块中获取__dirname的替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 增强CORS支持，允许所有来源和常用头
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-user-id'); // 🎭 添加x-user-id
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(cors());
app.use(express.json());

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// 本地文件服务（用于图片上传备选方案）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 配置 multer 以支持中文文件名
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // 修复中文文件名编码问题
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, true);
  }
});

// 图片压缩函数
async function compressImage(buffer) {
  try {
    console.log('开始压缩图片...');
    console.log('原始图片大小:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
    
    // 使用sharp压缩图片
    const compressedBuffer = await sharp(buffer)
      .resize(2048, 2048, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 80,
        progressive: true 
      })
      .toBuffer();
    
    console.log('压缩后图片大小:', (compressedBuffer.length / 1024 / 1024).toFixed(2), 'MB');
    
    // 如果压缩后仍然超过1MB，进一步压缩
    if (compressedBuffer.length > 1 * 1024 * 1024) {
      console.log('图片仍然超过1MB，进一步压缩...');
      const furtherCompressed = await sharp(compressedBuffer)
        .resize(1024, 1024, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality: 60,
          progressive: true 
        })
        .toBuffer();
      
      console.log('进一步压缩后大小:', (furtherCompressed.length / 1024 / 1024).toFixed(2), 'MB');
      
      if (furtherCompressed.length > 1 * 1024 * 1024) {
        console.log('图片仍然超过1MB，最终压缩...');
        const finalCompressed = await sharp(furtherCompressed)
          .jpeg({ 
            quality: 40,
            progressive: true 
          })
          .toBuffer();
        
        console.log('最终压缩后大小:', (finalCompressed.length / 1024 / 1024).toFixed(2), 'MB');
        
        if (finalCompressed.length > 1 * 1024 * 1024) {
          throw new Error('图片无法压缩到1MB以内');
        }
        
        return finalCompressed;
      }
      
      return furtherCompressed;
    }
    
    return compressedBuffer;
  } catch (error) {
    console.error('图片压缩失败:', error);
    throw error;
  }
}

// Supabase 配置（请根据实际情况填写）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ezhbqeapgutzstdaohit.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aGJxZWFwZ3V0enN0ZGFvaGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2ODIzMTksImV4cCI6MjA3MTI1ODMxOX0.RyhROz_TL247GsEJtj86RdvDNPPLz6UX6Hep49p7DqE';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aGJxZWFwZ3V0enN0ZGFvaGl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY4MjMxOSwiZXhwIjoyMDcxMjU4MzE5fQ.pMLHWW2m1lCKeqOBQVS-2Zgk9-3f-Oz0';

// 使用匿名key，但通过后端API绕过RLS限制
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES = {
  TASKS: 'tasks',
  WEBHOOKS: 'webhooks',
};

// 定时任务调度（每分钟执行一次）
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString();
    // 查询所有待执行的定时任务（只查询已经到时间且未过期的任务）
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24小时前
    
    const { data: tasks, error } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', now)  // 查询已经到时间的任务
      .gte('scheduled_time', oneDayAgo)  // 过滤掉过期超过24小时的任务
      .order('scheduled_time', { ascending: true });  // 按时间排序，优先执行早的任务
    if (error) {
      console.error('定时任务查询失败:', error);
      return;
    }
    if (!tasks || tasks.length === 0) return;
    console.log(`\n[定时调度] 待执行任务数: ${tasks.length}`);
    for (const task of tasks) {
      try {
        // 🎭 检查任务创建者的角色，游客用户的任务不执行
        const { data: taskUser, error: taskUserError } = await supabase
          .from('users')
          .select('role, nickname')
          .eq('id', task.user_id)
          .single();
        
        if (taskUserError || !taskUser) {
          console.log(`⚠️ [定时调度] 任务${task.id} 用户验证失败，跳过执行`);
          continue;
        }
        
        if (taskUser.role === 'guest') {
          console.log(`🚫 [定时调度] 任务${task.id} 的创建者是游客用户（${taskUser.nickname}），跳过执行`);
          // 更新任务状态为待审核
          const { error: updateError } = await supabase
            .from(TABLES.TASKS)
            .update({ 
              status: 'failed',
              error_message: '游客用户创建的任务需要升级为普通用户后才能执行',
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id);
          
          if (updateError) {
            console.error(`[定时调度] 任务${task.id} 状态更新失败:`, updateError);
          }
          continue; // 跳过这个任务
        }
        
        console.log(`✅ [定时调度] 任务${task.id} 用户角色验证通过:`, { role: taskUser.role, nickname: taskUser.nickname });
        
        // 获取所有启用的webhook地址（分组过滤 + 用户隔离）
        let webhooks = [];
        if (task.group_category && task.group_category !== 'all' && Array.isArray(task.group_category) && task.group_category.length > 0) {
          // 修复：正确处理group_category数组字段
          console.log(`[定时调度] 任务${task.id} 分组过滤:`, task.group_category);
          
          // 如果选择了特定分组，查询对应分组的webhook
          const { data: ws, error: werr } = await supabase
            .from(TABLES.WEBHOOKS)
            .select('webhook_url')
            .eq('status', 'active')
            .in('group_id', task.group_category)  // 修复：使用in查询数组字段
            .eq('user_id', task.user_id); // 添加用户ID过滤
          
          if (!werr && ws) {
            webhooks = ws.map(w => w.webhook_url);
            console.log(`[定时调度] 任务${task.id} 分组查询结果:`, webhooks.length, '个webhook');
          } else if (werr) {
            console.error(`[定时调度] 任务${task.id} 分组查询失败:`, werr);
          }
        } else {
          // 选择全部或没有分组，返回用户的所有webhook
          console.log(`[定时调度] 任务${task.id} 选择全部webhook`);
          const { data: ws, error: werr } = await supabase
            .from(TABLES.WEBHOOKS)
            .select('webhook_url')
            .eq('status', 'active')
            .eq('user_id', task.user_id); // 添加用户ID过滤
          
          if (!werr && ws) {
            webhooks = ws.map(w => w.webhook_url);
            console.log(`[定时调度] 任务${task.id} 全部查询结果:`, webhooks.length, '个webhook');
          } else if (werr) {
            console.error(`[定时调度] 任务${task.id} 全部查询失败:`, werr);
          }
        }
        if (!webhooks.length) {
          console.log(`[定时调度] 任务${task.id} 未找到可用webhook，跳过`);
          const { error: updateError } = await supabase
            .from(TABLES.TASKS)
            .update({ 
              status: 'failed', 
              error_message: '无可用webhook',
              updated_at: new Date().toISOString()
            })
            .eq('id', task.id);
          
          if (updateError) {
            console.error(`[定时调度] 任务${task.id} webhook状态更新失败:`, updateError);
          }
          continue;
        }
        
        // 添加调试日志
        console.log(`[定时调度] 任务${task.id} 查询到webhook:`, {
          taskId: task.id,
          userId: task.user_id,
          groupCategory: task.group_category,
          webhookCount: webhooks.length,
          webhooks: webhooks
        });
        let sendSuccess = true;
        let errorMsg = '';
        // 按 type 区分推送内容
        if (task.type === 'card') {
          // 卡片消息
          const article = {
            title: task.content.title,
            url: task.content.url
          };
          if (task.content.description) article.description = task.content.description;
          if (task.content.picurl) article.picurl = task.content.picurl;
          const news = { articles: [article] };
          for (const webhook of webhooks) {
            try {
              const res = await axios.post(webhook, {
                msgtype: 'news',
                news
              }, {
                timeout: 30000, // 30秒超时
                headers: { 'Content-Type': 'application/json' }
              });
              if (!res.data || res.data.errcode !== 0) {
                sendSuccess = false;
                errorMsg = res.data?.errmsg || '未知错误';
                console.log(`[定时调度] 卡片推送失败:`, res.data);
              } else {
                console.log(`[定时调度] 卡片推送成功:`, res.data);
              }
            } catch (e) {
              sendSuccess = false;
              if (e.code === 'ECONNABORTED') {
                errorMsg = '网络超时';
              } else if (e.response) {
                errorMsg = `HTTP ${e.response.status}: ${e.response.data?.errmsg || e.message}`;
              } else if (e.request) {
                errorMsg = '网络连接失败';
              } else {
                errorMsg = e.message;
              }
              console.log(`[定时调度] 卡片推送异常:`, errorMsg);
            }
          }
        } else if (task.type === 'rich_text') {
          // 富文本消息（Markdown格式）
          let richText = task.content.richText || '';
          
          if (richText && richText.trim()) {
            for (const webhook of webhooks) {
              try {
                const res = await axios.post(webhook, {
                  msgtype: 'markdown',
                  markdown: { content: richText.trim() }
                }, {
                  timeout: 30000, // 30秒超时
                  headers: { 'Content-Type': 'application/json' }
                });
                if (!res.data || res.data.errcode !== 0) {
                  sendSuccess = false;
                  errorMsg = res.data?.errmsg || '富文本推送失败';
                  console.log(`[定时调度] 富文本推送失败:`, res.data);
                } else {
                  console.log(`[定时调度] 富文本推送成功:`, res.data);
                }
              } catch (e) {
                sendSuccess = false;
                if (e.code === 'ECONNABORTED') {
                  errorMsg = '网络超时';
                } else if (e.response) {
                  errorMsg = `HTTP ${e.response.status}: ${e.response.data?.errmsg || e.message}`;
                } else if (e.request) {
                  errorMsg = '网络连接失败';
                } else {
                  errorMsg = e.message;
                }
                console.log(`[定时调度] 富文本推送异常:`, errorMsg);
              }
            }
          }
        } else if (task.type === 'text_image') {
          // 图文消息 - 支持富文本和图片（与立即发送逻辑保持一致）
          let text = task.content.text || '';
          let images = task.content.images || '';
          
          console.log(`[定时调度] 处理图文消息:`, { 
            textLength: text?.length, 
            imagesLength: images?.length,
            textPreview: text?.substring(0, 100),
            imagesType: typeof images,
            contentKeys: Object.keys(task.content || {}),
            hasImageField: !!task.content.image,
            imageBase64Length: task.content.image?.base64?.length || 0
          });
          
          // 先发送富文本内容（与立即发送逻辑一致）
          if (text && text.trim()) {
            console.log(`[定时调度] 开始发送富文本内容`);
            
            for (const webhook of webhooks) {
              try {
                // 使用与立即发送相同的API调用方式
                const res = await axios.post(webhook, {
                  msgtype: 'text',
                  text: { content: text.trim() }
                }, {
                  timeout: 30000,
                  headers: { 'Content-Type': 'application/json' }
                });
                
                if (!res.data || res.data.errcode !== 0) {
                  sendSuccess = false;
                  errorMsg = res.data?.errmsg || '富文本推送失败';
                  console.log(`[定时调度] 富文本推送失败:`, res.data);
                } else {
                  console.log(`[定时调度] 富文本推送成功:`, res.data);
                }
              } catch (e) {
                sendSuccess = false;
                if (e.code === 'ECONNABORTED') {
                  errorMsg = '网络超时';
                } else if (e.response) {
                  errorMsg = `HTTP ${e.response.status}: ${e.response.data?.errmsg || e.message}`;
                } else if (e.request) {
                  errorMsg = '网络连接失败';
                } else {
                  errorMsg = e.message;
                }
                console.log(`[定时调度] 富文本推送异常:`, errorMsg);
              }
            }
          }
          
          // 再发送图片
          if (images && images.trim()) {
            console.log(`[定时调度] 开始处理图片数据:`, { imagesType: typeof images, imagesLength: images.length });
            
            // 检查是否是base64格式的图片数据
            const isBase64Image = images.length > 100 && !images.includes('http') && !images.includes('\\n');
            
            if (isBase64Image) {
              // 直接使用base64数据
              console.log(`[定时调度] 检测到base64图片数据，长度: ${images.length}`);
              try {
                // 转换为Buffer
                const imageBuffer = Buffer.from(images, 'base64');
                console.log(`[定时调度] base64图片转换成功，大小: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                
                // 压缩图片
                let processedBuffer = imageBuffer;
                if (imageBuffer.length > 1024 * 1024) { // 超过1MB
                  console.log(`[定时调度] 图片超过1MB，开始压缩...`);
                  processedBuffer = await compressImage(imageBuffer);
                  console.log(`[定时调度] 压缩完成，新大小: ${(processedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                }
                
                // 转换为base64
                const base64 = processedBuffer.toString('base64');
                const md5 = crypto.createHash('md5').update(processedBuffer).digest('hex');
                
                // 发送图片到所有webhook
                for (const webhook of webhooks) {
                  try {
                    const imageMsg = {
                      msgtype: 'image',
                      image: { base64, md5 }
                    };
                    
                    const res = await axios.post(webhook, imageMsg, {
                      timeout: 30000,
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!res.data || res.data.errcode !== 0) {
                      sendSuccess = false;
                      errorMsg = res.data?.errmsg || '图片发送失败';
                    }
                    console.log(`[定时调度] 图片推送结果:`, res.data);
                  } catch (e) {
                    sendSuccess = false;
                    errorMsg = e.response?.data?.error || e.message;
                    console.log(`[定时调度] 图片推送异常:`, errorMsg);
                  }
                }
              } catch (e) {
                sendSuccess = false;
                errorMsg = `base64图片处理失败: ${e.message}`;
                console.log(`[定时调度] base64图片处理异常:`, errorMsg);
              }
            } else {
              // 原有的URL图片处理逻辑
              const imageUrls = images.split('\n').map(url => url.trim()).filter(Boolean);
              console.log(`[定时调度] 准备发送 ${imageUrls.length} 张图片`);
              
              for (const imageUrl of imageUrls) {
                try {
                  // 下载图片
                  console.log(`[定时调度] 下载图片: ${imageUrl}`);
                  const imageResponse = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  
                  const imageBuffer = Buffer.from(imageResponse.data);
                  console.log(`[定时调度] 图片下载成功，大小: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                  
                  // 压缩图片
                  let processedBuffer = imageBuffer;
                  if (imageBuffer.length > 1024 * 1024) { // 超过1MB
                    console.log(`[定时调度] 图片超过1MB，开始压缩...`);
                    processedBuffer = await compressImage(imageBuffer);
                    console.log(`[定时调度] 压缩完成，新大小: ${(processedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                  }
                  
                  // 转换为base64
                  const base64 = processedBuffer.toString('base64');
                  const md5 = crypto.createHash('md5').update(processedBuffer).digest('hex');
                  
                  // 发送图片到所有webhook
                  for (const webhook of webhooks) {
                    try {
                      const imageMsg = {
                        msgtype: 'image',
                        image: { base64, md5 }
                      };
                      
                      const res = await axios.post(webhook, imageMsg, {
                        timeout: 30000,
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      if (!res.data || res.data.errcode !== 0) {
                        sendSuccess = false;
                        errorMsg = res.data?.errmsg || '图片发送失败';
                      }
                      console.log(`[定时调度] 图片推送结果:`, res.data);
                    } catch (e) {
                      sendSuccess = false;
                      errorMsg = e.response?.data?.error || e.message;
                      console.log(`[定时调度] 图片推送异常:`, errorMsg);
                    }
                  }
                } catch (e) {
                  sendSuccess = false;
                  errorMsg = `图片下载失败: ${e.message}`;
                  console.log(`[定时调度] 图片下载异常:`, errorMsg);
                }
              }
            }
          } else {
            console.log(`[定时调度] 没有图片数据需要发送`);
          }
        } else {
          // 其他类型消息
          let text = task.content.text || '';
          let images = task.content.images || '';
          
          // 先发送文本
          if (text && text.trim()) {
                      for (const webhook of webhooks) {
            try {
              const res = await axios.post(webhook, {
                msgtype: 'text',
                text: { content: text.trim() }
              }, {
                timeout: 30000, // 30秒超时
                headers: { 'Content-Type': 'application/json' }
              });
              if (!res.data || res.data.errcode !== 0) {
                sendSuccess = false;
                errorMsg = res.data?.errmsg || '文本发送失败';
                console.log(`[定时调度] 文本推送失败:`, res.data);
              } else {
                console.log(`[定时调度] 文本推送成功:`, res.data);
              }
            } catch (e) {
              sendSuccess = false;
              if (e.code === 'ECONNABORTED') {
                errorMsg = '网络超时';
              } else if (e.response) {
                errorMsg = `HTTP ${e.response.status}: ${e.response.data?.errmsg || e.message}`;
              } else if (e.request) {
                errorMsg = '网络连接失败';
              } else {
                errorMsg = e.message;
              }
              console.log(`[定时调度] 文本推送异常:`, errorMsg);
            }
          }
          }
          
          // 再发送图片
          if (images && images.trim()) {
            // 检查是否是base64格式的图片数据
            const isBase64Image = images.length > 100 && !images.includes('http') && !images.includes('\\n');
            
            if (isBase64Image) {
              // 直接使用base64数据
              console.log(`[定时调度] 检测到base64图片数据，长度: ${images.length}`);
              try {
                // 转换为Buffer
                const imageBuffer = Buffer.from(images, 'base64');
                console.log(`[定时调度] base64图片转换成功，大小: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                
                // 压缩图片
                let processedBuffer = imageBuffer;
                if (imageBuffer.length > 1024 * 1024) { // 超过1MB
                  console.log(`[定时调度] 图片超过1MB，开始压缩...`);
                  processedBuffer = await compressImage(imageBuffer);
                  console.log(`[定时调度] 压缩完成，新大小: ${(processedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                }
                
                // 转换为base64
                const base64 = processedBuffer.toString('base64');
                const md5 = crypto.createHash('md5').update(processedBuffer).digest('hex');
                
                // 发送图片到所有webhook
                for (const webhook of webhooks) {
                  try {
                    const imageMsg = {
                      msgtype: 'image',
                      image: { base64, md5 }
                    };
                    
                    const res = await axios.post(webhook, imageMsg, {
                      timeout: 30000,
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!res.data || res.data.errcode !== 0) {
                      sendSuccess = false;
                      errorMsg = res.data?.errmsg || '图片发送失败';
                    }
                    console.log(`[定时调度] 图片推送结果:`, res.data);
                  } catch (e) {
                    sendSuccess = false;
                    errorMsg = e.response?.data?.error || e.message;
                    console.log(`[定时调度] 图片推送异常:`, errorMsg);
                  }
                }
              } catch (e) {
                sendSuccess = false;
                errorMsg = `base64图片处理失败: ${e.message}`;
                console.log(`[定时调度] base64图片处理异常:`, errorMsg);
              }
            } else {
              // 原有的URL图片处理逻辑
              const imageUrls = images.split('\n').map(url => url.trim()).filter(Boolean);
              console.log(`[定时调度] 准备发送 ${imageUrls.length} 张图片`);
              
              for (const imageUrl of imageUrls) {
                try {
                  // 下载图片
                  console.log(`[定时调度] 下载图片: ${imageUrl}`);
                  const imageResponse = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                  });
                  
                  const imageBuffer = Buffer.from(imageResponse.data);
                  console.log(`[定时调度] 图片下载成功，大小: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                  
                  // 压缩图片
                  let processedBuffer = imageBuffer;
                  if (imageBuffer.length > 1024 * 1024) { // 超过1MB
                    console.log(`[定时调度] 图片超过1MB，开始压缩...`);
                    processedBuffer = await compressImage(imageBuffer);
                    console.log(`[定时调度] 压缩完成，新大小: ${(processedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
                  }
                  
                  // 转换为base64
                  const base64 = processedBuffer.toString('base64');
                  const md5 = crypto.createHash('md5').update(processedBuffer).digest('hex');
                  
                  // 发送图片到所有webhook
                  for (const webhook of webhooks) {
                    try {
                      const imageMsg = {
                        msgtype: 'image',
                        image: { base64, md5 }
                      };
                      
                      const res = await axios.post(webhook, imageMsg, {
                        timeout: 30000,
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      if (!res.data || res.data.errcode !== 0) {
                        sendSuccess = false;
                        errorMsg = res.data?.errmsg || '图片发送失败';
                      }
                      console.log(`[定时调度] 图片推送结果:`, res.data);
                    } catch (e) {
                      sendSuccess = false;
                      errorMsg = e.response?.data?.error || e.message;
                      console.log(`[定时调度] 图片推送异常:`, errorMsg);
                    }
                  }
                } catch (e) {
                  sendSuccess = false;
                  errorMsg = `图片处理失败: ${e.message}`;
                  console.log(`[定时调度] 图片处理异常:`, errorMsg);
                }
              }
            }
          }
        }
        // 更新任务状态
        const updateData = {
          status: sendSuccess ? 'completed' : 'failed',
          error_message: sendSuccess ? null : errorMsg,
          updated_at: new Date().toISOString()
        };
        
        console.log(`[定时调度] 任务${task.id} 推送结果:`, {
          sendSuccess,
          errorMsg,
          webhookCount: webhooks.length
        });
        
        const { error: updateError } = await supabase
          .from(TABLES.TASKS)
          .update(updateData)
          .eq('id', task.id);
        
        if (updateError) {
          console.error(`[定时调度] 任务${task.id} 状态更新失败:`, updateError);
        } else {
          console.log(`[定时调度] 任务${task.id} 状态已更新为: ${sendSuccess ? 'completed' : 'failed'}`);
        }

        // 记录消息历史（无论成功失败都记录）
        if (webhooks.length > 0) {
          try {
            // 获取webhook信息以填充必需字段
            let groupName = '默认分组';
            let botName = '默认机器人';
            let webhookId = null;
            
            try {
              const { data: webhookData, error: webhookError } = await supabase
                .from('webhooks')
                .select('id, name, group_name, description')
                .eq('webhook_url', webhooks[0])
                .eq('user_id', task.user_id)
                .single();
              
              if (!webhookError && webhookData) {
                groupName = webhookData.group_name || '默认分组';
                botName = webhookData.name || '默认机器人';
                webhookId = webhookData.id;
              }
            } catch (err) {
              console.log(`[定时调度] 任务${task.id} 获取webhook信息失败:`, err);
            }
            
            const historyData = {
              task_id: task.id,
              user_id: task.user_id,
              webhook_id: webhookId,
              task_name: task.title || null,
              group_name: groupName,
              bot_name: botName,
              message_type: task.message_type || 'text',
              content: JSON.stringify(task.content || {}),
              status: sendSuccess ? 'sent' : 'failed',
              error_message: sendSuccess ? null : errorMsg,
              created_at: new Date().toISOString()
            };
            
            const { error: historyError } = await supabase
              .from('message_history')
              .insert([historyData]);
            
            if (historyError) {
              console.error(`[定时调度] 任务${task.id} 历史记录失败:`, historyError);
            } else {
              console.log(`[定时调度] 任务${task.id} 历史记录已保存，状态: ${sendSuccess ? 'success' : 'failed'}`);
            }
          } catch (historyErr) {
            console.error(`[定时调度] 任务${task.id} 历史记录异常:`, historyErr);
          }
        }
      } catch (err) {
        console.error(`[定时调度] 任务${task.id} 执行异常:`, err);
        const { error: updateError } = await supabase
          .from(TABLES.TASKS)
          .update({ 
            status: 'failed', 
            error_message: err.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);
        
        if (updateError) {
          console.error(`[定时调度] 任务${task.id} 异常状态更新失败:`, updateError);
        }
      }
    }
  } catch (e) {
    console.error('[定时调度] 全局异常:', e);
  }
});

app.post('/api/wecom-webhook', upload.single('image'), async (req, res) => {
  try {
    // 改进参数获取，支持FormData和JSON
    let webhook, text, news, userId, taskId, taskName;
    
    if (req.file) {
      // 图片上传请求，从FormData获取参数
      webhook = req.body.webhook;
      text = req.body.text;
      news = req.body.news;
      userId = req.body.userId;
      taskId = req.body.taskId;
      taskName = req.body.taskName;
      console.log('📁 图片上传请求 - FormData参数解析:');
    } else {
      // 普通请求，从JSON body获取参数
      ({ webhook, text, news, userId, taskId, taskName } = req.body);
      console.log('📝 普通请求 - JSON参数解析:');
    }
    
    console.log('收到请求，webhook:', webhook, 'text:', text, 'news:', news, 'file:', !!req.file, 'userId:', userId, 'taskId:', taskId, 'taskName:', taskName);
    console.log('🔍 请求详情:', {
      hasFile: !!req.file,
      bodyKeys: Object.keys(req.body),
      bodyValues: req.body
    });

    if (!webhook) {
      console.log('缺少 webhook 参数');
      return res.status(400).json({ error: '缺少 webhook 参数' });
    }

    // 添加用户权限验证
    if (!userId) {
      console.log('缺少 userId 参数');
      return res.status(400).json({ error: '缺少 userId 参数' });
    }

    // 🎭 检查用户角色，游客用户无法发送消息
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, nickname')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.log('❌ 用户验证失败:', userError);
      return res.status(401).json({ error: '用户验证失败' });
    }
    
    console.log('🔍 用户角色检查:', { userId, role: userData.role, nickname: userData.nickname });
    
    if (userData.role === 'guest') {
      console.log('🚫 游客用户尝试发送消息被拒绝:', { userId, nickname: userData.nickname });
      return res.status(403).json({ 
        error: '游客用户无法发送消息',
        message: '请联系管理员升级为普通用户后再发送消息',
        userRole: 'guest'
      });
    }

    // 验证webhook是否属于该用户
    console.log('🔍 开始权限验证:', { webhook, userId });
    
    // 先查询webhook是否存在
    const { data: webhookList, error: webhookListError } = await supabase
      .from('webhooks')
      .select('id, webhook_url, user_id, status')
      .eq('webhook_url', webhook);
    
    console.log('🔍 Webhook查询结果:', { webhookList, webhookListError });
    
    if (webhookListError) {
      console.log('❌ Webhook查询失败:', webhookListError);
      return res.status(500).json({ error: 'Webhook查询失败' });
    }
    
    if (!webhookList || webhookList.length === 0) {
      console.log('❌ Webhook不存在:', webhook);
      return res.status(403).json({ error: 'Webhook不存在' });
    }
    
    // 查找匹配的webhook
    const webhookData = webhookList.find(w => 
      w.webhook_url === webhook && 
      w.user_id === userId && 
      w.status === 'active'
    );
    
    console.log('🔍 权限验证结果:', { webhookData, webhookList });

    if (!webhookData) {
      console.log('❌ webhook权限验证失败: webhook不存在、不属于该用户或状态不是active');
      console.log('🔍 验证参数:', { webhook, userId, webhookList });
      return res.status(403).json({ error: 'webhook权限验证失败' });
    }

    console.log('webhook权限验证通过，用户ID:', userId, 'webhook ID:', webhookData.id);

        // 图片推送
    if (req.file) {
      console.log('收到图片，准备推送');
      const buffer = req.file.buffer;
      
      // 检查原始图片大小
      const originalSize = buffer.length / 1024 / 1024; // MB
      console.log('原始图片大小:', originalSize.toFixed(2), 'MB');
      
      if (originalSize > 10) {
        console.log('图片超过10MB，拒绝处理');
        return res.status(400).json({ error: '图片太大，无法处理（超过10MB）' });
      }
      
      let processedBuffer = buffer;
      
    // 如果图片超过1MB，进行压缩（企业微信建议图片小于1MB）
    if (originalSize > 1) {
      try {
        console.log('图片超过1MB，开始压缩...');
        processedBuffer = await compressImage(buffer);
        console.log('压缩完成，新大小:', (processedBuffer.length / 1024 / 1024).toFixed(2), 'MB');
        
        // 检查压缩后的图片是否仍然太大
        if (processedBuffer.length > 1024 * 1024) {
          console.log('压缩后图片仍然超过1MB，尝试进一步压缩...');
          processedBuffer = await sharp(processedBuffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 50, progressive: true })
            .toBuffer();
          console.log('进一步压缩后大小:', (processedBuffer.length / 1024 / 1024).toFixed(2), 'MB');
        }
      } catch (error) {
        console.error('图片压缩失败:', error);
        return res.status(400).json({ error: '图片压缩失败: ' + error.message });
      }
    } else {
      // 如果不需要压缩，直接使用原始buffer
      processedBuffer = buffer;
    }
      
      const base64 = processedBuffer.toString('base64');
      const md5 = crypto.createHash('md5').update(processedBuffer).digest('hex');
      
      const imageMsg = {
        msgtype: 'image',
        image: { base64, md5 }
      };
      
      try {
        console.log('准备推送图片到企业微信，图片大小:', (processedBuffer.length / 1024 / 1024).toFixed(2), 'MB');
        console.log('图片MD5:', md5);
        console.log('推送的图片消息结构:', JSON.stringify(imageMsg, null, 2));
        
        const result = await axios.post(webhook, imageMsg, {
          timeout: 30000, // 30秒超时
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('图片推送结果:', result.data);
        
        // 保存消息历史记录
        if (result.data && result.data.errcode === 0) {
          try {
            // 获取webhook信息以填充必需字段
            const { data: webhookData, error: webhookError } = await supabase
              .from('webhooks')
              .select('id, name, description')
              .eq('webhook_url', webhook)
              .eq('user_id', userId)
              .single();
            
            const historyData = {
              user_id: userId,
              webhook_id: webhookData?.id || null,
              task_id: taskId || null,
              task_name: taskName || null,
              group_name: webhookData?.name || '默认分组',
              bot_name: webhookData?.description || '默认机器人',
              message_type: 'image',
              content: JSON.stringify({ 
                imageSize: (processedBuffer.length / 1024 / 1024).toFixed(2) + ' MB',
                md5: md5
              }),
              status: 'sent',
              created_at: new Date().toISOString()
            };
            
            const { error: historyError } = await supabase
              .from('message_history')
              .insert([historyData]);
            
            if (historyError) {
              console.error('图片推送历史记录保存失败:', historyError);
            } else {
              console.log('图片推送历史记录已保存');
            }
          } catch (historyErr) {
            console.error('图片推送历史记录保存异常:', historyErr);
          }
        }
        
        return res.json(result.data);
      } catch (err) {
        console.error('图片推送失败:', err.message);
        console.error('图片推送失败详情:', err.response?.status, err.response?.statusText);
        console.error('图片推送失败响应:', err.response?.data);
        
        // 如果是企业微信API错误，返回具体错误信息
        if (err.response?.data?.errcode) {
          return res.status(400).json({ 
            error: '企业微信API错误', 
            errcode: err.response.data.errcode,
            errmsg: err.response.data.errmsg 
          });
        }
        
        return res.status(500).json({ error: '图片推送失败', detail: err.message });
      }
    }

    // 富文本推送（Markdown格式）
    if (req.body.type === 'rich_text' && typeof text === 'string' && text.trim()) {
      console.log('收到富文本，准备推送:', text);
      const markdownMsg = {
        msgtype: 'markdown',
        markdown: { content: text }
      };
      try {
        const result = await axios.post(webhook, markdownMsg);
        console.log('富文本推送结果:', result.data);
        
        // 保存消息历史记录
        if (result.data && result.data.errcode === 0) {
          try {
            // 获取webhook信息以填充必需字段
            const { data: webhookData, error: webhookError } = await supabase
              .from('webhooks')
              .select('id, name, description')
              .eq('webhook_url', webhook)
              .eq('user_id', userId)
              .single();
            
            const historyData = {
              user_id: userId,
              webhook_id: webhookData?.id || null,
              task_id: taskId || null,
              task_name: taskName || null,
              group_name: webhookData?.name || '默认分组',
              bot_name: webhookData?.description || '默认机器人',
              message_type: 'rich_text',
              content: JSON.stringify({ richText: text }),
              status: 'sent',
              created_at: new Date().toISOString()
            };
            
            const { error: historyError } = await supabase
              .from('message_history')
              .insert([historyData]);
            
            if (historyError) {
              console.error('富文本推送历史记录保存失败:', historyError);
            } else {
              console.log('富文本推送历史记录已保存');
            }
          } catch (historyErr) {
            console.error('富文本推送历史记录保存异常:', historyErr);
          }
        }
        
        return res.json(result.data);
      } catch (err) {
        console.error('富文本推送失败:', err.response?.data || err.message);
        return res.status(500).json({ error: '富文本推送失败', detail: err.response?.data || err.message });
      }
    }

    // 普通文本推送
    if (typeof text === 'string' && text.trim()) {
      console.log('收到文本，准备推送:', text);
      const textMsg = {
        msgtype: 'text',
        text: { content: text }
      };
      try {
        const result = await axios.post(webhook, textMsg);
        console.log('文本推送结果:', result.data);
        
        // 保存消息历史记录
        if (result.data && result.data.errcode === 0) {
          try {
            // 获取webhook信息以填充必需字段
            const { data: webhookData, error: webhookError } = await supabase
              .from('webhooks')
              .select('id, name, description')
              .eq('webhook_url', webhook)
              .eq('user_id', userId)
              .single();
            
            const historyData = {
              user_id: userId,
              webhook_id: webhookData?.id || null,
              task_id: taskId || null,
              task_name: taskName || null,
              group_name: webhookData?.name || '默认分组',
              bot_name: webhookData?.description || '默认机器人',
              message_type: 'text',
              content: JSON.stringify({ text }),
              status: 'sent',
              created_at: new Date().toISOString()
            };
            
            const { error: historyError } = await supabase
              .from('message_history')
              .insert([historyData]);
            
            if (historyError) {
              console.error('文本推送历史记录保存失败:', historyError);
            } else {
              console.log('文本推送历史记录已保存');
            }
          } catch (historyErr) {
            console.error('文本推送历史记录保存异常:', historyErr);
          }
        }
        
        return res.json(result.data);
      } catch (err) {
        console.error('文本推送失败:', err.response?.data || err.message);
        return res.status(500).json({ error: '文本推送失败', detail: err.response?.data || err.message });
      }
    }

    // 卡片推送
    if (news && news.articles && Array.isArray(news.articles) && news.articles.length > 0) {
      const article = news.articles[0];
      if (!article.title || !article.url) {
        console.log('卡片参数不完整');
        return res.status(400).json({ error: '卡片参数不完整，title和url为必填' });
      }
      console.log('收到卡片，准备推送:', news);
      const newsMsg = {
        msgtype: 'news',
        news
      };
      try {
        const result = await axios.post(webhook, newsMsg);
        console.log('卡片推送结果:', result.data);
        
        // 保存消息历史记录
        if (result.data && result.data.errcode === 0) {
          try {
            // 获取webhook信息以填充必需字段
            const { data: webhookData, error: webhookError } = await supabase
              .from('webhooks')
              .select('id, name, description')
              .eq('webhook_url', webhook)
              .eq('user_id', userId)
              .single();
            
            const historyData = {
              user_id: userId,
              webhook_id: webhookData?.id || null,
              task_id: taskId || null,
              task_name: taskName || null,
              group_name: webhookData?.name || '默认分组',
              bot_name: webhookData?.description || '默认机器人',
              message_type: 'card',
              content: JSON.stringify(news),
              status: 'sent',
              created_at: new Date().toISOString()
            };
            
            const { error: historyError } = await supabase
              .from('message_history')
              .insert([historyData]);
            
            if (historyError) {
              console.error('卡片推送历史记录保存失败:', historyError);
            } else {
              console.log('卡片推送历史记录已保存');
            }
          } catch (historyErr) {
            console.error('卡片推送历史记录保存异常:', historyErr);
          }
        }
        
        return res.json(result.data);
      } catch (err) {
        console.error('卡片推送失败:', err.response?.data || err.message);
        return res.status(500).json({ error: '卡片推送失败', detail: err.response?.data || err.message });
      }
    }

    console.log('缺少文本、图片或卡片');
    res.status(400).json({ error: '缺少文本、图片或卡片' });
  } catch (e) {
    console.error('后端捕获到错误:', e);
    res.status(500).json({ error: e.message, detail: e.response?.data });
  }
});

// ========================================
// 用户注册API
// ========================================

// 用户注册API（后端绕过RLS限制）
app.post('/api/register', async (req, res) => {
  try {
    const { nickname, password, email } = req.body;
    
    if (!nickname || !password || !email || !String(email).trim()) {
      return res.status(400).json({ error: '缺少必要参数：nickname、password、email 均为必填' });
    }

    console.log('🔐 用户注册请求:', { nickname, email: email || '未提供' });

    // 检查用户是否已存在
    console.log('🔍 检查用户是否存在:', nickname);
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('nickname', nickname)
      .limit(1);

    if (checkError) {
      console.error('❌ 检查用户存在性失败:', checkError);
      return res.status(500).json({ error: '检查用户失败', details: checkError.message });
    }
    
    console.log('✅ 用户存在性检查完成，结果:', existingUsers);

    if (existingUsers && existingUsers.length > 0) {
      console.log('❌ 用户已存在:', nickname);
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱唯一性
    const { data: existingEmails, error: emailCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (emailCheckError) {
      console.error('❌ 检查邮箱唯一性失败:', emailCheckError);
      return res.status(500).json({ error: '检查邮箱失败', details: emailCheckError.message });
    }

    if (existingEmails && existingEmails.length > 0) {
      console.log('❌ 邮箱已被使用:', email);
      return res.status(400).json({ error: '邮箱已被使用' });
    }

    // 创建用户记录
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          nickname,
          password_hash: Buffer.from(password).toString('base64'),
          email: email,
          status: 'active'
          // 🎭 role字段不设置，使用数据库默认值'guest'
        }
      ])
      .select()
      .single();

    if (userError) {
      console.error('❌ 创建用户记录失败:', userError);
      return res.status(500).json({ error: '创建用户失败' });
    }

    console.log('✅ 用户记录创建成功:', userData);

    // 创建用户角色记录
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([
        {
          user_id: userData.id,
          role: userData.role || 'guest', // 🎭 使用数据库返回的角色（默认guest）
          is_active: true
        }
      ]);

    if (roleError) {
      console.error('❌ 创建用户角色失败:', roleError);
      // 角色创建失败不影响注册成功
    } else {
      console.log('✅ 用户角色创建成功');
    }

    console.log('✅ 用户注册成功:', nickname);
    return res.json({ 
      success: true, 
      user: userData,
      message: '注册成功' 
    });

  } catch (error) {
    console.error('❌ 用户注册异常:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// ========================================
// 密码验证API
// ========================================

// 验证密码API（用于bcrypt哈希验证）
app.post('/api/verify-password', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    
    if (!nickname || !password) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    console.log('🔐 密码验证请求:', { nickname });

    // 查询用户
    const { data: users, error: queryError } = await supabase
      .from('users')
      .select('id, nickname, password_hash, role, status, email, created_at')
      .eq('nickname', nickname)
      .eq('status', 'active')
      .limit(1);

    if (queryError) {
      console.error('❌ 查询用户失败:', queryError);
      return res.status(500).json({ error: '查询用户失败' });
    }

    if (!users || users.length === 0) {
      console.log('❌ 用户不存在:', nickname);
      return res.json({ valid: false, reason: '用户不存在' });
    }

    const user = users[0];
    let isValid = false;

    // 1. 明文密码比较
    if (user.password_hash === password) {
      isValid = true;
    }
    // 2. base64编码密码比较
    else if (user.password_hash === Buffer.from(password).toString('base64')) {
      isValid = true;
    }
    // 3. base64解码比较
    else if (user.password_hash && Buffer.from(user.password_hash, 'base64').toString() === password) {
      isValid = true;
    }
    // 4. bcrypt哈希比较
    else if (user.password_hash && user.password_hash.startsWith('$2a$')) {
      try {
        const bcrypt = require('bcrypt');
        isValid = await bcrypt.compare(password, user.password_hash);
      } catch (bcryptError) {
        console.error('❌ bcrypt验证失败:', bcryptError);
        isValid = false;
      }
    }

    if (isValid) {
      console.log('✅ 密码验证成功:', nickname);
      return res.json({ valid: true, user });
    } else {
      console.log('❌ 密码验证失败:', nickname);
      return res.json({ valid: false, reason: '密码错误' });
    }

  } catch (error) {
    console.error('❌ 密码验证异常:', error);
    res.status(500).json({ error: '密码验证失败' });
  }
});

// ========================================
// AI聊天机器人API
// ========================================

// AI聊天接口
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { question, sessionId, userId } = req.body;
    
    if (!question || !sessionId || !userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    console.log('🤖 AI聊天请求:', { question, sessionId, userId });

    // 1. 搜索相关文档
    const { data: documents, error: docError } = await supabase
      .from('help_documents')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (docError) {
      console.error('❌ 获取帮助文档失败:', docError);
      throw docError;
    }

    // 2. 构建上下文
    const context = documents
      .map(doc => `${doc.title}:\n${doc.content}`)
      .join('\n\n');

    // 3. 构建AI提示词
    const systemPrompt = `你是一个专业的网站功能助手，专门帮助用户解答关于智能营销小工具的问题。

网站功能包括：
- 任务管理：创建、编辑、删除定时任务
- 地址管理：管理Webhook地址和分组
- 分组管理：创建和管理用户分组
- 消息推送：支持文本、图片、图文、卡片等多种消息类型

请基于以下文档内容回答用户问题，如果问题与网站功能无关，请礼貌地告知用户你只能回答网站功能相关问题。

重要：请直接回答用户问题，不要提及"基于文档"、"引用信息"等字样，也不要显示文档标题。

文档内容：
${context}

用户问题：${question}

请用简洁明了的中文回答，如果涉及操作步骤，请用数字列表格式。`;

    // 4. 调用DeepSeek API
    const startTime = Date.now();
    const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: question
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer sk-3515b211287a4c9eb9cbb66af6633a1d`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    const answer = deepseekResponse.data.choices[0].message.content;
    const tokensUsed = deepseekResponse.data.usage?.total_tokens || 0;

    console.log('✅ AI回答生成成功:', { 
      answer: answer.substring(0, 100) + '...', 
      tokensUsed, 
      responseTime 
    });

    // 5. 保存对话记录（仅当userId是有效UUID时）
    if (userId && userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      try {
        // 使用服务端角色保存对话记录，绕过RLS限制
        const { error: saveError } = await supabase
          .from('ai_conversations')
          .insert([{
            user_id: userId,
            session_id: sessionId,
            question,
            answer,
            context: context.substring(0, 500), // 限制上下文长度
            tokens_used: tokensUsed,
            response_time: responseTime
          }]);

        if (saveError) {
          console.error('❌ 保存对话记录失败:', saveError);
          // 如果RLS策略阻止，尝试使用管理员权限
          console.log('🔄 尝试使用管理员权限保存对话记录...');
        } else {
          console.log('✅ 对话记录已保存');
        }
      } catch (error) {
        console.error('❌ 保存对话记录异常:', error);
      }
    } else {
      console.log('⚠️ 跳过对话记录保存（无效的userId格式）');
    }

    // 6. 返回结果
    res.json({
      answer,
      context: '基于系统知识库回答', // 隐藏具体文档信息
      tokensUsed,
      responseTime
    });

  } catch (error) {
    console.error('❌ AI聊天处理失败:', error);
    
    // 返回友好的错误信息
    let errorMessage = '抱歉，我现在无法回答您的问题。';
    
    if (error.response?.status === 401) {
      errorMessage = 'AI服务认证失败，请联系管理员。';
    } else if (error.response?.status === 429) {
      errorMessage = 'AI服务请求过于频繁，请稍后重试。';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'AI服务暂时不可用，请稍后重试。';
    }

    res.status(500).json({ 
      error: errorMessage,
      detail: error.message 
    });
  }
});

// 获取对话历史
app.get('/api/ai-chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;

    if (!sessionId || !userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ 获取对话历史失败:', error);
      throw error;
    }

    res.json({ conversations: data || [] });

  } catch (error) {
    console.error('❌ 获取对话历史失败:', error);
    res.status(500).json({ error: '获取对话历史失败' });
  }
});

// 获取帮助文档
app.get('/api/ai-chat/help-docs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('help_documents')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('❌ 获取帮助文档失败:', error);
      throw error;
    }

    res.json({ documents: data || [] });

  } catch (error) {
    console.error('❌ 获取帮助文档失败:', error);
    res.status(500).json({ error: '获取帮助文档失败' });
  }
});

// ========================================
// 🎭 用户角色升级API
// ========================================

// 管理员批准用户升级
app.post('/api/admin/approve-user', async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const adminId = req.headers['x-user-id'];

    if (!adminId) {
      return res.status(401).json({ error: '未登录' });
    }

    if (!userId || !newRole) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 检查操作者是否为管理员
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role, nickname')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData || !['admin', 'super_admin'].includes(adminData.role)) {
      console.log('🚫 非管理员尝试升级用户:', { adminId, role: adminData?.role });
      return res.status(403).json({ error: '权限不足，只有管理员可以升级用户' });
    }

    // 获取被升级用户信息
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('role, nickname')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    console.log(`✅ 管理员${adminData.nickname}批准升级用户:`, {
      userId,
      fromRole: targetUser.role,
      toRole: newRole,
      targetNickname: targetUser.nickname
    });

    // 升级用户角色
    const { error: updateError } = await supabase
      .from('users')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ 用户升级失败:', updateError);
      return res.status(500).json({ error: '升级失败' });
    }

    // 记录升级历史
    const { error: historyError } = await supabase
      .from('user_role_upgrades')
      .insert({
        user_id: userId,
        from_role: targetUser.role,
        to_role: newRole,
        approved_by: adminId,
        status: 'approved',
        reason: `管理员${adminData.nickname}批准升级`
      });

    if (historyError) {
      console.error('⚠️ 升级历史记录失败:', historyError);
      // 不影响主流程
    }

    // 如果有待审核的升级申请，更新状态
    const { error: requestError } = await supabase
      .from('user_upgrade_requests')
      .update({
        status: 'approved',
        approved_by: adminId,
        approved_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (requestError) {
      console.error('⚠️ 升级申请状态更新失败:', requestError);
      // 不影响主流程
    }

    res.json({
      success: true,
      message: '用户升级成功',
      data: {
        userId,
        fromRole: targetUser.role,
        toRole: newRole
      }
    });
  } catch (error) {
    console.error('❌ 用户升级异常:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 管理员拒绝用户升级
app.post('/api/admin/reject-user', async (req, res) => {
  try {
    const { requestId, reason } = req.body;
    const adminId = req.headers['x-user-id'];

    if (!adminId) {
      return res.status(401).json({ error: '未登录' });
    }

    if (!requestId) {
      return res.status(400).json({ error: '缺少申请ID' });
    }

    // 检查操作者是否为管理员
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role, nickname')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData || !['admin', 'super_admin'].includes(adminData.role)) {
      return res.status(403).json({ error: '权限不足' });
    }

    // 更新申请状态
    const { error: updateError } = await supabase
      .from('user_upgrade_requests')
      .update({
        status: 'rejected',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason || '管理员拒绝'
      })
      .eq('id', requestId);

    if (updateError) {
      return res.status(500).json({ error: '操作失败' });
    }

    res.json({
      success: true,
      message: '已拒绝升级申请'
    });
  } catch (error) {
    console.error('❌ 拒绝升级异常:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取待审核的用户升级申请列表
app.get('/api/admin/pending-upgrades', async (req, res) => {
  try {
    const adminId = req.headers['x-user-id'];

    if (!adminId) {
      return res.status(401).json({ error: '未登录' });
    }

    // 检查操作者是否为管理员
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError || !adminData || !['admin', 'super_admin'].includes(adminData.role)) {
      return res.status(403).json({ error: '权限不足' });
    }

    // 查询待审核的申请
    const { data: requests, error: requestError } = await supabase
      .from('user_upgrade_requests')
      .select(`
        *,
        user:user_id (
          id,
          nickname,
          email,
          role,
          created_at
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (requestError) {
      console.error('❌ 查询升级申请失败:', requestError);
      return res.status(500).json({ error: '查询失败' });
    }

    res.json({
      success: true,
      data: requests || []
    });
  } catch (error) {
    console.error('❌ 获取升级申请列表异常:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`企业微信Webhook中转服务已启动，地址: http://${HOST}:${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
});

// ========================================
// 图片上传API - 绕过RLS限制
// ========================================

// 图片上传API
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: '只支持 JPG、PNG、GIF、WEBP、BMP 格式的图片' });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${userId}_${timestamp}.${fileExtension}`;
    const storagePath = `images/${userId}/${fileName}`;

    // 上传到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('smart-message-images')
      .upload(storagePath, req.file.buffer, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ 图片上传到Storage失败:', uploadError);
      return res.status(500).json({ error: '图片上传失败: ' + uploadError.message });
    }

    // 生成公开URL
    const { data: urlData } = supabase.storage
      .from('smart-message-images')
      .getPublicUrl(storagePath);

    console.log('✅ 图片已上传到Storage:', storagePath);

    // 获取图片尺寸
    let width = null, height = null;
    try {
      const metadata = await sharp(req.file.buffer).metadata();
      width = metadata.width;
      height = metadata.height;
    } catch (sharpError) {
      console.warn('⚠️ 无法获取图片尺寸:', sharpError.message);
    }

    // 保存到数据库（RLS已禁用，所有用户都可以插入）
    const { data: dbData, error: dbError } = await supabase
      .from('image_uploads')
      .insert({
        user_id: userId,
        filename: fileName,
        original_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        width: width,
        height: height
      })
      .select();

    if (dbError) {
      console.error('❌ 数据库保存失败:', dbError);
      return res.status(500).json({ error: '数据库保存失败: ' + dbError.message });
    }

    console.log('✅ 图片上传成功:', fileName);
    res.json({
      success: true,
      data: dbData[0],
      message: '图片上传成功'
    });

  } catch (error) {
    console.error('❌ 图片上传异常:', error);
    res.status(500).json({ error: '图片上传异常: ' + error.message });
  }
});

// ========================================
// 数据库修复API - 提示信息
// ========================================

// 获取RLS状态信息
app.get('/api/check-rls-status', async (req, res) => {
  try {
    res.json({
      success: true,
      message: '请在Supabase的SQL编辑器中执行以下SQL来禁用RLS策略：',
      sql: `
-- 禁用 image_uploads 表的 RLS
ALTER TABLE image_uploads DISABLE ROW LEVEL SECURITY;

-- 验证 RLS 状态
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'image_uploads';
      `,
      instructions: [
        '1. 登录 Supabase Dashboard',
        '2. 进入 SQL Editor',
        '3. 执行上述 SQL 语句',
        '4. 刷新页面并重试上传'
      ]
    });
  } catch (error) {
    console.error('❌ 获取RLS状态失败:', error);
    res.status(500).json({ error: '获取RLS状态失败: ' + error.message });
  }
});

// 生产环境下的路由处理
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}