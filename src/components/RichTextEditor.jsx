import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Tabs, Input, Space, Button, message, Tooltip, Divider, Popover, ColorPicker } from 'antd';
import { 
  EditOutlined, 
  EyeOutlined, 
  CopyOutlined, 
  DownloadOutlined,
  UploadOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  CodeOutlined,
  TableOutlined,
  FontColorsOutlined,
  SmileOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

const { TextArea } = Input;
const { TabPane } = Tabs;

const RichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '请输入Markdown内容...',
  height = '400px',
  showToolbar = true,
  showPreview = true,
  showActions = true
}) => {
  const [activeTab, setActiveTab] = useState('edit');
  const [markdownContent, setMarkdownContent] = useState(value);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const textareaRef = useRef(null);

  // 确保组件始终使用外部传入的value
  useEffect(() => {
    if (value !== markdownContent) {
      setMarkdownContent(value);
    }
  }, [value]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setMarkdownContent(newContent);
    // 确保onChange被调用，这对于Form.Item很重要
    if (onChange) {
      onChange(newContent);
    }
  };

  // 安全的 textarea 引用获取
  const getTextarea = useCallback(() => {
    if (!textareaRef.current) {
      console.warn('Textarea ref not ready');
      return null;
    }
    return textareaRef.current;
  }, []);

  // 文字颜色选择器
  const insertColoredText = useCallback((color) => {
    const textarea = getTextarea();
    if (!textarea) {
      message.warning('编辑器未准备好，请稍后再试');
      return;
    }

    try {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const text = textarea.value || '';
      const before = text.substring(0, start);
      const selection = text.substring(start, end);
      const after = text.substring(end);

      // 使用HTML标签实现颜色（企业微信支持）
      const coloredText = `<font color="${color}">${selection || '彩色文本'}</font>`;
      
      const newText = before + coloredText + after;
      
      // 计算新的光标位置
      const newCursorPos = start + coloredText.length;
      
      // 先设置光标位置，再更新状态
      if (textarea && textarea.setSelectionRange) {
        try {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        } catch (error) {
          console.warn('设置光标位置失败:', error);
        }
      }
      
      // 更新状态
      setMarkdownContent(newText);
      if (onChange) {
        onChange(newText);
      }
      
      // 确保焦点和光标位置
      if (textarea && textarea.focus) {
        textarea.focus();
        // 再次确认光标位置
        setTimeout(() => {
          if (textarea && textarea.setSelectionRange) {
            try {
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            } catch (error) {
              console.warn('延迟设置光标位置失败:', error);
            }
          }
        }, 10);
      }
    } catch (error) {
      console.error('插入颜色文本失败:', error);
      message.error('操作失败，请重试');
    }
  }, [getTextarea, onChange]);

  // 表情包插入功能
  const insertEmoji = useCallback((emoji) => {
    const textarea = getTextarea();
    if (!textarea) {
      message.warning('编辑器未准备好，请稍后再试');
      return;
    }

    try {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const text = textarea.value || '';
      const before = text.substring(0, start);
      const after = text.substring(end);

      const newText = before + emoji + after;
      
      // 计算新的光标位置
      const newCursorPos = start + emoji.length;
      
      // 先设置光标位置，再更新状态
      if (textarea && textarea.setSelectionRange) {
        try {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        } catch (error) {
          console.warn('设置光标位置失败:', error);
        }
      }
      
      // 更新状态
      setMarkdownContent(newText);
      if (onChange) {
        onChange(newText);
      }
      
      // 确保焦点和光标位置
      if (textarea && textarea.focus) {
        textarea.focus();
        // 再次确认光标位置
        setTimeout(() => {
          if (textarea && textarea.setSelectionRange) {
            try {
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            } catch (error) {
              console.warn('延迟设置光标位置失败:', error);
            }
          }
        }, 10);
      }
    } catch (error) {
      console.error('插入表情失败:', error);
      message.error('操作失败，请重试');
    }
  }, [getTextarea, onChange]);

  // Markdown快捷插入功能
  const insertMarkdown = useCallback((type, defaultValue = '') => {
    const textarea = getTextarea();
    if (!textarea) {
      message.warning('编辑器未准备好，请稍后再试');
      return;
    }

    try {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const text = textarea.value || '';
      const before = text.substring(0, start);
      const selection = text.substring(start, end);
      const after = text.substring(end);

      let insertText = '';
      let cursorOffset = 0;
      let hasSelection = selection.length > 0;

      switch (type) {
        case 'bold':
          if (hasSelection) {
            // 如果有选中文本，直接加粗
            insertText = `**${selection}**`;
            cursorOffset = 0; // 光标保持在末尾
          } else {
            // 如果没有选中文本，插入加粗标记和占位符
            insertText = `**粗体文本**`;
            cursorOffset = 2; // 光标放在 "粗体文本" 中间
          }
          break;
        case 'italic':
          if (hasSelection) {
            insertText = `*${selection}*`;
            cursorOffset = 0;
          } else {
            insertText = `*斜体文本*`;
            cursorOffset = 1;
          }
          break;
        case 'underline':
          if (hasSelection) {
            insertText = `__${selection}__`;
            cursorOffset = 0;
          } else {
            insertText = `__下划线文本__`;
            cursorOffset = 2;
          }
          break;
        case 'code':
          if (hasSelection) {
            insertText = `\`${selection}\``;
            cursorOffset = 0;
          } else {
            insertText = '`代码`';
            cursorOffset = 1;
          }
          break;
        case 'codeblock':
          if (hasSelection) {
            insertText = `\`\`\`\n${selection}\n\`\`\``;
            cursorOffset = 0;
          } else {
            insertText = `\`\`\`\n代码块\n\`\`\``;
            cursorOffset = 3;
          }
          break;
        case 'link':
          if (hasSelection) {
            insertText = `[${selection}](https://example.com)`;
            cursorOffset = 0;
          } else {
            insertText = `[链接文本](https://example.com)`;
            cursorOffset = 2;
          }
          break;
        case 'image':
          if (hasSelection) {
            insertText = `![${selection}](https://example.com/image.jpg)`;
            cursorOffset = 0;
          } else {
            insertText = `![图片描述](https://example.com/image.jpg)`;
            cursorOffset = 2;
          }
          break;
        case 'list':
          if (hasSelection) {
            // 如果有多行文本，每行都添加列表标记
            const lines = selection.split('\n');
            insertText = lines.map(line => `- ${line}`).join('\n');
            cursorOffset = 0;
          } else {
            insertText = `- 列表项`;
            cursorOffset = 2;
          }
          break;
        case 'orderedList':
          if (hasSelection) {
            const lines = selection.split('\n');
            insertText = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
            cursorOffset = 0;
          } else {
            insertText = `1. 有序列表项`;
            cursorOffset = 3;
          }
          break;
        case 'quote':
          if (hasSelection) {
            const lines = selection.split('\n');
            insertText = lines.map(line => `> ${line}`).join('\n');
            cursorOffset = 0;
          } else {
            insertText = `> 引用文本`;
            cursorOffset = 2;
          }
          break;
        case 'table':
          insertText = `| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容1 | 内容2 | 内容3 |`;
          cursorOffset = 0;
          break;
        case 'hr':
          insertText = `\n---\n`;
          cursorOffset = 0;
          break;
        default:
          return;
      }

      const newText = before + insertText + after;
      
      // 计算新的光标位置
      let newCursorPos;
      if (hasSelection) {
        // 如果有选中文本，光标放在格式标记末尾
        newCursorPos = start + insertText.length;
      } else {
        // 如果没有选中文本，光标放在占位符中间
        newCursorPos = start + insertText.length - cursorOffset;
      }
      
      // 确保光标位置在有效范围内
      const maxPos = newText.length;
      newCursorPos = Math.min(Math.max(0, newCursorPos), maxPos);
      
      // 先设置光标位置，再更新状态
      if (textarea && textarea.setSelectionRange) {
        try {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        } catch (error) {
          console.warn('设置光标位置失败:', error);
        }
      }
      
      // 更新状态
      setMarkdownContent(newText);
      if (onChange) {
        onChange(newText);
      }
      
      // 确保焦点和光标位置
      if (textarea && textarea.focus) {
        textarea.focus();
        // 再次确认光标位置
        setTimeout(() => {
          if (textarea && textarea.setSelectionRange) {
            try {
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            } catch (error) {
              console.warn('延迟设置光标位置失败:', error);
            }
          }
        }, 10);
      }
      
      console.log('格式应用完成:', {
        type,
        hasSelection,
        selection,
        insertText,
        newCursorPos,
        maxPos
      });
    } catch (error) {
      console.error('插入Markdown失败:', error);
      message.error('操作失败，请重试');
    }
  }, [getTextarea, onChange]);

  // 复制内容
  const copyContent = () => {
    navigator.clipboard.writeText(markdownContent).then(() => {
      message.success('内容已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 下载Markdown文件
  const downloadMarkdown = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'message.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Markdown文件已下载');
  };

  // 常用颜色预设
  const colorPresets = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000',
    '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF'
  ];

  // 常用表情包
  const emojiList = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😯', '😦', '😧',
    '😮', '😲', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮',
    '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '💩', '👻', '💀', '☠️',
    '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀',
    '😿', '😾', '🙈', '🙉', '🙊', '👶', '👧', '🧒', '👦', '👩',
    '🧑', '👨', '👵', '🧓', '👴', '👮', '👷', '💂', '🕵️', '👸',
    '🤴', '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅',
    '🤶', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '🧌', '👹',
    '👺', '🤡', '👻', '👽', '👾', '🤖', '😈', '👿', '💀', '☠️'
  ];

  // 工具栏按钮分组
  const toolbarGroups = [
    {
      name: '基础格式',
      buttons: [
        { type: 'bold', icon: <BoldOutlined />, tooltip: '粗体' },
        { type: 'italic', icon: <ItalicOutlined />, tooltip: '斜体' },
        { type: 'underline', icon: <UnderlineOutlined />, tooltip: '下划线' }
      ]
    },
    {
      name: '代码和引用',
      buttons: [
        { type: 'code', icon: <CodeOutlined />, tooltip: '行内代码' },
        { type: 'codeblock', icon: <CodeOutlined />, tooltip: '代码块' },
        { type: 'quote', icon: <EditOutlined />, tooltip: '引用' }
      ]
    },
    {
      name: '链接和媒体',
      buttons: [
        { type: 'link', icon: <LinkOutlined />, tooltip: '链接' },
        { type: 'image', icon: <PictureOutlined />, tooltip: '图片' }
      ]
    },
    {
      name: '列表',
      buttons: [
        { type: 'list', icon: <UnorderedListOutlined />, tooltip: '无序列表' },
        { type: 'orderedList', icon: <OrderedListOutlined />, tooltip: '有序列表' }
      ]
    },
    {
      name: '高级功能',
      buttons: [
        { type: 'table', icon: <TableOutlined />, tooltip: '表格' },
        { type: 'hr', icon: <Divider />, tooltip: '分割线' }
      ]
    }
  ];

  // 颜色选择器组件
  const ColorSelector = () => (
    <div style={{ padding: '8px' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>常用颜色：</strong>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        {colorPresets.map((color) => (
          <div
            key={color}
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: color,
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => {
              setSelectedColor(color);
              insertColoredText(color);
            }}
            title={color}
          />
        ))}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>自定义颜色：</strong>
      </div>
      <ColorPicker
        value={selectedColor}
        onChange={(color) => setSelectedColor(color.toHexString())}
        onOk={(color) => insertColoredText(color.toHexString())}
        showText
      />
    </div>
  );

  // 表情包选择器组件
  const EmojiSelector = () => (
    <div style={{ padding: '8px', maxHeight: '300px', overflow: 'auto' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong>选择表情：</strong>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {emojiList.map((emoji, index) => (
          <span
            key={index}
            style={{
              fontSize: '20px',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            onClick={() => insertEmoji(emoji)}
            title={emoji}
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      {showToolbar && (
        <div style={{ marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space wrap>
            {toolbarGroups.map((group, groupIndex) => (
              <React.Fragment key={group.name}>
                {/* 功能按钮组 */}
                {group.buttons.map(({ type, icon, tooltip }) => (
                  <Tooltip key={type} title={tooltip}>
                    <Button
                      type="text"
                      icon={icon}
                      size="small"
                      onClick={() => insertMarkdown(type)}
                      style={{ 
                        padding: '4px 8px',
                        minWidth: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    />
                  </Tooltip>
                ))}
                
                {/* 组间分割线（除了最后一组） */}
                {groupIndex < toolbarGroups.length - 1 && (
                  <div 
                    style={{ 
                      width: '1px',
                      height: '22px',
                      backgroundColor: '#bfbfbf',
                      margin: '0 8px',
                      alignSelf: 'center'
                    }} 
                  />
                )}
              </React.Fragment>
            ))}
            
            {/* 组间分割线 */}
            <div 
              style={{ 
                width: '1px',
                height: '22px',
                backgroundColor: '#bfbfbf',
                margin: '0 8px',
                alignSelf: 'center'
              }} 
            />
            
            {/* 文字颜色选择器 */}
            <Popover 
              content={<ColorSelector />} 
              title="文字颜色" 
              trigger="click"
              placement="bottom"
            >
              <Tooltip title="文字颜色">
                <Button
                  type="text"
                  icon={<FontColorsOutlined />}
                  size="small"
                  style={{ 
                    padding: '4px 8px',
                    minWidth: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              </Tooltip>
            </Popover>

            {/* 表情包选择器 */}
            <Popover 
              content={<EmojiSelector />} 
              title="表情包" 
              trigger="click"
              placement="bottom"
            >
              <Tooltip title="表情包">
                <Button
                  type="text"
                  icon={<SmileOutlined />}
                  size="small"
                  style={{ 
                    padding: '4px 8px',
                    minWidth: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              </Tooltip>
            </Popover>
          </Space>
        </div>
      )}

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <TabPane 
          tab={<span><EditOutlined /> 编辑</span>} 
          key="edit"
        >
          <TextArea
            ref={textareaRef}
            value={markdownContent}
            onChange={handleContentChange}
            placeholder={placeholder}
            autoSize={{ minRows: 8, maxRows: 20 }}
            style={{ 
              height: height,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              fontSize: '14px',
              lineHeight: '1.6'
            }}
          />
        </TabPane>
        
        {showPreview && (
          <TabPane 
            tab={<span><EyeOutlined /> 预览</span>} 
            key="preview"
          >
            <div 
              style={{ 
                height: height,
                overflow: 'auto',
                padding: '16px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                backgroundColor: '#fafafa'
              }}
            >
              {markdownContent ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    // 自定义代码块样式
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <pre style={{ backgroundColor: '#f6f8fa', padding: '16px', borderRadius: '6px' }}>
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    // 自定义表格样式
                    table: ({ children }) => (
                      <table style={{ 
                        borderCollapse: 'collapse', 
                        width: '100%',
                        border: '1px solid #d9d9d9'
                      }}>
                        {children}
                      </table>
                    ),
                    th: ({ children }) => (
                      <th style={{ 
                        border: '1px solid #d9d9d9', 
                        padding: '8px',
                        backgroundColor: '#fafafa',
                        fontWeight: 'bold'
                      }}>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td style={{ 
                        border: '1px solid #d9d9d9', 
                        padding: '8px'
                      }}>
                        {children}
                      </td>
                    )
                  }}
                >
                  {markdownContent}
                </ReactMarkdown>
              ) : (
                <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
                  暂无内容，请在编辑模式下输入Markdown内容
                </div>
              )}
            </div>
          </TabPane>
        )}
      </Tabs>

      {showActions && (
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Tooltip title="复制内容">
              <Button 
                icon={<CopyOutlined />} 
                size="small"
                onClick={copyContent}
              >
                复制
              </Button>
            </Tooltip>
            <Tooltip title="下载Markdown文件">
              <Button 
                icon={<DownloadOutlined />} 
                size="small"
                onClick={downloadMarkdown}
              >
                下载
              </Button>
            </Tooltip>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default RichTextEditor;
