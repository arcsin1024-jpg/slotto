import { formatDuration } from "@slotto/core";
import { useState } from "react";
import { Alert, Share, StyleSheet, Switch, View } from "react-native";
import { Body, Button, Card, ErrorText, Heading, Loading, Screen } from "@/components/basic";
import { type BookingPage, bookingPageUrl, buildCandidateText, useBookingPages, useSetPageActive } from "@/features/data/pages";
import { useProfile } from "@/features/data/profile";
import { space } from "@/theme";

// 仮の画面。デザインが決まったら作り直す
export default function PagesScreen() {
  const profile = useProfile();
  const pages = useBookingPages();
  const setActive = useSetPageActive();
  const [sharing, setSharing] = useState<string | null>(null);
  const username = profile.data?.username ?? null;

  async function shareCandidates(page: BookingPage, url: string | null) {
    setSharing(page.id);
    try {
      const text = await buildCandidateText(page, { url: url ?? undefined });
      if (!text) Alert.alert("1 週間以内に空いている枠がありません");
      else await Share.share({ message: text });
    } catch (error) {
      Alert.alert("候補日時を作れませんでした", error instanceof Error ? error.message : undefined);
    } finally {
      setSharing(null);
    }
  }

  return (
    <Screen tab refreshing={pages.isRefetching} onRefresh={() => void pages.refetch()}>
      <Heading>予約ページ</Heading>
      {pages.isPending ? (
        <Loading />
      ) : pages.error ? (
        <ErrorText error={pages.error} />
      ) : pages.data.length === 0 ? (
        <Body muted>予約ページはまだありません。Web で作れます。</Body>
      ) : (
        pages.data.map((page) => {
          const url = username ? bookingPageUrl(username, page.slug) : null;
          return (
            <Card key={page.id}>
              <Body>{page.title}</Body>
              <Body muted>
                {formatDuration(page.duration_minutes)}
                {url ? ` ・ ${url}` : ""}
              </Body>
              <View style={styles.switchRow}>
                <Switch value={page.is_active} onValueChange={(isActive) => setActive.mutate({ id: page.id, isActive })} />
                <Body muted>{page.is_active ? "公開中" : "停止中"}</Body>
              </View>
              {url ? (
                <Button label="リンクを共有" variant="secondary" onPress={() => void Share.share({ message: url, url })} />
              ) : null}
              <Button
                label="候補日時を文章で共有"
                variant="secondary"
                loading={sharing === page.id}
                onPress={() => void shareCandidates(page, url)}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
});
