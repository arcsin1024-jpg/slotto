import type { BookingStatus, FormField, LocationType } from "@slotto/core";

/**
 * ゲスト向けに返す形(公開 API と予約ページの画面で使う)。
 * ホストの予定の中身や、予約ページの細かい設定は含めない。
 */

export interface PublicHost {
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface PublicBookingPage {
  slug: string;
  title: string;
  description: string | null;
  color: string;
  kind: "recurring" | "one_time";
  duration_minutes: number;
  location_type: LocationType;
  confirmation_mode: "instant" | "approval";
  form_fields: FormField[];
  /** ホスト側の基準のタイムゾーン。ゲストの初期表示は端末のタイムゾーンにする */
  timezone: string;
  /** 何日先まで受け付けるか(日付の選択範囲に使う) */
  max_days_ahead: number;
}

export interface PublicPageResponse {
  host: PublicHost;
  page: PublicBookingPage;
}

export interface PublicSlotsResponse {
  /** UTC の ISO 8601。表示のときにゲストのタイムゾーンを当てる */
  slots: { start: string; end: string }[];
  from: string;
  to: string;
}

/** 予約の確認・変更・キャンセル画面(/b/{token})用 */
export interface PublicBooking {
  token: string;
  title: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  location_type: LocationType;
  /** 確定している予約だけに出す(会議 URL、住所、電話番号など) */
  location_value: string | null;
  meeting_url: string | null;
  cancelled_at: string | null;
  cancelled_by: "host" | "guest" | null;
  host: { display_name: string; username: string | null };
  /** 日程変更で新しい日時を選ぶときの予約ページ。予約ページが消えていれば null */
  page: { slug: string; duration_minutes: number; timezone: string; completion_message: string | null } | null;
  can_cancel: boolean;
  can_reschedule: boolean;
  /** 変更・キャンセルの期限(UTC)。期限が無ければ null */
  change_deadline: string | null;
  /** 日程変更でできた新しい予約のトークン。この予約が日程変更で置き換わっていれば入る */
  rescheduled_to_token: string | null;
}

/** 予約の作成・変更の結果として、ゲストの画面に返す形 */
export interface PublicBookingCreated {
  booking: PublicBooking;
}
