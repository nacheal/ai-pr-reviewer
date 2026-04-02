/**
 * IssueBadge — 严重程度标签
 *
 * Props:
 *   level: "critical" | "warning" | "suggestion"
 */
export function IssueBadge({ level }) {
  const config = {
    critical: { label: 'Critical', className: 'bg-red-500/15 text-red-400 border border-red-500/30' },
    warning:  { label: 'Warning',  className: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' },
    suggestion: { label: 'Suggestion', className: 'bg-green-500/15 text-green-400 border border-green-500/30' },
  };
  const { label, className } = config[level] ?? config.suggestion;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${className}`}>
      {label}
    </span>
  );
}
