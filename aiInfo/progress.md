# PR Pilot — 开发进度记录

**最后更新：** 2026-04-01  
**当前阶段：** 阶段一完成，准备进入阶段二

---

## 整体进度

| 阶段 | 时间 | 目标 | 状态 |
|------|------|------|------|
| 阶段一：地基 | Day 1-2 | 项目初始化 + GitHub API 打通 | ✅ 完成 |
| 阶段二：Agent 引擎 | Day 3-5 | ReAct 循环跑通，Tool Use 实现 | ⏳ 待开始 |
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
│   └── test-github.js            ✅ API 连通验证脚本
├── aiInfo/
│   ├── Prd.md
│   ├── Tech.md
│   ├── Todo.md
│   └── progress.md               （本文件）
├── .env.local                    ✅ 已配置 API Key
├── vercel.json                   ✅ Vercel 路由配置
└── vite.config.js                ✅ Tailwind + /api 代理配置
```

### 已安装依赖
- `react` + `react-dom` 18.x
- `react-router-dom` 6.x
- `@anthropic-ai/sdk`
- `tailwindcss` + `@tailwindcss/vite`
- `react-markdown` + `remark-gfm`

### 关键配置
- `.env.local` 中已配置：
  - `ANTHROPIC_API_KEY=sk-user-8a3ab7f7b1acf081d8bfa80d`
  - `ANTHROPIC_BASE_URL=http://154.44.8.201:3400/claude/awsbedrock`（自定义代理）
  - `GITHUB_TOKEN=`（**待填写**，未填时 GitHub API 限额 60次/小时）
- `package.json` 使用 `"type": "module"`，所有 `api/` 文件必须用 ESM（`import/export`）语法

### 验证结果
- ✅ GitHub API 连通，`node api/test-github.js` 成功拉取 facebook/react PR 数据

---

## 阶段二：下一步任务（Day 3-5）

### 立即要做（Day 3）

1. **理解并测试 Claude Tool Use API**
   - 模型使用 `claude-sonnet-4-20250514`
   - API Key 通过自定义代理，`baseURL` 需设为 `process.env.ANTHROPIC_BASE_URL`
   - 写最小 Demo：��义一个工具，让 Claude 调用，打印结果

2. **在 `api/review.js` 中定义三个 Tool Schema**（参考 Tech.md 3.2 节）
   - `get_pr_info`
   - `get_pr_files`
   - `get_file_diff`

### Day 4

3. **实现 ReAct 循环核心**：`runAgent(owner, repo, pullNumber)` 异步生成器
   - 循环：Claude 返回工具调用 → 执行工具 → 注入结果 → 再次调用 Claude
   - 终止条件：`stop_reason === "end_turn"`
   - 最大迭代次数：`maxIterations = 10`

4. **本地调试**：终端打印每一步思考内容、工具调用、工具结果

### Day 5

5. **完善 System Prompt**（参考 Tech.md 3.3 节）
6. **边界情况处理**：PR 不存在、Diff 过长、超出最大迭代次数
7. **验收**：命令行运行 Agent，完整打印推理链 + 最终报告

---

## 注意事项

- **`ANTHROPIC_BASE_URL` 是自定义代理**，初始化 Anthropic 客户端时需要显式传入：
  ```javascript
  import Anthropic from '@anthropic-ai/sdk';
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });
  ```
- **Diff 截断**：单文件超 3000 字符时截断（已在 `api/github.js` 实现）
- **模型 ID**：`claude-sonnet-4-20250514`（Tech.md 规定）
- **本地开发启动**：前端 `npm run dev`，后端 API 需要单独起 Express 服务（Day 6 配置）

---

*文档结束*
