import c01 from '../../doc/01-project-overview.md?raw';
import c02 from '../../doc/02-environment-setup.md?raw';
import c03 from '../../doc/03-frontend-routing.md?raw';
import c04 from '../../doc/04-component-design.md?raw';
import c05 from '../../doc/05-react-agent-core.md?raw';
import c06 from '../../doc/06-tool-use.md?raw';
import c07 from '../../doc/07-sse-streaming.md?raw';
import c08 from '../../doc/08-github-api.md?raw';
import c09 from '../../doc/09-state-management.md?raw';
import c10 from '../../doc/10-deployment.md?raw';

export const CHAPTERS = [
  {
    id: '01',
    title: '项目全景：一个 AI Agent 能做什么？',
    summary: '架构图、技术栈概览、端到端数据流',
    content: c01,
  },
  {
    id: '02',
    title: '开发环境搭建',
    summary: 'Node.js、API Key 配置、本地启动两个服务',
    content: c02,
  },
  {
    id: '03',
    title: '前端路由与页面结构',
    summary: 'React Router、动态路由参数、页面间传递数据',
    content: c03,
  },
  {
    id: '04',
    title: '组件拆分设计',
    summary: '单一职责、Props 设计、组件通信模式',
    content: c04,
  },
  {
    id: '05',
    title: 'AI Agent 核心：ReAct 推理循环',
    summary: 'ReAct 原理、异步生成器、消息历史管理',
    content: c05,
  },
  {
    id: '06',
    title: 'Tool Use / Function Calling',
    summary: '工具定义、调用格式、结果注入回 AI',
    content: c06,
  },
  {
    id: '07',
    title: 'SSE 流式推送',
    summary: 'Server-Sent Events、EventSource、实时 UI 更新',
    content: c07,
  },
  {
    id: '08',
    title: 'GitHub API 集成',
    summary: 'REST API 调用、Token 认证、错误处理',
    content: c08,
  },
  {
    id: '09',
    title: '前端状态管理：Hooks 设计',
    summary: 'useReducer、自定义 Hook、sessionStorage 持久化',
    content: c09,
  },
  {
    id: '10',
    title: '生产部署：Vercel Serverless',
    summary: 'vercel.json 配置、环境变量、maxDuration 超时',
    content: c10,
  },
];
