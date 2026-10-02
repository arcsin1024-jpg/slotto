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

### 要点

**Supabase クライアントとセッションの保存先**

- 【事実】Supabase 公式の Expo クイックスタート(現行)は `@supabase/supabase-js` + `react-native-url-polyfill` + `expo-sqlite` を入れ、`import 'expo-sqlite/localStorage/install'` で `localStorage` を用意して `auth.storage: localStorage` に渡す構成。オプションは `autoRefreshToken: true` / `persistSession: true` / `detectSessionInUrl: false`。
- 【事実】環境変数名は公式でも **`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**(Slotto のルール「`ANON_KEY` は使わない」と一致)。
- 【事実】セッション保存先の選択肢

  | 保存先 | 暗号化 | 備考 |
  |---|---|---|
  | `expo-sqlite` の `localStorage`(現行クイックスタート) | なし | 追加設定が少ない |
  | `@react-native-async-storage/async-storage`(チュートリアル) | なし | 従来の定番 |
  | `expo-secure-store` 単体 | あり(Keychain / Keystore) | **2048 バイトを超える値を保存できない**ため、セッション(JWT + リフレッシュトークン)の保存には不向き |
  | `LargeSecureStore` パターン(公式チュートリアルに掲載) | あり | AES-256 の鍵を SecureStore に、暗号化した本体を AsyncStorage に保存。`aes-js` と `react-native-get-random-values` を使う |

- 【事実】Web(Next.js)とアプリは同じ Supabase プロジェクトを向くので、ユーザー・RLS は共通。違いはセッションの持ち方だけ(Web は Cookie、アプリは端末内ストレージのリフレッシュトークン)。

**Google ログイン**

- 【事実】Supabase 公式の推奨はネイティブ方式: 端末で Google の ID トークンを取り、`supabase.auth.signInWithIdToken()` に渡す。ブラウザを開かずに済む。
  - Google Cloud Console で **Web 用クライアント ID に加え、Android 用(SHA-1 フィンガープリントが必要)と iOS 用(Bundle ID)**を作る。Android アプリが使うのは Web 用クライアント ID。
  - Supabase ダッシュボードの Google プロバイダに全クライアント ID を登録(複数あるときは Web 用を先頭に)。**iOS は「Skip nonce check」を有効にする**。
  - Android の SHA-1 は **アップロード鍵と Play App Signing の署名鍵の両方**を登録する(Expo のドキュメント)。片方だけだとストア版でログインできない。
- 【事実】ライブラリは Expo ドキュメントが 2 つ挙げている(優劣の記載なし)。どちらも独自ネイティブコードなので **Expo Go では動かず development build が必要**。
  - `@react-native-google-signin/google-signin`: 広く使われている。**無料版は Google が非推奨にした旧 Android SDK ベース**。Android の Credential Manager 対応は有料版(Universal Sign In。EAS の利用者は無償で使える場合があると記載)。対応範囲は Expo 52〜57 / RN 0.76〜0.87、新旧アーキテクチャ両対応。
  - `react-native-nitro-google-signin`: Credential Manager 対応を無料で含む。【未確認】メンテナンス状況と採用実績。
- 【事実】代替はブラウザ方式: `supabase.auth.signInWithOAuth()` + `expo-web-browser` + ディープリンクで戻す。ネイティブライブラリも SHA-1 の登録も不要で、Web と同じ OAuth 設定を使い回せる。

**Sign in with Apple**

- 【事実】iOS は `expo-apple-authentication`(iOS / tvOS のみ。Android と Web は非対応)で `identityToken` を取り、`signInWithIdToken` に渡す。app.json に `ios.usesAppleSignIn: true`。Supabase 側は Apple プロバイダに **Bundle ID を Client ID として登録**するだけで、OAuth の設定もシークレットの更新も不要。
- 【事実】Web と Android は OAuth 方式になり、Services ID・Team ID・署名鍵(.p8)が要る。**OAuth 方式のクライアントシークレットは 6 か月ごとに再生成が必要**で、忘れるとログインが止まる(Supabase ドキュメントが「重要な保守作業」と明記)。
- 【事実】Apple が氏名を返すのは**初回の認可時だけ**。受け取ったらその場で `updateUser()` などで保存する。
- 【事実】ボタンは `AppleAuthenticationButton` を使い、背景色・角丸を `style` で変えない(Apple のガイドライン)。Expo Go でも動くが、識別子が本番アプリと異なる。実機でテストする。

**Sign in with Apple が必須になる条件(App Store Review Guideline 4.8)**

- 【事実】4.8 の要旨: 第三者・ソーシャルのログイン(Google Sign-In など)で**主アカウント**の作成・認証をするアプリは、同等の選択肢として次の 3 条件を満たす別のログインサービスも提供しなければならない。
  1. 収集するデータを氏名とメールアドレスに限定する
  2. ユーザーがメールアドレスを非公開にできる
  3. 同意なしに広告目的でアプリ内の行動を収集しない
- 【事実】例外(別のログインサービスが不要な場合): 自社のアカウント登録・サインインの仕組み**だけ**を使うアプリ / 教育・企業向けで既存アカウントでのサインインが必須のアプリ / 政府・業界の電子 ID を使うアプリ / 特定の第三者サービスのクライアントアプリ、など。
- 【事実】条文は「Sign in with Apple」を名指ししていないが、3 条件を満たす代表的な手段が Sign in with Apple。Expo のドキュメントも「第三者認証を含むアプリは Apple 認証を提供しなければならない」と書いている。
- 結論: **iOS アプリに Google ログインを載せるなら Sign in with Apple もほぼ必須。メール+パスワード(自社アカウント)だけなら不要。**

### 推奨方針

- 【推奨】iOS アプリのログイン手段は「メール(パスワードまたはマジックリンク)+ Google + Apple」。Android は「メール + Google」(Apple は任意)。
- 【推奨】**Apple でアプリに登録したユーザーが Web でもログインできるよう、Web 側にも Sign in with Apple を実装する**(「Web と同じアカウントで使う」前提のため)。Web の Apple ログインは OAuth 方式で、6 か月ごとのシークレット更新が運用に乗る。カレンダーのリマインダーを自分に入れておく。
- 【推奨】Google ログインは、最初は**ブラウザ方式**(`signInWithOAuth` + `expo-web-browser`)で始めるのが手堅い。Web と設定を共有でき、SHA-1 の登録ミスで詰まらない。体験を上げたくなったらネイティブ方式に切り替える(Supabase 上は同じ Google アイデンティティなのでアカウントは変わらない)。
- 【推奨】セッションの保存は `LargeSecureStore` パターン(暗号化)を採用する。カレンダーや予定という個人情報にアクセスできるトークンなので、平文保存は避けたい。
- 【推奨】Google カレンダー連携(Calendar API のスコープとリフレッシュトークン)は、アプリのログインとは切り離して **Web 側のサーバー OAuth で行う**。アプリのネイティブ Google ログインは「本人確認(ID トークン)」だけに使う。

### 注意点

- 【事実】**アカウントの自動リンク**: Supabase Auth は「確認済みメールアドレスが同じ」アイデンティティを自動で同じユーザーに紐づける(無効化する設定はない)。Google で登録した人が同じメールアドレスの Apple ID でログインすれば同じアカウントになる。
- 【事実】**Apple の「メールを非公開」を選ぶと別アカウントになる**。リレー用アドレス(`@privaterelay.appleid.com`)が渡されるため、Google やメールで作った既存アカウントと一致しない。対策は (a) ログイン後に「既存アカウントと連携」する導線(Supabase の手動リンク `linkIdentity`。ダッシュボードで有効化が必要)、(b) 初回登録時に案内文を出す、のいずれか。【二次情報】Apple のリレーアドレスと既存メールの衝突で `/token` が 500 を返す Issue(supabase/supabase #43895)が報告されている。実装時に現状を確認する。
- 【事実】アカウントを作れるアプリは**アプリ内でアカウント削除**を提供する必要がある(項目 8)。Sign in with Apple を使う場合は削除時に Apple のトークン失効も行う。
- 【未確認】アプリがバックグラウンドにいる間のトークン自動更新の制御(`supabase.auth.startAutoRefresh()` / `stopAutoRefresh()` を AppState に連動させる方法)は supabase-js のリファレンスに記載があるはずだが、今回取得したページでは該当箇所を確認できなかった。
- 【未確認】SDK 56 以降の `expo/fetch`(グローバル fetch の既定)と supabase-js の相性。実機でログイン・リフレッシュ・Realtime を確認する。

---

## 5. 端末カレンダーの読み取り(expo-calendar)

### 要点

- 【事実】`expo-calendar` は SDK 56 で stable に昇格。SDK 57 のドキュメントは**オブジェクト指向の新 API**(`ExpoCalendar` / `ExpoCalendarEvent` など)が標準で、従来の関数 API は `expo-calendar/legacy` から import する(非推奨扱い)。古い記事の `getEventsAsync` などはレガシー側。
- 【事実】**SDK 57 の expo-calendar は Expo Go と Snack では使えない**(「development build を作ること」と明記)。対応プラットフォームは Android と iOS(ドキュメントの表記は「device only」)。
- 【事実】**権限**
  - iOS 17 以降はカレンダーのアクセスが 2 段階: **フルアクセス**(読み取り・作成・削除。`NSCalendarsFullAccessUsageDescription`)と**書き込み専用**(追加のみ。`NSCalendarsWriteOnlyAccessUsageDescription`)。**予定を読むにはフルアクセスが必須**。書き込み専用では既存の予定もカレンダー一覧も読めない(仮想カレンダーが 1 つ返るだけ)。iOS 16 以前は `NSCalendarsUsageDescription`。
  - config plugin の `calendarPermission` が `NSCalendarsUsageDescription` と `NSCalendarsFullAccessUsageDescription` の文言を設定する。`writeOnlyAccess: true` にすると書き込み専用になる(Slotto は読み取りが目的なので使わない)。`remindersPermission` はリマインダー用(Slotto では不要)。
  - Android は `READ_CALENDAR` / `WRITE_CALENDAR`(実行時に許可を求める権限)。
  - システム標準のカレンダー UI を開くだけなら権限は不要(`event.openInCalendar()` など)。
- 【事実】**読み取り API**: `getCalendars()` でカレンダー一覧(`title`、`source`(名前・種別)、`ownerAccount`、`isPrimary`、`accessLevel`、`allowsModifications`、`color`)、`listEvents(calendars, startDate, endDate)` で期間内の予定(`title`、`startDate`、`endDate`、`allDay`、`location`、`notes`、`timeZone`、`recurrenceRule`、`availability`、`status`、主催者、`getAttendees()` で出席者)。
- 【事実】**読めるのは「OS のカレンダーに登録されたアカウント」の予定**。iOS は EventKit、Android は Calendar Provider 経由で、端末に同期済みの iCloud / Google / Exchange(Outlook)の予定をまとめて読める。ただし:
  - iOS: Google や Outlook のアカウントを **iOS の「設定」のカレンダーアカウントに追加**している場合だけ見える。Google カレンダーアプリや Outlook アプリを入れているだけでは EventKit からは見えない【二次情報】。
  - Android: Google アカウントは標準で同期される。Outlook アプリは設定の「カレンダーを同期」をオンにした場合だけ Calendar Provider に出てくる【二次情報】。
- 【事実】同期の鮮度は OS 任せ(EventKit の同期はアプリから即時に強制できないという報告がある)。

### 推奨方針

- 【推奨】**端末カレンダーの読み取りは補助機能と位置づける。** 空き時間の判定など Slotto の中核は、Web 側で連携する Google Calendar API / Microsoft Graph(サーバー間連携)を主にする。端末カレンダーは「サーバー連携していないカレンダー(iCloud、会社の Exchange など)の予定を、ユーザーが選んで取り込む」用途に使う。
- 【推奨】**「選んだ予定だけをサーバーへ送る」設計**
  1. 権限を求める前に、アプリ内の説明画面で「何のために読むか」「読んだ予定は端末内で一覧表示するだけで、選んだものだけを送ること」を伝える。
  2. 読み取り・一覧表示・絞り込みは**端末内だけ**で行う(この時点ではサーバーに何も送らない)。
  3. ユーザーが予定(またはカレンダー単位)を選び、送信内容を確認して「送信」を押したときだけ送る。
  4. 送る項目は最小限にする(開始・終了・終日フラグ・「予定あり」だけで足りるなら、タイトル・場所・メモ・出席者は送らない。タイトルを送るかはユーザーが選べるようにする)。
  5. 取り込んだ予定はアプリ内でいつでも削除でき、アカウント削除時にサーバーからも消える。
- 【推奨】iOS の目的文字列(`NSCalendarsFullAccessUsageDescription`)は具体的に書く。例: 「端末のカレンダーの予定を表示し、あなたが選んだ予定だけを Slotto の空き時間の計算に使います。選んでいない予定は端末の外に送信されません。」曖昧な文言は審査で差し戻される典型例。
- 【推奨】Android は読み取りだけなら `WRITE_CALENDAR` を外したい(`android.blockedPermissions`)。【未確認】`WRITE_CALENDAR` を外した状態で expo-calendar の権限要求 API が正常に動くか(読み書きをまとめて要求する実装だと拒否扱いになる可能性がある)。実機で確認する。

### プライバシー表示(申告)の考え方

- 【事実】**Apple(App Privacy)**: 「収集」の定義は「データを端末の外に送信し、リクエストを処理するのに必要な時間を超えて保持すること」。**端末内だけで処理するデータは申告不要**。Apple のデータ種別に「カレンダー」という項目はなく、サーバーに送って保存する予定データは **「ユーザーコンテンツ > その他のユーザーコンテンツ」** に当たると考えられる。出席者の氏名・メールも送るなら「連絡先」も検討する。アカウントに紐づくので「ユーザーに関連付けられたデータ」、用途は「アプリの機能」。【未確認】カレンダーデータの分類について Apple の明示的な指針は見つけられなかった。
- 【事実】**Google Play(Data safety)**: データの種類に **「カレンダー > カレンダーの予定」**(予定、メモ、出席者など)がある。「収集」は「アプリから端末の外へ送信すること」で、**端末内だけで処理するデータは申告不要**。Slotto は選ばれた予定を送信・保存するので「収集する」「任意(ユーザーが選べる)」「用途: アプリの機能」「転送時に暗号化」「削除を依頼できる」と申告する形になる。
- 【事実】Google Play の User Data ポリシーは、ユーザーの合理的な予想の範囲を超えるデータ収集に「アプリ内の目立つ開示と明示的な同意」を求める(アプリの通常の利用の流れの中に表示し、タップなどの能動的な操作で同意を得る。説明文やウェブサイトだけでは不可)。カレンダーは「個人情報および機密情報」の列挙には名指しされていないが、上記の送信前確認画面を同意画面として作っておけば要件を満たしやすい。
- 【推奨】プライバシーポリシーに「端末カレンダーから読み取る項目」「サーバーに送る項目と条件(ユーザーが選んだものだけ)」「保存期間」「削除方法」を明記し、ストアの申告内容と一致させる。

### 注意点

- 【未確認】繰り返し予定が `listEvents` で各回に展開されて返るか(EventKit と Android の Instances テーブルは期間内の各回を返す仕組みだが、expo-calendar の新 API での挙動は実機で確認する)。
- 【未確認】エミュレータでの動作(ドキュメントは「device only」表記)。Android エミュレータに Google アカウントを入れた状態で確認する。
- 他人(出席者)の氏名・メールアドレスは第三者の個人情報。送らない設計が安全。
- 権限を拒否された場合でも、アプリの他の機能は使えるようにする(権限を必須にしない)。iOS は一度拒否されると再度ダイアログを出せないので、設定アプリへの導線を用意する。

---

## 6. リンクでアプリを開く(Universal Links / App Links)

### 要点

**iOS: Universal Links**

- 【事実】Web サイトの `https://<ドメイン>/.well-known/apple-app-site-association`(AASA。**拡張子なし**)に JSON を置く。`applinks.details` に `appID`(`<Team ID>.<Bundle ID>`)と対象パスを書く。iOS 13 以降は `appIDs`(複数)と `components`(パス・クエリ・フラグメント単位の指定と除外)が使える。`*` はスラッシュやピリオドにはマッチしない。ファイルは非圧縮で 128KB まで。
- 【事実】**HTTPS で配信し、リダイレクトしてはいけない**(301 / 302 は非対応)。
- 【事実】アプリ側は app.json の `ios.associatedDomains` に `"applinks:example.com"` を書く(**`https://` を付けない**。よくある間違い)。entitlement が変わるので**新しいネイティブビルドが必要**(EAS Build が capability を自動同期する)。
- 【事実】**端末は AASA を自分のサーバーから直接取らず、Apple の CDN 経由で取得する**。取得はアプリのインストール時とアップデート時で、その後は頻繁に更新されない。CDN のキャッシュを手動で消す方法はない。Apple の CDN が持っている内容は `https://app-site-association.cdn-apple.com/a/v1/<ドメイン>` で確認できる。開発中は `applinks:example.com?mode=developer` と書くと CDN を通さず直接取得する【二次情報: TN3155 の解説】。
- 【事実】本番で対象パスを変えた場合、ユーザーの端末に反映されるのはアプリ更新時。**最初にパス設計を固める**ことが重要。
- 【事実】Web 側の `<head>` に `<meta name="apple-itunes-app" content="app-id=<App Store の ID>">` を置くと、アプリ未インストールの iOS Safari に Smart App Banner が出る。

