"use client";

import { gameEngineVersion, getGameEngineDefinition } from "@/lib/game-engine-registry";
import type { MiniGameKey } from "@/lib/growth-archive";

type GameEngineStageTone = "teal" | "cyan" | "emerald" | "violet" | "orange" | "amber" | "rose";

const toneStyles: Record<GameEngineStageTone, {
  shell: string;
  playfield: string;
  rail: string;
  fill: string;
  marker: string;
  markerGlow: string;
  chipActive: string;
  chipIdle: string;
  text: string;
  badge: string;
  action: string;
}> = {
  teal: {
    shell: "border-teal-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_50%,#ccfbf1_100%)] text-teal-950",
    playfield: "bg-[radial-gradient(circle_at_20%_20%,#ccfbf1_0%,transparent_32%),linear-gradient(135deg,#f0fdfa_0%,#ecfeff_100%)]",
    rail: "bg-teal-100",
    fill: "bg-teal-500",
    marker: "bg-teal-700 ring-teal-100",
    markerGlow: "bg-teal-300",
    chipActive: "bg-teal-700 text-white",
    chipIdle: "bg-white text-teal-900",
    text: "text-teal-800",
    badge: "bg-teal-100 text-teal-900",
    action: "bg-teal-700 text-white",
  },
  cyan: {
    shell: "border-cyan-200 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_50%,#dff7ff_100%)] text-cyan-950",
    playfield: "bg-[radial-gradient(circle_at_25%_20%,#bae6fd_0%,transparent_34%),linear-gradient(135deg,#f0f9ff_0%,#ecfeff_100%)]",
    rail: "bg-cyan-100",
    fill: "bg-cyan-500",
    marker: "bg-cyan-700 ring-cyan-100",
    markerGlow: "bg-cyan-300",
    chipActive: "bg-cyan-700 text-white",
    chipIdle: "bg-white text-cyan-900",
    text: "text-cyan-800",
    badge: "bg-cyan-100 text-cyan-900",
    action: "bg-cyan-700 text-white",
  },
  emerald: {
    shell: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_52%,#dcfce7_100%)] text-emerald-950",
    playfield: "bg-[radial-gradient(circle_at_24%_18%,#bbf7d0_0%,transparent_34%),linear-gradient(135deg,#f0fdf4_0%,#ecfdf5_100%)]",
    rail: "bg-emerald-100",
    fill: "bg-emerald-500",
    marker: "bg-emerald-700 ring-emerald-100",
    markerGlow: "bg-emerald-300",
    chipActive: "bg-emerald-700 text-white",
    chipIdle: "bg-white text-emerald-900",
    text: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-900",
    action: "bg-emerald-700 text-white",
  },
  violet: {
    shell: "border-violet-200 bg-[linear-gradient(135deg,#f5f3ff_0%,#ffffff_50%,#ede9fe_100%)] text-violet-950",
    playfield: "bg-[radial-gradient(circle_at_24%_18%,#ddd6fe_0%,transparent_34%),linear-gradient(135deg,#faf5ff_0%,#f5f3ff_100%)]",
    rail: "bg-violet-100",
    fill: "bg-violet-500",
    marker: "bg-violet-700 ring-violet-100",
    markerGlow: "bg-violet-300",
    chipActive: "bg-violet-700 text-white",
    chipIdle: "bg-white text-violet-900",
    text: "text-violet-800",
    badge: "bg-violet-100 text-violet-900",
    action: "bg-violet-700 text-white",
  },
  orange: {
    shell: "border-orange-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_50%,#ffedd5_100%)] text-orange-950",
    playfield: "bg-[radial-gradient(circle_at_22%_20%,#fed7aa_0%,transparent_34%),linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)]",
    rail: "bg-orange-100",
    fill: "bg-orange-500",
    marker: "bg-orange-700 ring-orange-100",
    markerGlow: "bg-orange-300",
    chipActive: "bg-orange-700 text-white",
    chipIdle: "bg-white text-orange-900",
    text: "text-orange-800",
    badge: "bg-orange-100 text-orange-900",
    action: "bg-orange-700 text-white",
  },
  amber: {
    shell: "border-amber-200 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_50%,#fef3c7_100%)] text-amber-950",
    playfield: "bg-[radial-gradient(circle_at_22%_20%,#fde68a_0%,transparent_34%),linear-gradient(135deg,#fffbeb_0%,#fff7ed_100%)]",
    rail: "bg-amber-100",
    fill: "bg-amber-500",
    marker: "bg-amber-700 ring-amber-100",
    markerGlow: "bg-amber-300",
    chipActive: "bg-amber-700 text-white",
    chipIdle: "bg-white text-amber-900",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-900",
    action: "bg-amber-700 text-white",
  },
  rose: {
    shell: "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_50%,#ffe4e6_100%)] text-rose-950",
    playfield: "bg-[radial-gradient(circle_at_22%_20%,#fecdd3_0%,transparent_34%),linear-gradient(135deg,#fff1f2_0%,#fff7ed_100%)]",
    rail: "bg-rose-100",
    fill: "bg-rose-500",
    marker: "bg-rose-700 ring-rose-100",
    markerGlow: "bg-rose-300",
    chipActive: "bg-rose-700 text-white",
    chipIdle: "bg-white text-rose-900",
    text: "text-rose-800",
    badge: "bg-rose-100 text-rose-900",
    action: "bg-rose-700 text-white",
  },
};

