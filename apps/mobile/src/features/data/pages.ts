import { availabilitySchema, DEFAULT_AVAILABILITY, formatDate, formatTime } from "@slotto/core";
import type { Tables } from "@slotto/core/database";
import { computeSlots, groupSlotsByDate, type Interval, type Slot } from "@slotto/core/slots";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { keys } from "./keys";
import { parseJson, unwrap } from "./util";

export type BookingPage = Tables<"booking_pages">;

export function useBookingPages() {
  return useQuery({
    queryKey: keys.bookingPages,
    queryFn: async (): Promise<BookingPage[]> =>
      unwrap(await supabase.from("booking_pages").select("*").order("created_at")),
  });
}

/** 予約ページの公開・一時停止(予約ページは自分の行なので直接書き換えられる) */
export function useSetPageActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }): Promise<BookingPage> =>
      unwrap(await supabase.from("booking_pages").update({ is_active: isActive }).eq("id", id).select("*").single()),
    onSuccess: (row) => {
      queryClient.setQueryData<BookingPage[]>(keys.bookingPages, (pages) =>
        pages?.map((page) => (page.id === row.id ? row : page)),
      );
    },
  });
}

/** ゲストに送る予約ページの URL(Web の /{username}/{slug}) */
export function bookingPageUrl(username: string, slug: string): string {
  return `${env.apiUrl}/${username}/${slug}`;
}

/**
 * 候補日時の文章を作る。メールやチャットに貼る用。
 * 空き枠は、予約・反映中の外部予定・候補日時を読んで、端末で計算する(@slotto/core の computeSlots)。
 */
export async function buildCandidateText(
  page: BookingPage,
  options: { days?: number; maxSlotsPerDay?: number; url?: string } = {},
): Promise<string> {
  const days = options.days ?? 7;
  const now = new Date();
  const from = now;
  const to = new Date(now.getTime() + days * 86_400_000);
  const range = { from: from.toISOString(), to: to.toISOString() };

  const [bookings, events, candidates] = await Promise.all([
    supabase
      .from("bookings")
      .select("starts_at, ends_at")
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", range.to)
      .gt("ends_at", range.from),
    supabase
      .from("external_events")
      .select("starts_at, ends_at")
      .eq("is_selected", true)
      .eq("is_busy", true)
      .lt("starts_at", range.to)
      .gt("ends_at", range.from),
    page.slot_mode === "candidates"
      ? supabase.from("booking_page_candidates").select("starts_at, ends_at").eq("booking_page_id", page.id)
      : Promise.resolve({ data: [] as { starts_at: string; ends_at: string }[], error: null }),
  ]);
  const toInterval = (row: { starts_at: string; ends_at: string }): Interval => ({
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
  });

  const slots = computeSlots({
    page: {
      ...page,
      availability: parseJson(availabilitySchema, page.availability) ?? DEFAULT_AVAILABILITY,
    },
    from,
    to,
    now,
    bookings: unwrap(bookings).map(toInterval),
    externalBusy: unwrap(events).map(toInterval),
    candidates: unwrap(candidates).map(toInterval),
  });
  return formatCandidateText(slots, page.timezone, { maxSlotsPerDay: options.maxSlotsPerDay, url: options.url });
}

/** 例: 「10月6日(火) 10:00 / 10:30 / 14:00」を日ごとに 1 行 */
export function formatCandidateText(
  slots: Slot[],
  timeZone: string,
  options: { maxSlotsPerDay?: number; url?: string } = {},
): string {
  const maxSlotsPerDay = options.maxSlotsPerDay ?? 6;
  const groups = groupSlotsByDate(slots, timeZone);
  const lines = Object.keys(groups)
    .sort()
    .map((key) => {
      const daySlots = groups[key] ?? [];
      const first = daySlots[0];
      if (!first) return null;
      const times = daySlots.slice(0, maxSlotsPerDay).map((slot) => formatTime(slot.start, timeZone));
      const more = daySlots.length > maxSlotsPerDay ? " ほか" : "";
      return `${formatDate(first.start, timeZone)} ${times.join(" / ")}${more}`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) return "";
  const body = ["以下の日時でご都合のよいものをお選びください。", "", ...lines];
  if (options.url) body.push("", `こちらから予約できます: ${options.url}`);
  return body.join("\n");
}
