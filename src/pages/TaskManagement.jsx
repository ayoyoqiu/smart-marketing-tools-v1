import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  message,
  Popconfirm,
  Tooltip,
  Tabs,
  Spin,
  Pagination
} from 'antd'
import RichTextEditor from '../components/RichTextEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import {
  PlusOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { supabase, TABLES, TASK_STATUS, MESSAGE_TYPE } from '../../supabaseClient'
import dayjs from 'dayjs'
import axios from 'axios'
import { API_ENDPOINTS } from '../../config'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

// 文件转base64的辅助函数
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    // 检查文件类型
    if (!file || !(file instanceof File || file instanceof Blob)) {
      reject(new Error('无效的文件对象'));
      return;
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      try {
      // 提取base64数据部分（去掉data:image/jpeg;base64,前缀）
      const base64 = reader.result.split(',')[1];
      resolve(base64);
      } catch (error) {
        reject(new Error('Base64转换失败: ' + error.message));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

// Base64转Blob的辅助函数
const dataURLtoBlob = (dataURL) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

const { TextArea } = Input
const { Option } = Select

const TaskManagement = () => {
  const { user, isAdmin, currentRole, availableRoles } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [form] = Form.useForm()

  // 新建/编辑任务弹窗表单字段
  const [isImmediate, setIsImmediate] = useState(false)
  const [type, setType] = useState(MESSAGE_TYPE.TEXT_IMAGE)

  // 用于存储上传的本地图片
  const [uploadedImage, setUploadedImage] = useState(null);
  // 新增：发送按钮loading状态
  const [sending, setSending] = useState(false);
  // 新增：内容预览数据
  const [previewData, setPreviewData] = useState({});
  // 新增：分组相关状态
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(['all']);
  const [selectedMessageType, setSelectedMessageType] = useState('all');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 新增：数据缓存状态
  const [lastFetchTime, setLastFetchTime] = useState(() => {
    // 从localStorage恢复缓存时间
    const saved = localStorage.getItem(`taskCache_${user?.id}`);
    return saved ? parseInt(saved) : 0;
  });
  const [cacheExpiry] = useState(5 * 60 * 1000); // 5分钟缓存过期，减少频繁查询
  const [isInitialized, setIsInitialized] = useState(() => {
    // 从localStorage恢复初始化状态
    const saved = localStorage.getItem(`taskInit_${user?.id}`);
    return saved === 'true';
  });

  // 数据加载函数 - 使用useCallback优化
  const loadData = useCallback(async () => {
      try {
        console.log('🔄 强制获取数据，忽略缓存...');
        const now = Date.now();
        const shouldFetch = true; // 强制获取数据
      
      if (shouldFetch) {
        console.log('🔄 开始获取数据...', {
          reason: !isInitialized ? '首次加载' : '缓存过期',
          cacheAge: Math.round((now - lastFetchTime) / 1000) + '秒'
        });
        
        // 显示加载状态
        setLoading(true);
        
        try {
          // 并行执行多个异步操作，提升加载速度
          console.log('🚀 并行获取数据...')
          const [tasksData, groupsData] = await Promise.all([
            fetchTasks(),
            fetchGroups()
          ]);
          
          console.log('✅ 数据获取完成:', { 
            tasks: tasksData?.length || 0, 
            groups: groupsData?.length || 0 
          })
          
          // 设置分组数据
          if (groupsData) {
          setGroups(groupsData);
          }
          
          // 更新缓存时间和初始化状态
          setLastFetchTime(now);
          setIsInitialized(true);
          
          // 持久化缓存到localStorage
          if (user?.id) {
            localStorage.setItem(`taskCache_${user.id}`, now.toString());
            localStorage.setItem(`taskInit_${user.id}`, 'true');
            localStorage.setItem('lastUserId', user.id);
          }
          
          console.log('🎯 数据加载完成，缓存已更新并持久化');
        } catch (error) {
          console.error('❌ 数据获取失败:', error);
          // 即使失败也要标记为已初始化，避免无限重试
          setIsInitialized(true);
        } finally {
          setLoading(false);
        }
        } else {
          console.log('⚡ 使用缓存数据，跳过查询');
        }
      } catch (error) {
        console.error('❌ 数据加载失败:', error);
      console.error('❌ 错误详情:', {
        message: error.message,
        stack: error.stack,
        type: typeof error
      });
      // 即使失败也要设置loading为false
      setLoading(false);
    }
  }, [user?.id, lastFetchTime, cacheExpiry]);

  // 检查用户登录状态
  useEffect(() => {
    if (!user?.id) {
      console.warn('⚠️ 用户未登录或ID为空');
      message.warning('请先登录后再使用任务管理功能');
      return;
    }
    
    console.log('✅ 用户已登录:', { userId: user.id, nickname: user.nickname });
    
    // 执行数据加载
    loadData();
  }, [user?.id]) // 移除loadData依赖，避免循环

  // 监听loading状态变化
  useEffect(() => {
    console.log('🔍 loading状态变化:', loading)
  }, [loading])

  // 监听tasks状态变化
  useEffect(() => {
    console.log('🔍 tasks状态变化:', tasks?.length || 0, '条数据')
  }, [tasks])

  // 智能预加载：当用户即将访问任务管理页面时预加载数据
  useEffect(() => {
    if (user?.id && !isInitialized) {
      // 检查是否有缓存的用户数据
      const cachedUserId = localStorage.getItem('lastUserId');
      const hasUserCache = cachedUserId === user.id;
      
      if (hasUserCache) {
        console.log('⚡ 检测到用户缓存，快速恢复数据...')
        // 延迟50ms执行，快速恢复
        const timer = setTimeout(() => {
          loadData();
        }, 50);
        
        return () => clearTimeout(timer);
      } else {
        console.log('🔄 新用户或缓存过期，正常加载数据...')
        // 延迟100ms执行，避免阻塞页面渲染
        const timer = setTimeout(() => {
          loadData();
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id, isInitialized]);

  const testDatabaseConnection = async () => {
    try {
      
      // 测试基本连接
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (testError) {
        console.error('❌ 数据库连接测试失败:', testError)
        message.error('数据库连接失败，请检查配置')
      } else {
        console.log('✅ 数据库连接正常')
      }
      
      // 检查当前用户权限
      if (user?.id) {
        console.log('🔑 检查用户权限...')
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, nickname, role, status')
          .eq('id', user.id)
          .single()
        
        if (userError) {
          console.error('❌ 用户权限检查失败:', userError)
        } else {
          console.log('✅ 用户权限检查成功:', userData)
        }
      }
    } catch (error) {
      console.error('❌ 数据库连接测试异常:', error)
    }
  }

  // 优化消息类型切换体验
  useEffect(() => {
    // 只在弹窗打开时响应type切换，但不重置已有数据
    if (modalVisible) {
      // 只在创建新任务时重置字段，编辑现有任务时不重置
      if (!editingTask) {
        if (type === MESSAGE_TYPE.TEXT_IMAGE) {
          form.setFieldsValue({
            text: '',
            images: '',
            at: 'None',
            title: '',
            description: '',
            url: '',
            picurl: ''
          });
        } else if (type === MESSAGE_TYPE.CARD) {
          form.setFieldsValue({
            text: '',
            images: '',
            at: 'None',
            title: '',
            description: '',
            url: '',
            picurl: ''
          });
        } else if (type === MESSAGE_TYPE.RICH_TEXT) {
          form.setFieldsValue({
            richText: '',
            at: 'None',
            title: ''
          });
        }
      }
      setPreviewData({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, modalVisible]);

  const fetchTasks = async () => {
    try {
      console.log('🚀 开始获取任务列表...')
      console.log('🔍 用户状态检查:', {
        user: user,
        userId: user?.id,
        userEmail: user?.email,
        userRole: user?.role
      });
      
      // 🔒 权限控制：确保用户已登录
      if (!user?.id) {
        console.error('❌ 用户未登录，无法获取任务列表');
        setTasks([]);
        return [];
      }
      
      console.log('🔍 构建优化查询...')
      // 只选择必要的字段，减少数据传输
      let query = supabase
        .from(TABLES.TASKS)
        .select('id, title, type, status, scheduled_time, created_at, creator, group_category, user_id, content')
        .order('created_at', { ascending: false })
        .limit(100) // 限制返回数量，提升性能
      
      // 🔒 权限控制：普通用户只能看到自己的任务，管理员可以看到所有任务
      console.log('🔍 权限检查详情:', {
        isAdmin: isAdmin(),
        userId: user?.id,
        userRole: user?.role,
        currentRole: currentRole,
        availableRoles: availableRoles
      });
      
      if (isAdmin()) {
        // 管理员可以看到所有任务
        console.log('🔍 管理员权限 - 获取所有任务');
      } else {
        // 普通用户只能看到自己的任务
        query = query.eq('user_id', user.id);
        console.log('🔍 普通用户权限 - 只获取用户自己的任务');
      }
      
      console.log('⚡ 执行优化查询...')
      const startTime = performance.now();
      
      try {
        const { data, error } = await query
        const endTime = performance.now();
        
        console.log(`⚡ 查询耗时: ${Math.round(endTime - startTime)}ms`)

        if (error) {
          console.error('❌ 数据库查询错误:', {
            error,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error
        }
        
        console.log('✅ 查询成功，数据条数:', data?.length || 0)
        console.log('🔍 查询结果详情:', data?.slice(0, 3).map(t => ({
          id: t.id?.slice(0, 8),
          title: t.title,
          status: t.status,
          type: t.type
        })));
        
        if (data && data.length > 0) {
          setTasks(data)
          console.log('✅ 任务数据设置完成:', data.length, '条')
          return data
        } else {
          console.log('⚠️ 没有查询到任务数据')
          setTasks([])
          return []
        }
      } catch (queryError) {
        console.error('❌ 查询执行失败:', {
          error: queryError,
          message: queryError.message,
          stack: queryError.stack
        });
        setTasks([])
        return []
      }
    } catch (error) {
      console.error('❌ 获取任务列表失败:', error)
      message.error(`获取任务列表失败: ${error.message}`)
      setTasks([])
      return []
    }
  }

  const fetchActiveWebhooks = async (selectedCategories = null) => {
    try {
      // 确保用户已登录
      if (!user?.id) {
        console.warn('用户未登录，无法获取webhook');
        return [];
      }
      
      // 确保selectedCategories是数组格式
      let validSelectedCategories = selectedCategories;
      if (selectedCategories && !Array.isArray(selectedCategories)) {
        if (typeof selectedCategories === 'string') {
          validSelectedCategories = [selectedCategories];
        } else {
          validSelectedCategories = null;
        }
      }
      
      console.log('🔍 fetchActiveWebhooks 开始执行:', {
        userId: user.id,
        userNickname: user.nickname,
        selectedCategories: validSelectedCategories,
        selectedCategoriesType: typeof validSelectedCategories,
        selectedCategoriesLength: validSelectedCategories?.length
      });
      
      let query = supabase
        .from(TABLES.WEBHOOKS)
        .select('webhook_url, group_id, user_id, status')
        .eq('status', 'active')
        .eq('user_id', user.id); // 🔒 强制用户隔离！
      
      console.log('🔍 基础查询构建完成:', {
        table: TABLES.WEBHOOKS,
        statusFilter: 'active',
        userIdFilter: user.id
      });
      
      // 🔒 强制分组过滤，确保用户只能看到自己的分组
      if (validSelectedCategories && validSelectedCategories.length > 0 && !validSelectedCategories.includes('all')) {
        // 过滤有效的UUID值
        const validCategories = validSelectedCategories.filter(cat => {
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cat);
          if (!isValidUUID) {
            console.warn('⚠️ 无效的分组ID，跳过:', cat);
          }
          return isValidUUID;
        });
        
        if (validCategories.length > 0) {
          console.log('🔍 添加分组过滤:', validCategories);
          query = query.in('group_id', validCategories);
      } else {
          console.log('⚠️ 没有有效的分组ID，返回所有webhook');
        }
      } else {
        console.log('🔍 选择全部，返回用户的所有webhook');
        // 选择'all'时，返回用户的所有webhook，不添加分组过滤
      }
      
      console.log('🔍 最终查询条件:', {
        status: 'active',
        user_id: user.id,
        groupFilter: selectedCategories && selectedCategories.length > 0 && !selectedCategories.includes('all') ? 'enabled' : 'disabled'
      });
      
      console.log('🔍 执行查询...');
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ webhook查询失败:', error);
        throw error;
      }
      
      console.log('🔍 查询结果:', {
        data,
        dataLength: data?.length || 0,
        error: error || '无错误'
      });
      
      const webhookUrls = data?.map(item => item.webhook_url) || [];
      
      console.log('🔍 最终返回的webhook:', {
        webhookCount: webhookUrls.length,
        webhookUrls
      });
      
      // 如果没有找到webhook，给出详细提示
      if (webhookUrls.length === 0) {
        console.warn('⚠️ 未找到可用的webhook地址');
        console.warn('可能的原因:');
        console.warn('1. 用户没有创建任何机器人地址');
        console.warn('2. 所有机器人地址状态为禁用');
        console.warn('3. 分组配置不正确');
        console.warn('4. 用户权限问题');
      }
      
      return webhookUrls;
    } catch (error) {
      console.error('❌ Error fetching webhooks:', error);
      return [];
    }
  }

  const fetchGroups = async () => {
    try {
      console.log('🚀 开始获取分组信息...')
      
      // 检查用户登录状态
      if (!user?.id) {
        console.error('❌ 用户ID为空，无法查询分组')
        return []
      }
      
      // 从groups表获取分组信息，包括用户分组和系统默认分组
      console.log('🔍 构建优化分组查询...')
      const startTime = performance.now();
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, user_id')
        .or(`user_id.eq.${user.id},user_id.is.null`) // 包含用户分组和系统默认分组
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .limit(50) // 限制分组数量，提升性能
      
      const endTime = performance.now();
      console.log(`⚡ 分组查询耗时: ${Math.round(endTime - startTime)}ms`)
      
      if (error) {
        console.error('❌ 分组查询失败:', error)
        throw error
      }
      
      console.log('🔍 分组查询结果:', data?.length || 0, '个分组')
      
      // 格式化分组数据
      const formattedGroups = (data || []).map(group => ({
        label: group.name,
        value: group.id,
        color: group.user_id ? '#1890ff' : '#52c41a' // 用户分组蓝色，系统分组绿色
      }))
      
      // 添加"全部"选项（如果不存在的话）
      if (!data?.some(g => g.name === '全部')) {
        formattedGroups.unshift({
          label: '全部',
          value: 'all',
          color: '#52c41a'
        })
      }
      
      console.log('✅ 分组数据格式化完成:', formattedGroups.length, '个分组')
      return formattedGroups
    } catch (error) {
      console.error('❌ 获取分组失败:', error)
      return []
    }
  }

  // 获取过滤后的任务数据
  const getFilteredTasks = () => {
    let filteredTasks = tasks

    // 按消息类型筛选
    if (selectedMessageType !== 'all' && selectedMessageType !== null) {
      filteredTasks = filteredTasks.filter(task => {
        return task.type === selectedMessageType
      })
    }

    return filteredTasks
  }

  // 获取分页后的任务数据
  const paginatedTasks = useMemo(() => {
    const data = getFilteredTasks()
    const start = (currentPage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [tasks, selectedMessageType, currentPage, pageSize])

  const openTaskModal = (immediate = false, record = null) => {
    setIsImmediate(immediate)
    setEditingTask(record)
    
    if (record) {
      // 编辑现有任务
      setType(record.type)
      
      // 根据消息类型设置不同的表单字段
      if (record.type === MESSAGE_TYPE.TEXT_IMAGE) {
        console.log('🔍 恢复图文消息任务:', {
          title: record.title,
          text: record.content?.text || record.content?.richText,
          images: record.content?.images,
          image: record.content?.image,
          group_category: record.group_category,
          fullContent: record.content
        });
        
        form.setFieldsValue({
          title: record.title,
          type: record.type,
          text: record.content?.text || record.content?.richText || '', // 支持富文本内容
          images: record.content?.images || '',
          at: record.content?.at || 'None',
          scheduled_time: record.scheduled_time ? dayjs(record.scheduled_time) : null,
          creator: record.creator || user?.nickname || user?.email || '未知用户'
        })
        
        // 恢复图片上传状态
        if (record.content?.image?.base64) {
          // 如果有base64数据，创建一个模拟的File对象用于显示
          const imageBlob = dataURLtoBlob(`data:${record.content.image.type || 'image/jpeg'};base64,${record.content.image.base64}`);
          const imageFile = new File([imageBlob], record.content.image.name || 'image.jpg', { 
            type: record.content.image.type || 'image/jpeg' 
          });
          setUploadedImage(imageFile);
          console.log('🔄 已恢复图片状态:', imageFile.name);
        } else {
          setUploadedImage(null);
          console.log('🔍 任务中没有图片内容');
        }
        
        // 设置选中的分组
        if (record.group_category && record.group_category.length > 0) {
          // 确保group_category是数组格式
          const groupArray = Array.isArray(record.group_category) ? record.group_category : [record.group_category];
          setSelectedGroups(groupArray);
          console.log('🔄 已恢复分组选择:', groupArray);
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: groupArray
          });
        } else {
          setSelectedGroups(['all']); // 默认选择全部
          console.log('🔄 使用默认分组: all');
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: ['all']
          });
        }
      } else if (record.type === MESSAGE_TYPE.CARD) {
        form.setFieldsValue({
          title: record.title,
          type: record.type,
          cardTitle: record.content?.title || '',
          description: record.content?.description || '',
          url: record.content?.url || '',
          picurl: record.content?.picurl || '',
          scheduled_time: record.scheduled_time ? dayjs(record.scheduled_time) : null,
          creator: record.creator || '',
          group_category: record.group_category || []
        })
        
        // 设置选中的分组
        if (record.group_category && record.group_category.length > 0) {
          // 确保group_category是数组格式
          const groupArray = Array.isArray(record.group_category) ? record.group_category : [record.group_category];
          setSelectedGroups(groupArray);
          console.log('🔄 已恢复分组选择:', groupArray);
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: groupArray
          });
        } else {
          setSelectedGroups(['all']); // 默认选择全部
          console.log('🔄 使用默认分组: all');
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: ['all']
          });
        }
      } else if (record.type === MESSAGE_TYPE.RICH_TEXT) {
        form.setFieldsValue({
          title: record.title,
          type: record.type,
          richText: record.content?.richText || record.content?.text || '', // 兼容旧数据
          scheduled_time: record.scheduled_time ? dayjs(record.scheduled_time) : null,
          creator: record.creator || '',
          group_category: record.group_category || []
        })
        
        // 设置选中的分组
        if (record.group_category && record.group_category.length > 0) {
          setSelectedGroups(record.group_category);
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: record.group_category
          });
        } else {
          setSelectedGroups(['all']);
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: ['all']
          });
        }
      } else {
        // 其他类型
      form.setFieldsValue({
        ...record,
        scheduled_time: record.scheduled_time ? dayjs(record.scheduled_time) : null,
        text: record.content?.text || '',
        images: record.content?.images || '',
        at: record.content?.at || 'None',
        title: record.content?.title || '',
        description: record.content?.description || '',
        url: record.content?.url || '',
          picurl: record.content?.picurl || '',
          group_category: record.group_category || []
        })
        
        // 设置选中的分组
        if (record.group_category && record.group_category.length > 0) {
          // 确保group_category是数组格式
          const groupArray = Array.isArray(record.group_category) ? record.group_category : [record.group_category];
          setSelectedGroups(groupArray);
          console.log('🔄 已恢复分组选择:', groupArray);
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: groupArray
          });
        } else {
          setSelectedGroups(['all']); // 默认选择全部
          console.log('🔄 使用默认分组: all');
          
          // 同时更新表单的group_category字段
          form.setFieldsValue({
            group_category: ['all']
          });
        }
      }
    } else {
      // 新建任务
      setType(MESSAGE_TYPE.TEXT_IMAGE)
      setUploadedImage(null)
      setSelectedGroups(['all'])  // 修复：设置为默认值而不是空数组
      form.resetFields()
      form.setFieldsValue({ 
        at: 'None',
        // 自动填充创建人字段
        creator: user?.nickname || user?.email || '未知用户'
      })
    }
    setModalVisible(true)
  }

  const handleCreateTask = () => {
    setEditingTask(null)
    setUploadedImage(null) // 重置图片上传状态
    form.resetFields()
    setModalVisible(true)
  }



  const handleDeleteTask = async (id) => {
    try {
      const { error } = await supabase
        .from(TABLES.TASKS)
        .delete()
        .eq('id', id)

      if (error) throw error
      message.success('任务删除成功')
      fetchTasks()
    } catch (error) {
      message.error('删除任务失败')
      console.error('Error deleting task:', error)
    }
  }

  const handleSubmit = async (values) => {
    console.log('🚀 开始提交表单，消息类型:', values.type);
    console.log('📋 表单值:', values);
    console.log('🖼️ 上传的图片:', uploadedImage);
    console.log('👥 当前选中的分组:', selectedGroups);
    console.log('📝 富文本内容:', values.richText);
    console.log('📄 文本内容:', values.text);
    console.log('📋 分组字段值:', values.group_category);
    console.log('🎯 卡片标题:', values.cardTitle);
    console.log('📝 卡片描述:', values.description);
    console.log('🔗 卡片链接:', values.url);
    console.log('🖼️ 卡片图片:', values.picurl);
    
    setSending(true);
    try {
      // 根据消息类型组装content字段
      let content = {};
      if (values.type === MESSAGE_TYPE.TEXT_IMAGE) {
        // 如果有本地图片，转换为base64存储
        let images = values.images || '';
        if (uploadedImage && !isImmediate) {
          try {
            console.log('🔍 开始处理图片:', {
              type: uploadedImage.type,
              size: uploadedImage.size,
              name: uploadedImage.name
            });
            
            // 将本地图片转换为base64
            const base64 = await fileToBase64(uploadedImage);
            images = base64; // 存储base64数据而不是文件名
            console.log('🔄 本地图片已转换为base64，长度:', base64.length);
          } catch (error) {
            console.error('❌ 图片转换base64失败:', error);
            message.warning('图片转换失败，定时任务可能无法正常执行');
            // 如果转换失败，使用空字符串，避免任务创建失败
            images = '';
          }
        }
        
        content = {
          text: values.text || '', // 保存富文本内容
          richText: values.text || '', // 同时保存为richText字段，确保兼容性
          images: images, // 保存图片链接或base64数据
          image: {
            base64: images,
            type: uploadedImage ? uploadedImage.type : 'image/jpeg',
            name: uploadedImage ? uploadedImage.name : 'image.jpg',
            size: uploadedImage ? uploadedImage.size : 0
          },
          at: values.at || 'None'
        };
      } else if (values.type === MESSAGE_TYPE.RICH_TEXT) {
        content = {
          richText: values.richText || '',
          text: values.richText || '', // 同时保存到text字段，确保兼容性
          type: MESSAGE_TYPE.RICH_TEXT
        };
      } else if (values.type === MESSAGE_TYPE.CARD) {
        content = {
          title: values.cardTitle || '',
          description: values.description || '',
          url: values.url || '',
          picurl: values.picurl || ''
        };
      }
      
      const taskData = {
        title: values.title || '未命名任务',
        type: values.type, // 使用表单中的type值
        content,
        scheduled_time: isImmediate ? null : values.scheduled_time?.toISOString(),
        status: isImmediate ? 'pending' : 'pending',
        user_id: user?.id,  // 确保设置用户ID
        creator: values.creator || user?.nickname || user?.email || '未知用户',  // 添加创建人字段
        group_category: values.group_category && values.group_category.length > 0 ? values.group_category : (selectedGroups && selectedGroups.length > 0 ? selectedGroups : 'all')  // 添加分组信息
      }

              // 如果是立即发送，需要处理推送
        if (isImmediate) {
          console.log('🔍 立即发送模式，检查图片状态:', uploadedImage ? uploadedImage.name : '无图片');
          console.log('🔍 图片对象详情:', uploadedImage);
          console.log('🔍 用户信息:', { userId: user?.id, userNickname: user?.nickname });
          
          // 获取选中的分组webhook地址
          console.log('🔍 准备获取webhook地址，选中分组:', selectedGroups);
          const webhooks = await fetchActiveWebhooks(selectedGroups);
          console.log('🔍 获取到的webhook地址:', webhooks);
          
          if (!webhooks.length) {
            message.error('未配置可用的机器人Webhook地址！');
            setSending(false);
            return;
          }
        
        let sendSuccess = true;
        let errorMsg = '';
        const pushResults = [];
        
        if (type === MESSAGE_TYPE.CARD) {
          // 卡片消息推送
          const article = {
            title: values.cardTitle || values.title,
            url: values.url
          };
          if (values.description) article.description = values.description;
          if (values.picurl) article.picurl = values.picurl;
          const news = { articles: [article] };
          
          for (const webhook of webhooks) {
            try {
              const res = await axios.post(API_ENDPOINTS.webhook, {
                webhook,
                news,
                userId: user.id  // 添加用户ID进行权限验证
              });
              const success = res.data && res.data.errcode === 0;
              pushResults.push({ webhook, success, error: success ? null : (res.data?.errmsg || res.data?.error || '未知错误') });
              if (!success) {
                sendSuccess = false;
                errorMsg = res.data?.errmsg || res.data?.error || '未知错误';
              }
            } catch (e) {
              pushResults.push({ webhook, success: false, error: e.response?.data?.error || e.message });
              sendSuccess = false;
              errorMsg = e.response?.data?.error || e.message;
            }
          }
          
          if (sendSuccess) {
            message.success(`卡片消息推送成功 (${pushResults.filter(r => r.success).length}/${pushResults.length})`);
          } else {
            const failedCount = pushResults.filter(r => !r.success).length;
            message.error(`卡片推送失败 (${failedCount}/${pushResults.length}): ${errorMsg}`);
          }
        } else if (type === MESSAGE_TYPE.RICH_TEXT) {
          // 富文本消息推送
          const richText = values.richText || '';
          if (!richText.trim()) {
            message.error('请输入富文本内容');
            return;
          }
          
          for (const webhook of webhooks) {
            try {
              // 推送富文本内容（Markdown格式）
              const res = await axios.post(API_ENDPOINTS.webhook, {
                webhook,
                text: richText,
                type: 'rich_text',
                userId: user.id
              });
              const success = res.data && res.data.errcode === 0;
              pushResults.push({ webhook, success, error: success ? null : (res.data?.errmsg || res.data?.error || '未知错误') });
              if (!success) {
                sendSuccess = false;
                errorMsg = res.data?.errmsg || res.data?.error || '未知错误';
              }
            } catch (e) {
              pushResults.push({ webhook, success: false, error: e.response?.data?.error || e.message });
              sendSuccess = false;
              errorMsg = e.response?.data?.error || e.message;
            }
          }
          
          if (sendSuccess) {
            message.success(`富文本消息推送成功 (${pushResults.filter(r => r.success).length}/${pushResults.length})`);
          } else {
            const failedCount = pushResults.filter(r => !r.success).length;
            message.error(`富文本推送失败 (${failedCount}/${pushResults.length}): ${errorMsg}`);
          }
        } else if (type === MESSAGE_TYPE.TEXT_IMAGE) {
          // 图文消息推送 - 先发送富文本，再发送图片
          let text = values.text || '';
          let images = values.images || '';
          
          console.log('富文本内容:', text);
          console.log('图片数据:', images);
          console.log('上传的图片:', uploadedImage);
          
          for (const webhook of webhooks) {
            try {
              // 先发送富文本内容（支持Markdown格式）
              if (text.trim()) {
                const res = await axios.post(API_ENDPOINTS.webhook, {
                  webhook,
                  type: 'rich_text', // 指定为富文本类型
                  text: text.trim(),
                  userId: user.id,
                  taskId: 'new_task', // 新任务
                  taskName: values.title || '新任务'
                });
                const success = res.data && res.data.errcode === 0;
                pushResults.push({ webhook, success, error: success ? null : (res.data?.errmsg || res.data?.error || '未知错误') });
                if (!success) {
                  sendSuccess = false;
                  errorMsg = res.data?.errmsg || res.data?.error || '富文本发送失败';
                  console.error('❌ 富文本发送失败:', res.data);
                } else {
                  console.log('✅ 富文本发送成功');
                }
              }
              
              // 推送图片（如果有）
              if (uploadedImage || values.images) {
                let imageFile = uploadedImage;
                
                // 如果没有uploadedImage但有images（base64），尝试转换
                if (!imageFile && values.images && typeof values.images === 'string') {
                  try {
                    if (values.images.startsWith('data:')) {
                      // 如果是data URL格式
                      const response = await fetch(values.images);
                      imageFile = await response.blob();
                    } else if (values.images.startsWith('/')) {
                      // 如果是本地文件路径，跳过
                      console.log('⚠️ 跳过本地文件路径图片');
                      continue;
                    }
                  } catch (error) {
                    console.error('❌ 图片转换失败:', error);
                    message.warning('图片转换失败，跳过图片发送');
                    continue;
                  }
                }
                
                if (imageFile instanceof File || imageFile instanceof Blob) {
                  console.log('🔍 准备推送图片:', imageFile.name || 'image', imageFile.size);
                const formData = new FormData();
                formData.append('webhook', webhook);
                  formData.append('image', imageFile);
                  formData.append('userId', user.id);
                
                try {
                  const resImg = await axios.post(API_ENDPOINTS.webhook, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  });
                  console.log('📤 图片推送响应:', resImg.data);
                  if (!resImg.data || resImg.data.errcode !== 0) {
                    sendSuccess = false;
                    errorMsg = resImg.data?.errmsg || resImg.data?.error || '未知错误';
                    console.error('❌ 图片推送失败:', errorMsg);
                  } else {
                    console.log('✅ 图片推送成功');
                  }
                } catch (imgError) {
                  console.error('❌ 图片推送异常:', imgError.response?.data || imgError.message);
                  sendSuccess = false;
                  errorMsg = imgError.response?.data?.error || imgError.message;
                }
              } else {
                  console.log('⚠️ 没有有效的图片文件');
                }
              }
            } catch (e) {
              pushResults.push({ webhook, success: false, error: e.response?.data?.error || e.message });
              sendSuccess = false;
              errorMsg = e.response?.data?.error || e.message;
            }
          }
          
          if (sendSuccess) {
            message.success(`图文消息推送成功 (${pushResults.filter(r => r.success).length}/${pushResults.length})`);
            
            // 立即发送成功后，保存任务到数据库并更新状态
            try {
              const immediateTaskData = {
                ...taskData,
                status: 'completed', // 立即发送成功，状态设为已完成
                completed_at: new Date().toISOString(),
                execution_result: {
                  success: true,
                  sent_at: new Date().toISOString(),
                  webhook_count: webhooks.length,
                  message: '立即发送成功'
                }
              };
              
              const { error: saveError } = await supabase
                .from(TABLES.TASKS)
                .insert([immediateTaskData]);
              
              if (saveError) {
                console.error('❌ 保存立即发送任务失败:', saveError);
                message.warning('任务发送成功，但保存记录失败');
              } else {
                console.log('✅ 立即发送任务已保存到数据库');
              }
            } catch (saveError) {
              console.error('❌ 保存立即发送任务异常:', saveError);
              message.warning('任务发送成功，但保存记录失败');
            }
          } else {
            const failedCount = pushResults.filter(r => !r.success).length;
            message.error(`图文消息推送失败 (${failedCount}/${pushResults.length}): ${errorMsg}`);
            
            // 发送失败也保存任务记录
            try {
              const failedTaskData = {
                ...taskData,
                status: 'failed', // 发送失败，状态设为失败
                failed_at: new Date().toISOString(),
                execution_result: {
                  success: false,
                  failed_at: new Date().toISOString(),
                  error: errorMsg,
                  webhook_count: webhooks.length
                }
              };
              
              const { error: saveError } = await supabase
                .from(TABLES.TASKS)
                .insert([failedTaskData]);
              
              if (saveError) {
                console.error('❌ 保存失败任务记录失败:', saveError);
              }
            } catch (saveError) {
              console.error('❌ 保存失败任务记录异常:', saveError);
            }
          }
        }
        
        setModalVisible(false);
        fetchTasks(); // 刷新任务列表
        form.resetFields();
        setSending(false);
        setPreviewData({});
        setUploadedImage(null);
        return;
      }

      // 保存定时任务
      if (editingTask) {
        const { error } = await supabase
          .from(TABLES.TASKS)
          .update(taskData)
          .eq('id', editingTask.id)

        if (error) throw error
        message.success('任务更新成功')
      } else {
        const { error } = await supabase
          .from(TABLES.TASKS)
          .insert([taskData])

        if (error) throw error
        message.success('任务创建成功')
      }

      setModalVisible(false)
      fetchTasks()
      form.resetFields();
      setSending(false);
      setPreviewData({});
      setUploadedImage(null);
    } catch (error) {
      message.error('保存任务失败: ' + (error.response?.data?.error || error.message || error.toString()));
      setSending(false);
    }
  }

  // 立即推送功能（处理已保存的任务记录）
  const handleImmediateSend = async (record) => {
    // 检查用户登录状态
    if (!user?.id) {
      message.error('用户未登录，无法发送消息');
      return;
    }
    
    console.log('🔍 用户状态检查:', {
      userId: user.id,
      userEmail: user.email,
      userNickname: user.nickname,
      userRole: user.role,
      hasUser: !!user,
      hasUserId: !!user?.id
    });
    
            console.log('🚀 立即发送定时任务:', record.title, record.type);
    console.log('📋 任务内容:', record.content);
    console.log('👤 当前用户:', { userId: user.id, nickname: user.nickname });
    
    // 对于图文消息类型的任务，检查是否有有效的内容
    if (record.type === MESSAGE_TYPE.TEXT_IMAGE) {
      const hasText = record.content?.text && record.content.text.trim();
      const hasRichText = record.content?.richText && record.content.richText.trim();
      const hasImage = record.content?.image;
      const hasImages = record.content?.images && record.content.images.trim();
      
      // 检查是否有任何有效内容（文本、富文本、图片）
      const hasAnyContent = hasText || hasRichText || hasImage || hasImages;
      
      if (!hasAnyContent) {
        message.info('图文消息内容为空，请先编辑任务内容');
        openTaskModal(true, record); // 打开编辑模态框，设置为立即发送模式
        return;
      }
      
      // 如果有内容，继续执行发送逻辑
      console.log('✅ 图文任务内容检查通过:', { 
        hasText, 
        hasRichText, 
        hasImage, 
        hasImages,
        content: record.content 
      });
    }
    
    setSending(true);
    try {
      // 获取任务记录中保存的分组webhook地址
      const groupCategory = record.group_category || selectedGroups;
      console.log('🔍 任务分组信息:', groupCategory);
      
      // 确保groupCategory是数组格式
      let validGroupCategory = groupCategory;
      if (!Array.isArray(groupCategory)) {
        if (typeof groupCategory === 'string') {
          validGroupCategory = [groupCategory];
        } else {
          validGroupCategory = selectedGroups; // 回退到当前选中的分组
        }
      }
      
      console.log('🔍 处理后的分组信息:', validGroupCategory);
      const webhooks = await fetchActiveWebhooks(validGroupCategory);
      if (!webhooks.length) {
        message.error('未配置可用的机器人Webhook地址！');
        setSending(false);
        return;
      }
      
      let sendSuccess = true;
      let errorMsg = '';
      const pushResults = [];
      
      // 按类型区分推送内容
      if (record.type === MESSAGE_TYPE.CARD) {
        // 卡片消息推送
        const title = record.content?.title || '';
        const url = record.content?.url || '';
        
        // 检查卡片消息的必要字段
        if (!title.trim() || !url.trim()) {
          message.error('卡片消息缺少必要字段（标题或链接），无法发送');
          setSending(false);
          return;
        }
        
        const article = {
          title: title,
          url: url
        };
        if (record.content?.description) article.description = record.content.description;
        if (record.content?.picurl) article.picurl = record.content.picurl;
        const news = { articles: [article] };
        
        console.log('选中的分组:', record.group_category || selectedGroups);
        console.log('获取到的webhook数量:', webhooks.length);
        console.log('webhook地址列表:', webhooks);
        console.log('卡片消息数据:', { webhook: webhooks[0], news });
        
              for (const webhook of webhooks) {
          try {
            // 确保用户已登录
            if (!user?.id) {
              message.error('用户未登录，无法发送消息');
              setSending(false);
              return;
            }
            
            const res = await axios.post(API_ENDPOINTS.webhook, {
              webhook,
              news,
              userId: user.id  // 直接使用user.id，确保不为undefined
            });
            const success = res.data && res.data.errcode === 0;
            pushResults.push({ webhook, success, error: success ? null : (res.data?.errmsg || res.data?.error || '未知错误') });
            if (!success) {
              sendSuccess = false;
              errorMsg = res.data?.errmsg || res.data?.error || '未知错误';
            }
          } catch (e) {
            pushResults.push({ webhook, success: false, error: e.response?.data?.error || e.message });
              sendSuccess = false;
            errorMsg = e.response?.data?.error || e.message;
          }
        }
        
        console.log('📊 卡片消息推送结果汇总:', pushResults);
        if (sendSuccess) {
          message.success(`卡片消息推送成功 (${pushResults.filter(r => r.success).length}/${pushResults.length})`);
        } else {
          const failedCount = pushResults.filter(r => !r.success).length;
          message.error(`卡片推送失败 (${failedCount}/${pushResults.length}): ${errorMsg}`);
        }
      } else if (record.type === MESSAGE_TYPE.TEXT_IMAGE) {
        // 图文消息推送 - 分别发送富文本和图片
        const text = record.content.text || record.content.richText || ''; // 支持富文本内容
        const imageData = record.content.image;
        
        // 添加详细的调试信息
        console.log('🔍 图文消息任务内容检查:', {
          taskId: record.id,
          taskTitle: record.title,
          content: record.content,
          text: text,
          imageData: imageData,
          hasText: !!text.trim(),
          hasImageData: !!imageData,
          imageDataKeys: imageData ? Object.keys(imageData) : 'no imageData'
        });
        
        if (!text.trim() && !imageData) {
          message.error('富文本和图片内容都为空，无法发送图文消息');
          setSending(false);
          return;
        }
        
        console.log('选中的分组:', record.group_category || selectedGroups);
        console.log('获取到的webhook数量:', webhooks.length);
        console.log('webhook地址列表:', webhooks);
        console.log('富文本内容:', text);
        console.log('图片数据:', imageData);
        
        for (const webhook of webhooks) {
          try {
            // 确保用户已登录
            if (!user?.id) {
              message.error('用户未登录，无法发送消息');
              setSending(false);
              return;
            }
            
            // 先发送富文本消息（支持Markdown格式）
            if (text.trim()) {
              const textRes = await axios.post(API_ENDPOINTS.webhook, {
                webhook,
                type: 'rich_text', // 指定为富文本类型
                text: text.trim(),
                userId: user.id,
                taskId: record.id,
                taskName: record.title
              });
              console.log('富文本消息发送结果:', textRes.data);
              
              // 检查文本发送是否成功
              if (textRes.data && textRes.data.errcode === 0) {
                console.log('✅ 富文本消息发送成功');
      } else {
                console.log('❌ 富文本消息发送失败:', textRes.data);
                sendSuccess = false;
                errorMsg = textRes.data?.errmsg || '富文本发送失败';
              }
            }
            
            // 再发送图片消息（如果有图片内容）
            if (imageData) {
              let imageFile = imageData.file;
              
              // 如果imageData是base64格式，需要转换
              if (imageData.base64 && !imageFile) {
                try {
                  // 将base64转换为Blob对象
                  const byteCharacters = atob(imageData.base64);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  imageFile = new Blob([byteArray], { type: imageData.type || 'image/jpeg' });
                  console.log('✅ base64图片转换成功:', imageFile.size, 'bytes');
                } catch (error) {
                  console.error('❌ base64图片转换失败:', error);
                  message.warning('图片转换失败，跳过图片发送');
                  continue;
                }
              }
              
              if (imageFile) {
                console.log('🔍 准备发送图片:', imageFile.name || 'image', imageFile.size, 'bytes');
                const formData = new FormData();
                formData.append('webhook', webhook);
                formData.append('userId', user.id);
                formData.append('image', imageFile);
                
                try {
                  const imageRes = await axios.post(API_ENDPOINTS.webhook, formData, {
                    headers: {
                      'Content-Type': 'multipart/form-data'
                    }
                  });
                  
                  const success = imageRes.data && imageRes.data.errcode === 0;
                  pushResults.push({ webhook, success, error: success ? null : (imageRes.data?.errmsg || imageRes.data?.error || '未知错误') });
                  if (!success) {
                    sendSuccess = false;
                    errorMsg = imageRes.data?.errmsg || imageRes.data?.error || '未知错误';
                  } else {
                    console.log('✅ 图片发送成功');
                  }
                } catch (error) {
                  console.error('❌ 图片发送失败:', error);
                  pushResults.push({ webhook, success: false, error: error.response?.data?.error || error.message });
                  sendSuccess = false;
                  errorMsg = error.response?.data?.error || error.message;
                }
              } else {
                console.log('⚠️ 没有有效的图片文件可发送');
              }
            }
            

          } catch (e) {
            pushResults.push({ webhook, success: false, error: e.response?.data?.error || e.message });
            sendSuccess = false;
            errorMsg = e.response?.data?.error || e.message;
          }
        }
        
        console.log('📊 图文消息推送结果汇总:', pushResults);
        if (sendSuccess) {
          message.success(`图文消息推送成功 (${pushResults.filter(r => r.success).length}/${pushResults.length})`);
        } else {
          const failedCount = pushResults.filter(r => !r.success).length;
          message.error(`图文消息推送失败 (${failedCount}/${pushResults.length}): ${errorMsg}`);
        }
      } else if (record.type === MESSAGE_TYPE.RICH_TEXT) {
        // 富文本消息推送
        const richText = record.content?.richText || record.content?.text || '';
        
        // 添加详细的调试信息
        console.log('🔍 富文本任务内容检查:', {
          taskId: record.id,
          taskTitle: record.title,
          content: record.content,
          richText: record.content?.richText,
          text: record.content?.text,
          finalRichText: richText,
          isEmpty: !richText.trim(),
          contentKeys: record.content ? Object.keys(record.content) : 'no content'
        });
        
        // 更宽松的内容检查：检查是否有任何文本内容
        const hasAnyText = richText && richText.trim() && richText.trim().length > 0;
        
        if (!hasAnyText) {
          console.error('❌ 富文本内容检查失败:', {
            richText,
            trimmed: richText?.trim(),
            length: richText?.length
          });
          message.error('富文本内容为空，无法发送');
          setSending(false);
          return;
        }
        
        console.log('当前用户ID:', user.id);
        console.log('当前用户昵称:', user.nickname);
        console.log('选中的分组:', record.group_category || selectedGroups);
        console.log('获取到的webhook数量:', webhooks.length);
        console.log('webhook地址列表:', webhooks);
        console.log('富文本内容:', richText);
        
        for (const webhook of webhooks) {
          try {
            // 确保用户已登录
            if (!user?.id) {
              message.error('用户未登录，无法发送消息');
              setSending(false);
              return;
            }
            
            // 发送富文本消息
            console.log('🔍 发送富文本消息，参数详情:', {
              webhook,
              type: 'rich_text',
              text: richText,
              userId: user.id,
              webhookLength: webhook?.length,
              webhookType: typeof webhook
            });
            
            const res = await axios.post(API_ENDPOINTS.webhook, {
              webhook,
              type: 'rich_text',
              text: richText,
              userId: user.id
            });
            
            const success = res.data && res.data.errcode === 0;
            pushResults.push({ webhook, success, error: success ? null : (res.data?.errmsg || res.data?.error || '未知错误') });
            if (!success) {
              sendSuccess = false;
              errorMsg = res.data?.errmsg || res.data?.error || '未知错误';
            }
          } catch (e) {
            pushResults.push({ webhook, success: false, error: e.response?.data?.error || e.message });
            sendSuccess = false;
            errorMsg = e.response?.data?.error || e.message;
          }
        }
        
        console.log('📊 富文本消息推送结果汇总:', pushResults);
        if (sendSuccess) {
          message.success(`富文本消息推送成功 (${pushResults.filter(r => r.success).length}/${pushResults.length})`);
        } else {
          const failedCount = pushResults.filter(r => !r.success).length;
          message.error(`富文本消息推送失败 (${failedCount}/${pushResults.length}): ${errorMsg}`);
        }
      } else {
        // 其他类型消息推送 - 通过编辑模态框处理
        message.info('该类型消息需要通过编辑模态框处理');
      }
      
      setSending(false);
    } catch (err) {
      message.error('推送失败: ' + (err.response?.data?.error || err.message || err.toString()));
      setSending(false);
    }
  }

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id) => id ? <span style={{ fontSize: 12, color: '#888' }}>{id.slice(0, 8)}...</span> : '-' 
    },
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      ellipsis: { showTitle: false },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span>{text}</span>
        </Tooltip>
      )
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      width: 100,
      render: (creator) => creator || '-' 
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type) => {
        const typeMap = {
          [MESSAGE_TYPE.TEXT]: { color: 'blue', text: '文本' },
          [MESSAGE_TYPE.IMAGE]: { color: 'green', text: '图片' },
          [MESSAGE_TYPE.TEXT_IMAGE]: { color: 'purple', text: '图文消息' },
          [MESSAGE_TYPE.CARD]: { color: 'orange', text: '卡片消息' },
          [MESSAGE_TYPE.RICH_TEXT]: { color: 'cyan', text: '富文本消息' }
        }
        const { color, text } = typeMap[type] || { color: 'default', text: '未知' }
        return <Tag color={color}>{text}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => {
        const statusMap = {
          [TASK_STATUS.PENDING]: { color: 'orange', text: '等待中' },
          [TASK_STATUS.RUNNING]: { color: 'blue', text: '执行中' },
          [TASK_STATUS.COMPLETED]: { color: 'green', text: '已完成' },
          [TASK_STATUS.FAILED]: { color: 'red', text: '失败' },
        }
        const { color, text } = statusMap[status] || { color: 'default', text: '未知' }
        return <Tag color={color}>{text}</Tag>
      },
    },
    {
      title: '计划时间',
      dataIndex: 'scheduled_time',
      key: 'scheduled_time',
      width: 140,
      render: (time) => time ? dayjs(time).format('MM-DD HH:mm') : '-',
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      width: 200,
      ellipsis: { showTitle: false },
      render: (errorMsg, record) => {
        if (record.status === TASK_STATUS.FAILED && errorMsg) {
          return (
            <Tooltip title={errorMsg} placement="topLeft">
              <span style={{ color: '#ff4d4f', fontSize: 12, cursor: 'pointer' }}>
                {errorMsg.length > 15 ? errorMsg.substring(0, 15) + '...' : errorMsg}
              </span>
            </Tooltip>
          );
        }
        return '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space size="small" wrap={false} style={{ whiteSpace: 'nowrap' }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            size="small"
            onClick={() => handleImmediateSend(record)}
          >
            发送
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openTaskModal(false, record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个任务吗？"
            onConfirm={() => handleDeleteTask(record.id)}
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
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <Card
        title="任务管理"
        extra={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', maxWidth: '100%', overflow: 'hidden' }}>
            <Select
              value={selectedMessageType}
              onChange={setSelectedMessageType}
              placeholder="消息类型"
              style={{ width: 120, minWidth: 120 }}
            >
              <Option value="all">全部类型</Option>
              <Option value="text_image">图文消息</Option>
              <Option value="card">卡片消息</Option>
              <Option value="rich_text">富文本消息</Option>
            </Select>
            <Select
              mode="multiple"
              onChange={(values) => {
                console.log('🔍 页面分组选择变更:', values);
                setSelectedGroups(values);
              }}
              placeholder="选择推送分组"
              style={{ width: 150, minWidth: 150 }}
              options={[
                { label: '全部地址', value: 'all' },
                { label: '未分组', value: '未分组' },
                ...groups.map(group => ({ label: group.label, value: group.value }))
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openTaskModal(false)}
              size="small"
            >
              新建任务
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={() => openTaskModal(true)}
              size="small"
            >
              立即发送
            </Button>
            <Button
              icon={<ClockCircleOutlined />}
              onClick={() => {
                console.log('🔄 手动刷新数据...')
                setLastFetchTime(0); // 清除缓存
                setIsInitialized(false); // 重置初始化状态
                loadData(); // 使用统一的loadData函数
              }}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Button
              onClick={testDatabaseConnection}
              size="small"
            >
              测试
            </Button>
            <Button
              onClick={() => {
                console.log('🔧 性能诊断...')
                const now = Date.now();
                const cacheAge = Math.round((now - lastFetchTime) / 1000);
                console.log('🔍 性能状态:', {
                  user: user?.id,
                  tasks: tasks.length,
                  loading,
                  cacheAge: cacheAge + '秒',
                  isInitialized,
                  cacheExpiry: Math.round(cacheExpiry / 1000) + '秒'
                })
                
                // 显示性能信息给用户
                message.info(`缓存状态: ${cacheAge}秒前更新，${tasks.length}个任务`);
              }}
              size="small"
            >
              📊 状态
            </Button>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={paginatedTasks}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          style={{ width: '100%' }}
          scroll={{ x: '100%' }}
          locale={{
            emptyText: loading ? (
              <div style={{ padding: '40px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>🚀 正在加载任务数据...</div>
                <div style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
                  首次加载可能需要几秒钟，请稍候...
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px 0' }}>
                <div style={{ fontSize: '16px', color: '#999' }}>暂无任务数据</div>
                <div style={{ marginTop: '8px', color: '#ccc', fontSize: '12px' }}>
                  点击"新建定时任务"创建您的第一个任务
                </div>
              </div>
            )
          }}
        />
        <div className="task-pagination">
          <div className="ant-pagination-total-text">
            {(() => {
              const total = getFilteredTasks().length
              const start = total ? (currentPage - 1) * pageSize + 1 : 0
              const end = Math.min(currentPage * pageSize, total)
              return `共${total}条: 当前为${start}~${end}`
            })()}
          </div>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={getFilteredTasks().length}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`}
            onChange={(page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            }}
            onShowSizeChange={(current, size) => {
              setCurrentPage(1)
              setPageSize(size)
            }}
            style={{ marginTop: '16px' }}
          />
        </div>
      </Card>

      <Modal
        title={editingTask ? '编辑任务' : (isImmediate ? '立即发送' : '新建定时任务')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingTask(null)
          form.resetFields()
          setSending(false)
          setPreviewData({})
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: MESSAGE_TYPE.TEXT_IMAGE,
            at: 'None',
            creator: user?.nickname || user?.email || '未知用户',
            text: '',
            richText: '',
            group_category: ['all']
          }}
        >
          <Form.Item
                            name="title"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>

            <Form.Item
            name="creator"
            label="创建人"
          >
            <Input placeholder="请输入创建人" />
            </Form.Item>

          <Form.Item
            name="type"
            label="消息类型"
            rules={[{ required: true, message: '请选择消息类型' }]}
          >
            <Select
              value={type}
              onChange={setType}
              options={[
                { label: '图文消息', value: MESSAGE_TYPE.TEXT_IMAGE },
                { label: '富文本消息', value: MESSAGE_TYPE.RICH_TEXT },
                { label: '卡片消息', value: MESSAGE_TYPE.CARD }
              ]}
            />
          </Form.Item>

          {type === MESSAGE_TYPE.TEXT_IMAGE ? (
            <>
              <Form.Item
                name="text"
                label={
                  <Space>
                    <span>文本内容</span>
                    <Tag color="blue" size="small">支持Markdown</Tag>
                  </Space>
                }
                rules={[{ required: false, message: '文本内容不是必填项' }]}
              >
                <RichTextEditor
                  placeholder="请输入要推送的文本内容（支持Markdown格式，不是必填项）"
                  height="300px"
                  showToolbar={true}
                  showPreview={true}
                  showActions={true}
                />
              </Form.Item>

              <Form.Item
                name="images"
                label="图片链接"
              >
                <TextArea
                  rows={3}
                  placeholder="请输入图片链接，每行一个链接"
                  showCount
                  maxLength={1000}
                />
              </Form.Item>

              <Form.Item
                name="at"
                label="@提醒"
              >
                <Select
                  options={[
                    { label: '不提醒', value: 'None' },
                    { label: '@所有人', value: '@all' },
                    { label: '@指定成员', value: '@userid1,userid2' }
                  ]}
                />
              </Form.Item>

              <Form.Item label="上传本地图片">
                <Upload
                  beforeUpload={file => {
                    console.log('📁 选择图片文件:', file.name, file.size);
                    setUploadedImage(file);
                    return false;
                  }}
                  maxCount={1}
                  accept="image/*"
                  onRemove={() => {
                    console.log('🗑️ 移除图片文件');
                    setUploadedImage(null);
                  }}
                >
                  <Button>选择图片</Button>
                </Upload>
                {uploadedImage && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    已选择: {uploadedImage.name} ({(uploadedImage.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </Form.Item>
            </>
          ) : type === MESSAGE_TYPE.RICH_TEXT ? (
            <>
              <Form.Item
                name="richText"
                label={
                  <Space>
                    <span>富文本内容</span>
                    <Tag color="green" size="small">Markdown格式</Tag>
                  </Space>
                }
                rules={[{ required: true, message: '请输入富文本内容' }]}
              >
                <RichTextEditor
                  placeholder="请输入要推送的富文本内容（支持完整的Markdown格式）"
                  height="400px"
                  showToolbar={true}
                  showPreview={true}
                  showActions={true}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="cardTitle"
                label="卡片标题"
                rules={[{ required: true, message: '请输入卡片标题' }]}
              >
                <Input placeholder="请输入卡片标题" />
              </Form.Item>

              <Form.Item
                name="description"
                label="卡片描述"
              >
                <TextArea
                  rows={3}
                  placeholder="请输入卡片描述"
                  showCount
                  maxLength={500}
                />
              </Form.Item>

              <Form.Item
                name="url"
                label="跳转链接"
                rules={[{ required: true, message: '请输入跳转链接' }]}
              >
                <Input placeholder="请输入跳转链接" />
              </Form.Item>

              <Form.Item
                name="picurl"
                label="卡片图片"
              >
                <Input placeholder="请输入卡片图片链接" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="group_category"
            label="选择分组"
            rules={[{ required: true, message: '请选择至少一个分组' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择要推送的分组"
              onChange={(values) => {
                console.log('🔍 分组选择变更:', values);
                // 确保选择的值是有效的
                const validValues = values.filter(v => v === 'all' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
                if (validValues.length !== values.length) {
                  console.warn('⚠️ 过滤掉无效的分组值:', values.filter(v => !validValues.includes(v)));
                }
                setSelectedGroups(validValues);
                // 同时更新表单字段
                form.setFieldValue('group_category', validValues);
              }}
              options={groups.map(group => ({
                label: group.label,
                value: group.value
              }))}
            />
          </Form.Item>

          {!isImmediate && (
            <Form.Item
              name="scheduled_time"
              label="计划时间"
              rules={[{ required: true, message: '请选择计划时间' }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择计划时间"
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={sending}
                icon={isImmediate ? <SendOutlined /> : <ClockCircleOutlined />}
              >
                {isImmediate ? '立即发送' : (editingTask ? '更新任务' : '创建任务')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskManagement

// 任务管理分页样式
const taskPaginationStyles = `
  .task-pagination {
    margin-top: 0;
    text-align: left;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-top: 1px solid #e8e8e8;
    background: #fafafa;
    font-size: 14px;
  }
  
  .task-pagination .ant-pagination {
    display: flex;
    align-items: center;
    margin: 0;
    flex: 1;
    justify-content: center;
  }
  
  .task-pagination .ant-pagination-total-text {
    margin-right: 0;
    color: #333;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .task-pagination .ant-pagination-options {
    margin-left: 16px;
    order: 3;
  }
  
  .task-pagination .ant-pagination-item {
    margin: 0 2px;
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 4px;
  }
  
  .task-pagination .ant-pagination-item a {
    color: #333;
    text-decoration: none;
  }
  
  .task-pagination .ant-pagination-item-active {
    background: #1890ff;
    border-color: #1890ff;
  }
  
  .task-pagination .ant-pagination-item-active a {
    color: #fff;
  }
  
  .task-pagination .ant-pagination-prev,
  .task-pagination .ant-pagination-next {
    margin: 0 4px;
    min-width: 32px;
    height: 32px;
    line-height: 30px;
    border-radius: 4px;
  }
  
  .task-pagination .ant-pagination-prev a,
  .task-pagination .ant-pagination-next a {
    color: #333;
    text-decoration: none;
    font-size: 16px;
    font-weight: bold;
  }
  
  .task-pagination .ant-pagination-jump-prev,
  .task-pagination .ant-pagination-jump-next {
    margin: 0 2px;
  }
  
  .task-pagination .ant-pagination-jump-prev .ant-pagination-item-container,
  .task-pagination .ant-pagination-jump-next .ant-pagination-item-container {
    color: #333;
  }
  
  /* 深色模式下的分页样式 */
  [data-theme="dark"] .task-pagination {
    background: #1a1a1a !important;
    border-top-color: #333333 !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-total-text {
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-item {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-item:hover {
    border-color: #40a9ff !important;
    color: #40a9ff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-item-active {
    background-color: #40a9ff !important;
    border-color: #40a9ff !important;
    color: #f0f0f0 !important;
    font-weight: 600 !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-item-active a {
    color: #f0f0f0 !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-prev,
  [data-theme="dark"] .task-pagination .ant-pagination-next {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-prev:hover,
  [data-theme="dark"] .task-pagination .ant-pagination-next:hover {
    border-color: #40a9ff !important;
    color: #40a9ff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-options .ant-select {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-options .ant-select .ant-select-selector {
    background-color: #2a2a2a !important;
    border-color: #404040 !important;
    color: #ffffff !important;
  }
  
  [data-theme="dark"] .task-pagination .ant-pagination-options .ant-select .ant-select-arrow {
    color: #8c8c8c !important;
  }
  
  /* 深色模式下的表格固定列背景 */
  [data-theme="dark"] .ant-table .ant-table-thead > tr > th:first-child,
  [data-theme="dark"] .ant-table .ant-table-tbody > tr > td:first-child {
    background-color: #2a2a2a !important;
  }
  
  [data-theme="dark"] .ant-table .ant-table-thead > tr > th:last-child,
  [data-theme="dark"] .ant-table .ant-table-tbody > tr > td:last-child {
    background-color: #2a2a2a !important;
  }
  
  /* 深色模式下的表格悬停效果 */
  [data-theme="dark"] .ant-table .ant-table-tbody > tr:hover > td:first-child,
  [data-theme="dark"] .ant-table .ant-table-tbody > tr:hover > td:last-child {
    background-color: #404040 !important;
  }
  
  /* 响应式分页 */
  @media (max-width: 768px) {
    .task-pagination {
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }
    
    .task-pagination .ant-pagination {
      flex-direction: column;
      gap: 8px;
    }
    
    .task-pagination .ant-pagination-options {
      margin-left: 0;
      margin-top: 0;
    }
  }
`

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = taskPaginationStyles
  document.head.appendChild(styleElement)
} 