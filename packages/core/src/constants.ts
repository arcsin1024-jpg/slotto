/** 既定のタイムゾーン */
export const DEFAULT_TIMEZONE = "Asia/Tokyo";

/**
 * ユーザー名に使えない語。
 * 予約ページの URL が `/{username}/{slug}` なので、Web のルートと重なる語を弾く。
 */
export const RESERVED_USERNAMES = [
  "admin",
  "api",
  "app",
  "auth",
  "b",
  "blog",
  "booking",
  "bookings",
  "contact",
  "dashboard",
  "docs",
  "embed",
  "help",
  "legal",
  "login",
  "logout",
  "pricing",
  "privacy",
  "s",
  "settings",
  "signin",
  "signup",
  "slotto",
  "static",
  "support",
  "terms",
  "www",
] as const;

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/;

/** 所要時間の選択肢(分) */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

/** 枠の刻みの選択肢(分) */
export const SLOT_INTERVAL_OPTIONS = [15, 30, 60] as const;

/** 外部予定を読み込む範囲(今日から何日先まで) */
export const EXTERNAL_EVENT_WINDOW_DAYS = 90;

export const PAGE_COLORS = [
  "blue",
  "green",
  "teal",
  "purple",
  "pink",
  "orange",
  "yellow",
  "gray",
] as const;
export type PageColor = (typeof PAGE_COLORS)[number];

export const LOCATION_TYPES = [
  "google_meet",
  "zoom",
  "teams",
  "in_person",
  "phone",
  "custom_url",
  "none",
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_LABELS: Record<LocationType, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  in_person: "対面",
  phone: "電話",
  custom_url: "URL を指定",
  none: "指定しない",
};

export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled", "declined"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "承認待ち",
  confirmed: "確定",
  cancelled: "キャンセル",
  declined: "辞退",
};
