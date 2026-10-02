import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Button, Heading } from "@/components/basic";
import { signInAsDemo, signInWithEmailLink, signInWithGoogle } from "@/features/auth/auth";
import { env } from "@/lib/env";
import { strings } from "@/strings";
import { fontSize, radius, space, useColors } from "@/theme";

const t = strings.signIn;

// 仮の画面。デザインが決まったら作り直す
export default function SignInScreen() {
  const c = useColors();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | "demo" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function run(kind: "google" | "email" | "demo", action: () => Promise<unknown>) {
    setPending(kind);
    try {
      await action();
    } catch (error) {
      Alert.alert(t.failed, error instanceof Error ? error.message : undefined);
    } finally {
      setPending(null);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Heading>{t.title}</Heading>
        <Body muted>{t.lead}</Body>

        <Button label={t.google} variant="secondary" loading={pending === "google"} disabled={pending !== null}
          onPress={() => run("google", signInWithGoogle)} />

        {sentTo ? (
          <Body>{t.sent(sentTo)}</Body>
        ) : (
          <View style={styles.form}>
            <Body muted>{t.emailLabel}</Body>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t.emailPlaceholder}
              placeholderTextColor={c.textSubtle}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              style={[styles.input, { color: c.text, borderColor: c.borderStrong, backgroundColor: c.surfaceRaised }]}
            />
            <Button label={t.sendLink} loading={pending === "email"} disabled={pending !== null || !email.includes("@")}
              onPress={() => run("email", async () => {
                await signInWithEmailLink(email);
                setSentTo(email.trim());
              })} />
          </View>
        )}

        {env.isDev ? (
          <Button label={t.demo} variant="secondary" loading={pending === "demo"} disabled={pending !== null}
            onPress={() => run("demo", signInAsDemo)} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space[6], gap: space[4], marginTop: space[12] },
  form: { gap: space[2] },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    fontSize: fontSize.md,
  },
});
