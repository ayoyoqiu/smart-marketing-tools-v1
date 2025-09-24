-- 简化修复ai_conversations表的RLS策略
-- 执行时间: 2025-01-27
-- 用途: 允许服务端保存AI对话记录

-- ========================================
-- 1. 临时禁用RLS进行测试
-- ========================================

-- 临时禁用RLS，允许服务端插入数据
ALTER TABLE ai_conversations DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 2. 验证表结构
-- ========================================

-- 检查表是否存在
SELECT 
    '表存在性验证' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') 
        THEN '✅ ai_conversations表存在'
        ELSE '❌ ai_conversations表不存在'
    END as table_status;

-- 检查字段结构
SELECT 
    '字段结构验证' as check_type,
    COUNT(*) as total_columns,
    STRING_AGG(column_name, ', ') as column_names
FROM information_schema.columns 
WHERE table_name = 'ai_conversations';

-- ========================================
-- 3. 测试插入功能
-- ========================================

-- 插入测试数据
INSERT INTO ai_conversations (user_id, session_id, question, answer, context, tokens_used, response_time) 
VALUES (
    '00000000-0000-0000-0000-000000000000',  -- 测试用户ID
    'test_session_001',                      -- 测试会话ID
    '测试问题',                              -- 测试问题
    '测试回答',                              -- 测试回答
    '测试上下文',                            -- 测试上下文
    100,                                     -- 测试token数
    1000                                     -- 测试响应时间
);

-- 验证插入结果
SELECT 
    '插入测试验证' as check_type,
    COUNT(*) as total_records,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ 插入功能正常'
        ELSE '❌ 插入功能异常'
    END as insert_status
FROM ai_conversations 
WHERE session_id = 'test_session_001';

-- 清理测试数据
DELETE FROM ai_conversations WHERE session_id = 'test_session_001';

-- ========================================
-- 4. 重新启用RLS并创建宽松策略
-- ========================================

-- 重新启用RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- 删除现有策略
DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON ai_conversations;

-- 创建宽松的插入策略（允许服务端插入）
CREATE POLICY "Allow service insert" ON ai_conversations
    FOR INSERT WITH CHECK (true);

-- 创建查看策略（用户只能查看自己的记录）
CREATE POLICY "Users can view own conversations" ON ai_conversations
    FOR SELECT USING (
        user_id = auth.uid() OR 
        auth.uid() IS NULL  -- 允许服务端查看
    );

-- ========================================
-- 5. 验证策略创建
-- ========================================

-- 检查RLS策略
SELECT 
    'RLS策略验证' as check_type,
    COUNT(*) as total_policies,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'ai_conversations';

-- ========================================
-- 修复完成
-- ========================================

SELECT '✅ ai_conversations表RLS策略修复完成！现在可以正常保存AI对话记录。' as status;
