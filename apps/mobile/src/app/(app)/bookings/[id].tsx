import { BOOKING_STATUS_LABELS, bookingAnswersSchema, formatDateTimeRange, LOCATION_LABELS, type LocationType } from "@slotto/core";
import { useLocalSearchParams } from "expo-router";
import { Alert, Linking } from "react-native";
import { Body, Button, Card, ErrorText, Heading, Loading, Screen } from "@/components/basic";
import { type BookingAction, useBooking, useBookingAction } from "@/features/data/bookings";
import { useTimeZone } from "@/features/data/profile";
import { parseJson } from "@/features/data/util";
import { EventAlarmEditor } from "@/features/notifications/event-alarm-editor";

const ACTION_LABELS: Record<BookingAction, string> = { approve: "承認する", decline: "辞退する", cancel: "キャンセルする" };

function answerText(value: string | boolean | string[]): string {
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  return value;
}

// 仮の画面。デザインが決まったら作り直す
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const timeZone = useTimeZone();
  const booking = useBooking(id);
  const action = useBookingAction();

  if (booking.isPending) return <Loading />;
  if (booking.error) return <Screen><ErrorText error={booking.error} /></Screen>;
  const b = booking.data;
  const answers = parseJson(bookingAnswersSchema, b.answers) ?? {};

  function confirm(kind: BookingAction) {
    Alert.alert(`${ACTION_LABELS[kind]}?`, "相手にメールで知らせます。", [
      { text: "やめる", style: "cancel" },
      {
        text: ACTION_LABELS[kind],
        style: kind === "approve" ? "default" : "destructive",
        onPress: () =>
          action.mutate({ id, action: kind }, { onError: (error) => Alert.alert("できませんでした", error.message) }),
      },
    ]);
  }

  return (
    <Screen refreshing={booking.isRefetching} onRefresh={() => void booking.refetch()}>
      <Heading>{b.title}</Heading>
      <Body muted>{BOOKING_STATUS_LABELS[b.status]}</Body>
      <Body>{formatDateTimeRange(b.starts_at, b.ends_at, timeZone)}</Body>
      <Card>
        <Body>{b.guest_name}</Body>
        <Body muted>{b.guest_email}</Body>
        {Object.entries(answers).map(([key, value]) => (
          <Body key={key} muted>{answerText(value)}</Body>
        ))}
      </Card>
      <Body muted>
        {LOCATION_LABELS[b.location_type as LocationType] ?? b.location_type}
        {b.location_value ? ` ・ ${b.location_value}` : ""}
      </Body>
      {b.meeting_url ? <Button label="会議に参加" onPress={() => void Linking.openURL(b.meeting_url as string)} /> : null}
      {b.status === "confirmed" ? <EventAlarmEditor sourceType="booking" sourceId={b.id} /> : null}
      {b.status === "pending" ? (
        <>
          <Button label={ACTION_LABELS.approve} loading={action.isPending} onPress={() => confirm("approve")} />
          <Button label={ACTION_LABELS.decline} variant="secondary" disabled={action.isPending} onPress={() => confirm("decline")} />
        </>
      ) : null}
      {b.status === "confirmed" ? (
        <Button label={ACTION_LABELS.cancel} variant="danger" disabled={action.isPending} onPress={() => confirm("cancel")} />
      ) : null}
    </Screen>
  );
}
