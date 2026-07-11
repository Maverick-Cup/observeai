/** Format a timestamp as a human-friendly relative time string */
export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

/** Abbreviate a hex ID for display */
export function shortId(id: string, len = 12): string {
  return `${id.slice(0, len)}...`;
}

/** Format cents as a USD string */
export function usd(cents: number | string): string {
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  return `$${n.toFixed(4)}`;
}

/** Format a date for axis labels */
export function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Full date-time for table cells */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}