import React from 'react';
import { Modal, Descriptions, Tag, Space, Typography, Button, Divider, Card } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  MessageOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { TASK_STATUS, MESSAGE_TYPE } from '../../../supabaseClient';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

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

export default TaskDetailModal;
