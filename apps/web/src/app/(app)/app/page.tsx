import type { Metadata } from "next";
import { requireProfile } from "@/server/auth";

export const metadata: Metadata = { title: "ホーム" };

// ホーム(担当: S5)。いまは仮の表示
export default async function AppHomePage() {
  const { profile } = await requireProfile();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">こんにちは、{profile.display_name} さん</h1>
      <p className="mt-2 text-muted-foreground">ホーム画面はデザインが決まったら作ります。</p>
    </main>
  );
}
