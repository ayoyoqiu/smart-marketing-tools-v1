import React, { useState, useMemo } from 'react';
import { Card, Empty, Spin, Typography, Tag, Space, Button, Row, Col } from 'antd';
import { 
  CalendarOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  PlayCircleOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

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

export default WorkingCalendarView;
