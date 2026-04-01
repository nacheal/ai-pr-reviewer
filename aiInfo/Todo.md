# PR Pilot — 任务拆分文档

**版本：** v1.0  
**日期：** 2026-04-01  
**总工期：** 14天

---

## 整体里程碑

| 阶段 | 时间 | 目标 |
|------|------|------|
| 阶段一：地基 | Day 1-2 | 项目初始化 + GitHub API 打通 |
| 阶段二：Agent 引擎 | Day 3-5 | ReAct 循环跑通，Tool Use 实现 |
| 阶段三：流式推送 | Day 6-7 | SSE 接入前端，思考链实时展示 |
| 阶段四：报告与 UI | Day 8-11 | 结构化报告 + 前端 UI 打磨 |
| 阶段五：上线收尾 | Day 12-14 | 部署 + 错误处理 + README + Demo |

---

## 阶段一：地基（Day 1-2）

### Day 1

- [ ] **初始化项目结构**
  - `npm create vite@latest pr-pilot -- --template react`
  - 安装 Tailwind CSS、shadcn/ui、React Router
  - 创建 `api/` 目录，配置 `vercel.json`

- [ ] **配置环境变量**
  - 创建 `.env.local`，填入 `ANTHROPIC_API_KEY` 和 `GITHUB_TOKEN`
  - 在 `.gitignore` 中确认 `.env.local` 已排除

- [ ] **GitHub API 验证**
  - 在 `api/review.js` 中写一个测试函数
  - 手动调用 GitHub API，验证能拉取 PR 信息：
    ```
    GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}
    GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files
    ```
  - 打印结果，确认数据结构

### Day 2

- [ ] **封装 GitHub API 工具函数**
  - `getPrInfo(owner, repo, pullNumber)` → 返回标题、描述、作者、分支
  - `getPrFiles(owner, repo, pullNumber)` → 返回文件列表（filename, additions, deletions, status）
  - `getFileDiff(owner, repo, pullNumber, filename)` → 返回 patch 字符串

- [ ] **PR 链接解析函数**
  - `parsePRUrl(url)` → 返回 `{ owner, repo, pullNumber }` 或抛出错误
  - 写单元测试验证正常链接和异常链接

- [ ] **验收**：在 Node.js 脚本中，传入真实 PR 链接，能打印出三个工具的返回数据

---

## 阶段二：Agent 引擎（Day 3-5）

### Day 3

- [ ] **理解 Claude Tool Use API**
  - 阅读文档：https://docs.anthropic.com/en/docs/tool-use
  - 用 Node.js 写一个最小 Demo：定义一个工具，让 Claude 调用它，打印结果

- [ ] **定义三个 Tool Schema**
  - 按照 tech.md 中的格式，在 `api/review.js` 中定义 `tools` 数组
  - 确认 JSON Schema 格式正确

### Day 4

- [ ] **实现 ReAct 循环核心逻辑**
  - 实现 `runAgent(owner, repo, pullNumber)` 异步生成器函数
  - 循环结构：Claude 返回工具调用 → 执行工具 → 将结果注入消息 → 再次调用 Claude
  - 终止条件：`stop_reason === "end_turn"`

- [ ] **本地调试 Agent 循环**
  - 传入真实 PR，在终端打印每一步：思考内容、工具调用、工具结果
  - 确认 Agent 能自主完成多步推理，不需要人工干预

### Day 5

- [ ] **编写 System Prompt**
  - 按 tech.md 中的模板编写，调试 Prompt 使报告格式稳定
  - 测试 3 个不同的真实 PR，确认报告质量可接受

- [ ] **处理边界情况**
  - PR 不存在（GitHub API 返回 404）
  - Diff 内容过长（截断处理，避免超出 Claude 上下文）
  - Agent 调用工具次数上限（设置 max_iterations = 10，防止死循环）

- [ ] **验收**：命令行运行 Agent，输入 PR 链接，终端完整打印推理链 + 最终报告

---

## 阶段三：流式推送（Day 6-7）

### Day 6

- [ ] **实现 SSE 端点**
  - 将 `api/review.js` 改造为 SSE 响应（设置正确的 Content-Type 和 headers）
  - 将 `runAgent` 每个 yield 事件序列化为 `data: {...}\n\n` 格式推送
  - 本地用 `curl` 测试 SSE 端点，确认事件流正常输出

- [ ] **配置 Vite 本地代理**
  - 在 `vite.config.js` 中配置 proxy，将 `/api` 请求转发到本地 Express 或 Node 服务

### Day 7

