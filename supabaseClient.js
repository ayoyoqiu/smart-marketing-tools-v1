import { createClient } from '@supabase/supabase-js'

// 从环境变量获取Supabase连接信息
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ezhbqeapgutzstdaohit.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6aGJxZWFwZ3V0enN0ZGFvaGl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2ODIzMTksImV4cCI6MjA3MTI1ODMxOX0.RyhROz_TL247GsEJtj86RdvDNPPLz6UX6Hep49p7DqE'

// 检查必要的配置
if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('❌ 缺少VITE_SUPABASE_URL环境变量配置')
  console.error('请在项目根目录创建.env.local文件并配置Supabase信息')
}

if (!supabaseAnonKey || supabaseAnonKey === 'your_anon_key_here') {
  console.error('❌ 缺少VITE_SUPABASE_ANON_KEY环境变量配置')
  console.error('请在项目根目录创建.env.local文件并配置Supabase信息')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'supabase-auth-token'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'smart-message-bot-2.5'
    }
  }
})

// 添加连接状态检查
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) {
      console.error('❌ Supabase连接检查失败:', error)
      return false
    }
    console.log('✅ Supabase连接正常')
    return true
  } catch (err) {
    console.error('❌ Supabase连接异常:', err)
    return false
  }
}

// 检查认证状态
export const checkAuthStatus = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('❌ 认证状态检查失败:', error)
      return { isAuthenticated: false, user: null, error }
    }
    
    const isAuthenticated = !!user
    console.log('🔍 认证状态检查:', { 
      isAuthenticated, 
      userId: user?.id, 
      email: user?.email 
    })
    
    return { isAuthenticated, user, error: null }
  } catch (err) {
    console.error('❌ 认证状态检查异常:', err)
    return { isAuthenticated: false, user: null, error: err }
  }
}

// 获取当前会话
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('❌ 获取会话失败:', error)
      return null
    }
    
    console.log('🔍 当前会话:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      expiresAt: session?.expires_at 
    })
    
    return session
  } catch (err) {
    console.error('❌ 获取会话异常:', err)
    return null
  }
}

// 设置当前用户ID的函数（简化版本，不依赖数据库RPC）
export const setCurrentUserId = async (userId) => {
  try {
    // 直接存储到localStorage，不依赖数据库RPC函数
    localStorage.setItem('currentUserId', userId)
    console.log('✅ 用户ID设置成功:', userId)
  } catch (error) {
    console.error('设置用户ID失败:', error)
  }
}

// 创建带用户ID过滤的查询构建器
export const createUserFilteredQuery = (table, userId, isAdmin = false) => {
  let query = supabase.from(table)
  
  // 如果不是管理员，添加用户ID过滤
  if (!isAdmin && userId) {
    query = query.eq('user_id', userId)
  }
  
  return query
}

// 数据库表结构定义
export const TABLES = {
  USERS: 'users',                    // 用户表
  TASKS: 'tasks',                    // 任务表
  WEBHOOKS: 'webhooks',              // webhook地址表
  MESSAGE_HISTORY: 'message_history' // 消息历史表
}

// 任务状态枚举
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
}

// 消息类型枚举
export const MESSAGE_TYPE = {
  TEXT_IMAGE: 'text_image',
  CARD: 'card',
  RICH_TEXT: 'rich_text'
}

// 用户角色枚举
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
}

// 用户状态枚举
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BANNED: 'banned'
}

// 数据隔离级别
export const DATA_ISOLATION = {
  USER_LEVEL: 'user_level',      // 用户级别隔离
  TENANT_LEVEL: 'tenant_level',  // 租户级别隔离
  GLOBAL: 'global'               // 全局共享
}

// 权限枚举
export const PERMISSIONS = {
  READ_OWN_DATA: 'read_own_data',           // 读取自己的数据
  WRITE_OWN_DATA: 'write_own_data',         // 写入自己的数据
  READ_ALL_DATA: 'read_all_data',           // 读取所有数据（管理员）
  WRITE_ALL_DATA: 'write_all_data',         // 写入所有数据（管理员）
  MANAGE_USERS: 'manage_users',             // 管理用户（管理员）
  SYSTEM_CONFIG: 'system_config'            // 系统配置（超级管理员）
}

// 验证规则
export const VALIDATION_RULES = {
  NICKNAME_MIN_LENGTH: 2,
  NICKNAME_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 50
}

// 默认配置
export const DEFAULT_CONFIG = {
  DEFAULT_USER_ROLE: USER_ROLES.USER,
  DEFAULT_USER_STATUS: USER_STATUS.ACTIVE,
  DEFAULT_DATA_ISOLATION: DATA_ISOLATION.USER_LEVEL
} 