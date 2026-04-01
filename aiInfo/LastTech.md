# AI File Hub — 架构设计文档

**版本：** v1.0  
**日期：** 2026-03-18  
**关联文档：** AI_File_Hub_PRD.md  

---

## 1. 系统分层架构

系统从上至下分为五层，职责清晰，各层之间通过标准协议通信。

```
┌─────────────────────────────────────────────────────────┐
│            第一层：客户端（Browser）                         │
│   路由层(React Router) · 状态层(Context) · UI层(shadcn)    │
│              SDK层(@supabase/supabase-js)                 │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│            第二层：托管层（Vercel）                          │
│       静态资源 CDN · CI/CD · 环境变量注入                    │
└──────────────────────┬──────────────────────────────────┘
                       │ supabase-js SDK 调用
┌──────────────────────▼──────────────────────────────────┐
│            第三层：BaaS 层（Supabase）                       │
│  Auth(OAuth+JWT) · PostgreSQL(RLS) · Storage · Realtime  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP invoke
┌──────────────────────▼──────────────────────────────────┐
│       第四层：计算层（Supabase Edge Functions · Deno）       │
│     analyze-file · chat-with-file · search-documents     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS API
┌──────────────────────▼──────────────────────────────────┐
│            第五层：外部 AI 服务（DeepSeek API）               │
│          deepseek-chat · 分析 · 问答 · 流式 SSE             │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 数据流设计

### 2.1 数据流一：文件上传 → AI 分析（异步管道）

```
用户拖拽文件
    │
    ▼
① 前端校验（格式 / 大小 ≤50MB）
    │
    ▼
② supabase.storage.upload()
   → 上传至 user-files bucket
   → 返回 storage_path
    │
    ▼
③ supabase.from('documents').insert()
   → 写入元数据，status = 'pending'
    │
    ▼
④ supabase.functions.invoke('analyze-file', { document_id })
   → 异步触发，不阻塞前端
    │
    ▼
⑤ Edge Function：更新 status = 'processing'
    │
    ▼
⑥ Edge Function：从 Storage 下载文件
   → PDF：使用 pdf-parse 提取文本
   → TXT / MD：直接读取文本内容
   → 图片：转 base64，使用视觉模型
    │
    ▼
⑦ Edge Function：调用 DeepSeek API
   → 发送文本内容 + 分析 Prompt
   → 返回 summary / key_points / tags
    │
    ▼
⑧ Edge Function：写入 ai_results 表
   → 同时更新 documents.status = 'done'
    │
    ▼
⑨ Supabase Realtime → 推送至前端
   → FileCard 状态标签自动更新为「分析完成」
```

**关键设计决策：**
- 步骤 ④ 为异步调用，前端拿到 `document_id` 即可返回，不等待 AI 分析完成
- 步骤 ⑨ 通过 Realtime 订阅 `documents` 表的 `UPDATE` 事件，无需轮询
- 若 Edge Function 执行失败，`status` 更新为 `'error'`，前端显示重试入口

---

### 2.2 数据流二：用户提问 → AI 流式回答

```
用户在 ChatInput 输入问题
    │
    ▼
① 前端：fetch('/functions/v1/chat-with-file', {
     method: 'POST',
     body: { document_id, question },
     headers: { Authorization: 'Bearer <JWT>' }
   })
    │
    ▼
② Edge Function：验证 JWT，确认用户有权访问该文件
    │
    ▼
③ Edge Function：查询 ai_results.full_text（文件全文）
    │
    ▼
④ Edge Function：组装 Prompt
   ┌─────────────────────────────────────┐
   │ System: 你是文件助手，基于以下文档回答  │
   │ Context: {full_text}               │
   │ User: {question}                   │
   └─────────────────────────────────────┘
    │
    ▼
⑤ 调用 DeepSeek API（stream: true）
   → 返回 ReadableStream（SSE 格式）
    │
    ▼
⑥ Edge Function：将 SSE 流透传给前端
    │
    ▼
⑦ 前端：逐 token 读取 ReadableStream
   → 追加到 ChatOutput 渲染区
   → 用户看到文字逐字出现
