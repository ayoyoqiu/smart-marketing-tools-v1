import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Table,
  Space,
  Tag,
  Input,
  Select,
  DatePicker,
  Button,
  message,
  Modal,
  Descriptions,
  Pagination
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { supabase, TABLES, MESSAGE_TYPE } from '../../supabaseClient'
import dayjs from 'dayjs'
import { useAuth } from '../contexts/AuthContext'

const { Option } = Select
const { RangePicker } = DatePicker

const MessageHistory = () => {
  const { user, isAdmin } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    type: '',
    dateRange: null
  })
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState(null)
  
  // 添加缓存机制
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [cacheExpiry] = useState(600000) // 10分钟缓存过期
  const [cachedMessages, setCachedMessages] = useState([])
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const handlePageChange = (page, size) => {
    setCurrentPage(page)
    setPageSize(size)
  }

  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return (messages || []).slice(start, start + pageSize)
  }, [messages, currentPage, pageSize])

  useEffect(() => {
    fetchMessages()
  }, [searchParams])

  const fetchMessages = async () => {
    setLoading(true)
    try {
      // 检查缓存是否有效
      const now = Date.now()
      const shouldFetch = now - lastFetchTime > cacheExpiry
      
      // 如果有缓存且搜索条件为空，使用缓存数据
      if (!shouldFetch && cachedMessages.length > 0 && 
          !searchParams.keyword && !searchParams.type && !searchParams.dateRange) {
        console.log('⚡ 使用缓存数据，跳过查询')
        setMessages(cachedMessages)
        setLoading(false)
        return
      }
      
      console.log('🔄 开始获取消息历史...')
      
      let query = supabase
        .from(TABLES.MESSAGE_HISTORY)
        .select('*')
        .order('created_at', { ascending: false })

      // 🔒 用户数据过滤
      if (isAdmin()) {
        // 管理员可以查看所有数据，不添加用户ID过滤
      } else if (user?.id) {
        query = query.eq('user_id', user?.id)
      } else {
        console.error('❌ 用户ID为空且非管理员，无法查询数据')
        setMessages([])
        setLoading(false)
        return
      }

      // 应用搜索条件
      if (searchParams.keyword) {
        query = query.or(`content.ilike.%${searchParams.keyword}%,chat_name.ilike.%${searchParams.keyword}%`)
      }

      if (searchParams.type) {
        // 统一三种类型的筛选：
        // 图文消息 同时包含历史上的 text、image 与 text_image
        if (searchParams.type === 'text_image') {
          query = query.in('message_type', ['text_image', 'text', 'image'])
        } else {
          query = query.eq('message_type', searchParams.type)
        }
      }

      if (searchParams.dateRange && searchParams.dateRange.length === 2) {
        const [startDate, endDate] = searchParams.dateRange
        query = query
          .gte('created_at', startDate.startOf('day').toISOString())
          .lte('created_at', endDate.endOf('day').toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ 查询错误:', error)
        throw error
      }
      
      // 更新缓存和显示数据
      setMessages(data || [])
      setCachedMessages(data || [])
      setLastFetchTime(now)
      
      console.log('✅ 消息历史获取完成')
    } catch (error) {
      message.error('获取历史消息失败')
      console.error('获取历史消息失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (field, value) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleViewDetail = (record) => {
    setSelectedMessage(record)
    setDetailModalVisible(true)
  }

  const columns = [
    {
      title: '发送时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      render: (taskName, record) => {
        // 优先显示任务名称，如果没有则显示webhook信息
        if (taskName) {
          return taskName
        }
        // 从content中提取任务名称（如果是任务发送的消息）
        if (record.content && typeof record.content === 'object') {
          if (record.content.title) {
            return record.content.title
          }
          if (record.content.taskName) {
            return record.content.taskName
          }
        }
        // 兜底显示webhook信息
        return record.webhook_id ? `Webhook-${record.webhook_id.substring(0, 8)}` : '未知'
      },
    },
    {
      title: '消息类型',
      dataIndex: 'message_type',
      key: 'message_type',
      render: (messageType) => {
        // 统一展示为三类
        let display = { color: 'default', text: '未知' }
        if (messageType === 'text_image' || messageType === 'text' || messageType === 'image') {
          display = { color: 'purple', text: '图文消息' }
        } else if (messageType === 'rich_text') {
          display = { color: 'cyan', text: '富文本消息' }
        } else if (messageType === 'card') {
          display = { color: 'orange', text: '卡片消息' }
        }
        return <Tag color={display.color}>{display.text}</Tag>
      },
    },
    {
      title: '内容摘要',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content) => {
        if (typeof content === 'string') {
          return content.length > 50 ? `${content.substring(0, 50)}...` : content
        }
        return JSON.stringify(content).substring(0, 50) + '...'
      },
    },
    {
      title: '发送状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          sent: { color: 'green', text: '成功' },
          delivered: { color: 'blue', text: '已送达' },
          failed: { color: 'red', text: '失败' },
          pending: { color: 'orange', text: '等待中' },
          success: { color: 'green', text: '成功' } // 兼容旧数据
        }
        const { color, text } = statusMap[status] || { color: 'default', text: '未知' }
        return <Tag color={color}>{text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看详情
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="历史消息查询"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchMessages}
          >
            刷新
          </Button>
        }
      >
        {/* 搜索区域 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input
              placeholder="搜索关键词"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={searchParams.keyword}
              onChange={(e) => handleSearch('keyword', e.target.value)}
              allowClear
            />
            <Select
              placeholder="消息类型"
              style={{ width: 140 }}
              value={searchParams.type}
              onChange={(value) => handleSearch('type', value)}
              allowClear
            >
              <Option value="text_image">图文消息</Option>
              <Option value="rich_text">富文本消息</Option>
              <Option value="card">卡片消息</Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              value={searchParams.dateRange}
              onChange={(dates) => handleSearch('dateRange', dates)}
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={paginatedMessages}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText: '暂无数据'
          }}
        />
        <div className="message-pagination">
          <div className="ant-pagination-total-text">
            {`共${messages?.length || 0}条: 当前为${(messages && messages.length) ? ((currentPage - 1) * pageSize + 1) : 0}~${Math.min(currentPage * pageSize, messages?.length || 0)}`}
          </div>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={messages?.length || 0}
            showSizeChanger
            showQuickJumper
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="消息详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedMessage && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="发送时间">
              {dayjs(selectedMessage.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="任务名称">
              {(() => {
                // 优先显示任务名称
                if (selectedMessage.task_name) {
                  return selectedMessage.task_name
                }
                // 从content中提取任务名称
                if (selectedMessage.content && typeof selectedMessage.content === 'object') {
                  if (selectedMessage.content.title) {
                    return selectedMessage.content.title
                  }
                  if (selectedMessage.content.taskName) {
                    return selectedMessage.content.taskName
                  }
                }
                // 兜底显示webhook信息
                return selectedMessage.webhook_id ? `Webhook-${selectedMessage.webhook_id.substring(0, 8)}` : '未知'
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="机器人名">
              {selectedMessage.bot_name}
            </Descriptions.Item>
            <Descriptions.Item label="消息类型">
              {(() => {
                const typeMap = {
                  'text': { color: 'blue', text: '文本' },
                  'image': { color: 'green', text: '图片' },
                  'text_image': { color: 'purple', text: '图文消息' },
                  'card': { color: 'orange', text: '卡片' },
                  'rich_text': { color: 'cyan', text: '富文本' }
                }
                const { color, text } = typeMap[selectedMessage.message_type] || { color: 'default', text: '未知' }
                return <Tag color={color}>{text}</Tag>
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="发送状态">
              {(() => {
                const statusMap = {
                  'sent': { color: 'green', text: '成功' },
                  'delivered': { color: 'blue', text: '已送达' },
                  'failed': { color: 'red', text: '失败' },
                  'pending': { color: 'orange', text: '等待中' },
                  'success': { color: 'green', text: '成功' } // 兼容旧数据
                }
                const { color, text } = statusMap[selectedMessage.status] || { color: 'default', text: '未知' }
                return <Tag color={color}>{text}</Tag>
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="消息内容">
              <div style={{ 
                maxHeight: 300, 
                overflow: 'auto', 
                whiteSpace: 'pre-wrap',
                backgroundColor: '#f5f5f5',
                padding: 8,
                borderRadius: 4
              }}>
                {typeof selectedMessage.content === 'string' 
                  ? selectedMessage.content 
                  : JSON.stringify(selectedMessage.content, null, 2)
                }
              </div>
            </Descriptions.Item>
            {selectedMessage.error_message && (
              <Descriptions.Item label="错误信息">
                <div style={{ 
                  color: 'red',
                  backgroundColor: '#fff2f0',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #ffccc7'
                }}>
                  {selectedMessage.error_message}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default MessageHistory

// 添加分页样式
const messagePaginationStyles = `
  .message-pagination {
    margin-top: 0;
    text-align: left;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid #e8e8e8;
    background: #fafafa;
    font-size: 14px;
  }
  
  .message-pagination .ant-pagination {
    display: flex;
    align-items: center;
    margin: 0;
    flex: 1;
    justify-content: center;
  }
  
  .message-pagination .ant-pagination-total-text {
    margin-right: 0;
    color: #333;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .message-pagination .ant-pagination-options {
    margin-left: 16px;
    order: 3;
  }
  
  .message-pagination .ant-pagination-item {
    margin: 0 2px;
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 4px;
  }
  
  .message-pagination .ant-pagination-item a {
    color: #333;
    text-decoration: none;
  }
  
  .message-pagination .ant-pagination-item-active {
    background: #1890ff;
    border-color: #1890ff;
  }
  
  .message-pagination .ant-pagination-item-active a {
    color: #fff;
  }
  
  .message-pagination .ant-pagination-prev,
  .message-pagination .ant-pagination-next {
    margin: 0 4px;
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 4px;
  }
  
  .message-pagination .ant-pagination-prev a,
  .message-pagination .ant-pagination-next a {
    color: #333;
    text-decoration: none;
    font-size: 16px;
    font-weight: bold;
  }
  
  .message-pagination .ant-pagination-jump-prev,
  .message-pagination .ant-pagination-jump-next {
    margin: 0 2px;
  }
  
  .message-pagination .ant-pagination-jump-prev .ant-pagination-item-container,
  .message-pagination .ant-pagination-jump-next .ant-pagination-item-container {
    color: #333;
  }
  
  /* 确保分页控件在表格底部占据整行 */
  .ant-table-pagination {
    position: sticky;
    bottom: 0;
    background: #fafafa;
    border-top: 1px solid #e8e8e8;
    padding: 0;
    margin-top: 0;
    width: 100%;
  }
  
  /* 快速跳转样式 */
  .message-pagination .ant-pagination-options-quick-jumper {
    margin-left: 8px;
  }
  
  .message-pagination .ant-pagination-options-quick-jumper input {
    width: 50px;
    height: 32px;
    text-align: center;
    border-radius: 4px;
  }
  
  /* 页面大小选择器样式 */
  .message-pagination .ant-pagination-options-size-changer {
    margin-right: 8px;
  }
  
  .message-pagination .ant-pagination-options-size-changer .ant-select {
    width: 80px;
  }
  
  /* 响应式分页 */
  @media (max-width: 768px) {
    .message-pagination {
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }
    
    .message-pagination .ant-pagination {
      flex-direction: column;
      gap: 8px;
    }
    
    .message-pagination .ant-pagination-options {
      margin-left: 0;
      margin-top: 0;
    }
  }
  
  /* 深色模式下的消息历史分页样式 */
  [data-theme="dark"] .message-pagination {
    background: #1a1a1a !important;
    border-top-color: #333333 !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-total-text {
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-item {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-item:hover {
    border-color: #40a9ff !important;
    color: #40a9ff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-item-active {
    background-color: #40a9ff !important;
    border-color: #40a9ff !important;
    color: #f0f0f0 !important;
    font-weight: 600 !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-item-active a {
    color: #f0f0f0 !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-prev,
  [data-theme="dark"] .message-pagination .ant-pagination-next {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-prev:hover,
  [data-theme="dark"] .message-pagination .ant-pagination-next:hover {
    border-color: #40a9ff !important;
    color: #40a9ff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-options .ant-select {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-options .ant-select .ant-select-selector {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .message-pagination .ant-pagination-options .ant-select .ant-select-arrow {
    color: #8c8c8c !important;
  }
`

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = messagePaginationStyles
  document.head.appendChild(styleElement)
} 