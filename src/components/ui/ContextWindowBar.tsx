interface ContextWindowBarProps {
  tokensUsed: number;
  tokenLimit: number;
  label?: string;
  showLabels?: boolean;
  compact?: boolean;
}

function percentageColor(pct: number) {
  if (pct >= 95) return "bg-destructive";
  if (pct >= 80) return "bg-warning";
  return "bg-primary";
}

export function ContextWindowBar({
  tokensUsed,
  tokenLimit,
  label,
  showLabels = true,
  compact = false,
}: ContextWindowBarProps) {
  const pct = Math.min((tokensUsed / tokenLimit) * 100, 100);
  const color = percentageColor(pct);

  return (
    <div className={`flex flex-col gap-1 ${compact ? "" : "w-full"}`}>
      {showLabels && label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={tokensUsed}
          aria-valuemin={0}
          aria-valuemax={tokenLimit}
          aria-label={`${tokensUsed.toLocaleString()} / ${tokenLimit.toLocaleString()} tokens (${Math.round(pct)}%)`}
        />
        {pct >= 95 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] font-bold text-destructive-foreground">⚠</span>
          </div>
        )}
      </div>
      {showLabels && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{tokensUsed.toLocaleString()} tok</span>
          <span>{tokenLimit.toLocaleString()} limit</span>
        </div>
      )}
    </div>
  );
}

interface ModelContextBarProps {
  data: Array<{ model: string; tokensUsed: number; tokenLimit: number }>;
  compact?: boolean;
}

export function ModelContextBars({ data, compact = false }: ModelContextBarProps) {
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <ContextWindowBar
          key={d.model}
          label={d.model}
          tokensUsed={d.tokensUsed}
          tokenLimit={d.tokenLimit}
          compact={compact}
        />
      ))}
    </div>
  );
}