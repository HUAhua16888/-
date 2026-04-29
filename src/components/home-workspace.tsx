"use client";

import Link from "next/link";

import {
  projectDisplayName,
  projectFullName,
  projectOneLine,
  projectPositioning,
} from "@/lib/project-brand";

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

const problemCards = [
  {
    mark: "习",
    title: "习惯提醒反复低效",
    pain: "洗手、喝水、排队、整理等一日常规高频出现，教师重复提醒多，幼儿容易被动接受。",
    solution: "AI 正向口令、儿歌故事和轻量任务，让孩子愿意听、愿意选、愿意做一小步。",
  },
  {
    mark: "食",
    title: "进餐改善缺少温和抓手",
    pain: "陌生食材、挑食和进餐礼仪需要长期陪伴，简单劝尝容易造成压力。",
    solution: "结合每日食谱和泉州本土食材，先看、先闻、认识名字，再选择靠近小步。",
  },
  {
    mark: "家",
    title: "家园沟通碎片化",
    pain: "教师观察、家庭延续和家长反馈常常分散在口头沟通或聊天记录里。",
    solution: "教师确认后同步建议，家长回家完成小任务，反馈回流教师端。",
  },
];

const loopSteps = [
  "幼儿端完成互动任务",
  "教师端查看 AI 观察",
  "教师确认后同步家长",
  "家庭端完成一个小步骤",
  "成效变化留下证据",
];

const evidenceItems = [
  { label: "常规任务", value: "完成次数" },
  { label: "主动参与", value: "互动次数" },
  { label: "闽食观察", value: "靠近小步" },
  { label: "家园延续", value: "反馈/打卡" },
  { label: "教师复盘", value: "跟进建议" },
];

const nextPriorities = [
  "真实后端与园所账号",
  "数据库与角色权限",
  "家长授权与数据删除",
  "视觉模型校准",
  "自动化验收脚本",
];

export function HomeWorkspace() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fffd_0%,#fffaf0_50%,#ffffff_100%)] px-4 py-8 md:px-8">
      <section className="mx-auto grid w-full max-w-7xl gap-7 lg:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.64fr)]">
        <div className="flex min-h-[540px] flex-col justify-center rounded-[2.2rem] bg-white/90 p-6 shadow-[0_22px_70px_rgba(49,93,104,0.12)] md:p-10">
          <p className="text-sm font-semibold text-teal-700">{projectPositioning}</p>
          <h1 className="mt-4 max-w-4xl text-4xl leading-tight font-semibold text-slate-950 md:text-6xl">
            {projectDisplayName}
          </h1>
          <p className="mt-4 max-w-3xl text-xl leading-8 font-semibold text-slate-800">
            {projectFullName}
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{projectOneLine}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: "儿童互动", value: "小名牌 / 语音 / 闯关" },
              { label: "教师跟进", value: "AI 观察 / 生成建议" },
              { label: "家庭延续", value: "绑定码 / 一分钟小任务" },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.3rem] bg-teal-50 px-4 py-4">
                <p className="text-sm font-semibold text-teal-900">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid content-center gap-4">
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

      <section className="mx-auto mt-8 w-full max-w-7xl rounded-[2rem] bg-white/88 p-6 shadow-[0_18px_56px_rgba(49,93,104,0.10)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">应用场景与问题</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">班级日常里的三个难点</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">
            目标不是替代教师，而是把“提醒、记录、跟进、家园延续”变成可执行的教育闭环。
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {problemCards.map((item) => (
            <article key={item.title} className="rounded-[1.6rem] bg-slate-50 px-5 py-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
                {item.mark}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.pain}</p>
              <p className="mt-3 text-sm leading-7 font-semibold text-teal-800">{item.solution}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-8 grid w-full max-w-7xl gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_18px_56px_rgba(15,23,42,0.16)] md:p-8">
          <p className="text-sm font-semibold text-cyan-200">产品总览</p>
          <h2 className="mt-2 text-3xl font-semibold">三端协同闭环</h2>
          <div className="mt-7 grid gap-3">
            {loopSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-4 rounded-[1.2rem] bg-white/8 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-200 text-sm font-semibold text-slate-950">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white/90 p-6 shadow-[0_18px_56px_rgba(49,93,104,0.10)] md:p-8">
          <p className="text-sm font-semibold text-emerald-700">成效证据链</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">可记录、可追踪、可复盘</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {evidenceItems.map((item) => (
              <div key={item.label} className="rounded-[1.2rem] bg-emerald-50 px-4 py-4">
                <p className="text-sm font-semibold text-emerald-900">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-[1.2rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
            从“提醒过”升级为“孩子做过、老师看见、家庭延续、成效留下”。
          </p>
        </div>
      </section>

      <section className="mx-auto mt-8 w-full max-w-7xl rounded-[2rem] bg-white/88 p-6 shadow-[0_18px_56px_rgba(49,93,104,0.10)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-orange-700">项目状态与下一步</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">当前是班级试用 / 参赛演示版</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              核心页面和 AI 接口已上线，当前重点是用本机班级数据跑通三端闭环；正式园所使用前，需要补齐后端账号、权限、审计、备份和授权管理。
            </p>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            v1.2.10 本轮完善
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {nextPriorities.map((item) => (
            <span key={item} className="rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-900">
              {item}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