```

---

## 3. 前端架构设计

### 3.1 目录结构

```
src/
├── main.jsx                  # 入口，挂载 App
├── App.jsx                   # 路由配置
│
├── lib/
│   ├── supabase.js           # Supabase 客户端初始化（单例）
│   └── utils.js              # 通用工具函数（formatSize, formatDate等）
│
├── contexts/
│   └── AuthContext.jsx       # 全局认证状态（user, session, loading）
│
├── hooks/
│   ├── useAuth.js            # 封装 AuthContext 消费
│   ├── useDocuments.js       # 文件列表查询 + Realtime 订阅
│   ├── useUpload.js          # 文件上传逻辑 + 进度状态
│   └── useChat.js            # AI 问答流式调用
│
├── pages/
│   ├── LoginPage.jsx         # 路由: /
│   ├── DashboardPage.jsx     # 路由: /dashboard
│   ├── FilePage.jsx          # 路由: /file/:id
│   └── SearchPage.jsx        # 路由: /search
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx     # 登录后的整体布局（侧边栏 + 主区域）
│   │   ├── Sidebar.jsx       # 左侧导航栏
│   │   └── TopBar.jsx        # 顶部搜索栏 + 用户头像
│   │
│   ├── file/
│   │   ├── FileCard.jsx      # 文件列表卡片
│   │   ├── FileList.jsx      # 文件列表容器（含过滤）
│   │   ├── UploadZone.jsx    # 拖拽上传区域
│   │   └── FilePreview.jsx   # 图片预览模态框
│   │
│   ├── ai/
│   │   ├── AIResultPanel.jsx # AI 分析结果展示面板
│   │   ├── ChatInput.jsx     # 问答输入框
│   │   └── ChatOutput.jsx    # 流式回答渲染区
│   │
│   └── ui/
│       └── StatusBadge.jsx   # 状态标签（复用 shadcn Badge）
│
└── guards/
    └── ProtectedRoute.jsx    # 路由守卫（未登录跳转 /）
```

### 3.2 状态管理策略

本项目不引入 Redux / Zustand，使用 React 内置能力足够：

| 状态类型 | 方案 | 说明 |
|----------|------|------|
| 认证状态（user, session） | `AuthContext` + `useContext` | 全局单例，整个应用共享 |
| 文件列表 | `useDocuments` hook 内的 `useState` | 局部状态，含 Realtime 订阅 |
| 上传进度 | `useUpload` hook 内的 `useState` | 局部状态，上传完成后清除 |
| 问答历史 | `ChatOutput` 组件内的 `useState` | 会话级，刷新清空 |
| 搜索关键词 | URL query params (`?q=keyword`) | 支持分享链接、浏览器回退 |

### 3.3 路由设计

```jsx
// App.jsx
<Routes>
  <Route path="/"          element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>   {/* 未登录跳转 / */}
    <Route element={<AppLayout />}>      {/* 统一布局 */}
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/file/:id"  element={<FilePage />} />
      <Route path="/search"    element={<SearchPage />} />
    </Route>
  </Route>
</Routes>
```

---

## 4. Edge Functions 设计

### 4.1 函数清单

| 函数名 | 触发方式 | 职责 |
|--------|----------|------|
| `analyze-file` | 前端主动调用（上传后） | 文件解析 + AI 分析 + 结果写库 |
| `chat-with-file` | 前端主动调用（用户提问） | 读取 full_text + 拼 Prompt + 流式问答 |
| `search-documents` | 前端主动调用（搜索） | PostgreSQL FTS 查询 + 结果聚合 |

### 4.2 analyze-file 设计

```typescript
// supabase/functions/analyze-file/index.ts

Deno.serve(async (req) => {
  // 1. 验证 JWT（从 Authorization header 提取）
  // 2. 解析请求体，获取 document_id
  // 3. 查询 documents 表，获取 storage_path + mime_type
  // 4. 更新 status = 'processing'
  // 5. 从 Storage 下载文件内容
  //    - PDF → pdf-parse 提取文本
  //    - TXT/MD → 直接读取
  //    - 图片 → base64 编码
  // 6. 构建 DeepSeek Prompt（见下方）
  // 7. 调用 DeepSeek API（非流式，等待完整结果）
  // 8. 解析返回的 JSON（summary / key_points / tags）
  // 9. 写入 ai_results，full_text 存原始文本
  // 10. 更新 documents.status = 'done'
  // 异常时：更新 status = 'error'
})
```

**分析 Prompt 模板：**

```
你是一个文档分析助手。请分析以下文档内容，以 JSON 格式返回结果，
不要包含任何额外文字。

文档内容：
{file_text}

请返回如下 JSON：
{
  "summary": "一句话概括文档主要内容（不超过50字）",
  "key_points": ["要点1", "要点2", "要点3"],
  "tags": ["标签1", "标签2"]
}
```

### 4.3 chat-with-file 设计

```typescript
// supabase/functions/chat-with-file/index.ts

Deno.serve(async (req) => {
  // 1. 验证 JWT，确认用户有权限访问该 document
  // 2. 解析请求体：{ document_id, question }
  // 3. 查询 ai_results.full_text
  // 4. 构建 Prompt（System + Context + User）
  // 5. 调用 DeepSeek API（stream: true）
  // 6. 将 ReadableStream 直接作为 Response 返回
  //    Content-Type: text/event-stream
})
```

**问答 Prompt 模板：**

```
[System]
你是一个文件助手。请严格根据以下文档内容回答用户问题。
如果文档中没有相关信息，请回答"文档中未找到相关内容"，不要编造。

