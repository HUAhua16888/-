import type { Metadata } from "next";

import { SiteShell } from "@/components/site-shell";
import { projectDisplayName, projectFullName, projectPositioning } from "@/lib/project-brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${projectDisplayName}｜教育智能体`,
  description: `${projectFullName}，${projectPositioning}。`,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: `${projectDisplayName}｜教育智能体`,
    description: `${projectFullName}，${projectPositioning}。`,
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
