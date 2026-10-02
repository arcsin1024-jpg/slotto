import { TZDate } from "@date-fns/tz";
import type { GoogleCalendarApi } from "./google/api";
import { normalizeGoogleEvent, type NormalizedEvent } from "./normalize";

/**
 * 外部予定の差分の取り込み。DB と Google API に直接触れず、
 * SyncStore と GoogleCalendarApi を通して読み書きする(単体テストで差し替えるため)。
 *
 * 方式: 期間(今日から 90 日先)の予定を、繰り返しを各回に展開して読み直し、
 * 保存済みの行と突き合わせて、新規・変更・削除の分だけを書き込む。
 * (docs/research/tech.md 2 章の「案 W」)
 */

/** 保存済みの外部予定(external_events の必要な列) */
export interface StoredEvent {
  id: string;
  providerEventId: string;
  seriesId: string | null;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  status: "confirmed" | "tentative";
  isBusy: boolean;
  htmlLink: string | null;
  providerUpdatedAt: string | null;
  isSelected: boolean;
}

export interface EventInsert extends NormalizedEvent {
  isSelected: boolean;
  selectedBy: "series" | "auto" | null;
}

export interface EventUpdate extends NormalizedEvent {
  id: string;
}

export interface SyncPlan {
  inserts: EventInsert[];
  updates: EventUpdate[];
  deletes: string[];
}

export interface PlanInput {
  existing: StoredEvent[];
  fetched: NormalizedEvent[];
  /** 「今後すべて反映」に指定された繰り返しの親 ID */
  seriesSelections: ReadonlySet<string>;
  /** カレンダーの「新しい予定を自動で反映」 */
  autoSelectNew: boolean;
  /** 読み込んだ期間。この期間にかかる保存済みの予定のうち、読み込み結果に無いものを消す */
  window: { timeMin: Date; timeMax: Date };
}

/** 保存済みの予定と読み込んだ予定を突き合わせ、書き込む差分を決める */
export function planEventSync(input: PlanInput): SyncPlan {
  const existingByProviderId = new Map(input.existing.map((e) => [e.providerEventId, e]));
  const fetchedIds = new Set<string>();
  const plan: SyncPlan = { inserts: [], updates: [], deletes: [] };

  for (const event of input.fetched) {
    // 同じ ID が 2 回返ってきたら先のものを使う
    if (fetchedIds.has(event.providerEventId)) continue;
    fetchedIds.add(event.providerEventId);

    const stored = existingByProviderId.get(event.providerEventId);
    if (stored) {
      // 変更は内容だけ更新し、選択の状態は保つ
      if (hasChanged(stored, event)) plan.updates.push({ ...event, id: stored.id });
      continue;
    }

    const bySeries = event.seriesId !== null && input.seriesSelections.has(event.seriesId);
    // 自動で反映するのは「予定あり」の予定だけ。「今後すべて」は本人の指定なのでそのまま従う
    const byAuto = input.autoSelectNew && event.isBusy;
    plan.inserts.push({
      ...event,
      isSelected: bySeries || byAuto,
      selectedBy: bySeries ? "series" : byAuto ? "auto" : null,
    });
  }

  const min = input.window.timeMin.getTime();
  const max = input.window.timeMax.getTime();
  for (const stored of input.existing) {
    if (fetchedIds.has(stored.providerEventId)) continue;
    // 期間の外の予定(過去の予定など)は今回の読み込みの対象ではないので残す
    const overlaps = Date.parse(stored.endsAt) > min && Date.parse(stored.startsAt) < max;
    // 長さ 0 の予定が期間の始まりちょうどにある場合も対象に含める
    const zeroLengthAtStart = Date.parse(stored.startsAt) === min && stored.startsAt === stored.endsAt;
    if (overlaps || zeroLengthAtStart) plan.deletes.push(stored.id);
  }

  return plan;
}

function hasChanged(stored: StoredEvent, event: NormalizedEvent): boolean {
  return (
    stored.title !== event.title ||
    stored.location !== event.location ||
    !sameInstant(stored.startsAt, event.startsAt) ||
    !sameInstant(stored.endsAt, event.endsAt) ||
    stored.isAllDay !== event.isAllDay ||
    stored.status !== event.status ||
    stored.isBusy !== event.isBusy ||
    stored.seriesId !== event.seriesId ||
    stored.htmlLink !== event.htmlLink
  );
}

function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}

// ---------------------------------------------------------------------------
// 1 つのカレンダーの同期
// ---------------------------------------------------------------------------

/** 同期に使う DB の読み書き。実物は Supabase、テストではメモリ上の偽物 */
export interface SyncStore {
  listEvents(calendarId: string): Promise<StoredEvent[]>;
  listSeriesSelections(calendarId: string): Promise<Set<string>>;
  insertEvents(calendarId: string, events: EventInsert[]): Promise<void>;
  updateEvents(calendarId: string, events: EventUpdate[]): Promise<void>;
  deleteEvents(ids: string[]): Promise<void>;
}

export interface SyncCalendarInput {
  api: GoogleCalendarApi;
  store: SyncStore;
  calendar: {
    id: string;
    providerCalendarId: string;
    autoSelectNew: boolean;
    timeZone: string;
  };
  /** Slotto の予約として書き込んだ予定の ID */
  slottoEventIds: ReadonlySet<string>;
  window: { timeMin: Date; timeMax: Date };
}

export interface SyncCounts {
  added: number;
  updated: number;
  removed: number;
}

export async function syncCalendarEvents(input: SyncCalendarInput): Promise<SyncCounts> {
  const raw = await input.api.listEvents(input.calendar.providerCalendarId, input.window);
  const fetched = raw
    .map((event) =>
      normalizeGoogleEvent(event, { timeZone: input.calendar.timeZone, slottoEventIds: input.slottoEventIds }),
    )
    .filter((event): event is NormalizedEvent => event !== null);

  const [existing, seriesSelections] = await Promise.all([
    input.store.listEvents(input.calendar.id),
    input.store.listSeriesSelections(input.calendar.id),
  ]);

  const plan = planEventSync({
    existing,
    fetched,
    seriesSelections,
    autoSelectNew: input.calendar.autoSelectNew,
    window: input.window,
  });

  // 消してから入れる(同じ予定 ID の入れ直しで一意制約に当たらないように)
  if (plan.deletes.length) await input.store.deleteEvents(plan.deletes);
  if (plan.updates.length) await input.store.updateEvents(input.calendar.id, plan.updates);
  if (plan.inserts.length) await input.store.insertEvents(input.calendar.id, plan.inserts);

  return { added: plan.inserts.length, updated: plan.updates.length, removed: plan.deletes.length };
}

/** 読み込む期間: タイムゾーンでの今日の 0 時から days 日先まで */
export function syncWindow(now: Date, timeZone: string, days: number): { timeMin: Date; timeMax: Date } {
  const today = new TZDate(now.getTime(), timeZone);
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  return {
    timeMin: new Date(new TZDate(y, m, d, timeZone).getTime()),
    timeMax: new Date(new TZDate(y, m, d + days, timeZone).getTime()),
  };
}
