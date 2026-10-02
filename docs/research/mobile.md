# Slotto モバイルアプリ 技術要件 調査メモ

- 作成日: 2026-10-02
- 対象: 日程調整サービス「Slotto」のモバイルアプリ(Expo / React Native、App Store と Google Play で配布)
- 前提: Web(Next.js)が主、バックエンドは Supabase、開発機は Windows 11(Mac なし)、pnpm モノレポ
- 調査方法: WebSearch / WebFetch(公式ドキュメント・公式 changelog を優先。2025〜2026 年の情報を優先)。コードは書いていない。
- 表記ルール:
  - 【事実】= 公式ドキュメント・公式発表で確認できたこと
  - 【二次情報】= 公式ではない記事・Issue・ブログに基づくこと(古い・不正確な可能性あり)
  - 【未確認】= 今回の調査では裏が取れなかったこと
  - 【推奨】= 調査を踏まえた Slotto 向けの方針案(事実ではない)

> 進捗: このファイルは項目を調べ終えるたびに追記・保存している。未記入の章は「(調査中)」と表示される。

---

## 0. 現在のリポジトリの状態(調査時に読み取った事実)

調査開始時点(2026-10-02)で `C:\Users\81703\slotto` には既に雛形があった(読み取りのみ。変更していない)。

- ルート: `pnpm@10.33.2`、`pnpm-workspace.yaml`(`apps/*`, `packages/*`)、`.npmrc` に `node-linker=hoisted`
- `apps/mobile`: **Expo SDK 57**(`expo ~57.0.26`、`react-native 0.86.3`、`react 19.2.3`、`expo-router ~57.0.24`、`react-native-reanimated 4.5.1`、`react-native-worklets 0.10.1`、`@expo/ui ~57.0.21`、TypeScript `~6.0.3`)。`app.json` は `experiments.typedRoutes: true` / `reactCompiler: true`、コードは `src/app/` 配下(SDK 55 以降の既定テンプレート構成)
- `apps/web`: `next 16.3.8`、`react 19.2.8` / `react-dom 19.2.8`、Tailwind CSS v4
- `node_modules` は未インストール(実際の解決結果は未確認)
- 気づいた点(変更はしていない):
  - **web と mobile で React のパッチバージョンが違う**(19.2.8 と 19.2.3)。扱いは「1. Expo の現状」の React バージョンの節を参照
  - `apps/web/pnpm-workspace.yaml`(`ignoredBuiltDependencies` のみ)と `apps/web/package.json` の `packageManager` が残っている。pnpm は最も近い `pnpm-workspace.yaml` をワークスペースのルートとみなすため、`apps/web` の中で pnpm を実行すると別ワークスペース扱いになる可能性がある【未確認・要整理】
  - ルートの scripts は `@slotto/web` / `@slotto/mobile` を参照しているが、各 package.json の `name` は `web` / `mobile` のまま

---

## 1. Expo の現状

### 要点

- 【事実】最新の安定版は **Expo SDK 57**(2026-06-30 公開)。**React Native 0.86 / React 19.2.3 / react-native-web 0.21**。npm の `expo` の latest は `57.0.26`(2026-10-02 に npm レジストリで確認)。
- 【事実】**SDK 58 はベータ中**(2026-09-15 開始。ベータ期間は 3〜4 週間、React Native 0.88 の安定版が出た後に安定版を出す予定)。2026-10-02 時点で公式 changelog に SDK 58 安定版の記事はまだない。
- 【事実】直近 3 リリースの主な変更点

  | SDK | 公開日 | React Native | React | 主な変更 |
  |---|---|---|---|---|
  | 55 | 2026-02-25 | 0.83 | 19.2.0 | **Legacy Architecture を廃止**(`newArchEnabled` を app.json から削除)。既定テンプレートが `/src/app` 構成に。Native Tabs API。app.json の `notification` フィールド削除(→ `expo-notifications` の config plugin へ移行)。`expo-widgets`(アルファ、ホーム画面ウィジェットと Live Activities)。Hermes バイトコード差分による更新サイズ削減。`eas update` に `--environment` 必須。Android 16 以降は edge-to-edge 必須。モノレポで `autolinkingModuleResolution` が自動有効 |
  | 56 | 2026-05-21 | 0.85 | 19.2.3 | **Hermes v1 が既定**。**Expo UI(SwiftUI / Jetpack Compose)が安定版**。`expo-calendar` / `expo-media-library` / `expo-contacts` が stable に昇格。**Expo Router が React Navigation への依存を外した**(fork)。`expo/fetch` がグローバル `fetch` の既定に。`@expo/vector-icons` が `expo` 本体に同梱されなくなった。iOS 最低 16.4、Xcode 26.4 以上、Node 20.19.4 以上 |
  | 57 | 2026-06-30 | 0.86 | 19.2.3 | 小さなリリース(RN 0.86 は 0.85 から破壊的変更なしの想定)。Xcode 27 対応。`expo prebuild` が既定で `android` / `ios` を消して再生成。Hermes v1 のメモリ回帰(reanimated / worklets 使用時)は `expo@57.0.9`(RN 0.86.2)で、起動時間の回帰は `expo@57.0.17` で解消 |
  | 58(ベータ) | ベータ 2026-09-15 | 0.88 RC | (記載なし) | **iOS 27 向け**(UIKit の scene-based life cycle に移行、`SceneDelegate.swift` を生成)。Xcode 27。Node 22.13+ / 24.3+ / 26。Expo Router のデータローダー・SSR・ミドルウェア・Native Tabs・Toolbar が stable に。**`expo-notifications` に Android の `delivery: 'alarmClock'`(`AlarmManager.setAlarmClock()`)追加**、フォアグラウンド通知が既定で表示されるように変更。`expo-app-intents`(アルファ。Siri / ショートカット / Spotlight / Apple Intelligence の App Intents)追加。RN 0.87 の非推奨 API 削除(`InteractionManager`、`Touchable` など)を含む |

