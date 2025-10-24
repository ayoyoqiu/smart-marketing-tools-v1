# 🎭 游客用户功能方案评估

## 📋 需求概述

### 新增角色：游客用户 (guest)

**核心特点**：
- ✅ 可以配置所有功能（创建任务、添加Webhook、上传图片等）
- ❌ 无法实际发送消息（立即发送和定时发送都被禁用）
- ✅ 其他功能与普通用户完全一致

**注册改动**：
- 🔄 新用户注册默认角色从 `user` 改为 `guest`
- 🔄 需要管理员手动升级为 `user` 才能发送消息

---

## 🎯 产品价值分析

### ✅ 优势

1. **防止滥用**
   - 新注册用户不能立即发送消息
   - 减少垃圾信息和恶意推送
   - 需要审核后才能开启发送权限

2. **试用体验**
   - 新用户可以先熟悉系统界面
   - 配置好所有内容后申请开通
   - 降低学习成本

3. **分级管理**
   - 管理员可以筛选和审核新用户
   - 按需开通权限，更安全
   - 便于用户分级管理

4. **灵活控制**
   - 可以暂时关闭某些用户的发送权限
   - 不影响其配置的保留

### ⚠️ 注意事项

1. **用户体验**
   - 需要明确提示"游客模式，无法发送"
   - 提供申请升级的入口
   - 避免用户困惑

2. **管理负担**
   - 管理员需要手动审核升级请求
   - 需要通知机制

3. **现有用户**
   - 不影响现有user角色用户
   - 只影响新注册用户

---

## 🏗️ 技术实施方案

### 1️⃣ 数据库改动 (Supabase)

#### 修改1：users表默认角色
```sql
-- 修改users表的role字段默认值
-- 从 'user' 改为 'guest'
ALTER TABLE users 
ALTER COLUMN role SET DEFAULT 'guest';

-- 查看现有约束
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'users' AND column_name = 'role';

-- 如果有role的CHECK约束，需要更新
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE users ADD CONSTRAINT check_user_role 
CHECK (role IN ('guest', 'user', 'admin', 'super_admin'));
```

#### 修改2：更新注册逻辑
```sql
-- 新用户注册时自动设置为guest
-- 这个会在应用层处理，数据库只需要设置默认值
```

#### 修改3：添加升级记录（可选）
```sql
-- 创建用户角色升级记录表（可选，用于审计）
CREATE TABLE IF NOT EXISTS user_role_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  from_role VARCHAR(20) NOT NULL,
  to_role VARCHAR(20) NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_role_upgrades_user ON user_role_upgrades(user_id);
CREATE INDEX idx_role_upgrades_approved_by ON user_role_upgrades(approved_by);
```

---

### 2️⃣ 前端改动

#### AuthContext.jsx
```javascript
// 添加游客判断函数
const isGuest = () => {
  return currentRole === 'guest';
};

// 更新角色权限继承逻辑
const fetchUserRoles = async (userId) => {
  // ... 现有逻辑
  
  // guest用户只有guest权限，不继承user
  if (allRoles.has('guest') && !allRoles.has('user')) {
    // guest独立，不自动添加user权限
    console.log('🎭 游客用户，受限模式');
  } else if (allRoles.has('super_admin')) {
    allRoles.add('user');
    allRoles.add('admin');
    allRoles.add('super_admin');
  } else if (allRoles.has('admin')) {
    allRoles.add('user');
    allRoles.add('admin');
  } else if (allRoles.has('user')) {
    allRoles.add('user');
  }
  
  // ...
};

// 导出新函数
return {
  // ... 现有导出
  isGuest,
};
```

#### TaskManagement.jsx
```javascript
import { useAuth } from '../contexts/AuthContext';

const TaskManagement = () => {
  const { isGuest } = useAuth();
  
  // 发送按钮禁用逻辑
  const handleSendTask = () => {
    if (isGuest()) {
      message.warning('游客用户无法发送消息，请联系管理员升级账号');
      return;
    }
    
    // 原有发送逻辑
    // ...
  };
  
  return (
    // ...
    <Button 
      type="primary" 
      onClick={handleSendTask}
      disabled={isGuest()} // 游客禁用发送按钮
    >
      {isGuest() ? '发送（需升级）' : '立即发送'}
    </Button>
    
    // 定时发送也需要禁用
    <Button 
      onClick={handleScheduleTask}
      disabled={isGuest()}
    >
      {isGuest() ? '定时发送（需升级）' : '定时发送'}
    </Button>
  );
};
```

