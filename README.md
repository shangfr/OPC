# OPC Bot

基于 Next.js 16 + AI SDK 构建的智能对话平台，面向"一人公司"(OPC) 场景，支持多模型切换、OPC Agent 管理与分类、站点配置、实时流式响应等企业级功能。

## 功能特性

### 核心对话
- **多模型支持** — 内置 DeepSeek V4 Flash 与智谱 GLM-4.1V 两款模型，可扩展更多厂商（OpenAI 兼容协议）
- **流式响应** — 实时流式输出 AI 回复，支持中途停止并持久化停止标记，支持断流自动恢复
- **思考模式** — 推理模型支持 thinking/reasoning 可视化展示，可开关并降级为普通生成
- **消息编辑与重生成** — 可编辑历史消息并重新生成回复
- **附件上传** — 支持图片、PDF、文本等多种文件格式，Vercel Blob 存储
- **流式 Markdown** — 基于 streamdown 的流式渲染，支持 CJK 字符、代码块、数学公式、Mermaid 图表

### OPC Agent 系统
- **双视图模式** — 管理员使用 CRUD 管理面板（创建/编辑/启停/排序），普通用户浏览卡片选择界面
- **分类管理** — 7 个业务域分类（法律合规、财税资本、核心战略、产业政策、AI与数字化、OPC孵化、三大平台），支持分类颜色和排序
- **预置 Agent** — 内置 21 个领域专属 Agent，每个配有详细的角色定义系统提示词和预设问题
- **颜色主题** — 10 套配色方案（indigo/amber/emerald/violet 等），分类卡片自动匹配颜色标识
- **站点配置** — SiteConfig 单例表存储全局默认提示词、预设问题、站点名称和描述，通过管理 UI 可编辑
- **延迟持久化** — 新建对话仅在发送第一条消息时写入数据库，避免空会话
- **Agent 名称冗余** — Chat 表冗余存储 agentName，避免 JOIN 查询，Agent 改名不影响历史对话

### 账户管理
- **注册/登录** — 邮箱+密码认证，Auth.js v5 管理会话
- **访客模式** — 未注册用户可体验基础功能
- **密码找回** — 基于令牌的密码重置流程（1 小时有效期，一次性使用）

### 性能优化
- **内存消息缓存** — 模块级 Map 缓存，SPA 导航切聊天零延迟，刷新后由 SWR 重新拉取
- **SWR 数据获取** — Agent/Model/Document/SiteConfig 全部使用 SWR，共享跨页面缓存（60s 去重）
- **Context 分层** — ActiveChatProvider 拆分为 state + actions 双 Context，减少不必要的重渲染
- **hover 预加载** — 鼠标悬停历史记录项时预取消息
- **虚拟滚动** — 30+ 条消息自动启用虚拟渲染，保持流畅
- **懒加载编辑器** — CodeMirror/ProseMirror 通过 next/dynamic 按需加载，减轻首屏编译负担
- **轻量 Shiki** — 使用 `shiki/bundle/web`（~40 语言）替代全量包（200+ 语言）
- **历史列表乐观更新** — 发送消息立即显示在侧边栏，无需等待 AI 回复
- **离线感知** — 网络断开时显示提示横幅

### 其他
- **暗色模式** — 跟随系统主题自动切换
- **聊天可见性** — 支持私密/公开切换
- **消息投票** — 对 AI 回复进行 👍/👎 评价
- **代码高亮** — Shiki 语法高亮，支持多种语言
- **数学公式** — KaTeX 渲染支持
- **Mermaid 图表** — 支持流程图、时序图等
- **Artifact 系统** — 支持代码、HTML、文本、表格(Sheet)、图片五种 Artifact 类型

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16.2.0 + Turbopack |
| 语言 | TypeScript 5.x |
| UI | React 19 + shadcn/ui (Radix) + Tailwind CSS 4 |
| AI | AI SDK 6.x (`@ai-sdk/react`) + `@ai-sdk/openai-compatible` |
| 数据获取 | SWR 2.x（缓存去重）|
| UI 状态 | React Context（双层 Provider 架构）|
| 数据库 | PostgreSQL (Neon) + Drizzle ORM |
| 认证 | Auth.js v5 (next-auth beta 25) |
| 动画 | Motion 12.x |
| 虚拟滚动 | @tanstack/react-virtual |
| 编辑器 | CodeMirror 6 + ProseMirror（懒加载）|
| 流式渲染 | streamdown（CJK + code + math + mermaid）|
| 文件存储 | Vercel Blob |
| 限流 | Redis |
| 代码规范 | Biome + Ultracite |
| 测试 | Playwright (E2E) |
| 包管理 | pnpm 10.x |

## 数据库设计

基于 Drizzle ORM 管理，共 11 张表：

| 表名 | 说明 |
|------|------|
| User | 用户（邮箱、密码、匿名标记）|
| Chat | 对话（标题、可见性、agentId、agentName 冗余）|
| Message_v2 | 消息（角色、JSON parts、附件）|
| Vote_v2 | 投票（chatId + messageId 复合主键）|
| Document | Artifact 文档（text/code/html/sheet/image）|
| Suggestion | 文档修改建议 |
| Stream | 可恢复流（resumable-stream）|
| Agent | OPC Agent（提示词、预设问题、分类、排序）|
| Category | Agent 分类（名称、颜色、排序、colorKey）|
| SiteConfig | 站点配置（单例，全局默认值）|
| PasswordResetToken | 密码重置令牌（1小时有效，一次性）|

大部分外键设置 `ON DELETE CASCADE`，Chat.agentId 和 Agent.categoryId 设置 `ON DELETE SET NULL`（删除 Agent/分类时保留对话记录）。Chat 和 Message 表建有索引，User.email 设有唯一索引。

## 项目结构

