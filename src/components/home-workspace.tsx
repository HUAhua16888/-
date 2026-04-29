"use client";

import Link from "next/link";

const identityRoutes = [
  {
    label: "儿童互动",
    href: "/children",
    icon: "🧒",
    eyebrow: "给幼儿",
    description: "找小名牌，跟着 AI 正向口令完成一日常规和闽食探味任务。",
    action: "进入儿童互动",
    tone: "border-cyan-100 bg-cyan-50 text-cyan-950",
  },
  {
    label: "教师工作台",
    href: "/teachers",
    icon: "🧑‍🏫",
    eyebrow: "给老师",
    description: "查看 AI 记录与重点线索，生成跟进建议并同步家庭任务。",
    action: "进入教师工作台",
    tone: "border-emerald-100 bg-emerald-50 text-emerald-950",
  },
  {
    label: "家庭延续",
    href: "/parents",
    icon: "👪",
    eyebrow: "给家长",
    description: "查看老师今天的观察，回家做一个小步骤，再反馈一句家庭观察。",
    action: "进入家庭延续",
    tone: "border-amber-100 bg-amber-50 text-amber-950",
  },
];

export function HomeWorkspace() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 md:px-8">
      <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff8df_50%,#e7fbf8_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-teal-700">教育智能体 · AI 成长互动与家园共育平台</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
            幼芽成长智伴
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            用 AI 正向提醒、成长记录和家园同步，陪幼儿练一日生活习惯，也温和认识每日食谱里的闽食与食材。
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {identityRoutes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-[1.5rem] border p-5 shadow-sm transition hover:-translate-y-0.5 ${item.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold opacity-75">{item.eyebrow}</p>
                  <h2 className="mt-2 text-2xl font-semibold">{item.label}</h2>
                </div>
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/86 text-3xl shadow-sm"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
              </div>
              <p className="mt-5 min-h-20 text-sm leading-7 opacity-85">{item.description}</p>
              <span className="mt-5 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                {item.action}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
