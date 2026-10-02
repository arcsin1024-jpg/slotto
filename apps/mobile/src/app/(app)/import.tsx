import { formatDate, formatTime } from "@slotto/core";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { Body, Button, ErrorText, Loading, Row, Screen } from "@/components/basic";
import { type ImportFilter, useCalendarSync, useEventSelection, useImportEvents, useMarkEventsSeen } from "@/features/data/events";
import { useTimeZone } from "@/features/data/profile";
import { space } from "@/theme";

const FILTERS: { key: ImportFilter; label: string }[] = [
  { key: "new", label: "新着" },
  { key: "unselected", label: "未選択" },
  { key: "selected", label: "反映中" },
  { key: "all", label: "すべて" },
];

/** 外部予定を 1 件ずつ選んで Slotto に反映する。仮の画面 */
export default function ImportScreen() {
  const timeZone = useTimeZone();
  const [filter, setFilter] = useState<ImportFilter>("new");
  const events = useImportEvents(filter);
  const selection = useEventSelection();
  const markSeen = useMarkEventsSeen();
  const sync = useCalendarSync();

  // 新着の一覧を開いたら「見た」ことにする(件数の表示から外す。選択の状態は変えない)
  const newIds = filter === "new" ? (events.data?.map((event) => event.id) ?? []) : [];
  const newIdsKey = newIds.join(",");
  useEffect(() => {
    if (newIds.length > 0) markSeen.mutate(newIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newIdsKey]);

  const onError = (error: Error) => Alert.alert("変更できませんでした", error.message);

  return (
    <Screen refreshing={events.isRefetching} onRefresh={() => void events.refetch()}>
      <View style={styles.wrap}>
        {FILTERS.map((item) => (
          <Button key={item.key} label={item.label} variant={filter === item.key ? "primary" : "secondary"}
            onPress={() => setFilter(item.key)} />
        ))}
      </View>
      <View style={styles.wrap}>
        <Button label="表示中をすべて反映" variant="secondary" disabled={!events.data?.length || selection.isPending}
          onPress={() => events.data && selection.mutate(
            { event_ids: events.data.map((e) => e.id), selected: true, apply_to_series: false }, { onError })} />
        <Button label="読み込み直す" variant="secondary" loading={sync.isPending}
          onPress={() => sync.mutate(undefined, { onError })} />
      </View>
      {events.isPending ? (
        <Loading />
      ) : events.error ? (
        <ErrorText error={events.error} />
      ) : events.data.length === 0 ? (
        <Body muted>予定はありません</Body>
      ) : (
        events.data.map((event) => (
          <Row
            key={event.id}
            title={event.title || "(タイトルなし)"}
            subtitle={`${formatDate(event.starts_at, timeZone)} ${event.is_all_day ? "終日" : `${formatTime(event.starts_at, timeZone)}〜${formatTime(event.ends_at, timeZone)}`}`}
            right={
              <Switch
                value={event.is_selected}
                disabled={selection.isPending}
                onValueChange={(selected) =>
                  selection.mutate({ event_ids: [event.id], selected, apply_to_series: false }, { onError })
                }
              />
            }
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
