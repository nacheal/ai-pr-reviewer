# 第 07 章：SSE 流式推送

## 本章你将学到

- SSE（Server-Sent Events）是什么，何时使用它
- 本项目的服务端如何推送事件
- 前端如何用 EventSource 消费事件流

---

## 为什么需要流式推送？

AI 分析一个 PR 需要多轮 API 调用，整个过程可能耗时 15~30 秒。如果等所有结果都有了再一次性返回，用户只能对着白屏等待。

**流式推送**让结果在产生的瞬间就推送给用户：

- AI 正在思考？推送思考文字
- 工具调用开始？推送"正在调用 get_pr_files..."
- 工具执行完毕？推送完成状态
- 报告生成了？推送 Markdown 内容

这就是"推理过程可视化"的技术基础。

---

## SSE vs WebSocket

| 对比项 | SSE | WebSocket |
|--------|-----|-----------|
| 方向 | **单向**（服务器 → 客户端） | 双向 |
| 协议 | HTTP | WS |
| 浏览器支持 | 原生（EventSource） | 原生（WebSocket） |
| 适合场景 | 推送、通知、日志流 | 聊天、游戏、实时协作 |
| 实现难度 | 简单 | 较复杂 |

本项目选 SSE，因为只需要服务器推送数据给浏览器，不需要双向通信。

---

## 服务端实现

在 `api/review.js` 的 `handler` 函数里：

```javascript
export default async function handler(req, res) {
  // 1. 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 2. 解析 PR URL
  const { url } = req.query;
  const parsed = parsePRUrl(url);
  if (!parsed) {
    sendSSE(res, { type: 'error', message: '无效的 PR 链接' });
    res.end();
    return;
  }

  // 3. 启动 Agent，逐个推送事件
  const { owner, repo, pullNumber } = parsed;
  for await (const event of runAgent(owner, repo, pullNumber)) {
    sendSSE(res, event);
  }

  // 4. 推送结束信号，关闭连接
  sendSSE(res, { type: 'done' });
  res.end();
}

// SSE 格式：必须是 "data: <json>\n\n"
function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

**SSE 协议格式：**

```
data: {"type":"thinking","text":"我先来了解这个 PR..."}\n
\n
data: {"type":"tool_start","name":"get_pr_info"}\n
\n
data: {"type":"tool_done","name":"get_pr_info","durationMs":342}\n
\n
data: {"type":"report","content":"## 整体评价\n..."}\n
\n
data: {"type":"done"}\n
\n
```

每条事件以 `data:` 开头，以 `\n\n`（两个换行）结尾。这是 SSE 标准协议格式。

---

## 前端消费 EventSource

在 `src/hooks/useAgentStream.js` 里：

```javascript
export function useAgentStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sourceRef = useRef(null);

  function start(prUrl) {
    dispatch({ type: 'RESET' });

    // 建立 SSE 连接
    const url = `/api/review?url=${encodeURIComponent(prUrl)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    // 监听消息
    source.onmessage = (e) => {
      const event = JSON.parse(e.data);

      switch (event.type) {
        case 'thinking':
          dispatch({ type: 'ADD_THINKING', text: event.text, iteration: event.iteration });
          break;
        case 'tool_start':
          dispatch({ type: 'TOOL_START', call: event });
          break;
        case 'tool_done':
          dispatch({ type: 'TOOL_DONE', id: event.id, durationMs: event.durationMs });
          break;
        case 'report':
          dispatch({ type: 'SET_REPORT', content: event.content });
          break;
        case 'error':
          dispatch({ type: 'SET_ERROR', message: event.message });
          source.close();
          break;
        case 'done':
          dispatch({ type: 'SET_DONE' });
          source.close();  // 关闭连接
          break;
      }
    };

    source.onerror = () => {
      dispatch({ type: 'SET_ERROR', message: '连接中断' });
      source.close();
    };
  }

  return { ...state, start };
}
```

---

## 为什么用 EventSource 而非 fetch？

`fetch` 也支持流式响应（`response.body.getReader()`），但需要手动解析 SSE 格式。`EventSource` 是浏览器原生 API，专为 SSE 设计：

- 自动解析 `data:` 格式
- 自动重连（连接断开时）
- API 简单，只需监听 `onmessage`

---

## 小结

- SSE 适合"服务器主动推送"的场景，比 WebSocket 简单
- 服务端设置 `Content-Type: text/event-stream` 并按格式写入数据
- 浏览器用 `new EventSource(url)` 建立连接，监听 `onmessage`
- 完成后要手动调用 `source.close()` 关闭连接

---

## 延伸阅读

- [MDN：Server-Sent Events 使用指南](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN：EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
