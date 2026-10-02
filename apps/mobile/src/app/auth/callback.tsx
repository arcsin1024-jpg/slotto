import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, Button, Loading } from "@/components/basic";
import { completeSignIn } from "@/features/auth/auth";
import { strings } from "@/strings";
import { space, useColors } from "@/theme";

const t = strings.authCallback;

/** メールのリンクと Google のログインの戻り先(slotto://auth/callback?code=…) */
export default function AuthCallbackScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeSignIn(params)
      .then(() => router.replace("/"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t.failed));
    // 戻り先の値は最初の 1 回だけ使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {error ? (
        <>
          <Body>{t.failed}</Body>
          <Body muted>{error}</Body>
          <Button label={t.back} onPress={() => router.replace("/sign-in")} />
        </>
      ) : (
        <>
          <Loading />
          <Body muted>{t.working}</Body>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: space[6], gap: space[3], justifyContent: "center" },
});
