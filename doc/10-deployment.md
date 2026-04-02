# 第 10 章：生产部署——Vercel Serverless

## 本章你将学到

- 什么是 Serverless，为什么选 Vercel
- `vercel.json` 的关键配置
- 如何配置环境变量
- 部署后的注意事项

---

## 为什么选 Vercel？

本项目是一个前端 + 少量后端 API 的应用，不需要一直运行的服务器。Vercel 的优势：

- **零配置部署**：连接 GitHub 仓库，每次 push 自动部署
- **Serverless Functions**：`api/` 目录下的文件自动成为云函数
- **免费额度充足**：个人项目完全够用
- **全球 CDN**：静态文件全球加速

---

## 什么是 Serverless？

传统服务器：你的代码一直在运行，等待请求到来。

**Serverless（无服务器）**：代码只在有请求时才启动运行，处理完后销毁，下次请求再次启动。

```
传统服务器：[启动] ——一直运行—— [请求到来] → [处理] → [继续运行]
Serverless： [空闲]               [请求到来] → [冷启动] → [处理] → [销毁]
```

**对本项目的影响：**
- 优点：不需要管理服务器，不需要持续付费
- 注意：每个函数执行时间有上限（Vercel 免费版 10s，Pro 版 60s）

---

## vercel.json 配置详解

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ],
  "functions": {
    "api/review.js": {
      "maxDuration": 60
    }
  }
}
```

**`rewrites`（重写规则）**

将所有 `/api/*` 的请求路由到 `api/` 目录下对应的文件。例如：
- `/api/review` → `api/review.js`
- `/api/github` → `api/github.js`

没有这条规则，Vercel 不知道如何处理 API 请求。

**`maxDuration`**

AI 分析一个 PR 可能需要 30~60 秒（多轮 AI 调用 + GitHub API 调用）。默认的 10s 超时会导致分析中途被切断。

```json
"api/review.js": {
  "maxDuration": 60   // 单位：秒，Pro 版最高 300s，免费版最高 60s
}
```

> 只有 `review.js` 需要延长超时，其他 API 文件保持默认即可。

---

## Serverless Function 的接口约定

Vercel Serverless Function 的函数签名与 Express 类似：

```javascript
// api/review.js
export default async function handler(req, res) {
  // req.query   → URL 查询参数（?url=...）
  // req.body    → 请求体（POST 请求）
  // req.method  → 'GET' / 'POST' 等
  // res.json()  → 返回 JSON
  // res.write() → 写入流（SSE 用到）
  // res.end()   → 结束响应
}
```

本地开发的 `local/server.js` 就是用 Express 模拟这个接口，所以同一份代码在本地和生产都能运行。

---

## 配置环境变量

**本地开发**：在 `.env.local` 文件中

```bash
DEEPSEEK_TOKEN=sk-xxxxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxx
```

**生产环境（Vercel）**：在控制台配置

1. 进入 Vercel 项目 Dashboard
2. Settings → Environment Variables
3. 添加 `DEEPSEEK_TOKEN` 和 `GITHUB_TOKEN`
4. 选择适用环境（Production / Preview / Development）
5. 重新部署（变量修改后需要重新部署才生效）

> 切记不要把包含 API Key 的 `.env.local` 文件提交到 Git！项目的 `.gitignore` 已经排除了这个文件。

---

## 部署流程

**首次部署：**

```bash
# 安装 Vercel CLI
npm i -g vercel

# 在项目根目录执行
vercel

# 按提示配置项目，完成后获得部署 URL
```

**后续部署（自动）：**

连接 GitHub 仓库后，每次 push 到 `main` 分支自动触发部署。

**手动触发：**

```bash
vercel --prod
```

---

## 本地与生产的差异

| 方面 | 本地 | 生产（Vercel） |
|------|------|---------------|
| 前端服务 | Vite dev server (5173) | Vercel CDN |
| 后端服务 | Express (3001) | Vercel Serverless |
| API 代理 | Vite proxy → localhost:3001 | 直接路由到函数 |
| 环境变量 | `.env.local` | Vercel Dashboard |
| 超时 | 无限制 | maxDuration 配置 |
| 冷启动 | 无 | 首次请求约 500ms~2s |

---

## 小结

- Vercel 让你专注写代码，不需要管服务器
- `api/` 目录下的文件自动成为 Serverless Function
- AI 分析耗时较长，要配置 `maxDuration: 60` 防止超时
- 环境变量在 Vercel Dashboard 配置，永远不要提交到 Git
- 本地 `local/server.js` 用 Express 模拟 Vercel 函数接口，代码本地/生产可复用

---

## 延伸阅读

- [Vercel Serverless Functions 文档](https://vercel.com/docs/functions)
- [Vercel 环境变量文档](https://vercel.com/docs/projects/environment-variables)
- [vercel.json 配置参考](https://vercel.com/docs/projects/project-configuration)
