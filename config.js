// API配置文件
const API_CONFIG = {
  // 开发环境 - 使用动态IP地址
  development: {
    baseURL: `http://${window.location.hostname}:3001`
  },
  // 生产环境
  production: {
    baseURL: window.location.origin
  }
};

// 根据当前环境获取API地址
const getApiBaseUrl = () => {
  const env = import.meta.env.MODE || 'development';
  return API_CONFIG[env]?.baseURL || API_CONFIG.development.baseURL;
};

// 导出API地址
export const API_BASE_URL = getApiBaseUrl();

// 完整的API端点
export const API_ENDPOINTS = {
  webhook: `${API_BASE_URL}/api/wecom-webhook`,
  // 🎭 用户升级管理API
  USER_REQUEST_UPGRADE: `${API_BASE_URL}/api/user/request-upgrade`, // 🎭 用户提交升级申请
  ADMIN_APPROVE_USER: `${API_BASE_URL}/api/admin/approve-user`,
  ADMIN_REJECT_USER: `${API_BASE_URL}/api/admin/reject-user`,
  ADMIN_PENDING_UPGRADES: `${API_BASE_URL}/api/admin/pending-upgrades`
};

export default API_CONFIG; 