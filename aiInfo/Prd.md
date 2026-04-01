# PR Pilot — 产品需求文档（PRD）

**版本：** v1.0  
**日期：** 2026-04-01  
**状态：** 开发中

---

## 1. 项目概述

### 1.1 项目背景

PR Pilot 是一个面向开发者的 GitHub PR 智能审查工具。用户输入任意 GitHub PR 链接，系统通过 AI Agent 自动拉取代码变更，像资深工程师一样对代码进行多维度分析，并生成结构化 Review 报告。推理过程实时可见，帮助用户理解 Agent 的决策逻辑。

### 1.2 项目目标

- 交付一个可公开访问的 AI Agent Web 应用
- 掌握 Tool Use / Function Calling 与 ReAct 推理循环的实现原理
- 展示"思考链可视化"的 AI 产品交互范式
- 作为求职作品集的核心项目，体现 AI 产品前端工程能力

### 1.3 目标用户

个人开发者、技术 Leader，需要快速对 PR 进行初步代码审查，或希望了解 AI Agent 工作方式的学习者。

---

## 2. 功能需求

### 2.1 PR 输入与解析（F-01）

- 用户在首页输入框粘贴 GitHub PR 链接（格式：`https://github.com/{owner}/{repo}/pull/{number}`）
- 系统解析链接，提取 owner、repo、PR number
- 校验链接格式，格式错误时给出明确提示
- 支持公开仓库，暂不支持私有仓库（v1.0）

### 2.2 Agent 分析流程（F-02）

Agent 采用 **ReAct 推理循环**（Reasoning → Action → Observation），通过多次工具调用完成分析：

**工具列表：**

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `get_pr_info` | 获取 PR 基本信息（标题、描述、作者、分支） | owner, repo, pull_number |
| `get_pr_files` | 获取 PR 变更文件列表及增删行数 | owner, repo, pull_number |
| `get_file_diff` | 获取指定文件的完整 diff 内容 | owner, repo, pull_number, filename |

**Agent 决策流程（示意）：**

1. 调用 `get_pr_info` → 了解 PR 背景
2. 调用 `get_pr_files` → 获取变更文件列表
3. 根据文件重要性（如核心逻辑文件优先），选择 1~3 个关键文件
4. 对每个文件调用 `get_file_diff` → 分析具体变更
5. 综合所有信息，生成最终 Review 报告

### 2.3 思考链实时展示（F-03）

- Agent 每次工具调用前的推理文字实时流式展示给用户
- 每次工具调用的动作和结果以卡片形式展示（工具名 + 参数摘要 + 状态）
- 展示形式参考 "Terminal 日志" 风格，带 loading 动画
- 用户可看到完整的"思考 → 行动 → 观察"过程

### 2.4 Review 报告生成（F-04）

分析完成后生成结构化报告，包含以下模块：

**整体评价**
- PR 目的摘要（1~2 句话）
- 总体质量评分（Good / Needs Work / Risky）

**问题清单**（按严重程度分级）

| 级别 | 说明 |
|------|------|
| 🔴 Critical | 逻辑错误、安全风险、会导致 Bug 的代码 |
| 🟡 Warning | 代码风格问题、可读性差、潜在性能问题 |
| 🟢 Suggestion | 可选优化项、最佳实践建议 |

**亮点（可选）**
- 值得肯定的良好实践

**总结建议**
- 是否建议 Approve，附上核心理由

### 2.5 历史记录（F-05）

- 当前 Session 内保留已分析的 PR 列表（刷新后清空）
- 点击历史记录可直接查看对应报告（不重复调用 API）

---

## 3. 非功能需求

| 类别 | 要求 |
|------|------|
| 性能 | Agent 首次工具调用响应 ≤ 5 秒；完整报告生成 ≤ 60 秒 |
| 安全 | GitHub Token 与 AI API Key 仅在服务端持有，不暴露前端 |
| 错误处理 | 网络超时、GitHub API 限流、PR 不存在等情况均有明确提示 |
| 响应式 | 支持桌面端（≥1024px），移动端可访问但不做深度适配 |
| 部署 | 部署至 Vercel，可通过公网 URL 访问 |

---

## 4. 页面与路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | PR 链接输入框 + 历史记录列表 |
| `/review/:owner/:repo/:pull` | 分析页 | 思考链展示 + Review 报告 |

---

## 5. UI 设计规范

### 设计风格
- 整体风格：工程感、终端感，参考 Linear / Vercel Dashboard 视觉语言
- 深色主题（Dark Mode 为主）
- 代码相关内容使用等宽字体（`JetBrains Mono` / `Fira Code`）

### 核心组件

| 组件 | 说明 |
|------|------|
| `PRInput` | 首页 PR 链接输入框，带格式校验与 loading 状态 |
| `ThinkingTimeline` | 思考链时间轴，每个步骤展示推理文字 + 工具调用卡片 |
| `ToolCallCard` | 单次工具调用展示：工具名、参数摘要、执行状态、耗时 |
| `ReviewReport` | 最终报告展示：整体评价 + 问题清单 + 总结 |
| `IssueBadge` | 问题严重程度标签（Critical / Warning / Suggestion） |
| `HistoryList` | 侧边栏历史 PR 列表 |

---

## 6. 验收标准

- [ ] 可通过公网 URL 访问（Vercel 生产环境）
- [ ] 输入合法 PR 链接后，Agent 自动开始分析，无需额外操作
- [ ] 思考链过程实时流式展示，用户能看到每次工具调用
- [ ] 分析完成后生成完整结构化报告，包含问题分级
- [ ] 错误场景（链接错误、网络超时、PR 不存在）有明确用户提示
- [ ] GitHub Token 和 AI API Key 不暴露在浏览器网络请求中
- [ ] 当前 Session 历史记录正常显示
- [ ] 部署至 Vercel，README 包含项目介绍和技术架构说明

---

*文档结束*