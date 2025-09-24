import React, { useState, useMemo } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Image, 
  Button, 
  Space, 
  Typography, 
  Modal, 
  message,
  Tag,
  Input,
  Select,
  Checkbox,
  Tooltip
} from 'antd'
import { supabase } from '../../../supabaseClient'
import { useTheme } from '../../contexts/ThemeContext'
import { 
  CopyOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  DownloadOutlined,
  LinkOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  EditOutlined,
  PictureOutlined
} from '@ant-design/icons'

const { Text } = Typography
const { Option } = Select

const ImagePreview = ({ 
  images, 
  selectedImages = [],
  onSelectImages,
  onDeleteImage, 
  onCopyLink,
  onRefresh
}) => {
  const { theme } = useTheme()
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewImage, setPreviewImage] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [editingName, setEditingName] = useState(null)
  const [editName, setEditName] = useState('')
  const [selectedLinkFormat, setSelectedLinkFormat] = useState({}) // 存储每个图片的选中格式

  // 筛选和排序状态
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [sortOrder, setSortOrder] = useState('desc')

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
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '/')
  }

  // 筛选和排序 - 增强搜索功能
  const filteredAndSortedImages = useMemo(() => {
    const bySearch = (img) => {
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      const name = (img.original_name || '').toLowerCase()
      const type = (img.mime_type || '').toLowerCase()
      const size = formatFileSize(img.file_size).toLowerCase()
      const dimensions = `${img.width}x${img.height}`.toLowerCase()
      const date = formatDate(img.created_at).toLowerCase()
      
      return name.includes(searchLower) || 
             type.includes(searchLower) || 
             size.includes(searchLower) ||
             dimensions.includes(searchLower) ||
             date.includes(searchLower)
    }
    const byType = (img) => filterType === 'all' || img.mime_type === filterType
    const list = (images || []).filter((img) => bySearch(img) && byType(img))
    list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortOrder === 'asc' ? ta - tb : tb - ta
    })
    return list
  }, [images, searchTerm, filterType, sortOrder])

  // 预览图片
  const handlePreview = (image) => {
    setPreviewImage(image.public_url)
    setPreviewTitle(image.original_name)
    setPreviewVisible(true)
  }

  // 复制链接
  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
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

  // 生成不同格式的链接
  const buildLinks = (img) => {
    const url = img.public_url
    const alt = img.original_name
    return {
      direct: url,
      html: `<img src="${url}" alt="${alt}" />`,
      markdown: `![${alt}](${url})`
    }
  }

  // 获取当前选中的链接格式
  const getCurrentLink = (image) => {
    const format = selectedLinkFormat[image.id] || 'direct'
    const links = buildLinks(image)
    return links[format]
  }

  // 切换链接格式
  const handleFormatChange = (imageId, format) => {
    setSelectedLinkFormat(prev => ({
      ...prev,
      [imageId]: format
    }))
  }


  // 选择图片
  const handleSelectImage = (imageId, checked) => {
    if (checked) {
      onSelectImages([...selectedImages, imageId])
    } else {
      onSelectImages(selectedImages.filter(id => id !== imageId))
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked) => {
    if (checked) {
      onSelectImages(filteredAndSortedImages.map(img => img.id))
    } else {
      onSelectImages([])
    }
  }

  // 批量复制
  const handleBatchCopy = () => {
    const urls = filteredAndSortedImages
      .filter(img => selectedImages.includes(img.id))
      .map(img => img.public_url)
      .join('\n')
    handleCopyLink(urls)
  }

  // 批量删除
  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedImages.length} 张图片吗？`,
      onOk: () => {
        selectedImages.forEach(id => onDeleteImage(id))
        onSelectImages([])
      }
    })
  }

  // 开始编辑名称
  const startEditName = (image) => {
    setEditingName(image.id)
    setEditName(image.original_name)
  }

  // 保存名称编辑
  const saveEditName = async (imageId) => {
    if (!editName.trim()) {
      message.error('名称不能为空')
      return
    }
    
    try {
      // 调用API更新图片名称
      const { error } = await supabase
        .from('image_uploads')
        .update({ original_name: editName.trim() })
        .eq('id', imageId)
      
      if (error) throw error
      
      message.success('名称修改成功')
      setEditingName(null)
      setEditName('')
      
      // 通知父组件刷新数据
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('更新图片名称失败:', error)
      message.error('名称修改失败')
    }
  }

  // 取消编辑
  const cancelEditName = () => {
    setEditingName(null)
    setEditName('')
  }

  if (images.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#999'
      }}>
        <Text type="secondary">暂无上传的图片</Text>
      </div>
    )
  }

  return (
    <div>
      {/* 筛选、排序和批量操作工具栏 - 紧凑单行布局 */}
      <div style={{ 
        background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa', 
        padding: '12px 16px', 
        borderRadius: '8px', 
        marginBottom: '16px' 
      }}>
        <Row gutter={[8, 8]} align="middle">
          {/* 筛选和排序控件 */}
          <Col xs={24} sm={16} lg={18}>
            <Space size={[8, 8]} wrap>
              <Text strong style={{ marginRight: 8, color: theme === 'dark' ? '#ffffff' : '#000000' }}>筛选和排序</Text>
                <Input
                  placeholder="搜索图片名称、类型、尺寸..."
                  prefix={<SearchOutlined />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  allowClear
                  style={{ width: 200 }}
                  size="small"
                />
              <Select 
                value={filterType} 
                style={{ width: 100 }} 
                onChange={setFilterType}
                size="small"
              >
                <Option value="all">全部类型</Option>
                <Option value="image/jpeg">JPEG</Option>
                <Option value="image/png">PNG</Option>
                <Option value="image/gif">GIF</Option>
                <Option value="image/webp">WEBP</Option>
                <Option value="image/bmp">BMP</Option>
              </Select>
              <Select 
                value={sortOrder} 
                style={{ width: 100 }} 
                onChange={setSortOrder}
                size="small"
              >
                <Option value="desc">上传时间</Option>
                <Option value="asc">上传时间</Option>
              </Select>
              <Button 
                size="small"
                icon={sortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              >
                {sortOrder === 'desc' ? '降序' : '升序'}
              </Button>
            </Space>
          </Col>
          
          {/* 批量操作控件 */}
          <Col xs={24} sm={8} lg={6}>
            <Space size="small" style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ marginRight: 8 }}>
                共{filteredAndSortedImages.length}张图片
              </Text>
              <Checkbox
                checked={selectedImages.length === filteredAndSortedImages.length && filteredAndSortedImages.length > 0}
                indeterminate={selectedImages.length > 0 && selectedImages.length < filteredAndSortedImages.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                size="small"
                style={{ whiteSpace: 'nowrap' }}
              >
                全选 ({selectedImages.length}/{filteredAndSortedImages.length})
              </Checkbox>
              <Button 
                size="small" 
                onClick={() => onSelectImages([])}
                disabled={selectedImages.length === 0}
              >
                清空
              </Button>
              <Button 
                size="small"
                icon={<CopyOutlined />}
                disabled={selectedImages.length === 0}
                onClick={handleBatchCopy}
              >
                批量复制
              </Button>
              <Button 
                size="small" 
                danger 
                icon={<DeleteOutlined />} 
                disabled={selectedImages.length === 0}
                onClick={handleBatchDelete}
              >
                批量删除
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 图片网格 - 响应式优化 */}
      <Row gutter={[12, 12]} wrap>
        {filteredAndSortedImages.map((image) => (
          <Col 
            xs={24} 
            sm={12} 
            md={8} 
            lg={6} 
            xl={4} 
            key={image.id} 
            style={{ 
              minWidth: 280,
              // 移动端优化
              '@media (max-width: 768px)': {
                minWidth: '100%'
              }
            }}
          >
              <Card
                hoverable
                style={{
                  borderRadius: 8,
                  boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  height: '480px', // 固定高度
                  display: 'flex',
                  flexDirection: 'column',
                  background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
                  border: theme === 'dark' ? '1px solid #333333' : '1px solid #d9d9d9'
                }}
                bodyStyle={{ 
                  padding: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
              {/* 卡片头部 - 文件名、类型、大小、操作图标 */}
              <div style={{ 
                padding: '12px 16px', 
                borderBottom: theme === 'dark' ? '1px solid #333333' : '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingName === image.id ? (
                    <Input
                      size="small"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onPressEnter={() => saveEditName(image.id)}
                      onBlur={() => saveEditName(image.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          cancelEditName()
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text 
                        strong 
                        ellipsis 
                        title={image.original_name} 
                        style={{ 
                          maxWidth: '60%',
                          fontSize: '14px',
                          cursor: 'pointer',
                          color: theme === 'dark' ? '#ffffff' : '#000000'
                        }}
                        onClick={() => startEditName(image)}
                      >
                        {image.original_name}
                      </Text>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => startEditName(image)}
                        style={{ padding: '2px 4px' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Tag color="default" style={{ margin: 0, fontSize: '12px' }}>
                      {(image.mime_type || '').split('/')[1]?.toUpperCase() || 'FILE'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666666' }}>
                      {formatFileSize(image.file_size)}
                    </Text>
                  </div>
                </div>
                
                {/* 操作图标 */}
                <Space size="small">
                  <Tooltip title="预览">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(image)}
                    />
                  </Tooltip>
                  <Tooltip title="分享">
                    <Button
                      type="text"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => handleCopyLink(buildLinks(image).direct)}
                    />
                  </Tooltip>
                  <Tooltip title="下载">
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(image)}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => onDeleteImage(image.id)}
                    />
                  </Tooltip>
                </Space>
              </div>

              {/* 图片预览区域 - 固定高度 */}
              <div
                style={{
                  position: 'relative',
                  height: '200px', // 固定高度
                  background: '#f0f2f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  flexShrink: 0 // 防止被压缩
                }}
                onClick={() => handlePreview(image)}
              >
                <Image
                  src={image.public_url}
                  alt={image.original_name}
                  style={{ 
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '6px'
                  }}
                  preview={false}
                />
                
                {/* 选择框 */}
                <Checkbox
                  checked={selectedImages.includes(image.id)}
                  onChange={(e) => handleSelectImage(image.id, e.target.checked)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: 1
                  }}
                />
              </div>

              {/* 图片信息区域 - 填充剩余空间 */}
              <div style={{
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1, // 填充剩余空间
                minHeight: 0 // 允许收缩
              }}>
                {/* 图片尺寸和时间信息 */}
                <div style={{ 
                  marginBottom: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <Text style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>
                    尺寸: {image.width} × {image.height}
                  </Text>
                  <Text style={{ fontSize: '12px', color: theme === 'dark' ? '#bfbfbf' : '#666' }}>
                    上传时间: {formatDate(image.created_at)}
                  </Text>
                </div>

                {/* 链接格式选择按钮 */}
                <div style={{ marginBottom: '12px' }}>
                  <Button.Group size="small" style={{ width: '100%' }}>
                    <Button
                      type={selectedLinkFormat[image.id] === 'direct' || !selectedLinkFormat[image.id] ? 'primary' : 'default'}
                      onClick={() => handleFormatChange(image.id, 'direct')}
                      style={{ flex: 1 }}
                    >
                      直链
                    </Button>
                    <Button
                      type={selectedLinkFormat[image.id] === 'html' ? 'primary' : 'default'}
                      onClick={() => handleFormatChange(image.id, 'html')}
                      style={{ flex: 1 }}
                    >
                      HTML
                    </Button>
                    <Button
                      type={selectedLinkFormat[image.id] === 'markdown' ? 'primary' : 'default'}
                      onClick={() => handleFormatChange(image.id, 'markdown')}
                      style={{ flex: 1 }}
                    >
                      Markdown
                    </Button>
                  </Button.Group>
                </div>

                {/* 链接输入框和复制按钮 */}
                <div style={{ 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'stretch', // 确保子元素拉伸到相同高度
                  gap: '0'
                }}>
                  <Input
                    size="small"
                    value={getCurrentLink(image)}
                    readOnly
                    style={{
                      flex: 1,
                      fontSize: '11px',
                      height: '32px', // 统一高度
                      borderRadius: '4px 0 0 4px',
                      borderRight: 'none' // 移除右边框
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopyLink(getCurrentLink(image))}
                      style={{ 
                        width: '40px',
                        height: '32px', // 与输入框相同高度
                        borderRadius: '0 4px 4px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: '-1px', // 消除间隙
                        transition: 'all 0.2s ease',
                        borderLeft: 'none' // 移除左边框
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#1890ff'
                        e.currentTarget.style.color = 'white'
                        e.currentTarget.style.transform = 'scale(1.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ''
                        e.currentTarget.style.color = ''
                        e.currentTarget.style.transform = 'scale(1)'
                      }}
                    />
                </div>

                {/* 链接有效性标签 - 固定在底部 */}
                <div style={{ 
                  marginTop: 'auto',
                  flexShrink: 0 // 防止被压缩
                }}>
                  <Tag
                    color="green"
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: '11px',
                      padding: '6px 8px',
                      margin: 0,
                      lineHeight: '1.2'
                    }}
                  >
                    ✓ 此链接永久有效,无需登录即可公开访问
                  </Tag>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图片预览模态框 - 舒适友好的设计 */}
      <Modal
        open={previewVisible}
        title={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '16px',
            fontWeight: '500',
            color: theme === 'dark' ? '#ffffff' : '#000000'
          }}>
            <PictureOutlined style={{ color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
            {previewTitle}
          </div>
        }
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width="60%"
        style={{ 
          top: '5%',
          maxHeight: '90vh'
        }}
        bodyStyle={{
          padding: '20px',
          textAlign: 'center',
          background: theme === 'dark' ? '#1a1a1a' : '#fafafa',
          borderRadius: '8px'
        }}
        centered
        destroyOnClose
      >
        <div style={{ 
          background: theme === 'dark' ? '#2a2a2a' : 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: theme === 'dark' ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
          maxHeight: '70vh',
          overflow: 'hidden'
        }}>
          {/* 图片显示区域 */}
          <div style={{
            marginBottom: '16px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
            border: theme === 'dark' ? '1px solid #333333' : '1px solid #e9ecef'
          }}>
            <Image
              alt={previewTitle}
              src={previewImage}
              style={{ 
                maxWidth: '100%',
                maxHeight: '50vh',
                objectFit: 'contain',
                display: 'block'
              }}
              preview={false}
            />
          </div>
          
          {/* 图片信息 */}
          <div style={{
            textAlign: 'left',
            background: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            color: theme === 'dark' ? '#bfbfbf' : '#666'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <Text strong style={{ color: theme === 'dark' ? '#ffffff' : '#333' }}>文件名: </Text>
              <Text style={{ color: theme === 'dark' ? '#bfbfbf' : '#666' }}>{previewTitle}</Text>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <Text strong style={{ color: theme === 'dark' ? '#ffffff' : '#333' }}>尺寸: </Text>
              <Text style={{ color: theme === 'dark' ? '#bfbfbf' : '#666' }}>{filteredAndSortedImages.find(img => img.public_url === previewImage)?.width} × {filteredAndSortedImages.find(img => img.public_url === previewImage)?.height}</Text>
            </div>
            <div>
              <Text strong style={{ color: theme === 'dark' ? '#ffffff' : '#333' }}>上传时间: </Text>
              <Text style={{ color: theme === 'dark' ? '#bfbfbf' : '#666' }}>{formatDate(filteredAndSortedImages.find(img => img.public_url === previewImage)?.created_at || '')}</Text>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'center',
            gap: '12px'
          }}>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => handleCopyLink(previewImage)}
              />
            <Button 
              icon={<DownloadOutlined />}
              onClick={() => {
                const image = filteredAndSortedImages.find(img => img.public_url === previewImage)
                if (image) handleDownload(image)
              }}
            >
              下载图片
            </Button>
            <Button 
              icon={<EyeOutlined />}
              onClick={() => {
                const image = filteredAndSortedImages.find(img => img.public_url === previewImage)
                if (image) {
                  window.open(image.public_url, '_blank')
                }
              }}
            >
              在新窗口打开
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ImagePreview