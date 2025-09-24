import React from 'react';
import { Badge, Tooltip } from 'antd';
import './StatusIndicator.css';

const StatusIndicator = ({ 
  status, 
  size = "default", 
  showText = true,
  className = '' 
}) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'success':
        return { 
          color: '#52c41a', 
          text: '成功', 
          icon: '●' 
        };
      case 'error':
        return { 
          color: '#ff4d4f', 
          text: '错误', 
          icon: '●' 
        };
      case 'warning':
        return { 
          color: '#faad14', 
          text: '警告', 
          icon: '●' 
        };
      case 'info':
        return { 
          color: '#1890ff', 
          text: '信息', 
          icon: '●' 
        };
      case 'processing':
        return { 
          color: '#1890ff', 
          text: '处理中', 
          icon: '●' 
        };
      default:
        return { 
          color: '#d9d9d9', 
          text: '未知', 
          icon: '●' 
        };
    }
  };

  const config = getStatusConfig(status);
  const dotSize = size === 'small' ? '8px' : size === 'large' ? '16px' : '12px';

  return (
    <Tooltip title={config.text} placement="top">
      <div className={`status-indicator ${className}`}>
        <div 
          className="status-dot"
          style={{ 
            backgroundColor: config.color,
            width: dotSize,
            height: dotSize
          }}
        />
        {showText && (
          <span className="status-text">{config.text}</span>
        )}
      </div>
    </Tooltip>
  );
};

export default StatusIndicator;
