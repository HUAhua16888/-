import type { Metadata } from "next";

import { SiteShell } from "@/components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "闽食小当家——幼习宝·闽食成长岛教育智能体",
  description:
    "面向3-6岁幼儿园场景的教育智能体，围绕进餐习惯、闽南食育、好习惯闯关和家园共育开展生活化游戏活动。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "闽食小当家——幼习宝·闽食成长岛教育智能体",
    description:
      "面向3-6岁幼儿园场景的教育智能体，围绕进餐习惯、闽南食育、好习惯闯关和家园共育开展生活化游戏活动。",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full scroll-smooth antialiased"
    >
      <body className="min-h-full flex flex-col">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
