"use client";

import Link from "next/link";

const identityRoutes = [
  {
    label: "儿童互动",
    href: "/children",
    icon: "🧒",
    eyebrow: "给幼儿",
    description: "找小名牌，进入习惯岛和闽食岛，按关卡 HUD 玩完整互动任务。",
    action: "进入互动游戏",
    tone: "border-cyan-100 bg-cyan-50 text-cyan-950",
  },
  {
    label: "教师工作台",
    href: "/teachers",
    icon: "🧑‍🏫",
    eyebrow: "给老师",
    description: "查看 AI 分析、发布任务，并用班级账号同步花名册、游戏记录和家园反馈。",
    action: "进入教师工作台",
    tone: "border-emerald-100 bg-emerald-50 text-emerald-950",
  },
  {
    label: "家庭延续",
    href: "/parents",
    icon: "👪",
    eyebrow: "给家长",
    description: "用家庭绑定码查看孩子内容，完成居家任务后同步回老师端。",
    action: "进入家庭延续",
    tone: "border-amber-100 bg-amber-50 text-amber-950",
  },
];

const supportRoutes = [
  { label: "政策合规说明", href: "/compliance", icon: "📘", description: "五大领域、保教结合、游戏化和防小学化说明。" },
  { label: "隐私与安全说明", href: "/privacy", icon: "🛡️", description: "不拍儿童正脸，不录入敏感信息，正式部署需加密存储。" },
  { label: "参赛材料", href: "/contest", icon: "🏅", description: "案例摘要、教师流程、报告结构和8分钟演示脚本。" },
  { label: "应用证据", href: "/evidence", icon: "📎", description: "真实使用记录占位区，参赛前由教师补充。" },
];

export function HomeWorkspace() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 md:px-8">
      <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff8df_50%,#e7fbf8_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-teal-700">
            幼习宝·闽食成长岛教育智能体
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
            闽食小当家
          </h1>
          <p className="mt-3 text-xl font-semibold text-slate-800 md:text-2xl">
            幼习宝·闽食成长岛教育智能体
          </p>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            “闽食小当家”是面向3-6岁幼儿园场景的教育智能体，围绕幼儿挑食、进餐习惯培养、泉州/南安闽南饮食文化启蒙与家园共育，提供儿童端互动、教师端配置、餐盘观察、好习惯闯关、闽食成长岛和成长记录等功能，帮助教师开展生活化、游戏化、可落地的食育活动。
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/86 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm">
            AI只做辅助；教师审核、修改、确认后再发布或同步。
          </p>
          <p className="mt-3 max-w-3xl rounded-[1.2rem] bg-white/82 px-4 py-3 text-sm leading-7 font-semibold text-slate-700 shadow-sm">
            当前平台仅用于班级范围内测试与展示，不作为全园正式数据系统，也不直接面向所有家长开放。
          </p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {identityRoutes.map((item) => (
            <Link
              key={item.label}
              id={
                item.href === "/children"
                  ? "home-children"
                  : item.href === "/teachers"
                    ? "home-teachers"
                    : "home-parents"
              }
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

        <div className="mt-7 grid gap-3 md:grid-cols-4">
          {supportRoutes.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[1.3rem] bg-white/78 px-4 py-4 shadow-sm transition hover:-translate-y-0.5"
            >
              <p className="text-sm font-semibold text-slate-900">
                <span className="mr-2" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