- [ ] **前端 SSE 消费 Hook**
  - 实现 `useAgentStream(prUrl)` Hook
  - 内部使用 `EventSource` 连接 SSE 端点
  - 将事件 dispatch 到 `useReducer` 管理的状态
  - 状态结构：
    ```javascript
    {
      status: "idle" | "running" | "done" | "error",
      thinkingText: string,       // 累积的思考文字
      toolCalls: ToolCall[],      // 工具调用历史
      report: string | null,      // 最终报告 markdown
      error: string | null,
    }
    ```

- [ ] **验收**：前端能实时接收到 Agent 推送的每个事件，console.log 可见

---

## 阶段四：报告与 UI（Day 8-11）

### Day 8 — 思考链 UI

- [ ] **ThinkingTimeline 组件**
  - 时间轴布局，每个步骤一个节点
  - 思考文字：流式追加，带打字机效果
  - 工具调用卡片：展示工具名（中文别名）、参数摘要、状态（running / done）、耗时

- [ ] **页面状态管理**
  - 分析中：展示 ThinkingTimeline，带进度感
  - 分析完成：ThinkingTimeline 折叠，展示报告

### Day 9 — Review 报告 UI

- [ ] **ReviewReport 组件**
  - 渲染 markdown 报告（使用 `react-markdown` + `remark-gfm`）
  - 整体评价区域：评级徽章（Good=绿 / Needs Work=黄 / Risky=红）
  - 问题清单：Critical / Warning / Suggestion 分区，带颜色标记
  - 代码引用部分使用等宽字体

- [ ] **IssueBadge 组件**
  - 三种颜色样式的标签组件

### Day 10 — 首页与导航

- [ ] **首页 PRInput 组件**
  - 大输入框居中，带占位文字
  - 实时校验 PR 链接格式
  - 分析中显示 loading 状态，禁止重复提交

- [ ] **HistoryList 组件**（当前 Session 缓存）
  - 侧边栏或首页下方展示历史分析的 PR 列表
  - 使用 `sessionStorage` 或 React Context 存储
  - 点击跳转对应报告页

### Day 11 — 整体 UI 打磨

- [ ] **整体视觉统一**
  - 深色主题配色
  - 代码字体引入（JetBrains Mono via Google Fonts）
  - 动画：工具卡片出现动画、流式文字淡入效果

- [ ] **响应式适配**
  - 桌面端双栏（思考链 + 报告）
  - 窄屏单栏（报告在下）

- [ ] **验收**：完整走一遍用户流程，视觉效果满意

---

## 阶段五：上线收尾（Day 12-14）

### Day 12 — 错误处理

- [ ] **前端错误状态**
  - PR 链接格式错误：输入框红色提示
  - 网络超时 / SSE 断开：展示重试按钮
  - Agent 返回 error 事件：展示错误信息卡片

- [ ] **后端错误处理**
  - GitHub API 404（PR 不存在）→ 返回明确错误信息
  - GitHub API 限流（403）→ 提示用户配置 Token
  - Claude API 超时 → 优雅降级

### Day 13 — 部署上线

- [ ] **Vercel 部署配置**
  - 在 Vercel 控制台配置环境变量（`ANTHROPIC_API_KEY`、`GITHUB_TOKEN`）
  - 检查 `vercel.json` 路由配置（`/api/*` 路由到 Serverless Functions）
  - 首次部署，验证生产环境能正常运行

- [ ] **生产环境冒烟测试**
  - 输入 3 个真实 PR 链接测试完整流程
  - 测试错误场景（输入非法链接）

### Day 14 — 收尾

- [ ] **README.md 编写**
  - 项目介绍（1段话）
  - 技术架构图（文字版）
  - 核心技术点说明（Tool Use、ReAct、SSE）
  - 本地运行指南
  - 在线 Demo 链接

- [ ] **录制 Demo 视频**（可选，强烈建议）
  - 1~2 分钟，展示完整分析流程
  - 上传至 GitHub README 或 YouTube

- [ ] **最终验收**
  - 对照 PRD 验收标准逐条确认
  - 推送代码，确认 Vercel 自动部署成功

---

## 开发注意事项

**先跑通，再优化**：每个阶段以"能 work"为第一目标，UI 和细节留到 Day 8+ 统一打磨。

**测试用 PR 推荐**：选择文件数量适中（5~15个文件）、有明确功能的 PR，避免超大 PR 导致 Token 超限。

**Diff 截断策略**：单文件 diff 超过 3000 字符时，只保留前 3000 字符并追加提示，防止上下文窗口溢出。

**工具调用次数限制**：设置 `maxIterations = 10`，超出后强制结束并返回已有分析结果。

---

*文档结束*