# 第 02 章：开发环境搭建

## 本章你将学到

- 项目依赖的前置条件
- 如何配置 API Key
- 如何在本地完整运行项目

---

## 前置条件

在开始之前，请确认以下工具已安装：

| 工具 | 要求 | 验证命令 |
|------|------|---------|
| Node.js | 18+ | `node -v` |
| npm | 随 Node 附带 | `npm -v` |
| Git | 任意版本 | `git -v` |

还需要准备两个 API Key：

- **DeepSeek API Key**：在 [platform.deepseek.com](https://platform.deepseek.com/) 注册后获取，用于 AI 推理
- **GitHub Token**（可选）：在 GitHub → Settings → Developer settings → Personal access tokens 创建，用于提高 API 请求限额（无 Token 时为 60 次/小时，有 Token 时为 5000 次/小时）

---

## 安装步骤

**第一步：克隆代码**

```bash
git clone <你的仓库地址>
cd ai-pr-reviewer
```

**第二步：安装依赖**

```bash
npm install
```

**第三步：配置环境变量**

在项目根目录创建 `.env.local` 文件：

```bash
# .env.local（不会被提交到 Git）
DEEPSEEK_TOKEN=sk-xxxxxxxxxxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx   # 可选，但强烈推荐
```

> `.env.local` 已在 `.gitignore` 中，不会泄露到代码仓库。

---

## 本地启动

项目需要同时启动**两个服务**：

**终端 1：后端服务（端口 3001）**

```bash
node local/server.js
```

输出 `Server running on http://localhost:3001` 表示后端就绪。

**终端 2：前端开发服务器（端口 5173）**

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可使用。

---

## 为什么需要两个服务？

这是**前后端分离**架构的本地开发模式：

```
浏览器 (localhost:5173)
  ↓ 访问 /api/* 请求
Vite 开发服务器
  ↓ 代理转发（vite.config.js 配置）
Express 本地服务器 (localhost:3001)
  ↓ 动态 import api/*.js
Vercel Serverless Functions（本地模拟）
```

`vite.config.js` 中的代理配置：

```javascript
// vite.config.js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'  // 前端请求 /api/* 自动转发到后端
    }
  }
})
```

`local/server.js` 模拟 Vercel 的行为，动态加载 `api/` 目录下的模块并处理请求。

---

## 目录结构说明

```
.env.local          ← 你手动创建，存放私密 Key（不提交 Git）
local/server.js     ← 本地开发用的 Express 服务器
api/                ← Vercel Serverless Functions（生产和本地共用）
src/                ← React 前端代码
vite.config.js      ← Vite 配置（含开发代理）
vercel.json         ← Vercel 生产部署配置
```

---

## 验证是否成功

启动后，在首页输入以下 PR 链接进行测试：

```
https://github.com/facebook/react/pull/31168
```

如果看到推理过程开始流式出现，说明环境搭建成功。

---

## 小结

- 项目需要 DeepSeek Token 和 GitHub Token（可选），存放在 `.env.local`
- 本地开发需要同时运行后端（3001）和前端（5173）两个服务
- Vite 的代理功能让前端无感知地访问本地后端
- `local/server.js` 是为了在本地模拟 Vercel Serverless 环境

---

## 延伸阅读

- [Vite 开发服务器代理文档](https://vite.dev/config/server-options#server-proxy)
- [GitHub 个人 Token 创建指南](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
