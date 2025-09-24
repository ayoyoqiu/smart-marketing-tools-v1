import React, { useState } from 'react'
import { 
  Table, 
  Button, 
  Space, 
  Typography, 
  Tag, 
  Tooltip,
  Modal,
  Input,
  message
} from 'antd'
import { 
  CopyOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  SearchOutlined,
  DownloadOutlined
} from '@ant-design/icons'

const { Text } = Typography
const { Search } = Input

const ImageHistory = ({ images, onDeleteImage, onCopyLink }) => {
  const [searchText, setSearchText] = useState('')
  const [filteredImages, setFilteredImages] = useState(images)

  // 搜索过滤
  const handleSearch = (value) => {
    setSearchText(value)
    if (!value) {
      setFilteredImages(images)
    } else {
      const filtered = images.filter(img => 
        img.original_name.toLowerCase().includes(value.toLowerCase()) ||
        img.mime_type.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredImages(filtered)
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化日期
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  // 获取文件类型标签颜色
  const getFileTypeColor = (mimeType) => {
    const typeMap = {
      'image/jpeg': 'blue',
      'image/png': 'green',
      'image/gif': 'orange',
      'image/webp': 'purple',
      'image/bmp': 'red'
    }
    return typeMap[mimeType] || 'default'
  }

  // 下载图片
  const handleDownload = (image) => {
    const link = document.createElement('a')
    link.href = image.public_url
    link.download = image.original_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 预览图片
  const handlePreview = (image) => {
    Modal.info({
      title: image.original_name,
      content: (
        <div style={{ textAlign: 'center' }}>
          <img 
            src={image.public_url} 
            alt={image.original_name}
            style={{ maxWidth: '100%', maxHeight: '500px' }}
          />
        </div>
      ),
      width: '80%',
      style: { top: 20 }
    })
  }

  const columns = [
    {
      title: '缩略图',
      dataIndex: 'public_url',
      key: 'thumbnail',
      width: 80,
      render: (url, record) => (
        <img 
          src={url} 
          alt={record.original_name}
          style={{ 
            width: '50px', 
            height: '50px', 
            objectFit: 'cover',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => handlePreview(record)}
        />
      )
    },
    {
      title: '文件名',
      dataIndex: 'original_name',
      key: 'filename',
      ellipsis: true,
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.filename}
          </Text>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'mime_type',
      key: 'type',
      width: 100,
      render: (type) => (
        <Tag color={getFileTypeColor(type)}>
          {type.split('/')[1].toUpperCase()}
        </Tag>
      )
    },
    {
      title: '尺寸',
      key: 'dimensions',
      width: 100,
      render: (_, record) => (
        <Text style={{ fontSize: '12px' }}>
          {record.width} × {record.height}
        </Text>
      )
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'size',
      width: 100,
      render: (size) => (
        <Text style={{ fontSize: '12px' }}>
          {formatFileSize(size)}
        </Text>
      )
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date) => (
        <Text style={{ fontSize: '12px' }}>
          {formatDate(date)}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="复制链接">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onCopyLink(record.public_url)}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除图片 "${record.original_name}" 吗？`,
                  onOk: () => onDeleteImage(record.id)
                })
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ]

  return (
    <div>
      {/* 搜索栏 */}
      <div style={{ marginBottom: '16px' }}>
        <Search
          placeholder="搜索文件名或类型..."
          allowClear
          enterButton={<SearchOutlined />}
          size="middle"
          onSearch={handleSearch}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* 统计信息 */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px',
        background: '#f5f5f5',
        borderRadius: '6px'
      }}>
        <Space>
          <Text strong>总计：</Text>
          <Text>{filteredImages.length} 张图片</Text>
          <Text type="secondary">|</Text>
          <Text strong>总大小：</Text>
          <Text>
            {formatFileSize(
              filteredImages.reduce((total, img) => total + img.file_size, 0)
            )}
          </Text>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredImages}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
        }}
        scroll={{ x: 800 }}
        size="small"
      />
    </div>
  )
}

export default ImageHistory
