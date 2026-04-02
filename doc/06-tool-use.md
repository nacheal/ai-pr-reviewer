# 第 06 章：Tool Use / Function Calling

## 本章你将学到

- Function Calling 是什么，解决了什么问题
- 如何定义工具让 AI 可以调用
- 工具执行结果如何传回 AI

---

## 为什么需要 Tool Use？

AI 语言模型的知识是静态的（训练时截止），它不能：

- 访问互联网
- 查询实时数据（你的 PR 内容）
- 执行代码

**Function Calling（工具调用）**解决了这个问题：AI 不直接获取数据，而是"描述它想要做什么"，由我们的代码去实际执行，再把结果交还给 AI。

---

## 工具定义

在 `api/review.js` 中，我们用 OpenAI 格式定义了 3 个工具：

```javascript
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_pr_info',
      description: '获取 GitHub PR 的基本信息，包括标题、描述、作者、分支、状态',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'GitHub 用户名或组织名' },
          repo:  { type: 'string', description: '仓库名称' },
          pull_number: { type: 'integer', description: 'PR 编号' },
        },
        required: ['owner', 'repo', 'pull_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pr_files',
      description: '获取 PR 中所有改动文件的列表及统计信息',
      parameters: { /* 同上，相同的三个参数 */ },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_diff',
      description: '获取 PR 中某个具体文件的代码 Diff（patch 内容）',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo:  { type: 'string' },
          pull_number: { type: 'integer' },
          filename: { type: 'string', description: '文件路径，如 src/index.js' },
        },
        required: ['owner', 'repo', 'pull_number', 'filename'],
      },
    },
  },
];
```

**`description` 非常重要**——AI 就是靠这个字段决定什么时候调用哪个工具、传什么参数。描述越清晰，AI 的判断越准确。

---

## AI 如何"调用"工具？

AI 不会真的执行代码。当它决定使用工具时，模型输出一个特殊的 JSON 结构而非普通文字：

```json
{
  "role": "assistant",
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_pr_files",
        "arguments": "{\"owner\":\"facebook\",\"repo\":\"react\",\"pull_number\":31168}"
      }
    }
  ]
}
```

我们的代码检测到这个结构，提取工具名和参数，然后去真正执行。

---

## 工具执行分发

```javascript
// api/review.js
async function executeTool(name, input) {
  const start = Date.now();
  let data;

  if (name === 'get_pr_info') {
    data = await getPrInfo(input.owner, input.repo, input.pull_number);
  } else if (name === 'get_pr_files') {
    data = await getPrFiles(input.owner, input.repo, input.pull_number);
  } else if (name === 'get_file_diff') {
    data = await getFileDiff(input.owner, input.repo, input.pull_number, input.filename);
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }

  return { data, duration: Date.now() - start };
}
```

---

## 把结果交还给 AI

执行完工具后，把结果以 `role: 'tool'` 的形式加入消息历史：

```javascript
messages.push({
  role: 'tool',
  tool_call_id: 'call_abc123',   // 必须对应 AI 发出的 tool_call id
  content: JSON.stringify(data), // 工具返回的数据，序列化为字符串
});
```

然后带着更新后的 `messages` 再次调用 AI，它就能看到工具执行结果了。

---

## 完整的一轮工具调用流程

```
1. 我们调用 AI，messages 里有用户问题 + 工具定义

2. AI 响应：输出 tool_calls（不是普通文字）
   {
     tool_calls: [{ id: "call_1", function: { name: "get_pr_info", arguments: "..." } }]
   }

3. 我们执行工具：getPrInfo(owner, repo, pullNumber) → { title, body, author, ... }

4. 把工具结果加入 messages：
   { role: "tool", tool_call_id: "call_1", content: '{"title":"Fix bug in ..."}' }

5. 再次调用 AI，这次 AI 能看到工具结果，继续推理

6. AI 可能再次调用工具，或直接输出最终报告
```

---

## Diff 内容的截断处理

PR 文件的 Diff 可能非常长，超过 AI 的上下文窗口限制。`api/github.js` 里有截断处理：

```javascript
export async function getFileDiff(owner, repo, pullNumber, filename) {
  const files = await getPrFiles(owner, repo, pullNumber);
  const file = files.find(f => f.filename === filename);

  if (!file?.patch) return '（无 diff 内容）';

  // 超过 3000 字符时截断，避免超出 token 限制
  if (file.patch.length > 3000) {
    return file.patch.slice(0, 3000) + '\n\n... [内容过长，已截断]';
  }

  return file.patch;
}
```

---

## 小结

- Function Calling 让 AI 能"描述"它想做的操作，由我们的代码去执行
- 工具定义要包含清晰的 `description`，这是 AI 决策的依据
- 工具结果以 `role: 'tool'` 格式加回消息历史，AI 下一轮可以看到
- 要处理工具输出过大的情况（截断），防止超出 token 限制

---

## 延伸阅读

- [OpenAI Function Calling 完整指南](https://platform.openai.com/docs/guides/function-calling)
- [JSON Schema 文档](https://json-schema.org/understanding-json-schema/)
