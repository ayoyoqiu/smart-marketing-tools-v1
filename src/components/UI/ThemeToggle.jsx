import React from 'react';
import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Tooltip 
      title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
      placement="bottom"
    >
      <Button
        type="text"
        icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
        onClick={toggleTheme}
        className="theme-toggle-btn"
        size="middle"
      />
    </Tooltip>
  );
};

export default ThemeToggle;