- 【事実】SDK 57 の対応環境: Android 7 以上(compileSdk / targetSdk 36)、iOS 16.4 以上、Xcode 26.4 以上、Node 22.13 系以上(公式のバージョン表)。
- 【事実】**New Architecture は SDK 55 以降は常に有効で、無効にできない**(SDK 54 が Legacy Architecture をサポートした最後のリリース)。ライブラリ選定は New Architecture(Fabric / TurboModules)対応が前提になる。
- 【事実】**Expo Router** は SDK とバージョン番号が揃った(SDK 57 なら `expo-router 57.x`)。SDK 56 で React Navigation から fork し、`@react-navigation/*` を直接 import できなくなった(`expo-router/react-navigation`、`expo-router/js-stack`、`expo-router/js-tabs` などに置き換え。codemod あり: `npx expo-codemod sdk-56-expo-router-react-navigation-replace src`)。node_modules 内のサードパーティが React Navigation を import している場合は Expo CLI が一時的に書き換えてくれる(互換措置)。
- 【事実】**Expo Go のストア配布は不安定**。2026-05 時点ではストア版が SDK 54 止まり(SDK 55 版が Apple の審査待ちのまま、SDK 56 版はストアになし)だった。2026-09-03 に App Store の Expo Go が SDK 57 対応に更新されたが、同時に **iOS 実機では Expo CLI と Expo Go の両方で同じアカウントにログインしていないとプロジェクトを開けない**ようになった(Android 版にも今後適用予定。シミュレータと development build は対象外)。ストアにない SDK の Expo Go は、Android は Expo CLI 経由、iOS 実機は `eas go`(自分の Apple Developer アカウントで TestFlight に上げる方式)で入れる。公式は Expo Go を「初心者向けの学習ツール」と位置づけ、ストア配布するアプリには development build を推奨している。【未確認】Google Play 版 Expo Go の SDK 57 対応状況。

### pnpm モノレポで Next.js と共存させる設定

- 【事実】**Metro のモノレポ設定は SDK 52 以降は自動**。`expo/metro-config` の `getDefaultConfig` を使っていれば、`watchFolders` / `resolver.nodeModulesPaths` / `resolver.extraNodeModules` / `resolver.disableHierarchicalLookup` を手で書く必要はない(公式は「書いてあれば削除する」よう案内)。古い記事の Metro 設定を持ち込まないこと。
- 【事実】SDK 54 以降は pnpm の isolated(既定)インストールにも対応。ただし「一部の React Native ライブラリは isolated でビルド・解決エラーになることがある。その場合は hoisted に切り替える」と公式に書かれている。現リポジトリは `.npmrc` の `node-linker=hoisted` で既に hoisted になっており、そのままでよい(pnpm 10 では `pnpm-workspace.yaml` の `nodeLinker: hoisted` でも指定できる)。
- 【事実】SDK 55 以降、モノレポでは `experiments.autolinkingModuleResolution` が自動で有効になる。Metro が解決するネイティブモジュールを autolinking の結果と一致させ、`react` / `react-dom` も 1 バージョンに解決する。
- 【事実】公式の制約: 「1 つのモノレポ内で React Native の複数バージョンは非対応」「1 つのアプリ内で React が重複するとランタイムエラー」。重複確認は `pnpm why --depth=10 react-native` / `pnpm why react`、`npx expo-doctor`。
- 【事実】共有パッケージは `packages/*` に置き、各アプリの `dependencies` に `"@slotto/shared": "workspace:*"` の形で入れる。Metro はワークスペース内の TypeScript ソースをそのまま読める。Next.js 側は TS ソースのままの共有パッケージを読むために `transpilePackages` の指定が要る場合がある【未確認: Next.js 16 / Turbopack での要否は web 側の調査で確認】。

### React のバージョンを揃えるときの注意点

