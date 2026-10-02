import { BOOKING_STATUS_LABELS, formatDateTimeRange } from "@slotto/core";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, Button, ErrorText, Loading, Row, Screen } from "@/components/basic";
import { type BookingTab, useBookings } from "@/features/data/bookings";
import { useTimeZone } from "@/features/data/profile";
import { space } from "@/theme";

const TABS: { key: BookingTab; label: string }[] = [
  { key: "upcoming", label: "これから" },
  { key: "pending", label: "承認待ち" },
  { key: "past", label: "過去" },
  { key: "cancelled", label: "キャンセル" },
];

// 仮の画面。デザインが決まったら作り直す
export default function BookingsScreen() {
  const [tab, setTab] = useState<BookingTab>("upcoming");
  const timeZone = useTimeZone();
  const bookings = useBookings(tab);

  return (
    <Screen refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()}>
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Button key={item.key} label={item.label} variant={tab === item.key ? "primary" : "secondary"}
            onPress={() => setTab(item.key)} />
        ))}
      </View>
      {bookings.isPending ? (
        <Loading />
      ) : bookings.error ? (
        <ErrorText error={bookings.error} />
      ) : bookings.data.length === 0 ? (
        <Body muted>予約はありません</Body>
      ) : (
        bookings.data.map((booking) => (
          <Row
            key={booking.id}
            title={`${booking.guest_name} ・ ${booking.title}`}
            subtitle={`${formatDateTimeRange(booking.starts_at, booking.ends_at, timeZone)} ・ ${BOOKING_STATUS_LABELS[booking.status]}`}
            onPress={() => router.push({ pathname: "/bookings/[id]", params: { id: booking.id } })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
