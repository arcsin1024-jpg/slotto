import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/app";
  if (await getSessionUser()) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <p className="mb-6 text-xl font-bold tracking-tight">slotto</p>
        <h1 className="text-lg font-semibold">ログイン</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">アカウントがなければ、そのまま登録されます。</p>
        {params.error === "callback" && (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            ログインできませんでした。もう一度お試しください。
          </p>
        )}
        <LoginForm next={next} showDevLogin={process.env.NODE_ENV === "development"} />
      </div>
    </main>
  );
}
