import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Button,
  Card,
  Input,
  List,
  Avatar,
  Typography,
  Space,
  message,
  Spin,
  Tooltip,
  Badge
} from 'antd'
import {
  MessageOutlined,
  SendOutlined,
  CloseOutlined,
  RobotOutlined,
  UserOutlined,
  ClearOutlined
} from '@ant-design/icons'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import './AIChatBot.css'

const { TextArea } = Input
const { Text, Paragraph } = Typography

const AIChatBot = () => {
  const { user } = useAuth()
  const { theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const [position, setPosition] = useState(() => {
    // 从localStorage读取保存的位置，如果没有则使用默认位置
    const savedPosition = localStorage.getItem('ai-chatbot-position')
    if (savedPosition) {
      try {
        return JSON.parse(savedPosition)
      } catch (e) {
        console.warn('Failed to parse saved position:', e)
      }
    }
    // 默认位置在右下角
    if (typeof window !== 'undefined') {
      const defaultX = window.innerWidth - 56 - 20 // 56px按钮宽度 + 20px边距
      const defaultY = window.innerHeight - 56 - 20 // 56px按钮高度 + 20px边距
      return { x: defaultX, y: defaultY }
    }
    return { x: 20, y: 20 } // 服务端渲染时的回退值
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const buttonRef = useRef(null)

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // 拖拽事件处理
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return // 只处理左键
    
    setIsDragging(true)
    const rect = buttonRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return
    
    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y
    
    // 限制在视窗范围内
    const maxX = window.innerWidth - 56 // 按钮宽度
    const maxY = window.innerHeight - 56 // 按钮高度
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }, [isDragging, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    // 保存位置到localStorage
    localStorage.setItem('ai-chatbot-position', JSON.stringify(position))
  }, [position])

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // 窗口大小变化时调整位置
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - 56
      const maxY = window.innerHeight - 56
      
      setPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY))
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // 调用AI API
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          sessionId,
          userId: user?.id
        })
      })

      if (!response.ok) {
        throw new Error('AI服务暂时不可用')
      }

      const data = await response.json()
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.answer,
        timestamp: new Date(),
        context: data.context
      }

      setMessages(prev => [...prev, aiMessage])

    } catch (error) {
      console.error('发送消息失败:', error)
      message.error('发送失败，请稍后重试')
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: '抱歉，我现在无法回答您的问题。请稍后重试或联系管理员。',
        timestamp: new Date(),
        isError: true
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // 清空对话
  const handleClearChat = () => {
    setMessages([])
    message.success('对话已清空')
  }

  // 处理键盘事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 渲染消息
  const renderMessage = (msg) => {
    const isUser = msg.type === 'user'
    
    return (
      <div key={msg.id} className={`message-item ${isUser ? 'user-message' : 'ai-message'}`}>
        <div className="message-content">
          <div className="message-avatar">
            {isUser ? (
              <Avatar 
                icon={<UserOutlined />}
                style={{ 
                  backgroundColor: '#1890ff',
                  color: 'white'
                }}
              />
            ) : (
              <Avatar 
                style={{ 
                  backgroundColor: '#52c41a',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img 
                  src="/images/ai-robot-icon.png" 
                  alt="AI助手" 
                  className="ai-robot-icon"
                  style={{
                    width: 20,
                    height: 20,
                    objectFit: 'contain'
                  }}
                />
              </Avatar>
            )}
          </div>
          <div className="message-text">
            <div 
              className="message-bubble"
              style={{
                backgroundColor: isUser 
                  ? '#1890ff' 
                  : theme === 'dark' ? '#262626' : '#fff',
                color: isUser 
                  ? '#fff' 
                  : theme === 'dark' ? '#fff' : '#333',
                border: isUser 
                  ? 'none' 
                  : theme === 'dark' ? '1px solid #434343' : '1px solid #f0f0f0'
              }}
            >
              <Paragraph 
                style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap',
                  color: msg.isError 
                    ? '#ff4d4f' 
                    : isUser 
                      ? '#fff' 
                      : theme === 'dark' ? '#fff' : '#333'
                }}
              >
                {msg.content}
              </Paragraph>

            </div>
            <div className="message-time">
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {msg.timestamp.toLocaleTimeString()}
              </Text>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 悬浮按钮 */}
      <div 
        className="floating-chat-button"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 1001,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        ref={buttonRef}
        onMouseDown={handleMouseDown}
      >
        <Tooltip title="AI助手（可拖动）" placement="left">
          <Badge 
            count={messages.length > 0 ? messages.length : 0} 
            size="small"
            style={{ backgroundColor: '#52c41a' }}
          >
            <Button
              type="primary"
              shape="circle"
              size="large"
              onClick={(e) => {
                // 如果正在拖拽，不触发点击事件
                if (isDragging) {
                  e.preventDefault()
                  return
                }
                setIsOpen(!isOpen)
              }}
              style={{
                width: 56,
                height: 56,
                boxShadow: isDragging 
                  ? '0 8px 24px rgba(0, 0, 0, 0.25)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: 'none',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme === 'dark' 
                  ? 'rgba(42, 42, 42, 0.8)' 
                  : 'rgba(24, 144, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                transition: isDragging ? 'none' : 'all 0.3s ease',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                borderRadius: '50% !important' // 强制圆形
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}>
                <img 
                  src="/images/ai-robot-icon.png" 
                  alt="AI助手" 
                  className="ai-robot-icon"
                  style={{
                    width: 24,
                    height: 24,
                    objectFit: 'contain',
                    pointerEvents: 'none',
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) brightness(1.2) contrast(1.1)'
                  }}
                />
              </div>
            </Button>
          </Badge>
        </Tooltip>
      </div>

      {/* 聊天窗口 */}
      {isOpen && (
        <div 
          className="chat-window"
          style={{
            position: 'fixed',
            left: `${Math.max(0, position.x - 400)}px`, // 聊天窗口在按钮左侧
            top: `${Math.max(0, position.y - 600)}px`, // 聊天窗口在按钮上方
            zIndex: 1000
          }}
        >
          <Card
            title={
              <div className="chat-header">
                <Space>
                  <img 
                    src="/images/ai-robot-icon.png" 
                    alt="AI助手" 
                    className="ai-robot-icon"
                    style={{
                      width: 20,
                      height: 20,
                      objectFit: 'contain'
                    }}
                  />
                  <Text strong>AI助手</Text>
                </Space>
                <Space>
                  <Tooltip title="清空对话">
                    <Button 
                      type="text" 
                      icon={<ClearOutlined />} 
                      onClick={handleClearChat}
                      size="small"
                    />
                  </Tooltip>
                  <Tooltip title="关闭">
                    <Button 
                      type="text" 
                      icon={<CloseOutlined />} 
                      onClick={() => setIsOpen(false)}
                      size="small"
                    />
                  </Tooltip>
                </Space>
              </div>
            }
            style={{
              width: 400,
              height: 600,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              backgroundColor: theme === 'dark' ? '#1f1f1f' : '#fff',
              border: theme === 'dark' ? '1px solid #303030' : 'none'
            }}
            bodyStyle={{ 
              padding: 0, 
              height: 'calc(100% - 57px)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* 消息列表 */}
            <div 
              className="messages-container"
              style={{
                backgroundColor: theme === 'dark' ? '#141414' : '#fafafa'
              }}
            >
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <img 
                    src="/images/ai-robot-icon.png" 
                    alt="AI助手" 
                    className="ai-robot-icon"
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: 'contain',
                      opacity: theme === 'dark' ? 0.3 : 0.5,
                      marginBottom: 16
                    }}
                  />
                  <Text 
                    type="secondary"
                    style={{ color: theme === 'dark' ? '#8c8c8c' : undefined }}
                  >
                    您好！我是AI助手，可以帮您解答网站功能相关问题。
                  </Text>
                  <div className="quick-questions">
                    <Text 
                      strong 
                      style={{ 
                        marginBottom: 8, 
                        display: 'block',
                        color: theme === 'dark' ? '#fff' : undefined
                      }}
                    >
                      常见问题：
                    </Text>
                    <div className="question-tags">
                      {['如何创建任务', '如何管理地址', '如何设置分组'].map((q, index) => (
                        <Button
                          key={index}
                          size="small"
                          type="dashed"
                          onClick={() => setInputValue(q)}
                          style={{ margin: '2px', fontSize: '12px' }}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map(renderMessage)}
                  {isLoading && (
                    <div className="message-item ai-message">
                      <div className="message-content">
                        <div className="message-avatar">
                          <Avatar 
                            style={{ 
                              backgroundColor: '#52c41a',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <img 
                              src="/images/ai-robot-icon.png" 
                              alt="AI助手" 
                              className="ai-robot-icon"
                              style={{
                                width: 20,
                                height: 20,
                                objectFit: 'contain'
                              }}
                            />
                          </Avatar>
                        </div>
                        <div className="message-text">
                          <div 
                            className="message-bubble"
                            style={{
                              backgroundColor: theme === 'dark' ? '#262626' : '#fff',
                              color: theme === 'dark' ? '#fff' : '#333',
                              border: theme === 'dark' ? '1px solid #434343' : '1px solid #f0f0f0'
                            }}
                          >
                            <Spin size="small" />
                            <Text 
                              type="secondary" 
                              style={{ 
                                marginLeft: 8,
                                color: theme === 'dark' ? '#8c8c8c' : undefined
                              }}
                            >
                              AI正在思考...
                            </Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 输入区域 */}
            <div 
              className="input-container"
              style={{
                backgroundColor: theme === 'dark' ? '#1f1f1f' : '#fff',
                borderTop: theme === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0'
              }}
            >
              <div 
                className="input-wrapper"
                style={{
                  backgroundColor: theme === 'dark' ? '#262626' : '#fafafa',
                  border: theme === 'dark' ? '1px solid #434343' : '1px solid #d9d9d9'
                }}
              >
                <TextArea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入您的问题..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ 
                    resize: 'none',
                    border: 'none',
                    boxShadow: 'none',
                    padding: '8px 12px',
                    background: 'transparent',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={isLoading}
                  disabled={!inputValue.trim()}
                  style={{
                    border: 'none',
                    boxShadow: 'none',
                    marginLeft: 8
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

export default AIChatBot
