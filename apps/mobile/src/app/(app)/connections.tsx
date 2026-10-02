import { Alert } from "react-native";
import { Body, ErrorText, Loading, Row, Screen } from "@/components/basic";
import { useConnections, useDeleteConnection } from "@/features/data/automations";

/** 接続先(Webhook、AI)の一覧。仮の画面(登録のフォームはデザインが決まってから) */
export default function ConnectionsScreen() {
  const connections = useConnections();
  const remove = useDeleteConnection();

  return (
    <Screen refreshing={connections.isRefetching} onRefresh={() => void connections.refetch()}>
      {connections.isPending ? (
        <Loading />
      ) : connections.error ? (
        <ErrorText error={connections.error} />
      ) : connections.data.length === 0 ? (
        <Body muted>接続先はまだありません</Body>
      ) : (
        connections.data.map((connection) => (
          <Row
            key={connection.id}
            title={connection.name}
            subtitle={
              connection.parsedConfig?.kind === "webhook"
                ? `Webhook ・ ${connection.parsedConfig.url}`
                : connection.parsedConfig?.kind === "ai"
                  ? `AI ・ ${connection.parsedConfig.provider} ${connection.parsedConfig.model}`
                  : connection.kind
            }
            onPress={() =>
              Alert.alert(`${connection.name} を削除しますか?`, "使っているオートメーションは動かなくなります。", [
                { text: "やめる", style: "cancel" },
                { text: "削除する", style: "destructive", onPress: () => remove.mutate(connection.id) },
              ])
            }
          />
        ))
      )}
    </Screen>
  );
}
