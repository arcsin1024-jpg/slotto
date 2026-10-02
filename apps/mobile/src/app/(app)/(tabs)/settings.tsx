import { router } from "expo-router";
import { Alert } from "react-native";
import { Body, Button, Heading, Row, Screen } from "@/components/basic";
import { signOut } from "@/features/auth/auth";
import { useDeleteAccount } from "@/features/data/account";
import { useProfile } from "@/features/data/profile";

// 仮の画面。デザインが決まったら作り直す
export default function SettingsScreen() {
  const profile = useProfile();
  const deleteAccount = useDeleteAccount();

  function confirmDelete() {
    Alert.alert("アカウントを削除しますか?", "予約ページ、予約、設定がすべて消えます。元に戻せません。", [
      { text: "やめる", style: "cancel" },
      {
        text: "削除する",
        style: "destructive",
        onPress: () =>
          deleteAccount.mutate(undefined, {
            onError: (error) => Alert.alert("削除できませんでした", error.message),
          }),
      },
    ]);
  }

  return (
    <Screen tab>
      <Heading>設定</Heading>
      {profile.data ? (
        <Body muted>
          {profile.data.display_name}({profile.data.username ?? "ユーザー名未設定"})
        </Body>
      ) : null}
      <Row title="通知とアラーム" onPress={() => router.push("/notification-settings")} />
      <Row title="予定を選ぶ(取り込み)" onPress={() => router.push("/import")} />
      <Row title="予約" onPress={() => router.push("/bookings")} />
      <Button label="ログアウト" variant="secondary" onPress={() => void signOut()} />
      <Button label="アカウントを削除" variant="danger" loading={deleteAccount.isPending} onPress={confirmDelete} />
    </Screen>
  );
}
