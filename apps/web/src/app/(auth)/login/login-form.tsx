"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

// supabase/seed.sql のデモユーザー(ローカル開発専用)
const DEV_EMAIL = "demo@slotto.test";
const DEV_PASSWORD = "slotto-demo-password";

export function LoginForm({ next, showDevLogin }: { next: string; showDevLogin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "email" | "dev" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function signInWithGoogle() {
    setPending("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      toast.error("Google でログインできませんでした", { description: error.message });
      setPending(null);
    }
  }

  async function signInWithEmail(event: React.FormEvent) {
    event.preventDefault();
    setPending("email");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    setPending(null);
    if (error) toast.error("メールを送れませんでした", { description: error.message });
    else setSentTo(email);
  }

  async function signInAsDemo() {
    setPending("dev");
    const { error } = await createClient().auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
    setPending(null);
    if (error) toast.error("デモユーザーでログインできませんでした", { description: error.message });
    else router.replace(next);
  }

  if (sentTo) {
    return (
      <p className="text-sm">
        <span className="font-medium">{sentTo}</span> にログイン用のリンクを送りました。メールを開いてリンクを押してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" onClick={signInWithGoogle} disabled={pending !== null}>
        Google でログイン
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        または
        <Separator className="flex-1" />
      </div>
      <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending !== null}>
          {pending === "email" ? "送信中…" : "ログイン用のリンクを送る"}
        </Button>
      </form>
      {showDevLogin && (
        <Button variant="ghost" size="sm" onClick={signInAsDemo} disabled={pending !== null}>
          開発用: デモユーザーでログイン
        </Button>
      )}
    </div>
  );
}
