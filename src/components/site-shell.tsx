"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SiteSoundIntro } from "@/components/site-sound-intro";

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
    label: "家长端",
    icon: "👪",
    shortLabel: "家长",
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
  const visibleNavItems = (() => {
    if (pathname.startsWith("/teachers")) {
      return navItems.filter((item) => item.href === "/" || item.href === "/teachers");
    }

    if (pathname.startsWith("/parents")) {
      return navItems.filter((item) => item.href === "/" || item.href === "/parents");
    }

    if (pathname.startsWith("/children") || pathname.startsWith("/adventure")) {
      return navItems.filter((item) => item.href === "/" || item.href === "/children");
    }

    return navItems;
  })();

  return (
    <div className="min-h-full">
      <div className="pb-24 md:pb-10">{children}</div>
      <SiteSoundIntro />

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
