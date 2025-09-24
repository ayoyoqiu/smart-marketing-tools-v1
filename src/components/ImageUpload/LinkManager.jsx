import React, { useState } from 'react'
import { 
  Card, 
  Input, 
  Button, 
  Space, 
  Typography, 
  Tabs, 
  message,
  Tooltip,
  Divider
} from 'antd'
import { 
  CopyOutlined, 
  LinkOutlined, 
  CodeOutlined,
  FileTextOutlined,
  CheckOutlined
} from '@ant-design/icons'

const { TextArea } = Input
const { Text, Paragraph } = Typography
const { TabPane } = Tabs

const LinkManager = ({ images, onCopyLink }) => {
  const [selectedImage, setSelectedImage] = useState(null)
  const [copiedItems, setCopiedItems] = useState(new Set())

  // 生成不同格式的链接
  const generateLinks = (image) => {
    if (!image) return { direct: '', html: '', markdown: '' }

    const url = image.public_url
    const alt = image.original_name
    const title = image.original_name

    return {
      direct: url,
      html: `<img src="${url}" alt="${alt}" title="${title}" />`,
      markdown: `![${alt}](${url})`,
      htmlWithLink: `<a href="${url}" target="_blank"><img src="${url}" alt="${alt}" title="${title}" /></a>`,
      markdownWithLink: `[![${alt}](${url})](${url})`
    }
  }

  // 复制到剪贴板
  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${type} 已复制到剪贴板`)
      setCopiedItems(prev => new Set([...prev, type]))
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(type)
          return newSet
        })
      }, 2000)
    }).catch(() => {
      message.error('复制失败，请手动复制')
    })
  }

  // 批量生成链接
  const generateBatchLinks = (format) => {
    if (images.length === 0) return ''

    switch (format) {
      case 'direct':
        return images.map(img => img.public_url).join('\n')
      case 'html':
        return images.map(img => 
          `<img src="${img.public_url}" alt="${img.original_name}" title="${img.original_name}" />`
        ).join('\n')
      case 'markdown':
        return images.map(img => 
          `![${img.original_name}](${img.public_url})`
        ).join('\n')
      default:
        return ''
    }
  }

  const links = selectedImage ? generateLinks(selectedImage) : null
  const batchLinks = {
    direct: generateBatchLinks('direct'),
    html: generateBatchLinks('html'),
    markdown: generateBatchLinks('markdown')
  }

  // 自动选中最新上传的图片
  React.useEffect(() => {
    if (!selectedImage && images && images.length > 0) {
      setSelectedImage(images[0])
    }
  }, [images])

  return (
    <div>
      {/* 当前选择 */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text strong>当前选择：</Text>
        {selectedImage ? (
          <span style={{
            background: '#f0f5ff', color: '#2f54eb', padding: '2px 8px', borderRadius: 12,
            maxWidth: 260, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'
          }} title={selectedImage.original_name}>
            {selectedImage.original_name}
          </span>
        ) : (
          <Text type="secondary">未选择图片（支持批量模式）</Text>
        )}
      </div>

      {/* 快速选择（最近 5 张） */}
      {images.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ marginRight: 8 }}>快速选择：</Text>
          <Space wrap>
            {images.slice(0, 6).map(img => (
              <Button key={img.id} size="small"
                type={selectedImage?.id === img.id ? 'primary' : 'default'}
                onClick={() => setSelectedImage(img)}>
                {img.original_name.length > 10 ? img.original_name.slice(0,10)+'…' : img.original_name}
              </Button>
            ))}
          </Space>
        </div>
      )}

      <Divider />

      {/* 链接格式选择 */}
      <Tabs defaultActiveKey="direct">
        <TabPane 
          tab={
            <span>
              <LinkOutlined />
              直链
            </span>
          } 
          key="direct"
        >
          <div>
            <Text strong>直接链接：</Text>
            <TextArea
              value={selectedImage ? links.direct : batchLinks.direct}
              rows={4}
              readOnly
              style={{ marginTop: '8px' }}
            />
            <div style={{ marginTop: '8px' }}>
              <Button
                type="primary"
                icon={copiedItems.has('direct') ? <CheckOutlined /> : <CopyOutlined />}
                onClick={() => handleCopy(
                  selectedImage ? links.direct : batchLinks.direct, 
                  '直链'
                )}
              >
                {copiedItems.has('direct') ? '已复制' : '复制直链'}
              </Button>
            </div>
          </div>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <CodeOutlined />
              HTML
            </span>
          } 
          key="html"
        >
          <div>
            <Text strong>HTML 标签：</Text>
            <TextArea
              value={selectedImage ? links.html : batchLinks.html}
              rows={4}
              readOnly
              style={{ marginTop: '8px' }}
            />
            <div style={{ marginTop: '8px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={copiedItems.has('html') ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={() => handleCopy(
                    selectedImage ? links.html : batchLinks.html, 
                    'HTML标签'
                  )}
                >
                  {copiedItems.has('html') ? '已复制' : '复制HTML'}
                </Button>
                {selectedImage && (
                  <Button
                    icon={copiedItems.has('htmlWithLink') ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={() => handleCopy(links.htmlWithLink, 'HTML带链接')}
                  >
                    {copiedItems.has('htmlWithLink') ? '已复制' : '带链接HTML'}
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <FileTextOutlined />
              Markdown
            </span>
          } 
          key="markdown"
        >
          <div>
            <Text strong>Markdown 格式：</Text>
            <TextArea
              value={selectedImage ? links.markdown : batchLinks.markdown}
              rows={4}
              readOnly
              style={{ marginTop: '8px' }}
            />
            <div style={{ marginTop: '8px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={copiedItems.has('markdown') ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={() => handleCopy(
                    selectedImage ? links.markdown : batchLinks.markdown, 
                    'Markdown'
                  )}
                >
                  {copiedItems.has('markdown') ? '已复制' : '复制Markdown'}
                </Button>
                {selectedImage && (
                  <Button
                    icon={copiedItems.has('markdownWithLink') ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={() => handleCopy(links.markdownWithLink, 'Markdown带链接')}
                  >
                    {copiedItems.has('markdownWithLink') ? '已复制' : '带链接Markdown'}
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </TabPane>
      </Tabs>

      {/* 使用说明 */}
      <Card size="small" style={{ marginTop: '16px' }}>
        <Text type="secondary">
          <strong>使用说明：</strong><br />
          • <strong>直链</strong>：直接可访问的图片URL，适合在网页中直接使用<br />
          • <strong>HTML</strong>：HTML img标签，可直接插入到网页中<br />
          • <strong>Markdown</strong>：Markdown格式，适合在文档中使用<br />
          • 支持单张图片和批量操作
        </Text>
      </Card>
    </div>
  )
}

export default LinkManager
