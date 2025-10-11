-- 完全禁用 image_uploads 表的 RLS 策略
-- 这样所有用户（包括匿名用户）都可以正常插入和查询数据

-- 1. 禁用 RLS
ALTER TABLE image_uploads DISABLE ROW LEVEL SECURITY;

-- 2. 验证 RLS 状态
SELECT 
    tablename,
    rowsecurity as "RLS已禁用"
FROM pg_tables 
WHERE tablename = 'image_uploads';

-- 3. 显示结果
SELECT '✅ image_uploads 表的 RLS 已禁用，所有用户都可以正常使用图片上传功能！' as status;
