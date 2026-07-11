import { CheckCircle2, XCircle, AlertCircle, Code } from "lucide-react";

interface SchemaValidationBadgeProps {
  validRate: number;
  total: number;
  invalidCount: number;
  topErrors?: Array<{ errorType: string; count: number }>;
  size?: "sm" | "md";
}

const errorTypeLabels: Record<string, string> = {
  parse_error: "Parse Error",
  missing_field: "Missing Field",
  type_error: "Type Error",
  enum_error: "Invalid Enum",
  trailing_comma: "Trailing Comma",
  truncated_json: "Truncated JSON",
};

export function SchemaValidationBadge({
  validRate,
  total,
  invalidCount,
  topErrors,
  size = "md",
}: SchemaValidationBadgeProps) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Rate indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
          validRate >= 95 ? "bg-success/10 border-success/20" :
          validRate >= 80 ? "bg-warning/10 border-warning/20" :
          "bg-destructive/10 border-destructive/20"
        }`}>
          {validRate >= 95 ? (
            <CheckCircle2 className={`${iconSize} text-success`} />
          ) : validRate >= 80 ? (
            <AlertCircle className={`${iconSize} text-warning`} />
          ) : (
            <XCircle className={`${iconSize} text-destructive`} />
          )}
          <span className={`${textSize} font-medium`}>
            {validRate.toFixed(1)}% valid
          </span>
        </div>
        <span className={`${size === "sm" ? "text-[10px]" : "text-xs"} text-muted-foreground`}>
          {total - invalidCount}/{total} passed
        </span>
      </div>

      {topErrors && topErrors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topErrors.slice(0, 4).map((err) => (
            <span
              key={err.errorType}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 border border-destructive/20 text-[10px] text-destructive font-medium"
            >
              <Code className="w-3 h-3" />
              {errorTypeLabels[err.errorType] ?? err.errorType}
              <span className="text-destructive/70">({err.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}