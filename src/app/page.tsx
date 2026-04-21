import Link from "next/link";

import { landingHighlights, miniGameCards } from "@/lib/site-data";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-12 px-4 py-10 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div>
          <div className="inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm">
            成长探险岛正式启航
          </div>
          <h1 className="mt-6 text-5xl leading-tight font-semibold text-slate-900 md:text-7xl">
            童趣成长乐园
            <span className="mt-3 block text-2xl text-slate-700 md:text-3xl">
              会讲故事、会互动、会奖励的儿童 AI 成长网站
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            我们把生活习惯养成和闽南食育故事合并成了一个可对外部署的网站。孩子可以和 AI 角色聊天、点选剧情、体验小游戏，还能听语音播报和生成绘本插图。老师和家长也有单独入口，能快速生成课堂和家园共育内容。
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/adventure"
              className="rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              进入儿童互动故事
            </Link>
            <Link
              href="/teachers"
              className="rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5"
            >
              打开老师辅助页
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {landingHighlights.map((item) => (
              <article
                key={item.title}
                className="rounded-[2rem] bg-white/80 p-5 shadow-[0_16px_50px_rgba(35,88,95,0.12)]"
              >
                <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.8rem] bg-[linear-gradient(180deg,#fff7dc_0%,#e5fbfa_100%)] p-6 shadow-[0_28px_90px_rgba(49,93,104,0.2)]">
          <div className="absolute inset-x-10 top-8 h-24 rounded-full bg-white/55 blur-3xl" />
          <div className="relative rounded-[2.2rem] bg-white/85 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-700">主界面预览</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">会呼吸的故事舞台</h2>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-800">
                V1 可上线版
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="story-card float-slow rounded-[1.8rem] bg-teal-50 p-4">
                <p className="text-sm font-semibold text-teal-700">AI 角色</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  你好呀，我是习惯小星。今天你想先学洗手、喝水，还是帮我整理玩具呢？
                </p>
              </div>
              <div className="story-card float-slower rounded-[1.8rem] bg-orange-50 p-4">
                <p className="text-sm font-semibold text-orange-700">互动方式</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  支持文字、快捷选项、浏览器语音输入和自动语音播报。
                </p>
              </div>
              <div className="story-card float-slow rounded-[1.8rem] bg-sky-50 p-4">
                <p className="text-sm font-semibold text-sky-700">奖励机制</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  完成小游戏后会点亮勋章，孩子会更愿意继续玩和继续学。
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {miniGameCards.map((game) => (
                <div key={game.title} className="rounded-[1.5rem] bg-white p-4 shadow-sm">
                  <p className="font-semibold text-slate-800">{game.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{game.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
