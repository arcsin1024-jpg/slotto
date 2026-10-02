"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

/**
 * 管理画面のサイドバーの骨組み。見た目はデザインが決まったら S5 が仕上げる。
 * 項目の追加は nav-items.ts で行う。
 */
export function Sidebar({ displayName, username }: { displayName: string; username: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground max-md:hidden">
      <div className="px-5 py-4 text-lg font-bold tracking-tight text-sidebar-accent-foreground">slotto</div>
      <nav aria-label="メインメニュー" className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-sm">
        <p className="truncate font-medium text-sidebar-accent-foreground">{displayName}</p>
        {username && <p className="truncate text-xs">slotto/{username}</p>}
        <form action="/auth/logout" method="post" className="mt-2">
          <button type="submit" className="text-xs underline-offset-2 hover:underline">
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
