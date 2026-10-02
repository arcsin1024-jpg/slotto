import "server-only";
import { serverEnv } from "@/lib/env";
import type { IcsMethod } from "./ics";

/** メールの送信。RESEND_API_KEY が無いときは、送る内容をログに出すだけにする */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
  ics?: { method: IcsMethod; content: string } | null;
  /** 同じキーの送信は 24 時間以内なら 1 回だけになる(Resend の Idempotency-Key) */
  idempotencyKey: string;
}

export async function deliverEmail(email: OutgoingEmail): Promise<{ delivered: boolean }> {
  const apiKey = serverEnv.resendApiKey;
  if (!apiKey) {
    console.info(
      [
        "[email] RESEND_API_KEY が無いため送信せず、内容をログに出します",
        `to: ${email.to}`,
        `subject: ${email.subject}`,
        email.ics ? `添付: invite.ics(METHOD:${email.ics.method})` : "添付: なし",
        "",
        email.text,
      ].join("\n"),
    );
    return { delivered: false };
  }

  const body: Record<string, unknown> = {
    from: serverEnv.emailFrom,
    to: [email.to],
    subject: email.subject,
    text: email.text,
    html: email.html,
  };
  if (email.replyTo) body.reply_to = email.replyTo;
  if (email.ics) {
    body.attachments = [
      {
        filename: email.ics.method === "CANCEL" ? "cancel.ics" : "invite.ics",
        content: Buffer.from(email.ics.content, "utf8").toString("base64"),
        content_type: `text/calendar; charset=UTF-8; method=${email.ics.method}`,
      },
    ];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`メールの送信に失敗しました(HTTP ${response.status}): ${detail.slice(0, 300)}`);
  }
  return { delivered: true };
}