- 【事実】**React Native のレンダラーは `react` の完全一致を要求する**。RN 0.85 / 0.86 に同梱のレンダラーは React **19.2.3** でビルドされており、違うバージョンの `react` が読み込まれると起動時に `Incompatible React versions: The "react" and "react-native-renderer" packages must have the exact same version` で落ちる(RN の peerDependencies は `^19.2.3` と緩いので、インストール時には気づけない)。
- 【事実】React 19.2.4〜19.2.8 は主に React Server Components / Server Actions のセキュリティ強化・修正・性能改善(19.2.4 = 2026-01 DoS 対策、19.2.8 = 2026-07 RSC デコードの性能改善)。
- 現リポジトリは web = 19.2.8、mobile = 19.2.3。選択肢は 2 つ:
  - **案 A(揃える)**: web も mobile も `react` / `react-dom` を **RN が要求する exact 版(今は 19.2.3)** に固定する(pnpm の `catalog:` か `overrides`)。揃える方向は「web を mobile に合わせる」しかない(逆にすると mobile が落ちる)。モノレポ内の React が 1 つになり、共有パッケージ経由の重複事故がなくなる。Expo SDK を上げるたびに RN の要求バージョンが変わるので、その都度 web も合わせる。【未確認】web の `react` を下げたときに RSC のセキュリティ修正が失われないか(Next.js の App Router は React を本体に同梱しており、修正は主に Next.js 本体の更新で入るとされるが、今回は裏を取り切れていない)。
  - **案 B(揃えず分離する)**: web は新しいパッチ、mobile は exact 固定のまま。共有パッケージは `react` を `peerDependencies` に置き(`dependencies` に入れない)、できれば **React に依存しない純 TypeScript**(型、zod スキーマ、日時計算、Supabase のクエリ関数)に留める。mobile 側は `autolinkingModuleResolution` が `react` を 1 つに解決する。【未確認】hoisted 構成でルートの `node_modules/react` にどちらが置かれるか、web 側が共有パッケージ経由で別の React を拾わないかは、実際に `pnpm install` して `pnpm why react` と両アプリの起動で確認が必要。
- 【推奨】まずは **案 B + 共有パッケージを React 非依存にする**(UI は web と mobile で別実装になるので、共有するのはロジックと型で十分)。React を使う共有コード(hooks など)が必要になった時点で案 A を検討する。
- 【推奨】mobile の依存は `npx expo install <pkg>` で入れ、`npx expo install --check` / `npx expo-doctor` で SDK と合うバージョンかを確認する。Renovate / Dependabot を入れるなら、mobile の `react` / `react-native` / `expo-*` は自動更新の対象から外す。

### 推奨方針

- 【推奨】**SDK 57 のまま開発を始め、SDK 58 の安定版が出て数週間たってから上げる**。SDK 58 は iOS 27 の scene-based life cycle への移行や RN 0.87 / 0.88 の非推奨 API 削除を含む大きめの更新で、周辺ライブラリの追従を待つ価値がある。一方で SDK 58 の `delivery: 'alarmClock'` は「予定の時間にアラーム」の要件に直結するので、通知まわりの本実装は SDK 58 に上げてからにすると手戻りが少ない(項目 2 参照)。
- 【推奨】最初から **development build 前提**(Expo Go に頼らない)。Slotto が必要とするプッシュ通知・カスタム音・Universal Links・Google / Apple ログイン・課金はどれも Expo Go では完結しない。
- 【推奨】ネイティブコードは持たず、Continuous Native Generation(`app.json` + config plugin)で通す。`android/` / `ios/` を手で編集しない(SDK 57 から `expo prebuild` が既定で消して作り直す)。

### 注意点

- 【未確認】Apple が「iOS 27 SDK(Xcode 27)でのビルド必須」をいつから課すか。例年は翌年 4 月ごろに最新 SDK でのビルドが必須になるので、2027 年春までには SDK 58 以降へ上げる必要が出る可能性が高い。
- 【事実】SDK 56 以降 `@expo/vector-icons` は `expo` に同梱されない(必要なら `@react-native-vector-icons/*` へ)。SDK 57 の既定テンプレートは `expo-symbols`(SF Symbols)と `@expo/ui` を使う。
- 【事実】SDK 56 以降はグローバル `fetch` が `expo/fetch` 実装になった。Supabase クライアントなど fetch に依存するライブラリの挙動は実機で確認する【未確認: supabase-js との相性問題の有無】。
- 【事実】Expo Go で動く範囲と development build が必要な範囲は、項目 2 の末尾に整理した。

---

## 2. 通知とアラーム

### 2-1. expo-notifications での時刻指定ローカル通知

- 【事実】ローカル通知のトリガーは `DATE`(日時 1 回)、`TIME_INTERVAL`(`repeats: true` で繰り返し可)、`DAILY` / `WEEKLY` / `MONTHLY` / `YEARLY`(Android・iOS 両対応)、`CALENDAR`(iOS のみ、日付要素一致+`repeats`)。予定の時刻に鳴らす用途は `DATE` トリガーが基本。
- 【事実】**iOS の保留通知は 1 アプリ 64 件まで**。システムは「発火が近い順に 64 件」だけを保持し、残りは捨てる(自動で繰り返す通知は 1 件と数える)。回避策はない(Apple Developer Forums の回答)。expo-notifications のドキュメントにはこの上限の記載がないので、アプリ側で管理する必要がある。
- 【事実】**Android は通知チャンネルが必須**(Android 8 以降)。`setNotificationChannelAsync` で作り、重要度(`importance`)・音・バイブ・`bypassDnd`・ロック画面表示・`audioAttributes` を設定する。**チャンネルは作成後に名前と説明しか変えられない**(OS の制限)。音や重要度を変えたいときは新しいチャンネル ID を作る。
- 【事実】Android 13 以降は通知の許可ダイアログが必要で、**チャンネルを 1 つ以上作るまでダイアログは出ない**。
- 【事実】**カスタム音**は config plugin の `sounds` 配列に音声ファイル(.wav 推奨)を登録し、通知側ではファイル名だけを指定する。Android 8 以降は音を**チャンネルに**設定する。iOS は aiff / wav / caf で **30 秒未満**(30 秒を超えると既定の音になる)。マナーモードや集中モードが許可しないときは鳴らない。
- 【事実】config plugin の主な項目: `icon`(Android、96x96 の白抜き PNG)、`color`、`defaultChannel`、`sounds`、`enableBackgroundRemoteNotifications`(iOS、`UIBackgroundModes` に `remote-notification` を追加)。SDK 55 で app.json の `notification` フィールドは廃止され、config plugin に一本化された。
- 【事実】通知にボタンを付けられる(`setNotificationCategoryAsync`。`opensAppToForeground`、テキスト入力など)。「スヌーズ」「参加 URL を開く」などに使える。
- 【事実】**Android の時刻精度**: Android 12 以降で正確な時刻に鳴らすには `SCHEDULE_EXACT_ALARM`(または `USE_EXACT_ALARM`)の宣言が必要。expo-notifications は `canScheduleExactAlarms()` が true のときだけ `setExactAndAllowWhileIdle` を使い、false なら不正確なアラーム(`setAndAllowWhileIdle`)にフォールバックする。不正確なアラームは Doze 中に何分も遅れることがある【二次情報: Expo の PR / Issue の記述】。

