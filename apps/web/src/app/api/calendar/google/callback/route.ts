import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { completeGoogleConnect, ConnectError } from "@/server/calendar/connections";
import { withQuery } from "@/server/calendar/redirect";

/**
 * Google の同意画面から戻ってくる先。トークンを保存して最初の同期を行い、戻り先へ送る。
 * 成功: ?calendar_connected=1 / 失敗: ?calendar_error=<コード>
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const sessionUser = await getSessionUser();

  try {
    const result = await completeGoogleConnect({
      code: searchParams.get("code"),
      state: searchParams.get("state"),
      error: searchParams.get("error"),
      sessionUserId: sessionUser?.id ?? null,
      requestOrigin: origin,
    });
    return NextResponse.redirect(
      withQuery(result.returnTo, origin, { calendar_connected: "1", ...(result.synced ? {} : { calendar_sync: "pending" }) }),
    );
  } catch (e) {
    if (e instanceof ConnectError) {
      return NextResponse.redirect(withQuery(e.returnTo, origin, { calendar_error: e.code }));
    }
    console.error("[calendar] 連携の完了に失敗しました:", e);
    return NextResponse.redirect(withQuery(null, origin, { calendar_error: "exchange_failed" }));
  }
}
