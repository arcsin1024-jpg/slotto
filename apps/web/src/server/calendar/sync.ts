import "server-only";
import { EXTERNAL_EVENT_WINDOW_DAYS } from "@slotto/core";
import type { ExternalCalendarRow, ExternalEventRow } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleApiForConnection } from "./google/client";
import { GoogleReauthRequiredError } from "./google/oauth";
import type { GoogleCalendarListEntry } from "./google/types";
import { errorMessage, scheduleNextPoll } from "./schedule";
import {
  syncCalendarEvents,
  syncWindow,
  type EventInsert,
  type EventUpdate,
  type StoredEvent,
  type SyncCounts,
  type SyncStore,
} from "./sync-core";
import { ensureCalendarWatch } from "./watch";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * 接続のカレンダー一覧を external_calendars に入れ、表示がオンのカレンダーの予定を
 * 今日から 90 日先まで差分で読み込む。
 * 連携が切れていたら GoogleReauthRequiredError を投げる(接続は「再連携が必要」になる)。
 */
export async function syncConnection(connectionId: string): Promise<SyncCounts> {
  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("calendar_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw new Error(`接続の読み込みに失敗しました: ${error.message}`);
  if (!connection) throw new Error("接続が見つかりません");
  if (connection.provider !== "google") throw new Error(`${connection.provider} の同期にはまだ対応していません`);
  if (connection.status !== "active") throw new GoogleReauthRequiredError();

  const { data: profile } = await admin.from("profiles").select("timezone").eq("id", connection.user_id).single();
  const userTimeZone = profile?.timezone ?? "Asia/Tokyo";
  const api = googleApiForConnection(connectionId);
  const totals: SyncCounts = { added: 0, updated: 0, removed: 0 };

  try {
    const remoteCalendars = await api.listCalendars();
    const calendars = await upsertCalendars(admin, connection.id, connection.user_id, remoteCalendars);
    const timeZones = new Map(remoteCalendars.map((c) => [c.id, c.timeZone]));
    const slottoEventIds = await listSlottoEventIds(admin, connection.user_id);
    const window = syncWindow(new Date(), userTimeZone, EXTERNAL_EVENT_WINDOW_DAYS);
    const store = createSupabaseSyncStore(admin, connection.user_id);

    for (const calendar of calendars.filter((c) => c.is_enabled)) {
      try {
        const counts = await syncCalendarEvents({
          api,
          store,
          calendar: {
            id: calendar.id,
            providerCalendarId: calendar.provider_calendar_id,
            autoSelectNew: calendar.auto_select_new,
            timeZone: timeZones.get(calendar.provider_calendar_id) ?? userTimeZone,
          },
          slottoEventIds,
          window,
        });
        totals.added += counts.added;
        totals.updated += counts.updated;
        totals.removed += counts.removed;
        await recordCalendarSync(admin, calendar.id, null);
      } catch (e) {
        if (e instanceof GoogleReauthRequiredError) throw e;
        // 1 つのカレンダーの失敗で全体を止めない
        await recordCalendarSync(admin, calendar.id, errorMessage(e));
        console.warn(`[calendar] カレンダー ${calendar.id} の同期に失敗しました:`, errorMessage(e));
      }
    }

    await admin
      .from("calendar_connections")
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq("id", connectionId);
  } catch (e) {
    if (!(e instanceof GoogleReauthRequiredError)) {
      await admin.from("calendar_connections").update({ last_error: errorMessage(e) }).eq("id", connectionId);
    }
    throw e;
  }

  return totals;
}

/**
 * 同期のあとの後始末: 変更通知を張り、次の定期同期を入れる。
 * どちらも失敗しても同期の結果には影響させない。
 */
export async function afterSync(connectionId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: calendars } = await admin
    .from("external_calendars")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("is_enabled", true);
  for (const calendar of calendars ?? []) {
    await ensureCalendarWatch(calendar.id).catch((e) =>
      console.warn(`[calendar] 変更通知を張れませんでした(${calendar.id}):`, errorMessage(e)),
    );
  }
  await scheduleNextPoll(connectionId, userId);
}

// ---------------------------------------------------------------------------

async function upsertCalendars(
  admin: Admin,
  connectionId: string,
  userId: string,
  remote: GoogleCalendarListEntry[],
): Promise<ExternalCalendarRow[]> {
  const { data: existing, error } = await admin.from("external_calendars").select("*").eq("connection_id", connectionId);
  if (error) throw new Error(`カレンダーの読み込みに失敗しました: ${error.message}`);
  const byProviderId = new Map((existing ?? []).map((c) => [c.provider_calendar_id, c]));

  const rows = remote.map((c) => {
    const canWrite = c.accessRole === "owner" || c.accessRole === "writer";
    const current = byProviderId.get(c.id);
    return {
      connection_id: connectionId,
      user_id: userId,
      provider_calendar_id: c.id,
      name: c.summaryOverride || c.summary || c.id,
      color: c.backgroundColor ?? null,
      is_primary: Boolean(c.primary),
      can_write: canWrite,
      // 新しいカレンダーは、自分が書けるもの(自分のカレンダー)だけ最初からオンにする。
      // 祝日や他人の共有カレンダーはオフで入れ、必要なら連携画面でオンにしてもらう
      is_enabled: current ? current.is_enabled : canWrite,
    };
  });

  let saved: ExternalCalendarRow[] = [];
  if (rows.length) {
    const { data, error: upsertError } = await admin
      .from("external_calendars")
      .upsert(rows, { onConflict: "connection_id,provider_calendar_id" })
      .select("*");
    if (upsertError) throw new Error(`カレンダーの保存に失敗しました: ${upsertError.message}`);
    saved = data ?? [];
  }

  // Google 側で消えた・購読をやめたカレンダーは、予定ごと消す
  const remoteIds = new Set(remote.map((c) => c.id));
  const removed = (existing ?? []).filter((c) => !remoteIds.has(c.provider_calendar_id)).map((c) => c.id);
  if (removed.length) await admin.from("external_calendars").delete().in("id", removed);

  return saved;
}

