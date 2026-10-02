import "server-only";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleApiForConnection } from "./google/client";
import { cancelWatchJobs, errorMessage, scheduleWatchRenew, WATCH_RENEW_BEFORE_MS } from "./schedule";

/**
 * Google の変更通知(events.watch)。チャンネルは約 7 日で切れ、自動では延びないので、
 * 期限の 1 日前に張り直すジョブを入れておく。
 */

const WATCH_TTL_SECONDS = 7 * 24 * 60 * 60;

/** 変更通知の受け口。Google は HTTPS の URL にしか送らないので、ローカルでは張らない */
export function webhookAddress(): string | null {
  const url = `${publicEnv.appUrl}/api/webhooks/google-calendar`;
  return url.startsWith("https://") ? url : null;
}

/** カレンダーの変更通知を張る。まだ期限に余裕があれば何もしない(force で張り直す) */
export async function ensureCalendarWatch(calendarId: string, options: { force?: boolean } = {}): Promise<void> {
  const address = webhookAddress();
  if (!address) return;

  const admin = createAdminClient();
  const { data: calendar } = await admin
    .from("external_calendars")
    .select("id, user_id, connection_id, provider_calendar_id, is_enabled")
    .eq("id", calendarId)
    .maybeSingle();
  if (!calendar?.is_enabled) return;

  const { data: sync } = await admin.from("external_calendar_sync").select("*").eq("calendar_id", calendarId).maybeSingle();
  if (
    !options.force &&
    sync?.watch_expires_at &&
    Date.parse(sync.watch_expires_at) - WATCH_RENEW_BEFORE_MS > Date.now()
  ) {
    return;
  }

  const api = googleApiForConnection(calendar.connection_id);
  const token = randomBytes(32).toString("base64url");
  const channel = await api.watchEvents(calendar.provider_calendar_id, {
    id: randomUUID(),
    token,
    address,
    ttlSeconds: WATCH_TTL_SECONDS,
  });
  const expiresAt = new Date(channel.expiration ? Number(channel.expiration) : Date.now() + WATCH_TTL_SECONDS * 1000);

  await admin.from("external_calendar_sync").upsert(
    {
      calendar_id: calendarId,
      watch_channel_id: channel.id,
      watch_resource_id: channel.resourceId,
      watch_token: token,
      watch_expires_at: expiresAt.toISOString(),
    },
    { onConflict: "calendar_id" },
  );

  // 古いチャンネルは新しいものを張ってから止める(その間の通知を落とさないため)
  if (sync?.watch_channel_id && sync.watch_resource_id) {
    await api
      .stopChannel({ id: sync.watch_channel_id, resourceId: sync.watch_resource_id })
      .catch((e) => console.warn("[calendar] 古い変更通知を止められませんでした:", errorMessage(e)));
  }

  await scheduleWatchRenew(calendarId, calendar.user_id, expiresAt);
}

/** カレンダーの変更通知を止める(表示をオフにしたとき、連携を解除するとき) */
export async function stopCalendarWatch(calendarId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: sync } = await admin.from("external_calendar_sync").select("*").eq("calendar_id", calendarId).maybeSingle();
  await cancelWatchJobs(calendarId);
  if (!sync?.watch_channel_id || !sync.watch_resource_id) return;

  const { data: calendar } = await admin
    .from("external_calendars")
    .select("connection_id")
    .eq("id", calendarId)
    .maybeSingle();
  if (calendar) {
    await googleApiForConnection(calendar.connection_id)
      .stopChannel({ id: sync.watch_channel_id, resourceId: sync.watch_resource_id })
      .catch((e) => console.warn("[calendar] 変更通知を止められませんでした:", errorMessage(e)));
  }
  await admin
    .from("external_calendar_sync")
    .update({ watch_channel_id: null, watch_resource_id: null, watch_token: null, watch_expires_at: null })
    .eq("calendar_id", calendarId);
}

/** 変更通知のヘッダーから、どのカレンダーの通知かを確かめる。合わなければ null */
export async function findWatchedCalendar(
  channelId: string | null,
  channelToken: string | null,
): Promise<{ calendarId: string; connectionId: string; userId: string } | null> {
  if (!channelId || !channelToken) return null;
  const admin = createAdminClient();
  const { data: sync } = await admin
    .from("external_calendar_sync")
    .select("calendar_id, watch_token")
    .eq("watch_channel_id", channelId)
    .maybeSingle();
  if (!sync?.watch_token || !safeEqual(sync.watch_token, channelToken)) return null;

  const { data: calendar } = await admin
    .from("external_calendars")
    .select("id, connection_id, user_id")
    .eq("id", sync.calendar_id)
    .maybeSingle();
  if (!calendar) return null;
  return { calendarId: calendar.id, connectionId: calendar.connection_id, userId: calendar.user_id };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
