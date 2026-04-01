# PR Pilot — 开发进度记录

**最后更新：** 2026-04-01  
**当前阶段：** 阶段一完成 + 技术栈升级（加入 Supabase），进入阶段二

---

## 整体进度

| 阶段 | 时间 | 目标 | 状态 |
|------|------|------|------|
| 阶段一：地基 | Day 1-2 | 项目初始化 + GitHub API 打通 | ✅ 完成 |
| 阶段二：Agent 引擎 | Day 3-5 | ReAct 循环跑通，Tool Use 实现 | 🔄 进行中 |
| 阶段三：流式推送 | Day 6-7 | SSE 接入前端，思考链实时展示 | ⏳ 待开始 |
| 阶段四：报告与 UI | Day 8-11 | 结构化报告 + 前端 UI 打磨 | ⏳ 待开始 |
| 阶段五：上线收尾 | Day 12-14 | 部署 + 错误处理 + README + Demo | ⏳ 待开始 |

---

## 阶段一：已完成内容

### 项目结构
```
ai-pr-reviewer/
├── src/
│   ├── lib/
│   │   └── parsePRUrl.js         ✅ PR 链接解析（前端用）
│   ├── App.jsx                   （Vite 默认，待改造）
│   └── main.jsx                  （Vite 默认，待改造）
├── api/
│   ├── github.js                 ✅ GitHub API 三个工具函数
│   ├── parsePRUrl.js             ✅ PR 链接解析（服务端用）
│   ├── review.js                 ✅ Agent ReAct 循环 + SSE 端点（已创建）
│   └── test-github.js            ✅ API 连通验证脚本
├── aiInfo/
│   ├── Prd.md
│   ├── Tech.md                   ✅ 已更新 v1.1（加入 Supabase 数据库层）
│   ├── Todo.md                   ✅ 已更新（加入 Supabase 相关任务）
│   ├── LastTech.md               （上一个项目 AI File Hub 技术参考）
│   └── progress.md               （本文件）
├── .env.local                    ✅ 已配置 Anthropic Key + 自定义代理
├── vercel.json                   ✅ Vercel 路由配置
└── vite.config.js                ✅ Tailwind + /api 代理到 localhost:3001
```

### 已安装依赖
- `react` + `react-dom` 19.x
- `react-router-dom` 7.x
- `@anthropic-ai/sdk` ^0.81.0
- `tailwindcss` 4.x + `@tailwindcss/vite`
- `react-markdown` + `remark-gfm`
- `express`（devDependencies，用于本地 Express 开发服务器）

### 关键配置
- `.env.local` 中已配置：
  - `ANTHROPIC_API_KEY=sk-user-8a3ab7f7b1acf081d8bfa80d`
  - `ANTHROPIC_BASE_URL=http://154.44.8.201:3400/claude/awsbedrock`（自定义代理）
  - `GITHUB_TOKEN=`（**待填写**）
  - `VITE_SUPABASE_URL=`（**待填写**，需先创建 Supabase 项目）
  - `VITE_SUPABASE_ANON_KEY=`（**待填写**）
- `package.json` 使用 `"type": "module"`，所有 `api/` 文件必须用 ESM 语法

### 验证结果
- ✅ GitHub API 连通，`node api/test-github.js` 成功拉取 facebook/react PR 数据
- ✅ `api/review.js` Agent 框架已创建（ReAct 循环 + Tool Schemas + SSE 端点）

---

## 技术栈升级记录（2026-04-01）

对比上一个项目（AI File Hub），本次主要变化：

| 项目 | AI File Hub | PR Pilot | 变更说明 |
|------|-------------|----------|----------|
| AI 服务 | DeepSeek | Anthropic Claude | Tool Use 支持更成熟 |
| 后端计算 | Supabase Edge Functions | Vercel Serverless | ReAct 长时流式更适合 Vercel |
| 数据库 | Supabase PostgreSQL（用户文件） | Supabase PostgreSQL（PR 历史） | 同样使用 Supabase |
| 身份认证 | Supabase Auth（GitHub OAuth） | 匿名 session_id（localStorage） | v1.0 无需登录，降低门槛 |
| 实时推送 | Supabase Realtime | SSE | 单向推送，SSE 更简单 |

**核心决策**：Supabase 仅用于持久化 PR 历史记录（`pr_reviews` 表），AI Agent 逻辑仍在 Vercel Serverless Functions 中运行。

---

## 阶段二：进行中任务

### 已完成
- [x] `api/review.js`：Tool Schemas 定义（3个工具）
- [x] `api/review.js`：ReAct 循环核心（`runAgent` 异步生成器）
- [x] `api/review.js`：System Prompt
- [x] `api/review.js`：SSE 响应格式（Vercel Serverless handler）
- [x] Tech.md 更新至 v1.1（加入 Supabase 数据库设计）

### 待完成
- [ ] Supabase 项目创建 + `pr_reviews` 表初始化（见 Tech.md 5.1）
- [ ] 安装 `@supabase/supabase-js`，创建 `src/lib/supabase.js`
- [ ] 本地 Express 服务器 `local/server.js`（端口 3001）
- [ ] `curl` 测试 SSE 端点，确认 Agent 能完整运行推理链
- [ ] `src/hooks/useAgentStream.js` — 前端 SSE 消费 Hook
- [ ] `src/hooks/useHistory.js` — Supabase 历史读写 Hook

---

## 注意事项

- **`ANTHROPIC_BASE_URL` 是自定义代理**，初始化 Anthropic 客户端时必须显式传入
- **Supabase anon key 可放前端**，AI/GitHub 密钥只能在服务端（Vercel 环境变量）
- **Diff 截断**：单文件超 3000 字符时截断（已在 `api/github.js` 实现）
- **模型 ID**：`claude-sonnet-4-20250514`
- **本地开发**：前端 `npm run dev`（端口 5173），后端 `node local/server.js`（端口 3001）

---

*文档结束*
