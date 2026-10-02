import { createHash, randomBytes } from "node:crypto";

/**
 * Google カレンダー連携の OAuth(ログインとは別)。
 * 認可コードフロー + PKCE。refresh token を確実に受け取るため access_type=offline と prompt=consent を付ける。
 */

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  // 予定の読み書き(取り込みと予約の書き込み、Meet の発行)
  "https://www.googleapis.com/auth/calendar.events",
  // カレンダーの一覧
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

/** 連携に欠かせないスコープ。同意画面で外されたら連携を完了しない */
export const REQUIRED_CALENDAR_SCOPES = GOOGLE_CALENDAR_SCOPES.filter((s) => s.startsWith("https://"));

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface GoogleOAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl(
  client: GoogleOAuthClient,
  params: { state: string; codeChallenge: string; loginHint?: string },
): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("redirect_uri", client.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
  return url.toString();
}

export interface GoogleTokens {
  accessToken: string;
  /** 初回の同意時だけ返る。更新のときは返らないことがある */
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
  /** id_token から取り出した Google アカウント */
  account: { sub: string; email: string; name: string | null } | null;
}

/** refresh token が失効・取り消しされている(再連携が必要) */
export class GoogleReauthRequiredError extends Error {
  constructor(message = "Google カレンダーの連携が切れています。もう一度連携してください") {
    super(message);
    this.name = "GoogleReauthRequiredError";
  }
}

export async function exchangeAuthorizationCode(
  client: GoogleOAuthClient,
  code: string,
  codeVerifier: string,
  doFetch: typeof fetch = fetch,
): Promise<GoogleTokens> {
  return requestToken(
    {
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: client.redirectUri,
    },
    doFetch,
  );
}

export async function refreshAccessToken(
  client: Omit<GoogleOAuthClient, "redirectUri">,
  refreshToken: string,
  doFetch: typeof fetch = fetch,
): Promise<GoogleTokens> {
  return requestToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
    },
    doFetch,
  );
}

/** トークンを取り消す。すでに無効なら何もしない */
export async function revokeToken(token: string, doFetch: typeof fetch = fetch): Promise<void> {
  await doFetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

async function requestToken(body: Record<string, string>, doFetch: typeof fetch): Promise<GoogleTokens> {
  const response = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    // invalid_grant: refresh token の失効・取り消し、または認可コードの使い回し
    if (json.error === "invalid_grant") throw new GoogleReauthRequiredError();
    throw new Error(`Google のトークンの取得に失敗しました: ${json.error ?? response.status} ${json.error_description ?? ""}`.trim());
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    scopes: json.scope ? json.scope.split(" ") : [],
    account: json.id_token ? readIdToken(json.id_token) : null,
  };
}

/**
 * id_token の中身を読む。トークンは Google のトークンエンドポイントから TLS で直接受け取ったものなので、
 * 署名の検証は省く(Google の OpenID Connect の説明でも許されている使い方)。
 */
function readIdToken(idToken: string): GoogleTokens["account"] {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!payload.sub || !payload.email) return null;
    return { sub: payload.sub, email: payload.email, name: payload.name ?? null };
  } catch {
    return null;
  }
}

export function hasRequiredScopes(scopes: string[]): boolean {
  return REQUIRED_CALENDAR_SCOPES.every((s) => scopes.includes(s));
}