const verbLabels = {
  choose: "点选",
  sort: "排序",
  speak: "说一句",
  observe: "看一看",
  upload: "放作品",
  match: "配对",
  act: "做一做",
};

function getMechanicVisual(mechanic?: string) {
  const visualMap: Record<string, { icon: string; label: string }> = {
    approachLadder: { icon: "🪜", label: "靠近阶梯" },
    broadcastStage: { icon: "🎙️", label: "播报台" },
    cleanBubble: { icon: "🫧", label: "泡泡顺序" },
    cleanSteps: { icon: "🫧", label: "洗手顺序" },
    clueMatch: { icon: "🧩", label: "线索配对" },
    dailyJudge: { icon: "⭐", label: "常规判断" },
    foodGuess: { icon: "🎁", label: "宝箱猜谜" },
    foodKitchen: { icon: "🍳", label: "料理步骤" },
    foodReporter: { icon: "🎙️", label: "闽食播报" },
    foodTrain: { icon: "🚂", label: "列车到站" },
    queueDistance: { icon: "🚶", label: "安全队列" },
    recipeSteps: { icon: "🍳", label: "步骤台" },
    rhythmActions: { icon: "🥣", label: "节拍动作" },
    stallHunt: { icon: "🏮", label: "摊位寻宝" },
    stallMap: { icon: "🏮", label: "摊位地图" },
    storyCurtain: { icon: "🎭", label: "故事剧场" },
    storyTheater: { icon: "📖", label: "故事小剧场" },
    tableRhythm: { icon: "🥣", label: "进餐节拍" },
    taskCards: { icon: "⭐", label: "图卡任务" },
    tidyReturn: { icon: "🧺", label: "物品回家" },
    toiletRoutine: { icon: "👣", label: "如厕路线" },
    trafficCards: { icon: "🚦", label: "红绿牌" },
    trafficDecision: { icon: "🚦", label: "红绿判断" },
    trainRoute: { icon: "🚂", label: "站点路线" },
    treasureClue: { icon: "🎁", label: "宝箱线索" },
    waterBalance: { icon: "🥤", label: "水杯平衡" },
  };

  return visualMap[mechanic ?? ""] ?? { icon: "⭐", label: "互动任务" };
}

