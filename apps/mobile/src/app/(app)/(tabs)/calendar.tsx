import { formatDate, formatTime } from "@slotto/core";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, Button, ErrorText, Heading, Loading, Row, Screen } from "@/components/basic";
import { useAgenda } from "@/features/data/agenda";
import { useTimeZone } from "@/features/data/profile";
import { agendaHref } from "@/features/navigation";
import { space } from "@/theme";

// 仮の画面。デザインが決まったら月・週・日の表示を作る。いまは 1 週間分の一覧
export default function CalendarScreen() {
  const timeZone = useTimeZone();
  const [weekOffset, setWeekOffset] = useState(0);
  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + weekOffset * 7);
    const end = new Date(start.getTime() + 7 * 86_400_000);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [weekOffset]);
  const agenda = useAgenda(range.from, range.to);

  return (
    <Screen tab refreshing={agenda.isRefetching} onRefresh={() => void agenda.refetch()}>
      <Heading>{formatDate(range.from, timeZone)} からの 1 週間</Heading>
      <View style={styles.buttons}>
        <Button label="前の週" variant="secondary" onPress={() => setWeekOffset((w) => w - 1)} />
        <Button label="今週" variant="secondary" onPress={() => setWeekOffset(0)} />
        <Button label="次の週" variant="secondary" onPress={() => setWeekOffset((w) => w + 1)} />
      </View>
      {agenda.isPending ? (
        <Loading />
      ) : agenda.error ? (
        <ErrorText error={agenda.error} />
      ) : agenda.data.length === 0 ? (
        <Body muted>予定はありません</Body>
      ) : (
        agenda.data.map((item) => {
          const time = item.isAllDay
            ? "終日"
            : `${formatTime(item.startsAt, timeZone)}〜${formatTime(item.endsAt, timeZone)}`;
          return (
            <Row
              key={`${item.sourceType}:${item.id}`}
              title={item.title}
              subtitle={`${formatDate(item.startsAt, timeZone)} ${time}${item.subtitle ? ` ・ ${item.subtitle}` : ""}`}
              onPress={() => router.push(agendaHref(item))}
            />
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: "row", gap: space[2] },
});
