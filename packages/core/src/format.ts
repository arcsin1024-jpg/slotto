/**
 * 日時の表示。保存は UTC、表示のときにタイムゾーンを当てる。
 */

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}:${JSON.stringify(options)}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("ja-JP", { timeZone, ...options });
    cache.set(key, format);
  }
  return format;
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** 例: 10月2日(金) */
export function formatDate(value: Date | string, timeZone: string): string {
  return formatter(timeZone, { month: "long", day: "numeric", weekday: "short" }).format(toDate(value));
}

/** 例: 2026年10月2日(金) */
export function formatFullDate(value: Date | string, timeZone: string): string {
  return formatter(timeZone, { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(
    toDate(value),
  );
}

/** 例: 14:30 */
export function formatTime(value: Date | string, timeZone: string): string {
  return formatter(timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(toDate(value));
}

/** 例: 10月2日(金) 14:30〜15:00 */
export function formatDateTimeRange(start: Date | string, end: Date | string, timeZone: string): string {
  return `${formatDate(start, timeZone)} ${formatTime(start, timeZone)}〜${formatTime(end, timeZone)}`;
}

/** 例: 30 分 / 1 時間 / 1 時間 30 分 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`;
}

/** 例: 10 分前 / 1 時間前 / 1 日前 */
export function formatLeadTime(minutes: number): string {
  if (minutes === 0) return "開始時刻";
  if (minutes % 1440 === 0) return `${minutes / 1440} 日前`;
  if (minutes % 60 === 0) return `${minutes / 60} 時間前`;
  return `${minutes} 分前`;
}
