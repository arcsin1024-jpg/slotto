import { NextResponse, type NextRequest } from "next/server";
import { apiError, getApiUser, getSessionUser, unauthorized } from "@/server/auth";
import { ConnectError, startGoogleConnect } from "@/server/calendar/connections";
import { withQuery } from "@/server/calendar/redirect";

/**
 * Google カレンダー連携を始める。
 * - GET(Web): Google の同意画面へ送る。?return_to=/app/welcome などで戻り先を指定できる
 * - POST(アプリ): 同意画面の URL を返す。アプリはそれをシステムのブラウザで開く
 *   本文 { return_to?: "slotto://..." , login_hint?: string }
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const returnTo = searchParams.get("return_to");
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(returnTo ?? "/app/integrations")}`);

  try {
    const url = startGoogleConnect({
      userId: user.id,
      returnTo,
      loginHint: searchParams.get("login_hint"),
      requestOrigin: origin,
    });
    return NextResponse.redirect(url);
  } catch (e) {
    if (e instanceof ConnectError) {
      return NextResponse.redirect(withQuery(returnTo, origin, { calendar_error: e.code }));
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { return_to?: unknown; login_hint?: unknown };

  try {
    const url = startGoogleConnect({
      userId: user.id,
      returnTo: typeof body.return_to === "string" ? body.return_to : null,
      loginHint: typeof body.login_hint === "string" ? body.login_hint : null,
      requestOrigin: request.nextUrl.origin,
    });
    return Response.json({ url });
  } catch (e) {
    if (e instanceof ConnectError) return apiError(503, e.code, e.message);
    throw e;
  }
}
