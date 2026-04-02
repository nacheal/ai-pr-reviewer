import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * ReviewReport — 最终 Review 报告渲染
 *
 * Props:
 *   report: string (markdown)
 */
export function ReviewReport({ report }) {
  if (!report) return null;

  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-headings:font-semibold prose-headings:text-zinc-100
      prose-h2:text-base prose-h2:border-b prose-h2:border-zinc-800 prose-h2:pb-2 prose-h2:mb-3
      prose-h3:text-sm prose-h3:text-zinc-300
      prose-p:text-zinc-300 prose-p:leading-relaxed
      prose-li:text-zinc-300
      prose-code:text-indigo-300 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
      prose-strong:text-zinc-200
      prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-indigo-500 prose-blockquote:text-zinc-400
      prose-table:text-sm prose-th:text-zinc-300 prose-td:text-zinc-400
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {report}
      </ReactMarkdown>
    </div>
  );
}
