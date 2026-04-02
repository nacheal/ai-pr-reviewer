import { useNavigate } from 'react-router-dom';

/**
 * HistoryList — 侧边栏历史 PR 列表
 *
 * Props:
 *   history: [{ id, prUrl, owner, repo, pullNumber, title, status, createdAt }]
 */
export function HistoryList({ history }) {
  const navigate = useNavigate();

  if (history.length === 0) {
    return (
      <div className="text-zinc-600 text-xs font-mono py-4 text-center">
        暂无历史记录
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {history.map((record) => (
        <li key={record.id}>
          <button
            onClick={() => navigate(`/review/${record.owner}/${record.repo}/${record.pullNumber}`, { state: { record } })}
            className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-zinc-800/80 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-300 font-mono truncate flex-1">
                {record.title || `${record.owner}/${record.repo} #${record.pullNumber}`}
              </span>
              <StatusDot status={record.status} />
            </div>
            <div className="text-xs text-zinc-600 mt-0.5 truncate">
              {record.owner}/{record.repo} #{record.pullNumber}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StatusDot({ status }) {
  const cls = {
    done: 'bg-emerald-400',
    pending: 'bg-yellow-400 animate-pulse',
    error: 'bg-red-400',
  };
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cls[status] ?? 'bg-zinc-600'}`} />;
}
