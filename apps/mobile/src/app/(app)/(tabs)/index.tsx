import { formatDateTimeRange, formatTime } from "@slotto/core";
import { router } from "expo-router";
import { Linking } from "react-native";
import { Body, Button, Card, ErrorText, Heading, Loading, Row, Screen } from "@/components/basic";
import { useNewEventCount } from "@/features/data/events";
import { useHome } from "@/features/data/home";
import { useTimeZone } from "@/features/data/profile";
import { agendaHref } from "@/features/navigation";

// 仮の画面。デザインが決まったら作り直す(次の予定を最上部に大きく)
export default function HomeScreen() {
  const timeZone = useTimeZone();
  const home = useHome();
  const newCount = useNewEventCount();
  const next = home.data?.next ?? null;

  return (
    <Screen tab refreshing={home.isRefetching} onRefresh={() => void home.refetch()}>
      <Heading>次の予定</Heading>
      {home.isPending ? (
        <Loading />
      ) : home.error ? (
        <ErrorText error={home.error} />
      ) : next ? (
        <Card>
          <Body>{next.title}</Body>
          <Body muted>{formatDateTimeRange(next.startsAt, next.endsAt, timeZone)}</Body>
          {next.meetingUrl ? (
            <Button label="参加する" onPress={() => void Linking.openURL(next.meetingUrl as string)} />
          ) : null}
          <Button label="詳細" variant="secondary" onPress={() => router.push(agendaHref(next))} />
        </Card>
      ) : (
        <Body muted>予定はありません</Body>
      )}

      <Heading>今日の予定</Heading>
      {home.data?.today.length === 0 ? <Body muted>今日の予定はありません</Body> : null}
      {home.data?.today.map((item) => (
        <Row
          key={`${item.sourceType}:${item.id}`}
          title={item.title}
          subtitle={
            item.isAllDay ? "終日" : `${formatTime(item.startsAt, timeZone)}〜${formatTime(item.endsAt, timeZone)}`
          }
          onPress={() => router.push(agendaHref(item))}
        />
      ))}

      <Row title="承認待ち" subtitle={`${home.data?.pendingCount ?? 0} 件`} onPress={() => router.push("/bookings")} />
      <Row title="未選択の新着" subtitle={`${newCount.data ?? 0} 件`} onPress={() => router.push("/import")} />
    </Screen>
  );
}
