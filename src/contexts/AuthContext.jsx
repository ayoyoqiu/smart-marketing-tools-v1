import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, setCurrentUserId } from '../../supabaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState('user');
  const [availableRoles, setAvailableRoles] = useState([]);

  // 检查用户是否为管理员
  const isAdmin = () => {
    return currentRole === 'admin' || currentRole === 'super_admin';
  };

  // 检查用户是否有指定角色
  const hasRole = (role) => {
    return availableRoles.includes(role);
  };

  // 获取用户可用角色 - 优化版本
  const fetchUserRoles = async (userId) => {
    try {
      console.log('🔍 开始获取用户角色，用户ID:', userId);
      
      // 优化：并行查询两个表，提升性能
      const [userRolesResult, userResult] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(10), // 限制查询数量
        
        supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single()
      ]);

      // 收集所有角色
      const allRoles = new Set();

      // 从user_roles表获取角色
      if (!userRolesResult.error && userRolesResult.data && userRolesResult.data.length > 0) {
        const userRoles = userRolesResult.data.map(item => item.role).filter(Boolean);
        userRoles.forEach(role => allRoles.add(role));
        console.log('✅ 从user_roles表获取角色:', userRoles);
      }

      // 从users表获取角色
      if (!userResult.error && userResult.data) {
        const userRole = userResult.data.role || 'user';
        allRoles.add(userRole);
        console.log('✅ 从users表获取角色:', userRole);
      }

      // 特殊处理：只有super_admin用户才拥有所有三种角色
      if (allRoles.has('super_admin')) {
        allRoles.add('user');
        allRoles.add('admin');
        allRoles.add('super_admin');
        console.log('🚀 super_admin用户自动获得所有角色权限');
      } else if (allRoles.has('admin')) {
        // admin用户只拥有user和admin权限
        allRoles.add('user');
        allRoles.add('admin');
        console.log('🚀 admin用户获得user和admin权限');
      }

      const finalRoles = Array.from(allRoles);
      console.log('✅ 最终用户角色:', finalRoles);
      return finalRoles;
    } catch (error) {
      console.error('❌ 获取用户角色异常:', error);
      return ['user']; // 返回默认角色
    }
  };


  // 切换用户角色 - 简化版本
  const switchRole = async (newRole) => {
    if (!user || !availableRoles.includes(newRole)) {
      console.error('❌ 无法切换到指定角色:', newRole);
      return false;
    }

    try {
      console.log('🔄 开始切换角色:', { from: currentRole, to: newRole });
      
      // 直接更新本地状态和存储
      setCurrentRole(newRole);
      localStorage.setItem('currentRole', newRole);
      
      // 更新用户对象中的当前角色
      setUser(prevUser => ({
        ...prevUser,
        currentRole: newRole
      }));
      
      console.log('✅ 角色切换成功:', newRole);
      return true;
    } catch (error) {
      console.error('❌ 角色切换异常:', error);
      return false;
    }
  };

  // 用户登录处理 - 优化版本
  const handleUserLogin = async (supabaseUser) => {
    try {
      console.log('🔍 开始处理用户登录:', supabaseUser.id);
      
      // 优化：并行执行多个操作，提升性能
      const currentTime = new Date().toISOString();
      const [roles, updateResult] = await Promise.all([
        fetchUserRoles(supabaseUser.id),
        // 并行更新最后登录时间
        supabase
          .from('users')
          .update({ last_login_at: currentTime })
          .eq('id', supabaseUser.id)
      ]);

      // 检查更新结果
      if (updateResult.error) {
        console.error('❌ 更新最后登录时间失败:', updateResult.error);
      } else {
        console.log('✅ 最后登录时间更新成功');
      }

      console.log('✅ 用户可用角色:', roles);
      setAvailableRoles(roles);

      // 🚀 自动分配最大权限：优先使用最高级别角色
      let maxRole = 'user';
      if (roles.includes('super_admin')) {
        maxRole = 'super_admin';
      } else if (roles.includes('admin')) {
        maxRole = 'admin';
      } else if (roles.includes('user')) {
        maxRole = 'user';
      }
      
      console.log('🚀 自动分配最大权限:', { 
        availableRoles: roles, 
        maxRole 
      });
      
      // 并行设置状态和存储，提升性能
      await Promise.all([
        setCurrentUserId(supabaseUser.id),
        // 立即设置用户状态
        setUser(prev => ({ 
          ...prev, 
          roles, 
          last_login_at: currentTime 
        }))
      ]);
      
      setCurrentRole(maxRole);
      localStorage.setItem('currentRole', maxRole);
      
      console.log('✅ 用户登录处理完成，权限级别:', maxRole);
    } catch (error) {
      console.error('❌ 用户登录处理失败:', error);
    }
  };

  // 登录函数 - 修复版本
  const login = async (nickname, password) => {
    const startTime = performance.now();
    try {
      console.log('🔍 开始登录:', nickname);
      
      // 优化查询：只选择必要字段，使用limit(1)减少数据传输
      const { data: users, error: queryError } = await supabase
        .from('users')
        .select('id, nickname, password_hash, role, status, email, created_at')
        .eq('nickname', nickname)
        .eq('status', 'active')
        .limit(1);

      if (queryError) {
        console.error('❌ 查询用户失败:', queryError);
        return false;
      }

      if (!users || users.length === 0) {
        console.log('❌ 用户不存在:', nickname);
        return false;
      }

      // 检查密码（支持多种格式：明文、base64编码、bcrypt哈希）
      const user = users[0];
      let isPasswordValid = false;
      
      // 1. 明文密码比较
      if (user.password_hash === password) {
        isPasswordValid = true;
      }
      // 2. base64编码密码比较
      else if (user.password_hash === btoa(password)) {
        isPasswordValid = true;
      }
      // 3. base64解码比较
      else if (user.password_hash && atob(user.password_hash) === password) {
        isPasswordValid = true;
      }
      // 4. bcrypt哈希比较（用于超级管理员等）
      else if (user.password_hash && user.password_hash.startsWith('$2a$')) {
        console.log('🔐 检测到bcrypt哈希密码，调用后端验证');
        try {
          const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nickname, password }),
          });
          
          const result = await response.json();
          isPasswordValid = result.valid;
          
          if (result.valid && result.user) {
            // 如果后端验证成功，使用后端返回的用户数据
            user.id = result.user.id;
            user.role = result.user.role;
            user.status = result.user.status;
            user.email = result.user.email;
            user.created_at = result.user.created_at;
          }
        } catch (apiError) {
          console.error('❌ 后端密码验证失败:', apiError);
          isPasswordValid = false;
        }
      }

      if (!isPasswordValid) {
        console.log('❌ 密码错误');
        return false;
      }

            console.log('✅ 登录成功，用户ID:', user.id);
      
      // 使用自定义认证，不需要Supabase认证
      console.log('✅ 使用自定义认证系统');
      
      // 验证用户状态
      if (!user.id || user.status !== 'active') {
        throw new Error('用户状态无效');
      }
      
      console.log('✅ 用户状态验证通过:', user.nickname);
      
      // 并行执行登录处理，提升性能
      const currentTime = new Date().toISOString();
      await Promise.all([
        handleUserLogin(user),
        // 立即设置用户状态，包含最新的登录时间
        setUser({ ...user, roles: [user.role], last_login_at: currentTime })
      ]);
      
      // 确保设置当前用户ID到本地存储
      localStorage.setItem('currentUserId', user.id);
      console.log('✅ 用户ID已保存到本地存储:', user.id);
      
      // 在昵称登录成功后，使用邮箱+密码建立 Supabase Auth 会话（用于RLS与Storage鉴权）
      try {
        if (user?.email) {
          await supabase.auth.signInWithPassword({
            email: user.email,
            password
          });
          const { data: { user: authUser } } = await supabase.auth.getUser();
          console.log('✅ Supabase Auth 会话建立完成, uid =', authUser?.id);
        } else {
          console.warn('⚠️ 当前用户没有邮箱，无法建立 Supabase Auth 会话');
        }
      } catch (e) {
        console.warn('⚠️ Supabase Auth 会话建立失败:', e?.message || e);
      }
      
      const endTime = performance.now();
      console.log(`⚡ 登录完成，总耗时: ${Math.round(endTime - startTime)}ms`);
      
      return true;
    } catch (error) {
      console.error('❌ 登录异常:', error);
      return false;
    }
  };

  // 注册函数 - 使用后端API绕过RLS限制
  const register = async (nickname, password, email = null) => {
    try {
      console.log('🔍 开始注册用户:', { nickname, email: email || '未提供' });
      
      // 调用后端注册API
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname, password, email }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ 注册失败:', result.error);
        return false;
      }

      if (result.success && result.user) {
        console.log('✅ 用户注册成功:', result.user);
        
        // 自动登录 - 使用后端返回的用户记录
        await handleUserLogin(result.user);
        return true;
      } else {
        console.error('❌ 注册响应异常:', result);
        return false;
      }
      
    } catch (error) {
      console.error('❌ 注册失败:', error);
      return false;
    }
  };

  // 登出函数 - 增强版本，确保完全清理
  const logout = async () => {
    console.log('🔍 用户登出，开始清理...');
    
    // 使用自定义认证，不需要清理Supabase会话
    console.log('✅ 使用自定义认证系统，无需清理Supabase会话');
    
    // 清理用户状态
    setUser(null);
    setCurrentRole('user');
    setAvailableRoles([]);
    
    // 清理本地存储
    localStorage.removeItem('currentRole');
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('cachedUser');
    localStorage.removeItem('authCacheTime');
    
    // 清理Supabase连接状态
    setCurrentUserId(null);
    
    console.log('✅ 用户登出清理完成');
  };

  // 检查认证状态 - 修复版本
  useEffect(() => {
    let isMounted = true; // 防止组件卸载后的状态更新
    
    const checkAuth = async () => {
      const startTime = performance.now();
      try {
        console.log('🔍 开始检查认证状态');
        
        // 使用自定义认证系统，检查本地存储的用户信息
        const storedUserId = localStorage.getItem('currentUserId');
        const storedRole = localStorage.getItem('currentRole');
        
        if (storedUserId) {
          console.log('🔍 发现存储的用户ID:', storedUserId);
          
          // 检查本地存储的角色信息
          const storedRole = localStorage.getItem('currentRole');
          
          // 检查认证缓存是否有效（5分钟内）
          const authCacheTime = localStorage.getItem('authCacheTime');
          const now = Date.now();
          const isCacheValid = authCacheTime && (now - parseInt(authCacheTime)) < 5 * 60 * 1000;

          if (isCacheValid) {
            console.log('⚡ 使用认证缓存，跳过数据库查询');
            // 从缓存恢复用户状态
            const cachedUser = JSON.parse(localStorage.getItem('cachedUser') || '{}');
            if (cachedUser.id === storedUserId) {
              setUser(cachedUser);
              setCurrentRole(storedRole || cachedUser.role || 'user');
              setAvailableRoles(cachedUser.roles || [cachedUser.role || 'user']);
              setLoading(false);
              return;
            }
          }

          console.log('🔍 使用Supabase会话用户ID:', storedUserId);
          
          // 优化查询：只选择必要字段，减少数据传输
          const { data: userData, error } = await supabase
            .from('users')
            .select('id, email, nickname, role, status, created_at, last_login_at')
            .eq('id', storedUserId)
            .eq('status', 'active')
            .single();

          if (!error && userData && isMounted) {
            console.log('✅ 用户数据有效:', userData.nickname);
            
            // 并行获取用户角色和设置用户状态，提升性能
            const [roles] = await Promise.all([
              fetchUserRoles(userData.id),
              // 立即设置用户基本信息，不等待角色
              setUser({ ...userData, roles: [] })
            ]);
            
            if (isMounted) {
              console.log('✅ 获取到的用户角色:', roles);
              setAvailableRoles(roles);
              
              // 验证存储的角色是否仍然有效
              const validRole = storedRole && roles.includes(storedRole) ? storedRole : userData.role;
              console.log('🔍 角色验证结果:', { 
                storedRole, 
                userDataRole: userData.role, 
                validRole, 
                availableRoles: roles 
              });
              
              setCurrentRole(validRole);
              // 更新用户信息，包含角色
              const userWithRoles = { ...userData, roles };
              setUser(userWithRoles);
              
              // 缓存用户信息，提升下次访问速度
              localStorage.setItem('cachedUser', JSON.stringify(userWithRoles));
              localStorage.setItem('authCacheTime', now.toString());
              localStorage.setItem('currentUserId', storedUserId);
              
              // 重新设置当前用户ID
              await setCurrentUserId(userData.id);
            }
          } else if (isMounted) {
            console.log('❌ 用户数据无效，清除存储信息');
            // 清除无效的存储信息
            localStorage.removeItem('currentUserId');
            localStorage.removeItem('currentRole');
            localStorage.removeItem('cachedUser');
            localStorage.removeItem('authCacheTime');
          }
        } else {
          console.log('🔍 未发现存储的用户信息');
        }
      } catch (error) {
        console.error('❌ 检查认证状态失败:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
          const endTime = performance.now();
          console.log(`✅ 认证状态检查完成，耗时: ${Math.round(endTime - startTime)}ms`);
        }
      }
    };

    // 延迟执行，避免阻塞页面渲染
    const timer = setTimeout(checkAuth, 50);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const value = {
    user,
    loading,
    currentRole,
    availableRoles,
    isAuthenticated: !!user,
    isAdmin,
    hasRole,
    switchRole,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

