/**
 * api/review.js — PR Pilot Agent SSE 端点
 *
 * 本地开发：由 local/server.js 的 Express 调用此模块
 * 生产环境：作为 Vercel Serverless Function 运行
 */

import Anthropic from '@anthropic-ai/sdk';
import { getPrInfo, getPrFiles, getFileDiff } from './github.js';
import { parsePRUrl } from './parsePRUrl.js';

// ──────────────────────────────────────────
// 工具定义（Tool Schemas）
// ──────────────────────────────────────────
const TOOLS = [
  {
    name: 'get_pr_info',
    description: '获取 PR 的基本信息，包括标题、描述、作者、源分支和目标分支',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: '仓库所有者' },
        repo: { type: 'string', description: '仓库名称' },
        pull_number: { type: 'number', description: 'PR 编号' },
      },
      required: ['owner', 'repo', 'pull_number'],
    },
  },
  {
    name: 'get_pr_files',
    description: '获取 PR 变更的文件列表，包含每个文件的增删行数和状态',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        pull_number: { type: 'number' },
      },
      required: ['owner', 'repo', 'pull_number'],
    },
  },
  {
    name: 'get_file_diff',
    description: '获取指定文件的完整 diff 内容，用于深入分析代码变更',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        pull_number: { type: 'number' },
        filename: { type: 'string', description: '文件路径，如 src/index.js' },
      },
      required: ['owner', 'repo', 'pull_number', 'filename'],
    },
  },
];

// ──────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────
function buildSystemPrompt() {
  return `你是一位资深软件工程师，专门负责代码审查。
你会收到一个 GitHub Pull Request 的信息，需要对其进行全面的代码审查。

审查流程：
1. 首先调用 get_pr_info 了解 PR 的背景和目的
2. 调用 get_pr_files 查看所有变更文件
3. 根据文件重要性，选择最关键的 1~3 个文件，调用 get_file_diff 深入分析
4. 综合分析后，输出结构化的 Review 报告

Review 报告格式（使用 Markdown，必须严格遵守）：

## 整体评价
[PR目的摘要，1~2句话] | 评级：Good / Needs Work / Risky

## 问题清单
### 🔴 Critical（必须修改）
- [文件名:行号] 问题描述（如无则写"暂无"）

### 🟡 Warning（建议修改）
- [文件名] 问题描述（如无则写"暂无"）

### 🟢 Suggestion（可选优化）
- 建议内容（如无则写"暂无"）

## 亮点
- 值得肯定的地方

## 总结
是否建议 Approve，附上核心理由。`;
}

// ──────────────────────────────────────────
// 工具执行器
// ──────────────────────────────────────────
async function executeTool(name, input) {
  switch (name) {
    case 'get_pr_info':
      return getPrInfo(input.owner, input.repo, input.pull_number);
    case 'get_pr_files':
      return getPrFiles(input.owner, input.repo, input.pull_number);
    case 'get_file_diff':
      return getFileDiff(input.owner, input.repo, input.pull_number, input.filename);
    default:
      throw new Error(`未知工具：${name}`);
  }
}

// ──────────────────────────────────────────
// ReAct Agent 异步生成器
// ──────────────────────────────────────────
async function* runAgent(owner, repo, pullNumber) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });

  const messages = [
    {
      role: 'user',
      content: `请对以下 GitHub PR 进行代码审查：
仓库：${owner}/${repo}
PR 编号：#${pullNumber}

请按照审查流程，依次调用工具获取信息，然后输出完整的 Review 报告。`,
    },
  ];

  const MAX_ITERATIONS = 10;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // 调用 Claude，流式获取思考文字
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });

    let thinkingBuffer = '';

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta' &&
        chunk.delta.text
      ) {
        thinkingBuffer += chunk.delta.text;
        yield { type: 'thinking', text: chunk.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();

    // 终止条件：Claude 不再调用工具
    if (finalMessage.stop_reason === 'end_turn') {
      // 提取最终报告
      const reportContent = finalMessage.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      yield { type: 'report', content: reportContent };
      break;
    }

    // 处理工具调用
    const toolUseBlocks = finalMessage.content.filter((b) => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      // 没有工具调用也没有 end_turn，异常情况
      const text = finalMessage.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      yield { type: 'report', content: text || '分析完成，但未生成报告。' };
      break;
    }

    // 将 Claude 回复加入消息历史
    messages.push({ role: 'assistant', content: finalMessage.content });

    // 执行每个工具调用
    const toolResults = [];
    for (const toolUse of toolUseBlocks) {
      const startTime = Date.now();
      yield { type: 'tool_start', name: toolUse.name, input: toolUse.input };

      let result;
      let isError = false;
      try {
        result = await executeTool(toolUse.name, toolUse.input);
      } catch (err) {
        result = { error: err.message };
        isError = true;
      }

      const durationMs = Date.now() - startTime;
      yield { type: 'tool_done', name: toolUse.name, durationMs, isError };

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // 将工具结果注入消息历史
    messages.push({ role: 'user', content: toolResults });
  }

  if (iteration >= MAX_ITERATIONS) {
    yield { type: 'error', message: `Agent 超过最大迭代次数 (${MAX_ITERATIONS})，已强制停止。` };
  }
}

// ──────────────────────────────────────────
// SSE 事件发送工具
// ──────────────────────────────────────────
function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ──────────────────────────────────────────
// Vercel Serverless Function 导出
// ──────────────────────────────────────────
export default async function handler(req, res) {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const prUrl = req.query?.url;

  if (!prUrl) {
    sendSSE(res, { type: 'error', message: '缺少 url 参数' });
    sendSSE(res, { type: 'done' });
    res.end();
    return;
  }

  let parsed;
  try {
    parsed = parsePRUrl(prUrl);
  } catch (err) {
    sendSSE(res, { type: 'error', message: err.message });
    sendSSE(res, { type: 'done' });
    res.end();
    return;
  }

  const { owner, repo, pullNumber } = parsed;

  try {
    for await (const event of runAgent(owner, repo, pullNumber)) {
      sendSSE(res, event);
      // 刷新缓冲区（Express/Node.js 需要）
      if (res.flush) res.flush();
    }
  } catch (err) {
    sendSSE(res, { type: 'error', message: `Agent 出错：${err.message}` });
  }

  sendSSE(res, { type: 'done' });
  res.end();
}

// 同时导出 runAgent 供本地脚本测试
export { runAgent };
