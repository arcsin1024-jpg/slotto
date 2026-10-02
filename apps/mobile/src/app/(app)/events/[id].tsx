import { formatDateTimeRange } from "@slotto/core";
import { useLocalSearchParams } from "expo-router";
import { Alert, Linking } from "react-native";
import { Body, Button, ErrorText, Heading, Loading, Screen } from "@/components/basic";
import { findMeetingUrl } from "@/features/data/agenda";
import { useEventSelection, useExternalEvent } from "@/features/data/events";
import { useTimeZone } from "@/features/data/profile";
import { EventAlarmEditor } from "@/features/notifications/event-alarm-editor";

/** 反映中(または取り込み画面から開いた)外部予定の詳細。仮の画面 */
export default function ExternalEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const timeZone = useTimeZone();
  const event = useExternalEvent(id);
  const selection = useEventSelection();

  if (event.isPending) return <Loading />;
  if (event.error) return <Screen><ErrorText error={event.error} /></Screen>;
  const e = event.data;
  const meetingUrl = findMeetingUrl(e.location);

  return (
    <Screen refreshing={event.isRefetching} onRefresh={() => void event.refetch()}>
      <Heading>{e.title || "(タイトルなし)"}</Heading>
      <Body>{e.is_all_day ? "終日" : formatDateTimeRange(e.starts_at, e.ends_at, timeZone)}</Body>
      {e.location ? <Body muted>{e.location}</Body> : null}
      <Body muted>{e.is_selected ? "Slotto に反映中(この時間は予約を受け付けません)" : "反映していません"}</Body>
      {meetingUrl ? <Button label="会議に参加" onPress={() => void Linking.openURL(meetingUrl)} /> : null}
      {e.is_selected ? <EventAlarmEditor sourceType="external_event" sourceId={e.id} /> : null}
      <Button
        label={e.is_selected ? "反映をやめる" : "Slotto に反映する"}
        variant={e.is_selected ? "secondary" : "primary"}
        loading={selection.isPending}
        onPress={() =>
          selection.mutate(
            { event_ids: [e.id], selected: !e.is_selected, apply_to_series: false },
            { onError: (error) => Alert.alert("変更できませんでした", error.message) },
          )
        }
      />
    </Screen>
  );
}
