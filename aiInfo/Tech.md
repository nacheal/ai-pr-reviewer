# PR Pilot — 技术架构文档

**版本：** v1.1  
**日期：** 2026-04-01  
**变更说明：** 新增 Supabase 数据库层，History 从 sessionStorage 改为持久化存储

---

## 1. 技术栈总览

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| Vite | 8.x | 构建工具 |
| React Router | 7.x | 客户端路由 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | latest | UI 组件库 |
| @supabase/supabase-js | latest | 数据库客户端（历史记录读写） |
| react-markdown + remark-gfm | latest | Report Markdown 渲染 |

### 后端

| 技术 | 用途 |
|------|------|
| Vercel Serverless Functions | Agent 推理引擎 + SSE 端点（`/api/review`） |

> 选用 Vercel Serverless 而非 Supabase Edge Functions，原因：ReAct 循环涉及多轮 Claude 流式调用，Vercel 对长时 SSE 连接支持更好；Supabase 仅用于数据存储。

### AI 服务

| 技术 | 用途 |
|------|------|
| Anthropic Claude API | Agent 推理引擎，Tool Use + 流式输出 |
| 模型 | `claude-sonnet-4-20250514` |

### 数据库 / BaaS

| 技术 | 用途 |
|------|------|
| Supabase PostgreSQL | 持久化存储 PR Review 历史记录 |
| Supabase RLS | 行级安全策略（按 session_id 隔离） |

> v1.0 不做用户登录，通过前端生成的 `session_id`（UUID，存 localStorage）标识用户，实现无登录的历史隔离。

### 外部 API

| 技术 | 用途 |
|------|------|
| GitHub REST API v3 | 拉取 PR 信息、文件列表、Diff 内容 |

### 基础设施

| 技术 | 用途 |
|------|------|
| Vercel | 前端静态资源 CDN + Serverless Functions |
| Supabase | PostgreSQL 数据库托管 |
| GitHub | 代码仓库 + CI/CD（push → Vercel 自动部署） |

---

## 2. 系统架构

```
用户浏览器（React SPA）
    │
    │ 1. 输入 PR 链接，点击分析
    │
    ├──────────────────────────────────────────────────────────
    │                                                          │
    │ SSE 长连接                                               │ Supabase JS SDK
    ▼                                                          ▼
Vercel Serverless Function                             Supabase PostgreSQL
/api/review  (SSE 端点)                               pr_reviews 表
    │                                                  （读写历史记录）
    │ 2. 解析 PR 参数
    ▼
Agent 推理引擎（ReAct Loop）
    │
    ├── Reasoning: 调用 Claude API（Tool Use + stream）
    │       │
    │       │ Claude 返回：思考文字 + 工具调用指令
    │       │
    ├── Action: 执行工具调用 → GitHub REST API
    │       │
    │       │ 返回：PR信息 / 文件列表 / Diff内容
    │       │
    ├── Observation: 将工具结果注入下一轮对话
    │       │
    │       └── 循环直到 stop_reason === "end_turn"
    │
    │ 3. 每个步骤通过 SSE 实时推送给前端
    ▼
前端实时渲染
    ├── 思考文字流式展示（ThinkingTimeline）
    ├── 工具调用卡片逐步出现（ToolCallCard）
    └── 最终报告渲染（ReviewReport）
         │
         ▼ 分析完成后
    写入 Supabase pr_reviews 表（含 report 内容）
```

---

## 3. Agent 核心实现

### 3.1 ReAct 循环伪代码

```javascript
async function* runAgent(owner, repo, pullNumber) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL, // 自定义代理
  });
  const messages = [{ role: "user", content: buildUserPrompt(owner, repo, pullNumber) }];
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // 流式推送思考文字
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        yield { type: "thinking", text: chunk.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();

    if (finalMessage.stop_reason === "end_turn") {
      yield { type: "report", content: extractText(finalMessage) };
      break;
    }

    // 执行工具调用
    messages.push({ role: "assistant", content: finalMessage.content });
    const toolResults = [];
    for (const toolUse of finalMessage.content.filter(b => b.type === "tool_use")) {
      yield { type: "tool_start", name: toolUse.name, input: toolUse.input };
      const result = await executeTool(toolUse.name, toolUse.input);
      yield { type: "tool_done", name: toolUse.name, durationMs: ... };
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }
}
```

### 3.2 工具定义（Tool Schemas）

