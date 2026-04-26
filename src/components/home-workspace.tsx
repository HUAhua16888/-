"use client";

import Link from "next/link";

const identityRoutes = [
  {
    label: "儿童互动",
    href: "/children",
    icon: "🧒",
    description: "幼儿先选择自己的姓名或号数，再进入幼习宝或闽食成长岛。",
    tone: "bg-cyan-50 text-cyan-950",
  },
  {
    label: "教师辅助",
    href: "/teachers",
    icon: "🧑‍🏫",
    description: "教师先登录账号，再管理花名册、查看互动汇总、生成课程方案。",
    tone: "bg-emerald-50 text-emerald-950",
  },
  {
    label: "家长端",
    href: "/parents",
    icon: "👪",
    description: "家长先使用幼儿账号登录，再查看老师反馈和孩子成长记录。",
    tone: "bg-amber-50 text-amber-950",
  },
];

export function HomeWorkspace() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-128px)] w-full max-w-6xl items-center px-4 py-8 md:px-8">
      <section className="w-full rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_28px_90px_rgba(49,93,104,0.16)] md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-teal-700">童趣成长乐园</p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
              幼儿互动故事与成长网站
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              平台围绕幼儿生活习惯、泉州闽食体验和家园共育记录创设。幼儿在游戏中学习，教师查看互动数据并生成活动方案，家长查看老师反馈和孩子成长变化。
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {identityRoutes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-[1.8rem] p-5 shadow-sm transition hover:-translate-y-0.5 ${item.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold opacity-75">进入身份</p>
                  <h2 className="mt-2 text-2xl font-semibold">{item.label}</h2>
                </div>
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/86 text-3xl shadow-sm"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
              </div>
              <p className="mt-5 min-h-20 text-sm leading-7 opacity-80">{item.description}</p>
              <span className="mt-4 inline-flex rounded-full bg-white/82 px-4 py-2 text-sm font-semibold shadow-sm">
                进入
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
