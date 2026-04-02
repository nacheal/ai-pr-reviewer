import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CHAPTERS } from '../lib/chapters.js';

export default function Chapter() {
  const { chapterId } = useParams();
  const navigate = useNavigate();

  const index = CHAPTERS.findIndex((c) => c.id === chapterId);
  const chapter = CHAPTERS[index];

  if (!chapter) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400 font-mono">章节不存在</p>
        <Link to="/learn" className="text-indigo-400 hover:text-indigo-300 text-sm font-mono">
          返回学习中心
        </Link>
      </div>
    );
  }

  const prev = index > 0 ? CHAPTERS[index - 1] : null;
  const next = index < CHAPTERS.length - 1 ? CHAPTERS[index + 1] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link to="/learn" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-mono">
            ← 学习中心
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-xs font-mono text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded">
            {chapter.id}
          </span>
          <span className="text-sm text-zinc-400 font-mono truncate">
            {chapter.title}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="prose prose-invert prose-zinc max-w-none
            prose-headings:font-bold prose-headings:text-zinc-100
            prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-h2:border-b prose-h2:border-zinc-800 prose-h2:pb-2
            prose-p:text-zinc-300 prose-p:leading-relaxed
            prose-code:text-indigo-300 prose-code:bg-indigo-950/40 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
            prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
            prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-zinc-100
            prose-blockquote:border-indigo-500/50 prose-blockquote:text-zinc-400
            prose-table:text-sm prose-th:text-zinc-300 prose-td:text-zinc-400
            prose-li:text-zinc-300
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {chapter.content}
            </ReactMarkdown>
          </div>

          {/* Prev / Next Navigation */}
          <div className="mt-12 pt-8 border-t border-zinc-800 grid grid-cols-2 gap-4">
            <div>
              {prev && (
                <button
                  onClick={() => navigate(`/learn/${prev.id}`)}
                  className="w-full text-left group bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all"
                >
                  <div className="text-xs text-zinc-500 font-mono mb-1">← 上一章</div>
                  <div className="text-sm text-zinc-300 group-hover:text-indigo-300 transition-colors leading-snug">
                    {prev.id}. {prev.title}
                  </div>
                </button>
              )}
            </div>
            <div>
              {next && (
                <button
                  onClick={() => navigate(`/learn/${next.id}`)}
                  className="w-full text-right group bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all"
                >
                  <div className="text-xs text-zinc-500 font-mono mb-1">下一章 →</div>
                  <div className="text-sm text-zinc-300 group-hover:text-indigo-300 transition-colors leading-snug">
                    {next.id}. {next.title}
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
