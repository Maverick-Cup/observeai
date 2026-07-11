interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: { value: number; positive: boolean };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, subValue, trend, icon, className = "" }: StatCardProps) {
  return (
    <div
      className={`bg-card text-card-foreground rounded-xl border border-border shadow-md p-5 transition-all duration-200 ease-out hover:shadow-lg ${className}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold text-foreground tracking-tight">
          {typeof value === "number" && !Number.isInteger(value)
            ? value.toFixed(2)
            : value}
        </span>
        {subValue && (
          <span className="text-sm text-muted-foreground">{subValue}</span>
        )}
      </div>
      {trend && (
        <div className="mt-1 flex items-center gap-1">
          <svg
            className={`w-3.5 h-3.5 ${trend.positive ? "text-success" : "text-destructive"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {trend.positive ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            )}
          </svg>
          <span
            className={`text-xs font-medium ${trend.positive ? "text-success" : "text-destructive"}`}
          >
            {Math.abs(trend.value).toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  );
}