**Android: App Links**

- 【事実】`https://<ドメイン>/.well-known/assetlinks.json` に、`relation: ["delegate_permission/common.handle_all_urls"]`、`target.namespace: "android_app"`、`package_name`、`sha256_cert_fingerprints` を書く。**`application/json` で HTTPS 配信**する。
- 【事実】フィンガープリントは**全部の署名鍵の分**を入れる: EAS のビルド用キーストア(`eas credentials -p android` で確認)と、**Play App Signing の署名鍵**(Play Console の「アプリの署名」に Digital Asset Links の JSON スニペットがある)。ストア版は Google が再署名するので、後者が抜けるとストア版だけリンクが効かない。
- 【事実】アプリ側は app.json の `android.intentFilters` に `autoVerify: true`、`data: [{ scheme: "https", host: "...", pathPrefix: "..." }]`、`category: ["BROWSABLE", "DEFAULT"]` を書く。検証はインストール後に行われ、反映まで 20 秒以上かかることがある。

**Next.js のサイトから配信する方法**

- 【二次情報】方法は 2 つ。
  1. `public/.well-known/` に 2 ファイルを置き、`next.config` の `headers()` で `/.well-known/apple-app-site-association` に `Content-Type: application/json` を付ける(拡張子がないため、そのままだと `application/octet-stream` になりダウンロード扱いになる)。
  2. Route Handler(`app/.well-known/apple-app-site-association/route.ts` と `app/.well-known/assetlinks.json/route.ts`)で JSON を返す。環境変数から Team ID やフィンガープリントを組み立てられ、Content-Type も確実。
