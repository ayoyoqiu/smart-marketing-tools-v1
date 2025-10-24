import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './src/contexts/SidebarContext';
import AuthGuard from './src/components/Auth/AuthGuard';
import AppHeader from './src/components/Layout/Header';
import AppSidebar from './src/components/Layout/Sidebar';
import AIChatBot from './src/components/AIChatBot';
import './App.css';
import './src/styles/theme.css';
import './src/styles/darkMode.css';

// 懒加载组件
const Login = lazy(() => import('./src/components/Auth/Login'));
const Register = lazy(() => import('./src/components/Auth/Register'));
const DataDashboard = lazy(() => import('./src/pages/DataDashboard'));
const TaskManagement = lazy(() => import('./src/pages/TaskManagement'));
const AddressManagement = lazy(() => import('./src/pages/AddressManagement'));
const MessageHistory = lazy(() => import('./src/pages/MessageHistory'));
const Home = lazy(() => import('./src/pages/Home'));
const UserProfile = lazy(() => import('./src/pages/UserProfile'));
const AdminPanel = lazy(() => import('./src/pages/AdminPanel'));
const AdminAccountManagement = lazy(() => import('./src/pages/AdminAccountManagement'));
const UserUpgradeManagement = lazy(() => import('./src/pages/UserUpgradeManagement')); // 🎭 用户升级管理
const ImageTools = lazy(() => import('./src/pages/ImageTools'));

// 加载状态组件
const LoadingSpinner = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '200px',
    flexDirection: 'column',
    gap: '16px'
  }}>
    <Spin size="large" />
    <div style={{ color: '#666' }}>正在加载...</div>
  </div>
);

const { Content } = Layout;

// 主布局组件
const MainLayout = ({ children }) => {
  const { collapsed } = useSidebar();
  const { theme } = useTheme();
  
  return (
    <Layout style={{ minHeight: '100vh', display: 'flex' }}>
      {/* 固定侧边栏 */}
      <AppSidebar />
      
      {/* 主内容区域 */}
      <Layout style={{ 
        marginLeft: collapsed ? 80 : 200, 
        transition: 'margin-left 0.2s',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh'
      }}>
        {/* 固定Header */}
        <AppHeader />
        
        {/* 内容区域 - 完全无留白设计 */}
        <Content style={{ 
          flex: 1,
          padding: 0,
          margin: 0,
          marginTop: '64px', // 为固定Header预留空间
          background: theme === 'dark' ? '#141414' : '#f8f9fa', // 与导航栏一致的背景色
          overflow: 'auto'
        }}>
          {/* 内容容器 - 完全紧贴侧边栏，无任何留白 */}
          <div className="main-content-container" style={{
            width: '100%',
            minHeight: 'calc(100vh - 64px)',
            background: theme === 'dark' ? '#141414' : '#fff',
            position: 'relative',
            margin: 0,
            padding: '24px'
          }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          {/* AI聊天机器人 - 全局悬浮 */}
          <AIChatBot />
          <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={
          <AuthGuard requireAuth={false}>
            <Suspense fallback={<LoadingSpinner />}>
              <Login />
            </Suspense>
          </AuthGuard>
        } />
        <Route path="/register" element={
          <AuthGuard requireAuth={false}>
            <Suspense fallback={<LoadingSpinner />}>
              <Register />
            </Suspense>
          </AuthGuard>
        } />

        {/* 受保护的路由 */}
        <Route path="/" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <Home />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/dashboard" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <DataDashboard />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/tasks" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <TaskManagement />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/guide" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <Home />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/address" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <AddressManagement />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/history" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <MessageHistory />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/image-tools" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <ImageTools />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />
        <Route path="/profile" element={
          <AuthGuard>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <UserProfile />
            </Suspense>
            </MainLayout>
          </AuthGuard>
        } />

        {/* 管理员专用路由 */}
        <Route path="/admin" element={
          <AuthGuard requireAdmin={true}>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <AdminPanel />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />

        {/* 管理员账户管理路由 */}
        <Route path="/admin/accounts" element={
          <AuthGuard requireAdmin={true}>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <AdminAccountManagement />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />

        {/* 🎭 用户升级管理路由 */}
        <Route path="/admin/upgrades" element={
          <AuthGuard requireAdmin={true}>
            <MainLayout>
              <Suspense fallback={<LoadingSpinner />}>
                <UserUpgradeManagement />
              </Suspense>
            </MainLayout>
          </AuthGuard>
        } />


        {/* 默认重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 