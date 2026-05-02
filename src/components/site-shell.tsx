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
    href: "/children",
    label: "儿童互动",
    icon: "🧒",
    shortLabel: "互动",
  },
  {
    href: "/parents",
    label: "家庭延续",
    icon: "👪",
    shortLabel: "家庭",
  },
  {
    href: "/teachers",
    label: "教师工作台",
    icon: "🧑‍🏫",
    shortLabel: "教师",
  },
  {
    href: "/contest",
    label: "参赛说明",
    icon: "🏅",
    shortLabel: "参赛",
  },
];

export function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();
  const visibleNavItems = (() => {
    if (pathname.startsWith("/teachers")) {
      return navItems.filter((item) => item.href === "/" || item.href === "/teachers" || item.href === "/contest");
    }

    if (pathname.startsWith("/parents")) {
      return navItems.filter((item) => item.href === "/" || item.href === "/parents" || item.href === "/contest");
    }

    if (pathname.startsWith("/children") || pathname.startsWith("/adventure")) {
      return navItems.filter((item) => item.href === "/" || item.href === "/children" || item.href === "/contest");
    }

    if (
      pathname.startsWith("/contest") ||
      pathname.startsWith("/compliance") ||
      pathname.startsWith("/privacy") ||
      pathname.startsWith("/evidence")
    ) {
      return navItems.filter((item) => item.href === "/" || item.href === "/contest");
    }

    return navItems;
  })();

  return (
    <div className="min-h-full">
      <div className="pb-24 md:pb-10">{children}</div>

      <nav
        aria-label="桌面身份切换"
        className="fixed right-6 bottom-6 z-50 hidden items-center gap-2 rounded-full bg-white/92 px-2 py-2 shadow-[0_18px_50px_rgba(35,88,95,0.16)] backdrop-blur md:flex"
      >
        {visibleNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (item.href === "/children" && pathname.startsWith("/adventure"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isActive ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"
              }`}
            >
              {item.href === "/"
                ? "🏠 回首页"
                : item.href === "/children"
                  ? "更换小名牌"
                  : item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="fixed inset-x-2 bottom-4 z-50 mx-auto flex max-w-md items-center gap-1 rounded-full bg-white/92 px-1.5 py-2 shadow-[0_18px_50px_rgba(35,88,95,0.18)] backdrop-blur md:hidden">
        {visibleNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (item.href === "/children" && pathname.startsWith("/adventure"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-full px-1 py-2 text-xs font-semibold transition ${
                isActive ? "bg-slate-900 text-white" : "text-slate-700"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="mt-1 max-w-full truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
