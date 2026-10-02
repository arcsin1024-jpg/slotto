# S2 ゲスト予約: 指示書

ゲストが予約ページを開いて予約するまでと、予約の操作(承認・辞退・キャンセル・日程変更)、予約に関するメールを作る。Slotto の中核の流れ。

## 読むもの

- `docs/sessions/common.md`
- `docs/design.md` の 3.3、3.4、3.5、4.2、7.1、7.2、8 章
- `docs/research/timerex-features.md` の 2 章と 6 章(TimeRex の予約ページとゲストの体験)
- `docs/research/tech.md` の 7 章(二重予約の防止)と 8 章(メール)
- `packages/core/src/slots/compute-slots.ts`(空き枠の計算。実装とテスト済み)

## 担当の場所

`apps/web/src/app/(booking)/`、`apps/web/src/app/api/public/`、`apps/web/src/app/api/bookings/`、`apps/web/src/server/booking/`、`apps/web/src/server/email/`、`apps/web/src/features/booking/`。新しいマイグレーションは足してよい(既存は書き換えない)。

## 手順

### 1. サーバー側(デザインを待たずに進める)

1. `@/server/booking` を実装する(関数の名前と引数はスタブのとおり)
   - 予約の作成: 予約ページと設定を読み、`computeSlots` / `isSlotAvailable` で選ばれた枠がまだ空いているかを確かめ、`bookings` に書く。排他制約(`bookings_no_overlap`)に当たったら `slot_taken` を返す
   - ふさがっている時間帯 = 同じホストの有効な予約 + `external_events` の `is_selected = true` の予定。**選んでいない外部予定は使わない**
   - 1 回限りの予約ページは、予約が入ったら `is_active = false` にする
   - 確定後に、`@/server/calendar` の `writeBookingEvent`(会議 URL を受け取る)、`@/server/email` の送信、`@/server/jobs` の `scheduleBookingJobs` と `triggerBookingAutomations` を呼ぶ。これらの失敗で予約自体を失敗させない(`booking_events` に記録してログに出す)
   - 承認制: `pending` で作り、承認で `confirmed` にしてから上と同じ後処理をする
   - キャンセル・辞退・日程変更の期限(`guest_change_deadline_minutes`)と可否(`allow_guest_cancel` など)を守る
   - 操作ごとに `booking_events` に履歴を残す
   - DB の書き込みは管理用クライアント(`@/lib/supabase/admin`)で行い、ホストの操作は `hostId` が予約の `host_id` と一致するかを必ず確かめる
2. 必要なら、予約の作成を Postgres の関数 1 つにまとめるマイグレーションを足す(`docs/research/tech.md` の 7 章)
3. 公開 API(設計書 8 章の「公開」)と、ホスト用の予約操作 API(`/api/bookings/{id}/approve` など)を作る。入力は `@slotto/core` の zod スキーマで検証する。ホスト用 API は `getApiUser`(`@/server/auth`)で本人を確かめる(アプリからも呼ばれる)。公開 API には簡単な回数制限を付ける
4. `@/server/email` を実装する。Resend を使い、`RESEND_API_KEY` が無ければ送信内容をログに出すだけにする。ゲスト宛てには .ics を添付する(METHOD:REQUEST / CANCEL、同じ UID、SEQUENCE を増やす)。文面は日本語で、変更・キャンセル用のリンク(`/b/{manage_token}`)を入れる
5. 単体テストを書けるところ(.ics の生成、期限の判定など)は書く

### 2. 画面(デザインの方向が決まってから)

1. 予約ページ `/{username}/{slug}`、ホストのプロフィール `/{username}`、予約の確認・変更・キャンセル `/b/{token}` のモックを Claude Design で作る。PC とスマホの両方。`docs/design-brief.md` の 6 章「予約ページ」に従う
2. **ユーザーに見せて確認を取る**
3. 実装する。ゲストのタイムゾーンで表示し、切り替えられるようにする。日付 → 時間 → 入力 → 完了の流れ。完了画面に「カレンダーに追加」(.ics と Google カレンダーのリンク)を出す
4. デモデータの `/hanako/meeting` で通しの予約ができることを確かめ、**ユーザーに画面を見てもらう**
