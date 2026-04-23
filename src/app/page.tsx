import Link from "next/link";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import {
  demoRouteSteps,
  foodBadgeCards,
  habitSkillCards,
  judgeFocusCards,
  landingHighlights,
  mealPhotoChecklist,
  miniGameCards,
  showcaseHighlights,
  showcaseStats,
} from "@/lib/site-data";

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
            我们把生活习惯养成和闽南食育故事合并成了一个可对外部署的网站。孩子可以和 AI 角色聊天、点选剧情、体验小游戏、上传打卡照片，还能听语音播报和生成绘本插图。
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

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {showcaseStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.8rem] border border-white/60 bg-white/75 px-5 py-4 shadow-[0_16px_40px_rgba(35,88,95,0.08)]"
              >
                <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
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

          <div className="mt-8 max-w-md">
            <AmbientMusicToggle scene="home" />
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
                  支持文字、快捷选项、浏览器语音输入、自动语音播报和拍照打卡入口。
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

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-12 md:px-8 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[2.5rem] bg-white/85 p-6 shadow-[0_20px_70px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">比赛展示亮点</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">为什么这版适合直接展示</h2>
          <div className="mt-6 space-y-4">
            {showcaseHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.6rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_100%)] p-4"
              >
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2.5rem] bg-[linear-gradient(135deg,#dff8f7_0%,#ffffff_55%,#fff4cf_100%)] p-6 shadow-[0_20px_70px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-teal-700">当前体验建议</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">适合你现在的使用方式</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.8rem] bg-white/80 p-5">
              <p className="text-lg font-semibold text-slate-900">给评审和老师看</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                先从首页切到儿童互动页，再点老师辅助页，能最快展示“故事互动 + 教育辅助”这两个价值点。
              </p>
            </div>
            <div className="rounded-[1.8rem] bg-white/80 p-5">
              <p className="text-lg font-semibold text-slate-900">给孩子试玩</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                优先玩快捷选项和小游戏，图片生成放在新章节节点使用，体验会更顺畅，也更容易吸引注意力。
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-16 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2.5rem] bg-white/85 p-6 shadow-[0_20px_70px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-cyan-700">比赛演示路线</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">照着这 3 步讲，最容易讲清楚</h2>
          <div className="mt-6 space-y-4">
            {demoRouteSteps.map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-[1.6rem] bg-[linear-gradient(135deg,#effcfc_0%,#ffffff_100%)] p-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff9e3_0%,#ffffff_60%,#e7fbfa_100%)] p-6 shadow-[0_20px_70px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-teal-700">评审快速看点</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">30 秒能理解的 3 个价值点</h2>
          <div className="mt-6 grid gap-4">
            {judgeFocusCards.map((item) => (
              <div key={item.title} className="rounded-[1.8rem] bg-white/85 p-5">
                <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[2.5rem] bg-white/88 p-6 shadow-[0_20px_70px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">习惯成长岛</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">八大习惯图卡</h2>
            </div>
            <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
              图文结合展示
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {habitSkillCards.map((item) => (
              <div
                key={item.title}
                className="story-card rounded-[1.8rem] bg-[linear-gradient(180deg,#fffdf7_0%,#f8fffe_100%)] p-4 shadow-sm"
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-[1rem] text-2xl ${item.tone}`}
                >
                  {item.icon}
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.hint}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff8e8_0%,#ffffff_56%,#e6fbfa_100%)] p-6 shadow-[0_20px_70px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-700">闽食成长岛</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">闽食勋章 + 拍图打卡</h2>
            </div>
            <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
              适合家园共育
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {foodBadgeCards.map((item) => (
              <div key={item.title} className="rounded-[1.8rem] bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-amber-100 text-2xl">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.9rem] bg-white/82 p-5">
            <p className="text-sm font-semibold text-slate-500">闽食光盘打卡路线</p>
            <div className="mt-4 space-y-3">
              {mealPhotoChecklist.map((item) => (
                <div key={item} className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
