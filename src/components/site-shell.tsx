"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SiteShellProps = {
  children: React.ReactNode;
};

const navItems = [
  {
    href: "/",
    label: "首页",
    icon: "🏠",
    shortLabel: "首页",
  },
  {
    href: "/adventure",
    label: "儿童互动",
    icon: "🧒",
    shortLabel: "互动",
  },
  {
    href: "/teachers",
    label: "老师辅助",
    icon: "🧑‍🏫",
    shortLabel: "老师",
  },
];

const pageMetaMap = {
  "/": {
    eyebrow: "产品总览",
    title: "打开就能看懂、玩起来的成长网站",
    description: "少量文字，图卡优先，适合老师、家长和孩子第一次进入就直接开始用。",
  },
  "/adventure": {
    eyebrow: "儿童互动",
    title: "聊天、图卡、小游戏和拍图打卡都在这一页",
    description: "无需登录，本机自动记住勋章、任务记录和闽食拍图打卡历史。",
  },
  "/teachers": {
    eyebrow: "老师辅助",
    title: "把课堂引导、家园沟通和试播入口放到一页里",
    description: "输入一个场景，马上得到老师能直接拿走用的内容草稿。",
  },
} as const;

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/teachers")) {
    return pageMetaMap["/teachers"];
  }

  if (pathname.startsWith("/adventure")) {
    return pageMetaMap["/adventure"];
  }

  return pageMetaMap["/"];
}

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();
  const pageMeta = getPageMeta(pathname);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-50 border-b border-white/60 bg-[rgba(255,252,244,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-full bg-white/85 px-4 py-3 shadow-sm transition hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-lg text-white">
                ✨
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-teal-700 uppercase">
                  童趣成长乐园
                </p>
                <p className="text-sm font-semibold text-slate-900">幼儿互动故事与成长网站</p>
              </div>
            </Link>

            <nav className="hidden flex-wrap items-center gap-3 md:flex">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-slate-900 text-white shadow-lg"
                        : "bg-white/80 text-slate-700 shadow-sm hover:-translate-y-0.5"
                    }`}
                  >
                    {item.icon} {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="rounded-[1.8rem] bg-white/80 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.22em] text-teal-700 uppercase">
                {pageMeta.eyebrow}
              </p>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xl font-semibold text-slate-900 md:text-2xl">{pageMeta.title}</p>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                    {pageMeta.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
                无需登录
              </span>
              <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
                本机自动保存
              </span>
              <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
                手机和平板可用
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="pb-24 md:pb-10">{children}</div>

      <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-full bg-white/92 px-3 py-3 shadow-[0_18px_50px_rgba(35,88,95,0.18)] backdrop-blur md:hidden">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[92px] flex-col items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition ${
                isActive ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="mt-1">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
