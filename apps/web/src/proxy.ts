import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 静的ファイルと画像、公開 API、内部 API を除くすべて
    "/((?!_next/static|_next/image|favicon.ico|api/public|api/internal|api/webhooks|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