#### 添加升级申请入口（个人资料页）
```javascript
// Profile.jsx
const Profile = () => {
  const { currentRole, isGuest } = useAuth();
  
  const handleRequestUpgrade = async () => {
    // 发送升级申请
    const { error } = await supabase
      .from('user_upgrade_requests')
      .insert({
        user_id: user.id,
        from_role: 'guest',
        to_role: 'user',
        reason: '申请开通发送权限'
      });
    
    if (!error) {
      message.success('升级申请已提交，请等待管理员审核');
    }
  };
  
  return (
    // ...
    {isGuest() && (
      <Alert
        type="warning"
        message="您当前是游客模式"
        description="游客模式下无法发送消息，请申请升级为普通用户"
        action={
          <Button onClick={handleRequestUpgrade}>
            申请升级
          </Button>
        }
      />
    )}
  );
};
```

#### Sidebar.jsx
```javascript
// 游客用户的菜单项保持不变
// 只是在任务管理页面中禁用发送功能
const getMenuItems = () => {
  // ... 现有逻辑不变
  // guest用户可以看到所有普通用户菜单
};
```

---

### 3️⃣ 后端改动

#### server.js - API权限控制
```javascript
// 立即发送API - 添加guest检查
app.post('/api/wecom-webhook', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    // 🔒 检查用户角色
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      return res.status(401).json({ error: '用户验证失败' });
    }
    
    // 🎭 游客用户无法发送
    if (userData.role === 'guest') {
      return res.status(403).json({ 
        error: '游客用户无法发送消息',
        message: '请联系管理员升级为普通用户后再发送消息'
      });
    }
    
    // 原有发送逻辑
    // ...
  } catch (error) {
    // ...
  }
});

// 定时任务执行时也要检查
cron.schedule('* * * * *', async () => {
  try {
    // ... 获取待执行任务
    
    // 检查任务创建者的角色
    const { data: taskUser, error: taskUserError } = await supabase
      .from('users')
      .select('role')
      .eq('id', task.user_id)
      .single();
    
    // 🎭 如果创建者是guest，跳过该任务
    if (taskUser && taskUser.role === 'guest') {
      console.log(`⚠️ 任务 ${task.id} 的创建者是游客，跳过执行`);
      
      // 可以更新任务状态为"待审核"
      await supabase
        .from('tasks')
        .update({ 
          status: 'pending_approval',
          note: '游客用户创建的任务需要升级后才能执行'
        })
        .eq('id', task.id);
      
      continue; // 跳过这个任务
    }
    
    // 原有执行逻辑
    // ...
  } catch (error) {
    // ...
  }
});

// 新增API：管理员升级用户
app.post('/api/admin/upgrade-user', async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const adminId = req.headers['x-user-id'];
    
    // 检查操作者是否为管理员
    const { data: adminData } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();
    
    if (!adminData || !['admin', 'super_admin'].includes(adminData.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 升级用户
    const { error: upgradeError } = await supabase
      .from('users')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (upgradeError) {
      return res.status(500).json({ error: '升级失败' });
    }
    
    // 记录升级历史
    await supabase
      .from('user_role_upgrades')
      .insert({
        user_id: userId,
        from_role: 'guest',
        to_role: newRole,
        approved_by: adminId
      });
    
    res.json({ 
      success: true, 
      message: '用户升级成功' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 4️⃣ 角色体系更新

#### 新的角色继承关系
```
super_admin (超级管理员) 
    ├─ super_admin 权限 ✅
    ├─ admin 权限 ✅
    └─ user 权限 ✅

admin (管理员) 
    ├─ admin 权限 ✅
    └─ user 权限 ✅

user (普通用户) 
    └─ user 权限 ✅
    └─ 可以发送消息 ✅

guest (游客用户) 【新增】
    └─ guest 权限 ✅
    └─ 可以配置 ✅
    └─ 不能发送 ❌
```

#### 功能权限对比
| 功能 | guest | user | admin | super_admin |
|------|-------|------|-------|-------------|
| 查看数据 | ✅ 自己的 | ✅ 自己的 | ✅ 所有 | ✅ 所有 |
| 创建任务 | ✅ | ✅ | ✅ | ✅ |
| 配置地址 | ✅ | ✅ | ✅ | ✅ |
| 上传图片 | ✅ | ✅ | ✅ | ✅ |
| **立即发送** | ❌ | ✅ | ✅ | ✅ |
| **定时发送** | ❌ | ✅ | ✅ | ✅ |
| 管理面板 | ❌ | ❌ | ✅ | ✅ |

---

## 📝 实施步骤（按顺序）

### 阶段1：数据库准备（Supabase）
```sql
-- 1. 修改默认角色
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'guest';

-- 2. 更新角色约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE users ADD CONSTRAINT check_user_role 
CHECK (role IN ('guest', 'user', 'admin', 'super_admin'));

