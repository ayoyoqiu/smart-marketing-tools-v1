import React, { useState, useMemo } from 'react';
import { Card, Empty, Spin, Typography, Tag, Space, Button } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

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

export default SimpleCalendarView;