### 2-2. アラームに近い挙動を出す手段

**iOS**

- 【事実】**Time Sensitive 通知**(iOS 15 以降): 通知の `interruptionLevel: 'timeSensitive'`。集中モードと通知の要約を突破して即時に表示される。entitlement `com.apple.developer.usernotifications.time-sensitive` が必要で、app.json の `ios.entitlements` に書けば EAS Build が Apple 側の capability を自動で同期する。Apple への申請は不要。ユーザーはアプリごとにオフにできる。**消音スイッチ(マナーモード)は突破しない**。
- 【事実】**Critical Alerts**: 消音スイッチと集中モードを突破して音を鳴らせるが、entitlement(`com.apple.developer.usernotifications.critical-alerts`)は **Apple への個別申請と承認が必要**。対象は健康・安全・セキュリティ・緊急用途(医療、公共安全、防災、防犯など)に限られ、「単に時間が大事」な通知や販促・ソーシャル用途は却下される。承認後もユーザーの許可が別途必要。**日程調整アプリが承認される見込みは低い**【推奨: 申請しない前提で設計する】。EAS Build の capability 自動同期の対象一覧にも載っていない。
- 【事実】**AlarmKit(iOS 26 / iPadOS 26 以降)**: サードパーティアプリが純正時計アプリと同等のアラーム・タイマーを出せる新フレームワーク(WWDC25 セッション 230)。
  - アラームは**消音スイッチと集中モードを突破**し、ロック画面・Dynamic Island・StandBy に全画面のアラート UI を出す。Critical Alerts の entitlement は不要。
  - Info.plist に `NSAlarmKitUsageDescription` を書き、`AlarmManager.requestAuthorization()` でユーザーの許可を得る(状態は `notDetermined` / `authorized` / `denied`)。
  - スケジュールは固定日時(fixed)と相対(relative、曜日繰り返し可)。カウントダウン(pre-alert)とスヌーズ(post-alert)を持てる。
  - 停止・スヌーズに加え、App Intents を使った独自ボタン(アプリを開く、任意の処理を実行)を付けられる。
  - カウントダウン表示を使う場合は Live Activity(Widget Extension)の実装が必要【二次情報: WWDC の解説記事】。
  - 音はアプリバンドルか `Library/Sounds` のファイルを指定できる。
  - Apple は用途を「料理タイマー、服薬リマインダー、ワークアウト、起床アラームなど」とし、他の通知の置き換えではないとしている。
- 【事実】**Expo / React Native から AlarmKit を使う手段はコミュニティ製のみ**。Expo 公式の SDK 55〜58(ベータ)の changelog に AlarmKit モジュールはない。
  - `expo-alarm-kit`(nickdeupree): Expo Modules 製。`scheduleAlarm` / `scheduleRepeatingAlarm` / `scheduleTimerAlarm` / `cancelAlarm` / `getAllAlarms` / `getLaunchPayload`。App Groups の設定が必要。**iOS Deployment Target 26.0 以上を要求**(アプリ全体が iOS 26 以上限定になる)。v0.1.x、GitHub スター 29、ボタンのラベル・色のカスタムに既知の不具合。
  - `react-native-nitro-ios-alarm-kit`(Gautham495): Nitro Modules 製。`isAvailable()` で実行時に判定でき、iOS 26 未満や Android では no-op を返す(古い iOS もサポートしたまま使える)。スター 15、Expo の config plugin は未提供(Info.plist は app.json の `ios.infoPlist` で書ける)。
  - ほかに `rn-alarm-kit`(wael-fadlallah)、`react-native-ios-alarmkit`(sauravhiremath)。
  - **成熟度は低い**(どれも個人メンテ、スター数十、v0.x)。本番採用するなら「薄いので自前の Expo Module として持つ」選択肢も現実的だが、Swift を書くことになり、Mac なしでは EAS Build 上でしかコンパイル確認ができない。
  - 【未確認】各ライブラリの SDK 57(RN 0.86)/ SDK 58(iOS 27 の scene-based life cycle)での動作、App Store 審査での扱い(AlarmKit を日程調整アプリが使うことへの審査の反応)。

**Android**