[文档内容]
{full_text}

[用户问题]
{question}
```

### 4.4 search-documents 设计

```typescript
// supabase/functions/search-documents/index.ts

Deno.serve(async (req) => {
  // 1. 验证 JWT
  // 2. 解析请求体：{ query }
  // 3. 执行 PostgreSQL FTS 查询：
  //    SELECT d.*, a.summary, a.tags,
  //           ts_headline('simple', d.name, q) as name_highlight,
  //           ts_headline('simple', a.summary, q) as summary_highlight
  //    FROM documents d
  //    LEFT JOIN ai_results a ON a.document_id = d.id
  //    WHERE d.user_id = auth.uid()
  //      AND (to_tsvector('simple', d.name) @@ plainto_tsquery('simple', $1)
  //        OR to_tsvector('simple', coalesce(a.summary,'')) @@ plainto_tsquery('simple', $1))
  //    ORDER BY ts_rank(...) DESC
  //    LIMIT 20
  // 4. 返回结果 JSON
})
```

---

## 5. 数据库架构

### 5.1 表关系

```
auth.users (Supabase 内置)
    │ 1
    │
    │ N
documents
    ├── id (PK)
    ├── user_id (FK → auth.users.id)
    ├── name, size, mime_type
    ├── storage_path
    ├── status: pending|processing|done|error
    └── created_at
         │ 1
         │
         │ 1 (CASCADE DELETE)
    ai_results
         ├── id (PK)
         ├── document_id (FK → documents.id)
         ├── summary
         ├── key_points (text[])
         ├── tags (text[])
         ├── full_text
         └── created_at
```

### 5.2 索引策略

```sql
-- 全文搜索索引（GIN）
CREATE INDEX idx_doc_name_fts
  ON documents USING GIN(to_tsvector('simple', name));

CREATE INDEX idx_ai_content_fts
  ON ai_results USING GIN(
    to_tsvector('simple',
      COALESCE(summary, '') || ' ' ||
      COALESCE(array_to_string(key_points, ' '), '')
    )
  );

-- 高频查询索引（B-Tree）
CREATE INDEX idx_documents_user_created
  ON documents(user_id, created_at DESC);  -- 列表页主查询

CREATE INDEX idx_ai_results_document
  ON ai_results(document_id);              -- 详情页 JOIN
```

### 5.3 RLS 策略总览

| 表 | 操作 | 策略 |
|----|------|------|
| documents | SELECT | `user_id = auth.uid()` |
| documents | INSERT | `user_id = auth.uid()` |
| documents | UPDATE | `user_id = auth.uid()` |
| documents | DELETE | `user_id = auth.uid()` |
| ai_results | SELECT | 通过 document_id 关联验证 user_id |
| ai_results | INSERT | 仅 Service Role（Edge Function） |

> `ai_results` 的写入权限只开放给 Service Role Key（Edge Function 持有），前端 anon key 无法直接写入，保证 AI 结果不被篡改。

### 5.4 Storage 设计

```
Bucket: user-files
├── 访问策略：Private（需 signed URL）
├── 路径规则：{user_id}/{document_id}/{filename}
│            例：abc-123/def-456/report.pdf
└── Bucket Policy（RLS）：
    SELECT: auth.uid()::text = (storage.foldername(name))[1]
    INSERT: auth.uid()::text = (storage.foldername(name))[1]
    DELETE: auth.uid()::text = (storage.foldername(name))[1]
```

---

## 6. 安全架构

### 6.1 密钥隔离

```
┌──────────────────┬───────────────────────┬──────────────────────┐
│ 密钥             │ 存放位置              │ 持有方               │
├──────────────────┼───────────────────────┼──────────────────────┤
│ SUPABASE_URL     │ .env.local / Vercel   │ 前端（可公开）        │
│ SUPABASE_ANON_KEY│ .env.local / Vercel   │ 前端（可公开）        │
│ DEEPSEEK_API_KEY │ Supabase Secrets      │ Edge Function 仅服务端│
│ SERVICE_ROLE_KEY │ Supabase Secrets      │ Edge Function 仅服务端│
└──────────────────┴───────────────────────┴──────────────────────┘
```

`DEEPSEEK_API_KEY` 和 `SERVICE_ROLE_KEY` 永远不出现在前端代码和浏览器网络请求中。

### 6.2 认证流程

```
用户点击「GitHub 登录」
    │
    ▼
Supabase Auth → 跳转 GitHub OAuth 页面
    │
    ▼
用户授权 → GitHub 回调 Supabase
    │
    ▼
Supabase 颁发 JWT（access_token + refresh_token）
    │
    ▼
前端 supabase-js 自动存储到 localStorage
    │
    ▼
