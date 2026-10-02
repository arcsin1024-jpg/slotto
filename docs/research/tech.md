# Slotto 技術調査(Web / サーバー側)

- 調査日: 2026-10-02
- 対象: 日程調整サービス「Slotto」(pnpm モノレポ / Next.js App Router on Vercel / Expo / Supabase Auth・Postgres・pg_cron)
- 方針: 公式ドキュメントを一次情報とし、2025〜2026 年の情報を優先。裏が取れなかった点は **未確認** と明記。
- 注意: この文書は調査メモであり、実装コードは含まない。料金・クォータ・審査要件は変わりやすいので、実装着手時に公式ページを再確認すること。

---

## 1. Google Calendar API

### 要点

**スコープ(最小権限の選び方)**

- カレンダー系スコープは細分化されている。主なもの(公式「Choose Google Calendar API scopes」より):
  - `calendar`(全カレンダーの閲覧・編集・共有・完全削除)
  - `calendar.readonly`(全カレンダーの閲覧)
  - `calendar.events` / `calendar.events.readonly`(全カレンダーの予定の編集 / 閲覧)
  - `calendar.events.owned` / `calendar.events.owned.readonly`(自分が所有するカレンダーの予定のみ)
  - `calendar.freebusy` / `calendar.events.freebusy`(空き/埋まりだけ)
  - `calendar.calendarlist.readonly`(購読しているカレンダーの一覧)
  - `calendar.app.created`(アプリが作ったサブカレンダーと、その中の予定だけ)
  - `calendar.settings.readonly`(タイムゾーンなどの設定の閲覧)
- メソッドごとに受け付けるスコープ(公式リファレンスで確認済み):
  - `events.list` / `events.watch`: `calendar.readonly`, `calendar`, `calendar.events.readonly`, `calendar.events`, `calendar.app.created`, `calendar.events.freebusy`, `calendar.events.owned`, `calendar.events.owned.readonly`, `calendar.events.public.readonly`
  - `events.insert`: `calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned`
  - `freebusy.query`: `calendar.readonly`, `calendar`, `calendar.events.freebusy`, `calendar.freebusy`
- Slotto の機能(予定のタイトルを見て1件ずつ選ぶ + 確定した予定を書き込む + Meet 発行)に必要なのは「予定の読み書き」と「カレンダー一覧」。

**増分同期(syncToken)**

