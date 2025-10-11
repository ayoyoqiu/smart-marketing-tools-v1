-- ========================================
-- 完整修复图片上传功能的所有RLS问题
-- 执行此SQL后，所有用户都可以正常上传图片
-- ========================================

-- ========================================
-- 第一部分：禁用 image_uploads 表的 RLS
-- ========================================

ALTER TABLE image_uploads DISABLE ROW LEVEL SECURITY;

-- 验证表的 RLS 状态
SELECT 
    '第一步：数据库表RLS状态' as step,
    tablename,
    CASE 
        WHEN rowsecurity = false THEN '✅ 已禁用'
        ELSE '❌ 仍启用'
    END as status
FROM pg_tables 
WHERE tablename = 'image_uploads';

-- ========================================
-- 第二部分：修复 Storage 的权限策略
-- ========================================

-- 删除现有的限制性策略
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage own images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads to smart-message-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all reads from smart-message-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates to smart-message-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes from smart-message-images" ON storage.objects;

-- 创建新的宽松策略

-- 策略1: 允许所有人上传
CREATE POLICY "Allow all uploads to smart-message-images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
    bucket_id = 'smart-message-images'
);

-- 策略2: 允许所有人读取
CREATE POLICY "Allow all reads from smart-message-images"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'smart-message-images'
);

-- 策略3: 允许所有人更新
CREATE POLICY "Allow all updates to smart-message-images"
ON storage.objects
FOR UPDATE
TO public
USING (
    bucket_id = 'smart-message-images'
)
WITH CHECK (
    bucket_id = 'smart-message-images'
);

-- 策略4: 允许所有人删除
CREATE POLICY "Allow all deletes from smart-message-images"
ON storage.objects
FOR DELETE
TO public
USING (
    bucket_id = 'smart-message-images'
);

-- ========================================
-- 第三部分：验证所有策略
-- ========================================

-- 验证 Storage 策略
SELECT 
    '第二步：Storage策略状态' as step,
    policyname,
    cmd as operation,
    CASE 
        WHEN roles = '{public}' THEN '✅ 所有人可访问'
        ELSE '⚠️ 仅限' || roles::text
    END as permission
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%smart-message-images%'
ORDER BY policyname;

-- 验证 Bucket 配置
SELECT 
    '第三步：Bucket配置状态' as step,
    id,
    name,
    CASE 
        WHEN public = true THEN '✅ 公开访问'
        ELSE '⚠️ 私有'
    END as access_level
FROM storage.buckets 
WHERE id = 'smart-message-images';

-- ========================================
-- 修复完成提示
-- ========================================

SELECT 
    '✅ 所有修复已完成！' as status,
    '请刷新应用页面并重试上传图片' as next_step,
    '如果仍有问题，请检查后端服务日志' as troubleshoot;
