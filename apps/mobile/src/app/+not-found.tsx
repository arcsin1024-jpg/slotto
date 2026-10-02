import { Link, Stack } from "expo-router";
import { Body, Screen } from "@/components/basic";
import { strings } from "@/strings";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: strings.screens.notFound, headerShown: true }} />
      <Screen>
        <Body>{strings.screens.notFound}</Body>
        <Link href="/">
          <Body>ホームへ</Body>
        </Link>
      </Screen>
    </>
  );
}
