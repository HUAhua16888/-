import Link from "next/link";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import { themes } from "@/lib/site-data";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-7xl items-center gap-8 px-4 py-10 md:px-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <h1 className="text-5xl leading-tight font-semibold text-slate-900 md:text-7xl">
            童趣成长乐园
          </h1>
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

          <div className="mt-8 max-w-md">
            <AmbientMusicToggle scene="home" />
          </div>
        </div>

        <div className="grid gap-5">
          {Object.values(themes).map((theme) => (
            <Link
              key={theme.id}
              href="/adventure"
              className="story-card rounded-[2.4rem] bg-white/88 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)] transition hover:-translate-y-1"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-teal-700">{theme.label}</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">{theme.headline}</h2>
                </div>
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-100 text-3xl">
                  {theme.emoji}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {theme.choices.map((choice) => (
                  <span
                    key={choice}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    {choice}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
