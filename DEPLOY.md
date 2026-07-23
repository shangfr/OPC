# OPCBot 部署教程

## 一、环境要求

| 依赖 | 版本要求 |
|------|---------|
| Node.js | ≥ 18.18.0 |
| npm | ≥ 9.0 |
| PostgreSQL | ≥ 14 |
| Redis（可选） | ≥ 6（用于限流） |

## 二、本地开发部署

### 1. 解压项目

```bash
unzip opcbot-full.zip -d opcbot
cd opcbot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`，按需填写：

```bash
cp .env.example .env.local
```

**必填项：**

```env
# 数据库
POSTGRES_URL=postgresql://user:password@localhost:5432/opcbot

# Auth.js
AUTH_SECRET=your-random-secret-at-least-32-chars

# 智谱 AI（大模型）
ZHIPU_API_KEY=your-zhipu-api-key

# 应用地址
APP_URL=http://localhost:3000
```

**可选项：**

```env
# Stripe 支付（不填则订阅为 Mock 模式）
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Redis 限流（不填则使用内存限流）
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 4. 初始化数据库

```bash
# 执行 migration SQL（创建表结构）
psql $POSTGRES_URL -f lib/db/migration-subscription-clone.sql

# 初始化种子数据（管理员账号、OPC 模板、测试企业等）
npx tsx lib/db/seed-agents.ts
```

种子数据会创建以下测试账号：

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@opcbot.com | Admin@123456 | 平台管理员 |
| enterprise@opcbot.com | Test@123456 | 企业管理员 |
| creator@opcbot.com | Test@123456 | 个人创作者 |

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 三、生产部署（Docker）

### 1. 构建 Docker 镜像

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 2. docker-compose.yml

```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: opcbot
      POSTGRES_USER: opcbot
      POSTGRES_PASSWORD: your-password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      POSTGRES_URL: postgresql://opcbot:your-password@db:5432/opcbot
      AUTH_SECRET: your-random-secret-at-least-32-chars
      ZHIPU_API_KEY: your-zhipu-api-key
      APP_URL: http://localhost:3000
    depends_on:
      - db

volumes:
  pgdata:
```

### 3. 启动

```bash
docker-compose up -d

# 初始化数据库
docker-compose exec app npx tsx lib/db/seed-agents.ts
```

## 四、生产部署（Vercel）

### 1. 创建 Vercel 项目

```bash
npx vercel
```

### 2. 配置环境变量

在 Vercel Dashboard → Settings → Environment Variables 中添加所有 `.env.local` 中的变量。

### 3. 配置 PostgreSQL

推荐使用 [Neon](https://neon.tech) 或 [Supabase](https://supabase.com) 提供的免费 PostgreSQL。

### 4. 部署

```bash
npx vercel --prod
```

### 5. 初始化数据库

```bash
# 用生产数据库 URL 执行 migration
psql $PROD_POSTGRES_URL -f lib/db/migration-subscription-clone.sql

# 执行种子数据（仅首次部署）
DATABASE_URL=$PROD_POSTGRES_URL npx tsx lib/db/seed-agents.ts
```

## 五、路由体系

### 公共页面（所有登录用户）

| 路由 | 说明 |
|------|------|
| `/` | 首页/对话 |
| `/explore` | OPC 智库浏览 |
| `/tickets` | 供需发布 |
| `/knowledge` | 知识库 |
| `/marketplace` | 交易市场（企业可订阅） |

### 工作区

| 路由 | 权限 | 说明 |
|------|------|------|
| `/creator` | 个人用户 + 企业管理员 | 创作者中心 / 团队 OPC 管理 |
| `/team` | 企业账号 | 团队设置 |
| `/settings` | 所有正式用户 | 订阅管理 |

### 管理后台（/admin/*）

| 路由 | 权限 |
|------|------|
| `/admin` | 仅平台管理员 |
| `/admin/applications` | 仅平台管理员 |
| `/admin/orders` | 仅平台管理员 |
| `/admin/stats` | 仅平台管理员 |
| `/admin/users` | 平台管理员 + 企业管理员 |

## 六、角色权限矩阵

| 功能 | 平台管理员 | 企业管理员 | 团队成员 | 个人用户 |
|------|:---:|:---:|:---:|:---:|
| 使用公共 OPC | ✅ | ✅ | ✅ | ✅ |
| 创建 OPC | ✅ | ✅ | ✅（团队内可见） | ✅ |
| 编辑/删除 OPC | 全部 | 本企业 OPC | 自己创建的 | 自己创建的 |
| 申请上架 OPC | — | 团队 OPC | ❌ | 自己的 OPC |
| 审核上架申请 | ✅ | ❌ | ❌ | ❌ |
| 订阅公共 OPC | — | ✅ | ❌ | ❌ |
| 取消订阅 | — | ✅ | ❌ | ❌ |
| 编辑订阅副本 | — | ✅ | ❌ | ❌ |
| 强制下架 OPC | ✅ | ❌ | ❌ | ❌ |
| 管理用户 | 全部 | 团队成员 | ❌ | ❌ |

## 七、常见问题

### Q: 企业用户登录后看不到管理菜单？

A: `teamRole` 是在 JWT token 中存储的，需要**重新登录**才能生效。如果仍然不行，检查 `auth.ts` 的 jwt 回调是否正确查询了 `teamMember` 表。

### Q: 订阅后看不到副本 OPC？

A: 执行 `migration-subscription-clone.sql` 添加 `sourceAgentId` 和 `clonedAgentId` 字段。

### Q: Stripe 未配置时订阅报错？

A: 未配置 Stripe 时系统走 Mock 模式，直接激活订阅。如果报错，检查 `subscribe-action.ts` 中的 `isStripeEnabled()` 逻辑。

### Q: 如何添加新的 OPC 分类？

A: 平台管理员登录 → `/admin` → AgentManager → 分类管理。
