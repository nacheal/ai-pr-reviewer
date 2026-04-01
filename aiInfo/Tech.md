# PR Pilot — 技术架构文档

**版本：** v1.0  
**日期：** 2026-04-01

---

## 1. 技术栈总览

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| Vite | 5.x | 构建工具 |
| React Router | 6.x | 客户端路由 |
| Tailwind CSS | 3.x | 样式框架 |
| shadcn/ui | latest | UI 组件库 |

### 后端

| 技术 | 用途 |
|------|------|
| Node.js + Express | API Server，处理 Agent 逻辑 |
| Vercel Serverless Functions | 生产环境部署（替代 Express） |

### AI 服务

| 技术 | 用途 |
|------|------|
| Anthropic Claude API | Agent 推理引擎，Tool Use 支持最完善 |
| 模型 | `claude-sonnet-4-20250514` |

### 外部 API

| 技术 | 用途 |
|------|------|
| GitHub REST API v3 | 拉取 PR 信息、文件列表、Diff 内容 |

### 基础设施

| 技术 | 用途 |
|------|------|
| Vercel | 前端 + Serverless Functions 托管 |
| GitHub | 代码仓库 |

---

## 2. 系统架构

```
用户浏览器（React SPA）
    │
    │ 1. 用户输入 PR 链接，点击分析
    │
    ▼
Vercel Serverless Function: /api/review  (SSE 长连接)
    │
    │ 2. 解析 PR 链接参数
    │
    ▼
Agent 推理引擎（ReAct Loop）
    │
    ├── Reasoning: 调用 Claude API（Tool Use 模式）
    │       │
    │       │ Claude 返回：思考文字 + 工具调用指令
    │       │
    ├── Action: 执行工具调用 → GitHub REST API
    │       │
    │       │ 返回：PR信息 / 文件列表 / Diff内容
    │       │
    ├── Observation: 将工具结果注入下一轮对话
    │       │
    │       └── 循环直到 Claude 不再调用工具
    │
    │ 3. 每个步骤通过 SSE 实时推送给前端
    │
    ▼
前端实时渲染
    ├── 思考文字流式展示
    ├── 工具调用卡片逐步出现
    └── 最终报告渲染
```

---

## 3. Agent 核心实现

### 3.1 ReAct 循环伪代码

```javascript
async function* runAgent(prUrl) {
  const messages = [{ role: "user", content: buildSystemPrompt(prUrl) }];
  const tools = [getPrInfoTool, getPrFilesTool, getFileDiffTool];

  while (true) {
    // 调用 Claude，开启 Tool Use
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools,
      messages,
      stream: true,
    });

    // 流式推送思考文字
    for await (const chunk of response) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        yield { type: "thinking", text: chunk.delta.text };
      }
    }

    const finalResponse = await response.finalMessage();

    // 如果 Claude 不再调用工具，循环结束
    if (finalResponse.stop_reason === "end_turn") {
      yield { type: "report", content: extractReport(finalResponse) };
      break;
    }

    // 执行工具调用
    for (const toolUse of getToolUseBlocks(finalResponse)) {
      yield { type: "tool_start", name: toolUse.name, input: toolUse.input };

      const result = await executeTool(toolUse.name, toolUse.input);

      yield { type: "tool_done", name: toolUse.name, result: summarize(result) };

      // 将工具结果注入对话历史
      messages.push({ role: "assistant", content: finalResponse.content });
      messages.push({ role: "user", content: buildToolResult(toolUse.id, result) });
    }
  }
}
```

### 3.2 工具定义（Tool Schemas）

```javascript
const tools = [
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
你会收到一个 GitHub Pull Request 的链接，需要对其进行全面的代码审查。

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
// 思考文字（流式，多次触发）
{ type: "thinking", text: string }

// 工具调用开始
{ type: "tool_start", name: string, input: Record<string, any> }

// 工具调用完成
{ type: "tool_done", name: string, durationMs: number }

// 最终报告（触发一次，markdown 字符串）
{ type: "report", content: string }

// 错误
{ type: "error", message: string }

// 结束信号
{ type: "done" }
```

**前端消费示例：**

```javascript
const es = new EventSource(`/api/review?url=${encodeURIComponent(prUrl)}`);
es.onmessage = (e) => {
  const event = JSON.parse(e.data);
  dispatch(event); // 更新 React 状态
};
```

---

## 5. 目录结构

```
pr-pilot/
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
│   │   └── useAgentStream.js     # SSE 消费 Hook
│   └── lib/
│       └── parsePRUrl.js         # PR 链接解析工具函数
│
├── api/                          # Vercel Serverless Functions
│   └── review.js                 # Agent 主逻辑（SSE 端点）
│
├── .env.local                    # 本地环境变量（不提交 Git）
├── vercel.json                   # Vercel 配置
└── vite.config.js
```

---

## 6. 环境变量

```env
# .env.local（本地开发）
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...             # GitHub Personal Access Token（提升 API 限额）

# Vercel 环境变量（生产）
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
```

> GitHub Token 可选，但强烈建议配置：未认证请求限额 60次/小时，认证后 5000次/小时。

---

## 7. 关键技术决策说明

| 决策 | 选择 | 理由 |
|------|------|------|
| AI SDK | 直接调用 Anthropic API | 2周内完成，学习底层原理比上框架更重要 |
| 通信协议 | SSE 而非 WebSocket | Vercel Serverless 对 WebSocket 支持有限，SSE 实现更简单 |
| 后端 | Vercel Serverless Functions | 无需独立服务器，与前端同仓库部署 |
| 状态管理 | React useState/useReducer | 规模小，无需引入 Redux/Zustand |
| 样式 | Tailwind CSS + shadcn/ui | 延续 AI File Hub 技术栈，上手快 |

---

*文档结束*