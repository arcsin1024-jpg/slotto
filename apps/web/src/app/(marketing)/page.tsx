import Link from "next/link";
import { Button } from "@/components/ui/button";

// 紹介サイト(担当: S7)。いまは仮の表示
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
      <p className="text-sm font-medium text-muted-foreground">slotto</p>
      <h1 className="text-4xl font-bold tracking-tight">日程調整を、URL ひとつで。</h1>
      <p className="text-lg text-muted-foreground">
        空き時間を共有して、相手に選んでもらうだけ。予定は必要なものだけを選んで反映できます。
      </p>
      <Button asChild size="lg">
        <Link href="/login">無料ではじめる</Link>
      </Button>
    </main>
  );
}
