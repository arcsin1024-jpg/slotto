# S3 カレンダー連携と取り込み: 指示書

Google カレンダーの連携と、Slotto の独自機能「外部の予定を 1 件ずつ選んで反映する」取り込み画面を作る。

## 読むもの

- `docs/sessions/common.md`
- `docs/design.md` の 3.2、4.3(`/app/import`、`/app/integrations`)、6 章(外部カレンダーの表)、7.3、8 章
- `docs/research/tech.md` の 1〜4 章(Google Calendar API、選んだ予定だけ反映する設計、OAuth の審査、トークン)
- `docs/research/timerex-features.md` の 3 章(TimeRex のカレンダー連携。個別の予定を選ぶ機能は TimeRex に無い)

## 担当の場所

`apps/web/src/server/calendar/`、`apps/web/src/app/api/calendar/`、`apps/web/src/app/api/external-events/`、`apps/web/src/app/api/webhooks/`、`apps/web/src/app/(app)/app/import/`、`apps/web/src/app/(app)/app/integrations/`、`apps/web/src/features/import/`。新しいマイグレーションは足してよい。

## 手順

### 1. サーバー側(デザインを待たずに進める)

1. Google の連携。ログインとは別の OAuth で行う(`/api/calendar/google/connect` → `/callback`)。スコープは最小限(`docs/research/tech.md` の推奨)。refresh token は `@/lib/crypto` で暗号化して `calendar_tokens` に置く。トークンの更新、失効時の `needs_reauth` も扱う。`GOOGLE_CLIENT_ID` が無いときは、連携ボタンを押すと「設定が必要」と分かるようにする
2. `@/server/calendar` を実装する
   - `syncConnection`: カレンダー一覧を `external_calendars` に入れ、各カレンダーの予定を今日から 90 日先まで差分で読み込む。繰り返しは展開し、`series_id` に親の ID を入れる。新しい予定は未選択で入れる。ただし、カレンダーの `auto_select_new` がオン、または `external_series_selections` に当たる予定は選択済みで入れる。変更は内容だけ更新し、選択の状態は保つ。外部で消えた予定は消す。Slotto が書き込んだ予定は取り込まない
   - `writeBookingEvent` / `updateBookingEvent` / `deleteBookingEvent`: 予約ページの `write_calendar_id` のカレンダーに予定を書き、場所が Google Meet なら会議 URL を発行して返す。書き込んだ予定には Slotto の目印(extendedProperties)を付ける
3. API: `/api/calendar/sync`(手動の同期)、`/api/external-events/selection`(選択・解除。`apply_to_series` のときは `external_series_selections` も更新)、`/api/webhooks/google-calendar`(変更通知。受けたら同期のジョブを入れる)。ホスト用 API は `getApiUser` で本人を確かめる(アプリからも呼ばれる)
4. 定期の同期と watch の更新は、`@/server/jobs` の `enqueueJob`(kind: `calendar_sync` / `calendar_watch_renew`)で入れる。ジョブの実行側(S4)が呼ぶ関数を `@/server/calendar` に用意し、名前を最終報告に書く
5. Google の実物が無くても確かめられるよう、Google API を呼ぶ部分を差し替えられる形にし、差分の取り込み(新規・変更・削除・繰り返し・自動選択)を単体テストで確かめる

### 2. 画面(デザインの方向が決まってから)

1. 取り込み画面 `/app/import` と連携画面 `/app/integrations` のモックを Claude Design で作る。`docs/design-brief.md` の 6 章「取り込み画面」に従う。日付ごとの予定の一覧、チェック、選択中の件数、一括選択(日・カレンダー・検索結果)、繰り返しの「この回だけ / 今後すべて」、未選択の新着、選んだ予定が空き時間に効くことが分かる表示
2. **ユーザーに見せて確認を取る**
3. 実装する。選択はすぐ画面に反映し(楽観的更新)、失敗したら戻す。デモデータで動きを確かめ、**ユーザーに画面を見てもらう**