```javascript
const TOOLS = [
  {
    name: "get_pr_info",
    description: "获取 PR 的基本信息，包括标题、描述、作者、源分支和目标分支",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "仓库所有者" },
        repo: { type: "string", description: "仓库名称" },
        pull_number: { type: "number", description: "PR 编号" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "get_pr_files",
    description: "获取 PR 变更的文件列表，包含每个文件的增删行数和状态",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "get_file_diff",
    description: "获取指定文件的完整 diff 内容，用于深入分析代码变更",
    input_schema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number" },
        filename: { type: "string", description: "文件路径，如 src/index.js" },
      },
      required: ["owner", "repo", "pull_number", "filename"],
    },
  },
];
```

### 3.3 System Prompt 设计

```
你是一位资深软件工程师，专门负责代码审查。
你会收到一个 GitHub Pull Request 的信息，需要对其进行全面的代码审查。

审查流程：
1. 首先调用 get_pr_info 了解 PR 的背景和目的
2. 调用 get_pr_files 查看所有变更文件
3. 根据文件重要性，选择最关键的 1~3 个文件，调用 get_file_diff 深入分析
4. 综合分析后，输出结构化的 Review 报告

Review 报告格式（使用 Markdown）：
## 整体评价
[PR目的摘要] | 评级：Good / Needs Work / Risky

## 问题清单
### 🔴 Critical（必须修改）
- [文件名:行号] 问题描述

### 🟡 Warning（建议修改）
- [文件名] 问题描述

### 🟢 Suggestion（可选优化）
- 建议内容

## 亮点
- 值得肯定的地方

## 总结
是否建议 Approve 及核心理由。
```

---

## 4. 前后端通信协议

### SSE（Server-Sent Events）

选用 SSE 而非 WebSocket，原因：无状态、Vercel Serverless 友好、实现简单。

**Event 类型定义：**

```typescript
{ type: "thinking", text: string }          // 思考文字（流式，多次触发）
{ type: "tool_start", name: string, input: Record<string, any> }  // 工具调用开始
{ type: "tool_done", name: string, durationMs: number }           // 工具调用完成
{ type: "report", content: string }         // 最终报告（markdown，触发一次）
{ type: "error", message: string }          // 错误
{ type: "done" }                            // 结束信号
```

**前端消费：**

```javascript
const es = new EventSource(`/api/review?url=${encodeURIComponent(prUrl)}`);
es.onmessage = (e) => {
  const event = JSON.parse(e.data);
  dispatch(event); // useReducer 更新状态
};
```

---

## 5. 数据库设计（Supabase）

### 5.1 表结构：pr_reviews

```sql
CREATE TABLE pr_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL,          -- 前端生成的匿名标识（localStorage）
  pr_url      TEXT NOT NULL,          -- 完整 PR 链接
  owner       TEXT NOT NULL,
  repo        TEXT NOT NULL,
  pull_number INTEGER NOT NULL,
  pr_title    TEXT,                   -- PR 标题（分析完成后填入）
  report      TEXT,                   -- 最终 Review 报告（Markdown）
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | done | error
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 按 session_id 查询历史，按时间倒序
CREATE INDEX idx_pr_reviews_session ON pr_reviews(session_id, created_at DESC);
```

### 5.2 RLS 策略

```sql
ALTER TABLE pr_reviews ENABLE ROW LEVEL SECURITY;

-- 任何人可以读自己 session 的记录（通过 session_id 参数传入）
-- 注意：v1.0 不做登录，RLS 通过 anon key 访问，session_id 由前端传入
-- 实际隔离靠前端逻辑（不共享 localStorage），非强安全场景可接受

CREATE POLICY "session read" ON pr_reviews
  FOR SELECT USING (true);  -- 允许 anon 读取（按 session_id 过滤在应用层）

CREATE POLICY "session insert" ON pr_reviews
  FOR INSERT WITH CHECK (true);  -- 允许 anon 写入

CREATE POLICY "session update" ON pr_reviews
  FOR UPDATE USING (true);  -- 允许更新 report / status
```

> **安全说明**：v1.0 为无登录公开工具，RLS 策略相对宽松。若后续引入 Supabase Auth，将 session_id 替换为 `auth.uid()`，策略收紧为 `user_id = auth.uid()`。

### 5.3 前端数据流

```
分析完成 → 写入 pr_reviews（含 report + status='done'）
               ↓
历史列表页 → 查询 pr_reviews WHERE session_id = localStorage.getItem('sessionId')
               ORDER BY created_at DESC
```

---

## 6. 目录结构

