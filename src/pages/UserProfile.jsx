import React, { useState, useEffect } from 'react';
import { Card, Typography, Descriptions, Button, Form, Input, message, Space, Avatar, Tag, Divider, Alert, Modal } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined, LockOutlined, ExclamationCircleOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import './UserProfile.css';

const { Title, Text } = Typography;

const UserProfile = () => {
  const { user, isAdmin, isGuest, currentRole } = useAuth(); // 🎭 新增isGuest
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false); // 🎭 升级申请模态框
  const [emailForm] = Form.useForm();
  const [upgradeForm] = Form.useForm(); // 🎭 升级申请表单

  const [form] = Form.useForm();



  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        nickname: user.nickname,
        role: user.role,
        status: user.status
      });
    }
  }, [user, form]);

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = async (values) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ nickname: values.nickname })
        .eq('id', user.id);

      if (error) {
        message.error('更新失败，请重试');
        return;
      }

      message.success('个人资料更新成功');
      setEditing(false);
      // 这里应该刷新用户信息，实际项目中可能需要重新获取
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    form.resetFields();
  };

  // 检查用户是否有邮箱
  const hasEmail = user?.email && user.email.trim() !== '';

  // 处理邮箱修复
  const handleEmailFix = () => {
    setEmailModalVisible(true);
    emailForm.setFieldsValue({
      email: user?.email || ''
    });
  };

  // 保存邮箱
  const handleEmailSave = async (values) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ email: values.email })
        .eq('id', user.id);

      if (error) {
        message.error('邮箱更新失败，请重试');
        return;
      }

      message.success('邮箱更新成功，请重新登录以建立安全会话');
      setEmailModalVisible(false);
      // 建议用户重新登录
      Modal.confirm({
        title: '邮箱已更新',
        content: '为了确保功能正常使用，建议您重新登录。是否现在重新登录？',
        onOk: () => {
          window.location.reload();
        }
      });
    } catch (error) {
      message.error('邮箱更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 🎭 处理升级申请
  const handleUpgradeRequest = () => {
    setUpgradeModalVisible(true);
    upgradeForm.setFieldsValue({
      currentRole: 'guest',
      targetRole: 'user',
      reason: ''
    });
  };

  // 🎭 提交升级申请
  const handleUpgradeSubmit = async (values) => {
    if (!user) return;

    setLoading(true);
    try {
      // 检查是否已有待审核的申请
      const { data: existingRequests, error: checkError } = await supabase
        .from('user_upgrade_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .limit(1);

      if (checkError) {
        console.error('检查升级申请失败:', checkError);
        message.error('提交失败，请重试');
        return;
      }

      if (existingRequests && existingRequests.length > 0) {
        message.warning('您已有待审核的升级申请，请等待管理员处理');
        setUpgradeModalVisible(false);
        return;
      }

      // 创建升级申请
      const { error } = await supabase
        .from('user_upgrade_requests')
        .insert({
          user_id: user.id,
          from_role: 'guest',
          to_role: 'user',
          request_reason: values.reason || '申请升级为普通用户，开通消息发送权限',
          status: 'pending'
        });

      if (error) {
        console.error('提交升级申请失败:', error);
        message.error('提交失败，请重试');
        return;
      }

      message.success('升级申请已提交，请等待管理员审核');
      setUpgradeModalVisible(false);
      upgradeForm.resetFields();
    } catch (error) {
      console.error('提交升级申请异常:', error);
      message.error('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getRoleText = (role) => {
    const roleMap = {
      guest: '游客用户', // 🎭 新增游客角色
      user: '普通用户',
      admin: '管理员',
      super_admin: '超级管理员'
    };
    return roleMap[role] || '未知';
  };

  const getStatusText = (status) => {
    const statusMap = {
      active: '正常',
      inactive: '禁用',
      banned: '封禁'
    };
    return statusMap[status] || '未知';
  };

  const getRoleColor = (role) => {
    const colorMap = {
      user: 'blue',
      admin: 'green',
      super_admin: 'red'
    };
    return colorMap[role] || 'default';
  };

  const getStatusColor = (status) => {
    const colorMap = {
      active: 'success',
      inactive: 'default',
      banned: 'error'
    };
    return colorMap[status] || 'default';
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text type="secondary">请先登录</Text>
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>👤 个人资料</Title>
      <Text type="secondary">查看和管理您的账户信息</Text>

      <div style={{ marginTop: '24px' }}>

        {/* 🎭 游客用户升级提示 */}
        {isGuest() && (
          <Alert
            message="游客模式"
            description={
              <div>
                <p>您当前是游客用户，可以浏览和配置系统，但无法发送消息。</p>
                <p style={{ marginBottom: '12px' }}>如需使用完整功能，请申请升级为普通用户：</p>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>✅ 可以立即发送消息</li>
                  <li>✅ 可以创建定时任务</li>
                  <li>✅ 享受完整功能权限</li>
                </ul>
                <p style={{ margin: '8px 0 0 0' }}>
                  <Button 
                    type="primary" 
                    size="small" 
                    onClick={handleUpgradeRequest}
                  >
                    申请升级为普通用户
                  </Button>
                </p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* 邮箱检查警告 */}
        {!hasEmail && (
          <Alert
            message="邮箱缺失警告"
            description={
              <div>
                <p>您的账户缺少邮箱信息，这可能导致以下功能无法正常使用：</p>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>图片上传功能</li>
                  <li>地址管理功能</li>
                  <li>其他需要安全验证的功能</li>
                </ul>
                <p style={{ margin: '8px 0 0 0' }}>
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<MailOutlined />}
                    onClick={handleEmailFix}
                  >
                    立即修复邮箱
                  </Button>
                </p>
              </div>
            }
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* 基本信息卡片 */}
        <Card title="基本信息" extra={
          <Button
            type={editing ? 'default' : 'primary'}
            icon={editing ? <SaveOutlined /> : <EditOutlined />}
            onClick={editing ? form.submit : handleEdit}
            loading={loading}
          >
            {editing ? '保存' : '编辑'}
          </Button>
        }>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            disabled={!editing}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <Avatar
                size={64}
                icon={<UserOutlined />}
                style={{ backgroundColor: getRoleColor(user.role) }}
              />
              <div style={{ marginLeft: '16px' }}>
                <Title level={3} style={{ margin: 0 }}>{user.nickname}</Title>
                <Space>
                  <Tag color={getRoleColor(user.role)}>
                    {getRoleText(user.role)}
                  </Tag>
                  <Tag color={getStatusColor(user.status)}>
                    {getStatusText(user.status)}
                  </Tag>
                </Space>
              </div>
            </div>

            <Form.Item
              label="昵称"
              name="nickname"
              rules={[
                { required: true, message: '请输入昵称！' },
                { min: 2, message: '昵称至少2个字符！' },
                { max: 20, message: '昵称最多20个字符！' }
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入昵称" />
            </Form.Item>

            <Form.Item label="用户ID">
              <Input value={user.id} disabled />
            </Form.Item>

            <Form.Item label="角色">
              <Input value={getRoleText(user.role)} disabled />
            </Form.Item>

            <Form.Item label="状态">
              <Input value={getStatusText(user.status)} disabled />
            </Form.Item>

            <Form.Item label="注册时间">
              <Input value={new Date(user.created_at).toLocaleString('zh-CN')} disabled />
            </Form.Item>

            {editing && (
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    保存更改
                  </Button>
                  <Button onClick={handleCancel}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            )}
          </Form>
        </Card>

        <Divider />

        {/* 账户安全卡片 */}
        <Card title="账户安全" icon={<LockOutlined />}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="登录方式">昵称 + 密码</Descriptions.Item>
            <Descriptions.Item label="最后登录">
              {user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-CN') : '从未登录'}
            </Descriptions.Item>
            <Descriptions.Item label="账户状态">
              <Tag color={getStatusColor(user.status)}>
                {getStatusText(user.status)}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
          
          <div style={{ marginTop: '16px' }}>
            <Text type="secondary">
              如需修改密码或账户状态，请联系系统管理员
            </Text>
          </div>
        </Card>

        {/* 邮箱修复Modal */}
        <Modal
          title="修复邮箱信息"
          open={emailModalVisible}
          onCancel={() => setEmailModalVisible(false)}
          footer={null}
        >
          <Form
            form={emailForm}
            layout="vertical"
            onFinish={handleEmailSave}
          >
            <Form.Item
              label="邮箱地址"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱地址' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input 
                prefix={<MailOutlined />}
                placeholder="请输入您的邮箱地址"
              />
            </Form.Item>
            
            <Alert
              message="重要提示"
              description="邮箱用于建立安全会话，修复后需要重新登录才能生效。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  保存邮箱
                </Button>
                <Button onClick={() => setEmailModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 🎭 升级申请Modal */}
        <Modal
          title="申请升级为普通用户"
          open={upgradeModalVisible}
          onCancel={() => setUpgradeModalVisible(false)}
          footer={null}
          width={500}
        >
          <Form
            form={upgradeForm}
            layout="vertical"
            onFinish={handleUpgradeSubmit}
          >
            <Alert
              message="游客模式限制"
              description={
                <div>
                  <p>游客用户可以使用以下功能：</p>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>✅ 浏览系统界面</li>
                    <li>✅ 创建和配置推送任务</li>
                    <li>✅ 添加Webhook地址</li>
                    <li>✅ 上传图片生成链接</li>
                  </ul>
                  <p style={{ margin: '8px 0 0 0', color: '#ff4d4f' }}>
                    ❌ 但无法实际发送消息（立即发送和定时发送均不可用）
                  </p>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            
            <Form.Item
              label="当前角色"
              name="currentRole"
            >
              <Input disabled value="游客用户" />
            </Form.Item>
            
            <Form.Item
              label="目标角色"
              name="targetRole"
            >
              <Input disabled value="普通用户" />
            </Form.Item>

            <Form.Item
              label="申请理由（可选）"
              name="reason"
            >
              <Input.TextArea 
                rows={4}
                placeholder="请简要说明申请升级的原因，例如：需要使用消息发送功能进行营销推广"
                maxLength={200}
              />
            </Form.Item>
            
            <Alert
              message="审核说明"
              description="提交申请后，管理员将在1-3个工作日内审核。审核通过后，您将自动升级为普通用户，可以使用完整功能。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  提交申请
                </Button>
                <Button onClick={() => setUpgradeModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

      </div>
    </div>
  );
};

export default UserProfile;

