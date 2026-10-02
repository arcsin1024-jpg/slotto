import "server-only";
import type { EventSelectionInput } from "@slotto/core";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SelectionResultEvent {
  id: string;
  is_selected: boolean;
  selected_by: "manual" | "series" | "auto" | null;
}

/**
 * 外部予定の選択・解除。
 * apply_to_series のときは、繰り返しの「今後すべて」として扱う:
 * 指定した回とそれ以降の回をまとめて変え、external_series_selections も更新する
 * (選択なら追加し、今後増える回も選択済みで入るようにする。解除なら消す)。
 * 戻り値は状態が変わった予定(画面の楽観的更新の答え合わせに使う)。
 */
export async function applyEventSelection(
  userId: string,
  input: EventSelectionInput,
): Promise<SelectionResultEvent[]> {
  const admin = createAdminClient();
  const { data: targets, error } = await admin
    .from("external_events")
    .select("id, calendar_id, series_id, starts_at")
    .eq("user_id", userId)
    .in("id", input.event_ids);
  if (error) throw new Error(`外部予定の読み込みに失敗しました: ${error.message}`);
  if (!targets?.length) return [];

  const now = new Date().toISOString();
  const selection = input.selected
    ? { is_selected: true, selected_at: now, seen_at: now }
    : { is_selected: false, selected_at: null, selected_by: null, seen_at: now };
  const changed: SelectionResultEvent[] = [];

  // 繰り返しの「今後すべて」: 繰り返しごとに、指定した回のうち最も早い回から後ろをまとめて変える
  const seriesStarts = new Map<string, { calendarId: string; seriesId: string; from: string }>();
  const singles: string[] = [];
  for (const event of targets) {
    if (input.apply_to_series && event.series_id) {
      const key = `${event.calendar_id}\u0000${event.series_id}`;
      const current = seriesStarts.get(key);
      if (!current || Date.parse(event.starts_at) < Date.parse(current.from)) {
        seriesStarts.set(key, { calendarId: event.calendar_id, seriesId: event.series_id, from: event.starts_at });
      }
    } else {
      singles.push(event.id);
    }
  }

  for (const { calendarId, seriesId, from } of seriesStarts.values()) {
    if (input.selected) {
      const { error: upsertError } = await admin
        .from("external_series_selections")
        .upsert({ calendar_id: calendarId, series_id: seriesId, user_id: userId }, { onConflict: "calendar_id,series_id" });
      if (upsertError) throw new Error(`繰り返しの選択の保存に失敗しました: ${upsertError.message}`);
    } else {
      await admin
        .from("external_series_selections")
        .delete()
        .eq("calendar_id", calendarId)
        .eq("series_id", seriesId)
        .eq("user_id", userId);
    }

    const { data, error: updateError } = await admin
      .from("external_events")
      .update(input.selected ? { ...selection, selected_by: "series" as const } : selection)
      .eq("user_id", userId)
      .eq("calendar_id", calendarId)
      .eq("series_id", seriesId)
      .gte("starts_at", from)
      .select("id, is_selected, selected_by");
    if (updateError) throw new Error(`外部予定の更新に失敗しました: ${updateError.message}`);
    changed.push(...(data ?? []));
  }

  if (singles.length) {
    const { data, error: updateError } = await admin
      .from("external_events")
      .update(input.selected ? { ...selection, selected_by: "manual" as const } : selection)
      .eq("user_id", userId)
      .in("id", singles)
      .select("id, is_selected, selected_by");
    if (updateError) throw new Error(`外部予定の更新に失敗しました: ${updateError.message}`);
    changed.push(...(data ?? []));
  }

  return changed;
}

/** 取り込み画面で見た予定に印を付ける(「未選択の新着」の件数から外れる)。ids を省くとすべて */
export async function markEventsSeen(userId: string, eventIds?: string[]): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("external_events")
    .update({ seen_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("seen_at", null);
  if (eventIds) query = query.in("id", eventIds);
  const { data, error } = await query.select("id");
  if (error) throw new Error(`外部予定の更新に失敗しました: ${error.message}`);
  return data?.length ?? 0;
}
