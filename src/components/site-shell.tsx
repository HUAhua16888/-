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

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-50 border-b border-white/60 bg-[rgba(255,252,244,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
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
