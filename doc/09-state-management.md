# 第 09 章：前端状态管理——Hooks 设计

## 本章你将学到

- 何时用 `useState`，何时用 `useReducer`
- 如何设计自定义 Hook 封装复杂逻辑
- 本项目两个核心 Hook 的设计思路

---

## useState vs useReducer

**`useState`** 适合简单的独立状态：

```javascript
const [count, setCount] = useState(0);
const [name, setName] = useState('');
```

**`useReducer`** 适合以下情况：
- 多个状态之间有关联（一个动作同时更新多个状态）
- 状态更新逻辑较复杂
- 状态变更有明确的"动作类型"

本项目的 Agent 流有多个关联状态：`status`、`thinkingSteps`、`toolCalls`、`report`、`error`——用 `useReducer` 更合适。

---

## useAgentStream：管理 SSE 流状态

这是项目最核心的自定义 Hook，位于 `src/hooks/useAgentStream.js`。

**状态结构：**

```javascript
const initialState = {
  status: 'idle',        // 'idle' | 'running' | 'done' | 'error'
  thinkingSteps: [],     // [{ iteration, text }]
  toolCalls: [],         // [{ id, name, input, status, durationMs }]
  report: null,          // 最终 Markdown 报告字符串
  error: null,           // 错误信息字符串
};
```

**Reducer（状态更新逻辑）：**

```javascript
function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialState;

    case 'START':
      return { ...state, status: 'running' };

    case 'ADD_THINKING':
      // 同一 iteration 的思考文字追加到同一个步骤里
      const existing = state.thinkingSteps.find(s => s.iteration === action.iteration);
      if (existing) {
        return {
          ...state,
          thinkingSteps: state.thinkingSteps.map(s =>
            s.iteration === action.iteration
              ? { ...s, text: s.text + action.text }
              : s
          ),
        };
      }
      return {
        ...state,
        thinkingSteps: [...state.thinkingSteps, { iteration: action.iteration, text: action.text }],
      };

    case 'TOOL_START':
      return {
        ...state,
        toolCalls: [...state.toolCalls, { ...action.call, status: 'running' }],
      };

    case 'TOOL_DONE':
      return {
        ...state,
        toolCalls: state.toolCalls.map(c =>
          c.id === action.id
            ? { ...c, status: 'done', durationMs: action.durationMs }
            : c
        ),
      };

    case 'SET_REPORT':
      return { ...state, report: action.content };

    case 'SET_DONE':
      return { ...state, status: 'done' };

    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.message };

    default:
      return state;
  }
}
```

**为什么 `ADD_THINKING` 要合并同一 iteration 的内容？**

AI 思考文字是流式推送的，一句话可能被拆成几十个 chunk 发出。如果每个 chunk 都新建一个步骤，时间轴会有几十条碎片。按 `iteration`（对话轮次）合并，保证同一轮推理的思考内容合并显示为一条。

---

## useHistory：会话历史管理

位于 `src/hooks/useHistory.js`，基于 `sessionStorage` 实现本次会话的历史记录。

```javascript
export function useHistory() {
  const [history, setHistory] = useState(() => {
    // 初始化时从 sessionStorage 读取
    try {
      const saved = sessionStorage.getItem('pr-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 同步写 sessionStorage 的辅助函数
  function persist(newHistory) {
    setHistory(newHistory);
    sessionStorage.setItem('pr-history', JSON.stringify(newHistory));
  }

  function addRecord(prUrl, owner, repo, pullNumber) {
    const id = Date.now().toString();
    persist([{ id, prUrl, owner, repo, pullNumber, status: 'pending', createdAt: new Date().toISOString() }, ...history]);
    return id;
  }

  function updateRecord(id, patch) {
    persist(history.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function removeRecord(id) {
    persist(history.filter(r => r.id !== id));
  }

  return { history, addRecord, updateRecord, removeRecord };
}
```

**设计要点：**

- **`sessionStorage` vs `localStorage`**：用 `sessionStorage` 是刻意的——历史记录只在当前 Tab 有效，关闭 Tab 自动清除，不持久化私有 PR 数据。
- **懒初始化**：`useState(() => { ... })` 的函数形式只在首次渲染时执行，避免每次渲染都读 `sessionStorage`。

---

## 自定义 Hook 的设计原则

本项目的两个 Hook 体现了以下设计原则：

**1. 单一职责**

`useAgentStream` 只管 SSE 状态，`useHistory` 只管历史记录，互不干涉。

**2. 封装复杂性**

`Review.jsx` 调用 `useAgentStream` 时，不需要关心 EventSource 如何建立、事件如何解析、状态如何更新——这些都在 Hook 内部处理好了。

```jsx
// Review.jsx 使用 Hook — 调用侧非常简洁
const { status, thinkingSteps, toolCalls, report, error, start } = useAgentStream();

useEffect(() => {
  start(prUrl);
}, []);
```

**3. 返回稳定的接口**

Hook 返回的对象里，`start` 是函数，其他是状态。调用方只需要知道"调 start 开始，读状态展示"，不需要了解内部细节。

---

## 小结

- 多个关联状态 → 用 `useReducer`，每种变更定义明确的 action type
- 自定义 Hook 是将复杂逻辑从组件中抽离的最佳方式
- `sessionStorage` 适合会话级临时数据，无需后端支持
- Hook 应封装复杂性，对外暴露简洁的接口

---

## 延伸阅读

- [React 官方：useReducer](https://react.dev/reference/react/useReducer)
- [React 官方：自定义 Hook](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [MDN：sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