- 【推奨】Slotto では **Route Handler 方式**。開発用・本番用でアプリ ID やフィンガープリントを切り替えやすい。
- 注意すべき落とし穴:
  - **リダイレクト禁止**。`www` あり / なしの正規化、末尾スラッシュの付け外し、認証ミドルウェアのログインページへの転送、多言語のロケール付与などが `/.well-known/*` にかからないよう除外する。
  - `associatedDomains` / `intentFilters` に書くホスト名は、**実際にリンクとして配る URL のホスト名と完全一致**させる(`slotto.example` と `www.slotto.example` は別物。両方使うなら両方に置く)。
  - Vercel のプレビュー URL は別ドメインなので Universal Links / App Links の対象にならない。

**Expo Router との組み合わせ**

- 【事実】Expo Router は、届いた Universal Link / App Link / カスタムスキームの URL のパスを**そのままファイルベースのルートに当てはめる**。Web の `/events/123` と `src/app/events/[id].tsx` のようにパスを揃えておけば追加実装なしで該当画面が開く。
- 【事実】パスが一致しない URL は `src/app/+native-intent.tsx` の `redirectSystemPath({ path, initial })` で書き換える(`initial` はアプリが閉じた状態からの起動かどうか)。この関数は**アプリのコンテキストの外で動く**ので認証状態は見られない。中で例外を出してはいけない。
- 【事実】ログイン状態による振り分けは、ルートの `_layout` で `usePathname()` などを使って行う。
- 【事実】カスタムスキーム(app.json の `scheme`)は Universal Links と別に必要(OAuth の戻り先、開発中の動作確認など)。現リポジトリの `scheme` は `mobile` のままなので `slotto` などに変える必要がある。

### 推奨方針

- 【推奨】**アプリで開く URL を絞る。** 日程調整サービスでは「予約ページ(ゲストが開く公開 URL)」はアプリを入れていない人が大半で、アプリを入れている主催者自身が確認のために開くこともある。**予約ページは Web のまま**にし、アプリで開くのは主催者向けの URL(例: 予定の詳細、通知メール内の「アプリで開く」リンク、自動実行の結果)に限定する。AASA の `components` と Android の `pathPrefix` で対象パスだけを指定し、予約ページ・認証コールバック・決済ページは除外する。
- 【推奨】アプリで開く専用のパス接頭辞(例: `/app/...` や `/open/...`)を 1 つ決めると、AASA・intentFilters・Expo Router のルートが単純になり、後からパスを足してもアプリ更新を待たずに済む。
- 【推奨】アプリが入っていない場合のフォールバックとして、同じ URL の Web ページ(内容の表示 + ストアへの導線)を必ず用意する。
- 【推奨】アプリ側は `+not-found` を用意し、未対応のパスは Web ブラウザで開き直す。

### 注意点

- Universal Links は「リンクをタップしたとき」に効く。Safari のアドレスバーに直接入力した場合や、同じドメイン内のページ遷移では発火しない。メール内のリンクがトラッキング用 URL に書き換えられている場合も効かないことがある。
- iOS は一度ユーザーが「Safari で開く」を選ぶと、そのドメインはブラウザで開く設定が記憶される。
- 開発ビルドと本番で Bundle ID / パッケージ名を分ける場合は、AASA と assetlinks.json に両方を載せる。
- 検証ツール: Branch の AASA Validator、`adb shell am start -a android.intent.action.VIEW -d "<URL>"`、Apple の技術ノート TN3155。
- 【未確認】Next.js 16(`apps/web` は 16.3.8)での `/.well-known` の Route Handler とミドルウェア除外の具体的な書き方は、web 側の実装時に Next.js 16 のドキュメントで確認する。

---

## 7. 課金とストア規約

### 7-1. App Store の規約(Web でも契約できるサブスクリプションをアプリで扱う場合)

