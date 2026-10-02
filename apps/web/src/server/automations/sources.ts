import "server-only";
import {
  automationActionsSchema,
  automationTargetSchema,
  automationTriggerSchema,
  formFieldsSchema,
  LOCATION_LABELS,
  type AutomationAction,
  type AutomationTarget,
  type AutomationTrigger,
  type LocationType,
} from "@slotto/core";
import type { AutomationRow, BookingRow, ExternalEventRow } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchesTarget, type ScheduleSource } from "@/server/jobs/timing";
import type { EventDetails } from "./template";

/** オートメーションが使う予定とオートメーションの読み込み(service_role。呼ぶ側で持ち主を確かめる) */

export interface ParsedAutomation {
  row: AutomationRow;
  trigger: AutomationTrigger;
  target: AutomationTarget;
  actions: AutomationAction[];
}

/** DB の行を検証して読む。形が正しくなければ null */
export function parseAutomation(row: AutomationRow): ParsedAutomation | null {
  const trigger = automationTriggerSchema.safeParse(row.trigger);
  const target = automationTargetSchema.safeParse(row.target);
  const actions = automationActionsSchema.safeParse(row.actions);
  if (!trigger.success || !target.success || !actions.success) return null;
  return { row, trigger: trigger.data, target: target.data, actions: actions.data };
}

export async function loadAutomation(automationId: string): Promise<AutomationRow | null> {
  const { data, error } = await createAdminClient().from("automations").select("*").eq("id", automationId).maybeSingle();
  if (error) throw new Error(`automations を読めません: ${error.message}`);
  return data;
}

/** ユーザーの有効なオートメーション(形の正しいものだけ) */
export async function loadEnabledAutomations(userId: string): Promise<ParsedAutomation[]> {
  const { data, error } = await createAdminClient().from("automations").select("*").eq("user_id", userId).eq("is_enabled", true);
  if (error) throw new Error(`automations を読めません: ${error.message}`);
  return (data ?? []).map(parseAutomation).filter((a): a is ParsedAutomation => a !== null);
}

export async function loadUserTimezone(userId: string): Promise<string> {
  const { data } = await createAdminClient().from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return data?.timezone ?? "Asia/Tokyo";
}

function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  return typeof value === "string" ? value : "";
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function bookingLocation(booking: BookingRow): string | null {
  if (booking.location_value && !isHttpUrl(booking.location_value)) return booking.location_value;
  const label = LOCATION_LABELS[booking.location_type as LocationType];
  return booking.location_type === "none" || !label ? null : label;
}

/** 予約を、オートメーションに渡す形にする。回答は予約ページの質問文と組にする */
export function bookingToDetails(booking: BookingRow, formFields: unknown): EventDetails {
  const parsedFields = formFieldsSchema.safeParse(formFields);
  const labels = new Map((parsedFields.success ? parsedFields.data : []).map((f) => [f.id, f.label]));
  const answers =
    booking.answers && typeof booking.answers === "object" && !Array.isArray(booking.answers)
      ? Object.entries(booking.answers)
          .map(([id, value]) => ({ label: labels.get(id) ?? id, value: answerText(value) }))
          .filter((a) => a.value !== "")
      : [];
  return {
    source_type: "booking",
    id: booking.id,
    title: booking.title,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    is_all_day: false,
    location: bookingLocation(booking),
    meeting_url: booking.meeting_url ?? (isHttpUrl(booking.location_value) ? booking.location_value : null),
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    answers,
    booking_page_id: booking.booking_page_id,
  };
}

export function externalEventToDetails(event: ExternalEventRow): EventDetails {
  return {
    source_type: "external_event",
    id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    is_all_day: event.is_all_day,
    location: event.location,
    meeting_url: isHttpUrl(event.location) ? event.location : null,
    guest_name: null,
    guest_email: null,
    answers: [],
    booking_page_id: null,
  };
}

export function toScheduleSource(details: EventDetails): ScheduleSource {
  return {
    type: details.source_type,
    id: details.id,
    bookingPageId: details.booking_page_id,
    startsAt: new Date(details.starts_at),
    endsAt: new Date(details.ends_at),
    isAllDay: details.is_all_day,
  };
}

async function formFieldsOf(pageIds: string[]): Promise<Map<string, unknown>> {
  if (pageIds.length === 0) return new Map();
  const { data } = await createAdminClient().from("booking_pages").select("id, form_fields").in("id", pageIds);
  return new Map((data ?? []).map((p) => [p.id, p.form_fields]));
}

export async function loadBooking(bookingId: string): Promise<{ row: BookingRow; details: EventDetails } | null> {
  const { data, error } = await createAdminClient().from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(`bookings を読めません: ${error.message}`);
  if (!data) return null;
  const fields = await formFieldsOf(data.booking_page_id ? [data.booking_page_id] : []);
  return { row: data, details: bookingToDetails(data, fields.get(data.booking_page_id ?? "")) };
}

export async function loadExternalEvent(eventId: string): Promise<{ row: ExternalEventRow; details: EventDetails } | null> {
  const { data, error } = await createAdminClient().from("external_events").select("*").eq("id", eventId).maybeSingle();
  if (error) throw new Error(`external_events を読めません: ${error.message}`);
  return data ? { row: data, details: externalEventToDetails(data) } : null;
}

/** 終了の後のトリガーは最長 7 日後なので、その分だけ過去の予定も見る */
const LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const LOOKAHEAD_MS = 400 * 24 * 60 * 60_000;
const MAX_SOURCES = 2000;

/**
 * 期間内の、確定した予約と反映中の外部予定。時刻順。
 * 期間を省くと、オートメーションの対象になりうる範囲(7 日前に終わったものから 400 日先まで)。
 */
export async function loadSourceDetails(
  userId: string,
  options: { from?: Date; to?: Date; now?: Date } = {},
): Promise<EventDetails[]> {
  const now = options.now ?? new Date();
  const from = (options.from ?? new Date(now.getTime() - LOOKBACK_MS)).toISOString();
  const to = (options.to ?? new Date(now.getTime() + LOOKAHEAD_MS)).toISOString();
  const admin = createAdminClient();

  const [bookings, events] = await Promise.all([
    admin
      .from("bookings")
      .select("*")
      .eq("host_id", userId)
      .eq("status", "confirmed")
      .gt("ends_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .limit(MAX_SOURCES),
    admin
      .from("external_events")
      .select("*")
      .eq("user_id", userId)
      .eq("is_selected", true)
      .gt("ends_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .limit(MAX_SOURCES),
  ]);
  if (bookings.error) throw new Error(`bookings を読めません: ${bookings.error.message}`);
  if (events.error) throw new Error(`external_events を読めません: ${events.error.message}`);

  const fields = await formFieldsOf([...new Set((bookings.data ?? []).flatMap((b) => (b.booking_page_id ? [b.booking_page_id] : [])))]);
  const details = [
    ...(bookings.data ?? []).map((b) => bookingToDetails(b, fields.get(b.booking_page_id ?? ""))),
    ...(events.data ?? []).map(externalEventToDetails),
  ];
  return details.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** その日の予定のうち、オートメーションの対象に当たるもの */
export async function loadAgenda(userId: string, target: AutomationTarget, range: { start: Date; end: Date }): Promise<EventDetails[]> {
  const events = await loadSourceDetails(userId, { from: range.start, to: range.end });
  return events.filter((e) => matchesTarget(target, toScheduleSource(e)));
}
