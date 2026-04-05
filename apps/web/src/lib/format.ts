export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("ja-JP", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100 ? 0 : 1
  }).format(value);

export const formatRelativeDuration = (remainingMs: number): string => {
  if (remainingMs <= 0) {
    return "完了";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

export const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