- 【事実】**3.1.1(In-App Purchase)**: アプリ内で機能やコンテンツを解放する(サブスクリプション、プレミアム機能など)には In-App Purchase(IAP)を使わなければならない。ライセンスキーや QR コードなど独自の仕組みで解放してはならない。
- 【事実】**3.1.1(a)(Link to Other Purchase Methods)**: 米国のストアフロントでは、外部購入へのボタン・リンク・誘導が entitlement なしで許される。**それ以外のストアフロントでは、(特定地域の entitlement を使う場合を除き)アプリとメタデータに IAP 以外の購入手段へ誘導するボタン・外部リンク・呼びかけを入れてはならない。**
- 【事実】**3.1.3(Other Purchase Methods)の前文**: この節に該当するアプリは IAP 以外の購入手段を使えるが、(米国ストアフロントと 3.1.1(a)・3.1.3(a) の場合を除き)**アプリ内で IAP 以外の購入方法を勧めてはならない**。アプリの外(メールなど)で案内するのは自由。
- 【事実】**3.1.3(b)(Multiplatform Services)**: 複数プラットフォームで運営するアプリは、他のプラットフォームや Web サイトで取得したコンテンツ・サブスクリプション・機能にユーザーがアクセスすることを許可できる。**ただし、それらがアプリ内でも IAP として購入できることが条件。**
- 【事実】**3.1.3(f)(Free Stand-alone Apps)**: 有料の Web ベースのツール(例: VoIP、クラウドストレージ、メールサービス、Web ホスティング)の単体コンパニオンとして動く無料アプリは、**アプリ内に購入機能がなく、アプリ外での購入への呼びかけもない**なら、IAP を使わなくてよい。
- 【事実】3.1.3(a)(Reader Apps)は雑誌・新聞・書籍・音声・音楽・動画に限られ、日程調整サービスは対象外。
- つまり Slotto が取れる形は次の 3 つ。

  | 形 | 根拠 | アプリ内でできること | 手数料 |
  |---|---|---|---|
  | A. コンパニオン型(アプリでは売らない) | 3.1.3(f) | Web で契約済みのユーザーがログインして使うだけ。価格表示・購入ボタン・「Web でアップグレード」などの誘導は一切置かない | なし(Web 決済の手数料のみ) |
  | B. IAP 併設型 | 3.1.3(b) | アプリ内でも IAP で同じプランを買える。Web で買った人もそのまま使える | Apple の手数料(下記) |
  | C. 日本のストアフロント限定の代替決済・外部リンク | スマホ法対応の entitlement | IAP と並べて、代替決済や Web への購入リンクを出せる | 下記 |

- 【二次情報】3.1.3(f) の条件を満たしていても、「Web で買った有料コンテンツをアプリで使わせている」として 3.1.1 で差し戻される事例が 2025〜2026 年にも報告されている(Apple Developer Forums、RevenueCat のブログ)。審査担当者の判断に幅がある。

### 7-2. 日本のスマホソフトウェア競争促進法(スマホ法)の全面施行後

- 【事実】スマホ法は **2025-12-18 に全面施行**。指定事業者は Apple(OS・アプリストア・ブラウザ)、iTunes 株式会社(アプリストア)、Google(OS・アプリストア・ブラウザ・検索)。
- 【事実】**Apple(日本のストアフロント、iOS 26.2 以降)**。支払い手段は 3 つになった: Apple の IAP / アプリ内の代替決済 / アプリ外オファー(Web で購入させる。リンクあり・なしの両方)。

  | 手段 | 手数料 |
  |---|---|
  | Apple の IAP | コミッション 21%(Small Business Program 参加者・2 年目以降の自動更新サブスクリプションなどは 10%)+ 決済処理手数料 5% |
  | アプリ内の代替決済 | コミッション 21%(同 10%)。決済処理は自前 |
  | アプリ外オファー(タップできるリンクあり) | ストアサービス手数料 15%(同 10%)。**リンクをタップしてから 7 日以内の売上**が対象 |
  | アプリ外オファー(リンクなしの文字による案内) | 手数料なし【二次情報: RevenueCat・Repro の解説。Apple のページ上、コミッションの対象は「リンクのタップから 7 日以内の売上」と書かれている】 |

- 【事実】Apple の条件(公式ページ「Payment options on the App Store in Japan」):
  - 代替決済・アプリ外オファー(リンクの有無を問わず)には **StoreKit External Purchases or Offers Entitlement** が必要(キー `com.apple.developer.storekit.custom-purchase-link.allowed-regions`、値 `jp`)。日本のストアフロントの iPhone(iOS 26.2 以降)でのみ使える。
  - アプリ内の代替決済を出すとき、または Web の購入ページへリンクで誘導するときは、**同じ画面に Apple の IAP も選択肢として出さなければならない**(同等以上に目立たせる。IAP のボタンは黒か白。代替手段を「推奨」に見せる配色は不可)。
  - 代替手段に進む前に**アプリ内の開示シート**(Apple ではなく開発者と取引することの説明)を表示する。`canMakePayments` と `ExternalPurchaseCustomLink.isEligible` を確認してから `showNotice` を出す。
  - **価格や特典は IAP と違ってよい**(同額にする義務はない)。
  - **取引の報告義務**がある(返金・更新を含む全取引を、月末から 15 日以内に毎月報告。iOS 26.4 以降は External Purchase Server API)。
  - App Store の製品ページには、Web での購入や代替決済の情報を書けない。
  - 年齢による制限: 13 歳未満には Web 購入への誘導不可。13〜17 歳はペアレンタルゲートが必要。Kids カテゴリは Web 購入への誘導不可。
  - 代替手段で買ったユーザーのサポート(返金、サブスクリプション管理)は開発者の責任。
- 【事実】**Google Play(日本)**
  - 日本向けの「external payments program」: アプリから自社サイトの決済ページへリンクで誘導できる。条件は、事業者として登録していること、Google Play Billing と**並べて**表示すること、リンク前に行き先と目的を知らせること、専用 API で取引を報告すること。手数料は**リンク後 24 時間以内の購入**に対し、自動更新サブスクリプション 10% / 年間収益 100 万ドルまでの分 10% / その他 20%。**このプログラムは 2027-03-31 で終了予定で、後継の「billing choice program」への登録が案内されている**(日本は 2026-09-30 から登録可能)。
  - **Google Play の新しい手数料体系が日本では 2026-09-30 から適用**: サービス手数料は新規インストール分で都度課金 20%(年間 100 万ドルまでは 10%)、サブスクリプション 10%。Google Play Billing を使う場合は別に**決済手数料 5%**(日本・米国・英国・EEA・豪州)。
  - リンクなしの文字による案内は手数料なし【二次情報】。
- 【二次情報】日経の報道(2026-08)によると、代替決済を使うアプリはまだ少数にとどまる(見出し「代替決済利用わずか 9%」。記事本文は未確認)。

### 7-3. Google Play の課金ポリシー

- 【事実】Payments ポリシー: Play で配信するアプリが、アプリ内の機能やサービス(サブスクリプション、クラウドソフトウェア、業務効率化ソフトウェアなどを含む)への対価を受け取る場合は **Google Play の課金システムを使わなければならない**。物理的な商品・サービスは対象外。
- 【事実】アプリ内から Play 課金以外の支払い方法へ誘導してはならない(WebView、ボタン、リンク、メッセージ、広告など)。例外は対象地域のプログラムに登録した場合。
- 【事実】公式 FAQ: 「**どのアプリも consumption-only(閲覧・利用専用)にできる。有料サービスの一部であってもよい。** たとえばユーザーがアプリを開いてログインし、他の場所で支払ったコンテンツにアクセスできる」。consumption-only とは「アプリ内で何も購入できない」こと。
- 【事実】公式 FAQ: アプリの外(メールなど)で他の購入方法を案内するのは自由。プラットフォーム間で価格を揃える義務はない。
- 結論: **Google Play は「Web で契約、アプリはログインして使うだけ」を明確に認めている**(Apple より条件が緩い)。

