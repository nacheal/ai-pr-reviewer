/**
 * ToolCallCard — 单次工具调用展示
 *
 * Props:
 *   call: { id, name, input, status, durationMs, isError }
 */

const TOOL_LABELS = {
  get_pr_info:   { zh: '获取 PR 信息', icon: '📋' },
  get_pr_files:  { zh: '获取文件列表', icon: '📁' },
  get_file_diff: { zh: '读取文件 Diff', icon: '🔍' },
};

function formatInput(name, input) {
  if (name === 'get_file_diff') return input.filename ?? '';
  if (name === 'get_pr_files' || name === 'get_pr_info') {
    return `${input.owner}/${input.repo} #${input.pull_number}`;
  }
  return JSON.stringify(input);
}

export function ToolCallCard({ call }) {
  const meta = TOOL_LABELS[call.name] ?? { zh: call.name, icon: '🔧' };
  const isRunning = call.status === 'running';

  return (
    <div className={`
      flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs font-mono
      border transition-all duration-300
      ${call.isError
        ? 'border-red-500/30 bg-red-500/5'
        : isRunning
        ? 'border-indigo-500/40 bg-indigo-500/5 animate-pulse'
        : 'border-zinc-700/50 bg-zinc-900/50'
      }
    `}>
      {/* 图标 */}
      <span className="mt-0.5 text-base leading-none">{meta.icon}</span>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold ${call.isError ? 'text-red-400' : 'text-indigo-300'}`}>
            {meta.zh}
          </span>
          <span className="text-zinc-500">{call.name}</span>
        </div>
        <div className="text-zinc-400 mt-0.5 truncate">{formatInput(call.name, call.input ?? {})}</div>
      </div>

      {/* 状态 */}
      <div className="shrink-0 flex items-center gap-1.5">
        {isRunning ? (
          <span className="text-indigo-400 flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            运行中
          </span>
        ) : call.isError ? (
          <span className="text-red-400">✗ 失败</span>
        ) : (
          <span className="text-emerald-400">
            ✓ {call.durationMs != null ? `${call.durationMs}ms` : 'done'}
          </span>
        )}
      </div>
    </div>
  );
}
