// 快速验证 GitHub API 连通性
// 用法：node api/test-github.js https://github.com/facebook/react/pull/31920
import { getPrInfo, getPrFiles, getFileDiff } from './github.js';
import { parsePRUrl } from './parsePRUrl.js';
import { readFileSync } from 'fs';

// 加载 .env.local
try {
  readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      if (k) process.env[k] = v;
    }
  });
} catch {}

const url = process.argv[2] || 'https://github.com/facebook/react/pull/31920';

async function main() {
  try {
    console.log('Parsing URL:', url);
    const { owner, repo, pullNumber } = parsePRUrl(url);
    console.log(`owner=${owner}, repo=${repo}, pullNumber=${pullNumber}\n`);

    console.log('--- getPrInfo ---');
    const info = await getPrInfo(owner, repo, pullNumber);
    console.log(JSON.stringify(info, null, 2));

    console.log('\n--- getPrFiles ---');
    const files = await getPrFiles(owner, repo, pullNumber);
    console.log(`Files changed: ${files.length}`);
    files.slice(0, 3).forEach(f => console.log(` - ${f.filename} (+${f.additions}/-${f.deletions})`));

    if (files.length > 0) {
      console.log(`\n--- getFileDiff: ${files[0].filename} ---`);
      const diff = await getFileDiff(owner, repo, pullNumber, files[0].filename);
      console.log(diff.slice(0, 500) + '...');
    }

    console.log('\n✅ GitHub API 验证通过');
  } catch (err) {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  }
}

main();
