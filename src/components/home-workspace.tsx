"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import {
  countUniqueBadges,
  createEmptyGrowthArchive,
  getMiniGameCompletionTotal,
  growthArchiveStorageKey,
  parseGrowthArchive,
  type GrowthArchive,
} from "@/lib/growth-archive";
import { themes, type ThemeId } from "@/lib/site-data";

type DailyPlan = {
  childName: string;
  activeTheme: ThemeId;
  checkedMissions: Record<string, boolean>;
  planDate: string;
};

const homePlanStorageKey = "tongqu-growth-web-home-daily-plan";

const missionBank: Record<
  ThemeId,
  Array<{
    id: string;
    title: string;
    detail: string;
  }>
> = {
  habit: [
    {
      id: "habit-wash",
      title: "洗手步骤排一遍",
      detail: "先打湿，再搓泡泡，最后冲洗擦干。",
    },
    {
      id: "habit-queue",
      title: "排队不拥挤",
      detail: "一个跟着一个走，慢一点也很好。",
    },
    {
      id: "habit-kind",
      title: "说一句礼貌提醒",
      detail: "把“请、谢谢、没关系”放进今天的小任务。",
    },
  ],
  food: [
    {
      id: "food-look",
      title: "看一看餐盘颜色",
      detail: "请孩子说出一种今天看到的颜色。",
    },
    {
      id: "food-smell",
      title: "闻一闻闽食香味",
      detail: "允许只闻一闻，先把感受说出来。",
    },
    {
      id: "food-photo",
      title: "拍一张光盘记录",
      detail: "只拍餐盘或作品，避开孩子正脸和姓名牌。",
    },
  ],
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDailyPlan(): DailyPlan {
  return {
    childName: "",
    activeTheme: "habit",
    checkedMissions: {},
    planDate: getTodayKey(),
  };
}

function parseDailyPlan(raw: string | null): DailyPlan {
  if (!raw) {
    return createDailyPlan();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DailyPlan>;
    const empty = createDailyPlan();
    const activeTheme = parsed.activeTheme === "food" ? "food" : "habit";
    const planDate = typeof parsed.planDate === "string" ? parsed.planDate : empty.planDate;

    return {
      childName: typeof parsed.childName === "string" ? parsed.childName.slice(0, 12) : "",
      activeTheme,
      checkedMissions:
        parsed.checkedMissions && typeof parsed.checkedMissions === "object"
          ? Object.fromEntries(
              Object.entries(parsed.checkedMissions).filter(
                ([key, value]) => typeof key === "string" && typeof value === "boolean",
              ),
            )
          : {},
      planDate,
    };
  } catch {
    return createDailyPlan();
  }
}

function formatLastUpdated(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HomeWorkspace() {
  const [archive, setArchive] = useState<GrowthArchive>(() => createEmptyGrowthArchive());
  const [plan, setPlan] = useState<DailyPlan>(() => createDailyPlan());
  const [hydrated, setHydrated] = useState(false);
  const activeTheme = themes[plan.activeTheme];
  const missions = missionBank[plan.activeTheme];
  const finishedCount = missions.filter((mission) => plan.checkedMissions[mission.id]).length;
  const completionLabel = `${finishedCount}/${missions.length}`;
  const uniqueBadgeCount = countUniqueBadges(archive);
  const totalMiniGames = getMiniGameCompletionTotal(archive);
  const latestBadge = archive.badgeRecords[0];
  const latestReview = archive.mealReviews[0];
  const activeThemeHref = `/adventure?theme=${plan.activeTheme}`;
  const teacherHref = `/teachers?from=mini-game&theme=${plan.activeTheme}`;
  const childDisplayName = plan.childName.trim() || "孩子";
  const nextPrompt = useMemo(() => {
    if (finishedCount === 0) {
      return `${childDisplayName}今天可以先完成一个小任务，再进入互动故事。`;
    }

    if (finishedCount < missions.length) {
      return `${childDisplayName}已经开始了，继续补上剩下的小任务。`;
    }

    return `${childDisplayName}今天的任务已经完成，可以去儿童端点亮勋章。`;
  }, [childDisplayName, finishedCount, missions.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const parsedPlan = parseDailyPlan(window.localStorage.getItem(homePlanStorageKey));
    const todayKey = getTodayKey();
    const normalizedPlan =
      parsedPlan.planDate === todayKey
        ? parsedPlan
        : {
            ...parsedPlan,
            checkedMissions: {},
            planDate: todayKey,
          };

    const restoreHandle = window.setTimeout(() => {
      setPlan(normalizedPlan);
      setArchive(parseGrowthArchive(window.localStorage.getItem(growthArchiveStorageKey)));
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated) {
      return;
    }

    window.localStorage.setItem(homePlanStorageKey, JSON.stringify(plan));
  }, [hydrated, plan]);

  function updateChildName(value: string) {
    setPlan((current) => ({
      ...current,
      childName: value.slice(0, 12),
    }));
  }

  function switchTheme(themeId: ThemeId) {
    setPlan((current) => ({
      ...current,
      activeTheme: themeId,
    }));
  }

  function toggleMission(missionId: string) {
    setPlan((current) => ({
      ...current,
      checkedMissions: {
        ...current.checkedMissions,
        [missionId]: !current.checkedMissions[missionId],
      },
    }));
  }

  function resetToday() {
    setPlan((current) => ({
      ...current,
      checkedMissions: {},
      planDate: getTodayKey(),
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid min-h-[calc(100vh-128px)] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.4rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff5d9_52%,#e5fbfa_100%)] p-6 shadow-[0_28px_90px_rgba(49,93,104,0.16)] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-semibold text-teal-700">今日成长台</p>
              <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
                童趣成长乐园
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                先定一个今日主题，再让孩子完成小任务、进入故事、拍图记录，老师端可以接着生成家园共育话术。
              </p>
            </div>
            <div className="rounded-[1.8rem] bg-white/82 px-5 py-4 text-center shadow-sm">
              <p className="text-xs font-semibold text-slate-500">今日完成</p>
              <p className="mt-1 text-4xl font-semibold text-slate-900">{completionLabel}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <label className="rounded-[1.6rem] bg-white/84 p-4 shadow-sm">
              <span className="text-sm font-semibold text-slate-600">孩子称呼</span>
              <input
                value={plan.childName}
                onChange={(event) => updateChildName(event.target.value)}
                placeholder="可以不填"
                className="mt-3 w-full rounded-[1.1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
              />
            </label>

            <div className="rounded-[1.6rem] bg-white/84 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">今日主题</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.values(themes).map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => switchTheme(theme.id)}
                    className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      plan.activeTheme === theme.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {theme.emoji} {theme.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] bg-white/84 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-700">{activeTheme.label}</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">{activeTheme.headline}</h2>
              </div>
              <button
                onClick={resetToday}
                className="rounded-full bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
              >
                重置今日任务
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {missions.map((mission) => {
                const checked = Boolean(plan.checkedMissions[mission.id]);

                return (
                  <button
                    key={mission.id}
                    onClick={() => toggleMission(mission.id)}
                    className={`flex items-start gap-4 rounded-[1.5rem] px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                      checked ? "bg-emerald-100 text-emerald-900" : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        checked ? "bg-emerald-700 text-white" : "bg-white text-slate-400"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span>
                      <span className="block font-semibold">{mission.title}</span>
                      <span className="mt-1 block text-sm leading-6 opacity-80">{mission.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 rounded-[1.4rem] bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
              {nextPrompt}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={activeThemeHref}
              className="rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              进入儿童互动故事
            </Link>
            <Link
              href={teacherHref}
              className="rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5"
            >
              生成家园共育话术
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[2.4rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
            <p className="text-sm font-semibold text-cyan-700">成长记录</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">这台设备上的真实记录</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] bg-cyan-50 p-4">
                <p className="text-xs font-semibold text-cyan-800">点亮勋章</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{uniqueBadgeCount}</p>
              </div>
              <div className="rounded-[1.6rem] bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800">小游戏完成</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{totalMiniGames}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-[1.6rem] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">最近勋章</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {latestBadge
                    ? `${latestBadge.name}，${formatLastUpdated(latestBadge.earnedAt)} 点亮。`
                    : "还没有点亮勋章，先完成一个故事或小游戏。"}
                </p>
              </div>
              <div className="rounded-[1.6rem] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">最近拍图</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {latestReview
                    ? `${latestReview.plateState}，${latestReview.summary}`
                    : "还没有餐盘照片记录，可以从闽食成长岛上传一张。"}
                </p>
              </div>
            </div>

            <Link
              href="/adventure#growth-archive"
              className="mt-5 inline-flex rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
            >
              查看完整成长记录册
            </Link>
          </div>

          <div className="rounded-[2.4rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
            <p className="text-sm font-semibold text-amber-700">今天马上可做</p>
            <div className="mt-4 grid gap-3">
              {Object.values(themes).map((theme) => (
                <Link
                  key={theme.id}
                  href={`/adventure?theme=${theme.id}`}
                  className="story-card rounded-[1.6rem] bg-white/88 p-4 shadow-sm transition hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-teal-700">{theme.label}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">{theme.choices[0]}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
                      {theme.emoji}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-5">
              <AmbientMusicToggle scene="home" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
