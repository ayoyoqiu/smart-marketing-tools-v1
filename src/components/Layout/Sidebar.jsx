import React, { useState } from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  HomeOutlined,
  BarChartOutlined,
  MessageOutlined,
  SettingOutlined,
  UserOutlined,
  CrownOutlined,
  HistoryOutlined,
  BookOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';

const { Sider } = Layout;
const { Text } = Typography;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentRole, availableRoles, isAdmin } = useAuth();
  const { theme } = useTheme();
  const { collapsed, toggleSidebar } = useSidebar();

  // 根据当前角色获取菜单项 - 重新开发的版本
  const getMenuItems = () => {
    console.log('🔍 构建侧边栏菜单，当前角色:', currentRole, '是否管理员:', isAdmin());
    
    const baseItems = [
      {
        key: '/',
        icon: <HomeOutlined />,
        label: '首页',
        onClick: () => navigate('/')
      },
      {
        key: '/dashboard',
        icon: <BarChartOutlined />,
        label: '数据看板',
        onClick: () => navigate('/dashboard')
      },
      {
        key: '/tasks',
        icon: <MessageOutlined />,
        label: '任务管理',
        onClick: () => navigate('/tasks')
      },
      {
        key: '/address',
        icon: <SettingOutlined />,
        label: '地址管理',
        onClick: () => navigate('/address')
      },
      {
        key: '/history',
        icon: <HistoryOutlined />,
        label: '消息历史',
        onClick: () => navigate('/history')
      },
      {
        key: '/image-tools',
        icon: <PictureOutlined />,
        label: '图片URL工具',
        onClick: () => navigate('/image-tools')
      },
      {
        key: '/profile',
        icon: <UserOutlined />,
        label: '个人资料',
        onClick: () => navigate('/profile')
      },
    ];

    // 如果用户是管理员，添加管理员菜单
    if (isAdmin()) {
      console.log('✅ 添加管理员功能菜单');
      const adminItems = [
        {
          type: 'divider'
        },
        {
          key: 'admin-section',
          icon: <CrownOutlined />,
          label: '管理员功能',
          children: [
            {
              key: '/admin',
              icon: <CrownOutlined />,
              label: '管理面板',
              onClick: () => navigate('/admin')
            },
            {
              key: '/admin/accounts',
              icon: <UserOutlined />,
              label: '账户管理',
              onClick: () => navigate('/admin/accounts')
            },
            {
              key: '/admin/upgrades',
              icon: <UserOutlined />,
              label: '用户升级',
              onClick: () => navigate('/admin/upgrades')
            }
          ]
        }
      ];

      return [...baseItems, ...adminItems];
    } else {
      console.log('🔍 用户不是管理员，不显示管理员菜单');
    }

    return baseItems;
  };

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path === '/') return ['/'];
    if (path.startsWith('/admin')) {
      // 如果是账户管理页面，选中账户管理菜单项
      if (path === '/admin/accounts') {
        return ['/admin/accounts'];
      }
      // 🎭 如果是用户升级页面，选中用户升级菜单项
      if (path === '/admin/upgrades') {
        return ['/admin/upgrades'];
      }
      // 其他管理员页面选中管理面板
      return ['/admin'];
    }
    return [path];
  };

  // 获取当前展开的子菜单
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return ['admin-section'];
    return [];
  };

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={collapsed}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 1001,
        background: '#fff',
        borderRight: '1px solid #e8e8e8',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        overflow: 'auto'
      }}
    >
      {/* 折叠按钮 */}
      <div style={{ 
        padding: '16px', 
        textAlign: 'center', 
        borderBottom: '1px solid #f0f0f0' 
      }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleSidebar}
          style={{ fontSize: '16px', width: '100%' }}
        />
      </div>

      {/* 当前角色显示 */}
      {!collapsed && (
        <div 
          className={`role-info ${theme === 'dark' ? 'role-info-dark' : 'role-info-light'}`}
          style={{ 
            padding: '16px', 
            textAlign: 'center', 
            borderRadius: '8px',
            marginBottom: '16px',
            backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
            border: theme === 'dark' ? '1px solid #333333' : '1px solid #f0f0f0',
            boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px',
            marginBottom: '8px'
          }}>
            {currentRole === 'super_admin' ? (
              <CrownOutlined 
                className="role-icon role-icon-super_admin"
                data-role={currentRole}
                style={{ 
                  color: theme === 'dark' ? '#ff4d4f' : '#ff4d4f',
                  fontSize: '16px'
                }}
              />
            ) : currentRole === 'admin' ? (
              <CrownOutlined 
                className="role-icon role-icon-admin"
                data-role={currentRole}
                style={{ 
                  color: theme === 'dark' ? '#52c41a' : '#52c41a',
                  fontSize: '16px'
                }}
              />
            ) : (
              <UserOutlined 
                className="role-icon role-icon-user"
                data-role={currentRole}
                style={{ 
                  color: theme === 'dark' ? '#1890ff' : '#1890ff',
                  fontSize: '16px'
                }}
              />
            )}
            <Text 
              strong 
              className={`role-text role-text-${currentRole}`}
              data-role={currentRole}
              style={{ 
                fontSize: '14px',
                color: theme === 'dark' ? '#ffffff' : '#262626',
                backgroundColor: 'transparent'
              }}
            >
              {currentRole === 'super_admin' ? '超级管理员' : 
               currentRole === 'admin' ? '管理员' : '普通用户'}
            </Text>
          </div>
          <Text 
            type="secondary" 
            className="role-description"
            style={{ 
              fontSize: '12px',
              color: theme === 'dark' ? '#e0e0e0' : '#8c8c8c',
              backgroundColor: 'transparent'
            }}
          >
            {availableRoles.length > 1 ? `可切换身份 (${availableRoles.length}个)` : '单一身份'}
          </Text>
        </div>
      )}

      {/* 菜单 */}
      <Menu
        mode="inline"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        style={{ 
          borderRight: 0,
          marginTop: '16px',
          padding: '0 12px'
        }}
        items={getMenuItems()}
      />
    </Sider>
  );
};

export default Sidebar;

