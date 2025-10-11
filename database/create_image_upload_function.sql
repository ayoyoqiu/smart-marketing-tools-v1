-- 创建图片上传插入函数，绕过RLS限制
-- 这个函数将作为SECURITY DEFINER运行，可以绕过RLS策略

-- ========================================
-- 1. 创建插入图片上传的函数
-- ========================================

CREATE OR REPLACE FUNCTION insert_image_upload(
    p_user_id UUID,
    p_filename VARCHAR(255),
    p_original_name VARCHAR(255),
    p_file_size BIGINT,
    p_mime_type VARCHAR(100),
    p_storage_path TEXT,
    p_public_url TEXT,
    p_width INTEGER DEFAULT NULL,
    p_height INTEGER DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    filename VARCHAR(255),
    original_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    storage_path TEXT,
    public_url TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER  -- 以函数定义者的权限运行，绕过RLS
AS $$
BEGIN
    -- 插入图片上传记录
    INSERT INTO image_uploads (
        user_id,
        filename,
        original_name,
        file_size,
        mime_type,
        storage_path,
        public_url,
        width,
        height,
        is_active
    ) VALUES (
        p_user_id,
        p_filename,
        p_original_name,
        p_file_size,
        p_mime_type,
        p_storage_path,
        p_public_url,
        p_width,
        p_height,
        true
    );
    
    -- 返回插入的记录
    RETURN QUERY
    SELECT 
        iu.id,
        iu.user_id,
        iu.filename,
        iu.original_name,
        iu.file_size,
        iu.mime_type,
        iu.storage_path,
        iu.public_url,
        iu.width,
        iu.height,
        iu.created_at,
        iu.updated_at,
        iu.is_active
    FROM image_uploads iu
    WHERE iu.user_id = p_user_id
    AND iu.filename = p_filename
    ORDER BY iu.created_at DESC
    LIMIT 1;
END;
$$;

-- ========================================
-- 2. 设置函数权限
-- ========================================

-- 允许匿名用户调用此函数
GRANT EXECUTE ON FUNCTION insert_image_upload TO anon;
GRANT EXECUTE ON FUNCTION insert_image_upload TO authenticated;

-- ========================================
-- 3. 验证函数创建
-- ========================================

SELECT 
    '函数创建验证' as check_type,
    routine_name,
    routine_type,
    security_type,
    is_deterministic
FROM information_schema.routines 
WHERE routine_name = 'insert_image_upload'
AND routine_schema = 'public';

-- ========================================
-- 4. 测试函数（可选）
-- ========================================

-- 测试函数是否可以正常调用
-- SELECT * FROM insert_image_upload(
--     '00000000-0000-0000-0000-000000000000'::UUID,
--     'test.png',
--     'test.png',
--     1024,
--     'image/png',
--     'test/path',
--     'https://example.com/test.png',
--     100,
--     100
-- );

-- ========================================
-- 创建完成
-- ========================================

SELECT '✅ 图片上传函数创建完成！' as status;