### 7-4. RevenueCat + Expo

- 【事実】Expo の公式ガイドが挙げる課金ライブラリは `react-native-purchases`(RevenueCat)と `expo-iap`。どちらも development build が必要。
- 【事実】RevenueCat は `react-native-purchases`(本体)と `react-native-purchases-ui`(ペイウォール、Customer Center)を入れる。API キーは iOS 用と Android 用で別。**Expo Go では自動的にモック(Preview API Mode)に切り替わり、UI の確認だけできる**(実際の購入は不可)。
- 【事実】Web は RevenueCat Billing(Stripe ベース)で扱い、**entitlement(利用権)は iOS / Android / Web で共有できる**(商品は Web とストアで別に設定)。Web では `getProducts` / `purchaseProduct` / `restorePurchases` など一部の操作が使えない。
- 【事実】日本のスマホ法向けに、RevenueCat は Web のチェックアウト画面をホストする「Web Purchase Button」を用意している。
- 【二次情報】料金: 月間の追跡売上(MTR)2,500 ドルまで無料、それを超えた分に 1%。

### 推奨方針

- 【推奨】**第 1 段階は「A. コンパニオン型」で出す。** 契約は Web(Stripe など)だけで行い、アプリには価格表示・購入ボタン・Web の料金ページへのリンク・「Web でアップグレードしてください」といった文言を置かない。Google Play は consumption-only として問題なく、Apple は 3.1.3(f) に当てはめる。課金の実装・ストア手数料・二重課金の問題を避けられ、公開までが最短。
- 【推奨】A 型で出すときの設計上の工夫:
  - アカウント画面には「現在のプラン名」だけを表示し、変更の導線は置かない。プラン変更の案内はメールと Web で行う。
  - **アプリ限定機能(アラーム、自動実行)を「有料プランでしか一切動かない」設計にすると、審査で「アプリ内の機能を外部決済で解放している」と見られやすい。** 無料プランでも回数や件数を絞って使えるようにし、「有料機能の入口」ではなく「サービスのコンパニオン」に見える構成にする。
  - 審査メモ(App Review Notes)に「Web ベースの日程調整ツールの無料コンパニオンアプリで、アプリ内に購入・購入への誘導はない(3.1.3(f))」と書き、審査用のデモアカウント(有料プラン相当)を用意する。
- 【推奨】**差し戻された場合、またはアプリ内で契約させたくなった場合は「B. IAP 併設型」に進む。** RevenueCat(`react-native-purchases`)でストア課金を実装し、Web の Stripe 契約と entitlement を一元化する。Apple の Small Business Program に参加すれば、日本ではコミッション 10% + 決済処理 5%。
- 【推奨】「C. 日本限定の外部リンク」は当面見送る。IAP の併設・開示シート・毎月の取引報告・年齢確認が必要で、手数料もかかる(リンクありで 10〜15%)。売上規模が大きくなってから検討すれば足りる。
- 【推奨】Web と IAP の両方で契約できるようにする場合は、**「誰がどこで契約中か」をサーバーの 1 つのテーブルで管理**し(Stripe と RevenueCat の Webhook で更新)、二重契約を検知してアプリと Web の両方に警告を出す。解約は契約した経路でしかできない(Apple 経由の契約は Apple の設定画面から)。

### 注意点

- 【未確認】日本のストアフロントで「リンクなしの文字による案内」だけを行う場合に、entitlement の申請と IAP の併設が必要かどうか。公式ページは「アプリ外オファーはリンクの有無を問わず entitlement が必要」と書く一方、IAP 併設の義務は「代替決済」と「リンクで誘導する場合」について書いている。実施前に Apple の公式ページを読み直すか、App Review に問い合わせる。
- 【未確認】3.1.3(f) の「Web ベースのツール」に日程調整 SaaS が当たるかの公式見解(例示は VoIP・クラウドストレージ・メール・Web ホスティング)。
- 規約は頻繁に変わる(Google の日本向けプログラムは 2026-09-30 に切り替わったばかり、Apple は iOS 27.2 でシステム提供の開示シートを予定)。実装直前に公式ページを再確認する。
- 米国など他の国で配信する場合はルールが異なる(米国ストアフロントは外部リンクが自由)。まず日本のストアだけで配信するなら、日本のルールだけを見ればよい。

---

## 8. 審査とストア公開

### 8-1. App Store の審査で関係するガイドライン

- 【事実】**4.1 Copycats**
  - (a) 人気アプリをそのまま真似たり、他のアプリの名前や UI を少し変えただけで自分のものとして出したりしてはならない。
  - (b) 他のアプリやサービスになりすますアプリの提出は Developer Code of Conduct 違反で、Developer Program から除名されうる。
  - (c) 許可なく他の開発者のアイコン・ブランド・製品名を、自分のアプリのアイコンや名前に使ってはならない。
- 【事実】**2.3.7**: メタデータ(アプリ名、サブタイトル、キーワードなど)に商標や人気アプリの名前を詰め込んではならない。サブタイトルで他のアプリに言及してはならない。アプリ名は 30 文字まで。
- Slotto への当てはめ: 「日程調整」という機能分野が同じこと自体は問題にならない(同分野のアプリは多数ある)。問題になるのは**名前・アイコン・画面デザイン・文言を TimeRex に似せること**と、**メタデータに「TimeRex」を入れること**(「TimeRex の代替」のような説明文やキーワードも避ける)。独自のブランドと UI にする。
- 【事実】**4.2 Minimum Functionality**: 「Web サイトを包み直しただけ」を超える機能・コンテンツ・UI が必要。4.2.2 は「主にマーケティング素材、Web クリッピング、リンク集」であるアプリを認めない。
- Slotto への当てはめ: WebView で Web 版を表示するだけのアプリは差し戻される可能性が高い。ネイティブの画面で作り、アプリ限定機能(通知・アラーム、端末カレンダー連携、自動実行の管理)を審査メモで明示する。
- 【事実】**5.1.1(v) Account Sign-In**: アカウント作成に対応するアプリは、**アプリ内でアカウント削除**を提供しなければならない。重要なアカウント機能がないなら、ログインなしで使えるようにする。
- 【事実】アカウント削除の要件(Apple の解説ページ。2022-06-30 から適用):
  - 削除の入口はアプリ内で見つけやすい場所に置く(通常はアカウント設定)。
  - **アカウントの記録と関連する個人データを丸ごと削除**する。一時停止・無効化だけでは不十分。
  - Web で手続きを完了させる場合は、**削除ページへ直接リンク**する。電話やメールでの依頼を必須にしてはならない(規制の厳しい業種を除く)。
  - **Sign in with Apple を使うアプリは、REST API でユーザーのトークンを失効させる。**
  - 自動更新サブスクリプション(IAP)がある場合は、「請求は Apple 経由で続くので先に解約を」と案内する。
  - 削除に時間がかかる場合は所要時間を伝え、完了を通知する。法令上保持が必要なデータがあればユーザーに伝える。
  - 本人確認や再確認のステップは入れてよいが、不必要に難しくしてはならない。
