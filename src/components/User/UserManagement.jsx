import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Tag, Space, Button, Modal, message, Statistic, Row, Col } from 'antd';
import { UserOutlined, CrownOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admin: 0
  });
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        message.error('获取用户列表失败');
        return;
      }

      setUsers(data || []);
      updateStats(data || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (userList) => {
    const total = userList.length;
    const active = userList.filter(u => u.status === 'active').length;
    const inactive = userList.filter(u => u.status !== 'active').length;
    const admin = userList.filter(u => u.role === 'admin').length;

    setStats({ total, active, inactive, admin });
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) {
        message.error('更新用户状态失败');
        return;
      }

      message.success('用户状态更新成功');
      fetchUsers();
    } catch (error) {
      console.error('更新用户状态失败:', error);
      message.error('更新用户状态失败');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        message.error('更新用户角色失败');
        return;
      }

      message.success('用户角色更新成功');
      fetchUsers();
    } catch (error) {
      console.error('更新用户角色失败:', error);
      message.error('更新用户角色失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      active: { color: 'success', text: '正常' },
      inactive: { color: 'default', text: '禁用' },
      banned: { color: 'error', text: '封禁' }
    };
    const config = statusMap[status] || statusMap.inactive;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getRoleTag = (role) => {
    const roleMap = {
      user: { color: 'blue', text: '普通用户', icon: <UserOutlined /> },
      admin: { color: 'green', text: '管理员', icon: <CrownOutlined /> },
      super_admin: { color: 'red', text: '超级管理员', icon: <CrownOutlined /> }
    };
    const config = roleMap[role] || roleMap.user;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const columns = [
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {record.id === currentUser?.id && (
            <Tag color="blue">当前用户</Tag>
          )}
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => getRoleTag(role)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status)
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const isCurrentUser = record.id === currentUser?.id;
        const isSuperAdmin = record.role === 'super_admin';
        
        return (
          <Space>
            {/* 状态切换 */}
            {!isCurrentUser && !isSuperAdmin && (
              <Button
                size="small"
                type={record.status === 'active' ? 'default' : 'primary'}
                icon={record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />}
                onClick={() => handleStatusChange(
                  record.id, 
                  record.status === 'active' ? 'inactive' : 'active'
                )}
              >
                {record.status === 'active' ? '禁用' : '启用'}
              </Button>
            )}

            {/* 角色切换 */}
            {!isCurrentUser && !isSuperAdmin && (
              <Button
                size="small"
                type="default"
                onClick={() => {
                  Modal.confirm({
                    title: '确认更改角色',
                    content: `确定要将用户 "${record.nickname}" 的角色改为管理员吗？`,
                    onOk: () => handleRoleChange(record.id, 'admin')
                  });
                }}
              >
                设为管理员
              </Button>
            )}

            {/* 查看详情 */}
            <Button size="small" type="link">
              查看详情
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <Title level={2}>👥 用户管理</Title>
      <Text type="secondary">管理系统中的所有用户账户</Text>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats.active}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="禁用用户"
              value={stats.inactive}
              prefix={<LockOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="管理员"
              value={stats.admin}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 用户列表 */}
      <Card title="用户列表" extra={
        <Button type="primary" onClick={fetchUsers}>
          刷新
        </Button>
      }>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      </Card>
    </div>
  );
};

export default UserManagement;