- 【事実】**正確なアラームの権限は 2 種類**。
  - `SCHEDULE_EXACT_ALARM`: Android 14 以降、Android 13(API 33)以上をターゲットにした新規インストールでは**既定で拒否**。ユーザーに設定画面(「アラームとリマインダー」)で許可してもらう必要がある。権限がないまま `setExact` / `setExactAndAllowWhileIdle` / `setAlarmClock` を呼ぶと `SecurityException`。
  - `USE_EXACT_ALARM`(Android 13 以降): インストール時に自動で付与され、ユーザー操作は不要。ただし **Google Play のポリシーで「アラームアプリ、タイマーアプリ、予定の通知を出すカレンダーアプリ」など、正確な時刻の動作がコア機能のアプリに限定**され、Play Console での申告が必要。該当しないアプリは `SCHEDULE_EXACT_ALARM` を使うよう案内されている。
- 【事実】**SDK 58(ベータ)で expo-notifications に `delivery: 'alarmClock'` が追加**される。`AlarmManager.setAlarmClock()` を使う「時刻が重要なアラーム」向けの配送方法で、正確なアラームの権限が要る。権限がないと `bestEffort` 相当にフォールバックする【二次情報: PR の説明】。正確なアラーム権限の確認・要求 API(`getExactAlarmPermissionsAsync` / `requestExactAlarmPermissionsAsync`)を足す PR #50919 は 2026-10-01 時点で未マージ。
- 【事実】**full-screen intent(ロック中に全画面でアラーム画面を出す)**は Android 14 以降、`USE_FULL_SCREEN_INTENT` が特別なアプリアクセス権限になった。**自動で付与されるのは「アラームの設定」か「電話・ビデオ通話の着信」がコア機能のアプリだけ**で、Android 14 以上をターゲットにする場合は Play Console で申告フォームの提出が必要。該当しないアプリは Google Play がインストール時に権限を取り消すので、`NotificationManager#canUseFullScreenIntent()` で確認し、`ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` の設定画面でユーザーに許可してもらう。
- 【事実】**expo-notifications は full-screen intent・フォアグラウンドサービスの直接制御・高度な通知スタイルを公開していない**【二次情報: 比較記事。著者は競合ライブラリのメンテナ】。
- 【事実】**notifee は 2026-04-07 にアーカイブ済み**(最終リリース v9.1.8 は 2024-12。New Architecture 未対応のまま)。Invertase は移行先として **expo-notifications**、またはコミュニティ fork の **`react-native-notify-kit`** を案内している。
  - `react-native-notify-kit`: notifee と API 互換、New Architecture(TurboModules)専用、RN 0.73 以上、Apache-2.0、スター約 214。full-screen intent、AlarmManager ベースの時刻トリガー(既定 `SET_EXACT_AND_ALLOW_WHILE_IDLE`)、フォアグラウンドサービス、iOS の interruption level に対応。Expo の config plugin あり(CNG / development build で使える。Expo Go は不可)。個人メンテの fork である点はリスク。

### 2-3. サーバーからのプッシュ通知

- 【事実】**Expo Push Service**: `https://exp.host/--/api/v2/push/send` に POST。1 リクエスト最大 100 件、1 プロジェクトあたり毎秒 600 件まで。無料。**「ベストエフォート」で SLA はない**。
  - 送信直後に返る「チケット」と、APNs / FCM への配送結果を示す「レシート」(約 15 分後までに取得可能、24 時間で消える)がある。`DeviceNotRegistered` が返ったトークンには送信をやめる。
  - ペイロードの主な項目: `priority: 'high'`、`sound`、`channelId`、`interruptionLevel`(iOS)、`ttl`、`contentAvailable`、`categoryId`。本文は 4096 バイトまで。
  - EAS ダッシュボードで「Enhanced Security」を有効にすると、送信にアクセストークン(`Authorization: Bearer`)が必須になる。
- 【事実】**準備物**
  - iOS: 有料の Apple Developer Program。APNs キー(.p8)は最初の `eas build` 時に EAS CLI が対話で生成・保管してくれる(Mac 不要)。実機は事前にデバイス登録が必要。
  - Android: Firebase プロジェクトを作り、`google-services.json` を app.json の `android.googleServicesFile` に指定(公開識別子のみなのでコミット可)。FCM V1 用のサービスアカウント鍵(JSON)を EAS に登録(`eas credentials` またはダッシュボード。**こちらは秘密情報なのでコミットしない**)。
  - アプリ側は `expo-notifications` と `expo-constants`(`projectId` 取得用)で ExpoPushToken を取り、Supabase のテーブルにユーザーと紐づけて保存する。
- 【事実】**Supabase からの送信**: 公式ガイドの構成は「`notifications` テーブルへの INSERT → Database Webhook → Edge Function → Expo Push API」。Edge Function のシークレット名は `EXPO_ACCESS_TOKEN`。時刻起点の送信は `pg_cron` + `pg_net` で Edge Function を定期的に呼ぶ(項目 3 参照)。FCM を直接叩く構成もガイドにある。
- 【事実】プッシュの到着時刻は保証されない(Android の Doze、端末メーカーの省電力設定、iOS の集中モードなどの影響を受ける)。

### 2-4. Expo Go で動く範囲と development build が必要な範囲

