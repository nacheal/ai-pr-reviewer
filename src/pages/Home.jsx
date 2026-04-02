import { useNavigate, Link } from 'react-router-dom';
import { parsePRUrl } from '../lib/parsePRUrl.js';
import { PRInput } from '../components/PRInput.jsx';
import { HistoryList } from '../components/HistoryList.jsx';
import { useHistory } from '../hooks/useHistory.js';

export default function Home() {
  const navigate = useNavigate();
  const { history } = useHistory();

  function handleSubmit(prUrl, parsed) {
    const { owner, repo, pullNumber } = parsed;
    navigate(`/review/${owner}/${repo}/${pullNumber}`, { state: { prUrl } });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-lg font-bold text-zinc-100 font-mono">PR Pilot</span>
          <span className="text-xs text-zinc-500 font-mono">AI Code Reviewer</span>
          <div className="ml-auto">
            <Link
              to="/learn"
              className="text-xs text-zinc-400 hover:text-indigo-300 font-mono transition-colors"
            >
              学习中心 →
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">
          {/* Hero */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
              AI 代码审查
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              粘贴 GitHub PR 链接，Agent 自动分析代码变更，生成结构化 Review 报告。
            </p>
          </div>

          {/* Input */}
          <PRInput onSubmit={handleSubmit} isLoading={false} />

          {/* Example */}
          <p className="mt-4 text-center text-xs text-zinc-600 font-mono">
            示例：https://github.com/facebook/react/pull/31168
          </p>
        </div>
      </main>

      {/* History */}
      {history.length > 0 && (
        <aside className="border-t border-zinc-800 px-6 py-5 max-w-5xl mx-auto w-full">
          <h2 className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-3">
            本次会话历史
          </h2>
          <HistoryList history={history} />
        </aside>
      )}
    </div>
  );
}
