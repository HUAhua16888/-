import type { Metadata } from "next";

import { SiteShell } from "@/components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "幼芽成长智伴｜幼习宝教育智能体",
  description: "幼习宝一日生活习惯养成 + 闽食成长岛食育改善协同教育智能体，AI 成长互动与家园共育平台。",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "幼芽成长智伴｜幼习宝教育智能体",
    description: "幼习宝一日生活习惯养成 + 闽食成长岛食育改善协同教育智能体，AI 成长互动与家园共育平台。",
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