| 機能 | Expo Go | development build |
|---|---|---|
| ローカル通知(時刻指定、繰り返し) | 動く | 動く |
| リモートプッシュ(Android) | **不可**(SDK 53 以降。SDK 55 からはエラーを投げる) | 動く |
| リモートプッシュ(iOS) | ドキュメントに明示の制限なし【未確認】 | 動く |
| カスタム通知音、Android の通知アイコン・色 | 不可(config plugin はビルド時に効く) | 動く |
| Time Sensitive / Critical Alerts の entitlement | 不可 | 動く |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` の宣言 | 不可(Expo Go 自身のマニフェストに依存) | 動く |
| AlarmKit、react-native-notify-kit など独自ネイティブコード | 不可 | 動く |
| バックグラウンドでの通知処理(`registerTaskAsync`) | 【未確認】 | 動く |

- 【事実】Android の development build(デバッグ)では「通知からアプリを起動するとスプラッシュが正しく出ないことがある」既知の問題がある(リリースビルドでは起きない)。
- 【事実】プッシュはエミュレータでも試せる(Google Play services 入りの Android エミュレータ。iOS シミュレータは Mac が必要なので Slotto の開発環境では対象外)。

### 推奨方針

- 【推奨】**「時刻どおりに鳴らす」主役は端末内のローカル通知**にする。ネットワークに依存せず、iOS / Android とも OS が時刻に発火してくれる。サーバーからのプッシュは「予定の追加・変更・キャンセルを端末に知らせてローカル通知を張り直す」「自動実行の結果を届ける」役に回す。
- 【推奨】iOS の 64 件上限に合わせ、**直近の予定だけ(例: 近い順に 40〜50 件)を予約**し、アプリ起動時・フォアグラウンド復帰時・サイレントプッシュ受信時に張り直す。1 予定に「10 分前」と「定刻」の 2 件を使うなら予定 20〜25 件分になる。
- 【推奨】段階的に作る。
  1. **第 1 段階(確実に通る範囲)**: expo-notifications のローカル通知 + カスタム音(30 秒未満)+ iOS は Time Sensitive、Android は重要度 HIGH のチャンネル + `SCHEDULE_EXACT_ALARM`(ユーザーに「アラームとリマインダー」の許可を案内。拒否されても不正確なアラームで動く)。
  2. **第 2 段階(アラームらしさ)**: iOS 26 以降で AlarmKit(消音・集中モードを突破)。Android は SDK 58 の `delivery: 'alarmClock'`。ここで初めて「マナーモードでも鳴る」が実現する。
  3. **第 3 段階(必要なら)**: Android の全画面アラーム(full-screen intent)。`react-native-notify-kit` か自前モジュール + Play Console の申告が要る。
- 【推奨】Android の `USE_EXACT_ALARM` は、Slotto が「予定の通知を出すカレンダーアプリ」に該当すると主張できれば使えるが、**審査で否認されるリスクがある**。最初は `SCHEDULE_EXACT_ALARM` で出し、Play Console の申告内容を確認してから切り替えを検討する。【未確認】日程調整アプリが `USE_EXACT_ALARM` / full-screen intent の申告で通った実例。
- 【推奨】通知チャンネルは最初に設計を固める(例: `event-alarm` = 重要度 HIGH + カスタム音、`event-reminder` = 既定、`automation-result` = 既定)。後から音や重要度を変えられないため。

### 注意点

- iOS の通常の通知(Time Sensitive を含む)は**マナーモードでは音が鳴らない**。「必ず鳴るアラーム」を iOS 25 以前で実現する公式手段は Critical Alerts しかなく、Slotto は対象外と考えるべき。ストアの説明文で「アラーム」と謳う場合は、OS バージョンと設定による制約を明記する。
- AlarmKit はユーザーの許可が必須で、拒否されたら通知にフォールバックする設計が要る。
- Android は端末メーカー独自の省電力機能(アプリの強制停止)で予約済み通知が消えることがある。再起動後の再登録は expo-notifications が `RECEIVE_BOOT_COMPLETED` で対応している。
- 通知の許可は初回起動時にいきなり求めず、予定を最初に登録したタイミングなど理由が伝わる場面で求める(拒否されると再表示できない)。

---

## 3. バックグラウンド実行の制約

### 要点

- 【事実】**アプリが閉じている状態で「決まった時刻にアプリのコードを実行する」ことは、iOS でも Android でも保証されない。**
- 【事実】`expo-background-task`(SDK 53 で登場、`expo-background-fetch` の後継)は Android では WorkManager、iOS では BGTaskScheduler を使う「先送り可能な作業」用の API。公式ドキュメントの記述:
  - Android: 最小間隔は **15 分**。実行タイミングは OS が決める。
  - iOS: 「BGTaskScheduler が最適なタイミングを決める」。バッテリー残量(または充電中)とネットワークが条件。実行は数分可能だが OS がいつでも中断できる。**シミュレータでは動かず実機のみ**。
  - **ユーザーがアプリを終了(kill)するとバックグラウンドタスクは止まり、アプリを再度起動するまで再開しない。** iOS はアプリスイッチャーでスワイプすると完全終了になる。Android の挙動は端末メーカーによって異なる。
  - OS がアプリを止めた場合や端末再起動の場合は再開される。
  - 用途の例として挙げられているのは「データ同期、コンテンツの先読み、アップデート確認」で、時刻指定の実行は想定されていない。
- 【事実】**iOS のサイレントプッシュ(`content-available`)でアプリを起こす方法も保証されない。** 低優先度で送られ、OS が間引く(Apple の目安は 1 時間に 2〜3 通まで)。ユーザーがアプリを強制終了していると届かない。
- 【事実】**iOS では、ローカル通知が発火した瞬間にアプリのコードは走らない**(ユーザーが通知をタップするかボタンを押したときだけアプリが起きる)。AlarmKit の独自ボタン(App Intents)も、ユーザーがボタンを押したときに動く。
- 【事実】Android では正確なアラーム(`AlarmManager`)でアプリのプロセスを起こすこと自体は可能だが、Android 12 以降はバックグラウンドからのフォアグラウンドサービス起動に制限があり、端末メーカーの省電力機能でアプリが止められていると動かない。expo-notifications にはローカル通知の発火時に JS を走らせる公式の仕組みはない【未確認: `react-native-notify-kit` の `onBackgroundEvent` でどこまでできるか】。

### 結論: 「時刻どおりの実行はサーバー、結果はプッシュ通知」が妥当

- 【推奨】**自動実行(登録した API を呼ぶ、AI にタスクを実行させる)はサーバー側で行う。** 根拠:
  1. 端末側は時刻も実行そのものも保証されない(上記)。
  2. iOS と Android で挙動が大きく違い、ユーザーの操作(アプリの終了、省電力設定)で簡単に止まる。
  3. API キーなどの秘密情報を端末に置かずに済む。
  4. Web から登録した自動実行も同じ仕組みで動く(アプリを入れていなくても動く)。
  5. リトライ・実行ログ・重複実行の防止をサーバーで一元管理できる。
- 【推奨】**アプリの役割は「登録・編集の UI」「結果のプッシュ通知の受信」「実行履歴の表示」**。「アプリ限定の機能」にしたい場合は、機能の入口(設定 UI)をアプリだけに置き、実行はサーバーで行う形にする。
- 【推奨】通知・アラームは項目 2 のとおり**端末のローカル通知**で鳴らす(こちらは OS が時刻に発火してくれる)。つまり「鳴らすのは端末、実行するのはサーバー」と役割を分ける。

### サーバー側の実行基盤(Supabase)

- 【事実】**Supabase Cron**(`pg_cron` ベース)は「毎秒から年 1 回まで」のスケジュールでジョブを実行でき、SQL / データベース関数 / HTTP リクエスト(Edge Function の呼び出し、`pg_net` を使用)を呼べる。実行履歴は `cron.job_run_details` に残る。推奨は「同時実行 8 ジョブまで、1 ジョブ 10 分以内」。時刻精度の保証はドキュメントに記載なし。
- 【事実】**Supabase Edge Functions の制限**: 壁時計時間は Free プラン 150 秒 / 有料プラン 400 秒、CPU 時間は 1 リクエスト 2 秒(非同期 I/O の待ち時間は含まない)、リクエストのアイドルタイムアウト 150 秒。`EdgeRuntime.waitUntil()` でレスポンス後も処理を続けられるが、壁時計の上限は延びない。
- 【事実】**Supabase Queues**(`pgmq`)で Postgres 上に永続的なキューを持てる。ただしデッドレターキュー・リトライ上限・失敗時アラートは標準では付かない【二次情報】。
- 【推奨】構成案: 「予定ごとの実行予約テーブル(実行時刻・状態・リトライ回数)」+「Supabase Cron が 1 分ごと(必要なら数十秒ごと)に期限の来た行を拾う」+「Edge Function が実行して結果を保存 → Expo Push で通知」。予定 1 件ごとに cron ジョブを作るのではなく、**ポーリング 1 本でテーブルを見る**形が管理しやすい。
- 【推奨】AI タスクのように長時間かかる処理は、Edge Function の時間制限(150〜400 秒)に収まらない可能性がある。キューに積んで分割実行するか、長時間実行に向いた基盤(Vercel のサーバーレス関数やワークフロー系サービスなど)に逃がす設計を、サーバー側の調査と合わせて決める。

### 注意点

- 【推奨】「登録した API を呼ぶ」機能は、サーバーから任意の URL を叩くことになる。**SSRF 対策**(内部 IP・メタデータエンドポイントの拒否、リダイレクト制限、タイムアウト、レスポンスサイズ上限)、ユーザーの API キーの暗号化保存(Supabase Vault など)、重複実行を防ぐ冪等キー、リトライ方針が必要。
- 【事実】サーバーが時刻どおりに実行しても、**結果のプッシュ通知の到着時刻は保証されない**(Expo Push はベストエフォート)。「実行した時刻」と「通知が届いた時刻」は別物としてアプリ内の履歴に表示する。
- 【未確認】iOS の「ショートカット」アプリのオートメーション(時刻トリガー)から Slotto の App Intent を実行させれば、端末側で時刻起動に近いことができる可能性がある(SDK 58 の `expo-app-intents` はアルファ)。ただしユーザーが自分でオートメーションを組む必要があり、主機能にはできない。
- 【推奨】`expo-background-task` は「アプリを開かなくてもローカル通知の予約を最新に保つ」ための補助(予定の同期と通知の張り直し)としてなら使える。動かなくても困らない位置づけにする。

---

## 4. 認証

(調査中: 項目4)

---

## 5. 端末カレンダーの読み取り(expo-calendar)

(調査中: 項目5)

---

## 6. リンクでアプリを開く(Universal Links / App Links)

(調査中: 項目6)

---

## 7. 課金とストア規約

(調査中: 項目7)

---

## 8. 審査とストア公開

(調査中: 項目8)

---

## 9. Windows だけで iOS アプリを開発・提出する方法

(調査中: 項目9)

---

## 10. UI 実装

(調査中: 項目10)

---

## 参照 URL 一覧

### 1. Expo の現状

- Expo SDK 57 changelog: https://expo.dev/changelog/sdk-57
- Expo SDK 56 changelog: https://expo.dev/changelog/sdk-56
- Expo SDK 55 changelog: https://expo.dev/changelog/sdk-55
- Expo SDK 54 changelog: https://expo.dev/changelog/sdk-54
- Expo SDK 58 Beta changelog: https://expo.dev/changelog/sdk-58-beta
- Expo changelog 一覧: https://expo.dev/changelog
- Expo SDK リファレンス(バージョン対応表): https://docs.expo.dev/versions/latest/
- npm `expo` latest: https://registry.npmjs.org/expo/latest
- Work with monorepos: https://docs.expo.dev/guides/monorepos/
- Expo Router v56(React Navigation からの fork): https://dev.to/expo/expo-router-v56-ships-ssr-and-breaks-free-from-react-navigation-4pfb
- Expo Router SDK 55 → 56 移行ガイド: https://docs.expo.dev/router/migrate/sdk-55-to-56/
- Expo Go and the App Store in May 2026: https://expo.dev/changelog/expo-go-and-app-store-may-2026
- Expo docs の LLM 向け索引: https://docs.expo.dev/llms.txt
- react-native の React バージョン完全一致の問題(Issue): https://github.com/react/react-native/issues/57079
- Expo の React バージョン不一致 Issue: https://github.com/expo/expo/issues/41397
- React 19.2.8 リリース: https://github.com/react/react/releases/tag/v19.2.8
- 【二次情報】The Real Fix for React Native + pnpm: Hoist Everything: https://hackernoon.com/the-real-fix-for-react-native-pnpm-hoist-everything

### 2. 通知とアラーム

- expo-notifications(SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- expo-notifications(unversioned、`delivery: 'alarmClock'` の記載): https://docs.expo.dev/versions/unversioned/sdk/notifications/
- Push notifications setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Sending notifications(Expo Push API): https://docs.expo.dev/push-notifications/sending-notifications/
- FCM V1 credentials: https://docs.expo.dev/push-notifications/fcm-credentials/
- iOS capabilities(EAS Build の自動同期): https://docs.expo.dev/build-reference/ios-capabilities/
- Login now required for running projects in Expo Go(2026-09-03): https://expo.dev/changelog/expo-go-57-login
- Apple: AlarmKit: https://developer.apple.com/documentation/alarmkit (WebFetch では本文を取得できず)
- WWDC25「Wake up to the AlarmKit API」: https://developer.apple.com/videos/play/wwdc2025/230/
- 【二次情報】WWDC25 AlarmKit の解説: https://dev.to/arshtechpro/wwdc-2025-wake-up-to-the-alarmkit-api-ios-26-4e67
- expo-alarm-kit: https://github.com/nickdeupree/expo-alarm-kit
- react-native-nitro-ios-alarm-kit: https://github.com/Gautham495/react-native-nitro-ios-alarm-kit
- rn-alarm-kit: https://github.com/wael-fadlallah/rn-alarm-kit
- Apple: Critical Alerts entitlement の申請フォーム: https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
- 【二次情報】Critical Alerts の承認条件の解説: https://newly.app/how-to/critical-alerts-entitlement
- Apple Developer Forums(64 件上限): https://developer.apple.com/forums/thread/811171
- Android 14: Schedule exact alarms are denied by default: https://developer.android.com/about/versions/14/changes/schedule-exact-alarms
- Google Play: Permissions and APIs that Access Sensitive Information(Exact Alarm / Full-screen intent): https://support.google.com/googleplay/android-developer/answer/16558241
- Google Play: foreground service と full-screen intent の要件: https://support.google.com/googleplay/android-developer/answer/13392821?hl=en
- AOSP: Full-screen intent limits: https://source.android.com/docs/core/permissions/fsi-limits
- expo-notifications の exact alarm 権限 API の PR: https://github.com/expo/expo/pull/50919
- notifee(アーカイブ済み): https://github.com/invertase/notifee
- react-native-notify-kit: https://github.com/marcocrupi/react-native-notify-kit
- 【二次情報】2026 年の通知ライブラリ比較(著者は notify-kit のメンテナ): https://dev.to/marco_crupi/the-best-notification-libraries-for-react-native-in-2026-which-one-should-you-choose-2nje
- Supabase: Sending Push Notifications: https://supabase.com/docs/guides/functions/examples/push-notifications

### 3. バックグラウンド実行の制約

- expo-background-task(SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/background-task/
- Apple: BGTaskScheduler: https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler
- Android: WorkManager: https://developer.android.com/topic/libraries/architecture/workmanager
- Apple Developer Forums(サイレントプッシュは保証されない): https://developer.apple.com/forums/thread/684412
- 【二次情報】Silent Push Notifications in iOS: Opportunities, Not Guarantees: https://mohsinkhan845.medium.com/silent-push-notifications-in-ios-opportunities-not-guarantees-2f18f645b5d5
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase Edge Functions Limits: https://supabase.com/docs/guides/functions/limits
- 【二次情報】Supabase cron jobs(2026): https://crontap.com/guides/supabase-cron-jobs
- 【二次情報】Supabase Queues in Production: https://dev.to/mwiginton/supabase-queues-in-production-dead-letter-queues-retries-and-poison-messages-with-pgmq-28dp

<!-- 参照URL追記位置 -->
