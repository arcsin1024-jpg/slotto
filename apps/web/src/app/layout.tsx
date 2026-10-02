import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { publicEnv } from "@/lib/env";
import "./globals.css";

// 書体は design/README.md のとおり Geist + Noto Sans JP + Geist Mono。
// globals.css で --font-sans / --font-mono に組み立てる
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "500", "600", "700"],
  preload: false,
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: "Slotto | 日程調整をもっとシンプルに",
    template: "%s | Slotto",
  },
  description: "空き時間を共有して、相手に予約してもらう日程調整ツール。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${geist.variable} ${notoSansJp.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
