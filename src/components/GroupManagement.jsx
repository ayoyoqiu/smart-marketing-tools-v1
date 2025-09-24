import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Table,
  Space,
  Tag,
  message,
  Popconfirm,
  ColorPicker,
  InputNumber,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { supabase, checkAuthStatus, getCurrentSession } from '../../supabaseClient';
import { useAuth } from '../contexts/AuthContext';


const GroupManagement = ({ visible, onCancel, onGroupChange }) => {
  const { user, isAdmin } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      fetchGroups();
    }
  }, [visible]);

  // 获取用户的分组
  const fetchGroups = async () => {
    setLoading(true);
    try {
              // 从groups表获取分组信息（包括系统分组和用户分组）
        let query = supabase
          .from('groups')
          .select('id, name, description, color, sort_order, user_id')
          .or(`user_id.eq.${user?.id},user_id.is.null`)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

      if (!user?.id) {
        console.error('用户ID为空，无法查询分组');
        setGroups([]);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

              // 格式化分组数据
        const formattedGroups = (data || []).map((group, index) => ({
          id: group.id,
          name: group.name,
          description: group.description || `分组: ${group.name}`,
          color: group.color || '#1890ff',
          sort_order: group.sort_order || index,
          user_id: group.user_id || user.id,
          creator: user.nickname || user.email || '当前用户'
        }));
        
        // 添加"全部"选项
        formattedGroups.unshift({
          id: 'all',
          name: '全部',
          description: '所有分组的汇总',
          color: '#52c41a',
          sort_order: -1,
          user_id: user.id,
          creator: user.nickname || user.email || '当前用户'
        });
        
        setGroups(formattedGroups);
    } catch (error) {
      console.error('获取分组失败:', error);
      message.error('获取分组失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建或编辑分组
  const handleSubmit = async (values) => {
    try {
      // 检查认证状态
      console.log('🔍 开始认证状态检查...');
      const authStatus = await checkAuthStatus();
      const session = await getCurrentSession();
      
      console.log('🔍 认证状态:', authStatus);
      console.log('🔍 当前会话:', session);

      console.log('🔍 准备创建分组，用户信息:', {
        userId: user?.id,
        userEmail: user?.email,
        userRole: user?.role,
        isAdmin: isAdmin(),
        authStatus: authStatus.isAuthenticated,
        sessionUserId: session?.user?.id
      });

      const groupData = {
        name: values.name,
        description: values.description,
        color: values.color?.toHexString?.() || values.color || '#1890ff',
        sort_order: values.sort_order || 0,
        user_id: user?.id
      };

      console.log('🔍 分组数据:', groupData);

      if (editingGroup) {
        // 编辑分组
        console.log('🔍 编辑分组:', editingGroup.id);
        const { error } = await supabase
          .from('groups')
          .update(groupData)
          .eq('id', editingGroup.id);

        if (error) throw error;
        message.success('分组更新成功');
      } else {
        // 创建新分组
        console.log('🔍 创建新分组');
        const { error } = await supabase
          .from('groups')
          .insert([groupData]);

        if (error) {
          console.error('❌ 分组创建失败:', error);
          throw error;
        }
        message.success('分组创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingGroup(null);
      fetchGroups();
      onGroupChange?.(); // 通知父组件分组已更新
    } catch (error) {
      console.error('保存分组失败:', error);
      message.error('保存分组失败');
    }
  };

  // 删除分组
  const handleDelete = async (groupId) => {
    try {
      // 保护系统分组，不允许删除
      if (groupId === 'all') {
        message.warning('"全部"是系统分组，不能删除');
        return;
      }

      // 检查分组是否被使用
      const { data: webhooks, error: webhookError } = await supabase
        .from('webhooks')
        .select('id')
        .eq('group_id', groupId);

      if (webhookError) throw webhookError;

      if (webhooks && webhooks.length > 0) {
        message.warning(`该分组下还有 ${webhooks.length} 个webhook，无法删除。请先移除或重新分配webhook。`);
        return;
      }

      // 删除分组
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      message.success('分组删除成功');
      fetchGroups();
      onGroupChange?.(); // 通知父组件分组已更新
    } catch (error) {
      console.error('删除分组失败:', error);
      message.error('删除分组失败');
    }
  };

  // 打开编辑模态框
  const handleEdit = (group) => {
    // 保护系统分组，不允许编辑
    if (group.id === 'all') {
      message.warning('"全部"是系统分组，不能编辑');
      return;
    }

    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      color: group.color,
      sort_order: group.sort_order,
      creator: user?.nickname || user?.email || '未知用户' // 编辑时也显示当前用户
    });
    setModalVisible(true);
  };

  // 打开创建模态框
  const handleCreate = () => {
    setEditingGroup(null);
    form.resetFields();
    form.setFieldsValue({
      color: '#1890ff',
      sort_order: 0,
      creator: user?.nickname || user?.email || '未知用户' // 自动设置创建人
    });
    setModalVisible(true);
  };

  const columns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Tag color={record.color} icon={<FolderOutlined />}>
            {name}
          </Tag>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      render: (creator, record) => {
        // 如果是当前用户创建的分组，显示"我"
        if (record.user_id === user?.id) {
          return <Tag color="blue">我</Tag>;
        }
        // 如果是其他用户创建的分组，显示用户昵称
        return creator?.nickname || record.user_id || '未知用户';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="编辑分组">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={!isAdmin() && record.user_id !== user?.id || record.id === 'all'}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个分组吗？"
            description="删除后，该分组下的地址将变为未分组状态"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除分组">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!isAdmin() && record.user_id !== user?.id || record.id === 'all'}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Modal
        title="分组管理"
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建分组
          </Button>,
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Table
          columns={columns}
          dataSource={groups}
          loading={loading}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>

      {/* 创建/编辑分组模态框 */}
      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            color: '#1890ff',
            sort_order: 0
          }}
        >
          <Form.Item
            name="name"
            label="分组名称"
            rules={[
              { required: true, message: '请输入分组名称' },
              { max: 100, message: '分组名称不能超过100个字符' }
            ]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="分组描述"
            rules={[{ max: 500, message: '分组描述不能超过500个字符' }]}
          >
            <Input.TextArea
              placeholder="请输入分组描述（可选）"
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="color"
            label="分组颜色"
          >
            <ColorPicker />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="排序顺序"
            rules={[{ type: 'number', min: 0, message: '排序顺序必须大于等于0' }]}
          >
            <InputNumber
              placeholder="数字越小排序越靠前"
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="creator"
            label="创建人"
          >
            <Input 
              placeholder="创建人" 
              style={{ backgroundColor: '#fafafa' }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingGroup ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      
    </>
  );
};

export default GroupManagement;
