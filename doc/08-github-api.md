# 第 08 章：GitHub API 集成

## 本章你将学到

- GitHub REST API 的基本用法
- 如何在 Node.js 中进行认证请求
- 如何处理常见错误（404、403、限流）

---

## 使用 GitHub REST API

GitHub 提供完整的 REST API，无需任何 SDK，直接用 `fetch` 发 HTTP 请求即可。

本项目用到了 3 个端点：

| 操作 | 端点 |
|------|------|
| 获取 PR 基本信息 | `GET /repos/{owner}/{repo}/pulls/{pull_number}` |
| 获取 PR 文件列表 | `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` |
| 获取文件 Diff | （从文件列表的 `patch` 字段中提取，无需单独请求） |

---

## 封装公共请求函数

`api/github.js` 封装了一个 `githubFetch` 函数，处理认证和错误：

```javascript
const GITHUB_API = 'https://api.github.com';

async function githubFetch(path) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 有 Token 时加上认证头（提高请求限额）
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`${GITHUB_API}${path}`, { headers });

  if (res.status === 404) {
    throw new Error('PR 不存在或仓库为私有');
  }
  if (res.status === 403) {
    throw new Error('GitHub API 请求限额已超出，请配置 GITHUB_TOKEN');
  }
  if (!res.ok) {
    throw new Error(`GitHub API 错误：${res.status}`);
  }

  return res.json();
}
```

**认证方式：Bearer Token**

HTTP 认证头格式：`Authorization: Bearer ghp_xxxxxxxxxx`

GitHub 提供两种访问级别：
- **无 Token**：60 次/小时（按 IP 计数）
- **有 Token**：5000 次/小时（按账号计数）

对于调试和低频使用，无 Token 勉强够用；生产环境强烈建议配置。

---

## 获取 PR 基本信息

```javascript
export async function getPrInfo(owner, repo, pullNumber) {
  const data = await githubFetch(
    `/repos/${owner}/${repo}/pulls/${pullNumber}`
  );

  // 只提取 AI 分析需要的字段，减少 token 消耗
  return {
    title: data.title,
    body: data.body,
    author: data.user.login,
    headBranch: data.head.ref,
    baseBranch: data.base.ref,
    state: data.state,
    createdAt: data.created_at,
    url: data.html_url,
  };
}
```

**只提取必要字段**：GitHub API 返回的 PR 对象包含几十个字段（标签、里程碑、审查者等），但 AI 只需要其中一小部分。提前过滤可以显著减少传给 AI 的 token 数量。

---

## 获取文件列表

```javascript
export async function getPrFiles(owner, repo, pullNumber) {
  const files = await githubFetch(
    `/repos/${owner}/${repo}/pulls/${pullNumber}/files`
  );

  return files.map(f => ({
    filename: f.filename,
    status: f.status,       // added / modified / removed / renamed
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
    patch: f.patch,         // diff 内容（可能为 undefined，如二进制文件）
  }));
}
```

---

## 获取文件 Diff

Diff 内容就包含在文件列表的 `patch` 字段中，不需要单独的 API 请求：

```javascript
export async function getFileDiff(owner, repo, pullNumber, filename) {
  const files = await getPrFiles(owner, repo, pullNumber);
  const file = files.find(f => f.filename === filename);

  if (!file) {
    return `文件 ${filename} 不在此 PR 的改动范围内`;
  }

  if (!file.patch) {
    return `（${filename} 是二进制文件或无 diff 内容）`;
  }

  // 超过 3000 字符时截断
  if (file.patch.length > 3000) {
    return file.patch.slice(0, 3000) + '\n\n... [diff 内容过长，已截断]';
  }

  return file.patch;
}
```

**Diff 格式（unified diff）：**

```diff
@@ -10,6 +10,8 @@ function foo() {
   const a = 1;
-  const b = 2;      // 删除的行（红色）
+  const b = 3;      // 新增的行（绿色）
+  const c = a + b;  // 新增的行
   return c;
 }
```

`-` 开头的行是删除，`+` 开头的行是新增，无前缀是上下文行。

---

## 错误处理策略

本项目遵循"在边界处理错误"的原则：

```javascript
// 工具执行层捕获错误，转为 SSE 错误事件
async function executeTool(name, input) {
  try {
    const data = await /* 实际工具调用 */;
    return { data };
  } catch (err) {
    // 把错误转换为 AI 可读的字符串，让 AI 决定如何处理
    return { data: `工具执行失败: ${err.message}` };
  }
}
```

工具错误不直接终止 Agent，而是作为"观察结果"告诉 AI，让 AI 自己决定是否换一个工具或直接报错。

---

## 小结

- GitHub REST API 无需 SDK，直接用 `fetch` 调用
- 用 `Authorization: Bearer <token>` 头认证，大幅提升请求限额
- 只传 AI 需要的字段，减少 token 消耗
- Diff 内容包含在文件列表里，无需额外请求
- 工具错误转为可读字符串传给 AI，让 AI 自行处理

---

## 延伸阅读

- [GitHub REST API 文档](https://docs.github.com/en/rest)
- [GitHub Pulls API](https://docs.github.com/en/rest/pulls/pulls)
- [Unified diff 格式说明](https://en.wikipedia.org/wiki/Diff#Unified_format)
