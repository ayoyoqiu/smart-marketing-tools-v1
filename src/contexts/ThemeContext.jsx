import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [customTheme, setCustomTheme] = useState(null);
  
  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedCustomTheme = localStorage.getItem('customTheme');
    
    setTheme(savedTheme);
    if (savedCustomTheme) {
      setCustomTheme(JSON.parse(savedCustomTheme));
    }
    
    // 应用主题到DOM
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };
  
  const updateCustomTheme = (newCustomTheme) => {
    setCustomTheme(newCustomTheme);
    localStorage.setItem('customTheme', JSON.stringify(newCustomTheme));
  };
  
  const resetTheme = () => {
    setCustomTheme(null);
    localStorage.removeItem('customTheme');
  };
  
  return (
    <ThemeContext.Provider value={{ 
      theme, 
      toggleTheme, 
      customTheme, 
      updateCustomTheme, 
      resetTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
