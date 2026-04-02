/**
 * local/server.js — 本地开发 Express 服务器
 *
 * 用途：将 /api/review 路由到 api/review.js 的 handler
 * 启动：node local/server.js
 * 端口：3001
 *
 * 说明：Vite dev server (localhost:5173) 将 /api/* 代理到 localhost:3001
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 加载 .env.local 环境变量 ──────────────────────────────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(ROOT, '.env.local'));

// ── 动态导入 handler（在 env 加载后）────────────────────────
const { default: reviewHandler } = await import('../api/review.js');

// ── Express 应用 ──────────────────────────────────────────
const app = express();

app.get('/api/review', (req, res) => {
  reviewHandler(req, res);
});

app.listen(3001, () => {
  console.log('[PR Pilot] Local API server running at http://localhost:3001');
  console.log('[PR Pilot] Test: curl "http://localhost:3001/api/review?url=<PR_URL>"');
});
