# 修复图片上传功能的RLS权限问题

## 问题描述
普通用户无法使用图片上传功能，出现 "new row violates row-level security policy" 错误。

## 原因
Supabase 数据库的 `image_uploads` 表启用了行级安全策略（RLS），阻止了匿名用户插入数据。

## 解决方案

### 方法1：在 Supabase Dashboard 中执行 SQL（推荐）

1. **登录 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择你的项目：`wechat-push-bot-2.5`

2. **进入 SQL Editor**
   - 在左侧菜单中点击 "SQL Editor"
   - 点击 "New Query" 创建新查询

3. **第一步：禁用 image_uploads 表的 RLS（已完成✅）**
   ```sql
   -- 禁用 image_uploads 表的 RLS
   ALTER TABLE image_uploads DISABLE ROW LEVEL SECURITY;

   -- 验证 RLS 状态（应该显示 rowsecurity = false）
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'image_uploads';
   ```

4. **第二步：修复 Storage 权限策略（重要！这是解决当前错误的关键）**
   
   继续在同一个SQL编辑器中执行以下SQL：
   
   ```sql
   -- 删除现有的限制性策略
   DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
   DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
   DROP POLICY IF EXISTS "Users can manage own images" ON storage.objects;

   -- 创建允许所有人上传的策略
   CREATE POLICY "Allow all uploads to smart-message-images"
   ON storage.objects
   FOR INSERT
   TO public
   WITH CHECK (
       bucket_id = 'smart-message-images'
   );

   -- 创建允许所有人读取的策略
   CREATE POLICY "Allow all reads from smart-message-images"
   ON storage.objects
   FOR SELECT
   TO public
   USING (
       bucket_id = 'smart-message-images'
   );

   -- 创建允许所有人更新的策略
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

   -- 创建允许所有人删除的策略
   CREATE POLICY "Allow all deletes from smart-message-images"
   ON storage.objects
   FOR DELETE
   TO public
   USING (
       bucket_id = 'smart-message-images'
   );

   -- 验证策略创建结果
   SELECT 
       policyname,
       cmd,
       roles
   FROM pg_policies 
   WHERE schemaname = 'storage' 
   AND tablename = 'objects'
   AND policyname LIKE '%smart-message-images%'
   ORDER BY policyname;
   ```

5. **点击 "Run" 执行查询**

6. **刷新应用页面并重试上传**

### 方法2：一键修复（推荐！最简单）

使用综合修复SQL文件：`database/fix_all_rls_issues.sql`

这个文件包含了所有必要的修复步骤，只需执行一次即可！

**操作步骤：**
1. 打开 `database/fix_all_rls_issues.sql` 文件
2. 复制全部内容
3. 在 Supabase SQL Editor 中粘贴并执行
4. 查看执行结果，应该显示三个步骤都是 ✅ 状态
5. 刷新应用页面并重试上传

### 方法3：分步执行

如果需要分步执行，可以使用这两个文件：

1. **第一步**：`database/disable_image_uploads_rls.sql` - 禁用数据库表的RLS
2. **第二步**：`database/fix_storage_rls.sql` - 修复Storage权限策略

在 Supabase SQL Editor 中依次执行这两个文件的内容。

## 验证修复

修复完成后，你应该能够：

1. ✅ 普通用户可以上传图片
2. ✅ 管理员用户可以上传图片
3. ✅ 上传后可以看到图片URL
4. ✅ 可以在"历史图库"中查看已上传的图片
5. ✅ 可以复制各种格式的图片链接（直链、HTML、Markdown）

## 测试步骤

1. 登录任意用户账号（包括新注册的用户）
2. 进入 "图片转URL" 页面
3. 点击或拖拽上传一张图片
4. 等待上传完成
5. 查看是否显示图片URL和相关操作按钮
6. 尝试复制不同格式的链接

## 注意事项

- 禁用 RLS 后，所有用户都可以查看和插入 `image_uploads` 表的数据
- 后端代码已经实现了用户级别的权限控制（通过 `user_id` 字段）
- 前端只会显示当前登录用户上传的图片
- 如果需要更严格的安全控制，可以在后续实现自定义的 RLS 策略

## 其他说明

### 当前的权限模型

```
数据库层面：RLS 已禁用（允许所有操作）
        ↓
应用层面：后端 API 验证用户身份
        ↓
前端层面：只显示当前用户的图片
```

### 图片存储位置

- **Storage**: Supabase Storage (`smart-message-images` bucket)
- **Database**: `image_uploads` 表（存储元数据和URL）

### 支持的图片格式

- JPG / JPEG
- PNG
- GIF
- WEBP
- BMP

### 图片大小限制

- 单张图片无大小限制
- 系统会自动压缩超过1MB的图片（用于企业微信推送）

## 故障排查

如果问题仍然存在：

1. **检查后端日志**
   ```bash
   # 查看后端服务日志
   npm run dev:backend
   ```

2. **检查 Storage 权限**
   - 进入 Supabase Dashboard
   - Storage → Policies
   - 确保 `smart-message-images` bucket 有适当的权限策略

3. **检查数据库连接**
   ```bash
   # 测试数据库连接
   curl http://localhost:3001/api/check-rls-status
   ```

4. **清除浏览器缓存**
   - 按 Ctrl+Shift+R (Windows/Linux)
   - 按 Cmd+Shift+R (Mac)

## 联系支持

如果以上方法都无法解决问题，请提供：
- 具体的错误信息
- 浏览器控制台的错误日志
- 后端服务的日志输出
