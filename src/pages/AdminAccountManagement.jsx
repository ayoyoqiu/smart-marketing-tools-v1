import React, { useState, useEffect, useMemo } from 'react';
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
  Typography,
  Alert,
  Divider,
  Pagination
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { Password } = Input;

const AdminAccountManagement = () => {
  const { user, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [form] = Form.useForm();
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (accounts || []).slice(start, start + pageSize);
  }, [accounts, currentPage, pageSize]);

  useEffect(() => {
    if (isAdmin()) {
      fetchAccounts();
    }
  }, [isAdmin]);

  // 获取所有账户
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nickname, role, status, created_at, last_login_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('获取账户列表失败:', error);
      message.error('获取账户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新用户角色
  const updateUserRoles = async (userId, newRole) => {
    try {
      console.log('🔍 开始更新用户角色:', { userId, newRole });
      
      // 删除现有角色
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ 删除现有角色失败:', deleteError);
        return;
      }

      // 根据新角色插入相应的角色记录
      if (newRole === 'admin') {
        // 管理员拥有双重角色
        const { error: insertAdminError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: userId, role: 'admin', is_active: true },
            { user_id: userId, role: 'user', is_active: true }
          ]);

        if (insertAdminError) {
          console.error('❌ 插入管理员角色失败:', insertAdminError);
        } else {
          console.log('✅ 管理员角色插入成功');
        }
      } else if (newRole === 'super_admin') {
        // 超级管理员拥有三重角色
        const { error: insertSuperAdminError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: userId, role: 'super_admin', is_active: true },
            { user_id: userId, role: 'admin', is_active: true },
            { user_id: userId, role: 'user', is_active: true }
          ]);

        if (insertSuperAdminError) {
          console.error('❌ 插入超级管理员角色失败:', insertSuperAdminError);
        } else {
          console.log('✅ 超级管理员角色插入成功');
        }
      } else {
        // 普通用户只有 user 角色
        const { error: insertUserError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: userId, role: 'user', is_active: true }
          ]);

        if (insertUserError) {
          console.error('❌ 插入普通用户角色失败:', insertUserError);
        } else {
          console.log('✅ 普通用户角色插入成功');
        }
      }

      console.log(`✅ 用户 ${userId} 角色更新成功: ${newRole}`);
    } catch (error) {
      console.error('❌ 更新用户角色失败:', error);
    }
  };

  // 快速切换用户角色
  const quickToggleRole = async (userId, currentRole) => {
    try {
      // 防止对超级管理员进行角色切换
      if (currentRole === 'super_admin') {
        message.error('不能修改超级管理员的角色');
        return;
      }
      
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      
      // 更新用户主角色
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) throw updateError;

      // 更新用户角色表
      await updateUserRoles(userId, newRole);

      // 刷新账户列表
      await fetchAccounts();

      message.success(`用户角色已切换为: ${newRole === 'admin' ? '管理员' : '普通用户'}`);
    } catch (error) {
      console.error('快速切换角色失败:', error);
      message.error('角色切换失败');
    }
  };

  // 创建或编辑账户
  const handleSubmit = async (values) => {
    try {
      if (editingAccount) {
        // 编辑账户
        const updateData = {
          nickname: values.nickname,
          role: values.role,
          status: values.status
        };

        // 如果提供了新密码，则更新密码
        if (values.password) {
          updateData.password_hash = values.password;
        }

        // 更新用户主角色
        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingAccount.id);

        if (updateError) throw updateError;

        // 更新用户角色表，确保权限实时生效
        await updateUserRoles(editingAccount.id, values.role);

        message.success('账户更新成功，权限已实时生效');
      } else {
        // 创建新账户
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            nickname: values.nickname,
            password_hash: values.password,
            role: values.role,
            status: values.status
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        // 为新用户创建角色记录
        await updateUserRoles(newUser.id, values.role);

        message.success('账户创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error('保存账户失败:', error);
      message.error('保存账户失败');
    }
  };

  // 删除账户
  const handleDelete = async (accountId) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      message.success('账户删除成功');
      fetchAccounts();
    } catch (error) {
      console.error('删除账户失败:', error);
      message.error('删除账户失败');
    }
  };

  // 重置账户密码
  const handleResetPassword = async (accountId) => {
    try {
      const newPassword = '123456'; // 默认密码
      const { error } = await supabase
        .from('users')
        .update({ password_hash: newPassword })
        .eq('id', accountId);

      if (error) throw error;
      message.success(`密码已重置为: ${newPassword}`);
    } catch (error) {
      console.error('重置密码失败:', error);
      message.error('重置密码失败');
    }
  };

  // 打开编辑模态框
  const handleEdit = (account) => {
    setEditingAccount(account);
    form.setFieldsValue({
      nickname: account.nickname,
      role: account.role,
      status: account.status
    });
    setModalVisible(true);
  };

  // 打开创建模态框
  const handleCreate = () => {
    setEditingAccount(null);
    form.resetFields();
    form.setFieldsValue({
      role: 'user',
      status: 'active'
    });
    setModalVisible(true);
  };

  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (nickname, record) => (
        <Space>
          {record.role === 'admin' && <CrownOutlined style={{ color: '#faad14' }} />}
          {nickname}
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role, record) => {
        const colors = {
          admin: 'red',
          super_admin: 'purple',
          user: 'blue'
        };
        return (
          <Space>
            <Tag color={colors[role] || 'default'}>
              {role === 'admin' ? '管理员' : role === 'super_admin' ? '超级管理员' : '普通用户'}
            </Tag>
            {record.id !== user?.id && record.role !== 'super_admin' && ( // 不能修改自己的角色，也不能修改超级管理员
              <Button
                size="small"
                type="link"
                onClick={() => quickToggleRole(record.id, role)}
                style={{ padding: '0 4px', height: 'auto' }}
              >
                {role === 'admin' ? '降级为普通用户' : '升级为管理员'}
              </Button>
            )}
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          active: 'green',
          inactive: 'orange',
          banned: 'red'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '从未登录'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.role === 'super_admin'}
          >
            编辑
          </Button>
          <Button
            type="text"
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record.id)}
            disabled={record.role === 'super_admin'}
          >
            重置密码
          </Button>
          {record.id !== user?.id && record.role !== 'super_admin' && ( // 不能修改自己的角色，也不能修改超级管理员
            <Button
              type="text"
              icon={<CrownOutlined />}
              onClick={() => quickToggleRole(record.id, record.role)}
              style={{ color: record.role === 'admin' ? '#faad14' : '#1890ff' }}
            >
              {record.role === 'admin' ? '降级' : '升级'}
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个账户吗？"
            description="删除后无法恢复，请谨慎操作"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.role === 'super_admin' || record.id === user?.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (!isAdmin()) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Alert
          message="权限不足"
          description="您没有权限访问此页面"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            管理员账户管理
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建账户
          </Button>
        }
      >
        <Alert
          message="安全提醒"
          description="管理员账户信息请妥善保管，不要泄露给无关人员。建议定期更换密码，确保系统安全。"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        {/* 角色统计信息 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Space size="large">
            <div>
              <Text strong>总用户数:</Text> <Tag color="blue">{accounts.length}</Tag>
            </div>
            <div>
              <Text strong>管理员:</Text> <Tag color="red">{accounts.filter(a => a.role === 'admin').length}</Tag>
            </div>
            <div>
              <Text strong>普通用户:</Text> <Tag color="blue">{accounts.filter(a => a.role === 'user').length}</Tag>
            </div>
            <div>
              <Text strong>超级管理员:</Text> <Tag color="purple">{accounts.filter(a => a.role === 'super_admin').length}</Tag>
            </div>
          </Space>
        </Card>

        <Table
          columns={columns}
          dataSource={paginatedAccounts}
          loading={loading}
          rowKey="id"
          pagination={false}
        />
        <div className="account-pagination">
          <div className="ant-pagination-total-text">
            {`共${accounts?.length || 0}条: 当前为${(accounts && accounts.length) ? ((currentPage - 1) * pageSize + 1) : 0}~${Math.min(currentPage * pageSize, accounts?.length || 0)}`}
          </div>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={accounts?.length || 0}
            showSizeChanger
            showQuickJumper
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </Card>

      {/* 创建/编辑账户模态框 */}
      <Modal
        title={editingAccount ? '编辑账户' : '新建账户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[
              { required: true, message: '请输入昵称' },
              { min: 2, message: '昵称至少2个字符' },
              { max: 20, message: '昵称最多20个字符' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入昵称" />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingAccount ? '新密码（留空则不修改）' : '密码'}
            rules={[
              { required: !editingAccount, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              style={{ width: '100%' }}
              options={[
                { label: '普通用户', value: 'user' },
                { label: '管理员', value: 'admin' },
                { label: '超级管理员', value: 'super_admin' }
              ]}
            />
          </Form.Item>
          
          <Alert
            message="角色说明"
            description={
              <div>
                <div>• <Text strong>普通用户</Text>: 只能管理自己的任务和地址</div>
                <div>• <Text strong>管理员</Text>: 可以管理所有用户，拥有双重身份（管理员+普通用户）</div>
                <div>• <Text strong>超级管理员</Text>: 系统最高权限，不可删除</div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              style={{ width: '100%' }}
              options={[
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'inactive' },
                { label: '封禁', value: 'banned' }
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingAccount ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminAccountManagement;

// 添加分页样式
const accountPaginationStyles = `
  .account-pagination {
    margin-top: 0;
    text-align: left;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-top: 1px solid #e8e8e8;
    background: #fafafa;
    font-size: 12px;
  }
  
  .account-pagination .ant-pagination {
    display: flex;
    align-items: center;
    margin: 0;
    flex: 1;
    justify-content: center;
  }
  
  .account-pagination .ant-pagination-total-text {
    margin-right: 0;
    color: #333;
    font-weight: 500;
    white-space: nowrap;
    font-size: 12px;
  }
  
  .account-pagination .ant-pagination-options {
    margin-left: 12px;
    order: 3;
  }
  
  .account-pagination .ant-pagination-item {
    margin: 0 1px;
    min-width: 24px;
    height: 24px;
    line-height: 22px;
    border-radius: 3px;
    font-size: 12px;
  }
  
  .account-pagination .ant-pagination-item a {
    color: #333;
    text-decoration: none;
    font-size: 12px;
  }
  
  .account-pagination .ant-pagination-item-active {
    background: #1890ff;
    border-color: #1890ff;
  }
  
  .account-pagination .ant-pagination-item-active a {
    color: #fff;
  }
  
  .account-pagination .ant-pagination-prev,
  .account-pagination .ant-pagination-next {
    margin: 0 2px;
    min-width: 24px;
    height: 24px;
    line-height: 22px;
    border-radius: 3px;
  }
  
  .account-pagination .ant-pagination-prev a,
  .account-pagination .ant-pagination-next a {
    color: #333;
    text-decoration: none;
    font-size: 14px;
    font-weight: bold;
  }
  
  .account-pagination .ant-pagination-jump-prev,
  .account-pagination .ant-pagination-jump-next {
    margin: 0 1px;
  }
  
  .account-pagination .ant-pagination-jump-prev .ant-pagination-item-container,
  .account-pagination .ant-pagination-jump-next .ant-pagination-item-container {
    color: #333;
  }
  
  /* 确保分页控件在表格下方，不并列 */
  .ant-table-pagination {
    position: relative;
    background: #fafafa;
    border-top: 1px solid #e8e8e8;
    padding: 0;
    margin-top: 0;
    width: 100%;
    clear: both;
  }
  
  /* 快速跳转样式 */
  .account-pagination .ant-pagination-options-quick-jumper {
    margin-left: 6px;
  }
  
  .account-pagination .ant-pagination-options-quick-jumper input {
    width: 40px;
    height: 24px;
    text-align: center;
    border-radius: 3px;
    font-size: 12px;
  }
  
  /* 页面大小选择器样式 */
  .account-pagination .ant-pagination-options-size-changer {
    margin-right: 6px;
  }
  
  .account-pagination .ant-pagination-options-size-changer .ant-select {
    width: 70px;
    font-size: 12px;
  }
  
  /* 响应式分页 */
  @media (max-width: 768px) {
    .account-pagination {
      flex-direction: column;
      gap: 6px;
      padding: 6px;
    }
    
    .account-pagination .ant-pagination {
      flex-direction: column;
      gap: 6px;
    }
    
    .account-pagination .ant-pagination-options {
      margin-left: 0;
      margin-top: 0;
    }
  }
`

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = accountPaginationStyles
  document.head.appendChild(styleElement)
}
