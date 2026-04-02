import { Link } from 'react-router-dom';
import { CHAPTERS } from '../lib/chapters.js';

export default function Learn() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-mono">
            ← 返回首页
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-lg font-bold text-zinc-100 font-mono">PR Pilot</span>
          <span className="text-xs text-zinc-500 font-mono">学习中心</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
              学习中心
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xl mx-auto">
              通过 10 个章节，从零掌握 AI Agent 全栈开发——ReAct 循环、Tool Use、SSE 流式推送，一个真实项目讲透。
            </p>
          </div>

          {/* Chapter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHAPTERS.map((chapter) => (
              <Link
                key={chapter.id}
                to={`/learn/${chapter.id}`}
                className="group bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded shrink-0">
                    {chapter.id}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-zinc-100 mb-1.5 group-hover:text-indigo-300 transition-colors leading-snug">
                      {chapter.title}
                    </h2>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {chapter.summary}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