- 初回は `syncToken` なしで `events.list` を最後のページまで読み、最終ページに付く `nextSyncToken` を保存する。途中のページには `nextPageToken` しか付かない。
- 2回目以降は保存した `syncToken` を付けて呼ぶと、前回以降に変わった予定だけが返る。削除された予定も必ず含まれる(`status: "cancelled"`)。`showDeleted=false` は指定できない。
- `syncToken` と併用できないパラメータ: `iCalUID`, `orderBy`, `privateExtendedProperty`, `q`, `sharedExtendedProperty`, `timeMin`, `timeMax`, `updatedMin`。それ以外のパラメータ(`singleEvents`, `eventTypes` など)は初回と同じ値を使い続ける。
- 公式サンプルは初回フル同期にだけ `timeMin`(1年前)を付けて取得範囲を絞っている(「Sync tokens aren't compatible with most filters, but you may want to limit your full sync to only a certain date range」)。増分リクエスト側には付けない。
- トークンが失効したりアクセス権が変わると **410 GONE** が返る。その場合はローカルのキャッシュを消してフル同期をやり直す。
- `maxResults` は既定 250、最大 2500。
- トークンは「ユーザー × カレンダー」単位で保存する。

**push 通知(events.watch)**

- `POST /calendars/{calendarId}/events/watch` に `id`(UUID 推奨、最大 64 文字)、`type: "web_hook"`、`address`(有効な証明書の HTTPS URL)を渡す。任意で `token`(最大 256 文字。通知ヘッダ `X-Goog-Channel-Token` に載るので、なりすまし対策とルーティングに使う)、`expiration` または `params.ttl`。
- **チャンネルの有効期限は既定 604,800 秒(7日)**。上限値は今回読んだ公式ページには明記なし(**未確認**。リクエスト値と内部上限のうち厳しい方が採用される、とだけ書かれている)。レスポンスの `expiration`(ミリ秒)を必ず保存する。
- **自動更新はない**。期限前に新しい `id` で `watch` を呼び直す(新旧が一時的に重なってよい)。古い方は `channels.stop`(`id` と `resourceId` が必要)で止める。
- 通知は本文なしで、ヘッダだけが届く: `X-Goog-Channel-ID`, `X-Goog-Channel-Token`, `X-Goog-Resource-ID`, `X-Goog-Resource-State`(`sync` / `exists` / `not_exists`), `X-Goog-Message-Number`。作成直後に `sync` 通知が1通届く。
- 通知には「何が変わったか」は入っていない。受けたら `syncToken` で増分同期を走らせる。
- 公式に「通知は 100% 確実ではない。通常の運用でも少数は落ちる」と明記されている。

**freeBusy**

- `POST /freeBusy` に `timeMin`, `timeMax`, `timeZone`(既定 UTC), `items[]` を渡すと、カレンダーごとに busy 区間(開始・終了のみ)が返る。1回の問い合わせで最大 50 カレンダー(`calendarExpansionMax`)、グループ展開は最大 100。
- 予定の ID もタイトルも返らないので、「予定を1件ずつ選ぶ」Slotto の主経路には使えない。

**Google Meet リンクの発行(conferenceData)**

- `events.insert` にクエリ `conferenceDataVersion=1` を付け、本文に `conferenceData.createRequest`(`requestId` に一意な値、`conferenceSolutionKey.type: "hangoutsMeet"`)を入れる。
- 生成は非同期。レスポンスの `conferenceData.createRequest.status` が `pending` のことがあり、`success` になると `hangoutLink` と `conferenceData.entryPoints[]`(video / phone)に URL が入る。`pending` なら `events.get` で取り直す。
- `conferenceDataVersion` の既定は 0 で、0 のままだと会議データは無視される。予定を更新するときも 1 を付けないと既存の会議情報を落とすおそれがある。
- 2026-02-17 のリリースノートで「予定ごとに新しい会議コードを生成し、使い回さない」ことが推奨された。
- 招待メールを Google から送るかは `sendUpdates`(`all` / `externalOnly` / `none`)で決める。

**繰り返し予定(singleEvents)**

- 既定(`singleEvents=false`)では、繰り返しの親(`recurrence` に RRULE を持つ)と例外(変更・キャンセルされた回)だけが返り、各回は返らない。
- `singleEvents=true` にすると各回に展開されて返り、親は返らない。`orderBy=startTime` は `singleEvents=true` のときだけ使える。
- 各回は `recurringEventId`(親の ID)と `originalStartTime`(本来の開始時刻。回を移動しても変わらない)で一意に決まる。
- 個別の回を取るには `events.instances` を使う。
- キャンセルされた例外は `id` / `recurringEventId` / `originalStartTime` しか入っていないことがある。それ以外の `cancelled` は削除を意味し、`id` しか保証されない。

**クォータ**

- 2026-05-01 以降に作った Cloud プロジェクト: **1 分あたり 10,000 リクエスト / プロジェクト**、**1 分あたり 600 リクエスト / ユーザー / プロジェクト**(スライディングウィンドウ)。
- **1 日 1,000,000 リクエスト / プロジェクト** が課金のしきい値。公式に「クォータ超過分は 2026 年後半に Cloud 請求先アカウントへの課金対象になる予定。詳細は 90 日以上前に告知」とある。標準的な利用は無料のまま。
- 超過時は `403 usageLimits` か `429` が返る。指数バックオフ(`min(2^n + ランダムなミリ秒, 上限 32〜64 秒)`)で再試行する。
- 公式はポーリングではなく push 通知の利用を推奨している。

### 推奨方針

- スコープは **`calendar.events` + `calendar.calendarlist.readonly`** を第一候補にする(全カレンダーの予定の読み書き + カレンダー一覧)。所有カレンダーだけでよいと割り切れるなら `calendar.events.owned` に狭められる。`calendar`(フル)は共有設定や削除まで含むので避ける。
- 同期は「push 通知をきっかけに `syncToken` で増分同期」+「落ちた通知を拾うための定期ポーリング(数時間おき)」+「チャンネル更新ジョブ(期限の 1〜2 日前に張り直し)」の3本立てにする。
- Meet は `conferenceData.createRequest` で予定ごとに発行し、`requestId` には Slotto の予約 ID 由来の値を使って再送時の重複発行を防ぐ。
- 予約確定の直前に、対象カレンダーへ `events.list`(短い時間範囲)か `freeBusy` で最新状態を取り直し、キャッシュのずれによる二重予約を防ぐ。

### 注意点

- 各スコープが sensitive か non-sensitive かは、公式のスコープ表には載っていない(表は「Scope / Meaning」の2列のみ)。Cloud Console の「Data Access」画面で表示される区分が正。`calendar.events` / `calendar.readonly` が sensitive なのは複数情報源で一致。`calendar.calendarlist.readonly` は non-sensitive とする情報あり。`calendar.app.created` / `calendar.freebusy` / `calendar.events.freebusy` の区分は **未確認**(Console で要確認)。
- `singleEvents=true` で増分同期すると、無期限の繰り返し予定の扱いが難しい(`timeMax` を増分側で指定できない)。設計は項目 2 を参照。
- push 通知の受け口は Vercel の関数になる。通知には署名がないので、`X-Goog-Channel-Token` に推測不能な値を入れて照合する。
- 2025-10-27 からサブカレンダーに「データ所有者」が1人だけ設定されるようになった。`calendar.app.created` で専用カレンダーを作る場合は挙動を確認する。
- クォータは「2025-11〜2026-04 に API を使っていた既存プロジェクト」と「2026-05-01 以降の新規プロジェクト」で扱いが違う。Slotto は新規なので新クォータが最初から適用される。

---

## 2. 「選んだ予定だけ反映する」設計

この項目は公式仕様(項目 1 の出典)を土台にした設計案で、テーブル構成と段階的な進め方は調査者の判断を含む。

### 要点

**キャッシュの持ち方(概念レベル)**

- 3 層に分けるのが扱いやすい。
  - 連携(`calendar_connections`): ユーザー、プロバイダ、アカウント、付与されたスコープ、トークンの参照先、状態(有効 / 再認可が必要)。
  - カレンダー(`external_calendars`): プロバイダ側のカレンダー ID、タイムゾーン、同期対象か、`sync_token`(Outlook なら deltaLink)、watch チャンネルの `channel_id` / `resource_id` / `expiration`、最終同期時刻。
  - 予定のキャッシュ(`external_events`): 一意キーは「カレンダー × プロバイダの予定 ID」。持つ列は、`ical_uid`、`etag`、`status`、タイトル、開始・終了(`timestamptz`)、終日かどうか(終日は日付で別に持つ)、元のタイムゾーン、`transparency`(予定あり / 予定なし)、自分の出欠、`recurring_event_id`、`original_start_time`、`recurrence`(親の RRULE)、プロバイダ側の `updated`。
- **選択状態はキャッシュ行とは別のテーブル(`event_selections`)に持つ。** キーはキャッシュの内部 ID ではなくプロバイダ側の識別子(カレンダー + 予定 ID、1回分なら + `original_start_time`)にする。410 でキャッシュを作り直しても選択が消えないようにするため。
- 空き時間の計算は「選択テーブルと結合したキャッシュ」と「Slotto 自身の予約テーブル」の和集合を busy として読む。

**更新・削除の追従**

- 更新: 同じ予定 ID で upsert する。選択済みの予定の時刻が変われば、空き時間は次の計算から自動で変わる。
- 削除: Google は `status: "cancelled"` で通知する。キャッシュ行と選択行を消す(または論理削除)。
- 410 GONE(フル同期のやり直し): 「全消し → 入れ直し」ではなく「全件 upsert → 今回見えなかった行を削除(mark & sweep)」にすると、途中で失敗しても空き時間が一時的に全開にならない。
- 終日予定は `start.date` / `end.date`(終了日は排他的)で届く。UTC の 0 時に変換して保存すると日本時間でずれるので、日付のまま保存し、計算時にユーザーのタイムゾーンで区間に直す。
- 「予定なし(transparent)」や自分が辞退した予定は、選択画面で既定を「選ばない」にし、目印を出す。最終判断はユーザーの選択に従う。

**繰り返し予定**

- Google の表現: 親(RRULE を持つ)+ 例外(変更された回)+ キャンセルされた回(`status: cancelled` の短縮オブジェクト。EXDATE ではなくこの形で表される)。各回は `recurring_event_id` + `original_start_time` で一意に決まり、回を移動してもこの組は変わらない。
- 選択の種類を3つ持つ:
  - 単発の予定: 予定 ID で選ぶ。
  - シリーズ全体: 親の ID で選ぶ。その親に属する回は今後追加される分も含めて自動で対象になる。
  - 1回分だけ: 親の ID + `original_start_time` で選ぶ。シリーズ全体を選んだうえで特定の回だけ外す「除外」も同じキーで表せる。
- 「この予定以降をすべて変更」は Google 側でシリーズが2つに割れる(古い親は UNTIL で打ち切られ、新しい親が別 ID で作られる)。選択は自動では引き継がれない。
- インスタンス ID を自前で組み立てて突き合わせるのは避け、`recurring_event_id` + `original_start_time` で照合する(ID の書式は仕様として保証されていない)。

**展開(各回への分解)のやり方 — 2 案**

- 案 W(窓の取り直し): `singleEvents=true` と `timeMin` / `timeMax`(例: 今日〜予約を受け付ける最大日数先)で、変更通知のたびに窓全体を取り直し、mark & sweep する。RRULE の解釈も例外の適用も Google に任せられる。1 ページ最大 2500 件なので、通常の利用者なら 1 カレンダー 1〜2 リクエストで済む。
- 案 S(公式の増分同期): `singleEvents=false` で `syncToken` を使い、親と例外を受け取る。各回への展開は、変更のあった親について `events.instances`(期間指定)を呼ぶか、RRULE ライブラリで自前展開する。API 呼び出しは最少だが、実装は重い。
- `singleEvents=true` を期間指定なしで初回同期に使うと、無期限の繰り返しが際限なく展開され、ページングが終わらない事例が報告されている(activepieces の Issue #15566)。

**Slotto が書き込んだ予定を重複して取り込まない**

- 書き込み時に3つの手がかりを残す。
  1. 返ってきた予定 ID と `iCalUID` を、予約テーブル側に保存する。
  2. `extendedProperties.private` に目印(例: 予約 ID)を入れる。制約: キーは最大 44 文字、値は最大 1024 文字、1 予定あたり最大 300 個・合計 32kB。超過分は黙って切り捨てられる。
  3. 予定 ID を自分で指定する(Google は base32hex の文字 `a`〜`v` と `0`〜`9`、5〜1024 文字を許可)。予約 UUID の 16 進表記(ハイフンなし)はこの条件を満たす。再送しても同じ ID なので二重作成にならない。
- 取り込み時は「予約テーブルに対応する予定 ID / iCalUID があるか」と「目印のプロパティがあるか」の両方で判定し、該当すれば「Slotto の予約」として扱い、選択候補に出さない(busy は予約テーブルから既に計上されている)。
- `private` はその人のカレンダー上のコピーにしか付かない。`shared` は全参加者のコピーに付き、参加者から見える・書き換えられる。
- 参加者側のカレンダー(別の Slotto ユーザーや Outlook 利用者)に届いたコピーには `private` の目印がない。そこでの判定は `iCalUID`(Outlook では `iCalUId`)の一致で行う。

### 推奨方針

- **MVP は案 W(窓の取り直し)で始める。** 個人開発で繰り返し予定の展開を自作するのは不具合の温床になりやすい。push 通知はカレンダー単位で数十秒のデバウンスをかけ、連続通知で API を叩きすぎないようにする。
- 利用者が増えてクォータや実行時間が気になってきたら案 S に移行する。そのためにキャッシュは最初から「各回 1 行 + `recurring_event_id` + `original_start_time`」の形にしておく。
- 選択テーブルは最初から分ける。シリーズ選択と 1 回分の除外を同じ表で表せるようにしておく。
- シリーズの分割は、同じ同期バッチ内で「選択済みの親が打ち切られた」+「新しい親が現れた」を検出したら、選択を引き継ぐかユーザーに確認する通知を出す。自動引き継ぎは誤判定のおそれがあるので、最初は確認方式が安全。
- Slotto 由来の予定は「予定 ID 指定 + private の目印 + 予約テーブルへの保存」の三重にする。参加者側は iCalUID で照合する。
- キャッシュする項目は必要最小限(タイトル・時刻・状態)に絞る。説明文や参加者一覧は保存しない。Google の審査でデータ利用の説明がしやすくなる。

### 注意点

- 増分同期中は `privateExtendedProperty` での絞り込みができない(`syncToken` と併用不可)。取り込み側で自前判定する。
- `shared` の拡張プロパティに秘密の値を入れない。参加者全員から見える。
- 新しい親の ID が「元の ID + `_R` + 日時」になる、という挙動は広く観測されているが公式仕様ではない(**未確認**)。これに依存した自動引き継ぎは避ける。
- 初回フル同期で `timeMin` / `timeMax` を付けた場合に `nextSyncToken` が返るか、その後の増分がその範囲を覚えているかは、公式サンプルで `timeMin` の例があるのみで詳細は **未確認**。案 S に移る際に実機で確認する。
- ユーザーが Google カレンダー側で Slotto の予定を動かしたり消したりした場合の方針(予約に反映するか、ずれとして通知するか)を先に決めておく。決めないと「予約は生きているのにカレンダーに無い」状態が残る。
- 選択済みの予定が動いた結果、既存の Slotto 予約と重なることがある。自動では直せないので、検出して通知する仕組みを用意する。

---

## 3. Google OAuth の審査

### 要点

**スコープの区分**

- 区分は non-sensitive / sensitive / restricted の3つで、Cloud Console のスコープ選択画面に自動で表示される。
- カレンダーの読み書き系(`calendar`, `calendar.readonly`, `calendar.events`, `calendar.events.readonly`)は **sensitive**。restricted は主に Gmail / Drive / Chat / Meet の広いスコープで、カレンダーの通常のスコープは該当しない。
- したがって Slotto に必要なのは **sensitive scope verification**。restricted で求められる第三者のセキュリティ評価(CASA、年次)は不要。
- 非 sensitive スコープだけのアプリは審査なしで公開できる(アプリ名とロゴを同意画面に出すためのブランド確認は任意で受けられる)。

**本番公開に必要なもの**

- Search Console で所有確認済みの独自ドメイン(ホームページ、プライバシーポリシー、リダイレクト URI のすべてが対象)。
- 公開ホームページ: ログインなしで見られること、アプリの機能を説明していること、プライバシーポリシーへのリンクがあること。ログイン画面だけのページは不可。
- プライバシーポリシー: ホームページと同じドメインに置き、Google ユーザーデータの取得・利用・保存・共有の方法を明記する。同意画面に設定した URL と一致させる。
- 同意画面の情報: アプリ名、ロゴ、サポート用メール、開発者の連絡先。
- スコープごとの利用理由と「より狭いスコープでは足りない理由」の説明文。
- デモ動画(YouTube に限定公開でアップロード): OAuth の流れを最初から最後まで見せる。同意画面は英語表示で、申請と同じスコープが表示されていること、ブラウザのアドレスバーにクライアント ID が見えること、各スコープのデータをアプリ内でどう使うかを示すこと。
- テスト用と本番用で Cloud プロジェクトを分けること(ポリシー上の要件)。本番プロジェクトに開発用のリダイレクト URI を残さない。
- リダイレクト URI と JavaScript オリジンは HTTPS。

**期間**

- 公式の目安は「sensitive scope の審査は通常 3〜5 営業日」。
- 実際には、2026 年 4〜9 月に「`calendar.events` の審査が 4〜5 週間以上『審査中』のまま動かない、Trust & Safety からのメールも来ない」という報告が Google 開発者フォーラムに複数ある。

**未検証のときの制約**

- 公開ステータスが「テスト」: 同意画面に登録したテストユーザー(最大 100 人)しか使えない。**認可は同意から 7 日で失効し、refresh token も 7 日で切れる。** 例外は、名前・メール・プロフィールだけを要求する場合のみ。
- 公開ステータスが「本番」だが未検証: sensitive スコープを要求すると「このアプリは Google で確認されていません」の警告画面が出る。警告画面を見た **新規ユーザーは累計 100 人まで**。この上限はプロジェクトの存続期間を通じたもので、リセットも変更もできない。
- 審査に通ると、承認されたスコープについては上限がなくなる。あとから sensitive スコープを追加すると再審査が必要。

**データ利用のポリシー(Limited Use)**

- Google Workspace API のユーザーデータポリシーに「Limited Use」要件があり、sensitive / restricted スコープから得たデータが対象とされる。主な内容: 利用はアプリの画面上で明示された機能の提供・改善に限る / 第三者への移転は限定的な場合のみ / 広告への利用禁止 / 原則として人間が読まない。
- AI に関する禁止事項(原文): 「Transferring, selling, or using user data to create, train, or improve a machine learning or artificial intelligence model beyond that specific user's personalized model for the appropriate use case or user-facing feature.」
- プライバシーポリシーに、Limited Use を含む Google のユーザーデータポリシーに従う旨の文言を入れる必要がある。

**その他の仕様**

- 同意画面では、ログイン用以外のスコープをユーザーが個別に外せる(granular permissions)。トークン応答の `scope` を見て、実際に許可されたスコープを確認する必要がある。
- refresh token が無効になる主な理由: ユーザーが取り消した / 6 か月使われなかった / 同じアカウント × 同じクライアント ID で 100 個を超えた(古いものから無効)/ 期限付きアクセスが切れた / Workspace 管理者が制限した。

### 推奨方針

- 開発の早い段階で、**テスト用プロジェクトと本番用プロジェクトを分けて作る。** 本番用は独自ドメインのホームページとプライバシーポリシーが用意でき次第、審査に出す。
- 審査期間は公式の 3〜5 営業日ではなく、**4〜8 週間かかる前提**で公開日から逆算する。差し戻しに備え、プロジェクトのオーナーのメールを毎日確認する。
- スコープは `calendar.events` + `calendar.calendarlist.readonly` に絞り、利用理由を「予定の一覧を表示してユーザーが選ぶ」「確定した予定を書き込む」と機能に 1 対 1 で対応させて書く。
- 未検証の「本番」状態で一般公開しない。100 人の枠は使い切ると戻せない。審査通過までは「テスト」状態で身内だけに配る。
- 「テスト」状態では refresh token が 7 日で切れるので、開発中は「連携が切れたら再認可を促す」動線を先に作っておく(本番でも取り消しや失効で必ず起きる)。
- カレンダー連携の OAuth は自分のドメインのコールバックで受ける(項目 4)。同意画面と審査で、独自ドメインに揃えやすい。
- AI 機能でカレンダーの内容を外部の AI API に渡す場合は、プライバシーポリシーとデモ動画でその流れを明示し、汎用モデルの学習に使わないことを書く。

### 注意点

- Limited Use の対象に Calendar が明示的に含まれるかは、取得した要約では「sensitive / restricted スコープ由来のデータに適用」と「Gmail / Drive / Chat / Meet を名指し」の両方の記述があり、切り分けが **未確認**。保守的に、Calendar も対象として扱う。
- `calendar.app.created` と `calendar.freebusy` は「公式のスコープ一覧にはあるが、Console のスコープ選択に出てこない」という報告がある(GitHub の Issue の記述。**未確認**)。
- 審査の実績期間はフォーラムの個別報告であり、統計ではない。
- 同意画面でユーザーがカレンダーのスコープを外したままログインすることがある。その場合は連携を「未完了」として扱い、再度の許可を案内する。
- Expo 側の Google ログインは、埋め込み WebView ではなくシステムブラウザ経由にする必要がある(Google のポリシー。詳細はモバイル側の調査を参照)。

---

## 4. Supabase Auth と Google のトークン

### 要点

**Supabase Auth 経由で provider_refresh_token を受け取る方法**

- `signInWithOAuth({ provider: 'google', options: { scopes, queryParams: { access_type: 'offline', prompt: 'consent' }, redirectTo } })` で開始し、Next.js のコールバックルート(Route Handler)で `exchangeCodeForSession(code)` を呼ぶ。
- Google は既定では refresh token を返さない。`access_type=offline` が必須。さらに、refresh token が返るのは **初回の同意時だけ**で、2 回目以降も確実に受け取るには `prompt=consent` が必要(Google の公式ドキュメントにも同じ記載)。
- **Supabase Auth は provider token を保存も更新もしない。** 公式に「Provider tokens are intentionally not stored in your project's database」「Supabase Auth does not manage refreshing the provider token for the user」とある。
- `provider_token` / `provider_refresh_token` が取れるのは、サインイン直後のセッション(`exchangeCodeForSession` の戻り値)だけ。以後のセッション更新では含まれない。コールバックルートの中で取り出して自分で保存するのが唯一の確実な機会。
- Google のアクセストークンは約 1 時間で切れる。更新(`https://oauth2.googleapis.com/token` への refresh)は自前で実装する。

**ログイン用とカレンダー連携用の OAuth を分けるか**

- 分ける構成 = ログインは Supabase Auth(`openid email profile` だけ)、カレンダー連携は Next.js の Route Handler で Google の認可コードフローを自前実装する。
- 分ける理由(調査結果からの整理):
  1. refresh token を確実に得るには `prompt=consent` が要る。ログインと兼用すると、毎回のログインで同意画面が出る。
  2. Google の同意画面はスコープごとにチェックを外せる。ログイン時にカレンダー権限まで求めると、外されたり離脱されたりしやすい。Google も「必要になった文脈で追加の権限を求める」段階的な認可(`include_granted_scopes=true`)を推奨している。
  3. メールや Apple でログインした利用者も Google カレンダーを連携できる必要がある。Expo のネイティブ Google ログイン(ID トークン方式)ではカレンダー用のトークンは得られない。
  4. 仕事用と個人用など、複数の Google アカウントを 1 人の Slotto ユーザーに連携したい。Supabase の `linkIdentity()` は、連携済みの ID を重ねて連携すると失敗する。同じプロバイダの ID を複数持てるかは **未確認**。
  5. Supabase 経由だと provider token がセッション(ブラウザ側のクッキー)に一時的に載る。自前フローならトークンはサーバーから外に出ない。
  6. Supabase 経由の Google 同意画面には既定で `<project-id>.supabase.co` が表示される。独自ドメインにするにはカスタムドメイン(有料プランのアドオン。月 10 ドルとする情報あり)が必要。自前フローのコールバックは自分のドメインに置ける。
- 自前フローの要点: `access_type=offline`、`prompt=consent`、`include_granted_scopes=true`、`state`(CSRF 対策。ログイン中のユーザーに紐づけて署名し、コールバックで照合)、`login_hint`(連携したいアカウントの指定)、トークン応答の `scope` で実際に許可された権限を確認、`id_token` の `sub` でどの Google アカウントかを識別。連携解除時は `https://oauth2.googleapis.com/revoke` で取り消す。
- refresh 時に `invalid_grant` が返ったら、失効または取り消しを意味する。再認可を求める。

**トークンの暗号化保存**

- Supabase Vault: `vault.create_secret()` で保存し(UUID が返る)、`vault.decrypted_secrets` ビューで復号して読む。認証付き暗号(AEAD)で、**暗号鍵はデータベースの外(Supabase の管理基盤)に保管される**。ダンプやバックアップには暗号文しか入らない。Vault は 2025 年に pgsodium への依存がなくなり、pgsodium 自体は非推奨予定だが Vault の API は維持される。
- Vault の弱点: `vault.decrypted_secrets` を読める権限があれば誰でも復号できる(SQL エディタを使える人、service ロール)。別プロジェクトへ移行すると新しい鍵になり、旧プロジェクトの秘密は復号できない。
- アプリ層での暗号化: Next.js のサーバー側で AES-256-GCM(書き込みごとに新しい 96 ビットの IV)で暗号化し、暗号文・IV・認証タグ・鍵のバージョンを保存する。鍵は Vercel の環境変数に置く。データベース側には平文も鍵も存在しない。
- どちらの方式でも、保存先のテーブルは PostgREST に公開しないスキーマに置き、RLS を有効にしてクライアント向けのポリシーを作らない(サーバーの secret key からのみ読む)。

**Supabase の API キー**

- 新方式は publishable key(`sb_publishable_...`)と secret key(`sb_secret_...`)。旧来の `anon` / `service_role` キーは **2026 年末までに廃止予定**と公式に明記されている。
- 新しいキーは `apikey` ヘッダで送る(`Authorization: Bearer` ではない)。secret key は RLS をすべて迂回するので、サーバー側でのみ使う。
- Slotto では環境変数名を `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(Web)/ `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(Expo)/ `SUPABASE_SECRET_KEY`(サーバー)に統一する。

### 推奨方針

- **ログインとカレンダー連携は分ける。** ログインは Supabase Auth(最小スコープ)、カレンダー連携は「設定 → カレンダーを連携」から始まる自前の OAuth フローにする。Outlook と Zoom も同じ「連携」の枠組み(`calendar_connections` に類する表)に載せられる。
- トークンは **アプリ層の AES-256-GCM で暗号化して保存**する。トークンを使うのは Vercel 上の Next.js だけなので、鍵をデータベースの外(Vercel の環境変数)に置く構成が自然。暗号化時にユーザー ID や連携 ID を追加認証データ(AAD)に入れ、行の入れ替えを検出できるようにする。鍵のバージョン列を持ち、鍵の更新に備える。
- Supabase Vault は、SQL 側で必要になる秘密(pg_cron から Next.js を呼ぶときの共有シークレットなど)に使う。
- アクセストークンは期限とともにキャッシュし、期限の数分前に更新する。更新処理は連携単位で排他する(同時に 2 つの更新が走ると、Microsoft や Zoom のように refresh token が入れ替わるプロバイダで片方が無効になる)。
- 連携ごとに状態(有効 / 再認可が必要 / 取り消し済み)を持ち、`invalid_grant` を受けたら状態を変えてユーザーに通知し、同期ジョブを止める。

### 注意点

- 「ログインと同時にカレンダーも連携」の一体型は初回の手数が少ないが、上の理由で長期の運用が難しい。一体型にする場合でも、コールバックで refresh token が取れなかったときの再同意の動線が必須。
- 自前フローの `state` 検証を省くと、攻撃者のカレンダーを被害者のアカウントに連携させる CSRF が成立する。
- Google の refresh token は「同じアカウント × 同じクライアント ID で 100 個まで」。連携のたびに新しく発行する設計なので、古い連携を消すときは取り消しも行う。
- Vault に SQL 文で秘密を書き込むと、文のログに平文が残るおそれがあるという注意は以前の公式ドキュメントにあったが、今回取得した版では確認できなかった(**未確認**)。
- カスタムドメインの価格(月 10 ドル)は第三者の記事による。公式の料金ページで要確認。

---

## 5. Microsoft Graph(Outlook)

### 要点

**スコープ(委任されたアクセス許可)**

- `Calendars.ReadWrite`(予定の読み書き。予定作成時に Teams 会議を付けるのもこの権限で足りる)、`offline_access`(refresh token の発行)、`User.Read`(プロフィールとメール)。
- 読み取りだけなら `Calendars.Read`。差分取得(delta)の最小権限は `Calendars.Read`(公式リファレンスの表)。
- 任意: `MailboxSettings.Read`(タイムゾーンと勤務時間)、`Calendars.ReadWrite.Shared`(共有されたカレンダー)。

**calendarView と delta クエリ**

- `GET /me/calendarView?startDateTime=...&endDateTime=...` は、期間内の予定を、繰り返しを各回(occurrence / exception)に展開して返す。Google の `singleEvents=true` + 期間指定に相当する。
- `GET /me/calendarView/delta?startDateTime=...&endDateTime=...`(v1.0)が差分同期。応答の `@odata.nextLink`(`$skiptoken`)をたどり、最後に得られる `@odata.deltaLink`(`$deltatoken`)を保存する。次回はその URL をそのまま呼ぶ。期間はトークンに埋め込まれるので、再指定は不要。
- 期間指定なしの `events/delta` は **beta 版のみ**(公式に明記)。
- 削除は `"@removed": { "reason": "deleted" }` で届く。**期間の外で追加・更新・削除された予定も `@removed` として届く**ので、受け取り側で期間によるフィルタが必要(公式リファレンスに明記)。
- delta では `$select`, `$expand`, `$filter`, `$orderby`, `$search` が使えない。ページサイズは `Prefer: odata.maxpagesize={n}`、時刻の表記は `Prefer: outlook.timezone` で指定する(省略時は UTC)。
- 複数のカレンダーを追うときは、カレンダーごとに delta を回す。

**変更通知(subscriptions)**

- `POST /subscriptions` に `changeType`、`notificationUrl`(HTTPS)、`resource`(`/me/events`)、`expirationDateTime`、`clientState`(照合用の秘密の値)を渡す。作成時に Graph が `validationToken` 付きのリクエストを送ってくるので、その値をそのまま返して検証を通す。
- **Outlook の event の購読は最長 10,080 分(7 日未満)**。リソースデータ付きの通知は 1,440 分(1 日未満)。期限前に `PATCH` で延長する。1 メールボックスあたり、全アプリ合計で最大 1,000 件。
- ライフサイクル通知(再認可が必要、購読が削除された、通知を取りこぼした)を受け取る仕組みがある。
- event の通知遅延は、公式の表で「Unknown」となっている。

**Teams 会議リンク**

- 予定の作成時に `isOnlineMeeting: true` と `onlineMeetingProvider: "teamsForBusiness"` を指定する。参加 URL は応答の `onlineMeeting.joinUrl` に入る(`onlineMeetingUrl` は廃止予定なので使わない)。
- 使えるプロバイダは、カレンダーの `allowedOnlineMeetingProviders` / `defaultOnlineMeetingProvider` で事前に確認できる。
- 一度オンライン会議にすると、プロバイダの変更も無効化もできない(公式に明記)。
- 個人用 Microsoft アカウント(outlook.com)では、長らく `isOnlineMeeting` が黙って無視されていた。2026-09 に「個人アカウントでも `teams.live.com` の会議が発行されるようになった」という報告がある(GitHub の Issue。公式発表は **未確認**)。

**アプリ登録と publisher verification**

- Microsoft Entra 管理センターの「アプリの登録」で作る。対象アカウントは「任意の組織ディレクトリ + 個人用 Microsoft アカウント」(マルチテナント)にし、`common` エンドポイントを使う。Web プラットフォームのリダイレクト URI(HTTPS)とクライアントシークレットを設定する。
- refresh のたびに新しい refresh token が返るので、保存している値を置き換える。
- publisher verification: 検証済みの Microsoft AI Cloud Partner Program(旧 MPN)アカウントをアプリ登録に関連付ける。要件を満たしていれば手続き自体は数分。完了すると同意画面に青い認証バッジが付く。
- 未検証の場合: 同意画面に「未確認」の警告が出る。さらに、2020-11 以降に登録されたマルチテナントアプリで、基本的なサインイン以上の権限を求めるものは、**他テナントの一般ユーザーが自分では同意できず、管理者の同意が必要になる**(risk-based step-up consent が有効なテナントの場合)。
- 2025-07 から、Microsoft 管理の既定の同意ポリシーが順次適用され、一般ユーザーが同意できる範囲が狭まった。名指しされているのは `Files.*` / `Sites.*` で、カレンダー権限が対象かは **未確認**。

**スロットリング**

- Outlook 系は「アプリ ID × メールボックス」ごとに、10 分で 10,000 リクエスト、同時 4 リクエストまで。超過すると `429` と `Retry-After` ヘッダが返る。

### 推奨方針

- Outlook 対応は Google の次の段階にする。ただし最初から「プロバイダ共通のインターフェース」(カレンダー一覧 / 期間内の予定取得 / 予定作成 / 変更通知の購読 / 会議リンク発行)で設計し、テーブルも項目 2 の形を共有する。
- 同期は `calendarView/delta` を使う。期間が固定なので、週 1 回程度、新しい期間で delta をやり直す(窓をずらす)ジョブを用意する。
- 予定の ID は `Prefer: IdType="ImmutableId"` で不変 ID を使う(既定の ID はフォルダ間の移動で変わる)。予定作成時は `transactionId` に予約 ID 由来の値を入れ、再送による二重作成を防ぐ。Slotto 由来かどうかの判定は `iCalUId` と予約テーブルの照合で行う。
- 法人テナントの利用者向けに「管理者の同意が必要な場合の案内」を用意する。
- Teams リンクは職場・学校アカウントを前提にし、個人アカウントでは発行できなかった場合(応答の `isOnlineMeeting` が false)に備えて代替表示を用意する。

### 注意点

- publisher verification には Partner Program への登録が必要で、事業者としての確認がある。**個人(個人事業主)で登録できるかは未確認**。できない場合、法人テナントの利用者は管理者同意が前提になる。
- 購読の期限は Google と同じく約 7 日。更新ジョブを Google と共通化できる。
- 時刻は `dateTime` + `timeZone` の組で返り、タイムゾーン名は Windows 形式(例: `Tokyo Standard Time`)のことがある。`Prefer: outlook.timezone="UTC"` で UTC にそろえて受け取るのが安全。
- 予定の空き扱いは `showAs`(free / tentative / busy / oof / workingElsewhere)。Google の `transparency` より段階が多い。選択画面の既定値を決めるときに対応表が要る。
- 不変 ID、`transactionId`、Windows 形式のタイムゾーン名、refresh token の置き換えは調査者の知識に基づく記述で、今回は公式ページでの再確認をしていない(**未確認**)。実装時に確認する。
- `/me/calendars/{id}/calendarView/delta` のように既定以外のカレンダーで delta が使えるかは、概念ドキュメントには「他のカレンダーも可」とあるが、v1.0 リファレンスの説明は「primary calendar」となっている。実機で確認する。

---

<!-- NEXT_SECTION -->

## 参照 URL 一覧

### 1. Google Calendar API
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/guides/sync
- https://developers.google.com/workspace/calendar/api/guides/push
- https://developers.google.com/workspace/calendar/api/guides/quota
- https://developers.google.com/workspace/calendar/api/guides/create-events
- https://developers.google.com/workspace/calendar/api/guides/recurringevents
- https://developers.google.com/workspace/calendar/api/guides/extended-properties
- https://developers.google.com/workspace/calendar/api/v3/reference/events
- https://developers.google.com/workspace/calendar/api/v3/reference/events/list
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- https://developers.google.com/workspace/calendar/api/v3/reference/events/watch
- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- https://developers.google.com/workspace/calendar/release-notes
- https://developers.google.com/workspace/tools-safety

### 2. 「選んだ予定だけ反映する」設計
- https://developers.google.com/workspace/calendar/api/guides/sync
- https://developers.google.com/workspace/calendar/api/guides/recurringevents
- https://developers.google.com/workspace/calendar/api/guides/extended-properties
- https://developers.google.com/workspace/calendar/api/v3/reference/events
- https://developers.google.com/workspace/calendar/api/concepts/events-calendars
- https://github.com/activepieces/activepieces/issues/15566
- https://github.com/DannieBGoode/google-calendar-sync/pull/8
- https://cli.nylas.com/guides/google-calendar-api-pagination

### 3. Google OAuth の審査
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance
- https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions
- https://developers.google.com/identity/protocols/oauth2 (Refresh token expiration)
- https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- https://support.google.com/cloud/answer/15549945 (Manage App Audience: テスト / 本番、100 人上限、7 日失効)
- https://support.google.com/cloud/answer/13463073 (OAuth App Verification Help Center)
- https://support.google.com/cloud/answer/13464321 (Verification requirements)
- https://discuss.google.dev/t/sensitive-scope-verification-calendar-events-pending-since-aug-26-no-update-in-4-weeks/398909
- https://discuss.google.dev/t/oauth-verification-stuck-at-homepage-requirements-for-5-weeks-no-email-from-trust-safety/401121
- https://github.com/anasakkari3/maybesitter/issues/152

### 4. Supabase Auth と Google のトークン
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login (Provider tokens)
- https://supabase.com/docs/guides/auth/auth-identity-linking
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/database/extensions/pgsodium
- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/guides/platform/custom-domains
- https://github.com/orgs/supabase/discussions/22653
- https://github.com/orgs/supabase/discussions/19384
- https://github.com/orgs/supabase/discussions/23449
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://www.sitesnapshot.io/blog/supabase-custom-domain-benefits (カスタムドメインの価格。第三者記事)

### 5. Microsoft Graph(Outlook)
- https://learn.microsoft.com/en-us/graph/delta-query-events
- https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/change-notifications-overview
- https://learn.microsoft.com/en-us/graph/outlook-calendar-online-meetings
- https://learn.microsoft.com/en-us/graph/throttling-limits
- https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview
- https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-risk-based-step-up-consent
- https://developer.nylas.com/docs/provider-guides/microsoft/verification-guide/
- https://blog.interian.be/2025/07/17/microsoft-entra-consent-changes-coming-july-2025-a-guide-for-admins/
- https://github.com/mpalermiti/outlook-mcp/issues/70 (個人アカウントでの Teams 会議発行の報告)
- https://learn.microsoft.com/en-us/answers/questions/5560261/graph-api-not-creating-online-meeting-despite-ison

<!-- NEXT_URLS -->
