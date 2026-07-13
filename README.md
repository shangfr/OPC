# OPC Bot

基于 Next.js 16 + AI SDK 构建的智能对话平台，面向"一人公司"(OPC) 场景，支持多模型切换、OPC Agent 管理与分类、站点配置、实时流式响应等企业级功能。

## 功能特性

### 核心对话
- **多模型支持** — 内置 DeepSeek V4 Flash 与智谱 GLM-4.1V 两款模型，可扩展更多厂商（OpenAI 兼容协议）
- **流式响应** — 实时流式输出 AI 回复，支持中途停止并持久化停止标记，支持断流自动恢复
- **思考模式** — 推理模型支持 thinking/reasoning 可视化展示，可开关并降级为普通生成
- **消息编辑与重生成** — 可编辑历史消息并重新生成回复
- **附件上传** — 支持图片、PDF、文本等多种文件格式，阿里云 OSS 存储
- **流式 Markdown** — 基于 streamdown 的流式渲染，支持 CJK 字符、代码块、数学公式、Mermaid 图表

### OPC Agent 系统
- **双视图模式** — 管理员使用 CRUD 管理面板（创建/编辑/启停/排序），普通用户浏览卡片选择界面
- **分类管理** — 7 个业务域分类（法律合规、财税资本、核心战略、产业政策、AI与数字化、OPC孵化、三大平台），支持分类颜色和排序
- **预置 Agent** — 内置 21 个领域专属 Agent，每个配有详细的角色定义系统提示词和预设问题
- **颜色主题** — 10 套配色方案（indigo/amber/emerald/violet 等），分类卡片自动匹配颜色标识
- **站点配置** — SiteConfig 单例表存储全局默认提示词、预设问题、站点名称和描述，通过管理 UI 可编辑
- **延迟持久化** — 新建对话仅在发送第一条消息时写入数据库，避免空会话
- **Agent 名称冗余** — Chat 表冗余存储 agentName，避免 JOIN 查询，Agent 改名不影响历史对话

### 套餐驱动型权限体系

平台采用**套餐驱动型权限体系**，用户通过升级套餐获得不同功能权限，无需区分账号类型（个人/企业）。

#### 4 档套餐

| 套餐 | 月费 | 消息配额 | OPC 创建 | OPC 订阅 | 团队管理 | 收益分成 |
|------|------|---------|---------|---------|---------|---------|
| **Free** | ¥0 | 100条/月 | 1个 | ❌ | ❌ | ❌ |
| **Creator** | ¥29 | 2000条/月 | 10个 | ❌ | ❌ | 70% |
| **Team** | ¥99 | 10000条/月 | 20个 | ✅ | 10人 | 80% |
| **Enterprise** | ¥299 | 无限 | 无限 | ✅ | 无限 | 80% |

#### 权限规则

- **OPC 创建**：Creator 及以上套餐可创建 OPC 智能体并申请上架到公开市场
- **OPC 订阅**：Team 及以上套餐可订阅交易市场中的 OPC 服务
- **团队管理**：Team 及以上套餐解锁团队管理功能（成员邀请、角色管理、配额查看）
- **收益分成**：Creator 及以上套餐可从 OPC 订阅收益中获得分成（Creator 70%，Team/Enterprise 80%）
- **平台管理员**：admin 角色仅用于后台管理（用户审核、OPC 风控、数据看板），套餐功能需自行订阅

#### 测试账号

初始化脚本（`pnpm db:seed`）会自动创建以下测试账号，密码均为 `Test@123456`：

| 邮箱 | 套餐 | 说明 |
|------|------|------|
| `admin@opcbot.com` | - | 平台管理员（密码 `Admin@123456`） |
| `free@opcbot.com` | Free | 基础体验账号 |
| `creator@opcbot.com` | Creator | 独立创作者账号 |
| `team@opcbot.com` | Team | 团队管理账号（含企业+团队闭环） |
| `enterprise@opcbot.com` | Enterprise | 企业级账号（含企业+团队闭环） |

### OPC 交易市场
- **服务商城** — 展示全部已上架公共 OPC，支持分类筛选和搜索
- **订阅机制** — Team 及以上套餐用户可订阅 OPC，将外部智能体接入团队工作流
- **收益管理** — 创作者可查看 OPC 订阅收益汇总、明细列表和结算状态
- **上架审核** — Creator 及以上套餐用户可申请将 OPC 上架到公开市场，平台管理员审核

### 账户管理
- **注册/登录** — 邮箱+密码认证，Auth.js v5 管理会话
- **密码找回** — 基于令牌的密码重置流程（1 小时有效期，一次性使用）
- **订阅管理** — 统一管理页面展示当前套餐、用量、账单入口和全部套餐方案

### 性能优化
- **内存消息缓存** — 模块级 Map 缓存，SPA 导航切聊天零延迟，刷新后由 SWR 重新拉取
- **SWR 数据获取** — Agent/Model/Document/SiteConfig 全部使用 SWR，共享跨页面缓存（60s 去重）
- **Context 分层** — ActiveChatProvider 拆分为 state + actions 双 Context，减少不必要的重渲染

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| AI | Vercel AI SDK 5.x |
| 数据库 | PostgreSQL + Drizzle ORM |
| 认证 | Auth.js v5 (NextAuth) |
| UI | shadcn/ui + Tailwind CSS 4 |
| 支付 | Stripe / Mock 模式 |
| 存储 | 阿里云 OSS |
| 部署 | Vercel / Docker |

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 14+
- pnpm（推荐）或 npm

### 安装

```bash
git clone https://github.com/shangfr/OPC.git
cd OPC
pnpm install
```

### 配置

复制 `.env.example` 为 `.env.local`，填写以下配置：

```env
# 数据库
POSTGRES_URL=postgresql://user:password@localhost:5432/opcbot
POSTGRES_URL_NON_POOLING=postgresql://user:password@localhost:5432/opcbot

# AI 模型
AI_GATEWAY_API_KEY=your_api_key
AI_GATEWAY_BASE_URL=https://your-gateway.com/v1

# 认证
AUTH_SECRET=your_random_secret

# 阿里云 OSS（可选，未配置时使用本地存储）
OSS_ACCESS_KEY_ID=your_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your_bucket

# Stripe（可选，未配置时使用 Mock 模式）
STRIPE_SECRET_KEY=your_stripe_key
```

### 初始化

```bash
pnpm db:generate  # 生成 Drizzle 迁移文件
pnpm db:migrate   # 执行数据库迁移
pnpm db:seed      # 初始化种子数据（分类、Agent、测试账号）
```

### 运行

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
