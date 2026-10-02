import { Sidebar } from "@/components/app/sidebar";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/** 管理画面(/app 以下)の共通レイアウト。初回設定(/app/welcome)もこの中に入る */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <Sidebar displayName={profile?.display_name || user.email || ""} username={profile?.username ?? null} />
      <div className="flex min-w-0 flex-1 flex-col bg-background">{children}</div>
    </div>
  );
}
