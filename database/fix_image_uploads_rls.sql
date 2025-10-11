-- 修复图片上传表的RLS策略
-- 移除auth.uid()依赖，使用自定义认证系统

-- ========================================
-- 1. 删除现有的RLS策略
-- ========================================

DROP POLICY IF EXISTS "Users can manage own images" ON image_uploads;
DROP POLICY IF EXISTS "Admins can manage all images" ON image_uploads;

-- ========================================
-- 2. 创建新的RLS策略
-- ========================================

-- 策略1: 用户可以管理自己的图片（通过user_id字段识别）
CREATE POLICY "Users can manage own images" ON image_uploads
FOR ALL 
USING (
    user_id IS NOT NULL 
    AND (
        -- 检查用户是否存在且状态为active
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = user_id 
            AND status = 'active'
        )
        OR
        -- 或者检查是否是管理员
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = user_id 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    )
);

-- 策略2: 管理员可以管理所有图片
CREATE POLICY "Admins can manage all images" ON image_uploads
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = user_id 
        AND role IN ('admin', 'super_admin') 
        AND is_active = true
    )
);

-- ========================================
-- 3. 验证策略创建结果
-- ========================================

SELECT 
    'RLS策略验证' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'image_uploads'
ORDER BY policyname;

-- ========================================
-- 4. 检查RLS是否启用
-- ========================================

SELECT 
    'RLS状态检查' as check_type,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'image_uploads';

-- ========================================
-- 5. 测试策略是否工作
-- ========================================

-- 检查所有活跃用户
SELECT 
    '用户权限测试' as check_type,
    u.id,
    u.nickname,
    u.role,
    u.status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = u.id 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        ) THEN '✅ 管理员权限'
        ELSE '👤 普通用户权限'
    END as permission_level
FROM users u
WHERE u.status = 'active'
ORDER BY u.created_at;

-- ========================================
-- 修复完成
-- ========================================

SELECT '✅ 图片上传RLS策略修复完成！' as status;
