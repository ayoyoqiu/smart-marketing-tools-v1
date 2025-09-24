-- 推送机器人2.5版本 - 数据库初始化脚本
-- 执行时间: 2025-08-29
-- 目标: 完整的数据库初始化和表结构创建

-- ========================================
-- 1. 创建核心表结构
-- ========================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    nickname VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 分组表
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1890ff',
    sort_order INTEGER DEFAULT 0,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    creator VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook表
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_name VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    webhook_url TEXT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    scheduled_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    creator VARCHAR(100),
    group_category TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    execution_result JSONB
);

-- ========================================
-- 2. 创建索引
-- ========================================

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 用户角色表索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- 分组表索引
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_sort_order ON groups(sort_order);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);

-- Webhook表索引
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_group_id ON webhooks(group_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);

-- 任务表索引
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_time ON tasks(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- ========================================
-- 3. 创建系统默认分组
-- ========================================

-- 插入系统默认分组
INSERT INTO groups (name, description, color, sort_order, user_id, creator) VALUES
('全部', '系统默认分组，包含所有机器人地址', '#52c41a', 0, NULL, '系统'),
('未分组', '系统默认分组，包含未分配分组的机器人地址', '#faad14', 1, NULL, '系统'),
('默认分组', '系统默认分组', '#1890ff', 2, NULL, '系统')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- 4. 创建超级管理员用户
-- ========================================

-- 插入超级管理员用户（如果不存在）
INSERT INTO users (email, nickname, password, role, status) VALUES
('admin@system.com', 'admin', '$2a$10$default_hashed_password', 'super_admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- 插入超级管理员角色
INSERT INTO user_roles (user_id, role, is_active)
SELECT u.id, 'super_admin', true
FROM users u
WHERE u.email = 'admin@system.com'
AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role = 'super_admin'
);

-- ========================================
-- 5. 启用行级安全策略 (RLS)
-- ========================================

-- 启用所有表的RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 6. 创建RLS策略
-- ========================================

-- 用户表策略
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- 用户角色表策略
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- 分组表策略
CREATE POLICY "Users can manage own groups" ON groups
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "System groups are viewable by all" ON groups
    FOR SELECT USING (user_id IS NULL);

CREATE POLICY "Admins can manage all groups" ON groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    );

-- Webhook表策略
CREATE POLICY "Users can manage own webhooks" ON webhooks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all webhooks" ON webhooks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    );

-- 任务表策略
CREATE POLICY "Users can manage own tasks" ON tasks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tasks" ON tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    );

-- ========================================
-- 7. 创建触发器函数
-- ========================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表创建更新时间戳触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 8. 验证创建结果
-- ========================================

-- 检查表创建结果
SELECT 
    '表创建验证' as check_type,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'user_roles', 'groups', 'webhooks', 'tasks');

-- 检查系统分组
SELECT 
    '系统分组验证' as check_type,
    COUNT(*) as system_groups,
    STRING_AGG(name, ', ') as group_names
FROM groups 
WHERE user_id IS NULL;

-- 检查超级管理员
SELECT 
    '超级管理员验证' as check_type,
    COUNT(*) as admin_count,
    STRING_AGG(email, ', ') as admin_emails
FROM users 
WHERE role = 'super_admin';

-- 检查RLS策略
SELECT 
    'RLS策略验证' as check_type,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public';

-- ========================================
-- 初始化完成
-- ========================================

SELECT '✅ 数据库初始化完成！' as status;
