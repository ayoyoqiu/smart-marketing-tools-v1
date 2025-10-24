import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Space, Tag, message, Modal, Form, Input, Typography, Alert, Empty, Spin, Pagination } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../config';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const UserUpgradeManagement = () => {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectForm] = Form.useForm();
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (requests || []).slice(start, start + pageSize);
  }, [requests, currentPage, pageSize]);

  // 获取待审核列表
  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        API_ENDPOINTS.ADMIN_PENDING_UPGRADES,
        {
          headers: {
            'x-user-id': user?.id
          }
        }
      );

      if (response.data.success) {
        setRequests(response.data.data || []);
      } else {
        message.error('获取升级申请列表失败');
      }
    } catch (error) {
      console.error('获取升级申请失败:', error);
      message.error(error.response?.data?.error || '获取升级申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin()) {
      fetchPendingRequests();
    }
  }, [user]);

  // 批准升级
  const handleApprove = async (request) => {
    try {
      const response = await axios.post(
        API_ENDPOINTS.ADMIN_APPROVE_USER,
        {
          userId: request.user_id,
          newRole: request.to_role
        },
        {
          headers: {
            'x-user-id': user?.id
          }
        }
      );

      if (response.data.success) {
        message.success('用户升级成功');
        fetchPendingRequests(); // 刷新列表
      } else {
        message.error('升级失败');
      }
    } catch (error) {
      console.error('升级用户失败:', error);
      message.error(error.response?.data?.error || '升级失败');
    }
  };

  // 打开拒绝对话框
  const handleRejectClick = (request) => {
    setRejectingRequest(request);
    setRejectModalVisible(true);
    rejectForm.setFieldsValue({
      reason: ''
    });
  };

  // 提交拒绝
  const handleRejectSubmit = async (values) => {
    try {
      const response = await axios.post(
        API_ENDPOINTS.ADMIN_REJECT_USER,
        {
          requestId: rejectingRequest.id,
          reason: values.reason
        },
        {
          headers: {
            'x-user-id': user?.id
          }
        }
      );

      if (response.data.success) {
        message.success('已拒绝升级申请');
        setRejectModalVisible(false);
        setRejectingRequest(null);
        rejectForm.resetFields();
        fetchPendingRequests(); // 刷新列表
      } else {
        message.error('操作失败');
      }
    } catch (error) {
      console.error('拒绝升级失败:', error);
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const columns = [
    {
      title: '用户信息',
      key: 'user',
      width: '23%',
      render: (_, record) => (
        <div>
          <div><UserOutlined /> <strong>{record.user?.nickname || '未知用户'}</strong></div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {record.user?.email || '无邮箱'}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            注册: {record.user?.created_at ? dayjs(record.user.created_at).format('YYYY-MM-DD') : '-'}
          </div>
        </div>
      )
    },
    {
      title: '角色变更',
      key: 'role_change',
      width: '13%',
      align: 'center',
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <Tag color="default">{getRoleText(record.from_role)}</Tag>
          <div style={{ margin: '4px 0', color: '#999' }}>↓</div>
          <Tag color="success">{getRoleText(record.to_role)}</Tag>
        </div>
      )
    },
    {
      title: '申请理由',
      dataIndex: 'request_reason',
      key: 'request_reason',
      width: '33%',
      render: (reason) => (
        <Paragraph 
          ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
          style={{ margin: 0 }}
        >
          {reason || <Text type="secondary">无</Text>}
        </Paragraph>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '18%',
      render: (time) => (
        <div>
          <div>{dayjs(time).format('YYYY-MM-DD HH:mm')}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <ClockCircleOutlined /> {dayjs(time).fromNow()}
          </div>
        </div>
      ),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at)
    },
    {
      title: '操作',
      key: 'action',
      width: '13%',
      align: 'center',
      render: (_, record) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认批准升级',
                content: `确定将用户 "${record.user?.nickname}" 从 "${getRoleText(record.from_role)}" 升级为 "${getRoleText(record.to_role)}" 吗？`,
                okText: '确认批准',
                cancelText: '取消',
                onOk: () => handleApprove(record)
              });
            }}
            block
          >
            批准
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleRejectClick(record)}
            block
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  const getRoleText = (role) => {
    const roleMap = {
      guest: '游客用户',
      user: '普通用户',
      admin: '管理员',
      super_admin: '超级管理员'
    };
    return roleMap[role] || role;
  };

  // 权限检查
  if (!isAdmin()) {
    return (
      <div>
        <Alert
          message="权限不足"
          description="只有管理员可以访问用户升级管理页面"
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>👥 用户升级管理</Title>
      <Text type="secondary">审核和管理用户角色升级申请</Text>

      <Card 
        className="user-upgrade-card"
        style={{ marginTop: '24px' }}
        title={
          <Space>
            <ExclamationCircleOutlined />
            <span>待审核的升级申请</span>
            {requests.length > 0 && (
              <Tag color="orange">{requests.length} 个待处理</Tag>
            )}
          </Space>
        }
        extra={
          <Button onClick={fetchPendingRequests} loading={loading}>
            刷新
          </Button>
        }
      >
        {requests.length === 0 && !loading ? (
          <Empty
            description="暂无待审核的升级申请"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={paginatedRequests}
              loading={loading}
              rowKey="id"
              pagination={false}
            />
            <div className="upgrade-pagination">
              <div className="ant-pagination-total-text">
                {`共${requests?.length || 0}条: 当前为${(requests && requests.length) ? ((currentPage - 1) * pageSize + 1) : 0}~${Math.min(currentPage * pageSize, requests?.length || 0)}`}
              </div>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={requests?.length || 0}
                showSizeChanger
                showQuickJumper
                onChange={handlePageChange}
                onShowSizeChange={handlePageChange}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            </div>
          </>
        )}
      </Card>

      {/* 审核说明 - 移到卡片外部 */}
      <Alert
        message="审核说明"
        description={
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>批准后，用户将立即升级为普通用户，可以发送消息</li>
            <li>拒绝后，用户仍为游客身份，需重新申请</li>
            <li>建议根据用户注册时间、邮箱等信息判断是否批准</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: '24px' }}
      />

      {/* 拒绝理由Modal */}
      <Modal
        title="拒绝升级申请"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          setRejectingRequest(null);
          rejectForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        {rejectingRequest && (
          <div>
            <Alert
              message="申请信息"
              description={
                <div>
                  <p><strong>用户：</strong>{rejectingRequest.user?.nickname}</p>
                  <p><strong>邮箱：</strong>{rejectingRequest.user?.email || '无'}</p>
                  <p><strong>申请：</strong>{getRoleText(rejectingRequest.from_role)} → {getRoleText(rejectingRequest.to_role)}</p>
                  {rejectingRequest.request_reason && (
                    <p><strong>理由：</strong>{rejectingRequest.request_reason}</p>
                  )}
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Form
              form={rejectForm}
              layout="vertical"
              onFinish={handleRejectSubmit}
            >
              <Form.Item
                label="拒绝原因"
                name="reason"
                rules={[
                  { required: true, message: '请填写拒绝原因' },
                  { min: 5, message: '拒绝原因至少5个字符' }
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="请说明拒绝原因，例如：用户信息不完整、可疑账号、需要进一步核实等"
                  maxLength={200}
                  showCount
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" danger htmlType="submit">
                    确认拒绝
                  </Button>
                  <Button 
                    onClick={() => {
                      setRejectModalVisible(false);
                      setRejectingRequest(null);
                      rejectForm.resetFields();
                    }}
                  >
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserUpgradeManagement;

// 添加分页样式（完全铺满卡片）
const upgradePaginationStyles = `
  /* 让表格完全铺满卡片 - 零留白 */
  .user-upgrade-card .ant-card-body {
    padding: 0 !important;
  }
  
  .user-upgrade-card .ant-card-head {
    padding: 16px 24px;
    border-bottom: none !important;
  }
  
  .user-upgrade-card .ant-table-wrapper {
    padding: 0; /* 🎯 零留白：表格完全铺满 */
  }
  
  .user-upgrade-card .ant-table {
    margin: 0;
    width: 100% !important; /* 🎯 强制表格宽度100%，填满整个容器 */
  }
  
  .user-upgrade-card .ant-table table {
    width: 100% !important; /* 🎯 确保内部table标签也是100% */
  }
  
  /* 增加表格行高，补偿内部padding */
  .user-upgrade-card .ant-table-thead > tr > th {
    padding: 16px 24px; /* 🎯 增加左右padding以保持视觉平衡 */
    background: #fafafa;
    font-weight: 600;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .user-upgrade-card .ant-table-tbody > tr > td {
    padding: 20px 24px; /* 🎯 增加左右padding以保持视觉平衡 */
  }

  .upgrade-pagination {
    margin-top: 0;
    text-align: left;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px; /* 🎯 与表格内容对齐 */
    border-top: 1px solid #e8e8e8;
    background: #fafafa;
    font-size: 12px;
  }
  
  .upgrade-pagination .ant-pagination {
    display: flex;
    align-items: center;
    margin: 0;
    flex: 1;
    justify-content: center;
  }
  
  .upgrade-pagination .ant-pagination-total-text {
    margin-right: 0;
    color: #333;
    font-weight: 500;
    white-space: nowrap;
    font-size: 12px;
  }
  
  .upgrade-pagination .ant-pagination-options {
    margin-left: 12px;
    order: 3;
  }
  
  .upgrade-pagination .ant-pagination-item {
    margin: 0 1px;
    min-width: 24px;
    height: 24px;
    line-height: 22px;
    border-radius: 3px;
    font-size: 12px;
  }
  
  .upgrade-pagination .ant-pagination-item a {
    color: #333;
    text-decoration: none;
    font-size: 12px;
  }
  
  .upgrade-pagination .ant-pagination-item-active {
    background: #1890ff;
    border-color: #1890ff;
  }
  
  .upgrade-pagination .ant-pagination-item-active a {
    color: #fff;
  }
  
  .upgrade-pagination .ant-pagination-prev,
  .upgrade-pagination .ant-pagination-next {
    margin: 0 2px;
    min-width: 24px;
    height: 24px;
    line-height: 22px;
    border-radius: 3px;
  }
  
  .upgrade-pagination .ant-pagination-prev a,
  .upgrade-pagination .ant-pagination-next a {
    color: #333;
    text-decoration: none;
    font-size: 14px;
    font-weight: bold;
  }
  
  .upgrade-pagination .ant-pagination-jump-prev,
  .upgrade-pagination .ant-pagination-jump-next {
    margin: 0 1px;
  }
  
  .upgrade-pagination .ant-pagination-jump-prev .ant-pagination-item-container,
  .upgrade-pagination .ant-pagination-jump-next .ant-pagination-item-container {
    color: #333;
  }
  
  /* 快速跳转样式 */
  .upgrade-pagination .ant-pagination-options-quick-jumper {
    margin-left: 6px;
  }
  
  .upgrade-pagination .ant-pagination-options-quick-jumper input {
    width: 40px;
    height: 24px;
    text-align: center;
    border-radius: 3px;
    font-size: 12px;
  }
  
  /* 页面大小选择器样式 */
  .upgrade-pagination .ant-pagination-options-size-changer {
    margin-right: 6px;
  }
  
  .upgrade-pagination .ant-pagination-options-size-changer .ant-select {
    width: 70px;
    font-size: 12px;
  }
  
  /* 响应式分页 */
  @media (max-width: 768px) {
    .upgrade-pagination {
      flex-direction: column;
      gap: 6px;
      padding: 6px;
    }
    
    .upgrade-pagination .ant-pagination {
      flex-direction: column;
      gap: 6px;
    }
    
    .upgrade-pagination .ant-pagination-options {
      margin-left: 0;
      margin-top: 0;
    }
  }
`

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = upgradePaginationStyles
  document.head.appendChild(styleElement)
}