async function listSlottoEventIds(admin: Admin, userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("bookings")
      .select("provider_event_id")
      .eq("host_id", userId)
      .not("provider_event_id", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`予約の読み込みに失敗しました: ${error.message}`);
    for (const row of data ?? []) if (row.provider_event_id) ids.add(row.provider_event_id);
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

async function recordCalendarSync(admin: Admin, calendarId: string, lastError: string | null): Promise<void> {
  await admin.from("external_calendar_sync").upsert(
    { calendar_id: calendarId, last_synced_at: new Date().toISOString(), last_error: lastError },
    { onConflict: "calendar_id" },
  );
}

// ---------------------------------------------------------------------------
// SyncStore の Supabase 版
// ---------------------------------------------------------------------------

const EVENT_COLUMNS =
  "id, provider_event_id, series_id, title, location, starts_at, ends_at, is_all_day, status, is_busy, html_link, provider_updated_at, is_selected" as const;

type StoredEventRow = Pick<
  ExternalEventRow,
  | "id"
  | "provider_event_id"
  | "series_id"
  | "title"
  | "location"
  | "starts_at"
  | "ends_at"
  | "is_all_day"
  | "status"
  | "is_busy"
  | "html_link"
  | "provider_updated_at"
  | "is_selected"
>;

function createSupabaseSyncStore(admin: Admin, userId: string): SyncStore {
  return {
    async listEvents(calendarId) {
      const result: StoredEvent[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await admin
          .from("external_events")
          .select(EVENT_COLUMNS)
          .eq("calendar_id", calendarId)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`外部予定の読み込みに失敗しました: ${error.message}`);
        const rows: StoredEventRow[] = data ?? [];
        result.push(...rows.map(toStored));
        if (rows.length < PAGE) break;
      }
      return result;
    },

    async listSeriesSelections(calendarId) {
      const { data, error } = await admin
        .from("external_series_selections")
        .select("series_id")
        .eq("calendar_id", calendarId);
      if (error) throw new Error(`繰り返しの選択の読み込みに失敗しました: ${error.message}`);
      return new Set((data ?? []).map((r) => r.series_id));
    },

    async insertEvents(calendarId, events) {
      const now = new Date().toISOString();
      for (const chunk of chunks(events, 500)) {
        const { error } = await admin.from("external_events").insert(
          chunk.map((e) => ({
            ...contentColumns(e),
            user_id: userId,
            calendar_id: calendarId,
            is_selected: e.isSelected,
            selected_at: e.isSelected ? now : null,
            selected_by: e.selectedBy,
          })),
        );
        if (error) throw new Error(`外部予定の追加に失敗しました: ${error.message}`);
      }
    },

    async updateEvents(calendarId, events) {
      // 内容の列だけを送る。選択の列は送らないので、そのまま残る
      for (const chunk of chunks(events, 500)) {
        const { error } = await admin
          .from("external_events")
          .upsert(
            chunk.map((e) => ({ id: e.id, user_id: userId, calendar_id: calendarId, ...contentColumns(e) })),
            { onConflict: "id" },
          );
        if (error) throw new Error(`外部予定の更新に失敗しました: ${error.message}`);
      }
    },

    async deleteEvents(ids) {
      for (const chunk of chunks(ids, 200)) {
        const { error } = await admin.from("external_events").delete().in("id", chunk);
        if (error) throw new Error(`外部予定の削除に失敗しました: ${error.message}`);
      }
    },
  };
}


function toStored(row: StoredEventRow): StoredEvent {
  return {
    id: row.id,
    providerEventId: row.provider_event_id,
    seriesId: row.series_id,
    title: row.title,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAllDay: row.is_all_day,
    status: row.status,
    isBusy: row.is_busy,
    htmlLink: row.html_link,
    providerUpdatedAt: row.provider_updated_at,
    isSelected: row.is_selected,
  };
}

function contentColumns(e: EventInsert | EventUpdate) {
  return {
    provider_event_id: e.providerEventId,
    series_id: e.seriesId,
    title: e.title,
    location: e.location,
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    is_all_day: e.isAllDay,
    status: e.status,
    is_busy: e.isBusy,
    html_link: e.htmlLink,
    provider_updated_at: e.providerUpdatedAt,
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}
