/**
 * 画面の文言(日本語)。画面ごとにまとめる。英語を足すときは、同じ形のオブジェクトを用意して切り替える。
 * 画面のデザインが決まったら、文言もここで整える。
 */
export const strings = {
  common: {
    retry: "もう一度",
    save: "保存",
    cancel: "やめる",
    delete: "削除",
    close: "閉じる",
    loadError: "読み込めませんでした",
  },
  signIn: {
    title: "slotto にログイン",
    lead: "Web と同じアカウントでログインします。",
    google: "Google でログイン",
    emailLabel: "メールアドレス",
    emailPlaceholder: "you@example.com",
    sendLink: "ログイン用のリンクを送る",
    sent: (email: string) => `${email} にログイン用のリンクを送りました。この端末でメールを開き、リンクを押してください。`,
    demo: "開発用: デモユーザーでログイン",
    failed: "ログインできませんでした",
  },
  authCallback: {
    working: "ログインしています…",
    failed: "ログインできませんでした",
    back: "ログイン画面に戻る",
  },
  tabs: {
    home: "ホーム",
    calendar: "カレンダー",
    pages: "予約ページ",
    automations: "オートメーション",
    settings: "設定",
  },
  screens: {
    bookings: "予約",
    booking: "予約の詳細",
    event: "予定の詳細",
    import: "予定を選ぶ",
    newAutomation: "オートメーションを作る",
    automation: "オートメーション",
    runs: "実行履歴",
    run: "実行結果",
    connections: "接続先",
    notificationSettings: "通知とアラーム",
    notFound: "ページが見つかりません",
  },
} as const;
