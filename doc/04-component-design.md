# 第 04 章：组件拆分设计

## 本章你将学到

- 本项目的组件划分思路
- Props 设计原则
- 组件间如何协作

---

## 为什么要拆分组件？

一个功能完整的页面如果全写在一个文件里，会变得难以阅读和修改。拆分组件的目标是：

- **单一职责**：每个组件只做一件事
- **可复用**：同一个组件可以在不同地方使用
- **可维护**：修改一个组件不影响其他部分

---

## 本项目的组件树

```
App.jsx
├── Home.jsx（页面）
│   ├── PRInput.jsx          ← 输入框 + 格式校验
│   └── HistoryList.jsx      ← 历史记录列表
│
└── Review.jsx（页面）
    ├── ThinkingTimeline.jsx  ← 推理过程时间轴
    │   └── ToolCallCard.jsx  ← 单个工具调用卡片
    └── ReviewReport.jsx      ← Markdown 报告渲染
```

**页面组件**（`Home`、`Review`）负责：数据获取、状态管理、组织布局

**UI 组件**（`PRInput` 等）负责：纯粹的展示和交互，通过 Props 接收数据

---

## PRInput 组件

职责：输入框、URL 格式校验、提交。

```jsx
// src/components/PRInput.jsx
export function PRInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const parsed = parsePRUrl(value.trim());
    if (!parsed) {
      setError('请输入有效的 GitHub PR 链接');
      return;
    }
    setError('');
    onSubmit(value.trim(), parsed);  // 把数据交给父组件
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={error ? 'border-red-500' : 'border-zinc-700'}
        placeholder="https://github.com/owner/repo/pull/123"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button type="submit" disabled={isLoading}>分析</button>
    </form>
  );
}
```

**Props 设计：**
- `onSubmit`：回调函数，校验通过后调用，把数据"向上传"给父组件
- `isLoading`：布尔值，控制按钮禁用状态

---

## ThinkingTimeline 组件

职责：将思考步骤和工具调用混合展示为时间轴。

```jsx
// src/components/ThinkingTimeline.jsx
export function ThinkingTimeline({ thinkingSteps, toolCalls, status }) {
  // 把思考步骤和工具调用按 iteration 排序，交叉展示
  const items = buildTimelineItems(thinkingSteps, toolCalls);

  return (
    <div className="relative">
      {items.map((item, i) => (
        item.type === 'thinking'
          ? <ThinkingBlock key={i} text={item.text} />
          : <ToolCallCard key={i} call={item} />
      ))}
      {status === 'running' && <LoadingDot />}
    </div>
  );
}
```

**设计要点：** 组件内部自己处理"排序和合并"逻辑，父组件只需传入原始数据，不需要关心展示细节。

---

## ToolCallCard 组件

职责：展示单个工具调用的名称、参数、状态和耗时。

```jsx
export function ToolCallCard({ call }) {
  const { name, input, status, durationMs } = call;
  const isRunning = status === 'running';

  return (
    <div className="border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center gap-2">
        {isRunning
          ? <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          : <span className="text-emerald-400">✓</span>
        }
        <span className="font-mono text-sm">{name}</span>
        {durationMs && <span className="text-zinc-500 text-xs">{durationMs}ms</span>}
      </div>
      <pre className="text-xs text-zinc-400 mt-2 truncate">
        {JSON.stringify(input, null, 2)}
      </pre>
    </div>
  );
}
```

**状态驱动 UI：** 组件根据 `status` 显示不同样式，调用中显示脉冲动画，完成后显示绿色勾。

---

## ReviewReport 组件

职责：将 Markdown 字符串渲染为带样式的 HTML。

```jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReviewReport({ report }) {
  return (
    <div className="prose prose-invert prose-zinc max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {report}
      </ReactMarkdown>
    </div>
  );
}
```

**技术选择：**
- `react-markdown`：将 Markdown 转为 React 组件（而非直接设置 `innerHTML`，避免 XSS 风险）
- `remark-gfm`：支持 GitHub 风格 Markdown（表格、任务列表、删除线）
- `prose prose-invert`：Tailwind Typography 插件提供的预设排版样式

---

## 组件通信总结

| 场景 | 方式 |
|------|------|
| 父 → 子传数据 | Props |
| 子 → 父传事件 | 回调函数（`onSubmit`、`onChange`） |
| 跨层级共享状态 | 提升到公共父组件，再通过 Props 下发 |
| 全局路由状态 | React Router（URL 参数、`state`） |

本项目没有使用 Redux 或 Context，因为状态管理需求简单，Props + Hooks 已经足够。

---

## 小结

- 页面组件管状态和逻辑，UI 组件管展示和交互
- Props 是父组件向子组件传递数据的唯一通道
- 回调函数（`onXxx`）是子组件向父组件通知事件的方式
- 组件内部自行处理展示细节，不要让父组件关心展示逻辑

---

## 延伸阅读

- [React 官方：组件和 Props](https://react.dev/learn/passing-props-to-a-component)
- [Tailwind Typography 文档](https://tailwindcss-typography.vercel.app/)
