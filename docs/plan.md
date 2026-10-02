# Slotto 実装計画

- 版: 0.1(2026-10-02)
- 関連: [設計書](design.md) / [デザイン方針](design-brief.md)

## 1. 進め方

1 つの司令塔セッション(S0)が土台を作り、領域ごとのセッションが並行して開発する。各セッションは自分の worktree とブランチで作業し、S0 が main に取り込む。

モックや画面ができたセッションは、その都度ユーザーに見せて確認を取る。

## 2. セッションと担当

| ID | 名前 | 担当の場所 | 開発ポート | 開始 |
|---|---|---|---|---|
| S0 | 司令塔 | ルートの設定、`packages/core`、`supabase/`、`apps/web/src/lib`、`apps/web/src/components/ui`、`apps/web/src/proxy.ts`、ログイン、管理画面の骨組み(`(app)/layout.tsx`)、`docs/` | 3000 | — |
| S1 | デザイン | `design/`、`packages/tokens/` | — | 第 1 波 |
| S2 | ゲスト予約 | `apps/web/src/app/(booking)/`、`apps/web/src/app/api/public/`、`apps/web/src/app/api/bookings/`、`apps/web/src/server/booking/`、`apps/web/src/server/email/`、`apps/web/src/features/booking/` | 3002 | 第 2 波 |
| S3 | カレンダー連携と取り込み | `apps/web/src/server/calendar/`、`apps/web/src/app/api/calendar/`、`apps/web/src/app/api/external-events/`、`apps/web/src/app/api/webhooks/`、`apps/web/src/app/(app)/app/import/`、`apps/web/src/app/(app)/app/integrations/`、`apps/web/src/features/import/` | 3003 | 第 2 波 |
| S4 | 実行基盤 | `apps/web/src/server/jobs/`、`apps/web/src/server/automations/`、`apps/web/src/server/push/`、`apps/web/src/app/api/internal/`、`apps/web/src/app/api/automations/`、`apps/web/src/app/api/connections/`、`apps/web/src/app/api/devices/` | 3004 | 第 2 波 |
| S5 | 管理画面 | `apps/web/src/app/(app)/`(import と integrations を除く)、`apps/web/src/features/host/` | 3005 | 第 3 波 |
| S6 | モバイルアプリ | `apps/mobile/` | 8081 | 第 3 波 |
| S7 | 紹介サイト | `apps/web/src/app/(marketing)/`、`apps/web/src/features/marketing/` | 3007 | 第 3 波 |

- 第 1 波: 土台ができる前から始められる
- 第 2 波: 土台(骨組み、DB、共有の型、つなぎ目の関数)を main に入れてから始める。画面は、デザインの方向が決まるまで着手しない(サーバー側を先に進める)
- 第 3 波: デザインの方向が決まり、トークンが main に入ってから始める

## 3. セッション間のつなぎ目

他の担当の機能は、次の入口を通して呼ぶ。土台の時点では中身が空の関数(スタブ)を置いておき、担当セッションが実装する。関数の名前と引数は変えない。変えたい場合は報告する。

| 入口 | 実装する担当 | 使う担当 |
|---|---|---|
| `@slotto/core` の `computeSlots` | S0 | S2、S5、S6 |
| `@/server/booking`(予約の作成、承認、辞退、キャンセル、日程変更) | S2 | S5、API 経由で S6 |
| `@/server/email`(予約に関するメール送信) | S2 | S4(リマインド) |
| `@/server/calendar`(同期、予約の書き込み・更新・削除) | S3 | S2、S4 |
| `@/server/jobs`(ジョブの登録と取り消し) | S4 | S2、S3 |
| `@/server/push`(プッシュ通知の送信) | S4 | S2 |
| 設計書 8 章の API | 各担当 | S6 |

## 4. 段階

| 段階 | 内容 | 確認してもらうこと |
|---|---|---|
| 0 | リサーチ、設計書、計画、骨組み、DB 定義、共有の型、つなぎ目 | 設計書と計画 |
| 1 | デザインの方向、デザインシステム、トークン、ロゴ | 色と書体の案から選ぶ、デザインシステム |
| 2 | サーバー側: 予約、カレンダー連携、実行基盤 | (画面なし。動作の報告) |
| 3 | 画面: 予約ページ、取り込み、管理画面、アプリ、紹介サイト | 面ごとのモック、実装した画面 |
| 4 | 統合: main への取り込み、通しの動作確認、手直し | 通しで触ってもらう |
| 5 | 本番の準備: 外部サービスの接続、公開、ストア提出 | 外部サービスの用意(設計書 11 章) |

## 5. 完了の基準(今回の開発)

- Web: ログイン → 初回設定 → 予約ページの作成 → ゲストが予約 → 予約一覧に出る → 承認・キャンセル、までがローカルで通る
- 取り込み: 外部予定を 1 件ずつ選べ、選んだ予定の時間は予約ページの空き枠から消える
- アプリ: ログイン、ホーム、カレンダー、予約、取り込み、通知・アラームの設定、オートメーションの作成と実行履歴が動く
- 実行基盤: 時刻が来たジョブが実行され、メール・プッシュ通知・Webhook・AI の各アクションが動く
- 型チェック、リント、単体テストが通る
- Google カレンダー、メール送信、プッシュ通知、AI は、認証情報が用意されるまでは実物での確認ができない。その場合は「未確認」と明記する

## 6. 取り込みの手順(S0)

1. 各セッションの最終報告を読む(変更した場所、追加した依存、他担当への要望)
2. ブランチを main にマージする。衝突は担当表に従って解決する
3. `pnpm install`、型チェック、リント、テストを通す
4. 新しいマイグレーションを適用する
5. つなぎ目をまたぐ動作を確認する
