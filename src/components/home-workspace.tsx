"use client";

import Link from "next/link";

const identityRoutes = [
  {
    label: "儿童互动",
    href: "/children",
    icon: "🧒",
    eyebrow: "给幼儿",
    description: "找小名牌，跟着 AI 正向口令练洗手、喝水、如厕、整理、排队和文明进餐。",
    action: "进入儿童互动",
    tone: "border-cyan-100 bg-cyan-50 text-cyan-950",
    tags: ["一日常规", "AI提醒", "成长记录"],
  },
  {
    label: "教师工作台",
    href: "/teachers",
    icon: "🧑‍🏫",
    eyebrow: "给老师",
    description: "查看 AI 记录与重点线索，生成跟进口令、食育策略和家园同步话术。",
    action: "进入教师工作台",
    tone: "border-emerald-100 bg-emerald-50 text-emerald-950",
    tags: ["AI分析", "跟进建议", "同步家长"],
  },
  {
    label: "家庭延续",
    href: "/parents",
    icon: "👪",
    eyebrow: "给家长",
    description: "查看老师今天的观察，回家做一个小步骤，再反馈一句家庭观察。",
    action: "进入家庭延续",
    tone: "border-amber-100 bg-amber-50 text-amber-950",
    tags: ["老师建议", "居家延续", "反馈观察"],
  },
];

const evidenceSteps = [
  "AI正向提醒",
  "幼儿互动记录",
  "教师分析跟进",
  "家庭一致延续",
  "成效变化沉淀",
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
          <p className="mt-3 max-w-3xl text-2xl leading-tight font-semibold text-slate-900 md:text-3xl">
            幼习宝：幼儿一日生活常规与闽食进餐改善教育智能体
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            针对幼儿喝水、洗手、如厕、整理、排队、文明进餐等常规反复提醒效果不稳定的问题，用 AI 正向口令、互动任务和成长记录帮助孩子自主管理。教师根据 AI 记录及时跟进，并同步家长形成家园一致教育。
          </p>
        </div>

        <div className="mt-6 grid gap-3 rounded-[1.5rem] bg-white/72 p-4 shadow-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">案例主线</p>
            <p className="mt-1 font-semibold text-slate-900">常规提醒 · 进餐改善</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">当前模式</p>
            <p className="mt-1 font-semibold text-slate-900">班级试用模式</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">三端分工</p>
            <p className="mt-1 font-semibold text-slate-900">儿童互动 · 教师工作台 · 家庭延续</p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-white/72 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">教育智能体闭环</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {evidenceSteps.map((step, index) => (
              <span
                key={step}
                className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                {index + 1}. {step}
              </span>
            ))}
          </div>
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
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/72 px-3 py-1 text-xs font-semibold shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
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