export function GameEngineStage({
  activeStep = 0,
  gameKey,
  instanceMechanic,
  instanceTitle,
  pickedItems = [],
  ruleName,
  stepItems,
  tone = "teal",
}: {
  activeStep?: number;
  gameKey: MiniGameKey;
  instanceMechanic?: string;
  instanceTitle?: string;
  pickedItems?: string[];
  ruleName?: string;
  stepItems?: string[];
  tone?: GameEngineStageTone;
}) {
  const definition = getGameEngineDefinition(gameKey);
  const styles = toneStyles[tone];
  const mechanic = instanceMechanic ?? definition?.mechanic;
  const visual = getMechanicVisual(mechanic);
  const title = instanceTitle ?? definition?.title ?? gameKey;
  const steps = stepItems?.length ? stepItems : definition?.steps.length ? definition.steps : pickedItems;
  const totalSteps = Math.max(1, steps.length);
  const clampedStep = Math.min(totalSteps, Math.max(0, activeStep));
  const progress = totalSteps <= 1 ? (clampedStep > 0 ? 100 : 0) : (clampedStep / totalSteps) * 100;
  const score = Math.round(progress);
  const starCount = progress >= 100 ? 3 : progress >= 67 ? 2 : progress > 0 ? 1 : 0;
  const currentStep = steps[Math.min(clampedStep, totalSteps - 1)] ?? definition?.title ?? "准备开始";
  const verbs = definition?.verbs ?? [];

  return (
    <div
      className={`overflow-hidden rounded-[1.7rem] border p-4 shadow-[0_18px_45px_rgba(15,23,42,0.10)] ${styles.shell}`}
      data-game-engine-version={gameEngineVersion}
      data-game-key={gameKey}
      data-game-mechanic={mechanic}
    >
      <span className="sr-only">游戏小进度</span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${styles.text}`}>现在到这里啦</p>
          <h4 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-950 md:text-xl">
            <span>{visual.icon}</span>
            <span>{title}</span>
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <span className={`rounded-[1rem] px-3 py-2 text-xs font-semibold ${styles.badge}`}>
            第 {Math.min(clampedStep + 1, totalSteps)} / {totalSteps} 步
          </span>
          <span className={`rounded-[1rem] px-3 py-2 text-xs font-semibold ${styles.badge}`}>
            能量 {score}
          </span>
          <span className={`rounded-[1rem] px-3 py-2 text-xs font-semibold ${styles.badge}`}>
            {"★".repeat(starCount)}
            {"☆".repeat(3 - starCount)}
          </span>
        </div>
      </div>

      <div className={`mt-4 rounded-[1.35rem] p-4 ${styles.playfield}`}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${styles.action}`}>
                {visual.label}
              </span>
              {verbs.map((verb) => (
                <span key={`${gameKey}-${verb}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${styles.action}`}>
                  {verbLabels[verb]}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">现在做</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{currentStep}</p>
            {ruleName ? (
              <p className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                {ruleName}
              </p>
            ) : null}
          </div>
          <div className="flex h-24 min-w-32 items-center justify-center rounded-[1.5rem] bg-white/82 shadow-sm">
            <div className="relative h-16 w-28">
              <span className={`absolute left-2 top-8 h-3 w-24 rounded-full ${styles.rail}`} />
              <span
                className={`absolute left-2 top-8 h-3 rounded-full transition-all duration-700 ${styles.fill}`}
                style={{ width: `calc(${progress}% - ${progress > 0 ? "0.25rem" : "0rem"})` }}
              />
              <span
                className={`absolute top-4 h-10 w-10 rounded-full opacity-40 blur-md transition-all duration-700 ${styles.markerGlow}`}
                style={{ left: `calc(${progress}% - 1.25rem)` }}
              />
              <span
                className={`absolute top-4 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ring-4 transition-all duration-700 ${styles.marker} ${
                  clampedStep < totalSteps ? "animate-pulse" : ""
                }`}
                style={{ left: `calc(${progress}% - 1.25rem)` }}
              >
                {clampedStep >= totalSteps ? "✓" : clampedStep + 1}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={`${gameKey}-star-${index}`}
              className={`h-2 rounded-full transition-all duration-500 ${
                index < starCount ? styles.fill : "bg-white/75"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const done = index < clampedStep;
          const picked = pickedItems[index];
          const active = index === clampedStep && clampedStep < totalSteps;

          return (
            <span
              key={`${gameKey}-${step}-${index}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                done ? styles.chipActive : active ? `${styles.chipIdle} ring-2 ring-white` : styles.chipIdle
              }`}
            >
              {done ? "✓ " : ""}
              {index + 1}. {picked || step}
            </span>
          );
        })}
      </div>
    </div>
  );
}