- 【事実】**5.1.1(i)**: プライバシーポリシーへのリンクを App Store Connect のメタデータ欄と**アプリ内**の両方に置く。収集するデータ・収集方法・用途、第三者提供先、保持と削除の方針を明記する。
- 【事実】**5.1.1(ii)(iii)(iv)**: 目的文字列は用途を明確かつ完全に書く。コア機能に関係するデータだけにアクセスする。**有料機能を、データへのアクセス許可を条件にしてはならない。** 許可しないユーザーには代替手段を用意する。
- 【事実】**5.1.2(i)**: 個人データを第三者と共有する場合は、**第三者の AI を含めて**共有先を明示し、明示的な許可を得なければならない。プッシュ通知などのシステム機能の有効化を、機能を使う条件にしてはならない。
- Slotto への当てはめ: 「AI にタスクを実行させる」機能で予定の内容などを外部の AI サービスに送るなら、**送信先と送る内容を明示して同意を取る画面**が必要。
- 【事実】**4.5.4**: プッシュ通知をアプリが機能するための必須条件にしてはならない。機密の個人情報を通知で送らない。販促目的の通知は明示的なオプトインが必要。
- Slotto への当てはめ: 自動実行の結果通知に、API のレスポンス全文や個人情報を載せない(「実行が完了しました」程度にして、詳細はアプリ内で表示する)。
- 【事実】**2.1(a)**: ログインがあるアプリは**審査用のデモアカウント**を提出する。プレースホルダの文言や空の URL を残さない。
- 【事実】**2.3.10**: アプリやメタデータに他のモバイルプラットフォーム(Android、Google Play など)の名前・アイコンを入れない。スクリーンショットに Android の画面を使わない。

### 8-2. プライバシーの申告(App Privacy / Data safety)

- カレンダーデータの扱いは項目 5 の「プライバシー表示」を参照。要点だけ再掲:
  - 【事実】両ストアとも「端末の外に送信して保持するデータ」が申告対象。**端末内だけで処理するデータは申告不要**。
  - 【事実】Apple にはカレンダー専用の区分がなく、送信・保存する予定データは「ユーザーコンテンツ > その他のユーザーコンテンツ」が該当候補。Google Play には「カレンダー > カレンダーの予定」の区分がある。
- Slotto で申告が必要になりそうなデータ(【推奨】実装が固まってから最終確認):

  | データ | Apple の区分 | Google Play の区分 | 用途 |
  |---|---|---|---|
  | メールアドレス、氏名 | 連絡先情報 | 個人情報 | アプリの機能、アカウント管理 |
  | ユーザー ID | ID > ユーザー ID | 個人情報 > ユーザー ID | アプリの機能 |
  | 予定データ(選んで送信したもの) | ユーザーコンテンツ > その他 | カレンダー > カレンダーの予定 | アプリの機能 |
  | プッシュ通知トークン | ID > デバイス ID | デバイスまたはその他の ID | アプリの機能 |
  | 購入履歴(IAP を入れる場合) | 購入 | 金融情報 > 購入履歴 | アプリの機能 |
  | クラッシュログ・利用状況(計測 SDK を入れる場合) | 診断 / 使用状況データ | アプリのパフォーマンス / アプリのアクティビティ | 分析 |

- 【事実】Apple: 第三者 SDK(分析、広告、ログインなど)が収集するデータも申告対象。「トラッキング」(第三者データと結びつけた広告利用やデータブローカーへの提供)をしないなら、トラッキングは「なし」。
- 【事実】Google Play: Data safety の内容はプライバシーポリシーと一致させ、常に最新に保つ。アカウント削除は**アプリ内の導線と、アプリ外(Web)から削除を依頼できる導線の両方**が必要。一時的な無効化は削除とみなされない。

### 8-3. 提出時の必須項目(概要)

- App Store(App Store Connect)
  - 【事実】プライバシーポリシー URL(必須)、アプリ内からのリンク(必須)。
  - 【事実】App Privacy の回答、審査用デモアカウント、年齢レーティング(2026-01-31 までに新しい質問票への回答が必要になった新レーティング体系)。
  - 【事実】**2026-04-28 以降、アップロードするビルドは Xcode 26 以降・iOS 26 SDK 以降が必須**。Expo SDK 57 は Xcode 26.4 以上を要求するので、EAS Build の既定イメージで満たせる。
  - サポート URL、スクリーンショット、説明文、カテゴリ、著作権表示、輸出コンプライアンス(暗号化の申告)、価格と配信地域【未確認: 今回は一覧の公式ページを取得していない。App Store Connect の入力画面で確認する】。
  - 【事実】iPad に対応しない設定でも、iPad での表示崩れを理由に差し戻されることがある(Expo のドキュメント)。
  - 【未確認】Privacy Manifest(`PrivacyInfo.xcprivacy`)の要否と app.json の `ios.privacyManifests` の書き方(Expo にガイドがあるが今回は本文未確認)。
  - EU で配信する場合は DSA のトレーダー申告が必要(ユーザー自身が App Store Connect で行う操作)。日本だけで配信するなら EU を配信地域から外す選択もある。
- Google Play(Play Console)
  - 【事実】プライバシーポリシー(Play Console の所定欄とアプリ内の両方)、Data safety、アカウント削除の Web 導線。
  - 【事実】**2026-08-31 以降、新規アプリとアップデートは Android 16(API レベル 36)以上をターゲットにする必要がある**。Expo SDK 57 は targetSdk 36 なので満たす。
  - 【事実】Android 15 以上をターゲットにするアプリは 16KB ページサイズ対応が必要(2025-11-01 から)。【未確認】SDK 57 の既定ビルドと、追加するネイティブライブラリの対応状況。
  - コンテンツのレーティング(質問票)、ターゲットユーザーの年齢、広告の有無、アプリへのアクセス方法(審査用のログイン情報)、ストア掲載情報【未確認: 今回は一覧の公式ページを取得していない】。
  - 正確なアラーム(`USE_EXACT_ALARM`)や full-screen intent を使う場合は、Play Console での申告が別途必要(項目 2)。

### 8-4. Google Play の新規個人開発者アカウントのクローズドテスト要件

- 【事実】**2023-11-13 より後に作成した個人アカウント**は、製品版(production)を公開する前に、**12 人以上のテスターが 14 日間連続でオプトインした状態のクローズドテスト**を実施しなければならない(2024-12-11 に 20 人から 12 人に緩和。2026 年も継続中)。
- 【事実】途中で抜けたテスターは数に入らない。14 日未満で抜けた人、抜けて入り直した人は連続にならない。
- 【事実】条件を満たしたら Play Console の「製品版へのアクセスを申請」から 3 部構成の質問(クローズドテストの内容、アプリの説明、公開準備の状況)に回答する。審査は通常 7 日以内。
- 【事実】**組織(法人)アカウントと、2023-11-13 以前に作った個人アカウントは対象外。**
- 【推奨】Slotto 用の Play Console アカウントがいつ・どの種別で作られたかを最初に確認する。対象なら、**公開予定日の 3〜4 週間前までにクローズドテストを開始**する(12 人の確保 + 14 日 + 申請審査 最大 7 日程度)。テスターは Google アカウントのメールアドレスで招待する。知人で 12 人集まらない場合の段取りを早めに考える。
- 【事実】Android の開発者確認(developer verification)が 2026-09-30 からブラジル・インドネシア・シンガポール・タイで必須になり、2027 年以降に世界へ拡大予定。Play Console で本人確認済みなら追加対応は小さい見込み【二次情報】。

### 推奨方針

- 【推奨】審査で止まりやすい順に先回りする: (1) アプリ内アカウント削除(Sign in with Apple のトークン失効を含む)、(2) Sign in with Apple(Google ログインを載せる場合)、(3) 目的文字列とプライバシーポリシーの具体性、(4) 審査用デモアカウントと審査メモ、(5) 課金の導線(項目 7)。
- 【推奨】アカウント削除は Web とアプリで同じサーバー処理(Supabase の Edge Function など)を呼ぶ。削除対象は認証ユーザー、プロフィール、予定、取り込んだカレンダーデータ、プッシュトークン、自動実行の設定と履歴、外部連携のトークン。Web にも削除ページを置けば Google Play の「アプリ外からの削除依頼」要件も満たせる。
- 【推奨】審査メモに「通知・アラーム機能の確認手順」「自動実行はサーバー側で動くこと」「AI に送るデータと同意画面の場所」を書く。審査担当者が時刻を待たずに確認できるよう、1〜2 分後に鳴る予定を作れるようにしておく。

