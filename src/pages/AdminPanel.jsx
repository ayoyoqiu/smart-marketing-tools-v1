import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Space, Button, Spin } from 'antd';
import { 
  UserOutlined, 
  CrownOutlined, 
  SettingOutlined, 
  BarChartOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../supabaseClient';

const { Title, Text } = Typography;

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    todayActiveUsers: 0,
    systemStatus: '正常'
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // 如果不是管理员，重定向到首页
  if (!isAdmin()) {
    navigate('/');
    return null;
  }

  // 获取实时统计数据
  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // 1. 获取总用户数
      const { count: totalUsers, error: totalError } = await supabase
        .from('users')
        .select('*', { count: 'exact' });
      
      if (totalError) {
        console.error('获取总用户数失败:', totalError);
      }

      // 2. 获取活跃用户数（状态为active的用户）
      const { count: activeUsers, error: activeError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('status', 'active');
      
      if (activeError) {
        console.error('获取活跃用户数失败:', activeError);
      }

      // 3. 获取今日活跃用户数（今天有登录记录的用户）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      
      const { count: todayActiveUsers, error: todayError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('last_login_at', todayISO);
      
      if (todayError) {
        console.error('获取今日活跃用户数失败:', todayError);
      }

      // 4. 检查系统状态（简单的健康检查）
      const systemStatus = '正常'; // 可以根据需要添加更复杂的系统状态检查

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        todayActiveUsers: todayActiveUsers || 0,
        systemStatus
      });
      
      setLastUpdateTime(new Date());

    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchStats();
    
    // 设置定时刷新（每30秒刷新一次）
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const adminFeatures = [
    {
      title: '系统监控',
      description: '查看系统运行状态和性能指标',
      icon: <BarChartOutlined />,
      color: '#52c41a',
      action: () => navigate('/admin/monitor')
    },
    {
      title: '安全设置',
      description: '配置系统安全策略和权限',
      icon: <SafetyOutlined />,
      color: '#faad14',
      action: () => navigate('/admin/security')
    },
    {
      title: '系统配置',
      description: '管理系统配置和参数设置',
      icon: <SettingOutlined />,
      color: '#722ed1',
      action: () => navigate('/admin/config')
    }
  ];

  return (
    <div>
      <Title level={2}>👑 管理面板</Title>
      <Text type="secondary">欢迎回来，{user?.nickname}！这里是系统管理控制台</Text>

      {/* 管理员信息 */}
      <Card style={{ marginTop: '24px', marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col>
            <CrownOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
          </Col>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0 }}>管理员权限</Title>
            <Text type="secondary">
              您拥有系统管理权限，可以管理用户、监控系统状态和配置系统参数
            </Text>
          </Col>
          <Col>
            <Space>
              <Button 
                icon={<BarChartOutlined />}
                onClick={() => navigate('/admin/monitor')}
              >
                系统监控
              </Button>
              <Button 
                icon={<UserOutlined />}
                onClick={fetchStats}
                loading={loading}
              >
                刷新数据
              </Button>
            </Space>
                  </Col>
      </Row>
      
      {/* 数据更新时间 */}
      {lastUpdateTime && (
        <div style={{ textAlign: 'right', marginBottom: '16px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            数据更新时间: {lastUpdateTime.toLocaleString('zh-CN')}
          </Text>
        </div>
      )}
      </Card>

      {/* 快速统计 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats.activeUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日活跃"
              value={stats.todayActiveUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#faad14' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="系统状态"
              value={stats.systemStatus}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#52c41a' }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 管理功能 */}
      <Title level={3}>管理功能</Title>
      <Row gutter={16}>
        {adminFeatures.map((feature, index) => (
          <Col span={12} key={index} style={{ marginBottom: '16px' }}>
            <Card
              hoverable
              onClick={feature.action}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  fontSize: '32px', 
                  color: feature.color, 
                  marginRight: '16px' 
                }}>
                  {feature.icon}
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, color: feature.color }}>
                    {feature.title}
                  </Title>
                  <Text type="secondary">{feature.description}</Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>



      {/* 系统信息 */}
      <Card title="系统信息" style={{ marginTop: '24px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Text strong>系统版本：</Text>
            <Text>v2.0.0 多用户版本</Text>
          </Col>
          <Col span={8}>
            <Text strong>当前时间：</Text>
            <Text>{new Date().toLocaleString('zh-CN')}</Text>
          </Col>
          <Col span={8}>
            <Text strong>管理员：</Text>
            <Text>{user?.nickname}</Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AdminPanel;

