import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Booking } from "./agenda";
import { keys } from "./keys";
import { unwrap } from "./util";

/** 予約一覧のタブ(Web の /app/bookings と同じ分け方) */
export type BookingTab = "upcoming" | "pending" | "past" | "cancelled";

export function useBookings(tab: BookingTab) {
  return useQuery({
    queryKey: keys.bookings(tab),
    queryFn: async (): Promise<Booking[]> => {
      const now = new Date().toISOString();
      const query = supabase.from("bookings").select("*");
      switch (tab) {
        case "upcoming":
          return unwrap(await query.eq("status", "confirmed").gte("ends_at", now).order("starts_at").limit(200));
        case "pending":
          return unwrap(await query.eq("status", "pending").gte("ends_at", now).order("starts_at").limit(200));
        case "past":
          return unwrap(
            await query.in("status", ["confirmed", "pending"]).lt("ends_at", now).order("starts_at", { ascending: false }).limit(200),
          );
        case "cancelled":
          return unwrap(
            await query.in("status", ["cancelled", "declined"]).order("starts_at", { ascending: false }).limit(200),
          );
      }
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: keys.booking(id),
    queryFn: async (): Promise<Booking> => unwrap(await supabase.from("bookings").select("*").eq("id", id).single()),
  });
}

/** 予約の履歴(作成、承認、変更、キャンセルなど) */
export function useBookingEvents(id: string) {
  return useQuery({
    queryKey: keys.bookingEvents(id),
    queryFn: async () =>
      unwrap(await supabase.from("booking_events").select("*").eq("booking_id", id).order("created_at")),
  });
}

export type BookingAction = "approve" | "decline" | "cancel";

/**
 * 予約の承認・辞退・キャンセル。メール送信などを伴うので Web の API を呼ぶ
 * (POST /api/bookings/{id}/approve|decline|cancel)。
 */
export function useBookingAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: BookingAction; reason?: string }) =>
      api.post(`/api/bookings/${id}/${action}`, reason ? { reason } : {}),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: keys.booking(id) });
      void queryClient.invalidateQueries({ queryKey: keys.bookingsAll });
      void queryClient.invalidateQueries({ queryKey: keys.agendaAll });
      void queryClient.invalidateQueries({ queryKey: keys.home });
    },
  });
}