### 注意点

- 【未確認】AlarmKit を使うアプリに対する審査上の追加要件(ガイドラインに AlarmKit を名指しした条文は見当たらなかった)。
- ガイドラインの適用には審査担当者による幅がある(Expo のドキュメントも「一貫しないことがある」と注記)。差し戻しを前提にスケジュールに 1〜2 週間の余裕を持つ。
- ストアの説明文・スクリーンショットで「必ず鳴る」「確実に実行」と断言しない(OS の制約があるため、誤解を招く表示として指摘されうる)。

---

## 9. Windows だけで iOS アプリを開発・提出する方法

### 要点

- 【事実】**Mac がなくても iOS アプリのビルド・実機テスト・ストア提出はできる。** ビルドは EAS Build(クラウドの macOS)、提出は EAS Submit が行う。Expo のドキュメントに「EAS Submit は macOS・Linux・Windows で動くので、iOS ビルドの出荷に Mac は不要」と明記されている。
- 【事実】**できないこと**: iOS シミュレータの実行(macOS のみ)、iOS のローカルビルド(`npx expo run:ios`、Xcode が必要)。iOS の確認は**必ず実機**になる。
- 【事実】**前提**: 有料の Apple Developer Program。iOS の実機ビルドはどの方法でも必須。

### iOS: 実機で development build を動かすまで

1. 【事実】`npx expo install expo-dev-client` を入れ、`apps/mobile` に `eas.json` を作る(development プロファイル: `developmentClient: true`、`distribution: "internal"`)。app.json に `ios.bundleIdentifier` を設定する。
2. 【事実】`eas device:create` で iPhone を登録する(表示される URL / QR を iPhone で開いてプロファイルを入れる)。内部配布は ad hoc プロビジョニングで、**ビルド時点で登録済みの端末だけがインストールできる**。上限は Apple Developer アカウントあたり年間 iPhone 100 台。端末を追加したら再ビルドするか `eas build:resign` で再署名する。
3. 【事実】`eas build --platform ios --profile development` を実行する。対話の中で Apple アカウントにログインすると、**配布用証明書・プロビジョニングプロファイル・APNs キーを EAS が生成して保管**する(Mac のキーチェーン操作は不要)。
4. 【事実】ビルド完了後、QR コードかリンクから iPhone にインストールする。iOS 16 以降は端末側で「デベロッパモード」を有効にする必要がある。
5. 【事実】Windows で `npx expo start` を実行し、iPhone の development build から接続する(同じネットワーク、または `--tunnel`)。JS の変更は即時に反映される。
6. 【事実】**ネイティブ側が変わったとき(ネイティブコードを含むライブラリの追加、app.json の plugin や権限の変更、SDK の更新)だけ再ビルドが必要。**

### iOS: TestFlight と App Store への提出

- 【事実】`eas build --platform ios --profile production` で本番ビルドを作り、`eas submit --platform ios` で App Store Connect にアップロードする(`eas build --platform ios --auto-submit` で一括も可)。
- 【事実】認証は App Store Connect API キー(`ascApiKeyPath` / `ascApiKeyIssuerId` / `ascApiKeyId`)か、Apple ID + アプリ用パスワード。`eas.json` の submit プロファイルに `ascAppId` を書く。
- 【事実】アップロード後 10〜15 分ほどの処理を経て TestFlight に現れる。**App Store の審査への提出は App Store Connect の画面で手動で行う。**
- 【未確認】ユーザーの環境に設定済みの App Store Connect API キー(App Manager ロール)を EAS Submit にそのまま使えるか(EAS Submit が要求するロール)。
- TestFlight の内部テスター(審査なし)と外部テスター(Beta App Review あり)の人数上限などの詳細は【未確認: 今回は公式ページを取得していない】。

### Android: 手元のエミュレータ / 実機で動かす

- 【事実】方法は 2 つ。
  - **ローカルビルド**: `npx expo run:android`(エミュレータ)/ `npx expo run:android --device`(USB 接続の実機)。Android Studio(Android SDK、JDK)が必要。ビルド回数の制限がなく速い。
  - **EAS Build**: `eas build --platform android --profile development` で APK を作り、エミュレータか実機にインストールする。
