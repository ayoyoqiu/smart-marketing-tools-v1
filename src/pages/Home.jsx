import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Typography, Divider, List, Tag, Space, Alert, Card, Row, Col, Button, Statistic, Progress, Spin } from 'antd';
import {
  SendOutlined,
  SettingOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  UserOutlined,
  CrownOutlined,
  BgColorsOutlined,
  SwapOutlined,
  PlusOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined as SuccessIcon,
  ExclamationCircleOutlined,
  ReloadOutlined,
  PictureOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES } from '../../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDataCache } from '../hooks/useDataCache';
import AnimatedCard from '../components/UI/AnimatedCard';
import StatusIndicator from '../components/UI/StatusIndicator';

const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const [error, setError] = useState(null);

  // 优化的数据获取函数
  const fetchTasksData = useCallback(async () => {
    let query = supabase.from(TABLES.TASKS).select('id, status, type, created_at');
    if (!isAdmin()) {
      query = query.eq('user_id', user.id);
    }
    const { data: tasks, error: taskError } = await query;
    if (taskError) throw taskError;
    
    return {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      completed: tasks?.filter(t => t.status === 'completed').length || 0,
      failed: tasks?.filter(t => t.status === 'failed').length || 0
    };
  }, [user?.id, isAdmin]);

  const fetchWebhooksData = useCallback(async () => {
    let query = supabase.from(TABLES.WEBHOOKS).select('id, status');
    if (!isAdmin()) {
      query = query.eq('user_id', user.id);
    }
    const { data: webhooks, error: webhookError } = await query;
    if (webhookError) throw webhookError;
    
    return {
      total: webhooks?.length || 0,
      active: webhooks?.filter(w => w.status === 'active').length || 0,
      inactive: webhooks?.filter(w => w.status !== 'active').length || 0
    };
  }, [user?.id, isAdmin]);

  const fetchMessagesData = useCallback(async () => {
    // 获取所有消息用于统计
    let allMessagesQuery = supabase
      .from(TABLES.MESSAGE_HISTORY)
      .select('id, status, message_type, created_at');
    
    if (!isAdmin()) {
      allMessagesQuery = allMessagesQuery.eq('user_id', user.id);
    }
    
    const { data: allMessages, error: allMessagesError } = await allMessagesQuery;
    if (allMessagesError) throw allMessagesError;
    
    // 获取最近5条消息用于显示
    let recentMessagesQuery = supabase
      .from(TABLES.MESSAGE_HISTORY)
      .select('id, status, message_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!isAdmin()) {
      recentMessagesQuery = recentMessagesQuery.eq('user_id', user.id);
    }
    
    const { data: recentMessages, error: recentMessagesError } = await recentMessagesQuery;
    if (recentMessagesError) throw recentMessagesError;
    
    return {
      total: allMessages?.length || 0,
      success: allMessages?.filter(m => ['success', 'sent', 'delivered'].includes(m.status)).length || 0,
      failed: allMessages?.filter(m => m.status === 'failed').length || 0,
      recentActivity: recentMessages || []
    };
  }, [user?.id, isAdmin]);

  // 使用缓存Hook
  const { data: tasksData, loading: tasksLoading, fetchData: fetchTasks } = useDataCache(
    `tasks-${user?.id}-${isAdmin}`,
    fetchTasksData,
    [user?.id, isAdmin],
    2 * 60 * 1000 // 2分钟缓存
  );

  const { data: webhooksData, loading: webhooksLoading, fetchData: fetchWebhooks } = useDataCache(
    `webhooks-${user?.id}-${isAdmin}`,
    fetchWebhooksData,
    [user?.id, isAdmin],
    2 * 60 * 1000 // 2分钟缓存
  );

  const { data: messagesData, loading: messagesLoading, fetchData: fetchMessages } = useDataCache(
    `messages-${user?.id}-${isAdmin}`,
    fetchMessagesData,
    [user?.id, isAdmin],
    1 * 60 * 1000 // 1分钟缓存
  );

  // 合并统计数据
  const stats = useMemo(() => ({
    tasks: tasksData || { total: 0, pending: 0, completed: 0, failed: 0 },
    webhooks: webhooksData || { total: 0, active: 0, inactive: 0 },
    messages: messagesData || { total: 0, success: 0, failed: 0, recentActivity: [] },
    recentActivity: messagesData?.recentActivity || []
  }), [tasksData, webhooksData, messagesData]);

  const loading = tasksLoading || webhooksLoading || messagesLoading;

  // 刷新所有数据
  const refreshData = useCallback(async () => {
    try {
      setError(null);
      console.log('🔄 手动刷新数据...');
      await Promise.all([
        fetchTasks(true), // 强制刷新
        fetchWebhooks(true),
        fetchMessages(true)
      ]);
      console.log('✅ 数据刷新完成');
    } catch (error) {
      console.error('❌ 刷新数据失败:', error);
      setError('刷新数据失败，请稍后再试');
    }
  }, [fetchTasks, fetchWebhooks, fetchMessages]);



  // 快捷操作
  const quickActions = [
    {
      title: '地址管理',
      icon: <SettingOutlined />,
      color: '#1890ff',
      action: () => navigate('/addresses'),
      description: '添加和管理Webhook地址'
    },
    {
      title: '任务管理',
      icon: <MessageOutlined />,
      color: '#52c41a',
      action: () => navigate('/tasks'),
      description: '创建和管理推送任务'
    },
    {
      title: '消息历史',
      icon: <HistoryOutlined />,
      color: '#faad14',
      action: () => navigate('/history'),
      description: '查看消息历史记录'
    },
    {
      title: '图片URL',
      icon: <PictureOutlined />,
      color: '#722ed1',
      action: () => navigate('/image-tools'),
      description: '图片转URL工具'
    }
  ];
  const features = [
    {
      title: '任务管理',
      icon: <SendOutlined style={{ color: '#1890ff' }} />,
      description: '创建和管理推送任务，支持文本、图片、文件等多种消息类型',
      features: [
        '支持文本消息推送',
        '支持图片消息推送（URL或本地文件）',
        '支持文件消息推送',
        '支持定时推送功能',
        '支持批量推送多个地址',
        '支持分组选择推送',
        '实时推送状态反馈'
      ]
    },
    {
      title: '地址管理',
      icon: <SettingOutlined style={{ color: '#52c41a' }} />,
      description: '管理智能营销小工具的Webhook地址，支持批量导入和导出',
      features: [
        '添加/编辑/删除Webhook地址',
        '支持Excel批量导入地址',
        '支持地址分组管理（技术群、产品群等）',
        '地址有效性验证',
        '支持地址备注和标签',
        '分组统计和筛选功能'
      ]
    },
    {
      title: '历史消息',
      icon: <HistoryOutlined style={{ color: '#faad14' }} />,
      description: '查看推送历史记录，包括成功和失败的消息推送',
      features: [
        '查看所有推送历史',
        '按时间、状态筛选消息',
        '查看推送详细信息',
        '支持消息重发功能',
        '推送成功率统计'
      ]
    },
    {
      title: '图片转URL工具',
      icon: <PictureOutlined style={{ color: '#13c2c2' }} />,
      description: '便捷的在线图片管理工具，支持图片上传和URL链接生成',
      features: [
        '支持拖拽上传图片文件',
        '支持多种图片格式（JPG、PNG、GIF、BMP、WEBP等）',
        '自动生成永久有效的URL链接',
        '支持多种链接格式（直链、HTML、Markdown）',
        '图片预览和批量管理功能',
        '历史记录和搜索功能'
      ]
    }
  ];

  const newFeatures = [
    {
      title: '身份切换',
      icon: <SwapOutlined style={{ color: '#722ed1' }} />,
      description: '管理员可以在不同身份之间自由切换，体验不同权限下的功能',
      features: [
        '管理员 ↔ 普通用户身份切换',
        '权限实时生效，无需重新登录',
        '支持双重身份管理',
        '身份切换状态实时显示'
      ]
    },
    {
      title: '深色模式',
      icon: <BgColorsOutlined style={{ color: '#13c2c2' }} />,
      description: '支持深色和浅色两种主题模式，提升视觉体验和夜间使用舒适度',
      features: [
        '一键切换深色/浅色主题',
        '自动保存主题偏好设置',
        '所有组件完美适配深色模式',
        '优化的对比度和可读性'
      ]
    },
    {
      title: '权限管理',
      icon: <CrownOutlined style={{ color: '#fa8c16' }} />,
      description: '完善的用户权限管理系统，支持角色分配和实时权限变更',
      features: [
        '管理员/普通用户角色管理',
        '权限变更实时生效',
        '账户状态管理（启用/禁用）',
        '密码重置和账户安全'
      ]
    }
  ];


  const tips = [
    'Webhook地址格式：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY',
    '图片支持JPG、PNG、GIF格式，文件大小不超过2MB',
    '文件支持各种格式，大小不超过20MB',
    '定时推送支持设置具体时间，系统会在指定时间自动发送',
    '批量推送时，系统会逐个发送到每个地址，避免频率限制',
    '支持按分组选择推送目标，避免消息推送到所有机器人'
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={refreshData}
          loading={loading}
          size="small"
        >
          刷新数据
        </Button>
      </div>
      
      {/* 欢迎横幅 */}
      <Card 
        style={{ 
          marginBottom: 32, 
          background: theme === 'dark' 
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
          border: theme === 'dark' 
            ? '1px solid #333333'
            : '1px solid #e8f4fd',
          borderRadius: '16px',
          color: theme === 'dark' ? '#ffffff' : '#333',
          boxShadow: theme === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.3)'
            : '0 2px 8px rgba(24, 144, 255, 0.1)'
        }}
        bodyStyle={{ padding: '32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <img 
            src="/images/ai-robot-icon.png" 
            alt="智能营销小工具" 
            style={{ 
              width: 48, 
              height: 48, 
              marginRight: 16,
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.2)',
              padding: '8px'
            }} 
          />
          <div>
            <Title level={2} style={{ color: theme === 'dark' ? '#69b1ff' : '#1890ff', margin: 0, fontSize: '28px' }}>
              智能营销小工具 v1.0
            </Title>
            <div style={{ fontSize: '16px', color: theme === 'dark' ? '#bfbfbf' : '#666', marginTop: 4 }}>
              一站式消息推送与图片管理平台
            </div>
          </div>
        </div>
        <div style={{ fontSize: '16px', lineHeight: '1.6', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>
          本系统提供便捷的消息推送服务和图片管理工具，支持多种消息类型、图片转URL链接、批量操作等功能。
          现已支持AI智能助手、深色模式、身份切换、实时权限管理等新功能！
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 数据统计卡片 */}
      <Title level={3} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', color: theme === 'dark' ? '#ffffff' : '#000000' }}>
        <BarChartOutlined style={{ marginRight: 8, color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
        数据概览
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e8f4fd',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(24, 144, 255, 0.1)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '10px', 
                background: '#1890ff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12
              }}>
                <SendOutlined style={{ color: 'white', fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666', marginBottom: 2 }}>总任务数</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme === 'dark' ? '#69b1ff' : '#1890ff' }}>
                  {stats.tasks?.total || 0}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8c8c8c' : '#999', display: 'flex', justifyContent: 'space-between' }}>
              <span>待执行: {stats.tasks?.pending || 0}</span>
              <span>已完成: {stats.tasks?.completed || 0}</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e8f5e8',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #0f1b0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #e8f5e8 0%, #f0f9ff 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(82, 196, 26, 0.1)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '10px', 
                background: '#52c41a', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12
              }}>
                <SettingOutlined style={{ color: 'white', fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666', marginBottom: 2 }}>Webhook地址</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme === 'dark' ? '#73d13d' : '#52c41a' }}>
                  {stats.webhooks?.total || 0}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8c8c8c' : '#999', display: 'flex', justifyContent: 'space-between' }}>
              <span>活跃: {stats.webhooks?.active || 0}</span>
              <span>非活跃: {stats.webhooks?.inactive || 0}</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #fff7e6',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a1a0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #fff7e6 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(250, 173, 20, 0.1)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '10px', 
                background: '#faad14', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12
              }}>
                <HistoryOutlined style={{ color: 'white', fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666', marginBottom: 2 }}>消息总数</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme === 'dark' ? '#ffc53d' : '#faad14' }}>
                  {stats.messages?.total || 0}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8c8c8c' : '#999', display: 'flex', justifyContent: 'space-between' }}>
              <span>成功: {stats.messages?.success || 0}</span>
              <span>失败: {stats.messages?.failed || 0}</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e6f7ff',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #0f1a1a 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #e6f7ff 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(24, 144, 255, 0.1)'
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '10px', 
                background: '#13c2c2', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12
              }}>
                <SuccessIcon style={{ color: 'white', fontSize: '18px' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666', marginBottom: 2 }}>成功率</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme === 'dark' ? '#36cfc9' : '#13c2c2' }}>
                  {stats.messages?.total > 0 ? Math.round((stats.messages?.success / stats.messages?.total) * 100) : 0}%
                </div>
              </div>
            </div>
            <Progress 
              percent={stats.messages?.total > 0 ? Math.round((stats.messages?.success / stats.messages?.total) * 100) : 0} 
              size="small" 
              showInfo={false}
              strokeColor="#13c2c2"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Title level={3} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', color: theme === 'dark' ? '#ffffff' : '#000000' }}>
        <PlusOutlined style={{ marginRight: 8, color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
        快捷操作
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {quickActions.map((action, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card 
              hoverable
              style={{ 
                borderRadius: '12px',
                border: theme === 'dark' ? '1px solid #333333' : '1px solid #e8f4fd',
                background: theme === 'dark' 
                  ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                  : 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                boxShadow: theme === 'dark' 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 2px 8px rgba(24, 144, 255, 0.1)',
                height: '120px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              bodyStyle={{ padding: '20px', textAlign: 'center' }}
              onClick={action.action}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: '10px', 
                  background: action.color, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <div style={{ fontSize: '18px', color: 'white' }}>
                {action.icon}
              </div>
              </div>
                <div>
                  <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666', marginBottom: 2 }}>{action.title}</div>
                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#8c8c8c' : '#999' }}>{action.description}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 最近活动 */}
      <Title level={3}>
        <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
        最近活动
      </Title>
      <Card size="small" style={{ marginBottom: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#666' }}>加载中...</div>
          </div>
        ) : stats.recentActivity?.length > 0 ? (
          <List
            size="small"
            dataSource={stats.recentActivity || []}
            renderItem={(item, index) => (
              <List.Item>
                <Space>
                  {['success', 'sent', 'delivered'].includes(item.status) ? (
                    <SuccessIcon style={{ color: '#52c41a' }} />
                  ) : (
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  )}
                  <Text style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                  <Text>
                    {item.message_type === 'text' ? '文本消息' : 
                     item.message_type === 'image' ? '图片消息' : 
                     item.message_type === 'text_image' ? '图文消息' : 
                     item.message_type === 'rich_text' ? '富文本消息' : 
                     item.message_type === 'card' ? '卡片消息' : '未知类型'}
                  </Text>
                  <Tag color={['success', 'sent', 'delivered'].includes(item.status) ? 'success' : 'error'}>
                    {['success', 'sent', 'delivered'].includes(item.status) ? '成功' : '失败'}
                  </Tag>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            暂无活动记录
          </div>
        )}
      </Card>
      
      {/* 系统状态指示器 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatusIndicator status="success" size="small" />
        <StatusIndicator status="info" size="small" />
        <StatusIndicator status="warning" size="small" />
        <StatusIndicator status="processing" size="small" />
      </div>

      {/* 适用场景 */}
      <Title level={3} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', color: theme === 'dark' ? '#ffffff' : '#000000' }}>
        <InfoCircleOutlined style={{ marginRight: 8, color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
        适用场景
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e8f4fd',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a1a0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #fff7e6 0%, #f0f9ff 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(24, 144, 255, 0.08)',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            bodyStyle={{ padding: '20px', textAlign: 'center' }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '10px', 
              background: '#1890ff', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <UserOutlined style={{ color: 'white', fontSize: '18px' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, color: theme === 'dark' ? '#ffffff' : '#333' }}>多用户支持</div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>角色权限管理</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e6f7ff',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #0f1a1a 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(19, 194, 194, 0.08)',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            bodyStyle={{ padding: '20px', textAlign: 'center' }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '10px', 
              background: '#13c2c2', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <BgColorsOutlined style={{ color: 'white', fontSize: '18px' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, color: theme === 'dark' ? '#ffffff' : '#333' }}>深色模式</div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>双主题支持</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #f9f0ff',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a0f1a 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #f9f0ff 0%, #f0f9ff 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(114, 46, 209, 0.08)',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            bodyStyle={{ padding: '20px', textAlign: 'center' }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '10px', 
              background: '#722ed1', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <SwapOutlined style={{ color: 'white', fontSize: '18px' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, color: theme === 'dark' ? '#ffffff' : '#333' }}>身份切换</div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>实时权限变更</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #fff7e6',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a1a0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #fff7e6 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(250, 140, 22, 0.08)',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            bodyStyle={{ padding: '20px', textAlign: 'center' }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '10px', 
              background: '#fa8c16', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <CrownOutlined style={{ color: 'white', fontSize: '18px' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, color: theme === 'dark' ? '#ffffff' : '#333' }}>管理面板</div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>实时数据统计</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e8f5e8',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #0f1b0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #e8f5e8 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(82, 196, 26, 0.08)',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            bodyStyle={{ padding: '20px', textAlign: 'center' }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '10px', 
              background: '#52c41a', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <PictureOutlined style={{ color: 'white', fontSize: '18px' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, color: theme === 'dark' ? '#ffffff' : '#333' }}>图片管理</div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>URL链接生成</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card 
            hoverable
            style={{ 
              borderRadius: '12px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #fff1f0',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a0f0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #fff1f0 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(255, 77, 79, 0.08)',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
            bodyStyle={{ padding: '20px', textAlign: 'center' }}
          >
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: '10px', 
              background: '#ff4d4f', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <BarChartOutlined style={{ color: 'white', fontSize: '18px' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, color: theme === 'dark' ? '#ffffff' : '#333' }}>数据分析</div>
            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>推送效果统计</div>
          </Card>
        </Col>
      </Row>

      {/* 核心功能 */}
      <Title level={3} style={{ marginBottom: 20, display: 'flex', alignItems: 'center' }}>
        <QuestionCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        核心功能
      </Title>
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {features.map((feature, index) => (
          <Col xs={24} lg={12} key={index}>
            <Card 
              style={{ 
                borderRadius: '16px',
                border: theme === 'dark' ? '1px solid #333333' : '1px solid #f0f0f0',
                boxShadow: theme === 'dark' 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 4px 12px rgba(0,0,0,0.05)',
                height: '280px',
                display: 'flex',
                flexDirection: 'column',
                background: theme === 'dark' ? '#1a1a1a' : '#ffffff'
              }}
              bodyStyle={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '12px', 
                  background: `${feature.icon.props.style?.color || '#1890ff'}15`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 16
                }}>
                  {React.cloneElement(feature.icon, { 
                    style: { 
                      fontSize: '24px', 
                      color: feature.icon.props.style?.color || '#1890ff' 
                    } 
                  })}
              </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: theme === 'dark' ? '#ffffff' : '#333', marginBottom: 4 }}>
                    {feature.title}
                  </div>
                  <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>
                    {feature.description}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {feature.features.map((item, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      fontSize: '13px', 
                      color: '#666',
                      padding: '4px 0'
                    }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8, fontSize: '12px' }} />
                      <span style={{ lineHeight: '1.4' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '40px 0' }} />

      {/* 使用指南 */}
      <Title level={3} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', color: theme === 'dark' ? '#ffffff' : '#000000' }}>
        <QuestionCircleOutlined style={{ marginRight: 8, color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
        使用指南
      </Title>
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        {newFeatures.map((feature, index) => (
          <Col xs={24} lg={8} key={index}>
            <Card 
              style={{ 
                borderRadius: '16px',
                border: theme === 'dark' ? '1px solid #333333' : '1px solid #f0f0f0',
                boxShadow: theme === 'dark' 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 4px 12px rgba(0,0,0,0.05)',
                height: '280px',
                display: 'flex',
                flexDirection: 'column',
                background: theme === 'dark' ? '#1a1a1a' : '#ffffff'
              }}
              bodyStyle={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '12px', 
                  background: `${feature.icon.props.style?.color || '#1890ff'}15`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginRight: 16
                }}>
                  {React.cloneElement(feature.icon, { 
                    style: { 
                      fontSize: '24px', 
                      color: feature.icon.props.style?.color || '#1890ff' 
                    } 
                  })}
              </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: theme === 'dark' ? '#ffffff' : '#333', marginBottom: 4 }}>
                    {feature.title}
                  </div>
                  <div style={{ fontSize: '14px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>
                    {feature.description}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {feature.features.map((item, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      fontSize: '13px', 
                      color: '#666',
                      padding: '4px 0'
                    }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8, fontSize: '12px' }} />
                      <span style={{ lineHeight: '1.4' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '40px 0' }} />

      {/* 问题排查与使用技巧 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={12}>
          <Card 
            style={{ 
              borderRadius: '16px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #fff1f0',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #1a0f0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #fff1f0 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 4px 12px rgba(255, 77, 79, 0.1)',
              height: '100%'
            }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              marginBottom: 20, 
              color: theme === 'dark' ? '#ffffff' : '#333',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '8px', 
                background: '#ff4d4f', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12
              }}>
                <ExclamationCircleOutlined style={{ color: 'white', fontSize: '16px' }} />
              </div>
              <Title level={4} style={{ 
                margin: 0, 
                color: theme === 'dark' ? '#ffffff' : '#333'
              }}>
                常见问题排查
              </Title>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                'Webhook地址是否正确且有效',
                '网络连接是否正常',
                '消息内容是否符合企业微信规范',
                '推送频率是否超过限制（每分钟最多20条）',
                '深色模式下的文字对比度是否正常',
                '身份切换功能是否正常工作'
              ].map((item, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '12px',
                  background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)',
                  borderRadius: '8px',
                  border: theme === 'dark' ? '1px solid rgba(255, 77, 79, 0.3)' : '1px solid rgba(255, 77, 79, 0.1)'
                }}>
                  <div style={{ 
                    width: 20, 
                    height: 20, 
                    borderRadius: '50%', 
                    background: '#ff4d4f', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: 12,
                    fontSize: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    !
                  </div>
                  <Text style={{ fontSize: '14px', color: theme === 'dark' ? '#ffffff' : '#333' }}>{item}</Text>
                </div>
              ))}
            </div>
          </Card>
          </Col>
        <Col xs={24} lg={12}>
          <Card 
            style={{ 
              borderRadius: '16px',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #e8f5e8',
              background: theme === 'dark' 
                ? 'linear-gradient(135deg, #0f1b0f 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #e8f5e8 0%, #f6ffed 100%)',
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 4px 12px rgba(82, 196, 26, 0.1)',
              height: '100%'
            }}
            bodyStyle={{ padding: '24px' }}
          >
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              marginBottom: 20, 
              color: theme === 'dark' ? '#ffffff' : '#333',
              display: 'flex',
              alignItems: 'center'
            }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '8px', 
                background: '#52c41a', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12
              }}>
                <CheckCircleOutlined style={{ color: 'white', fontSize: '16px' }} />
              </div>
              <Title level={4} style={{ 
                margin: 0, 
                color: theme === 'dark' ? '#ffffff' : '#333'
              }}>
                使用技巧
              </Title>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                '深色模式：点击右上角主题切换按钮，支持自动保存偏好',
                '身份切换：管理员可在右上角角色标签中切换身份',
                '权限管理：在账户管理页面可实时调整用户角色和权限',
                '图片管理：支持拖拽上传，自动生成永久有效链接',
                '批量操作：支持批量推送、批量管理地址和图片',
                '实时统计：数据实时更新，推送状态即时反馈'
              ].map((item, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  padding: '12px',
                  background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)',
                  borderRadius: '8px',
                  border: theme === 'dark' ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid rgba(82, 196, 26, 0.1)'
                }}>
                  <div style={{ 
                    width: 20, 
                    height: 20, 
                    borderRadius: '50%', 
                    background: '#52c41a', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: 12,
                    fontSize: '10px',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    ✓
                  </div>
                  <Text style={{ fontSize: '14px', color: theme === 'dark' ? '#ffffff' : '#333' }}>{item}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Home; 