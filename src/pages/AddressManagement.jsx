import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Row,
  Col,
  Statistic,
  Divider,
  Pagination
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
  RobotOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { supabase, TABLES } from '../../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import GroupManagement from '../components/GroupManagement'

const { Option } = Select

const AddressManagement = () => {
  const { user, isAdmin } = useAuth()
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState(null)
  const [form] = Form.useForm()
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [groupStats, setGroupStats] = useState({})
  const [groups, setGroups] = useState([])
  const [groupManagementVisible, setGroupManagementVisible] = useState(false)
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const handlePageChange = (page, size) => {
    setCurrentPage(page)
    setPageSize(size)
  }
  
  // 简化的数据加载逻辑
  const [isInitialized, setIsInitialized] = useState(false)

  // 手动刷新数据函数
  const refreshData = async () => {
    try {
      console.log('🔄 手动刷新数据...')
      setLoading(true)
      
      // 重新加载数据
      await fetchGroups()
      await fetchWebhooks()
      
      console.log('✅ 数据刷新完成')
    } catch (error) {
      console.error('❌ 数据刷新失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        // 只在未初始化或用户变化时加载数据
        if (!isInitialized || !user?.id) {
          console.log('🔄 开始加载数据...')
          
          // 先加载分组数据，再加载webhook数据，确保统计计算时分组数据已就绪
          await fetchGroups()
          await fetchWebhooks()
          
          setIsInitialized(true)
          console.log('✅ 数据加载完成')
        }
      } catch (error) {
        console.error('❌ 数据加载失败:', error)
      }
    }
    
    loadData()
  }, [user?.id]) // 只在用户ID变化时重新加载

  // 获取用户分组 - 从webhooks表获取分组信息
  const fetchGroups = async () => {
    try {
      if (!user?.id) {
        console.error('❌ 用户ID为空，无法查询分组')
        return []
      }

      // 从groups表获取分组信息（包括系统分组和用户分组）
      let query = supabase
        .from('groups')
        .select('id, name, description, color, sort_order, user_id')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      
      console.log('🔍 分组查询条件:', `user_id.eq.${user.id},user_id.is.null`)

      const { data, error } = await query
      if (error) throw error

      console.log('🔍 获取到的分组数据:', data)

      // 格式化分组数据
      const formattedGroups = (data || []).map(group => ({
        id: group.id,
        name: group.name,
        label: group.name,
        value: group.id
      }))

      // 添加"全部"选项
      formattedGroups.unshift({
        id: 'all',
        name: '全部',
        label: '全部',
        value: null
      })

      console.log('🔍 格式化后的分组数据:', formattedGroups)
      setGroups(formattedGroups)
    } catch (error) {
      console.error('获取分组失败:', error)
    }
  }

  const fetchWebhooks = async () => {
    setLoading(true)
    try {
      console.log('🔍 开始获取地址列表...')
      
      let query = supabase
        .from(TABLES.WEBHOOKS)
        .select(`
          *,
          creator:user_id (
            id,
            email,
            nickname
          )
        `)
        .order('created_at', { ascending: false })
      
      // 🔒 权限控制：普通用户只能看到自己的数据，管理员可以看到所有数据
      if (user?.id) {
        if (isAdmin()) {
          // 管理员可以看到所有webhook，不添加用户ID过滤
        } else {
          query = query.eq('user_id', user?.id)
        }
      } else {
        console.error('❌ 用户ID为空，无法查询数据')
        setWebhooks([])
        return
      }
      
      const { data, error } = await query

      if (error) {
        console.error('❌ 数据库查询错误:', error)
        throw error
      }
      
      setWebhooks(data || [])
      
      // 计算分组统计
      calculateGroupStats(data || [])
    } catch (error) {
      message.error('获取地址列表失败')
      console.error('获取地址列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateGroupStats = (data) => {
    const stats = {}
    data.forEach(item => {
      // 修复：若存在group_id但暂未加载到groups，则归为"未知分组"，而非"未分组"
      const hasGroup = !!item.group_id
      let category = '未分组'
      if (hasGroup) {
        const group = groups.find(g => g.id === item.group_id)
        category = group ? group.name : '未知分组'
      }
      
      if (!stats[category]) {
        stats[category] = { total: 0, active: 0 }
      }
      stats[category].total++
      if (item.status === 'active') {
        stats[category].active++
      }
    })
    setGroupStats(stats)
  }

  // 当 webhooks 或 groups 更新时，自动重算统计，避免并行加载顺序导致统计失真
  useEffect(() => {
    if (Array.isArray(webhooks)) {
      calculateGroupStats(webhooks)
    }
  }, [webhooks, groups])

  const getFilteredWebhooks = () => {
    let filteredWebhooks = webhooks

    // 按分组筛选
    if (selectedCategory !== 'all' && selectedCategory !== null) {
      filteredWebhooks = filteredWebhooks.filter(item => {
        if (selectedCategory === 'ungrouped') {
          return !item.group_id
        }
        return item.group_id === selectedCategory
      })
    }



    return filteredWebhooks
  }

  const paginatedWebhooks = useMemo(() => {
    const data = getFilteredWebhooks()
    const start = (currentPage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [webhooks, selectedCategory, currentPage, pageSize])

  const handleCreateWebhook = () => {
    setEditingWebhook(null)
    form.resetFields()
    form.setFieldsValue({
      status: 'active',
      user_id: user?.id
    })
    setModalVisible(true)
  }

  // 处理表单提交
  const handleSubmit = async (values) => {
    try {
      const webhookData = {
        chat_name: values.chat_name,
        group_id: values.group_id,
        name: values.bot_name,
        description: values.remark,
        webhook_url: values.webhook_url,
        status: values.status,
        user_id: user?.id
      }

      if (editingWebhook) {
        // 编辑地址
        const { error } = await supabase
          .from(TABLES.WEBHOOKS)
          .update(webhookData)
          .eq('id', editingWebhook.id)

        if (error) throw error
        message.success('地址更新成功')
      } else {
        // 创建新地址
        const { error } = await supabase
          .from(TABLES.WEBHOOKS)
          .insert([webhookData])

        if (error) throw error
        message.success('地址创建成功')
      }

      setModalVisible(false)
      form.resetFields()
      setEditingWebhook(null)
      
      // 刷新数据
      fetchWebhooks()
      fetchGroups()
    } catch (error) {
      console.error('保存地址失败:', error)
      message.error('保存地址失败')
    }
  }

  // 编辑地址
  const handleEditWebhook = (record) => {
    setEditingWebhook(record)
    form.setFieldsValue({
      chat_name: record.chat_name,
      group_id: record.group_id || null,
      bot_name: record.name,
      webhook_url: record.webhook_url,
      status: record.status,
      remark: record.description || ''
    })
    setModalVisible(true)
  }

  // 删除地址
  const handleDeleteWebhook = async (id) => {
    try {
      const { error } = await supabase
        .from(TABLES.WEBHOOKS)
        .delete()
        .eq('id', id)

      if (error) throw error

      message.success('地址删除成功')
      fetchWebhooks()
    } catch (error) {
      console.error('删除地址失败:', error)
      message.error('删除地址失败')
    }
  }

  const columns = [
    {
      title: '群名',
      dataIndex: 'chat_name',
      key: 'chat_name',
    },
    {
      title: '机器人名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '创建人',
      key: 'creator',
      render: (_, record) => {
        // 显示实际创建者信息
        if (record.creator) {
          if (record.creator.nickname) {
            return record.creator.nickname;
          }
          if (record.creator.email) {
            return record.creator.email;
          }
        }
        return '未知用户';
      }
    },
    {
      title: 'Webhook地址',
      dataIndex: 'webhook_url',
      key: 'webhook_url',
      ellipsis: true,
      render: (url) => (
        <span title={url} style={{ maxWidth: 200, display: 'inline-block' }}>
          {url}
        </span>
      ),
    },
    {
      title: '分组',
      dataIndex: 'group_id',
      key: 'group_id',
      render: (groupId) => {
        console.log(`🔍 渲染分组列: groupId=${groupId}, groups.length=${groups.length}`)
        if (!groupId) return <Tag color="default">未分组</Tag>
        const group = groups.find(g => g.id === groupId)
        console.log(`🔍 找到的分组:`, group)
        return group ? (
          <Tag color={group.color || 'blue'}>{group.name}</Tag>
        ) : (
          <Tag color="default">未知分组</Tag>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditWebhook(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个地址吗？"
            onConfirm={() => handleDeleteWebhook(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 分组统计卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总地址数"
              value={webhooks.length}
              prefix={<RobotOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="启用地址"
              value={webhooks.filter(w => w.status === 'active').length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="分组数量"
              value={Object.keys(groupStats).length}
              prefix={<TeamOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="未分组地址"
              value={webhooks.filter(w => !w.group_id).length}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 分组统计详情 */}
      <Card title="分组统计" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          {Object.entries(groupStats).map(([category, stats]) => (
            <Col span={6} key={category}>
              <Card size="small">
                <Statistic
                  title={category}
                  value={stats.total}
                  suffix={`/ ${stats.active} 启用`}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        title="地址管理"
        extra={
          <Space>

            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 150 }}
              placeholder="选择分组"
            >
              <Option value="all">全部地址</Option>
              <Option value="ungrouped">未分组</Option>
              {groups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={refreshData}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateWebhook}
            >
              新增地址
            </Button>
            <Button
              icon={<FolderOutlined />}
              onClick={() => setGroupManagementVisible(true)}
            >
              分组管理
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={paginatedWebhooks}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
        <div className="address-pagination">
          <div className="ant-pagination-total-text">
            {(() => {
              const total = getFilteredWebhooks().length
              const start = total ? (currentPage - 1) * pageSize + 1 : 0
              const end = Math.min(currentPage * pageSize, total)
              return `共${total}条: 当前为${start}~${end}`
            })()}
          </div>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={getFilteredWebhooks().length}
            showSizeChanger
            showQuickJumper
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </Card>

      <Modal
        title={editingWebhook ? '编辑地址' : '新增地址'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="chat_name"
            label="群名"
            rules={[{ required: true, message: '请输入群名' }]}
          >
            <Input placeholder="请输入群名" />
          </Form.Item>

          <Form.Item
            name="bot_name"
            label="机器人名"
            rules={[{ required: true, message: '请输入机器人名' }]}
          >
            <Input placeholder="请输入机器人名" />
          </Form.Item>



          <Form.Item
            name="webhook_url"
            label="Webhook地址"
            rules={[
              { required: true, message: '请输入Webhook地址' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="请输入Webhook地址" />
          </Form.Item>

          <Form.Item
            name="group_id"
            label="分组"
          >
            <Select placeholder="请选择分组" allowClear>
              {groups.map(group => (
                <Option key={group.id} value={group.id === 'all' ? null : group.id}>
                  {group.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="active">启用</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入备注信息"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingWebhook ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

             <GroupManagement
         visible={groupManagementVisible}
         onCancel={() => setGroupManagementVisible(false)}
         onGroupChange={fetchGroups}
       />
    </div>
  )
}

export default AddressManagement

// 添加分页样式
const addressPaginationStyles = `
  .address-pagination {
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
  
  .address-pagination .ant-pagination {
    display: flex;
    align-items: center;
    margin: 0;
    flex: 1;
    justify-content: center;
  }
  
  .address-pagination .ant-pagination-total-text {
    margin-right: 0;
    color: #333;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .address-pagination .ant-pagination-options {
    margin-left: 16px;
    order: 3;
  }
  
  .address-pagination .ant-pagination-item {
    margin: 0 2px;
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 4px;
  }
  
  .address-pagination .ant-pagination-item a {
    color: #333;
    text-decoration: none;
  }
  
  .address-pagination .ant-pagination-item-active {
    background: #1890ff;
    border-color: #1890ff;
  }
  
  .address-pagination .ant-pagination-item-active a {
    color: #fff;
  }
  
  .address-pagination .ant-pagination-prev,
  .address-pagination .ant-pagination-next {
    margin: 0 4px;
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 4px;
  }
  
  .address-pagination .ant-pagination-prev a,
  .address-pagination .ant-pagination-next a {
    color: #333;
    text-decoration: none;
    font-size: 16px;
    font-weight: bold;
  }
  
  .address-pagination .ant-pagination-jump-prev,
  .address-pagination .ant-pagination-jump-next {
    margin: 0 2px;
  }
  
  .address-pagination .ant-pagination-jump-prev .ant-pagination-item-container,
  .address-pagination .ant-pagination-jump-next .ant-pagination-item-container {
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
  .address-pagination .ant-pagination-options-quick-jumper {
    margin-left: 8px;
  }
  
  .address-pagination .ant-pagination-options-quick-jumper input {
    width: 50px;
    height: 32px;
    text-align: center;
    border-radius: 4px;
  }
  
  /* 页面大小选择器样式 */
  .address-pagination .ant-pagination-options-size-changer {
    margin-right: 8px;
  }
  
  .address-pagination .ant-pagination-options-size-changer .ant-select {
    width: 80px;
  }
  
  /* 响应式分页 */
  @media (max-width: 768px) {
    .address-pagination {
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }
    
    .address-pagination .ant-pagination {
      flex-direction: column;
      gap: 8px;
    }
    
    .address-pagination .ant-pagination-options {
      margin-left: 0;
      margin-top: 0;
    }
  }
  
  /* 深色模式下的地址管理分页样式 */
  [data-theme="dark"] .address-pagination {
    background: #1a1a1a !important;
    border-top-color: #333333 !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-total-text {
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-item {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-item:hover {
    border-color: #40a9ff !important;
    color: #40a9ff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-item-active {
    background-color: #40a9ff !important;
    border-color: #40a9ff !important;
    color: #f0f0f0 !important;
    font-weight: 600 !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-item-active a {
    color: #f0f0f0 !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-prev,
  [data-theme="dark"] .address-pagination .ant-pagination-next {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-prev:hover,
  [data-theme="dark"] .address-pagination .ant-pagination-next:hover {
    border-color: #40a9ff !important;
    color: #40a9ff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-options .ant-select {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-options .ant-select .ant-select-selector {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .address-pagination .ant-pagination-options .ant-select .ant-select-arrow {
    color: #8c8c8c !important;
  }
`

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = addressPaginationStyles
  document.head.appendChild(styleElement)
} 