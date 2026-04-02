import { ToolCallCard } from './ToolCallCard.jsx';

/**
 * ThinkingTimeline — 思考链时间轴
 *
 * Props:
 *   thinkingSteps: [{ id, iteration, text }]
 *   toolCalls: [{ id, name, input, status, durationMs, isError }]
 *   status: "running" | "done" | "error"
 */
export function ThinkingTimeline({ thinkingSteps, toolCalls, status }) {
  // 将思考步骤和工具调用按 iteration 交织排列
  const items = buildTimeline(thinkingSteps, toolCalls);

  return (
    <div className="flex flex-col gap-0">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`h-2 w-2 rounded-full ${status === 'running' ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400'}`} />
        <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider">
          {status === 'running' ? 'Agent 推理中...' : '推理完成'}
        </span>
      </div>

      {items.map((item, idx) => (
        <TimelineRow key={item.key} item={item} isLast={idx === items.length - 1} />
      ))}
    </div>
  );
}

function TimelineRow({ item, isLast }) {
  return (
    <div className="flex gap-3">
      {/* 竖线 + 节点 */}
      <div className="flex flex-col items-center">
        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${item.type === 'tool' ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
        {!isLast && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
      </div>

      {/* 内容 */}
      <div className="flex-1 pb-4 min-w-0">
        {item.type === 'thinking' ? (
          <p className="text-sm text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
            {item.text}
            {item.streaming && <span className="inline-block w-1 h-3.5 bg-zinc-500 ml-0.5 animate-pulse align-middle" />}
          </p>
        ) : (
          <ToolCallCard call={item.call} />
        )}
      </div>
    </div>
  );
}

/**
 * 将 thinkingSteps 和 toolCalls 按照时间顺序合并
 * 思考文字 → 工具调用 → 思考文字 → 工具调用 ...
 */
function buildTimeline(thinkingSteps, toolCalls) {
  const items = [];

  // 第 0 步：iteration=0 的思考（首次调用 Claude 的思考）
  const step0 = thinkingSteps.find((s) => s.iteration === 0);
  if (step0) {
    items.push({ type: 'thinking', key: `t-0`, text: step0.text, streaming: false });
  }

  // 按工具调用顺序插入：工具 i 对应 iteration=i 的思考
  toolCalls.forEach((call, i) => {
    items.push({ type: 'tool', key: `tool-${call.id}`, call });
    const nextStep = thinkingSteps.find((s) => s.iteration === i + 1);
    if (nextStep) {
      items.push({ type: 'thinking', key: `t-${i + 1}`, text: nextStep.text, streaming: call.status === 'done' });
    }
  });

  return items;
}
