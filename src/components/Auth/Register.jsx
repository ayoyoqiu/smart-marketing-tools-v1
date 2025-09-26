import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Space, Divider, message } from 'antd';
import { UserOutlined, LockOutlined, UserAddOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const { Title, Text } = Typography;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 如果用户没有输入邮箱，传递null
      const email = values.email && values.email.trim() ? values.email.trim() : null;
      const success = await register(values.nickname, values.password, email);
      if (success) {
        message.success('注册成功！已自动登录，正在跳转到首页...');
        // 注册成功后直接跳转到首页，因为已经自动登录了
        navigate('/');
      } else {
        message.error('注册失败，请检查输入信息或稍后重试');
      }
    } catch (error) {
      console.error('注册异常:', error);
      message.error('注册过程中发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: '16px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <img 
              src="/images/ai-robot-icon.png" 
              alt="智能营销小工具" 
              style={{ 
                width: 28, 
                height: 28, 
                objectFit: 'contain'
              }} 
            />
            智能营销小工具
          </Title>
          <Text type="secondary">创建您的账户</Text>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="nickname"
            rules={[
              { required: true, message: '请输入昵称！' },
              { min: 2, message: '昵称至少2个字符！' },
              { max: 20, message: '昵称最多20个字符！' },
              { pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, message: '昵称只能包含字母、数字、下划线和中文！' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入昵称（2-20个字符）"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码！' },
              { min: 6, message: '密码至少6个字符！' },
              { max: 50, message: '密码最多50个字符！' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码（至少6位）"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址！' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱地址（可选）"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码！' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致！'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请再次输入密码"
              style={{ borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '8px',
                fontSize: '16px'
              }}
              icon={<UserAddOutlined />}
            >
              注册
            </Button>
          </Form.Item>
        </Form>

        <Divider>
          <Text type="secondary">注册须知</Text>
        </Divider>

        <div style={{ marginBottom: '24px' }}>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>昵称将作为您的登录标识，请妥善保管</li>
              <li>邮箱地址用于账户验证和登录，请使用真实邮箱</li>
              <li>密码至少6位，建议使用字母+数字的组合</li>
              <li>注册成功后，您将拥有独立的数据空间</li>
              <li>所有数据都将安全存储，确保隐私保护</li>
            </ul>
          </Text>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">已有账户？</Text>
          <Link to="/login" style={{ marginLeft: '8px', color: '#1890ff' }}>
            立即登录
          </Link>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            智能营销小工具 v1.0 - 多用户版本
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;

