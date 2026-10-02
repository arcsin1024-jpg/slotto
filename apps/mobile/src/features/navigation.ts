import type { Href } from "expo-router";
import type { AgendaItem } from "@/features/data/agenda";

/** 予定(予約か反映中の外部予定)の詳細画面 */
export function agendaHref(item: Pick<AgendaItem, "sourceType" | "id">): Href {
  return item.sourceType === "booking"
    ? { pathname: "/bookings/[id]", params: { id: item.id } }
    : { pathname: "/events/[id]", params: { id: item.id } };
}
