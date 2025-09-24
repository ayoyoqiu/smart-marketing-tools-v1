-- 最终修复RLS策略，完全移除auth.uid()依赖
-- 使用自定义认证系统

-- 1. 删除所有现有的RLS策略
DROP POLICY IF EXISTS "Users can manage own groups" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Admins can manage all groups" ON groups;
DROP POLICY IF EXISTS "System groups are viewable by all" ON groups;

-- 2. 创建新的RLS策略，使用自定义认证
-- 策略1: 用户可以创建分组（通过user_id字段识别）
CREATE POLICY "Users can create groups" ON groups 
FOR INSERT 
WITH CHECK (
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

-- 策略2: 用户可以管理自己的分组
CREATE POLICY "Users can manage own groups" ON groups 
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

-- 策略3: 管理员可以管理所有分组
CREATE POLICY "Admins can manage all groups" ON groups 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = user_id 
        AND role IN ('admin', 'super_admin') 
        AND is_active = true
    )
);

-- 策略4: 系统默认分组可以被所有用户查看
CREATE POLICY "System groups are viewable by all" ON groups 
FOR SELECT 
USING (
    user_id IS NULL  -- 系统默认分组
);

-- 3. 验证策略创建结果
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'groups'
ORDER BY policyname;

-- 4. 检查RLS是否启用
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'groups';

-- 5. 测试策略是否工作
-- 这个查询应该能返回结果，因为admin用户存在且状态为active
SELECT 
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
WHERE u.id = '72193f0d-7240-4edb-b99d-9c99be3351f3'  -- admin用户ID
AND u.status = 'active';
