import { parsePRUrl } from '../lib/parsePRUrl.js';

/**
 * PRInput — PR 链接输入框，带格式校验和 loading 状态
 *
 * Props:
 *   onSubmit(prUrl, parsed) — 提交有效链接时调用
 *   isLoading — 是否正在分析中
 */
export function PRInput({ onSubmit, isLoading }) {
  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const value = e.target.prUrl.value.trim();
        try {
          const parsed = parsePRUrl(value);
          onSubmit(value, parsed);
        } catch {
          // 触发浏览器默认 required 提示，或让错误高亮
          e.target.prUrl.setCustomValidity('请输入有效的 GitHub PR 链接');
          e.target.prUrl.reportValidity();
        }
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <input
            name="prUrl"
            type="url"
            required
            disabled={isLoading}
            placeholder="https://github.com/owner/repo/pull/123"
            onChange={(e) => e.target.setCustomValidity('')}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Spinner />
              分析中...
            </>
          ) : (
            'AI 代码审查'
          )}
        </button>
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
