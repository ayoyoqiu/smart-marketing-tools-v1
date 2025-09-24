import React from 'react';
import { Card } from 'antd';
import './AnimatedCard.css';

const AnimatedCard = ({ 
  children, 
  title, 
  className = '', 
  delay = 0,
  hoverable = true,
  ...props 
}) => {
  const cardStyle = {
    animationDelay: `${delay * 0.1}s`,
    '--delay': `${delay * 0.1}s`
  };

  return (
    <Card
      title={title}
      className={`animated-card ${className}`}
      style={cardStyle}
      hoverable={hoverable}
      {...props}
    >
      {children}
    </Card>
  );
};

export default AnimatedCard;
