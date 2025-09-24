import React, { useState, useMemo } from 'react';
import { Card, Empty, Spin, Typography, Tag, Space, Button, Row, Col, Tooltip, Modal, Descriptions, Divider } from 'antd';
import { 
  CalendarOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  PlayCircleOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  MessageOutlined,
  RobotOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import { useTheme } from '../contexts/ThemeContext';
import { TASK_STATUS, MESSAGE_TYPE } from '../../supabaseClient';

// 配置dayjs的weekday插件
dayjs.extend(weekday);

const { Title, Text, Paragraph } = Typography;

// 任务详情模态框组件
const TaskDetailModal = ({ 
  visible, 
  task, 
  onClose, 
  onEdit, 
  onDelete 
}) => {
  if (!task) return null;

  // 获取任务状态信息
  const getStatusInfo = (status) => {
    const statusMap = {
      [TASK_STATUS.PENDING]: { 
        color: 'orange', 
        text: '等待中', 
        icon: <ClockCircleOutlined /> 
      },
      [TASK_STATUS.RUNNING]: { 
        color: 'blue', 
        text: '执行中', 
        icon: <PlayCircleOutlined /> 
      },
      [TASK_STATUS.COMPLETED]: { 
        color: 'green', 
        text: '已完成', 
        icon: <CheckCircleOutlined /> 
      },
      [TASK_STATUS.FAILED]: { 
        color: 'red', 
        text: '失败', 
        icon: <ExclamationCircleOutlined /> 
      },
    };
    return statusMap[status] || { color: 'default', text: '未知', icon: <ClockCircleOutlined /> };
  };

  // 获取消息类型显示名称
  const getTypeDisplayName = (type) => {
    const typeMap = {
      [MESSAGE_TYPE.TEXT_IMAGE]: '图文消息',
      [MESSAGE_TYPE.RICH_TEXT]: '富文本消息',
      [MESSAGE_TYPE.CARD]: '卡片消息',
      'text_image': '图文消息',
      'rich_text': '富文本消息',
      'card': '卡片消息',
      'text': '图文消息',
      'image': '图文消息',
      'html': '富文本消息',
      'markdown': '富文本消息',
      'textcard': '卡片消息'
    };
    return typeMap[type] || '图文消息';
  };

  // 渲染消息内容
  const renderMessageContent = (content, type) => {
    if (!content) return <Text type="secondary">无内容</Text>;

    try {
      const contentObj = typeof content === 'string' ? JSON.parse(content) : content;
      
      switch (type) {
        case MESSAGE_TYPE.TEXT_IMAGE:
          return (
            <div>
              {contentObj.text && (
                <Paragraph style={{ marginBottom: '8px' }}>
                  <Text strong>文本内容：</Text>
                  <br />
                  {contentObj.text}
                </Paragraph>
              )}
              {contentObj.image && contentObj.image.base64 && (
                <div>
                  <Text strong>图片：</Text>
                  <br />
                  <img 
                    src={`data:${contentObj.image.type};base64,${contentObj.image.base64}`}
                    alt="任务图片"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '200px', 
                      borderRadius: '4px',
                      marginTop: '8px'
                    }}
                  />
                </div>
              )}
            </div>
          );
        
        case MESSAGE_TYPE.RICH_TEXT:
          return (
            <div>
              <Text strong>富文本内容：</Text>
              <div 
                style={{ 
                  marginTop: '8px',
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9'
                }}
                dangerouslySetInnerHTML={{ __html: contentObj.richText || contentObj.text || '' }}
              />
            </div>
          );
        
        case MESSAGE_TYPE.CARD:
          return (
            <Card size="small" style={{ marginTop: '8px' }}>
              <div>
                <Text strong>卡片标题：</Text>
                <br />
                <Text>{contentObj.title || '无标题'}</Text>
              </div>
              {contentObj.description && (
                <div style={{ marginTop: '8px' }}>
                  <Text strong>描述：</Text>
                  <br />
                  <Text>{contentObj.description}</Text>
                </div>
              )}
              {contentObj.url && (
                <div style={{ marginTop: '8px' }}>
                  <Text strong>链接：</Text>
                  <br />
                  <a href={contentObj.url} target="_blank" rel="noopener noreferrer">
                    {contentObj.url}
                  </a>
                </div>
              )}
            </Card>
          );
        
        default:
          return <Text>{JSON.stringify(contentObj, null, 2)}</Text>;
      }
    } catch (error) {
      return <Text type="secondary">内容解析失败</Text>;
    }
  };

  const statusInfo = getStatusInfo(task.status);
  const typeName = getTypeDisplayName(task.type);

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>任务详情</span>
          <Tag color={statusInfo.color} icon={statusInfo.icon}>
            {statusInfo.text}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        onEdit && (
          <Button key="edit" type="primary" onClick={() => onEdit(task)}>
            编辑任务
          </Button>
        ),
        onDelete && task.status === TASK_STATUS.PENDING && (
          <Button key="delete" danger onClick={() => onDelete(task)}>
            删除任务
          </Button>
        )
      ]}
    >
      <Descriptions column={2} bordered>
        <Descriptions.Item label="任务标题" span={2}>
          <Text strong>{task.title || '未命名任务'}</Text>
        </Descriptions.Item>
        
        <Descriptions.Item label="任务状态">
          <Tag color={statusInfo.color} icon={statusInfo.icon}>
            {statusInfo.text}
          </Tag>
        </Descriptions.Item>
        
        <Descriptions.Item label="消息类型">
          <Tag color="blue">{typeName}</Tag>
        </Descriptions.Item>
        
        <Descriptions.Item label="创建时间">
          <Space>
            <CalendarOutlined />
            {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Space>
        </Descriptions.Item>
        
        <Descriptions.Item label="计划时间">
          <Space>
            <ClockCircleOutlined />
            {task.scheduled_time ? 
              dayjs(task.scheduled_time).format('YYYY-MM-DD HH:mm:ss') : 
              '立即执行'
            }
          </Space>
        </Descriptions.Item>
        
        <Descriptions.Item label="创建者">
          <Space>
            <UserOutlined />
            {task.creator || '未知用户'}
          </Space>
        </Descriptions.Item>
        
        <Descriptions.Item label="任务ID">
          <Text code>{task.id}</Text>
        </Descriptions.Item>
        
        {task.group_category && (
          <Descriptions.Item label="目标分组" span={2}>
            <Tag color="green">
              {Array.isArray(task.group_category) ? 
                task.group_category.join(', ') : 
                task.group_category
              }
            </Tag>
          </Descriptions.Item>
        )}
        
        {task.error_message && (
          <Descriptions.Item label="错误信息" span={2}>
            <Text type="danger">{task.error_message}</Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider />

      <div>
        <Title level={5}>
          <MessageOutlined style={{ marginRight: '8px' }} />
          消息内容
        </Title>
        {renderMessageContent(task.content, task.type)}
      </div>
    </Modal>
  );
};

// 专业日历视图组件
const ProfessionalCalendarView = ({ tasks = [], loading = false, onTaskClick }) => {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [viewMode, setViewMode] = useState('month'); // 'month' 或 'week'
  const { theme } = useTheme();

  // 深色模式样式配置
  const isDark = theme === 'dark';
  const themeStyles = {
    card: {
      background: isDark ? '#1a1a1a' : '#f8f9fa',
      border: 'none',
      boxShadow: isDark ? '0 2px 8px rgba(255,255,255,0.1)' : '0 2px 8px rgba(0,0,0,0.1)',
      width: '100%',
      margin: '0',
      padding: '0',
      borderRadius: '8px',
      maxWidth: '100%',
      overflow: 'hidden'
    },
    calendarContainer: {
      background: isDark ? '#0a0a0a' : 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      width: '100%',
      padding: '16px',
      maxWidth: '100%'
    },
    header: {
      background: isDark 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' 
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '20px',
      display: 'grid',
      gridTemplateColumns: '120px 1fr 120px',
      alignItems: 'center',
      gap: '16px'
    },
    button: {
      color: 'white',
      border: '1px solid rgba(255,255,255,0.3)',
      background: 'rgba(255,255,255,0.1)'
    },
    weekHeader: {
      background: isDark ? '#2a2a2a' : '#f5f5f5',
      borderBottom: isDark ? '2px solid #333' : '2px solid #e8e8e8'
    },
    weekDay: {
      textAlign: 'center',
      padding: '12px 8px',
      fontWeight: '600',
      color: isDark ? '#e0e0e0' : '#666',
      fontSize: '14px',
      borderRight: isDark ? '1px solid #333' : '1px solid #e8e8e8'
    },
    dayCell: {
      minHeight: viewMode === 'week' ? '180px' : '120px',
      padding: '8px',
      borderRight: isDark ? '1px solid #333' : '1px solid #e8e8e8',
      borderBottom: isDark ? '1px solid #333' : '1px solid #e8e8e8',
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 0.2s ease'
    },
    dayNumber: {
      fontWeight: 'normal',
      fontSize: '16px'
    },
    todayIndicator: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: '#ff4d4f'
    },
    taskItem: {
      color: 'white',
      padding: '4px 6px',
      borderRadius: '4px',
      fontSize: '11px',
      marginBottom: '3px',
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'all 0.2s ease'
    },
    moreIndicator: {
      fontSize: '10px',
      color: isDark ? '#999' : '#999',
      textAlign: 'center',
      background: isDark ? '#333' : '#f0f0f0',
      padding: '2px 4px',
      borderRadius: '2px',
      cursor: 'pointer'
    }
  };

  // 将任务按日期分组
  const tasksByDate = useMemo(() => {
    const grouped = {};
    console.log('📅 处理任务日期分组:', tasks.length, '个任务');
    
    tasks.forEach(task => {
      const scheduledTime = task.scheduled_time;
      const createdAt = task.created_at;
      
      // 优先使用 scheduled_time，如果没有则使用 created_at
      const dateToUse = scheduledTime || createdAt;
      const date = dayjs(dateToUse).format('YYYY-MM-DD');
      
      console.log('📅 任务日期处理:', {
        id: task.id?.slice(0, 8),
        title: task.title,
        scheduledTime: scheduledTime,
        createdAt: createdAt,
        dateToUse: dateToUse,
        formattedDate: date,
        dayjsObj: dayjs(dateToUse).format('YYYY-MM-DD HH:mm:ss')
      });
      
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(task);
    });
    
    console.log('📅 任务日期分组结果:', Object.keys(grouped).map(date => ({
      date,
      count: grouped[date].length,
      tasks: grouped[date].map(t => t.title)
    })));
    
    return grouped;
  }, [tasks]);

  // 生成当前月份的日期网格
  const generateCalendarGrid = () => {
    if (viewMode === 'week') {
      // 周视图：显示当前周的所有7天
      const startOfWeek = selectedDate.startOf('week');
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(startOfWeek.add(i, 'day'));
      }
      return days;
    } else {
      // 月视图：显示整个月的网格
      const startOfMonth = selectedDate.startOf('month');
      const endOfMonth = selectedDate.endOf('month');
      const startOfWeek = startOfMonth.startOf('week');
      const endOfWeek = endOfMonth.endOf('week');
      
      const days = [];
      let current = startOfWeek;
      
      while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
        days.push(current);
        current = current.add(1, 'day');
      }
      
      return days;
    }
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#faad14',
      'running': '#1890ff',
      'completed': '#52c41a',
      'failed': '#ff4d4f',
    };
    return colorMap[status] || '#d9d9d9';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'pending': <ClockCircleOutlined style={{ fontSize: '10px' }} />,
      'running': <PlayCircleOutlined style={{ fontSize: '10px' }} />,
      'completed': <CheckCircleOutlined style={{ fontSize: '10px' }} />,
      'failed': <ExclamationCircleOutlined style={{ fontSize: '10px' }} />,
    };
    return iconMap[status] || <ClockCircleOutlined style={{ fontSize: '10px' }} />;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (viewMode === 'month') {
      setViewMode('week');
    }
  };

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const goToToday = () => {
    setSelectedDate(dayjs());
  };

  const goToThisWeek = () => {
    setSelectedDate(dayjs());
    setViewMode('week');
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>加载任务数据中...</div>
        </div>
      </Card>
    );
  }

  const calendarDays = generateCalendarGrid();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <>
      <style>
        {`
          @media (max-width: 1200px) {
            .calendar-container {
              padding: 12px !important;
            }
            .calendar-header {
              flex-direction: column !important;
              gap: 12px !important;
            }
            .calendar-title {
              font-size: 18px !important;
            }
            .calendar-controls {
              width: 100% !important;
              justify-content: center !important;
            }
          }
          @media (max-width: 768px) {
            .calendar-container {
              padding: 8px !important;
            }
            .calendar-title {
              font-size: 16px !important;
            }
            .calendar-day {
              min-height: 80px !important;
            }
            .calendar-task {
              font-size: 12px !important;
              padding: 4px 6px !important;
            }
          }
          @media (max-width: 480px) {
            .calendar-container {
              padding: 4px !important;
            }
            .calendar-day {
              min-height: 60px !important;
            }
            .calendar-task {
              font-size: 10px !important;
              padding: 2px 4px !important;
            }
          }
        `}
      </style>
      <Card 
        title={
          <div className="calendar-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarOutlined style={{ fontSize: '20px', color: isDark ? '#1890ff' : '#1890ff' }} />
            <span className="calendar-title" style={{ fontSize: '18px', fontWeight: '600' }}>任务日历</span>
            <Tag color="blue" style={{ marginLeft: '8px' }}>{tasks.length} 个任务</Tag>
          </div>
        }
        style={themeStyles.card}
      >
      {tasks.length === 0 ? (
        <Empty 
          description="暂无任务数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '40px 0' }}
        />
      ) : (
        <div className="calendar-container" style={themeStyles.calendarContainer}>
          {/* 月份导航头部 */}
          <div style={themeStyles.header}>
            {/* 左侧按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button 
                type="text"
                icon={<LeftOutlined />}
                onClick={() => setSelectedDate(selectedDate.subtract(1, viewMode === 'week' ? 'week' : 'month'))}
                style={{ 
                  ...themeStyles.button,
                  minWidth: '80px'
                }}
              >
                {viewMode === 'week' ? '上周' : '上个月'}
              </Button>
            </div>
            
            {/* 中间月份标题 */}
            <div style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Title level={2} style={{ 
                color: 'white', 
                margin: 0, 
                fontSize: '24px',
                textAlign: 'center',
                width: '100%'
              }}>
                {viewMode === 'week' 
                  ? `${selectedDate.startOf('week').format('YYYY年MM月DD日')} - ${selectedDate.endOf('week').format('MM月DD日')}`
                  : selectedDate.format('YYYY年MM月')
                }
              </Title>
            </div>
            
            {/* 右侧按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button 
                type="text"
                onClick={() => setViewMode(viewMode === 'month' ? 'week' : 'month')}
                style={{ 
                  ...themeStyles.button,
                  minWidth: '60px'
                }}
              >
                {viewMode === 'month' ? '周视图' : '月视图'}
              </Button>
              <Button 
                type="text"
                onClick={goToThisWeek}
                style={{ 
                  ...themeStyles.button,
                  minWidth: '60px'
                }}
              >
                本周
              </Button>
              <Button 
                type="text"
                icon={<RightOutlined />}
                onClick={() => setSelectedDate(selectedDate.add(1, viewMode === 'week' ? 'week' : 'month'))}
                style={{ 
                  ...themeStyles.button,
                  minWidth: '80px'
                }}
              >
                {viewMode === 'week' ? '下周' : '下个月'}
              </Button>
            </div>
          </div>

          {/* 星期标题 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)',
            ...themeStyles.weekHeader
          }}>
            {weekDays.map(day => (
              <div 
                key={day}
                style={themeStyles.weekDay}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="calendar-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)',
            minHeight: viewMode === 'week' ? '400px' : '500px'
          }}>
            {calendarDays.map(date => {
              const dateStr = date.format('YYYY-MM-DD');
              const dayTasks = tasksByDate[dateStr] || [];
              const isCurrentMonth = viewMode === 'week' ? true : date.isSame(selectedDate, 'month');
              const isToday = date.isSame(dayjs(), 'day');
              const dayOfWeek = date.day(); // 0=周日, 1=周一, ..., 6=周六
              const weekdayValue = date.weekday(); // 0=周日, 1=周一, ..., 6=周六
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isSaturday = dayOfWeek === 6;
              const isSunday = dayOfWeek === 0;
              
              if (viewMode === 'week') {
                console.log(`日期: ${dateStr}, day(): ${dayOfWeek}, weekday(): ${weekdayValue}, 周六: ${isSaturday}, 周日: ${isSunday}, 格式化: ${date.format('dddd')}`);
              }
              
              return (
                <div
                  key={dateStr}
                  className={`calendar-day calendar-day-cell ${isWeekend && isCurrentMonth ? 'calendar-weekend' : ''} ${!isCurrentMonth ? 'calendar-other-month' : ''} ${isSaturday && isCurrentMonth ? 'calendar-saturday' : ''} ${isSunday && isCurrentMonth ? 'calendar-sunday' : ''}`}
                  style={{
                    ...themeStyles.dayCell,
                    background: isCurrentMonth 
                      ? (isDark ? '#0a0a0a' : '#fff') 
                      : (isDark ? '#1a1a1a' : '#fafafa'),
                    ...(isWeekend && isCurrentMonth && { 
                      background: isDark ? '#111111' : '#f9f9f9' 
                    }),
                    // 周日特殊样式 - 优先应用
                    ...(isSunday && isCurrentMonth && {
                      background: isDark ? '#1a0f0f' : '#fff5f5',
                      borderRight: isDark ? '3px solid #ff4d4f' : '3px solid #ff4d4f'
                    }),
                    // 周六特殊样式 - 后应用
                    ...(isSaturday && isCurrentMonth && {
                      background: isDark ? '#0f1a2e' : '#f0f8ff',
                      borderRight: isDark ? '3px solid #1890ff' : '3px solid #1890ff'
                    })
                  }}
                  onMouseEnter={(e) => {
                    if (isCurrentMonth) {
                      if (isSaturday) {
                        e.currentTarget.style.background = isDark ? '#1a2a3e' : '#e6f7ff';
                      } else if (isSunday) {
                        e.currentTarget.style.background = isDark ? '#2e1a1a' : '#ffe6e6';
                      } else {
                        e.currentTarget.style.background = isDark ? '#1a1a2e' : '#f0f8ff';
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isCurrentMonth) {
                      if (isSaturday) {
                        e.currentTarget.style.background = isDark ? '#0f1a2e' : '#f0f8ff';
                      } else if (isSunday) {
                        e.currentTarget.style.background = isDark ? '#1a0f0f' : '#fff5f5';
                      } else if (isWeekend) {
                        e.currentTarget.style.background = isDark ? '#111111' : '#f9f9f9';
                      } else {
                        e.currentTarget.style.background = isDark ? '#0a0a0a' : '#fff';
                      }
                    }
                  }}
                  onClick={() => handleDateClick(date)}
                >
                  {/* 日期数字 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{
                        ...themeStyles.dayNumber,
                        fontWeight: isToday ? 'bold' : 'normal',
                        color: isToday 
                          ? '#1890ff' 
                          : (isCurrentMonth 
                            ? (isDark ? '#ffffff' : '#333') 
                            : (isDark ? '#666' : '#ccc'))
                      }}>
                        {date.date()}
                      </span>
                      {viewMode === 'week' && (
                        <span style={{
                          fontSize: '10px',
                          color: isWeekend ? (isSaturday ? '#1890ff' : '#ff4d4f') : (isDark ? '#999' : '#666'),
                          fontWeight: '500'
                        }}>
                          {isSaturday ? '周六' : isSunday ? '周日' : ['周一', '周二', '周三', '周四', '周五'][date.day() - 1]}
                        </span>
                      )}
                    </div>
                    {isToday && (
                      <div style={themeStyles.todayIndicator} />
                    )}
                  </div>
                  
                  {/* 任务列表 */}
                  <div style={{ 
                    maxHeight: viewMode === 'week' ? '140px' : '80px', 
                    overflowY: 'auto' 
                  }}>
                    {dayTasks.slice(0, viewMode === 'week' ? 6 : 3).map((task, index) => (
                      <Tooltip key={task.id || index} title={task.title || '未命名任务'}>
                        <div
                          className="calendar-task calendar-task-item"
                          style={{
                            ...themeStyles.taskItem,
                            background: getStatusColor(task.status)
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskClick(task);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(2px)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {getStatusIcon(task.status)}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            {task.title || '未命名任务'}
                          </span>
                        </div>
                      </Tooltip>
                    ))}
                    
                    {dayTasks.length > (viewMode === 'week' ? 6 : 3) && (
                      <div 
                        className="calendar-more-indicator"
                        style={themeStyles.moreIndicator}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 可以在这里显示更多任务的弹窗
                        }}
                      >
                        +{dayTasks.length - (viewMode === 'week' ? 6 : 3)} 更多
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </Card>
    </>
  );
};

// 简单日历视图组件
const SimpleCalendarView = ({ tasks = [], loading = false, onTaskClick }) => {
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // 将任务按日期分组
  const tasksByDate = useMemo(() => {
    const grouped = {};
    tasks.forEach(task => {
      const date = task.scheduled_time ? 
        dayjs(task.scheduled_time).format('YYYY-MM-DD') : 
        dayjs(task.created_at).format('YYYY-MM-DD');
      
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(task);
    });
    return grouped;
  }, [tasks]);

  // 生成当前月份的日期网格
  const generateCalendarGrid = () => {
    const startOfMonth = selectedDate.startOf('month');
    const endOfMonth = selectedDate.endOf('month');
    const startOfWeek = startOfMonth.startOf('week');
    const endOfWeek = endOfMonth.endOf('week');
    
    const days = [];
    let current = startOfWeek;
    
    while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#faad14',
      'running': '#1890ff',
      'completed': '#52c41a',
      'failed': '#ff4d4f',
    };
    return colorMap[status] || '#d9d9d9';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'pending': <ClockCircleOutlined />,
      'running': <PlayCircleOutlined />,
      'completed': <CheckCircleOutlined />,
      'failed': <ExclamationCircleOutlined />,
    };
    return iconMap[status] || <ClockCircleOutlined />;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>加载任务数据中...</div>
        </div>
      </Card>
    );
  }

  const calendarDays = generateCalendarGrid();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <Card 
      title={
        <Space>
          <CalendarOutlined />
          <span>任务日历</span>
          <Tag color="blue">{tasks.length} 个任务</Tag>
        </Space>
      }
    >
      {tasks.length === 0 ? (
        <Empty 
          description="暂无任务数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '40px 0' }}
        />
      ) : (
        <div>
          {/* 月份导航 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            padding: '0 8px'
          }}>
            <Button 
              onClick={() => setSelectedDate(selectedDate.subtract(1, 'month'))}
            >
              上个月
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {selectedDate.format('YYYY年MM月')}
            </Title>
            <Button 
              onClick={() => setSelectedDate(selectedDate.add(1, 'month'))}
            >
              下个月
            </Button>
          </div>

          {/* 星期标题 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            marginBottom: '8px'
          }}>
            {weekDays.map(day => (
              <div 
                key={day}
                style={{ 
                  textAlign: 'center', 
                  padding: '8px',
                  background: '#f5f5f5',
                  fontWeight: 'bold'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            border: '1px solid #d9d9d9'
          }}>
            {calendarDays.map(date => {
              const dateStr = date.format('YYYY-MM-DD');
              const dayTasks = tasksByDate[dateStr] || [];
              const isCurrentMonth = date.isSame(selectedDate, 'month');
              const isToday = date.isSame(dayjs(), 'day');
              
              return (
                <div
                  key={dateStr}
                  style={{
                    minHeight: '80px',
                    padding: '4px',
                    background: isCurrentMonth ? '#fff' : '#fafafa',
                    border: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onClick={() => handleDateClick(date)}
                >
                  <div style={{
                    fontWeight: isToday ? 'bold' : 'normal',
                    color: isToday ? '#1890ff' : (isCurrentMonth ? '#000' : '#ccc'),
                    marginBottom: '4px'
                  }}>
                    {date.date()}
                  </div>
                  
                  {dayTasks.slice(0, 3).map((task, index) => (
                    <div
                      key={task.id || index}
                      style={{
                        background: getStatusColor(task.status),
                        color: 'white',
                        padding: '2px 4px',
                        borderRadius: '2px',
                        fontSize: '10px',
                        marginBottom: '2px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(task);
                      }}
                    >
                      {getStatusIcon(task.status)}
                      <span style={{ marginLeft: '2px' }}>
                        {task.title || '未命名任务'}
                      </span>
                    </div>
                  ))}
                  
                  {dayTasks.length > 3 && (
                    <div style={{
                      fontSize: '10px',
                      color: '#999',
                      textAlign: 'center'
                    }}>
                      +{dayTasks.length - 3} 更多
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

// 工作日历视图组件
const WorkingCalendarView = ({ tasks = [], loading = false, onTaskClick }) => {
  const [selectedDate, setSelectedDate] = useState(dayjs());

  // 将任务按日期分组
  const tasksByDate = useMemo(() => {
    const grouped = {};
    tasks.forEach(task => {
      const date = task.scheduled_time ? 
        dayjs(task.scheduled_time).format('YYYY-MM-DD') : 
        dayjs(task.created_at).format('YYYY-MM-DD');
      
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(task);
    });
    return grouped;
  }, [tasks]);

  // 生成当前月份的日期网格
  const generateCalendarGrid = () => {
    const startOfMonth = selectedDate.startOf('month');
    const endOfMonth = selectedDate.endOf('month');
    const startOfWeek = startOfMonth.startOf('week');
    const endOfWeek = endOfMonth.endOf('week');
    
    const days = [];
    let current = startOfWeek;
    
    while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#faad14',
      'running': '#1890ff',
      'completed': '#52c41a',
      'failed': '#ff4d4f',
    };
    return colorMap[status] || '#d9d9d9';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'pending': <ClockCircleOutlined />,
      'running': <PlayCircleOutlined />,
      'completed': <CheckCircleOutlined />,
      'failed': <ExclamationCircleOutlined />,
    };
    return iconMap[status] || <ClockCircleOutlined />;
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>加载任务数据中...</div>
        </div>
      </Card>
    );
  }

  const calendarDays = generateCalendarGrid();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <Card 
      title={
        <Space>
          <CalendarOutlined />
          <span>任务日历</span>
          <Tag color="blue">{tasks.length} 个任务</Tag>
        </Space>
      }
    >
      {tasks.length === 0 ? (
        <Empty 
          description="暂无任务数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '40px 0' }}
        />
      ) : (
        <div>
          {/* 月份导航 */}
          <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
            <Col>
              <Button 
                onClick={() => setSelectedDate(selectedDate.subtract(1, 'month'))}
              >
                上个月
              </Button>
            </Col>
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                {selectedDate.format('YYYY年MM月')}
              </Title>
            </Col>
            <Col>
              <Button 
                onClick={() => setSelectedDate(selectedDate.add(1, 'month'))}
              >
                下个月
              </Button>
            </Col>
          </Row>

          {/* 星期标题 */}
          <Row gutter={[1, 1]} style={{ marginBottom: '8px' }}>
            {weekDays.map(day => (
              <Col span={24/7} key={day}>
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px',
                  background: '#f5f5f5',
                  fontWeight: 'bold',
                  border: '1px solid #d9d9d9'
                }}>
                  {day}
                </div>
              </Col>
            ))}
          </Row>

          {/* 日期网格 */}
          <Row gutter={[1, 1]}>
            {calendarDays.map(date => {
              const dateStr = date.format('YYYY-MM-DD');
              const dayTasks = tasksByDate[dateStr] || [];
              const isCurrentMonth = date.isSame(selectedDate, 'month');
              const isToday = date.isSame(dayjs(), 'day');
              
              return (
                <Col span={24/7} key={dateStr}>
                  <div
                    style={{
                      minHeight: '100px',
                      padding: '8px',
                      background: isCurrentMonth ? '#fff' : '#fafafa',
                      border: '1px solid #d9d9d9',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onClick={() => handleDateClick(date)}
                  >
                    <div style={{
                      fontWeight: isToday ? 'bold' : 'normal',
                      color: isToday ? '#1890ff' : (isCurrentMonth ? '#000' : '#ccc'),
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      {date.date()}
                    </div>
                    
                    {dayTasks.slice(0, 2).map((task, index) => (
                      <div
                        key={task.id || index}
                        style={{
                          background: getStatusColor(task.status),
                          color: 'white',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          marginBottom: '4px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTaskClick(task);
                        }}
                      >
                        <Space size={4}>
                          {getStatusIcon(task.status)}
                          <span>
                            {task.title || '未命名任务'}
                          </span>
                        </Space>
                      </div>
                    ))}
                    
                    {dayTasks.length > 2 && (
                      <div style={{
                        fontSize: '10px',
                        color: '#999',
                        textAlign: 'center',
                        background: '#f0f0f0',
                        padding: '2px',
                        borderRadius: '2px'
                      }}>
                        +{dayTasks.length - 2} 更多
                      </div>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
    </Card>
  );
};

// 导出所有组件
export { TaskDetailModal, ProfessionalCalendarView, SimpleCalendarView, WorkingCalendarView };
export default ProfessionalCalendarView;