```
ai-pr-reviewer/
├── src/                          # 前端 React 应用
│   ├── pages/
│   │   ├── Home.jsx              # 首页：输入框 + 历史记录
│   │   └── Review.jsx            # 分析页：思考链 + 报告
│   ├── components/
│   │   ├── PRInput.jsx           # PR 链接输入组件
│   │   ├── ThinkingTimeline.jsx  # 思考链时间轴
│   │   ├── ToolCallCard.jsx      # 单次工具调用卡片
│   │   ├── ReviewReport.jsx      # 最终报告展示
│   │   └── HistoryList.jsx       # 历史记录列表
│   ├── hooks/
│   │   ├── useAgentStream.js     # SSE 消费 Hook
│   │   └── useHistory.js         # Supabase 历史记录读写 Hook
│   └── lib/
│       ├── parsePRUrl.js         # PR 链接解析工具函数
│       └── supabase.js           # Supabase 客户端单例
│
├── api/                          # Vercel Serverless Functions
│   ├── review.js                 # Agent 主逻辑（SSE 端点）
│   ├── github.js                 # GitHub API 工具函数
│   └── parsePRUrl.js             # PR 链接解析（服务端）
│
├── local/                        # 本地开发辅助
│   └── server.js                 # Express 服务（代理 /api，端口 3001）
│
├── .env.local                    # 本地环境变量（不提交 Git）
├── vercel.json                   # Vercel 路由配置
└── vite.config.js                # 含 /api 代理到 localhost:3001
```

---

## 7. 环境变量

```env
# .env.local（本地开发）
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=http://154.44.8.201:3400/claude/awsbedrock   # 自定义代理
GITHUB_TOKEN=ghp_...             # GitHub Personal Access Token

# Supabase（前端可公开）
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Vercel 环境变量（生产，在 Vercel 控制台配置）
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=...
GITHUB_TOKEN=ghp_...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 密钥隔离

```
┌──────────────────────────┬───────────────────────┬──────────────────────┐
│ 密钥                     │ 存放位置              │ 持有方               │
├──────────────────────────┼───────────────────────┼──────────────────────┤
│ VITE_SUPABASE_URL        │ .env.local / Vercel   │ 前端（可公开）        │
│ VITE_SUPABASE_ANON_KEY   │ .env.local / Vercel   │ 前端（可公开）        │
│ ANTHROPIC_API_KEY        │ .env.local / Vercel   │ 仅 Serverless 服务端  │
│ ANTHROPIC_BASE_URL       │ .env.local / Vercel   │ 仅 Serverless 服务端  │
│ GITHUB_TOKEN             │ .env.local / Vercel   │ 仅 Serverless 服务端  │
└──────────────────────────┴───────────────────────┴──────────────────────┘
```

`ANTHROPIC_API_KEY`、`GITHUB_TOKEN` 永远不出现在前端代码和浏览器网络请求中。

---

## 8. 部署架构

```
开发环境                              生产环境
──────────────────────                ────────────────────────────
localhost:5173 (Vite)                 https://pr-pilot.vercel.app
    │                                          │
    │ /api/* → proxy → localhost:3001          │ /api/* → Vercel Serverless
    │ local/server.js (Express)                │
    │                                          │
    └──────────┬───────────────────────────────┘
               │
               ▼
       同一个 Supabase 项目
       pr_reviews 表（历史记录）

CI/CD：
git push origin main
    → GitHub Webhook → Vercel 自动构建部署
    → npm run build (Vite) → 产物部署至 Vercel CDN
```

---

## 9. 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| AI SDK | 直接调用 Anthropic API | 学习 Tool Use 底层原理，不上框架 |
| 通信协议 | SSE 而非 WebSocket | Vercel Serverless 对 SSE 支持好，实现简单 |
| 后端计算 | Vercel Serverless | 无独立服务器，与前端同仓库，部署零配置 |
| AI 业务逻辑 | Vercel Serverless（非 Supabase Edge Functions） | ReAct 多轮流式调用需要较长执行时间，Vercel 更适合 |
| 数据库 | Supabase PostgreSQL | 历史记录持久化，无需自建数据库服务 |
| 身份识别 | 匿名 session_id（localStorage） | v1.0 无需登录，降低用户门槛 |
| 状态管理 | React useState/useReducer | 规模小，无需 Redux/Zustand |
| 样式 | Tailwind CSS + shadcn/ui | 延续上一个项目技术栈，上手快 |

---

*文档结束*
