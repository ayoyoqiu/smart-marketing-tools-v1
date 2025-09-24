import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

const MarkdownPreview = ({ 
  content = '', 
  style = {},
  className = '',
  showLineNumbers = false 
}) => {
  if (!content) {
    return (
      <div 
        style={{ 
          color: '#999', 
          textAlign: 'center', 
          padding: '40px 0',
          ...style 
        }}
        className={className}
      >
        暂无内容
      </div>
    );
  }

  return (
    <div 
      style={{ 
        padding: '16px',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        backgroundColor: '#fafafa',
        overflow: 'auto',
        ...style 
      }}
      className={className}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 自定义代码块样式
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <pre style={{ 
                backgroundColor: '#f6f8fa', 
                padding: '16px', 
                borderRadius: '6px',
                overflow: 'auto',
                position: 'relative'
              }}>
                {showLineNumbers && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '12px',
                    color: '#666',
                    backgroundColor: '#e1e4e8',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {match[1]}
                  </div>
                )}
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code 
                className={className} 
                {...props}
                style={{ 
                  backgroundColor: '#f1f3f4', 
                  padding: '2px 4px', 
                  borderRadius: '3px',
                  fontSize: '0.9em'
                }}
              >
                {children}
              </code>
            );
          },
          // 自定义表格样式
          table: ({ children }) => (
            <div style={{ overflow: 'auto' }}>
              <table style={{ 
                borderCollapse: 'collapse', 
                width: '100%',
                border: '1px solid #d9d9d9',
                fontSize: '14px'
              }}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ 
              border: '1px solid #d9d9d9', 
              padding: '12px 8px',
              backgroundColor: '#fafafa',
              fontWeight: 'bold',
              textAlign: 'left'
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ 
              border: '1px solid #d9d9d9', 
              padding: '12px 8px'
            }}>
              {children}
            </td>
          ),
          // 自定义标题样式
          h1: ({ children }) => (
            <h1 style={{ 
              borderBottom: '2px solid #e1e4e8', 
              paddingBottom: '8px',
              marginTop: '24px',
              marginBottom: '16px'
            }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ 
              borderBottom: '1px solid #e1e4e8', 
              paddingBottom: '6px',
              marginTop: '20px',
              marginBottom: '12px'
            }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ 
              marginTop: '16px',
              marginBottom: '8px'
            }}>
              {children}
            </h3>
          ),
          // 自定义列表样式
          ul: ({ children }) => (
            <ul style={{ paddingLeft: '20px' }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: '20px' }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: '4px' }}>
              {children}
            </li>
          ),
          // 自定义引用样式
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: '4px solid #dfe2e5',
              paddingLeft: '16px',
              margin: '16px 0',
              color: '#6a737d',
              backgroundColor: '#f6f8fa',
              padding: '12px 16px',
              borderRadius: '0 6px 6px 0'
            }}>
              {children}
            </blockquote>
          ),
          // 自定义分割线样式
          hr: () => (
            <hr style={{
              border: 'none',
              borderTop: '1px solid #e1e4e8',
              margin: '24px 0'
            }} />
          ),
          // 自定义链接样式
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#0366d6',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.target.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.target.style.textDecoration = 'none';
              }}
            >
              {children}
            </a>
          ),
          // 自定义图片样式
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt}
              style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '6px',
                border: '1px solid #e1e4e8'
              }}
            />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