- 【事実】プッシュ通知を試すエミュレータは Google Play services 入りのイメージを使う。
- 【事実】Google Play への提出は `eas submit --platform android`(Google のサービスアカウント鍵が必要。【未確認】初回だけ Play Console から手動アップロードが必要という制約の現状)。
- 【二次情報】**Windows の 260 文字パス制限に注意。** New Architecture の Android ビルドは CMake / Ninja が深いパスを生成し、「Filename longer than 260 characters」や「build.ninja still dirty」で失敗する報告が多い(Expo の Issue #36274 ほか)。pnpm の isolated 構成(`.pnpm` 配下の長いパス)では特に起きやすい。対策は、リポジトリを浅いパスに置く(現在の `C:\Users\81703\slotto` は短い)、**hoisted のままにする**、Windows の長いパスを有効化する(システム設定の変更なのでユーザー自身が判断・実施)。

### EAS の料金と制限

- 【事実】Free プラン: **月に Android 15 回 + iOS 15 回のビルド**、低優先度キュー、同時実行 1、ビルドのタイムアウト 45 分、EAS Update は月間 1,000 MAU まで、EAS Submit は利用可、Workflows 60 分。
- 【事実】Starter プラン(月 19 ドル): 45 ドル分のビルドクレジット、高優先度キュー、タイムアウト 2 時間、EAS Update 3,000 MAU。従量単価は Android medium 1 ドル / large 2 ドル、iOS medium 2 ドル / large 4 ドル。
- 【事実】モノレポでは、**EAS CLI のコマンドはアプリのディレクトリ(`apps/mobile`)で実行**し、`eas.json` もそこに置く。ワークスペースの共有パッケージにビルド工程がある場合は、アプリの `package.json` の `postinstall` でビルドする(公式の例)。TypeScript ソースをそのまま参照する共有パッケージなら不要。

### 推奨方針

- 【推奨】**日常の開発は Android(ローカルビルド + エミュレータ / 実機)で回し、iOS は節目ごとに EAS Build で実機確認する。** iOS のビルドは Free プランで月 15 回なので、ネイティブ構成(入れるライブラリ、plugin、権限、entitlement)を早めに固めて再ビルドの回数を減らす。JS だけの変更は再ビルド不要。
- 【推奨】iOS 固有の機能(Time Sensitive 通知、Sign in with Apple、Universal Links、AlarmKit、カレンダーのフルアクセス)は**実機でしか確認できない**ので、検証用の iPhone を 1 台確保する(AlarmKit を試すなら iOS 26 以降)。
- 【推奨】最初の 1 回は「何も足していない雛形のまま development build を作って実機に入れる」ところまで通し、Apple Developer・証明書・端末登録の一連が動くことを先に確認する。
- 【推奨】ビルドが増えてきたら Starter プラン(月 19 ドル)を検討する。低優先度キューの待ち時間がなくなる。

### 注意点

- iOS のネイティブクラッシュやビルドエラーは、Xcode なしでは EAS のビルドログと実機の挙動から追うことになる。Swift を書く独自モジュール(AlarmKit の自前実装、Widget Extension)は試行錯誤のコストが高い。
- App Store 用のスクリーンショットはシミュレータで撮れないので、実機で撮るか画像として作る。【未確認】現在必須のスクリーンショットサイズ。
- Apple アカウントの 2 要素認証の確認コードは、対話ビルドのたびに求められることがある。CI で回すなら App Store Connect API キーを使う。
- 【未確認】`eas build --local`(ローカルで EAS のビルドを走らせる機能)は Windows では使えないとされる(macOS / Linux のみ)。Android のローカルビルドは `npx expo run:android` を使う。
- SDK 57 から `expo prebuild` は既定で `android/` / `ios/` を消して再生成する。ネイティブディレクトリを手で編集しない(config plugin で設定する)。

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

### 4. 認証

- Supabase: Expo React Native クイックスタート: https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
- Supabase: Expo React Native チュートリアル(LargeSecureStore): https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- Supabase: Use Supabase Auth with React Native: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase: Login with Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase: Login with Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Expo: Using Google authentication: https://docs.expo.dev/guides/google-authentication/
- Expo: AppleAuthentication(SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/
- React Native Google Sign In(無料版と有料版の違い): https://react-native-google-signin.github.io/docs/install
- App Store Review Guidelines(4.8 / 5.1.1(v)): https://developer.apple.com/app-store/review/guidelines/
- 【二次情報】Apple リレーメールの衝突 Issue: https://github.com/supabase/supabase/issues/43895

### 5. 端末カレンダーの読み取り

- expo-calendar(SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/calendar/
- Apple TN3152: Migrating to the latest Calendar access levels(フォーラムスレッド): https://developer.apple.com/forums/thread/730980
- expo-calendar の iOS フルアクセス関連 PR: https://github.com/expo/expo/pull/48186
- Apple Developer Forums(EventKit の同期は即時に強制できない): https://developer.apple.com/forums/thread/766375
- Google カレンダーヘルプ(iPhone / iPad との同期): https://support.google.com/calendar/answer/151674?hl=en&co=GENIE.Platform%3DiOS
- Apple: App Privacy Details(データ種別と「収集」の定義): https://developer.apple.com/app-store/app-privacy-details/
- Google Play: Data safety セクションの入力: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Google Play: User Data ポリシー: https://support.google.com/googleplay/android-developer/answer/10144311

### 6. リンクでアプリを開く

- Expo: iOS Universal Links: https://docs.expo.dev/linking/ios-universal-links/
- Expo: Android App Links: https://docs.expo.dev/linking/android-app-links/
- Expo Router: Native intent(`+native-intent`): https://docs.expo.dev/router/advanced/native-intent/
- Apple TN3155: Debugging universal links: https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links
- Branch AASA Validator: https://branch.io/resources/aasa-validator/
- 【二次情報】Universal Links のデバッグ解説: https://suho.dev/posts/how-to-troubleshoot-universal-links/
- 【二次情報】Next.js で AASA / assetlinks.json を配信する: https://medium.com/@sshekhar336/how-to-add-apple-app-site-association-and-assetlinks-json-files-in-nextjs-and-reactjs-240efcc92d7f
- 【二次情報】拡張子なしファイルの配信(Next.js Discussion): https://github.com/vercel/next.js/discussions/10648

### 7. 課金とストア規約

- App Store Review Guidelines(3.1.1 / 3.1.1(a) / 3.1.3): https://developer.apple.com/app-store/review/guidelines/
- Apple Newsroom: Apple announces changes to iOS in Japan(2025-12-17): https://www.apple.com/newsroom/2025/12/apple-announces-changes-to-ios-in-japan/
- Apple Developer: Payment options on the App Store in Japan: https://developer.apple.com/support/payment-options-on-the-app-store-in-japan/
- Apple Developer: Changes to iOS in Japan: https://developer.apple.com/support/app-distribution-in-japan/
- 公正取引委員会: スマホソフトウェア競争促進法: https://www.jftc.go.jp/msca/
- Google Play: Payments ポリシー: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play: Understanding Google Play's Payments policy(FAQ): https://support.google.com/googleplay/android-developer/answer/10281818?hl=en
- Google Play: Enrolling in the external payments program(日本): https://support.google.com/googleplay/android-developer/answer/16787536?hl=en
- Google Play: Enrolling in the billing choice program: https://support.google.com/googleplay/android-developer/answer/17161464
- Google Play: Understanding Google Play's lower service fees: https://support.google.com/googleplay/android-developer/answer/16954621?hl=en
- Expo: In-app purchases: https://docs.expo.dev/guides/in-app-purchases/
- RevenueCat: Expo へのインストール: https://www.revenuecat.com/docs/getting-started/installation/expo
- 【二次情報】RevenueCat: スマホ新法でアプリ外決済が解禁: https://www.revenuecat.com/jp/blog/engineering/new-smartphone-law
- 【二次情報】Repro Journal: アプリ外決済手数料の整理: https://repro.io/contents/real-external-payment-guidelines/
- 【二次情報】日本経済新聞: Apple がアプリ外決済に 15% 手数料: https://www.nikkei.com/article/DGXZQOUC1718P0X11C25A2000000/
- 【二次情報】日本経済新聞: 代替決済利用わずか 9%(2026-08、見出しのみ確認): https://www.nikkei.com/article/DGXZQOUC2510C0V20C26A8000000/
- 【二次情報】RevenueCat: The ultimate guide to App Store rejections: https://www.revenuecat.com/blog/growth/the-ultimate-guide-to-app-store-rejections
- 【二次情報】Apple Developer Forums(3.1.1 で差し戻された B2B SaaS の事例): https://developer.apple.com/forums/thread/811018
- 【二次情報】RevenueCat の料金: https://costbench.com/software/subscription-billing/revenuecat/

### 8. 審査とストア公開

- App Store Review Guidelines(2.1 / 2.3.7 / 2.3.10 / 4.1 / 4.2 / 4.5.4 / 5.1.1 / 5.1.2): https://developer.apple.com/app-store/review/guidelines/
- Apple: Offering account deletion in your app: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple TN3194: Sign in with Apple のトークン失効: https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple
- Apple: App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple: Upcoming requirements(SDK 最低要件): https://developer.apple.com/news/upcoming-requirements/
- Expo blog: App Store Connect minimum SDK requirements update: https://expo.dev/blog/app-store-connect-minimum-sdk-26
- Expo: App stores best practices: https://docs.expo.dev/distribution/app-stores/
- Expo: Privacy manifests(今回は本文未確認): https://docs.expo.dev/guides/apple-privacy/
- Google Play: App testing requirements for new personal developer accounts: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- Google Play: User Data ポリシー: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play: Data safety: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Google Play: Target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en
- Android: Support 16 KB page sizes: https://developer.android.com/guide/practices/page-sizes
- Android Developers Blog: developer verification(2026-03): https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html
- 【二次情報】Google Play 12 テスター要件の解説: https://www.choicely.com/blog/google-play-12-tester-rule

### 9. Windows だけで iOS アプリを開発・提出する

- Expo: Create a development build: https://docs.expo.dev/develop/development-builds/create-a-build/
- Expo: Internal distribution: https://docs.expo.dev/build/internal-distribution/
- Expo: Submit to the Apple App Store: https://docs.expo.dev/submit/ios/
- Expo: Submit to the Google Play Store: https://docs.expo.dev/submit/android/
- Expo: TestFlight: https://docs.expo.dev/submit/testflight/
- Expo: Set up EAS Build with a monorepo: https://docs.expo.dev/build-reference/build-with-monorepos/
- Expo: EAS の料金: https://expo.dev/pricing
- 【二次情報】Windows の 260 文字パス問題(Expo Issue): https://github.com/expo/expo/issues/36274
- 【二次情報】pnpm モノレポでの CMake パス長問題: https://github.com/margelo/react-native-worklets-core/issues/274

<!-- 参照URL追記位置 -->
