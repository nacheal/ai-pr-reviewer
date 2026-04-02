# 第 05 章：AI Agent 核心——ReAct 推理循环

## 本章你将学到

- ReAct 模式的原理
- 本项目中 Agent 循环的完整实现
- 如何控制循环的终止条件

---

## 什么是 ReAct？

ReAct 是 **Re**asoning + **Act**ing 的缩写，一种让 AI 模型交替进行"推理"和"行动"的框架：

```
思考（Thought）→ 行动（Action）→ 观察（Observation）→ 思考 → …… → 最终答案
```

**对比普通 AI 问答：**

| 普通问答 | ReAct Agent |
|---------|------------|
| 一次调用，直接给答案 | 多轮调用，边思考边查信息 |
| 只能用已知知识 | 可以调用工具获取实时数据 |
| 不透明 | 推理过程可见 |

---

## 本项目的循环结构

核心代码在 `api/review.js` 的 `runAgent` 异步生成器函数：

```javascript
// api/review.js（简化版）
async function* runAgent(owner, repo, pullNumber) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: `请审查这个 PR: ${owner}/${repo}#${pullNumber}` }
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 1. 调用 AI 模型（流式）
    const stream = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      tools: TOOLS,         // 告诉 AI 有哪些工具可用
      stream: true,
    });

    // 2. 消费流，收集思考文字和工具调用
    let thinking = '';
    let toolCalls = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0].delta;
      if (delta.content) {
        thinking += delta.content;
        yield { type: 'thinking', text: delta.content };  // 实时推送
      }
      if (delta.tool_calls) {
        // 收集工具调用（可能多个）
        mergeToolCallDeltas(toolCalls, delta.tool_calls);
      }
    }

    // 3. 没有工具调用 → 推理结束，输出报告
    if (toolCalls.length === 0) {
      yield { type: 'report', content: thinking };
      return;
    }

    // 4. 有工具调用 → 执行工具，注入结果，进入下一轮
    messages.push({ role: 'assistant', content: thinking, tool_calls: toolCalls });

    for (const call of toolCalls) {
      yield { type: 'tool_start', ...call };
      const result = await executeTool(call.function.name, JSON.parse(call.function.arguments));
      yield { type: 'tool_done', id: call.id, durationMs: result.duration };

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result.data),  // 工具结果注入消息历史
      });
    }
    // 进入下一次循环，带着工具结果再次调用 AI
  }

  yield { type: 'error', message: '超过最大迭代次数' };
}
```

---

## 关键设计点

**1. 异步生成器（`async function*`）**

用 `yield` 逐个推送事件，外层代码可以用 `for await...of` 消费，天然支持流式推送，不需要把所有结果收集完再一起发出。

**2. 消息历史（messages 数组）**

每轮对话都把之前的消息带上，AI 才能"记住"之前做了什么。工具调用结果也以 `role: 'tool'` 的形式加入历史，这是 AI 接收工具执行结果的标准格式。

**3. 终止条件**

- 正常：AI 不再发出工具调用，说明信息收集完毕，直接生成报告
- 异常：超过 `MAX_ITERATIONS = 10` 次，强制终止

---

## 系统提示词（System Prompt）

System Prompt 定义了 Agent 的"工作流程"：

```javascript
function buildSystemPrompt() {
  return `你是一名资深软件工程师，请按以下步骤审查 PR：
1. 调用 get_pr_info 了解 PR 背景
2. 调用 get_pr_files 获取改动文件列表  
3. 选择 1~3 个关键文件，调用 get_file_diff 深入分析
4. 输出结构化 Markdown 报告，包含：整体评价、问题清单、亮点、总结

报告格式要求：
## 整体评价
...
## 问题清单
...（按 Critical / Warning / Suggestion 分级）
## 亮点
...
## 总结
...`;
}
```

System Prompt 不是描述 AI"是什么"，而是给出**具体的执行步骤**，这让 Agent 行为更可预测。

---

## 实际执行轨迹示例

```
Iteration 0：
  AI 思考："我需要先了解这个 PR 的基本情况"
  工具调用：get_pr_info(facebook, react, 31168)

Iteration 1：
  AI 收到 PR 信息，思考："有 5 个文件改动，我需要看看都改了什么"
  工具调用：get_pr_files(facebook, react, 31168)

Iteration 2：
  AI 收到文件列表，思考："core.js 和 reconciler.js 最关键，我来看 diff"
  工具调用：get_file_diff(..., "packages/react/src/core.js")
  工具调用：get_file_diff(..., "packages/react-reconciler/src/ReactFiber.js")

Iteration 3：
  AI 收到两个文件的 diff，综合分析，不再发出工具调用
  → 输出完整 Markdown 审查报告
  → 循环结束
```

---

## 小结

- ReAct = 思考 + 行动 + 观察，循环执行直到有足够信息
- `async function*` 生成器函数让事件可以逐步推送，无需等待全部完成
- 消息历史（messages 数组）是 AI"记忆"的实现方式
- System Prompt 应给出具体执行步骤，而非只描述身份

---

## 延伸阅读

- [ReAct 论文原文](https://arxiv.org/abs/2210.03629)
- [MDN：异步生成器](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*)
- [OpenAI：工具调用消息格式](https://platform.openai.com/docs/guides/function-calling)
