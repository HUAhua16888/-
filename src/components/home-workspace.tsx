"use client";

import Link from "next/link";

const identityRoutes = [
  {
    label: "儿童互动",
    href: "/children",
    icon: "🧒",
    eyebrow: "给幼儿",
    description: "找小名牌，进入幼习宝或闽食成长岛，听故事、做任务、获得即时鼓励。",
    action: "进入儿童互动",
    tone: "border-cyan-100 bg-cyan-50 text-cyan-950",
    tags: ["小名牌", "互动任务", "即时反馈"],
  },
  {
    label: "教师工作台",
    href: "/teachers",
    icon: "🧑‍🏫",
    eyebrow: "给老师",
    description: "先看幼儿互动记录和重点线索，再生成课堂跟进、鼓励语和家长同步。",
    action: "进入教师工作台",
    tone: "border-emerald-100 bg-emerald-50 text-emerald-950",
    tags: ["重点线索", "跟进方案", "家长同步"],
  },
  {
    label: "家庭延续",
    href: "/parents",
    icon: "👪",
    eyebrow: "给家长",
    description: "查看孩子成长记录和老师建议，在家完成一个轻量任务并反馈观察。",
    action: "进入家庭延续",
    tone: "border-amber-100 bg-amber-50 text-amber-950",
    tags: ["成长记录", "家庭任务", "家长反馈"],
  },
];

const evidenceSteps = [
  "儿童互动",
  "生成记录",
  "教师跟进",
  "家庭延续",
  "成效沉淀",
];

export function HomeWorkspace() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 md:px-8">
      <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff8df_50%,#e7fbf8_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-teal-700">幼芽成长智伴</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
            AI 成长互动与家园共育平台
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            围绕幼儿生活习惯、阅读表达和泉州闽食探索，把儿童互动、教师跟进和家庭延续放在同一条成长记录里。
            当前适合班级小范围试用，后续可扩展为园所统一管理模式。
          </p>
        </div>

        <div className="mt-6 grid gap-3 rounded-[1.5rem] bg-white/72 p-4 shadow-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">核心主题</p>
            <p className="mt-1 font-semibold text-slate-900">幼习宝 · 闽食成长岛</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">当前模式</p>
            <p className="mt-1 font-semibold text-slate-900">班级试用模式</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">三端分工</p>
            <p className="mt-1 font-semibold text-slate-900">幼儿互动 · 老师跟进 · 家长延续</p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-white/72 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">成效证据链</p>
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