所有后续 API 请求自动携带 JWT
    │
    ▼
Supabase RLS 从 JWT 中解析 auth.uid()
→ 数据库层自动过滤，只返回该用户数据
```

### 6.3 Edge Function 鉴权

```typescript
// 每个 Edge Function 入口必须验证 JWT
const authHeader = req.headers.get('Authorization')
const { data: { user }, error } = await supabase.auth.getUser(
  authHeader?.replace('Bearer ', '')
)
if (!user || error) {
  return new Response('Unauthorized', { status: 401 })
}
```

---

## 7. 部署架构

```
开发环境                          生产环境
──────────────────                ────────────────────────
localhost:5173 (Vite)             https://your-app.vercel.app
    │                                      │
    │ .env.local                           │ Vercel 环境变量
    │ VITE_SUPABASE_URL=...               │ VITE_SUPABASE_URL=...
    │ VITE_SUPABASE_ANON_KEY=...          │ VITE_SUPABASE_ANON_KEY=...
    │                                      │
    ▼                                      ▼
同一个 Supabase 项目（或区分 Dev/Prod 项目）
    │
    ├── Edge Functions（自动部署）
    │   supabase functions deploy analyze-file
    │   supabase functions deploy chat-with-file
    │   supabase functions deploy search-documents
    │
    └── Supabase Secrets（服务端环境变量）
        supabase secrets set DEEPSEEK_API_KEY=...
        supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

**CI/CD 流程：**

```
git push origin main
    │
    ▼
GitHub 触发 Vercel Webhook
    │
    ▼
Vercel 拉取代码 → npm run build（Vite）
    │
    ▼
构建产物部署至 Vercel CDN
    │
    ▼
新版本上线（零停机）
```

---

## 8. 核心模块接口定义

### 8.1 supabase.js（客户端单例）

```javascript
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 8.2 useDocuments hook

```javascript
// src/hooks/useDocuments.js
export function useDocuments() {
  return {
    documents,      // Document[]
    loading,        // boolean
    error,          // Error | null
    refetch,        // () => void
  }
  // 内部：查询 documents 表 + 订阅 Realtime UPDATE/INSERT/DELETE 事件
}
```

### 8.3 useUpload hook

```javascript
// src/hooks/useUpload.js
export function useUpload() {
  return {
    upload,         // (file: File) => Promise<Document>
    progress,       // number (0-100)
    uploading,      // boolean
    error,          // Error | null
  }
  // 内部：Storage upload → INSERT documents → invoke analyze-file
}
```

### 8.4 useChat hook

```javascript
// src/hooks/useChat.js
export function useChat(documentId) {
  return {
    messages,       // Message[] { role, content }
    sendMessage,    // (question: string) => Promise<void>
    streaming,      // boolean
  }
  // 内部：fetch Edge Function → 读 ReadableStream → 追加 token 到 messages
}
```

### 8.5 Edge Function 请求/响应格式

**analyze-file**
```
POST /functions/v1/analyze-file
Authorization: Bearer <JWT>
Body: { "document_id": "uuid" }

Response 200: { "success": true }
Response 400: { "error": "document not found" }
Response 401: { "error": "unauthorized" }
```

**chat-with-file**
```
POST /functions/v1/chat-with-file
Authorization: Bearer <JWT>
Body: { "document_id": "uuid", "question": "string" }

Response 200: text/event-stream (SSE)
  data: {"token": "你好"}
  data: {"token": "，根据"}
  data: [DONE]
```

**search-documents**
```
POST /functions/v1/search-documents
Authorization: Bearer <JWT>
Body: { "query": "string" }

Response 200: {
  "results": [{
    "id": "uuid",
    "name": "report.pdf",
    "name_highlight": "...<b>关键词</b>...",
    "summary_highlight": "...<b>关键词</b>...",
    "tags": ["技术文档"],
    "created_at": "2026-03-18T..."
  }]
}
```

---

## 9. 技术选型决策记录

| 决策点 | 选择 | 备选方案 | 选择理由 |
|--------|------|----------|----------|
| 前端框架 | React 18 | Vue 3 | 与已有知识栈匹配 |
| 构建工具 | Vite 5 | CRA | 启动速度快，HMR 体验好 |
| 样式方案 | Tailwind + shadcn/ui | MUI / Ant Design | 轻量、可定制、无厂商绑定 |
| 状态管理 | React Context | Zustand / Redux | 项目规模小，无需额外依赖 |
| 搜索方案 | PostgreSQL FTS | Elasticsearch / Meilisearch | 无需额外服务，Supabase 内置 |
| AI 模型 | DeepSeek Chat | GPT-4o / Claude | 性价比高，国内网络友好 |
| 实时方案 | Supabase Realtime | Polling / Socket.io | 无需额外服务，与 DB 深度集成 |

---

*文档结束*
