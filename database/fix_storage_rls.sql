-- 修复 Supabase Storage 的权限问题
-- 为 smart-message-images bucket 创建允许所有操作的策略

-- ========================================
-- 1. 删除现有的限制性策略（如果存在）
-- ========================================

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage own images" ON storage.objects;

-- ========================================
-- 2. 创建新的宽松策略 - 允许所有人上传
-- ========================================

-- 策略1: 允许所有人（包括匿名用户）上传到 smart-message-images bucket
CREATE POLICY "Allow all uploads to smart-message-images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
    bucket_id = 'smart-message-images'
);

-- 策略2: 允许所有人（包括匿名用户）读取 smart-message-images bucket 的文件
CREATE POLICY "Allow all reads from smart-message-images"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'smart-message-images'
);

-- 策略3: 允许所有人（包括匿名用户）更新 smart-message-images bucket 的文件
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

-- 策略4: 允许所有人（包括匿名用户）删除 smart-message-images bucket 的文件
CREATE POLICY "Allow all deletes from smart-message-images"
ON storage.objects
FOR DELETE
TO public
USING (
    bucket_id = 'smart-message-images'
);

-- ========================================
-- 3. 验证策略创建结果
-- ========================================

SELECT 
    'Storage策略验证' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%smart-message-images%'
ORDER BY policyname;

-- ========================================
-- 4. 确认 bucket 存在且配置正确
-- ========================================

SELECT 
    'Bucket配置检查' as check_type,
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE id = 'smart-message-images';

-- ========================================
-- 创建完成
-- ========================================

SELECT '✅ Storage 权限策略已创建！所有用户都可以上传图片了！' as status;
