-- AI聊天机器人知识库表结构
-- 创建时间: 2025-01-27
-- 用途: 支持AI助手的知识文档管理和对话记录

-- ========================================
-- 1. 创建帮助文档表
-- ========================================

CREATE TABLE IF NOT EXISTS help_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL UNIQUE,    -- 文档标题（唯一约束）
    content TEXT NOT NULL,                 -- 文档内容
    category VARCHAR(100),                 -- 文档分类
    sort_order INTEGER DEFAULT 0,          -- 排序顺序
    is_active BOOLEAN DEFAULT true,        -- 是否启用
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 2. 创建AI对话记录表
-- ========================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- 用户ID
    session_id VARCHAR(100),               -- 会话ID
    question TEXT NOT NULL,                -- 用户问题
    answer TEXT NOT NULL,                  -- AI回答
    context TEXT,                          -- 使用的上下文
    tokens_used INTEGER,                   -- 使用的token数
    response_time INTEGER,                 -- 响应时间(ms)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 3. 创建索引
-- ========================================

-- 帮助文档表索引
CREATE INDEX IF NOT EXISTS idx_help_documents_category ON help_documents(category);
CREATE INDEX IF NOT EXISTS idx_help_documents_sort_order ON help_documents(sort_order);
CREATE INDEX IF NOT EXISTS idx_help_documents_is_active ON help_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_help_documents_created_at ON help_documents(created_at);

-- AI对话记录表索引
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);

-- ========================================
-- 4. 启用行级安全策略 (RLS)
-- ========================================

ALTER TABLE help_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 5. 创建RLS策略
-- ========================================

-- 帮助文档表策略（所有用户可读，管理员可写）
CREATE POLICY "All users can view help documents" ON help_documents
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage help documents" ON help_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    );

-- AI对话记录表策略（用户只能查看自己的对话）
CREATE POLICY "Users can view own conversations" ON ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations" ON ai_conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    );

-- ========================================
-- 6. 创建触发器
-- ========================================

-- 为help_documents表创建更新时间戳触发器
CREATE TRIGGER update_help_documents_updated_at BEFORE UPDATE ON help_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 7. 插入初始知识文档
-- ========================================

INSERT INTO help_documents (title, content, category, sort_order) VALUES
('如何创建任务', 
'## 创建定时任务步骤

1. **进入任务管理页面**
   - 点击左侧菜单的"任务管理"
   - 点击"新建任务"按钮

2. **填写任务基本信息**
   - 任务标题：输入任务名称
   - 消息类型：选择图文消息、富文本消息或卡片消息

3. **设置消息内容**
   - 根据选择的消息类型填写相应内容
   - 支持图片上传和富文本编辑

4. **选择发送时间**
   - 立即发送：点击"立即发送"按钮
   - 定时发送：选择具体的日期和时间

5. **选择接收分组**
   - 从可用分组中选择目标分组
   - 可以同时选择多个分组

6. **保存任务**
   - 点击"保存"按钮完成任务创建', 
'任务管理', 1),

('如何管理地址', 
'## 地址管理操作指南

### 添加新地址
1. 进入"地址管理"页面
2. 点击"添加地址"按钮
3. 填写机器人信息：
   - 群名称：输入企业微信群名称
   - 机器人名称：输入机器人名称
   - Webhook地址：粘贴机器人Webhook URL
   - 选择分组：从下拉列表选择分组
4. 点击"保存"按钮

### 编辑地址信息
1. 在地址列表中找到要编辑的地址
2. 点击"编辑"按钮
3. 修改相关信息
4. 点击"保存"按钮

### 删除地址
1. 在地址列表中找到要删除的地址
2. 点击"删除"按钮
3. 确认删除操作', 
'地址管理', 2),

('如何设置分组', 
'## 分组管理功能

### 创建新分组
1. 在地址管理页面点击"分组管理"
2. 点击"新建分组"按钮
3. 填写分组信息：
   - 分组名称：输入分组名称
   - 分组描述：输入分组说明
   - 分组颜色：选择显示颜色
4. 点击"保存"按钮

### 编辑分组信息
1. 在分组列表中找到要编辑的分组
2. 点击"编辑"按钮
3. 修改分组信息
4. 点击"保存"按钮

### 删除分组
1. 在分组列表中找到要删除的分组
2. 点击"删除"按钮
3. 确认删除操作

**注意**：删除分组前请确保该分组下没有地址，或先将地址移动到其他分组。', 
'分组管理', 3),

('消息类型说明', 
'## 支持的消息类型

### 1. 图文消息
- **用途**：发送包含文字和图片的消息
- **特点**：支持多张图片，图片会自动压缩
- **适用场景**：产品介绍、活动宣传等

### 2. 富文本消息
- **用途**：发送格式化的文本消息
- **特点**：支持标题、粗体、斜体、颜色等格式
- **适用场景**：通知公告、重要信息发布等

### 3. 卡片消息
- **用途**：发送结构化的卡片消息
- **特点**：包含标题、描述、链接等元素
- **适用场景**：链接分享、功能推荐等

### 消息发送限制
- 单次最多支持9张图片
- 文本内容不超过2000字符
- 图片大小不超过2MB', 
'消息推送', 4),

('定时任务管理', 
'## 定时任务功能

### 创建定时任务
1. 在任务管理页面点击"新建任务"
2. 填写任务信息
3. 选择"定时发送"
4. 设置具体的发送时间
5. 保存任务

### 任务状态说明
- **等待中**：任务已创建，等待执行
- **执行中**：任务正在发送消息
- **已完成**：任务执行成功
- **失败**：任务执行失败，可查看错误信息

### 任务管理操作
- **编辑任务**：修改任务内容和时间
- **删除任务**：删除不需要的任务
- **立即执行**：立即执行等待中的任务

### 注意事项
- 不能设置过去的时间
- 系统会自动检查时间有效性
- 失败的任务可以重新执行', 
'任务管理', 5),

('用户权限说明', 
'## 用户角色和权限

### 普通用户
- 创建和管理自己的任务
- 管理自己的地址和分组
- 查看自己的消息历史
- 使用AI助手功能

### 管理员
- 拥有普通用户的所有权限
- 查看所有用户的数据
- 管理用户账户
- 查看系统统计信息

### 超级管理员
- 拥有管理员的所有权限
- 管理知识文档
- 系统配置管理
- 数据备份和恢复

### 权限控制
- 基于角色的访问控制(RBAC)
- 数据隔离保护
- 操作日志记录', 
'用户管理', 6)

ON CONFLICT (title) DO NOTHING;

-- ========================================
-- 8. 验证创建结果
-- ========================================

-- 检查表创建结果
SELECT 
    'AI表创建验证' as check_type,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('help_documents', 'ai_conversations');

-- 检查初始文档
SELECT 
    '初始文档验证' as check_type,
    COUNT(*) as document_count,
    STRING_AGG(title, ', ') as document_titles
FROM help_documents 
WHERE is_active = true;

-- 检查RLS策略
SELECT 
    'AI表RLS策略验证' as check_type,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('help_documents', 'ai_conversations');

-- ========================================
-- 创建完成
-- ========================================

SELECT '✅ AI知识库表结构创建完成！' as status;
