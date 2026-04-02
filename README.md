# PR Pilot — AI Code Reviewer

粘贴任意 GitHub PR 链接，AI Agent 自动分析代码变更，实时展示推理过程，生成结构化 Review 报告。

**[在线 Demo](https://pr-pilot.vercel.app)** · 作品集项目

---

## 功能演示

```
输入 PR 链接
  ↓
Agent 调用工具：get_pr_info → get_pr_files → get_file_diff
  ↓
思考链实时流式展示（推理过程可见）
  ↓
输出结构化报告（Critical / Warning / Suggestion 分级）
```

---

## 技术架构

```
前端（React + Vite）         后端（Vercel Serverless）
┌─────────────────────┐      ┌──────────────────────────┐
│  Home.jsx           │      │  api/review.js           │
│  ├── PRInput        │─SSE─→│  ├── ReAct 循环           │
│  └── HistoryList    │      │  ├── Tool Use 执行器      │
│                     │      │  └── SSE 事件推送         │
│  Review.jsx         │      │                          │
│  ├── ThinkingTimeline│      │  api/github.js           │
│  └── ReviewReport   │      │  ├── getPrInfo            │
│                     │      │  ├── getPrFiles           │
│  useAgentStream.js  │      │  └── getFileDiff          │
│  (SSE 消费 Hook)    │      │                          │
└─────────────────────┘      └──────────────────────────┘
                                        ↓
                              DeepSeek API (deepseek-chat)
                              GitHub REST API
```

---

## 核心技术实现

### ReAct Agent 循环

```
Reasoning（思考）→ Action（调用工具）→ Observation（观察结果）→ 循环
```

`api/review.js` 中的 `runAgent` 是一个异步生成器，每一轮：
1. 调用 DeepSeek API（开启流式输出）
2. 实时 yield `thinking` 事件（思考文字）
3. 检测到工具调用时，yield `tool_start`，执行工具，yield `tool_done`
4. 将工具结果注入消息历史，进入下一轮
5. `finish_reason === 'stop'` 时 yield `report`（最终报告）

### SSE 流式推送

后端通过 `text/event-stream` 将 Agent 每一步推送给前端：

```
data: {"type":"thinking","text":"..."}
data: {"type":"tool_start","name":"get_pr_info","input":{...}}
data: {"type":"tool_done","name":"get_pr_info","durationMs":423}
data: {"type":"report","content":"## 整体评价\n..."}
data: {"type":"done"}
```

前端 `useAgentStream` Hook 使用 `EventSource` + `useReducer` 消费事件，驱动 UI 实时更新。

### Tool Use（Function Calling）

定义三个工具的 JSON Schema，Agent 自主决定何时调用哪个工具、传什么参数，符合 ReAct 范式：

| 工具 | 功能 |
|------|------|
| `get_pr_info` | 获取 PR 标题、描述、作者、分支 |
| `get_pr_files` | 获取变更文件列表及增删行数 |
| `get_file_diff` | 获取指定文件的完整 diff（超 3000 字符自动截断） |

---

## 本地运行

### 前置条件

- Node.js 18+
- DeepSeek API Token（[申请地址](https://platform.deepseek.com)）
- GitHub Token（可选，未配置时限额 60次/小时）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/pr-pilot.git
cd pr-pilot

# 2. 安装依赖
npm install

# 3. 配置环境变量
# 创建 .env.local，填入：
# DEEPSEEK_TOKEN=your_token
# GITHUB_TOKEN=your_github_token（可选）

# 4. 启动后端（终端 1）
node local/server.js

# 5. 启动前端（终端 2）
npm run dev

# 访问 http://localhost:5173
```

> 修改 `api/` 下的文件后需重启 `local/server.js`。

---

## 部署到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

在 Vercel 控制台配置环境变量：

| 变量名 | 说明 |
|--------|------|
| `DEEPSEEK_TOKEN` | DeepSeek API Token |
| `GITHUB_TOKEN` | GitHub Personal Access Token（推荐，避免限流） |

`api/review.js` 已配置 `maxDuration: 60`，支持最长 60 秒的 AI 分析。

---

## 项目结构

```
pr-pilot/
├── src/
│   ├── pages/
│   │   ├── Home.jsx              首页（输入框 + 历史）
│   │   └── Review.jsx            分析页（思考链 + 报告）
│   ├── components/
│   │   ├── PRInput.jsx           PR 链接输入（格式校验）
│   │   ├── ThinkingTimeline.jsx  思考链时间轴
│   │   ├── ToolCallCard.jsx      工具调用卡片
│   │   ├── ReviewReport.jsx      Markdown 报告渲染
│   │   └── HistoryList.jsx       会话历史列表
│   └── hooks/
│       ├── useAgentStream.js     SSE 消费 Hook
│       └── useHistory.js         会话历史读写
├── api/
│   ├── review.js                 Agent ReAct 循环 + SSE 端点
│   └── github.js                 GitHub API 工具函数
├── local/
│   └── server.js                 本地开发 Express 服务器
└── vercel.json                   Vercel 部署配置
```
