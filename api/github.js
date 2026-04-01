// GitHub API 工具函数
// GET /repos/{owner}/{repo}/pulls/{pull_number}
async function getPrInfo(owner, repo, pullNumber) {
  const res = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  return {
    title: res.title,
    body: res.body,
    author: res.user?.login,
    headBranch: res.head?.ref,
    baseBranch: res.base?.ref,
    state: res.state,
    createdAt: res.created_at,
    url: res.html_url,
  };
}

// GET /repos/{owner}/{repo}/pulls/{pull_number}/files
async function getPrFiles(owner, repo, pullNumber) {
  const files = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes,
  }));
}

// 获取指定文件的 diff
async function getFileDiff(owner, repo, pullNumber, filename) {
  const files = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
  const file = files.find((f) => f.filename === filename);
  if (!file) throw new Error(`File not found in PR: ${filename}`);
  const patch = file.patch || '';
  // 截断超长 diff，防止超出 Claude 上下文
  const MAX_CHARS = 3000;
  if (patch.length > MAX_CHARS) {
    return patch.slice(0, MAX_CHARS) + '\n... [diff truncated]';
  }
  return patch;
}

async function githubFetch(path) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });

  if (res.status === 404) throw new Error('PR not found (404). Check owner/repo/PR number.');
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') throw new Error('GitHub API rate limit exceeded. Please configure GITHUB_TOKEN.');
    throw new Error('GitHub API forbidden (403).');
  }
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  return res.json();
}

export { getPrInfo, getPrFiles, getFileDiff };