-- 3. 创建升级记录表（可选）
CREATE TABLE IF NOT EXISTS user_role_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  from_role VARCHAR(20) NOT NULL,
  to_role VARCHAR(20) NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 验证修改
SELECT column_name, column_default, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'role';
```

### 阶段2：前端实现
1. ✅ 修改 `AuthContext.jsx` - 添加 `isGuest()` 函数
2. ✅ 修改 `TaskManagement.jsx` - 禁用发送按钮
3. ✅ 修改 `Profile.jsx` - 添加升级申请入口
4. ✅ 更新 `Sidebar.jsx` - 添加游客提示（可选）

### 阶段3：后端实现
1. ✅ 修改 `server.js` - 添加角色检查
2. ✅ 修改定时任务 - 跳过guest用户任务
3. ✅ 添加升级API - `/api/admin/upgrade-user`

### 阶段4：管理功能
1. ✅ 管理面板添加"用户升级"功能
2. ✅ 显示待升级用户列表
3. ✅ 一键升级操作

### 阶段5：文档更新
1. ✅ 更新 `USER_ROLES_COMPARISON.md`
2. ✅ 更新 `ROLES_QUICK_REFERENCE.txt`
3. ✅ 更新 `README.md`
4. ✅ 创建游客用户使用指南

### 阶段6：测试验证
1. ✅ 新用户注册测试（应为guest）
2. ✅ 游客发送测试（应被拒绝）
3. ✅ 升级流程测试
4. ✅ 升级后发送测试（应成功）

---

## ⚠️ 潜在问题与解决方案

### 问题1：现有用户受影响？
**答案**：❌ 不受影响
- 只修改默认值，不修改现有数据
- 现有user角色用户保持不变

### 问题2：如何处理已配置的定时任务？
**方案**：
```javascript
// 方案A：暂停执行，保留配置
// 用户升级后自动恢复

// 方案B：标记为待审核
await supabase
  .from('tasks')
  .update({ status: 'pending_approval' })
  .eq('user_id', guestUserId)
  .eq('status', 'scheduled');
```

### 问题3：游客能看到发送历史吗？
**答案**：✅ 可以
- 可以查看之前（升级前）的配置
- 可以查看失败记录（显示"权限不足"）
- 升级后可以看到所有历史

### 问题4：管理员如何知道有人申请升级？
**方案**：
1. 管理面板显示待处理申请数量
2. 邮件/站内通知（可选）
3. 定期审核

### 问题5：可以批量升级吗？
**答案**：✅ 可以
```javascript
// 管理员批量升级
const upgradeMultipleUsers = async (userIds) => {
  for (const userId of userIds) {
    await upgradeUser(userId, 'user');
  }
};
```

---

## 💰 工作量估算

| 阶段 | 工作量 | 难度 | 说明 |
|------|--------|------|------|
| 数据库改动 | 0.5小时 | ⭐ 简单 | 执行SQL即可 |
| 前端实现 | 2-3小时 | ⭐⭐ 中等 | 多个组件修改 |
| 后端实现 | 1-2小时 | ⭐⭐ 中等 | API权限控制 |
| 管理功能 | 1-2小时 | ⭐⭐ 中等 | 升级界面 |
| 文档更新 | 0.5小时 | ⭐ 简单 | 更新文档 |
| 测试验证 | 1-2小时 | ⭐⭐ 中等 | 完整测试 |
| **总计** | **6-10小时** | **⭐⭐ 中等** | 1-2个工作日 |

---

## ✅ 可行性结论

### 综合评估：⭐⭐⭐⭐⭐ 强烈推荐

#### ✅ 优点
1. **技术可行性高** - 改动清晰，风险低
2. **产品价值大** - 有效防止滥用
3. **用户体验好** - 可以先试用再申请
4. **管理更方便** - 分级管理用户
5. **不影响现有用户** - 向后兼容

#### ⚠️ 注意点
1. 需要明确的UI提示
2. 需要管理员审核流程
3. 需要升级通知机制

#### 🎯 建议
- ✅ **可以立即实施**
- ✅ 分阶段上线，先数据库，后功能
- ✅ 提供快速升级通道（管理员一键升级）
- ✅ 可以设置自动升级规则（如注册7天后自动升级）

---

## 🚀 是否开始实施？

如果确认实施，我可以：
1. 创建详细的数据库迁移脚本
2. 修改前后端代码
3. 创建管理员升级界面
4. 更新所有文档
5. 提供测试指南

**预计完成时间**：1-2个工作日

---

**文档版本**: v1.0
**创建日期**: 2025-10-24
**适用版本**: v1.0.1 (当前稳定版)

