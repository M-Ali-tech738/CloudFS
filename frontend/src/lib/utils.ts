export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (diff < day) {
    return "Today";
  } else if (diff < 2 * day) {
    return "Yesterday";
  } else if (diff < 7 * day) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  } else {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
}
