# 智能营销工具 - 项目文件结构

## 📁 项目根目录

```
智能营销工具1.0/
├── 📄 配置文件
│   ├── .env.local                    # 环境变量配置（包含Supabase密钥）
│   ├── .env.local.template           # 环境变量模板
│   ├── .gitignore                    # Git忽略文件配置
│   ├── package.json                  # 项目依赖配置
│   ├── package-lock.json             # 依赖锁定文件
│   ├── vite.config.js                # Vite构建配置
│   └── config.js                     # 应用配置文件
│
├── 📝 文档文件
│   ├── README.md                     # 项目说明文档
│   ├── FIX_IMAGE_UPLOAD.md          # 图片上传问题修复指南
│   └── PROJECT_STRUCTURE.md         # 项目文件结构说明（本文件）
│
├── 🗄️ 数据库脚本 (database/)
│   ├── init_database.sql            # 数据库初始化脚本
│   ├── add_image_uploads_table.sql  # 图片上传表创建脚本
│   ├── ai_knowledge_tables.sql      # AI知识库表创建脚本
│   ├── database_structure.md        # 数据库结构说明
│   ├── fix_all_rls_issues.sql       # 一键修复所有RLS问题（推荐）
│   ├── fix_storage_rls.sql          # 修复Storage权限策略
│   ├── disable_image_uploads_rls.sql # 禁用image_uploads表RLS
│   ├── create_image_upload_function.sql # 图片上传函数
│   ├── fix_image_uploads_rls.sql    # 修复图片上传RLS策略
│   ├── fix_ai_conversations_simple.sql # 修复AI对话表RLS
│   ├── fix_rls_final.sql            # 最终RLS修复脚本
│   └── maintenance_scripts.sql      # 数据库维护脚本
│
├── 📚 文档目录 (docs/)
│   └── AI_用户帮助中心.md            # AI用户帮助文档
│
├── 🌐 前端源代码 (src/)
│   ├── pages/                       # 页面组件
│   │   ├── Dashboard.jsx            # 仪表板
│   │   ├── MessageEditor.jsx        # 消息编辑器
│   │   ├── MessageTemplate.jsx      # 消息模板
│   │   ├── ImageTools.jsx           # 图片URL工具
│   │   ├── AIAssistant.jsx          # AI助手
│   │   ├── HelpCenter.jsx           # 帮助中心
│   │   └── Settings.jsx             # 设置页面
│   │
│   ├── components/                  # 通用组件
│   │   ├── Auth/                    # 认证组件
│   │   │   ├── Login.jsx           # 登录组件
│   │   │   └── Register.jsx        # 注册组件
│   │   │
│   │   ├── ImageUpload/            # 图片上传相关组件
│   │   │   ├── ImageUpload.jsx     # 图片上传主组件
│   │   │   ├── ImagePreview.jsx    # 图片预览组件
│   │   │   ├── ImageHistory.jsx    # 图片历史记录
│   │   │   └── LinkManager.jsx     # 链接管理组件
│   │   │
│   │   ├── Layout/                 # 布局组件
│   │   │   ├── MainLayout.jsx      # 主布局
│   │   │   └── Sidebar.jsx         # 侧边栏
│   │   │
│   │   ├── AIChatBot.jsx           # AI聊天机器人
│   │   └── ThemeToggle.jsx         # 主题切换组件
│   │
│   ├── contexts/                   # React上下文
│   │   ├── AuthContext.jsx         # 认证上下文
│   │   └── ThemeContext.jsx        # 主题上下文
│   │
│   └── utils/                      # 工具函数
│       └── helpers.js              # 辅助函数
│
├── 🎨 样式文件
│   ├── App.css                     # 应用主样式
│   ├── index.css                   # 全局样式
│   └── main.jsx                    # 应用入口文件
│
├── 🔧 后端服务
│   ├── server.js                   # Node.js后端服务（Express）
│   └── supabaseClient.js           # Supabase客户端配置
│
├── 🌍 公共资源 (public/)
│   ├── images/                     # 图片资源
│   │   └── ai-robot-icon.png      # AI机器人图标
│   └── favicon.ico                 # 网站图标
│
├── 📦 上传文件存储 (uploads/)
│   └── [user_id]/                  # 按用户ID组织的上传文件
│
├── 🏗️ 构建输出 (dist/)
│   └── [生产环境构建文件]           # npm run build 输出
│
└── 📦 依赖模块 (node_modules/)
    └── [Node.js依赖包]              # npm install 安装的包
```

