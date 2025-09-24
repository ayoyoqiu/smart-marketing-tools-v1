-- 推送机器人2.5版本 - 维护脚本集合
-- 执行时间: 2025-08-29
-- 目标: 整合所有维护功能到一个脚本中

-- ========================================
-- 1. 数据完整性检查
-- ========================================

-- 检查所有表的数据状态
SELECT 
    '=== 数据完整性检查 ===' as section;

-- 用户表检查
SELECT 
    '用户表检查' as table_name,
    COUNT(*) as total_users,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
    COUNT(CASE WHEN creator IS NULL OR creator = '' THEN 1 END) as missing_creator
FROM users;

-- 分组表检查
SELECT 
    '分组表检查' as table_name,
    COUNT(*) as total_groups,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as system_groups,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_groups,
    COUNT(CASE WHEN creator IS NULL OR creator = '' THEN 1 END) as missing_creator
FROM groups;

-- Webhook表检查
SELECT 
    'Webhook表检查' as table_name,
    COUNT(*) as total_webhooks,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_webhooks,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_webhooks,
    COUNT(CASE WHEN creator IS NULL OR creator = '' THEN 1 END) as missing_creator,
    COUNT(CASE WHEN group_id IS NULL THEN 1 END) as ungrouped_webhooks
FROM webhooks;

-- 任务表检查
SELECT 
    '任务表检查' as table_name,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tasks
FROM tasks;

-- ========================================
-- 2. 数据修复和维护
-- ========================================

-- 修复webhook表的creator字段
UPDATE webhooks 
SET creator = u.nickname
FROM users u
WHERE webhooks.user_id = u.id 
AND (webhooks.creator IS NULL OR webhooks.creator = '' OR webhooks.creator = '-');

-- 如果用户没有nickname，使用email
UPDATE webhooks 
SET creator = u.email
FROM users u
WHERE webhooks.user_id = u.id 
AND (webhooks.creator IS NULL OR webhooks.creator = '' OR webhooks.creator = '-')
AND u.nickname IS NULL;

-- 如果都没有，设置为'未知用户'
UPDATE webhooks 
SET creator = '未知用户'
WHERE creator IS NULL OR creator = '' OR creator = '-';

-- 修复分组表的creator字段
UPDATE groups 
SET creator = u.nickname
FROM users u
WHERE groups.user_id = u.id 
AND (groups.creator IS NULL OR groups.creator = '');

-- 如果用户没有nickname，使用email
UPDATE groups 
SET creator = u.email
FROM users u
WHERE groups.user_id = u.id 
AND (groups.creator IS NULL OR groups.creator = '')
AND u.nickname IS NULL;

-- 系统分组设置creator为'系统'
UPDATE groups 
SET creator = '系统'
WHERE user_id IS NULL 
AND (creator IS NULL OR creator = '');

-- 确保所有webhook都有分组关联
UPDATE webhooks 
SET group_id = (SELECT id FROM groups WHERE name = '未分组' LIMIT 1)
WHERE group_id IS NULL 
AND EXISTS (SELECT 1 FROM groups WHERE name = '未分组');

-- ========================================
-- 3. 系统分组管理
-- ========================================

-- 创建缺失的系统默认分组
INSERT INTO groups (name, description, color, sort_order, user_id, creator)
SELECT '全部', '系统默认分组，包含所有机器人地址', '#52c41a', 0, NULL, '系统'
WHERE NOT EXISTS (
    SELECT 1 FROM groups WHERE name = '全部'
);

INSERT INTO groups (name, description, color, sort_order, user_id, creator)
SELECT '未分组', '系统默认分组，包含未分配分组的机器人地址', '#faad14', 1, NULL, '系统'
WHERE NOT EXISTS (
    SELECT 1 FROM groups WHERE name = '未分组'
);

INSERT INTO groups (name, description, color, sort_order, user_id, creator)
SELECT '默认分组', '系统默认分组', '#1890ff', 2, NULL, '系统'
WHERE NOT EXISTS (
    SELECT 1 FROM groups WHERE name = '默认分组'
);

-- ========================================
-- 4. 数据清理
-- ========================================

-- 清理过期的任务执行结果（保留最近30天）
DELETE FROM tasks 
WHERE status IN ('completed', 'failed') 
AND updated_at < now() - interval '30 days';

-- 清理无效的webhook（状态为inactive且超过90天未更新）
DELETE FROM webhooks 
WHERE status = 'inactive' 
AND updated_at < now() - interval '90 days';

-- ========================================
-- 5. 性能优化
-- ========================================

-- 分析表统计信息
ANALYZE users;
ANALYZE user_roles;
ANALYZE groups;
ANALYZE webhooks;
ANALYZE tasks;

-- 清理表空间
VACUUM ANALYZE users;
VACUUM ANALYZE user_roles;
VACUUM ANALYZE groups;
VACUUM ANALYZE webhooks;
VACUUM ANALYZE tasks;

-- ========================================
-- 6. 最终验证报告
-- ========================================

SELECT 
    '=== 维护完成报告 ===' as report_header;

-- 用户统计
SELECT 
    '用户统计' as category,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
    COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admin,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as normal_user
FROM users;

-- 分组统计
SELECT 
    '分组统计' as category,
    COUNT(*) as total,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as system_groups,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_groups,
    STRING_AGG(CASE WHEN user_id IS NULL THEN name END, ', ') as system_group_names
FROM groups;

-- Webhook统计
SELECT 
    'Webhook统计' as category,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
    COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
    COUNT(CASE WHEN group_id IS NOT NULL THEN 1 END) as grouped,
    COUNT(CASE WHEN group_id IS NULL THEN 1 END) as ungrouped
FROM webhooks;

-- 任务统计
SELECT 
    '任务统计' as category,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN type = 'text_image' THEN 1 END) as text_image_tasks,
    COUNT(CASE WHEN type = 'rich_text' THEN 1 END) as rich_text_tasks,
    COUNT(CASE WHEN type = 'card' THEN 1 END) as card_tasks
FROM tasks;

-- 表大小检查
SELECT 
    '表大小检查' as check_type,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'groups', 'webhooks', 'tasks', 'user_roles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ========================================
-- 维护完成
-- ========================================

SELECT '✅ 数据库维护完成！' as status;