```
opcbot/
├── app/
│   ├── (auth)/              # 认证模块
│   │   ├── login/           # 登录页
│   │   ├── register/        # 注册页
│   │   ├── forgot-password/ # 密码找回
│   │   ├── reset-password/  # 密码重置
│   │   └── api/auth/        # NextAuth + 访客 + 密码重置 API
│   └── (chat)/              # 聊天模块
│       ├── agents/          # OPC 管理页面
│       │   ├── agent-manager.tsx   # 管理员 CRUD 面板
│       │   ├── agent-cards.tsx     # 用户卡片选择
│       │   ├── opc-shared.tsx      # 共享组件和 Hooks
│       │   ├── category-manager-dialog.tsx
│       │   ├── group-manager-dialog.tsx
│       │   ├── site-config-dialog.tsx
│       │   └── stats-dialog.tsx
│       ├── api/             # API 路由
│       │   ├── chat/        # 对话（创建、流式、schema）
│       │   ├── history/     # 聊天历史列表
│       │   ├── messages/    # 消息 CRUD
│       │   ├── agents/      # Agent CRUD
│       │   ├── categories/  # 分类 CRUD
│       │   ├── site-config/ # 站点配置
│       │   ├── models/      # 模型列表
│       │   ├── vote/        # 投票
│       │   ├── document/    # Artifact 文档
│       │   ├── files/       # 文件上传
│       │   ├── suggestions/ # 建议
│       │   └── stats/       # 统计
│       └── chat/            # 聊天页面
├── components/
│   ├── ai-elements/         # AI 基础 UI（消息、代码块、推理、模型选择器）
│   ├── chat/                # 聊天功能组件（40+ 组件）
│   └── ui/                  # shadcn/ui 基础组件
├── hooks/                   # 自定义 Hooks
│   ├── use-active-chat      # 核心：消息状态、缓存同步、Agent 上下文（state/actions 分离）
│   ├── use-message-cache    # 内存消息缓存（模块级 Map）
│   ├── use-messages         # 滚动管理（自动滚底、位置追踪）
│   ├── use-artifact         # Artifact 状态管理
│   ├── use-auto-resume      # 断流自动恢复
│   ├── use-chat-visibility # 聊天可见性
│   └── ...
├── lib/
│   ├── ai/                  # AI 配置（厂商/模型/能力）、提示词、工具定义
│   ├── db/                  # Drizzle schema、查询函数、迁移、种子数据
│   ├── editor/              # ProseMirror 编辑器配置
│   ├── artifacts/           # Artifact 服务端逻辑
│   ├── agent-groups.ts      # Agent 分组配色系统
│   ├── constants.ts         # 环境变量、默认值
│   ├── errors.ts            # 错误定义
│   ├── ratelimit.ts         # Redis 限流
│   └── types.ts             # 共享类型
├── artifacts/               # Artifact 类型实现（code/text/html/sheet/image）
├── tests/                   # Playwright E2E 测试
└── proxy.ts                 # Next.js 中间件（认证、路由保护）
```

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 10.x
- PostgreSQL 数据库（推荐 [Neon](https://neon.tech)）
- Redis（可选，用于限流）

### 安装与运行

```bash
# 克隆项目
git clone <repo-url>
cd opcbot

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入实际值

# 初始化数据库（生成迁移 + 执行）
pnpm db:migrate

# （可选）导入预置 Agent 数据
pnpm tsx lib/db/seed-agents.ts

# 启动开发服务器
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `AUTH_SECRET` | 认证密钥（`openssl rand -base64 32` 生成） | ✅ |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | ✅ |
| `ZHIPU_API_KEY` | 智谱 AI API 密钥 | 使用 GLM 模型时必填 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 使用 DeepSeek 模型时必填 |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway 密钥（非 Vercel 部署需要） | 视情况 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 存储令牌 | 上传文件时需要 |
| `REDIS_URL` | Redis 连接字符串（用于限流） | 可选 |

> **提示**：模型厂商的 API Key 和 Base URL 均可通过环境变量覆盖，也可在 `lib/ai/config.ts` 中直接修改。新增模型只需在 config.ts 的 `providers` 和 `models` 中添加配置。

### 常用脚本

```bash
pnpm dev          # 开发服务器（Turbopack）
pnpm build        # 生产构建（自动执行迁移）
pnpm start        # 启动生产服务
pnpm db:studio    # 数据库可视化管理
pnpm db:generate  # 生成 Drizzle 迁移文件
pnpm db:migrate   # 执行数据库迁移
pnpm test         # 运行 E2E 测试
pnpm check        # 代码检查（Biome/Ultracite）
pnpm fix          # 自动修复代码风格
```

## 数据流架构

```
用户输入
  │
  ├─ 乐观更新 → 侧边栏历史列表立即显示
  │
  ├─ POST /api/chat → 流式响应
  │     │
  │     ├─ 服务端: 保存 user 消息 → 调用 AI → 流式返回
  │     └─ onFinish: 保存 assistant 消息 → 刷新历史
  │
  └─ 本地状态更新
        │
        ├─ useChat (React state) → UI 渲染
        └─ rAF 去抖 → 内存 Map 缓存

页面导航
  │
  ├─ SWR 缓存命中(60s 去重) → 跳过 API，直接使用本地数据
  └─ 缓存未命中 → SWR 请求 → 存入缓存

模型/配置
  │
  └─ 首次加载后缓存(revalidateOnMount:false)，Session 内零请求
```

## 部署

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/chatbot)

### 手动部署

```bash
pnpm build
pnpm start
```

> **注意**：非 Vercel 环境需设置 `AI_GATEWAY_API_KEY`；如使用 Neon 数据库，DDL 操作需使用 non-pooling 连接串。

## 许可证

Apache License 2.0
