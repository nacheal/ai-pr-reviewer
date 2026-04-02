import { useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useAgentStream } from '../hooks/useAgentStream.js';
import { useHistory } from '../hooks/useHistory.js';
import { ThinkingTimeline } from '../components/ThinkingTimeline.jsx';
import { ReviewReport } from '../components/ReviewReport.jsx';

export default function Review() {
  const { owner, repo, pull } = useParams();
  const location = useLocation();
  const pullNumber = parseInt(pull, 10);

  const { status, thinkingSteps, toolCalls, report, error, start } = useAgentStream();
  const { history, addRecord, updateRecord } = useHistory();
  const recordIdRef = useRef(null);
  const startedRef = useRef(false);

  // 检查历史中是否已有此记录（用 state 传来的 record 或通过 URL 查找）
  const locationRecord = location.state?.record;
  const historyRecord = locationRecord ?? history.find(
    (r) => r.owner === owner && r.repo === repo && r.pullNumber === pullNumber && r.status === 'done'
  );

  const prUrl = location.state?.prUrl ?? `https://github.com/${owner}/${repo}/pull/${pullNumber}`;

  useEffect(() => {
    // 如果是从历史点击进来且已有报告，不重新分析
    if (historyRecord?.status === 'done' && historyRecord?.report) return;
    if (startedRef.current) return;
    startedRef.current = true;

    // 添加历史记录
    recordIdRef.current = addRecord(prUrl, owner, repo, pullNumber);
    // 开始 Agent 流
    start(prUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 分析完成后更新历史记录
  useEffect(() => {
    if (status === 'done' && report && recordIdRef.current) {
      updateRecord(recordIdRef.current, {
        report,
        status: 'done',
        title: extractPrTitle(report),
      });
    }
    if (status === 'error' && recordIdRef.current) {
      updateRecord(recordIdRef.current, { status: 'error' });
    }
  }, [status, report]); // eslint-disable-line react-hooks/exhaustive-deps

  // 使用历史报告（不重新分析时）
  const displayReport = report ?? historyRecord?.report ?? null;
  const displayStatus = historyRecord?.status === 'done' && !report ? 'done' : status;
  const displayThinking = thinkingSteps.length > 0 ? thinkingSteps : [];
  const displayTools = toolCalls.length > 0 ? toolCalls : [];
  const isRunning = displayStatus === 'running';
  const isDone = displayStatus === 'done';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-mono">
            ← 返回
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-sm font-mono text-zinc-300">
            {owner}/{repo}
            <span className="text-zinc-500"> #{pullNumber}</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isRunning && (
              <span className="text-xs text-indigo-400 font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                分析中
              </span>
            )}
            {isDone && (
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                完成
              </span>
            )}
            {displayStatus === 'error' && (
              <span className="text-xs text-red-400 font-mono">✗ 出错</span>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {displayStatus === 'error' && error && (
          <ErrorCard message={error} onRetry={() => { startedRef.current = false; start(prUrl); }} />
        )}

        {/* 双栏布局：思考链 + 报告 */}
        <div className={`grid gap-6 ${isDone && displayReport ? 'lg:grid-cols-[2fr_3fr]' : 'grid-cols-1'}`}>

          {/* 左：思考链（运行中或有步骤时展示） */}
          {(isRunning || displayThinking.length > 0 || displayTools.length > 0) && (
            <div className="min-w-0">
              <SectionCard title="推理过程">
                <ThinkingTimeline
                  thinkingSteps={displayThinking}
                  toolCalls={displayTools}
                  status={displayStatus}
                />
              </SectionCard>
            </div>
          )}

          {/* 右：报告 */}
          {displayReport && (
            <div className="min-w-0">
              <SectionCard title="Review 报告">
                <ReviewReport report={displayReport} />
              </SectionCard>
            </div>
          )}

          {/* 无内容时的骨架屏 */}
          {!isRunning && !displayReport && displayStatus === 'idle' && (
            <div className="flex items-center justify-center py-20 text-zinc-600 font-mono text-sm">
              准备中...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="mb-6 bg-red-950/30 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
      <span className="text-red-400 text-lg leading-none mt-0.5">⚠</span>
      <div className="flex-1">
        <p className="text-red-300 text-sm">{message}</p>
        <button
          onClick={onRetry}
          className="mt-2 text-xs text-red-400 hover:text-red-300 underline font-mono"
        >
          重试
        </button>
      </div>
    </div>
  );
}

/** 从报告中提取 PR 标题摘要（取第一行非空内容） */
function extractPrTitle(report) {
  const lines = report.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, '').replace(/\|.*/, '').trim();
    if (clean.length > 5) return clean.slice(0, 60);
  }
  return null;
}
