# 推送机器人2.5版本 - 数据库结构文档

## 📊 数据库概述

- **数据库类型**: PostgreSQL 14+
- **托管服务**: Supabase
- **版本**: 1.0.0
- **最后更新**: 2025-08-29

## 🗂️ 核心表结构

### 1. 用户表 (users)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 用户唯一标识 | PRIMARY KEY |
| email | VARCHAR(255) | 用户邮箱 | UNIQUE, NOT NULL |
| nickname | VARCHAR(100) | 用户昵称 | |
| password | VARCHAR(255) | 加密密码 | NOT NULL |
| role | VARCHAR(50) | 用户角色 | DEFAULT 'user' |
| status | VARCHAR(20) | 用户状态 | DEFAULT 'active' |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT now() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT now() |

**角色类型**: `super_admin`, `admin`, `user`
**状态类型**: `active`, `inactive`

### 2. 用户角色表 (user_roles)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 记录唯一标识 | PRIMARY KEY |
| user_id | UUID | 用户ID | REFERENCES users(id) |
| role | VARCHAR(50) | 角色名称 | NOT NULL |
| is_active | BOOLEAN | 是否激活 | DEFAULT true |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT now() |

### 3. 分组表 (groups)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 分组唯一标识 | PRIMARY KEY |
| name | VARCHAR(100) | 分组名称 | UNIQUE, NOT NULL |
| description | TEXT | 分组描述 | |
| color | VARCHAR(7) | 分组颜色 | DEFAULT '#1890ff' |
| sort_order | INTEGER | 排序顺序 | DEFAULT 0 |
| user_id | UUID | 创建者ID | REFERENCES users(id) |
| creator | VARCHAR(100) | 创建人昵称 | |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT now() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT now() |

**系统默认分组**: `全部`, `未分组`, `默认分组`

### 4. Webhook表 (webhooks)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | Webhook唯一标识 | PRIMARY KEY |
| chat_name | VARCHAR(100) | 群聊名称 | NOT NULL |
| name | VARCHAR(100) | 机器人名称 | NOT NULL |
| webhook_url | TEXT | Webhook地址 | NOT NULL |
| group_id | UUID | 所属分组ID | REFERENCES groups(id) |
| status | VARCHAR(20) | 状态 | DEFAULT 'active' |
| user_id | UUID | 创建者ID | REFERENCES users(id) |
| creator | VARCHAR(100) | 创建人昵称 | |
| description | TEXT | 备注信息 | |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT now() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT now() |

**状态类型**: `active`, `inactive`

### 5. 任务表 (tasks)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 任务唯一标识 | PRIMARY KEY |
| title | VARCHAR(200) | 任务标题 | NOT NULL |
| type | VARCHAR(50) | 消息类型 | NOT NULL |
| content | JSONB | 消息内容 | NOT NULL |
| scheduled_time | TIMESTAMPTZ | 计划执行时间 | |
| status | VARCHAR(20) | 任务状态 | DEFAULT 'pending' |
| user_id | UUID | 创建者ID | REFERENCES users(id) |
| creator | VARCHAR(100) | 创建人昵称 | |
| group_category | TEXT[] | 目标分组 | |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT now() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT now() |
| completed_at | TIMESTAMPTZ | 完成时间 | |
| failed_at | TIMESTAMPTZ | 失败时间 | |
| execution_result | JSONB | 执行结果 | |

**消息类型**: `text_image`, `rich_text`, `card`
**任务状态**: `pending`, `completed`, `failed`, `cancelled`

### 6. 图片上传表 (image_uploads)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | UUID | 图片唯一标识 | PRIMARY KEY |
| user_id | UUID | 用户ID | REFERENCES users(id) |
| filename | VARCHAR(255) | 存储文件名 | NOT NULL |
| original_name | VARCHAR(255) | 原始文件名 | NOT NULL |
| file_size | BIGINT | 文件大小(字节) | NOT NULL |
| mime_type | VARCHAR(100) | MIME类型 | NOT NULL |
| storage_path | TEXT | 存储路径 | NOT NULL |
| public_url | TEXT | 公开访问URL | NOT NULL |
| width | INTEGER | 图片宽度 | |
| height | INTEGER | 图片高度 | |
| created_at | TIMESTAMPTZ | 创建时间 | DEFAULT now() |
| updated_at | TIMESTAMPTZ | 更新时间 | DEFAULT now() |
| is_active | BOOLEAN | 是否激活 | DEFAULT true |

**支持格式**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/bmp`

## 🔐 安全策略

### 行级安全策略 (RLS)

所有表都启用了行级安全策略，确保：
- 用户只能访问自己的数据
- 管理员可以访问所有数据
- 系统分组对所有用户可见

### 权限控制

- **普通用户**: 只能管理自己的webhook、分组和任务
- **管理员**: 可以管理所有用户的数据
- **超级管理员**: 拥有系统最高权限

## 📈 性能优化

### 索引策略

- 主键自动索引
- 外键字段索引
- 常用查询字段索引
- 状态字段索引

### 查询优化

- 使用适当的WHERE条件
- 避免SELECT *
- 合理使用LIMIT
- 并行查询优化

## 🧹 数据维护

### 定期清理

- 删除已取消的任务
- 清理过期的执行结果
- 归档历史数据

### 数据备份

- 每日自动备份
- 重要操作前手动备份
- 版本升级前完整备份

## 📝 使用建议

1. **创建webhook时**: 必须选择分组，建议填写备注
2. **任务管理**: 定期清理已完成的任务
3. **用户管理**: 及时更新用户状态和角色
4. **分组管理**: 合理组织webhook分组，便于管理

## 🔧 维护脚本

- `cleanup_and_organize.sql`: 数据整理和优化
- `fix_webhook_creator.sql`: 修复创建人字段
- `create_missing_groups.sql`: 创建缺失的系统分组
- `check_and_restore_groups.sql`: 检查和恢复分组

---

*最后更新: 2025-08-29*
*维护者: 系统管理员*