## 🔑 核心文件说明

### 后端服务 (server.js)
- **功能**：
  - 企业微信Webhook中转服务
  - 图片上传API（支持中文文件名）
  - 消息推送API
  - 定时任务管理
  - AI助手API代理

### 前端入口 (main.jsx)
- **功能**：
  - React应用初始化
  - 路由配置
  - 全局状态管理

### 应用主组件 (App.jsx)
- **功能**：
  - 应用路由管理
  - 页面布局
  - 认证状态管理

### Supabase客户端 (supabaseClient.js)
- **功能**：
  - Supabase数据库连接
  - 认证服务配置
  - Storage配置

## 📊 数据库表结构

### 主要数据表
1. **users** - 用户表
2. **user_roles** - 用户角色表
3. **scheduled_messages** - 定时消息表
4. **message_templates** - 消息模板表
5. **image_uploads** - 图片上传记录表
6. **ai_knowledge_base** - AI知识库表
7. **ai_conversations** - AI对话记录表
8. **ai_conversation_messages** - AI对话消息表

详细表结构请参考：`database/database_structure.md`

## 🚀 启动命令

### 开发环境
```bash
# 启动后端服务
npm run dev:backend

# 启动前端服务
npm run dev:frontend

# 同时启动前后端
npm run dev
```

### 生产环境
```bash
# 构建生产版本
npm run build

# 启动生产服务
npm start
```

## 📝 配置文件说明

### .env.local
包含敏感配置信息：
- `VITE_SUPABASE_URL` - Supabase项目URL
- `VITE_SUPABASE_ANON_KEY` - Supabase匿名密钥
- `VITE_SUPABASE_SERVICE_KEY` - Supabase服务密钥
- `VITE_WEBHOOK_URL` - 企业微信Webhook地址
- `VITE_ZHIPU_API_KEY` - 智谱AI API密钥

### package.json
关键依赖：
- **前端框架**：React 18.3.1
- **构建工具**：Vite 5.4.20
- **UI组件库**：Ant Design 5.21.2
- **后端框架**：Express 4.21.0
- **数据库**：@supabase/supabase-js 2.45.4
- **图片处理**：sharp 0.33.5
- **文件上传**：multer 1.4.5-lts.1
- **定时任务**：node-cron 3.0.3

## 🔐 权限管理

### RLS (Row Level Security) 策略
- **image_uploads表**：RLS已禁用，允许所有用户上传
- **Storage策略**：已配置允许所有用户访问smart-message-images bucket

详细修复指南请参考：`FIX_IMAGE_UPLOAD.md`

## 📌 重要特性

### 1. 图片上传功能
- ✅ 支持中文文件名
- ✅ 自动压缩超过1MB的图片
- ✅ 生成多种格式的链接（直链、HTML、Markdown）
- ✅ 历史记录管理
- ✅ 批量操作支持

### 2. AI助手功能
- ✅ 智谱AI集成
- ✅ 对话历史管理
- ✅ 知识库支持
- ✅ 上下文记忆

### 3. 消息推送功能
- ✅ 企业微信Webhook集成
- ✅ 定时推送
- ✅ 消息模板管理
- ✅ 图文消息支持

### 4. 主题系统
- ✅ 明暗主题切换
- ✅ 主题持久化
- ✅ 全局主题状态管理

## 🛠️ 开发工具

### 推荐的IDE插件
- ESLint - 代码规范检查
- Prettier - 代码格式化
- Vite - 快速开发服务器

## 📦 部署说明

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 部署步骤
1. 克隆项目
2. 复制 `.env.local.template` 为 `.env.local` 并填入配置
3. 运行 `npm install` 安装依赖
4. 在Supabase中执行数据库初始化脚本
5. 运行 `npm run build` 构建生产版本
6. 运行 `npm start` 启动服务

## 🔄 版本信息

- **当前版本**：1.0.0
- **最后更新**：2025年10月11日
- **Node.js版本**：18.x
- **React版本**：18.3.1

## 📞 支持

如有问题，请参考：
- `README.md` - 项目基本说明
- `FIX_IMAGE_UPLOAD.md` - 图片上传问题修复
- `docs/AI_用户帮助中心.md` - AI功能使用指南
- `database/database_structure.md` - 数据库结构说明
