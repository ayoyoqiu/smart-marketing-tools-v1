import React from 'react';
import { Layout as AntLayout, Button, Dropdown, Avatar, Typography, Space, message } from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  LogoutOutlined,
  SwapOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import ThemeToggle from '../UI/ThemeToggle';
import { useTheme } from '../../contexts/ThemeContext';

const { Header: AntHeader } = AntLayout;
const { Text } = Typography;

const Header = () => {
  const navigate = useNavigate();
  const { user, currentRole, availableRoles, switchRole, logout, isAdmin } = useAuth();
  const { theme } = useTheme();
  const { collapsed } = useSidebar();
  
  // 消息按钮点击处理
  const handleNotificationClick = () => {
    message.info('当前系统暂无消息通知哦', 2);
  };
  
  console.log('🔍 Header组件接收到的角色数据:', {
    availableRoles,
    availableRolesLength: availableRoles?.length,
    currentRole,
    user: user?.nickname
  });

  const handleRoleSwitch = async (newRole) => {
    if (newRole === currentRole) return;
    
    console.log('🔄 用户点击切换角色:', { from: currentRole, to: newRole });
    
    const success = await switchRole(newRole);
    if (success) {
      console.log('✅ 角色切换成功，准备刷新页面');
      // 角色切换成功后刷新页面以更新界面
      window.location.reload();
    } else {
      console.log('❌ 角色切换失败');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 获取角色显示名称
  const getRoleDisplayName = (role) => {
    const roleNames = {
      'guest': '游客用户', // 🎭 新增游客角色
      'user': '普通用户',
      'admin': '管理员',
      'super_admin': '超级管理员'
    };
    return roleNames[role] || role;
  };

  // 获取角色图标
  const getRoleIcon = (role) => {
    if (role === 'super_admin') {
      return <CrownOutlined style={{ color: '#ff4d4f' }} />;
    }
    return role === 'admin' ? <CrownOutlined style={{ color: '#52c41a' }} /> : <UserOutlined />;
  };

  // 用户菜单项 - 重新开发的版本
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/profile')
    }
  ];

  // 只有当用户有多个可用角色时才显示身份切换菜单
  if (availableRoles.length > 1) {
    // 去重处理，确保没有重复的角色
    const uniqueRoles = [...new Set(availableRoles)];
    console.log('🔍 添加身份切换菜单，可用角色:', uniqueRoles);
    
    userMenuItems.push({
      key: 'role-switch',
      icon: <SwapOutlined />,
      label: '切换身份',
      children: uniqueRoles.map((role, index) => ({
        key: `switch-to-${role}-${index}`, // 添加索引确保key唯一
        icon: getRoleIcon(role),
        label: `切换到${getRoleDisplayName(role)}`,
        disabled: role === currentRole,
        onClick: () => handleRoleSwitch(role)
      }))
    });
  } else {
    console.log('🔍 用户只有一个角色，不显示身份切换菜单');
  }

  // 管理员功能菜单
  if (isAdmin()) {
    console.log('🔍 添加管理员功能菜单，当前角色:', currentRole);
    userMenuItems.push(
      {
        key: 'admin-panel',
        icon: <CrownOutlined />,
        label: '管理面板',
        onClick: () => navigate('/admin')
      },
      {
        key: 'admin-accounts',
        icon: <UserOutlined />,
        label: '账户管理',
        onClick: () => navigate('/admin/accounts')
      }
    );
  } else {
    console.log('🔍 用户不是管理员，不显示管理员功能菜单');
  }

  // 退出登录菜单项
  userMenuItems.push({
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
    onClick: handleLogout
  });

  // 当前角色信息
  const currentRoleInfo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {getRoleIcon(currentRole)}
      <Text strong style={{ 
        color: currentRole === 'super_admin' ? '#ff4d4f' : 
               currentRole === 'admin' ? '#52c41a' : '#1890ff' 
      }}>
        {getRoleDisplayName(currentRole)}
      </Text>
    </div>
  );

  return (
    <AntHeader style={{ 
      position: 'fixed',
      top: 0,
      left: collapsed ? 80 : 200,
      right: 0,
      zIndex: 1000,
      background: theme === 'dark' ? '#141414' : '#fff', 
      padding: '0 24px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
      height: '64px',
      transition: 'left 0.2s ease'
    }}>
      {/* 左侧Logo */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        paddingLeft: '16px',
        paddingRight: '8px'
      }}>
        {/* Logo */}
        <h2 style={{ margin: 0, color: '#1890ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src="/images/ai-robot-icon.png" 
            alt="智能营销小工具" 
            style={{ 
              width: 24, 
              height: 24, 
              objectFit: 'contain'
            }} 
          />
          智能营销小工具
        </h2>
      </div>

      {/* 右侧用户信息 */}
      {user && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          paddingLeft: '16px',
          paddingRight: '8px'
        }}>
          {/* 主题切换按钮 */}
          <ThemeToggle />
          
          {/* 通知按钮 */}
          <Button 
            type="text" 
            icon={<BellOutlined />} 
            onClick={handleNotificationClick}
            style={{ 
              fontSize: '16px',
              width: '40px',
              height: '40px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              backgroundColor: 'transparent',
              marginLeft: '8px',
              marginRight: '8px'
            }}
          />
          
          {/* 当前角色显示 */}
          <div 
            className={`role-display ${theme === 'dark' ? 'role-display-dark' : 'role-display-light'}`}
            style={{ 
              padding: '8px 16px', 
              background: currentRole === 'super_admin' ? '#fff2f0' :
                         currentRole === 'admin' ? '#f6ffed' : '#f0f9ff',
              border: `1px solid ${currentRole === 'super_admin' ? '#ffccc7' :
                                 currentRole === 'admin' ? '#b7eb8f' : '#91d5ff'}`,
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {currentRoleInfo}
          </div>

          {/* 用户下拉菜单 */}
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Button 
              type="text" 
              style={{ 
                height: 'auto', 
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Avatar 
                size="small" 
                icon={<UserOutlined />} 
                style={{ 
                  backgroundColor: currentRole === 'super_admin' ? '#ff4d4f' :
                                 currentRole === 'admin' ? '#52c41a' : '#1890ff' 
                }}
              />
              <div style={{ textAlign: 'left' }}>
                <div 
                  className={`user-nickname user-role-${currentRole}`}
                  data-role={currentRole}
                  style={{ fontWeight: 'bold', color: '#000' }}
                >
                  {user.nickname}
                </div>
                <div 
                  className="user-email"
                  data-type="email"
                  style={{ fontSize: '12px', color: '#666' }}
                >
                  {user.email || 'admin@company.com'}
                </div>
              </div>
            </Button>
          </Dropdown>
        </div>
      )}
    </AntHeader>
  );
};

export default Header;

