import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Typography, Space, Button, message, Spin } from 'antd'
import { 
  PictureOutlined, 
  UploadOutlined, 
  HistoryOutlined,
  DeleteOutlined,
  CopyOutlined
} from '@ant-design/icons'
import ImageUpload from '../components/ImageUpload/ImageUpload'
import ImagePreview from '../components/ImageUpload/ImagePreview'
import ImageHistory from '../components/ImageUpload/ImageHistory'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const { Title, Text } = Typography

const ImageTools = () => {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [uploadedImages, setUploadedImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedImages, setSelectedImages] = useState([])
  const [activeTab, setActiveTab] = useState('upload')

  // 获取用户上传的图片列表
  const fetchImages = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('image_uploads')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setUploadedImages(data || [])
    } catch (error) {
      console.error('获取图片列表失败:', error)
      message.error('获取图片列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除图片
  const handleDeleteImage = async (imageId) => {
    try {
      const { error } = await supabase
        .from('image_uploads')
        .update({ is_active: false })
        .eq('id', imageId)

      if (error) throw error

      message.success('图片删除成功')
      fetchImages() // 重新获取列表
    } catch (error) {
      console.error('删除图片失败:', error)
      message.error('删除图片失败')
    }
  }

  // 上传成功回调
  const handleUploadSuccess = (newImages) => {
    message.success(`成功上传 ${newImages.length} 张图片`)
    fetchImages() // 重新获取列表
  }

  // 复制链接
  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
  }

  useEffect(() => {
    fetchImages()
  }, [user])

  return (
    <div style={{ 
      padding: '24px 24px 32px', 
      background: theme === 'dark' ? '#141414' : '#f5f7fb', 
      minHeight: '100%' 
    }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>
          <PictureOutlined style={{ marginRight: '8px', color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
          图片转URL
        </Title>
        <Text type="secondary" style={{ color: theme === 'dark' ? '#bfbfbf' : '#666666' }}>
          上传图片并获取可访问的URL链接，支持多种格式输出
        </Text>
      </div>

      {/* 功能区域 */}
      <Row gutter={[16, 6]}>
        {/* 上传区域 */}
        <Col xs={24} lg={24}>
          <Card 
            title={
              <Space style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>
                <UploadOutlined style={{ color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
                图片上传
              </Space>
            }
            style={{ 
              height: '100%', 
              borderRadius: 12,
              background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #d9d9d9'
            }}
            bodyStyle={{ padding: 12 }}
          >
            <ImageUpload 
              onUploadSuccess={handleUploadSuccess}
              userId={user?.id}
            />
          </Card>
        </Col>

        {/* 历史图库 */}
        <Col xs={24}>
          <Card 
            title={
              <Space style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>
                <PictureOutlined style={{ color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
                历史图库
                <Text type="secondary" style={{ color: theme === 'dark' ? '#bfbfbf' : '#666666' }}>({uploadedImages.length} 张)</Text>
              </Space>
            }
            extra={
              <Button icon={<HistoryOutlined />} onClick={fetchImages}>刷新</Button>
            }
            style={{ 
              borderRadius: 12, 
              marginTop: 2,
              background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
              border: theme === 'dark' ? '1px solid #333333' : '1px solid #d9d9d9'
            }}
            bodyStyle={{ padding: 6 }}
          >
            <Spin spinning={loading}>
              <ImagePreview 
                images={uploadedImages}
                selectedImages={selectedImages}
                onSelectImages={setSelectedImages}
                onDeleteImage={handleDeleteImage}
                onCopyLink={handleCopyLink}
                onRefresh={fetchImages}
              />
            </Spin>
          </Card>
        </Col>

        {/* 历史记录 */}
        {activeTab === 'history' && (
          <Col xs={24}>
            <Card 
              title={
                <Space>
                  <HistoryOutlined />
                  上传历史
                </Space>
              }
              extra={
                <Button onClick={() => setActiveTab('upload')}>
                  返回上传
                </Button>
              }
            >
              <ImageHistory 
                images={uploadedImages}
                onDeleteImage={handleDeleteImage}
                onCopyLink={handleCopyLink}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  )
}

export default ImageTools
