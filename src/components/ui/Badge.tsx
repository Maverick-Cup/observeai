interface BadgeProps {
  variant?: "success" | "warning" | "destructive" | "info" | "neutral";
  children: string;
  className?: string;
}

export function Badge({ variant = "info", children, className = "" }: BadgeProps) {
  const variants: Record<string, string> = {
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/20 text-destructive",
    info: "bg-info/20 text-info",
    neutral: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: "success" | "error" | "partial" | string }) {
  const colors: Record<string, string> = {
    success: "bg-success",
    error: "bg-destructive",
    partial: "bg-warning",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-muted-foreground"}`}
      aria-hidden="true"
    />
  );
}