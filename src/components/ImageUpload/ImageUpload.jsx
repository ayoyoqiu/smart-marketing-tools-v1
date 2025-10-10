import React, { useState, useCallback } from 'react'
import { 
  Upload, 
  Button, 
  Progress, 
  message, 
  Space, 
  Typography,
  Card,
  Row,
  Col
} from 'antd'
import { 
  InboxOutlined, 
  UploadOutlined, 
  PictureOutlined 
} from '@ant-design/icons'
import { supabase } from '../../../supabaseClient'
import { useTheme } from '../../contexts/ThemeContext'

const { Dragger } = Upload
const { Text } = Typography

const ImageUpload = ({ onUploadSuccess, userId }) => {
  const { theme } = useTheme()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState([])

  // 文件上传处理 - 优先使用后端API
  const handleUpload = useCallback(async (file) => {
    if (!userId) {
      message.error('请先登录')
      return false
    }

    // 文件类型验证
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
    if (!allowedTypes.includes(file.type)) {
      message.error('只支持 JPG、PNG、GIF、WEBP、BMP 格式的图片')
      return false
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      // 使用后端API上传，绕过RLS限制
      const formData = new FormData()
      formData.append('image', file)
      formData.append('userId', userId)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '上传失败')
      }

      if (!result.success) {
        throw new Error(result.error || '上传失败')
      }

      setUploadProgress(100)
      message.success(`${file.name} 上传成功`)

      // 添加到已上传文件列表
      const newFile = {
        ...result.data,
        file: file
      }
      setUploadedFiles(prev => [newFile, ...prev])

      // 通知父组件刷新列表/生成链接
      try { onUploadSuccess && onUploadSuccess([result.data]) } catch (_) {}

      return false // 阻止默认上传行为
    } catch (error) {
      console.error('上传失败:', error)
      message.error(`上传失败: ${error.message}`)
      return false
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [userId])

  // 获取图片尺寸
  const getImageDimensions = (file) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }
      img.src = URL.createObjectURL(file)
    })
  }

  // 批量上传处理 - 使用后端API
  const handleBatchUpload = useCallback(async (fileList) => {
    if (!userId) {
      message.error('请先登录')
      return
    }

    const validFiles = fileList.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
      return allowedTypes.includes(file.type)
    })

    if (validFiles.length === 0) {
      message.error('没有有效的图片文件')
      return
    }

    setUploading(true)
    const uploadedImages = []

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        setUploadProgress(((i + 1) / validFiles.length) * 100)

        // 使用后端API上传
        const formData = new FormData()
        formData.append('image', file)
        formData.append('userId', userId)

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || '上传失败')
        }

        uploadedImages.push(result.data)
      }

      message.success(`成功上传 ${uploadedImages.length} 张图片`)
      onUploadSuccess?.(uploadedImages)
    } catch (error) {
      console.error('批量上传失败:', error)
      message.error(`批量上传失败: ${error.message}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [userId, onUploadSuccess])

  const uploadProps = {
    name: 'file',
    multiple: true,
    accept: 'image/*',
    beforeUpload: handleUpload,
    showUploadList: false,
    disabled: uploading
  }

  return (
    <div className="image-upload-root" style={{ width: '95%', margin: '0 auto' }}>
      {/* 拖拽上传区域 */}
      <Dragger {...uploadProps} className="image-upload-drag" style={{ marginBottom: '6px', padding: '12px 8px' }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: '28px', color: theme === 'dark' ? '#69b1ff' : '#1890ff' }} />
        </p>
        <p className="ant-upload-text" style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>
          点击或拖拽图片到此区域上传
        </p>
        <p className="ant-upload-hint" style={{ color: theme === 'dark' ? '#bfbfbf' : '#666666' }}>
          支持 JPG、PNG、GIF、WEBP、BMP 格式，单张图片无大小限制
        </p>
      </Dragger>

      {/* 上传进度 */}
      {uploading && (
        <div style={{ marginBottom: '6px' }}>
          <Progress 
            percent={uploadProgress} 
            status="active"
            format={percent => `上传中 ${percent}%`}
          />
        </div>
      )}

      {/* 上传按钮 */}
      <Space>
        <Button 
          type="primary" 
          icon={<UploadOutlined />}
          onClick={() => document.querySelector('input[type="file"]')?.click()}
          disabled={uploading}
        >
          选择文件
        </Button>
        <Text type="secondary">
          支持批量上传多张图片
        </Text>
      </Space>

      {/* 最近上传的文件 */}
      {uploadedFiles.length > 0 && (
        <Card 
          title="最近上传" 
          size="small" 
          style={{ marginTop: '16px' }}
        >
          <Row gutter={[8, 8]}>
            {uploadedFiles.slice(0, 4).map((file, index) => (
              <Col span={6} key={index}>
                <div style={{ textAlign: 'center' }}>
                  <PictureOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    {file.original_name}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  )
}

export default ImageUpload
