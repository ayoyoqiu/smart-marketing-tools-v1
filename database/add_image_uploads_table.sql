-- 图片上传功能数据库表结构
-- 创建时间: 2025-09-22
-- 用途: 支持图片上传和URL生成功能

-- ========================================
-- 1. 创建图片上传表
-- ========================================

CREATE TABLE IF NOT EXISTS image_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    filename VARCHAR(255) NOT NULL,                    -- 存储文件名
    original_name VARCHAR(255) NOT NULL,               -- 原始文件名
    file_size BIGINT NOT NULL,                         -- 文件大小(字节)
    mime_type VARCHAR(100) NOT NULL,                   -- MIME类型
    storage_path TEXT NOT NULL,                        -- 存储路径
    public_url TEXT NOT NULL,                          -- 公开访问URL
    width INTEGER,                                     -- 图片宽度
    height INTEGER,                                    -- 图片高度
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- ========================================
-- 2. 创建索引
-- ========================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_image_uploads_user_id ON image_uploads(user_id);

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_image_uploads_created_at ON image_uploads(created_at);

-- 活跃状态索引
CREATE INDEX IF NOT EXISTS idx_image_uploads_is_active ON image_uploads(is_active);

-- 文件类型索引
CREATE INDEX IF NOT EXISTS idx_image_uploads_mime_type ON image_uploads(mime_type);

-- ========================================
-- 3. 启用行级安全策略 (RLS)
-- ========================================

ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. 创建RLS策略
-- ========================================

-- 用户只能管理自己的图片
CREATE POLICY "Users can manage own images" ON image_uploads
    FOR ALL USING (auth.uid() = user_id);

-- 管理员可以管理所有图片
CREATE POLICY "Admins can manage all images" ON image_uploads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin') 
            AND is_active = true
        )
    );

-- ========================================
-- 5. 创建触发器
-- ========================================

-- 为image_uploads表创建更新时间戳触发器
CREATE TRIGGER update_image_uploads_updated_at BEFORE UPDATE ON image_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. 验证创建结果
-- ========================================

-- 检查表创建结果
SELECT 
    '图片上传表创建验证' as check_type,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'image_uploads';

-- 检查索引创建结果
SELECT 
    '索引创建验证' as check_type,
    COUNT(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'image_uploads';

-- 检查RLS策略
SELECT 
    'RLS策略验证' as check_type,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'image_uploads';

-- ========================================
-- 创建完成
-- ========================================

SELECT '✅ 图片上传表结构创建完成！' as status;
