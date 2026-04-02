# PR Pilot — 开发进度记录

**最后更新：** 2026-04-02（阶段五收尾）  
**当前阶段：** 全部阶段完成，待 Vercel 部署上线

---

## 整体进度

| 阶段 | 时间 | 目标 | 状态 |
|------|------|------|------|
| 阶段一：地基 | Day 1-2 | 项目初始化 + GitHub API 打通 | ✅ 完成 |
| 阶段二：Agent 引擎 | Day 3-5 | ReAct 循环跑通，Tool Use 实现 | ✅ 完成 |
| 阶段三：流式推送 | Day 6-7 | SSE 接入前端，思考链实时展示 | ✅ 完成 |
| 阶段四：报告与 UI | Day 8-11 | 结构化报告 + 前端 UI 打磨 | ✅ 完成 |
| 阶段五：上线收尾 | Day 12-14 | 部署 + 错误处理 + README + Demo | ✅ 完成 |

---

## 当前项目结构

```
ai-pr-reviewer/
├── src/
│   ├── pages/
│   │   ├── Home.jsx              ✅ 首页（输入框 + 历史列表）
│   │   └── Review.jsx            ✅ 分析页（双栏：思考链 + 报告）
│   ├── components/
│   │   ├── PRInput.jsx           ✅ PR 链接输入框（格式校验 + loading）
│   │   ├── ThinkingTimeline.jsx  ✅ 思考链时间轴
│   │   ├── ToolCallCard.jsx      ✅ 工具调用卡片（running/done/error）
│   │   ├── ReviewReport.jsx      ✅ Markdown 报告渲染
│   │   ├── IssueBadge.jsx        ✅ 严重程度标签
│   │   └── HistoryList.jsx       ✅ 历史记录列表
│   ├── hooks/
│   │   ├── useAgentStream.js     ✅ SSE 消费 Hook（useReducer 状态管理）
│   │   └── useHistory.js         ✅ sessionStorage 历史读写
│   ├── lib/
│   │   └── parsePRUrl.js         ✅ PR 链接解析（前端用）
│   ├── App.jsx                   ✅ React Router 路由配置
│   └── index.css                 ✅ 深色主题 + Tailwind v4
├── api/
│   ├── review.js                 ✅ Agent ReAct 循环 + SSE 端点（DeepSeek 版）
│   ├── github.js                 ✅ GitHub API 工具函数
│   └── parsePRUrl.js             ✅ PR 链接解析（服务端）
├── local/
│   └── server.js                 ✅ Express 本地服务器（端口 3001）
├── .env.local                    ✅ 已配置所有密钥
├── vercel.json                   ✅ Vercel 路由配置
└── vite.config.js                ✅ Tailwind + /api 代理到 localhost:3001
```

---

## 已完成内容详情

### 阶段二：Agent 引擎
- [x] `api/review.js`：Tool Schemas（OpenAI Function Calling 格式）
- [x] `api/review.js`：ReAct 循环核心（异步生成器 `runAgent`）
- [x] `api/review.js`：System Prompt（中文，结构化报告格式）
- [x] `api/review.js`：SSE 响应格式（Vercel Serverless handler）
- [x] `local/server.js`：Express 本地服务器，自动加载 `.env.local`

### 阶段三：流式推送
- [x] `src/hooks/useAgentStream.js`：SSE 消费 Hook，useReducer 状态管理
- [x] `src/hooks/useHistory.js`：sessionStorage 历史记录读写

### 阶段四：报告与 UI
- [x] 所有 UI 组件（PRInput / ThinkingTimeline / ToolCallCard / ReviewReport / IssueBadge / HistoryList）
- [x] 前端页面（Home / Review）
- [x] React Router 路由（`/` 首页，`/review/:owner/:repo/:pull` 分析页）
- [x] 深色工程风格（Tailwind v4 + @tailwindcss/typography）

### AI 模型切换（2026-04-02）
- 从 Anthropic Claude 切换为 **DeepSeek（deepseek-chat）**
- 原因：自定义 Anthropic 代理的该模型渠道不可用
- 使用 OpenAI SDK 兼容接口，`baseURL: https://api.deepseek.com`
- 环境变量：`DEEPSEEK_TOKEN`

---

## 端到端验证结果（2026-04-02）

测试 PR：`https://github.com/airbytehq/airbyte/pull/76014`

```
✅ get_pr_info    — 1461ms
✅ get_pr_files   — 523ms  
✅ get_file_diff  — 927ms（build.gradle）
✅ 报告生成       — 完整 Markdown，含 Critical/Warning/Suggestion/总结
```

---

## 阶段五：完成内容

- [x] `src/components/PRInput.jsx`：输入格式错误时显示红色边框 + 错误提示文字（替代浏览器 popup）
- [x] `vercel.json`：添加 `maxDuration: 60`，避免 AI 分析超时
- [x] `README.md`：项目介绍、技术架构、核心技术说明、本地运行指南、部署方式

## 上线记录

- [x] Vercel 部署成功（2026-04-02）
- **生产地址：** https://ai-pr-reviewer-iota.vercel.app/
- [x] 生产环境运行正常

---

## 本地开发指南

```bash
# 终端 1 — 后端（先确认 3001 端口无残留进程）
lsof -i :3001 | grep node  # 查看是否有旧进程
kill <PID>                  # 如有则杀掉
node local/server.js

# 终端 2 — 前端
npm run dev
# 访问 http://localhost:5173
```

> ⚠️ 注意：修改 `api/` 下的文件后，必须重启 `local/server.js`，否则加载的是旧代码。

---

## 关键配置

- **AI 模型**：`deepseek-chat`，通过 `DEEPSEEK_TOKEN` 认证
- **History 存储**：sessionStorage（刷新清空，符合 PRD v1.0 要求，未接入 Supabase）
- **Diff 截断**：单文件超 3000 字符截断（`api/github.js`）
- **最大迭代**：`MAX_ITERATIONS = 10`

---

*文档结束*
