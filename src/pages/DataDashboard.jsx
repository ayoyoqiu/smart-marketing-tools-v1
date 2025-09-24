import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  DatePicker,
  Select,
  message,
  Spin,
  Typography,
  Progress
} from 'antd';
import {
  BarChartOutlined,
  RobotOutlined,
  TeamOutlined,
  MessageOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  FolderOutlined,
  CalendarOutlined,
  CrownOutlined,
  UserAddOutlined,
  LoginOutlined
} from '@ant-design/icons';
import { supabase, TABLES, TASK_STATUS, MESSAGE_TYPE } from '../../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useBatchDataCache } from '../hooks/useDataCache';
import ProfessionalCalendarView from '../components/Calendar/ProfessionalCalendarView';
import TaskDetailModal from '../components/Calendar/TaskDetailModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const DataDashboard = () => {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'day'),
    dayjs()
  ]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');
  const [viewMode, setViewMode] = useState('stats'); // 'stats' | 'calendar'
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);

  // 获取任务数据
  const fetchTasksData = useCallback(async () => {
    try {
      console.log('🔍 开始获取任务数据...');
      
      // 查询任务列表，包含scheduled_time字段用于日历显示
      let query = supabase.from(TABLES.TASKS).select('id,title,status,type,created_at,user_id,scheduled_time');
      
      // 如果不是管理员，只获取当前用户的任务
      console.log('🔍 任务数据 - 用户权限检查:', { 
        isAdmin: isAdmin(), 
        userId: user?.id,
        userIdSlice: user?.id?.slice(0,8),
        userRole: user?.role 
      });
      if (!isAdmin() && user?.id) {
        query = query.eq('user_id', user.id);
        console.log('🔍 应用用户权限过滤 - 只获取用户自己的任务');
      } else {
        console.log('🔍 管理员权限 - 获取所有任务');
      }
      
      // 根据选择的时间范围过滤数据
      if (selectedTimeframe === '7days') {
        const sevenDaysAgo = dayjs().subtract(7, 'day');
        console.log('🔍 任务数据 - 7天筛选:', sevenDaysAgo.toISOString());
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      } else if (selectedTimeframe === '30days') {
        const thirtyDaysAgo = dayjs().subtract(30, 'day');
        console.log('🔍 任务数据 - 30天筛选:', thirtyDaysAgo.toISOString());
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      } else if (selectedTimeframe === '90days') {
        const ninetyDaysAgo = dayjs().subtract(90, 'day');
        console.log('🔍 任务数据 - 90天筛选:', ninetyDaysAgo.toISOString());
        query = query.gte('created_at', ninetyDaysAgo.toISOString());
      } else if (selectedTimeframe === 'all') {
        console.log('🔍 任务数据 - 全部数据，不添加时间过滤');
      }
      
      const { data: tasks, error } = await query;
      
      if (error) {
        console.error('❌ 任务数据查询错误:', error);
        console.error('❌ 错误详情:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log(`✅ 任务数据查询成功 - ${selectedTimeframe} 筛选结果:`, tasks?.length || 0, '条');
      console.log('🔍 任务数据详情:', tasks);
      
      const byStatus = {};
      const byType = {};
      const allTasks = tasks || [];
    
      allTasks.forEach(task => {
        const status = task.status || 'pending';
        const type = task.type || 'text';
        
        byStatus[status] = (byStatus[status] || 0) + 1;
        byType[type] = (byType[type] || 0) + 1;
      });
      
      return {
        total: allTasks.length,
        byStatus,
        byType,
        allTasks
      };
    } catch (error) {
      console.error('❌ 获取任务数据失败:', error);
      // 返回空数据而不是抛出错误，避免整个应用崩溃
      return {
        total: 0,
        byStatus: {},
        byType: {},
        allTasks: []
      };
    }
  }, [user?.id, isAdmin(), selectedTimeframe]);

  // 获取Webhook数据
  const fetchWebhooksData = useCallback(async () => {
    // 先获取分组信息
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name');
    
    if (groupsError) throw groupsError;
    
    // 创建分组ID到名称的映射
    const groupMap = {};
    groups?.forEach(group => {
      groupMap[group.id] = group.name;
    });
    
    // 🔒 权限控制：普通用户只能看到自己的地址，管理员可以看到所有地址
    let query = supabase.from(TABLES.WEBHOOKS).select('*');
    
    if (!isAdmin() && user?.id) {
      // 普通用户只能看到自己的地址
      query = query.eq('user_id', user.id);
      console.log('🔍 地址统计 - 应用用户权限过滤，只统计用户自己的地址');
    } else {
      console.log('🔍 地址统计 - 管理员权限，统计所有地址');
    }
    
    const { data: webhooks, error } = await query;
    
    if (error) throw error;
    
    const byGroup = {};
    const allWebhooks = webhooks || [];
    
    allWebhooks.forEach(webhook => {
      const groupName = webhook.group_id ? 
        (groupMap[webhook.group_id] || '未知分组') : 
        '未分组';
      byGroup[groupName] = (byGroup[groupName] || 0) + 1;
    });
    
    return {
      total: allWebhooks.length,
      enabled: allWebhooks.filter(w => w.status === 'active').length,
      disabled: allWebhooks.filter(w => w.status !== 'active').length,
      byGroup,
      allWebhooks
    };
  }, [user?.id, isAdmin()]);

  // 获取消息数据
  const fetchMessagesData = useCallback(async () => {
    let query = supabase.from(TABLES.MESSAGE_HISTORY).select('*');
    
    // 如果不是管理员，只获取当前用户的消息
    console.log('🔍 消息数据 - 用户权限检查:', { isAdmin: isAdmin(), userId: user?.id });
    if (!isAdmin()) {
      query = query.eq('user_id', user.id);
      console.log('🔍 消息数据 - 应用用户权限过滤 - 只获取用户自己的消息');
    } else {
      console.log('🔍 消息数据 - 管理员权限 - 获取所有消息');
    }
    
    // 根据选择的时间范围过滤数据
    if (selectedTimeframe === '7days') {
      const sevenDaysAgo = dayjs().subtract(7, 'day');
      console.log('🔍 消息数据 - 7天筛选:', sevenDaysAgo.toISOString());
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (selectedTimeframe === '30days') {
      const thirtyDaysAgo = dayjs().subtract(30, 'day');
      console.log('🔍 消息数据 - 30天筛选:', thirtyDaysAgo.toISOString());
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    } else if (selectedTimeframe === '90days') {
      const ninetyDaysAgo = dayjs().subtract(90, 'day');
      console.log('🔍 消息数据 - 90天筛选:', ninetyDaysAgo.toISOString());
      query = query.gte('created_at', ninetyDaysAgo.toISOString());
    } else if (selectedTimeframe === 'all') {
      console.log('🔍 消息数据 - 全部数据，不添加时间过滤');
    }
    // 如果选择"全部数据"，则不添加时间过滤
    
    const { data: messages, error } = await query;
    if (error) throw error;
    
    console.log(`🔍 消息数据 - ${selectedTimeframe} 筛选结果:`, messages?.length || 0, '条');
    
    const byType = {};
    const allMessages = messages || [];
    
    allMessages.forEach(message => {
      let type = message.message_type || 'text';
      // 将 text 和 image 类型合并为 text_image
      if (type === 'text' || type === 'image') {
        type = 'text_image';
      }
      byType[type] = (byType[type] || 0) + 1;
    });
    
    return {
      total: allMessages.length,
      success: allMessages.filter(m => m.status === 'sent').length,
      failed: allMessages.filter(m => m.status === 'failed').length,
      byType,
      allMessages
    };
  }, [user?.id, isAdmin(), selectedTimeframe]);

  // 获取用户数据
  const fetchUsersData = useCallback(async () => {
    if (!isAdmin()) {
      return { total: 0, active: 0, inactive: 0, todayActive: 0, byRole: {}, recentUsers: [] };
    }
    
    const { count: totalUsers, error: totalError } = await supabase.from('users').select('*', { count: 'exact' });
    if (totalError) throw totalError;
    
    const { count: activeUsers, error: activeError } = await supabase.from('users').select('*', { count: 'exact' }).eq('status', 'active');
    if (activeError) throw activeError;
    
    const today = dayjs().startOf('day').toISOString();
    const { count: todayActiveUsers, error: todayError } = await supabase.from('users').select('*', { count: 'exact' }).gte('last_login_at', today);
    if (todayError) throw todayError;
    
    const { data: users, error: usersError } = await supabase.from('users').select('role, status, created_at, last_login_at, nickname').order('created_at', { ascending: false }).limit(10);
    if (usersError) throw usersError;
    
    const byRole = {};
    users?.forEach(user => {
      const role = user.role || 'user';
      if (!byRole[role]) { byRole[role] = 0; }
      byRole[role]++;
    });
    
    const recentUsers = users?.slice(0, 5) || [];
    
    return {
      total: totalUsers || 0,
      active: activeUsers || 0,
      inactive: (totalUsers || 0) - (activeUsers || 0),
      todayActive: todayActiveUsers || 0,
      byRole,
      recentUsers
    };
  }, [isAdmin]);

  // 使用批量缓存Hook
  const queries = useMemo(() => [
    { key: 'tasks', fetchFunction: fetchTasksData },
    { key: 'webhooks', fetchFunction: fetchWebhooksData },
    { key: 'messages', fetchFunction: fetchMessagesData },
    { key: 'users', fetchFunction: fetchUsersData }
  ], [fetchTasksData, fetchWebhooksData, fetchMessagesData, fetchUsersData]);

  const isAdminValue = isAdmin();
  
  console.log('🔍 useBatchDataCache 传入的 queries:', queries);
  console.log('🔍 queries 长度:', queries.length);
  console.log('🔍 queries 内容:', queries.map(q => ({ key: q.key, hasFunction: !!q.fetchFunction })));
  
  const { data: dashboardData, loading, fetchAllData, resetLoading } = useBatchDataCache(
    queries,
    [user?.id, isAdminValue, selectedTimeframe],
    5 * 60 * 1000 // 5分钟缓存
  );

  console.log('  - loading:', loading);
  console.log('  - dashboardData:', dashboardData);
  console.log('  - dashboardData类型:', typeof dashboardData);
  console.log('  - dashboardData键:', dashboardData ? Object.keys(dashboardData) : 'null');
  console.log('  - tasks数据:', dashboardData?.tasks);
  console.log('  - webhooks数据:', dashboardData?.webhooks);
  console.log('  - messages数据:', dashboardData?.messages);
  console.log('  - users数据:', dashboardData?.users);
  console.log('  - 用户信息:', user);
  console.log('  - 是否管理员:', isAdmin());
  console.log('  - 时间范围:', selectedTimeframe);


  // 当时间范围改变时，强制刷新数据
  useEffect(() => {
    if (selectedTimeframe && selectedTimeframe !== 'all') {
      console.log('🔄 时间范围改变，强制刷新数据:', selectedTimeframe);
      fetchAllData(true); // 强制刷新，忽略缓存
    }
  }, [selectedTimeframe, fetchAllData]);

  // 组件挂载时强制加载数据
  useEffect(() => {
    console.log('🔄 组件挂载，强制加载数据');
    fetchAllData(true);
  }, [fetchAllData]);

  // 强制重置loading状态 - 防止loading卡住
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.log('🔄 检测到loading状态卡住，强制重置');
        resetLoading();
      }
    }, 10000); // 10秒后检查

    return () => clearTimeout(timer);
  }, [loading, resetLoading]);


  // 刷新数据
  const refreshData = useCallback(async () => {
    try {
      await fetchAllData(true);
      message.success('数据刷新成功');
    } catch (error) {
      message.error('数据刷新失败');
      console.error('刷新数据失败:', error);
    }
  }, [fetchAllData]);

  // 任务点击处理 - 查询任务详细内容
  const handleTaskClick = useCallback(async (task) => {
    try {
      console.log('🔍 点击任务，查询详细内容:', {
        id: task.id,
        title: task.title,
        status: task.status,
        type: task.type
      });
      
      // 先尝试查询基本字段，避免权限问题
      let taskDetail = null;
      let error = null;
      
      // 尝试查询详细内容
      const { data: detailData, error: detailError } = await supabase
        .from(TABLES.TASKS)
        .select('id,title,status,type,created_at,user_id,content,scheduled_time,creator,group_category,error_message')
        .eq('id', task.id)
        .single();
      
      if (detailError) {
        console.log('⚠️ 详细查询失败，尝试基本查询:', detailError.message);
        // 如果详细查询失败，尝试基本查询
        const { data: basicData, error: basicError } = await supabase
          .from(TABLES.TASKS)
          .select('id,title,status,type,created_at,user_id')
          .eq('id', task.id)
          .single();
        
        if (basicError) {
          error = basicError;
        } else {
          taskDetail = basicData;
        }
      } else {
        taskDetail = detailData;
      }
      
      if (error) {
        console.error('❌ 查询任务详情失败:', {
          error,
          taskId: task.id,
          taskStatus: task.status,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        // 即使查询失败，也显示基本信息
        setSelectedTask(task);
      } else {
        console.log('✅ 任务详情查询成功:', {
          id: taskDetail.id,
          title: taskDetail.title,
          status: taskDetail.status,
          hasContent: !!taskDetail.content,
          contentLength: taskDetail.content ? taskDetail.content.length : 0
        });
        setSelectedTask(taskDetail);
      }
      
      setTaskDetailVisible(true);
    } catch (error) {
      console.error('❌ 任务点击处理失败:', error);
      // 出错时显示基本信息
      setSelectedTask(task);
      setTaskDetailVisible(true);
    }
  }, []);

  // 关闭任务详情
  const handleCloseTaskDetail = useCallback(() => {
    setTaskDetailVisible(false);
    setSelectedTask(null);
  }, []);

  // 柱状图数据处理
  const getTaskTypeBarData = useCallback(() => {
    const byType = dashboardData?.tasks?.byType || {};
    return Object.entries(byType).map(([type, count]) => ({
      type: getTypeDisplayName(type),
      value: count
    }));
  }, [dashboardData?.tasks?.byType]);

  const getWebhookGroupBarData = useCallback(() => {
    const byGroup = dashboardData?.webhooks?.byGroup || {};
    return Object.entries(byGroup).map(([group, count]) => ({
      type: group,
      value: count
    }));
  }, [dashboardData?.webhooks?.byGroup]);

  const getMessageTypeBarData = useCallback(() => {
    const byType = dashboardData?.messages?.byType || {};
    
    // 定义显示顺序
    const typeOrder = ['text_image', 'rich_text', 'card'];
    
    // 按照指定顺序构建数据
    const orderedData = [];
    typeOrder.forEach(type => {
      if (byType[type] && byType[type] > 0) {
        orderedData.push({
          type: getTypeDisplayName(type),
          value: byType[type]
        });
      }
    });
    
    // 添加其他类型（如果有的话）
    Object.entries(byType).forEach(([type, count]) => {
      if (!typeOrder.includes(type) && count > 0) {
        orderedData.push({
          type: getTypeDisplayName(type),
          value: count
        });
      }
    });
    
    return orderedData;
  }, [dashboardData?.messages?.byType]);

  const getUserRoleBarData = useCallback(() => {
    const byRole = dashboardData?.users?.byRole || {};
    return Object.entries(byRole).map(([role, count]) => ({
      type: role === 'super_admin' ? '超级管理员' :
            role === 'admin' ? '管理员' : '普通用户',
      value: count
    }));
  }, [dashboardData?.users?.byRole]);

  // 获取类型显示名称
  const getTypeDisplayName = (type) => {
    const typeMap = {
      'text': '图文消息',
      'rich_text': '富文本消息',
      'text_image': '图文消息',
      'image': '图文消息',
      'card': '卡片消息'
    };
    return typeMap[type] || type;
  };

  // 渲染柱状图
  const renderBarChart = (data, colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d']) => {
    if (!data || data.length === 0) {
      return <div style={{ color: '#999', fontSize: '14px', textAlign: 'center' }}>暂无数据</div>;
    }

    const maxValue = Math.max(...data.map(item => item.value));
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ minWidth: '60px', fontSize: '12px' }}>{item.type}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  height: '20px',
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: colors[index % colors.length],
                  borderRadius: '2px',
                  minWidth: item.value > 0 ? '4px' : '0px'
                }}
              />
              <span style={{ fontSize: '12px', color: '#666' }}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`dashboard-container ${isDark ? 'dark-mode' : 'light-mode'}`}
      style={{
        width: '100%',
        minHeight: '100%',
        color: isDark ? '#ffffff' : '#000000'
      }}
    >
      {/* 页面头部 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        padding: '16px 20px',
        background: isDark 
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' 
          : 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
        borderRadius: '0',
        color: isDark ? 'white' : '#333',
        border: isDark ? '1px solid #333333' : '1px solid #e8f4fd',
        boxShadow: isDark 
          ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
          : '0 2px 8px rgba(24, 144, 255, 0.1)',
        width: '100%'
      }}>
        <div>
          <Title level={2} style={{ color: isDark ? 'white' : '#1890ff', margin: 0 }}>数据看板</Title>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.8)' : '#666' }}>实时监控任务、地址和消息数据</Text>
        </div>
        <Space>
          <Button.Group>
                      <Button 
            type={viewMode === 'stats' ? 'primary' : 'default'}
            icon={<BarChartOutlined />}
            onClick={() => setViewMode('stats')}
            style={isDark ? {
              backgroundColor: viewMode === 'stats' ? '#40a9ff' : '#2a2a2a',
              borderColor: viewMode === 'stats' ? '#40a9ff' : '#404040',
              color: '#ffffff',
              fontWeight: '500'
            } : {}}
          >
            统计视图
          </Button>
          <Button 
            type={viewMode === 'calendar' ? 'primary' : 'default'}
            icon={<CalendarOutlined />}
            onClick={() => setViewMode('calendar')}
            style={isDark ? {
              backgroundColor: viewMode === 'calendar' ? '#40a9ff' : '#2a2a2a',
              borderColor: viewMode === 'calendar' ? '#40a9ff' : '#404040',
              color: '#ffffff',
              fontWeight: '500'
            } : {}}
          >
            日历视图
          </Button>
          </Button.Group>
          <Select
            value={selectedTimeframe}
            onChange={setSelectedTimeframe}
            style={{ 
              width: 120,
              ...(isDark ? {
                backgroundColor: '#2a2a2a',
                borderColor: '#404040',
                color: '#ffffff'
              } : {})
            }}
          >
            <Option value="all">全部数据</Option>
            <Option value="7days">最近7天</Option>
            <Option value="30days">最近30天</Option>
            <Option value="90days">最近90天</Option>
          </Select>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={refreshData}
            style={isDark ? {
              backgroundColor: '#2a2a2a',
              borderColor: '#404040',
              color: '#ffffff',
              fontWeight: '500'
            } : {}}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {viewMode === 'stats' ? (
          <>
            <style>
              {`
                /* 统一布局优化 - 所有用户使用相同样式 */
                .stats-row.unified-layout {
                  justify-content: space-between !important;
                  gap: 16px !important;
                }
                
                .stats-row.unified-layout .ant-col {
                  flex: 1 !important;
                  min-width: 0 !important;
                  max-width: none !important;
                }
                
                @media (max-width: 1200px) {
                  .stats-row .ant-col {
                    padding-right: 2px !important;
                  }
                  
                  .stats-row.unified-layout {
                    justify-content: space-around !important;
                  }
                }
                
                @media (max-width: 768px) {
                  .stats-row .ant-col {
                    padding-right: 0px !important;
                    margin-bottom: 12px !important;
                  }
                  
                  .stats-row.unified-layout {
                    justify-content: center !important;
                    flex-direction: column !important;
                  }
                  
                  .stats-row.unified-layout .ant-col {
                    flex: none !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: auto !important;
                  }
                }
                
                @media (max-width: 480px) {
                  .stats-row .ant-col {
                    padding-right: 0px !important;
                    margin-bottom: 8px !important;
                  }
                }
                
                /* 深色模式下的统计卡片优化 */
                ${isDark ? `
                  .stats-card {
                    background-color: #1a1a1a !important;
                    border-color: #333333 !important;
                    color: #ffffff !important;
                  }
                  
                  .stats-card .ant-card-head {
                    background-color: #1a1a1a !important;
                    border-bottom-color: #333333 !important;
                  }
                  
                  .stats-card .ant-card-head-title {
                    color: #ffffff !important;
                    font-weight: 600 !important;
                  }
                  
                  .stats-card .ant-card-body {
                    background-color: #1a1a1a !important;
                    color: #ffffff !important;
                  }
                  
                  .stats-card .ant-statistic-title {
                    color: #d0d0d0 !important;
                    font-weight: 500 !important;
                  }
                  
                  .stats-card .ant-statistic-content {
                    color: #ffffff !important;
                    font-weight: 600 !important;
                  }
                  
                  .stats-card .ant-statistic .anticon {
                    color: #40a9ff !important;
                  }
                  
                  .stats-card .ant-typography {
                    color: #ffffff !important;
                  }
                  
                  .stats-card .ant-typography.ant-typography-secondary {
                    color: #8c8c8c !important;
                  }
                  
                  .stats-card .ant-tag {
                    font-weight: 600 !important;
                    border-radius: 4px !important;
                  }
                  
                  .stats-card .ant-tag-blue {
                    background-color: rgba(24, 144, 255, 0.25) !important;
                    border-color: #40a9ff !important;
                    color: #69c0ff !important;
                  }
                  
                  .stats-card .ant-tag-green {
                    background-color: rgba(82, 196, 26, 0.25) !important;
                    border-color: #52c41a !important;
                    color: #73d13d !important;
                  }
                  
                  .stats-card .ant-tag-red {
                    background-color: rgba(255, 77, 79, 0.25) !important;
                    border-color: #ff4d4f !important;
                    color: #ff7875 !important;
                  }
                  
                  .stats-card .ant-tag-orange {
                    background-color: rgba(250, 173, 20, 0.25) !important;
                    border-color: #faad14 !important;
                    color: #ffc53d !important;
                  }
                  
                  .stats-card .ant-tag-purple {
                    background-color: rgba(114, 46, 209, 0.25) !important;
                    border-color: #722ed1 !important;
                    color: #b37feb !important;
                  }
                  
                  .stats-card .ant-progress-text {
                    color: #ffffff !important;
                    font-weight: 500 !important;
                  }
                  
                  .stats-card .ant-progress-bg {
                    background-color: #40a9ff !important;
                  }
                  
                  .stats-card .ant-progress-outer .ant-progress-inner {
                    background-color: #2a2a2a !important;
                  }
                  
                  /* 浅色模式下的主容器优化 */
                  .dashboard-container.light-mode {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                  }
                  
                  /* 深色模式下的主容器优化 */
                  .dashboard-container.dark-mode {
                    background-color: #141414 !important;
                    color: #ffffff !important;
                  }
                  
                  /* 浅色模式下的加载状态优化 */
                  .dashboard-container.light-mode .ant-spin-container,
                  .dashboard-container.light-mode .ant-spin-blur {
                    background-color: #ffffff !important;
                  }
                  
                  /* 深色模式下的加载状态优化 */
                  .dashboard-container.dark-mode .ant-spin-container,
                  .dashboard-container.dark-mode .ant-spin-blur {
                    background-color: #141414 !important;
                  }
                  
                  /* 深色模式下的空状态优化 */
                  .ant-empty-description {
                    color: #8c8c8c !important;
                  }
                  
                  .ant-empty-img-default {
                    opacity: 0.6 !important;
                  }
                  
                  /* 深色模式下的工具提示优化 */
                  .ant-tooltip-inner {
                    background-color: #2a2a2a !important;
                    color: #ffffff !important;
                    border: 1px solid #404040 !important;
                  }
                  
                  .ant-tooltip-arrow::before {
                    background-color: #2a2a2a !important;
                    border: 1px solid #404040 !important;
                  }
                ` : ''}
              `}
            </style>
            {/* 统计卡片 - 根据用户权限优化布局 */}
            <Row 
              className="stats-row unified-layout"
              gutter={[16, 16]} 
              style={{ 
                marginBottom: '16px', 
                width: '100%', 
                marginLeft: '0', 
                marginRight: '0', 
                paddingLeft: '0', 
                paddingRight: '0', 
                display: 'flex', 
                flexWrap: 'nowrap',
                justifyContent: 'space-between',
                alignItems: 'stretch'
              }}
            >
              {/* 任务统计 */}
              <Col 
                xs={24} 
                sm={12} 
                md={6} 
                lg={6} 
                xl={6} 
                style={{ 
                  paddingLeft: '0', 
                  paddingRight: '0', 
                  marginBottom: '16px',
                  flex: '1',
                  minWidth: '0'
                }}
              >
                <Card 
                  className="stats-card"
                  title="任务统计" 
                  style={{ 
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    minHeight: '350px'
                  }}
                  bodyStyle={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    paddingBottom: '24px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    <div>
                      <Statistic
                        title="总任务数"
                        value={dashboardData?.tasks?.total || 0}
                        prefix={<UserOutlined />}
                        valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="等待中"
                        value={dashboardData?.tasks?.byStatus?.pending || 0}
                        prefix={<ClockCircleOutlined />}
                        valueStyle={{ color: '#faad14', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="已完成"
                        value={dashboardData?.tasks?.byStatus?.completed || 0}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="失败"
                        value={dashboardData?.tasks?.byStatus?.failed || 0}
                        prefix={<ExclamationCircleOutlined />}
                        valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, height: '120px' }}>
                    <Text strong>任务类型分布：</Text>
                    <div style={{ marginTop: '8px', height: '100px' }}>
                      {renderBarChart(getTaskTypeBarData(), ['#1890ff', '#52c41a', '#faad14', '#f5222d'])}
                    </div>
                  </div>
                </Card>
              </Col>

              {/* 地址统计 */}
              <Col 
                xs={24} 
                sm={12} 
                md={6} 
                lg={6} 
                xl={6} 
                style={{ 
                  paddingLeft: '0', 
                  paddingRight: '0', 
                  marginBottom: '16px',
                  flex: '1',
                  minWidth: '0'
                }}
              >
                <Card 
                  className="stats-card"
                  title="地址统计" 
                  style={{ 
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    minHeight: '350px'
                  }}
                  bodyStyle={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    paddingBottom: '24px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    <div>
                      <Statistic
                        title="总地址数"
                        value={dashboardData?.webhooks?.total || 0}
                        prefix={<RobotOutlined />}
                        valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="启用地址"
                        value={dashboardData?.webhooks?.enabled || 0}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="禁用地址"
                        value={dashboardData?.webhooks?.disabled || 0}
                        prefix={<ExclamationCircleOutlined />}
                        valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="启用率"
                        value={dashboardData?.webhooks?.total > 0 ? 
                          Math.round((dashboardData.webhooks.enabled / dashboardData.webhooks.total) * 100) : 0}
                        suffix="%"
                        prefix={<UserOutlined />}
                        valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, height: '120px' }}>
                    <Text strong>分组分布：</Text>
                    <div style={{ marginTop: '8px', height: '100px' }}>
                      {renderBarChart(getWebhookGroupBarData(), ['#52c41a', '#1890ff', '#faad14', '#f5222d'])}
                    </div>
                  </div>
                </Card>
              </Col>

              {/* 消息统计 */}
              <Col 
                xs={24} 
                sm={12} 
                md={6} 
                lg={6} 
                xl={6} 
                style={{ 
                  paddingLeft: '0', 
                  paddingRight: '0', 
                  marginBottom: '16px',
                  flex: '1',
                  minWidth: '0'
                }}
              >
                <Card 
                  className="stats-card"
                  title="消息统计" 
                  style={{ 
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    minHeight: '350px'
                  }}
                  bodyStyle={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    paddingBottom: '24px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    <div>
                      <Statistic
                        title="总消息数"
                        value={dashboardData?.messages?.total || 0}
                        prefix={<MessageOutlined />}
                        valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="发送成功"
                        value={dashboardData?.messages?.success || 0}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="发送失败"
                        value={dashboardData?.messages?.failed || 0}
                        prefix={<ExclamationCircleOutlined />}
                        valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
                      />
                    </div>
                    <div>
                      <Statistic
                        title="成功率"
                        value={dashboardData?.messages?.total > 0 ? 
                          Math.round((dashboardData.messages.success / dashboardData.messages.total) * 100) : 0}
                        suffix="%"
                        prefix={<UserOutlined />}
                        valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, height: '120px' }}>
                    <Text strong>消息类型分布：</Text>
                    <div style={{ marginTop: '8px', height: '100px' }}>
                      {renderBarChart(getMessageTypeBarData(), ['#faad14', '#1890ff', '#52c41a', '#f5222d'])}
                    </div>
                  </div>
                </Card>
              </Col>

              {/* 用户统计 - 仅管理员可见 */}
              {isAdmin() && (
                <Col 
                  xs={24}
                  sm={12}
                  md={6}
                  lg={6}
                  xl={6}
                  style={{ 
                    paddingLeft: '0', 
                    paddingRight: '0', 
                    marginBottom: '16px',
                    flex: '1',
                    minWidth: '0'
                  }}
                >
                  <Card 
                    className="stats-card"
                    title="用户统计" 
                    style={{ 
                      height: '400px',
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                    minHeight: '350px'
                    }}
                    bodyStyle={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column',
                      paddingBottom: '24px'
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                      <div>
                        <Statistic
                          title="总用户数"
                          value={dashboardData?.users?.total || 0}
                          prefix={<TeamOutlined />}
                          valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Statistic
                          title="活跃用户"
                          value={dashboardData?.users?.active || 0}
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Statistic
                          title="今日活跃"
                          value={dashboardData?.users?.todayActive || 0}
                          prefix={<LoginOutlined />}
                          valueStyle={{ color: '#faad14', fontSize: '16px' }}
                        />
                      </div>
                      <div>
                        <Statistic
                          title="非活跃"
                          value={dashboardData?.users?.inactive || 0}
                          prefix={<ExclamationCircleOutlined />}
                          valueStyle={{ color: '#ff4d4f', fontSize: '16px' }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ flex: 1, height: '120px' }}>
                      <Text strong>角色分布：</Text>
                      <div style={{ marginTop: '8px', height: '100px' }}>
                        {renderBarChart(getUserRoleBarData(), ['#722ed1', '#1890ff', '#52c41a', '#f5222d'])}
                      </div>
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          </>
        ) : (
          /* 日历视图 */
          <div style={{ width: '100%', overflow: 'hidden' }}>
            <ProfessionalCalendarView
              tasks={dashboardData?.tasks?.allTasks || []}
              loading={loading}
              onTaskClick={handleTaskClick}
            />
          </div>
        )}
      </Spin>
      
      <TaskDetailModal
        visible={taskDetailVisible}
        task={selectedTask}
        onClose={handleCloseTaskDetail}
      />
    </div>
  );
};

export default DataDashboard;