# S4 実行基盤: 指示書

時刻が来たら処理を動かす仕組み(ジョブ)と、アプリ限定機能のサーバー側(プッシュ通知、オートメーション、接続先)を作る。画面は持たない(オートメーションの画面はアプリ = S6)。

## 読むもの

- `docs/sessions/common.md`
- `docs/design.md` の 3.6、6 章(scheduled_jobs、automations、automation_runs、api_connections、push_devices、event_alarms)、7.4、7.5、8 章
- `docs/research/tech.md` の 9 章(時刻指定の実行)と 10 章(外部 API を呼ぶ自動処理の安全対策)
- `docs/research/mobile.md` の 2 章と 3 章(通知とアラーム、バックグラウンド実行の制約)
- `packages/core/src/schemas/automation.ts`(オートメーションの型と検証)

## 担当の場所

`apps/web/src/server/jobs/`、`apps/web/src/server/automations/`、`apps/web/src/server/push/`、`apps/web/src/app/api/internal/`、`apps/web/src/app/api/automations/`、`apps/web/src/app/api/connections/`、`apps/web/src/app/api/devices/`。新しいマイグレーションは足してよい(pg_cron の登録など)。

## 方針

- 時刻どおりの実行はサーバーで行う。アプリが閉じていても動く
- 通知・アラームを「鳴らす」のは端末のローカル通知(S6)。サーバーは、予定の追加・変更・キャンセルを端末に知らせる(ローカル通知を張り直させる)サイレントなプッシュと、オートメーションの結果を届けるプッシュを送る

## 手順

1. `@/server/jobs` を実装する(スタブの関数すべて)
   - `scheduleBookingJobs`: 予約ページの `reminder_minutes` によるメールのリマインド、ホストの有効なオートメーションのうち時刻型(`before_start` / `at_start` / `after_end`)で対象に当たるものの実行、端末への同期のプッシュを入れる。`dedupe_key` は `booking:<id>:...` の形
   - 反映中の外部予定にも、時刻型のオートメーションが動くようにする(対象が `all` / `selected_events` のとき)。外部予定の選択・解除・変更のときに呼ぶ関数を用意し、名前を最終報告に書く(S3 が呼ぶ)
   - `daily` トリガーは、毎日の実行を自分で入れ直す
2. `/api/internal/dispatch` を作る。`CRON_SECRET` で守り、`claim_due_jobs` で取り出したジョブを種類ごとに実行し、成功・失敗・再試行(指数バックオフ)を記録する。種類ごとの実行は他担当の入口を呼ぶ(メールは `@/server/email`、同期は `@/server/calendar`)
3. pg_cron + pg_net で、毎分 `/api/internal/dispatch` を呼ぶマイグレーションを足す。呼び先の URL と秘密の値は、ローカルと本番で変えられるようにする(Vault など)。ローカルで pg_cron が使えないときの代わりとして、手で dispatch を叩くスクリプトも用意する
4. `@/server/push` を実装する。Expo Push Service に送り、無効になったトークンは `push_devices` から消す。`EXPO_ACCESS_TOKEN` が無ければ送らずにログに出す
5. `@/server/automations` を実装する。アクションごとの実行と結果の記録(`automation_runs`)
   - `push` / `alarm` / `open_url`: `@/server/push` で送る(`alarm` は `alarm: true`)
   - `webhook`: 登録された URL に、予定の情報を載せた JSON を送る。SSRF 対策(内部ネットワーク宛ての拒否、リダイレクト無効、タイムアウト)、署名(Standard Webhooks 準拠)、冪等 ID
   - `ai_task`: AI SDK で実行する。`connection_id` が null なら Slotto の内蔵 AI(AI Gateway)、値があればユーザーの API キー。差し込み(`{{title}}` など)を展開し、結果を履歴に保存し、`deliver` が push なら通知する。プロンプトに入れた予定の内容は外部への指示として扱わない
   - `AI_GATEWAY_API_KEY` などが無いときは、失敗ではなく「設定が必要」として記録する
6. API: `/api/automations/{id}/test`(試し実行)、`/api/connections`(接続先の登録・更新。秘密の値は `@/lib/crypto` で暗号化して `api_connection_secrets` へ)、`/api/devices`(プッシュ通知のトークンの登録・削除)。`getApiUser` で本人を確かめる(アプリから呼ばれる)
7. 単体テスト: 差し込みの展開、ジョブの時刻の計算、SSRF の判定、署名
