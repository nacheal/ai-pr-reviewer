# 第 03 章：前端路由与页面结构

## 本章你将学到

- React Router 的基本用法
- 本项目的路由设计和页面划分
- 如何在页面间传递数据

---

## 为什么需要路由？

单页应用（SPA）只有一个 HTML 文件，但用户可以通过不同 URL 看到不同内容。**React Router** 让我们在不刷新页面的情况下，根据 URL 渲染不同的组件。

---

## 本项目的路由结构

```
/                          → Home.jsx（首页）
/review/:owner/:repo/:pull → Review.jsx（分析页）
/learn                     → Learn.jsx（学习中心）
/learn/:chapterId          → Chapter.jsx（章节内容）
```

`App.jsx` 是路由的入口：

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Review from './pages/Review.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/review/:owner/:repo/:pull" element={<Review />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- `BrowserRouter`：使用浏览器的 History API，URL 看起来像 `/review/facebook/react/31168`
- `Routes`：包裹所有路由规则
- `Route`：定义一条规则，`path` 匹配 URL，`element` 是对应组件

---

## 动态路由参数

分析页 URL 包含三个动态参数：

```
/review/:owner/:repo/:pull
         ↑       ↑      ↑
       "facebook" "react" "31168"
```

在 `Review.jsx` 中用 `useParams()` 取出这些参数：

```jsx
import { useParams } from 'react-router-dom';

export default function Review() {
  const { owner, repo, pull } = useParams();
  // owner = "facebook", repo = "react", pull = "31168"
}
```

这样设计的好处：**URL 即状态**。用户可以直接把分析页 URL 分享给别人，对方访问同一个 URL 就会分析同一个 PR。

---

## 页面间传递数据

路由跳转时可以通过 `state` 传递额外数据（不出现在 URL 中）：

```jsx
// Home.jsx — 跳转时附带 prUrl
const navigate = useNavigate();
navigate(`/review/${owner}/${repo}/${pullNumber}`, {
  state: { prUrl: 'https://github.com/...' }
});
```

```jsx
// Review.jsx — 取出传过来的数据
const location = useLocation();
const prUrl = location.state?.prUrl;
```

> `state` 只在同一个浏览器 Tab 的跳转中有效，刷新页面后 `state` 会丢失。所以 `Review.jsx` 里还有一个回退逻辑：如果 `state` 里没有 `prUrl`，就用 URL 参数自己拼出来。

---

## 两个页面的职责

**Home.jsx（首页）**

- 显示 PR 链接输入框
- 显示本次会话的历史记录
- 解析 URL，导航到分析页

**Review.jsx（分析页）**

- 从 URL 参数获取 owner / repo / pullNumber
- 启动 SSE 连接，触发 Agent 分析
- 实时展示推理过程和最终报告

---

## Link 组件 vs navigate 函数

React Router 提供两种导航方式：

```jsx
// 声明式（推荐用于可见链接）
import { Link } from 'react-router-dom';
<Link to="/">← 返回</Link>

// 编程式（推荐用于事件触发的跳转）
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/review/facebook/react/31168');
```

在本项目中：
- Header 里的"← 返回"用 `<Link>`，因为它是一个可见的导航元素
- 用户提交 PR 链接后的跳转用 `navigate()`，因为是在表单提交事件里触发的

---

## 小结

- React Router 通过 URL 决定渲染哪个页面组件
- `:param` 语法定义动态路由参数，用 `useParams()` 取出
- 页面间传递额外数据用 `state`，但刷新后会丢失，需要有回退逻辑
- 可见链接用 `<Link>`，事件触发的跳转用 `useNavigate()`

---

## 延伸阅读

- [React Router 官方文档](https://reactrouter.com/home)
- [useParams API 参考](https://reactrouter.com/api/hooks/useParams)
