/**
 * 解析 GitHub PR 链接（前端使用）
 * 返回：{ owner, repo, pullNumber } 或 null
 */
export function parsePRUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:\?.*)?(?:#.*)?$/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], pullNumber: parseInt(match[3], 10) };
}
