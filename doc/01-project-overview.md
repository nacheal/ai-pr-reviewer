# 第 01 章：项目全景——一个 AI Agent 能做什么？

## 本章你将学到

- 什么是 AI Agent，它和普通 AI 问答有何不同
- PR Pilot 的整体架构和数据流
- 项目用到了哪些技术，各自的职责

---

## 什么是 AI Agent？

普通的 AI 问答是"一问一答"：你发消息，AI 回一条文字。

**AI Agent** 不同——它拥有**工具**，可以主动采取行动：

> 用户："帮我审查这个 PR"  
> Agent：先查一下 PR 基本信息……再拉取改动文件列表……再深入看几个关键文件……好，现在我可以出具报告了。

这种"思考 → 行动 → 观察 → 再思考"的循环叫做 **ReAct 模式**，是目前 AI Agent 最主流的设计范式。

---

## PR Pilot 做了什么？

用户粘贴一个 GitHub PR 链接，系统自动完成以下事情：

1. 调用 AI 模型（DeepSeek），告诉它"你是一名资深工程师，请审查这个 PR"
2. AI 调用工具，逐步拉取 PR 信息、文件列表、代码 Diff
3. AI 综合信息，生成结构化 Markdown 审查报告
4. 整个推理过程**实时流式展示**给用户——思考链、工具调用、最终报告

---

## 架构图

```
用户浏览器（React）
  │
  │  输入 PR URL，点击分析
  ▼
前端：EventSource（SSE 长连接）
  │
  │  GET /api/review?url=...
  ▼
后端：Vercel Serverless Function（api/review.js）
  │
  ├─→ 调用 DeepSeek API（AI 推理）
  │     ↕  工具调用（Function Calling）
  ├─→ 调用 GitHub REST API（拉取 PR 数据）
  │
  │  流式返回 SSE 事件
  ▼
前端：实时渲染推理过程 + 最终报告
```

---

## 技术栈一览

| 层级 | 技术 | 职责 |
|------|------|------|
| 前端框架 | React 19 | UI 渲染 |
| 前端路由 | React Router 7 | 页面切换 |
| 样式 | Tailwind CSS 4 | 深色主题 |
| Markdown 渲染 | react-markdown | 报告展示 |
| 构建工具 | Vite 8 | 开发/打包 |
| AI 模型 | DeepSeek（deepseek-chat） | 推理引擎 |
| AI 客户端 | OpenAI SDK | 兼容 DeepSeek API |
| 数据来源 | GitHub REST API v3 | PR 数据 |
| 部署 | Vercel Serverless | 无服务器运行 |
| 实时通信 | SSE（Server-Sent Events） | 流式推送 |

---

## 核心文件结构

```
src/
├── pages/
│   ├── Home.jsx         # 首页：输入框 + 历史列表
│   └── Review.jsx       # 分析页：推理过程 + 报告
├── components/
│   ├── PRInput.jsx       # PR 链接输入框
│   ├── ThinkingTimeline.jsx  # 推理过程时间轴
│   ├── ToolCallCard.jsx  # 工具调用卡片
│   └── ReviewReport.jsx  # Markdown 报告渲染
├── hooks/
│   ├── useAgentStream.js # SSE 消费 + 状态管理
│   └── useHistory.js     # 会话历史
└── lib/
    └── parsePRUrl.js     # PR URL 解析

api/
├── review.js    # Agent 核心：ReAct 循环 + SSE 端点
└── github.js    # GitHub API 工具函数
```

---

## 小结

- AI Agent = AI 模型 + 工具调用能力 + 循环推理
- PR Pilot 的核心价值是**让 AI 推理过程可见**，而不只是输出结果
- 前端负责展示，后端负责驱动 Agent 循环，两者通过 SSE 实时通信
- 整个项目无数据库，无用户登录，是一个纯粹的"AI 工具"

---

## 延伸阅读

- [ReAct: Synergizing Reasoning and Acting in Language Models（论文）](https://arxiv.org/abs/2210.03629)
- [OpenAI Function Calling 文档](https://platform.openai.com/docs/guides/function-calling)
- [DeepSeek API 文档](https://api-docs.deepseek.com/)
