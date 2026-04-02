# Vercel 部署指南（在线操作）

---

## 前置准备

确认以下文件已就绪：
- `vercel.json` — 已配置 `maxDuration: 60`
- `api/review.js` — 使用 ESM（`import/export`），Vercel 会自动识别
- `package.json` — `"type": "module"`

---

## 步骤一：推送代码到 GitHub

1. 在 GitHub 创建新仓库（公开 / 私有均可）
2. 在项目根目录执行：

```bash
git init
git add .
git commit -m "init: pr-pilot ai code reviewer"
git remote add origin https://github.com/你的用户名/pr-pilot.git
git push -u origin main
```

> 确认 `.gitignore` 中包含 `.env.local`，不要上传密钥。

---

## 步骤二：导入项目到 Vercel

1. 打开 [vercel.com](https://vercel.com)，登录账号
2. 点击 **"Add New → Project"**
3. 选择刚才创建的 GitHub 仓库，点击 **Import**
4. 配置页面：
   - **Framework Preset**：自动识别为 `Vite`，保持默认
   - **Root Directory**：保持默认（项目根目录）
   - **Build Command**：`npm run build`（默认）
   - **Output Directory**：`dist`（默认）

---

## 步骤三：配置环境变量

在配置页面找到 **"Environment Variables"** 区域，添加以下变量：

| Name | Value | 说明 |
|------|-------|------|
| `DEEPSEEK_TOKEN` | `sk-...` | DeepSeek API Token，必填 |
| `GITHUB_TOKEN` | `ghp_...` | GitHub PAT，强烈建议填写（避免 60次/小时限额） |

**添加方法：**
- Key 填变量名，Value 填对应值
- Environment 选 **Production**（也可同时勾选 Preview）
- 点击 **Add** 确认每个变量

---

## 步骤四：部署

点击 **"Deploy"** 按钮，等待约 1~2 分钟。

部署成功后，Vercel 会分配一个域名，格式类似：
```
https://pr-pilot-xxx.vercel.app
```

---

## 步骤五：冒烟测试

打开部署后的 URL，测试以下场景：

- [ ] 输入合法 PR 链接，Agent 开始分析，思考链实时展示
- [ ] 分析完成，生成完整报告
- [ ] 输入非法链接，显示红色错误提示
- [ ] 输入不存在的 PR，显示 "PR not found" 错误

推荐测试链接：
```
https://github.com/facebook/react/pull/31168
https://github.com/vercel/next.js/pull/60000
```

---

## 常见问题

### 部署后 `/api/review` 返回 500
- 检查 Vercel 控制台 → Functions 日志
- 最常见原因：`DEEPSEEK_TOKEN` 未配置或填错

### 分析超时（请求中断）
- `vercel.json` 已设置 `maxDuration: 60`，Vercel Hobby 计划最大支持 60 秒
- 如仍超时，考虑升级 Pro 计划（最大 300 秒）

### GitHub API 限流（403 错误）
- 未配置 `GITHUB_TOKEN` 时，匿名请求限额 60次/小时
- 在 Vercel 环境变量中补充 `GITHUB_TOKEN`

### 前端页面正常但 API 不通
- 检查 `vercel.json` 中的 `rewrites` 配置是否正确
- 确认 `api/review.js` 文件名和路径与路由匹配

---

## 后续更新部署

代码推送到 GitHub `main` 分支后，Vercel 自动触发重新部署，无需手动操作。
