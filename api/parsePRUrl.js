/**
 * 解析 GitHub PR 链接
 * 支持格式：https://github.com/{owner}/{repo}/pull/{number}
 * 返回：{ owner, repo, pullNumber } 或抛出错误
 */
export function parsePRUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('请输入 GitHub PR 链接');
  }

  const trimmed = url.trim();
  const match = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:\?.*)?(?:#.*)?$/
  );

  if (!match) {
    throw new Error('链接格式错误，请输入有效的 GitHub PR 链接（如：https://github.com/owner/repo/pull/123）');
  }

  return {
    owner: match[1],
    repo: match[2],
    pullNumber: parseInt(match[3], 10),
  };
}
