"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { GameEngineStage } from "@/components/game-engine-stage";
import { SectionDirectory, type SectionDirectoryItem } from "@/components/section-directory";
import { getAccountSyncDeviceInfo } from "@/lib/account-sync-client";
import { findChildIdentitySuggestions, formatChildLabel } from "@/lib/child-identity";
import {
  getFoodDishShortIntro as getCatalogFoodDishShortIntro,
  getFoodIngredientNames,
  resolveSafeFoodImage,
  type FoodImageScene,
  type FoodImageResolution,
  type SafeFoodImageCandidate,
  type SafeFoodImageResolution,
} from "@/lib/food-image-catalog";
import { buildFoodNutritionIntro, buildIngredientNutritionIntro } from "@/lib/food-nutrition";
import {
  defaultGameContentConfigs,
  gameContentConfigStorageKey,
  getGameContentConfig,
  parseGameContentConfigs,
  type EditableGameContent,
} from "@/lib/game-content-config";
import { recordGameEngineAttempt } from "@/lib/game-engine-client";
import {
  parseVideoLibrary,
  videoLibraryStorageKey,
  type TeacherVideoResource,
} from "@/lib/video-library";
import {
  childRosterStorageKey,
  countUniqueBadges,
  createEmptyGrowthArchive,
  getBadgeLevelSummary,
  getMiniGameCompletionTotal,
  growthArchiveStorageKey,
  parseChildRoster,
  parseGrowthArchive,
  recordBadge,
  recordFoodPreference,
  recordMealReview,
  recordMiniGameCompletion,
  recordThemeVisit,
  selectedChildStorageKey,
  type ChildProfile,
  type ChildRecordFields,
  type FoodPreferenceRecord,
  type GrowthArchive,
  type MiniGameKey,
  type MiniGameRecord,
} from "@/lib/growth-archive";
import { getFoodPreferenceFollowUp } from "@/lib/parent-sync";
import {
  habitTemplatesStorageKey,
  parseHabitTemplates,
  parseTeacherPictureBooks,
  teacherPictureBooksStorageKey,
  type HabitCheckinTemplate,
  type TeacherPictureBook,
} from "@/lib/teacher-published-content";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  buildTodayMenuSpeech,
  dailyMenuOverrideStorageKey,
  formatMenuDate,
  getEffectiveMenuForDate,
  getLocalDateKey,
  getWeekdayLabel,
  parseDailyMenuOverrides,
  parseWeeklyMenuEntries,
  weeklyMenuStorageKey,
  type MenuMediaSource,
  type MenuObservationImage,
  type WeeklyMenuEntry,
} from "@/lib/weekly-menu";
import {
  foodBadgeCards,
  foodGuessRounds,
  foodKitchenRecipes,
  foodReporterFoods,
  foodPreferenceApproachSteps,
  foodPreferenceReasons,
  foodTrainStations,
  habitTrafficLightCards,
  habitSkillCards,
  mealMannerActions,
  mealPhotoChecklist,
  minnanFoodClues,
  minnanFoodObserveSteps,
  rewardStickerCards,
  storyMissionMap,
  themeVideoCards,
  themes,
  type ThemeId,
} from "@/lib/site-data";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoryApiResponse = {
  reply?: string;
  choices?: string[];
  source?: "ai" | "template";
  fallbackUsed?: boolean;
};

type FoodKitchenRecipe = (typeof foodKitchenRecipes)[number];

type HabitStoryMission = {
  topic: string;
  title: string;
  storyText: string;
  question: string;
  answerCards: string[];
  habitTask: string;
  feedback: string;
};

const habitChildDirectoryItems: SectionDirectoryItem[] = [
  {
    label: "今日状态",
    description: "看任务、勋章和播报。",
    href: "#child-status",
    icon: "🏷️",
    tone: "bg-teal-50 text-teal-950",
  },
  {
    label: "好习惯闯关",
    description: "6关点图卡。",
    href: "#habit-challenge",
    icon: "🏅",
    tone: "bg-cyan-50 text-cyan-950",
  },
  {
    label: "习惯故事小剧场",
    description: "找绘本、听绘本、读完打卡。",
    href: "#habit-story",
    icon: "📖",
    tone: "bg-violet-50 text-violet-950",
  },
  {
    label: "对老师说",
    description: "说想法。",
    href: "#habit-talk",
    icon: "🗣️",
    tone: "bg-emerald-50 text-emerald-950",
  },
  {
    label: "老师给我的任务",
    description: "练本周重点。",
    href: "#habit-template",
    icon: "⭐",
    tone: "bg-orange-50 text-orange-950",
  },
];

const foodChildDirectoryItems: SectionDirectoryItem[] = [
  {
    label: "今日食谱",
    description: "听今天吃什么。",
    href: "#food-menu",
    icon: "🍱",
    tone: "bg-cyan-50 text-cyan-950",
  },
  {
    label: "闽食小列车",
    description: "听站名找美食。",
    href: "#food-train",
    icon: "🚂",
    tone: "bg-teal-50 text-teal-950",
  },
  {
    label: "泉州美食摊位寻宝",
    description: "找摊位和食材。",
    href: "#food-stall",
    icon: "🏮",
    tone: "bg-amber-50 text-amber-950",
  },
  {
    label: "美食观察与靠近一点点",
    description: "先认识再靠近。",
    href: "#food-observation-card",
    icon: "🔍",
    tone: "bg-emerald-50 text-emerald-950",
  },
  {
    label: "泉州小厨房",
    description: "菜名变步骤。",
    href: "#food-kitchen",
    icon: "👩‍🍳",
    tone: "bg-orange-50 text-orange-950",
  },
  {
    label: "小小闽食播报员",
    description: "一句话播报。",
    href: "#food-broadcast",
    icon: "📣",
    tone: "bg-rose-50 text-rose-950",
  },
];

const aiConfirmedUseNotice = "老师确认好的图和词";

type ChildPanelKey =
  | "home"
  | "child-status"
  | "child-play"
  | "habit-challenge"
  | "habit-meal-manners"
  | "habit-traffic-light"
  | "habit-story"
  | "habit-talk"
  | "habit-template"
  | "food-menu"
  | "food-train"
  | "food-guess"
  | "food-stall"
  | "food-observation-card"
  | "food-kitchen"
  | "food-broadcast";

const childPanelLabels: Record<ChildPanelKey, string> = {
  home: "儿童首页",
  "child-status": "今日状态",
  "child-play": "想玩什么",
  "habit-challenge": "好习惯闯关",
  "habit-meal-manners": "文明进餐操",
  "habit-traffic-light": "好习惯红绿牌",
  "habit-story": "习惯故事小剧场",
  "habit-talk": "对老师说",
  "habit-template": "老师给我的任务",
  "food-menu": "今日食谱",
  "food-train": "闽食小列车",
  "food-guess": "美食猜猜乐",
  "food-stall": "泉州美食摊位寻宝",
  "food-observation-card": "美食观察与靠近一点点",
  "food-kitchen": "泉州小厨房",
  "food-broadcast": "小小闽食播报员",
};

const childDirectoryVoiceGuides: Partial<Record<ChildPanelKey, string>> = {
  "child-status": "看看今天的小任务和小贴纸吧。",
  "habit-challenge": "我们一起闯好习惯小关卡。",
  "habit-story": "来找一本小故事，听完还能打卡。",
  "habit-talk": "你可以跟老师分享快乐和不开心的事，也可以说一个小秘密。",
  "habit-template": "老师给你准备了一个小任务，我们慢慢来。",
  "food-menu": "看看今天有什么好吃的。",
  "food-train": "坐上闽食小列车，听一听站名。",
  "food-stall": "去泉州美食摊位找一找。",
  "food-observation-card": "慢慢靠近一点点，先看一看今天的食物。",
  "food-kitchen": "一起做一道小小泉州菜。",
  "food-broadcast": "拿起小话筒，说说今天的美食。",
};

function getChildPanelFromHref(href: string): ChildPanelKey {
  const panel = href.replace(/^#/, "") as ChildPanelKey;

  return panel in childPanelLabels ? panel : "home";
}

const habitTaskAnchorMap: Record<string, string> = {
  洗手小任务: "habit-challenge",
  喝水小任务: "habit-challenge",
  如厕小任务: "habit-challenge",
  排队小队长: "habit-challenge",
  整理小能手: "habit-challenge",
  文明进餐操: "habit-challenge",
};

const habitGameStepMap: Record<string, string[]> = {
  洗手小任务: ["掌心搓一搓", "手背搓一搓", "指缝夹一夹", "手指弓一弓", "拇指转一转", "指尖立一立", "手腕洗一洗"],
  喝水小任务: ["找到水杯架", "取自己的杯子", "接半杯水", "坐好慢慢喝", "放回杯架"],
  如厕小任务: ["轻轻进卫生间", "按下冲水按钮", "整理好衣物", "小手冲一冲"],
  排队小队长: ["找到队伍", "一个跟一个", "小脚慢慢走", "等一等不挤"],
  整理小能手: ["图书回书架", "玩具进玩具框", "桌面物品收进盒", "椅子靠桌边"],
  文明进餐操: ["扶好碗", "坐稳", "小口慢慢吃", "不挑食", "餐后整理"],
};
const habitChallengeTitles = new Set([
  "洗手小任务",
  "喝水小任务",
  "排队小队长",
  "如厕小任务",
  "整理小能手",
  "文明进餐操",
]);

function getHabitTaskAnchor(title: string) {
  return habitTaskAnchorMap[title] ?? undefined;
}

function getHabitGameSteps(title: string) {
  return habitGameStepMap[title] ?? ["听口令", "选答案", "做一步"];
}

type HabitStepVisual = {
  icon: string;
  name: string;
  hint: string;
  visual: string;
};

function getHabitStepVisuals(title: string, steps: string[]): HabitStepVisual[] {
  if (title.includes("洗手")) {
    return [
      { icon: "🤲", name: "掌心", hint: "掌心对掌心搓一搓。", visual: "七步洗手 1" },
      { icon: "🖐️", name: "手背", hint: "手心搓手背。", visual: "七步洗手 2" },
      { icon: "👐", name: "指缝", hint: "十指交叉洗指缝。", visual: "七步洗手 3" },
      { icon: "✊", name: "手指", hint: "手指弯弯弓一弓。", visual: "七步洗手 4" },
      { icon: "👍", name: "拇指", hint: "拇指转一转。", visual: "七步洗手 5" },
      { icon: "☝️", name: "指尖", hint: "指尖立起来搓一搓。", visual: "七步洗手 6" },
      { icon: "💧", name: "手腕", hint: "手腕也洗一洗。", visual: "七步洗手 7" },
    ];
  }

  if (title.includes("喝水")) {
    return [
      { icon: "🧺", name: "水杯架", hint: "先找到自己的水杯架。", visual: "水杯架" },
      { icon: "🥤", name: "取杯子", hint: "轻轻拿自己的小杯子。", visual: "取杯子" },
      { icon: "🚰", name: "接水", hint: "接半杯温水就好。", visual: "接水" },
      { icon: "🪑", name: "坐好喝", hint: "坐稳，小口慢慢喝。", visual: "坐好喝" },
      { icon: "🧺", name: "放回杯架", hint: "喝完送杯子回家。", visual: "放回杯架" },
    ];
  }

  if (title.includes("如厕")) {
    return [
      { icon: "🚻", name: "卫生间", hint: "轻轻走进卫生间。", visual: "卫生间" },
      { icon: "🚽", name: "冲水按钮", hint: "按一下冲水按钮。", visual: "冲水按钮/水箱" },
      { icon: "👕", name: "整理衣物", hint: "把衣服裤子整理好。", visual: "整理衣物" },
      { icon: "🫧", name: "小手冲洗", hint: "出来以后洗小手。", visual: "小手冲洗" },
    ];
  }

  if (title.includes("排队")) {
    return [
      { icon: "🧒", name: "找到队伍", hint: "看看小朋友排在哪里。", visual: "幼儿排队小人" },
      { icon: "🧒🧒", name: "一个跟一个", hint: "跟在前面朋友后面。", visual: "一个跟一个" },
      { icon: "👣", name: "小脚慢慢走", hint: "小脚不着急，慢慢走。", visual: "小脚步" },
      { icon: "✋", name: "等一等", hint: "不挤一挤，等一等。", visual: "等待小手" },
    ];
  }

  return steps.map((step) => ({
    icon: "⭐",
    name: step,
    hint: "点一下，试试看。",
    visual: step,
  }));
}

function MiniLoopChips({ steps, activeIndex = 0 }: { steps: string[]; activeIndex?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((step, index) => (
        <span
          key={`${step}-${index}`}
          className={`rounded-full px-3 py-2 text-xs font-semibold shadow-sm ${
            index === activeIndex ? "bg-amber-300 text-amber-950" : "bg-white/82 text-slate-700"
          }`}
        >
          {index < activeIndex ? "✓ " : ""}
          {index + 1}. {step}
        </span>
      ))}
    </div>
  );
}
function HabitTaskPlayfield({
  activeStep = 0,
  completed,
  onStepClick,
  steps,
  title,
}: {
  activeStep?: number;
  completed: boolean;
  onStepClick?: (step: string, index: number) => void;
  steps: string[];
  title: string;
}) {
  const safeActiveStep = Math.min(Math.max(activeStep, 0), Math.max(0, steps.length - 1));
  const completedCount = completed ? steps.length : Math.max(0, activeStep);
  const progress = completed ? 100 : Math.min(92, Math.max(24, ((completedCount + 1) / Math.max(1, steps.length)) * 100));
  const usesFullStepCards =
    title.includes("洗手") ||
    title.includes("喝水") ||
    title.includes("如厕") ||
    title.includes("排队") ||
    title.includes("整理") ||
    title.includes("文明进餐");
  const stepNodes = usesFullStepCards ? steps : steps.slice(0, 4);
  const stepVisuals = getHabitStepVisuals(title, stepNodes);
  const isStepDone = (index: number) => completed || index < completedCount;
  const isStepActive = (index: number) => !completed && index === safeActiveStep;
  const isStepLocked = (index: number) => !completed && index > safeActiveStep;
  const triggerStep = (step: string, index: number) => {
    if (!isStepLocked(index)) {
      onStepClick?.(step, index);
    }
  };

  if (
    title.includes("洗手") ||
    title.includes("喝水") ||
    title.includes("如厕") ||
    title.includes("排队")
  ) {
    return (
      <div className="rounded-[1.6rem] bg-cyan-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stepNodes.map((step, index) => {
            const visual = stepVisuals[index] ?? {
              icon: "⭐",
              name: step,
              hint: "点一下，试试看。",
              visual: step,
            };

            return (
            <button
              key={`${title}-${step}-${index}`}
              aria-label={`${title} 第 ${index + 1} 步：${step}`}
              disabled={isStepLocked(index) || completed}
              onClick={() => triggerStep(step, index)}
              className={`min-h-36 rounded-[1.2rem] bg-white/88 p-3 text-left text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 ${
                isStepDone(index)
                  ? "ring-2 ring-emerald-300"
                  : isStepActive(index)
                    ? "ring-2 ring-cyan-300"
                    : ""
              }`}
              title={step}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.2rem] text-4xl ${
                    isStepDone(index) ? "bg-emerald-100" : "bg-cyan-100"
                  }`}
                >
                  {isStepDone(index) ? "✅" : visual.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-cyan-900">{visual.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{visual.visual}</p>
                </div>
              </div>
              <span className="mt-3 block rounded-[1rem] bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900">
                {isStepDone(index) ? "✓ 做到啦" : visual.hint}
              </span>
              <span className="mt-2 block text-xs font-semibold text-slate-500">
                👉 点这里：{step}
              </span>
            </button>
            );
          })}
        </div>
        <div className="mt-3">
          <MiniLoopChips steps={steps} activeIndex={completed ? steps.length : completedCount} />
        </div>
      </div>
    );
  }

  if (title.includes("喝水")) {
    return (
      <div className="rounded-[1.6rem] bg-sky-50 p-4">
        <div className="grid gap-4 md:grid-cols-[140px_1fr]">
          <div className="relative mx-auto h-40 w-28 rounded-b-[2rem] rounded-t-lg border-4 border-sky-300 bg-white/80">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-b-[1.55rem] bg-sky-300 transition-all duration-700"
              style={{ height: `${completed ? 78 : 42}%` }}
            />
            <div className="absolute -right-8 top-10 h-16 w-8 rounded-r-full border-4 border-sky-300 border-l-0" />
            <span className="absolute inset-x-0 top-12 text-center text-sm font-semibold text-sky-950">
              小口喝
            </span>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {stepNodes.map((step, index) => (
                <button
                  key={step}
                  onClick={() => triggerStep(step, index)}
                  disabled={isStepLocked(index) || completed}
                  className={`rounded-[1rem] px-3 py-2 text-left text-xs font-semibold shadow-sm transition ${
                    isStepDone(index)
                      ? "bg-sky-500 text-white"
                      : isStepActive(index)
                        ? "bg-white text-sky-950 ring-2 ring-sky-300"
                        : "bg-white/70 text-slate-500"
                  }`}
                  type="button"
                >
                  {isStepDone(index) ? "✓ " : ""}
                  {index + 1}. {step}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (title.includes("如厕")) {
    return (
      <div className="rounded-[1.6rem] bg-violet-50 p-4">
        <div className="relative h-36 rounded-[1.3rem] bg-white/85 p-4">
          <div className="absolute left-6 top-16 h-2 w-[78%] rounded-full bg-violet-100" />
          {stepNodes.map((label, index) => (
            <button
              key={label}
              onClick={() => triggerStep(label, index)}
              disabled={isStepLocked(index) || completed}
              className={`absolute flex h-16 w-16 flex-col items-center justify-center rounded-[1.2rem] text-center text-[11px] font-semibold shadow-sm transition ${
                isStepDone(index)
                  ? "bg-violet-300 text-violet-950"
                  : isStepActive(index)
                    ? "bg-white text-violet-950 ring-2 ring-violet-300"
                    : "bg-white text-slate-500"
              }`}
              style={{
                left: `${5 + index * 24}%`,
                top: index % 2 === 0 ? "18px" : "58px",
              }}
              type="button"
            >
              <span className="text-xl">{index === 3 ? "🫧" : "👣"}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (title.includes("排队")) {
    return (
      <div className="rounded-[1.6rem] bg-emerald-50 p-4">
        <div className="relative h-36 rounded-[1.3rem] bg-white/85">
          <div className="absolute left-8 right-8 top-16 border-t-4 border-dashed border-emerald-200" />
          {stepNodes.map((label, index) => (
            <button
              key={label}
              onClick={() => triggerStep(label, index)}
              disabled={isStepLocked(index) || completed}
              className={`absolute flex h-16 w-16 flex-col items-center justify-center rounded-full text-center text-[11px] font-semibold shadow-sm transition ${
                isStepDone(index)
                  ? "bg-emerald-300 text-emerald-950"
                  : isStepActive(index)
                    ? "bg-white text-emerald-950 ring-2 ring-emerald-300"
                    : "bg-white text-slate-500"
              }`}
              style={{
                left: `${8 + index * 22}%`,
                top: `${28 + (index % 2) * 22}px`,
              }}
              type="button"
            >
              <span className="text-xl">🧒</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const visualItems = title.includes("文明进餐")
    ? [
        {
          icon: "🥣",
          name: "扶好碗",
          hint: "小手扶好小碗。",
          visual: "小碗稳稳",
        },
        {
          icon: "🪑",
          name: "坐稳",
          hint: "小脚放好，身体坐稳。",
          visual: "椅子坐稳",
        },
        {
          icon: "🥄",
          name: "小口慢慢吃",
          hint: "小勺一口，慢慢嚼。",
          visual: "小勺慢慢",
        },
        {
          icon: "🥬",
          name: "不挑食",
          hint: "先看一看，也可以尝一点。",
          visual: "蔬菜朋友",
        },
        {
          icon: "🧺",
          name: "餐后整理",
          hint: "餐具和桌面一起回家。",
          visual: "收拾餐桌",
        },
      ]
    : [
        {
          icon: "📚",
          name: "图书",
          hint: "把小书送回图书架。",
          visual: "图书架",
        },
        {
          icon: "🧸",
          name: "玩具",
          hint: "玩具回到玩具框。",
          visual: "玩具框",
        },
        {
          icon: "🧺",
          name: "桌面物品",
          hint: "桌面小物收进盒。",
          visual: "桌面收纳",
        },
        {
          icon: "🪑",
          name: "椅子",
          hint: "小椅子靠回桌边。",
          visual: "椅子归位",
        },
      ];

  return (
    <div className="rounded-[1.6rem] bg-orange-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visualItems.map((item, index) => {
          const step = stepNodes[index] ?? item.name;

          return (
          <button
            key={`${title}-${item.name}`}
            onClick={() => triggerStep(step, index)}
            disabled={isStepLocked(index) || completed}
            className={`min-h-36 rounded-[1.2rem] bg-white/88 p-3 text-left shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 ${
              isStepDone(index)
                ? "ring-2 ring-emerald-300"
                : isStepActive(index)
                  ? "ring-2 ring-orange-300"
                  : ""
            }`}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-16 w-16 items-center justify-center rounded-[1.2rem] text-4xl ${
                isStepDone(index) ? "bg-emerald-100" : "bg-orange-100"
              }`}>
                {isStepDone(index) ? "✅" : item.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-orange-800">{item.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.visual}</p>
              </div>
            </div>
            <span className="mt-3 block rounded-[1rem] bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900">
              {isStepDone(index) ? "✓ 做到啦" : item.hint}
            </span>
            <span className="mt-2 block text-xs font-semibold text-slate-500">
              👉 点这里：{step}
            </span>
          </button>
          );
        })}
      </div>
      <div className="mt-3">
        <MiniLoopChips steps={steps} activeIndex={completed ? steps.length : completedCount} />
      </div>
    </div>
  );
}

function MealMannersRhythmStage({
  actions,
  completedActions,
  currentIndex,
  onPickAction,
}: {
  actions: typeof mealMannerActions;
  completedActions: string[];
  currentIndex: number;
  onPickAction?: () => void;
}) {
  return (
    <div className="rounded-[1.6rem] bg-amber-100/70 p-4">
      <div className="relative h-24 rounded-[1.2rem] bg-white/85">
        <div className="absolute left-4 right-4 top-1/2 h-2 -translate-y-1/2 rounded-full bg-amber-200" />
        {actions.map((action, index) => {
          const done = completedActions.includes(action.label);
          const active = index === currentIndex && !done;

          return (
            <button
              key={action.label}
              aria-label={`进餐动作：${action.label}`}
              disabled={done}
              onClick={() => {
                if (active) {
                  onPickAction?.();
                }
              }}
              className={`absolute top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-2xl shadow-sm transition ${
                done ? "bg-emerald-200" : active ? "bg-amber-300" : "bg-white"
              } ${active ? "cursor-pointer ring-4 ring-amber-100" : "cursor-default"}`}
              style={{
                left: `calc(${(index / Math.max(1, actions.length - 1)) * 100}% - 28px)`,
                transform: active ? "translateY(-58%) scale(1.12)" : "translateY(-50%) scale(1)",
              }}
              type="button"
            >
              {action.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrafficLightDecisionStage({
  answers,
  completed,
  currentIndex,
  onAnswer,
}: {
  answers: string[];
  completed: boolean;
  currentIndex: number;
  onAnswer?: (cardColor: "green" | "red") => void;
}) {
  const last = answers.at(-1) ?? "";
  const activeGreen = last.includes("绿牌");
  const activeRed = last.includes("红牌");

  return (
    <div className="grid gap-4 rounded-[1.6rem] bg-slate-900 p-4 text-white md:grid-cols-[120px_1fr]">
      <div className="mx-auto flex w-24 flex-col gap-3 rounded-[1.4rem] bg-slate-950 p-4 shadow-inner">
        <button
          aria-label="举红牌"
          disabled={completed}
          onClick={() => onAnswer?.("red")}
          className={`h-14 rounded-full transition ${activeRed ? "bg-rose-400 shadow-[0_0_22px_rgba(251,113,133,0.8)]" : "bg-rose-950 hover:bg-rose-700"}`}
          type="button"
        />
        <span className="h-14 rounded-full bg-amber-950" />
        <button
          aria-label="举绿牌"
          disabled={completed}
          onClick={() => onAnswer?.("green")}
          className={`h-14 rounded-full transition ${activeGreen ? "bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.8)]" : "bg-emerald-950 hover:bg-emerald-700"}`}
          type="button"
        />
      </div>
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold text-white/70">选牌啦</p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-emerald-300 transition-all duration-500"
            style={{ width: `${completed ? 100 : (currentIndex / habitTrafficLightCards.length) * 100}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold">
          {completed ? "都选好啦" : `看看第 ${currentIndex + 1} 张小卡片`}
        </p>
      </div>
    </div>
  );
}

function FoodTrainTrack({
  arrivedStations,
  completed,
  onPickStation,
  route,
  stationIndex,
}: {
  arrivedStations: string[];
  completed: boolean;
  onPickStation?: (label: string) => void;
  route: typeof foodTrainStations;
  stationIndex: number;
}) {
  const progress = completed ? 100 : (stationIndex / Math.max(1, route.length - 1)) * 100;

  return (
    <div className="rounded-[1.6rem] bg-teal-100/80 p-4">
      <div className="relative h-32 rounded-[1.3rem] bg-white/90">
        <div className="absolute left-8 right-8 top-16 h-2 rounded-full bg-teal-200" />
        <div
          className="absolute top-8 text-4xl transition-all duration-700"
          style={{ left: `calc(${progress}% - 8px)` }}
        >
          🚂
        </div>
        {route.map((station, index) => {
          const done = arrivedStations.includes(station.label);
          const current = index === stationIndex && !completed;

          return (
            <button
              key={`${station.station}-${station.label}`}
              aria-label={`到站：${station.station}`}
              disabled={done || completed}
              onClick={() => onPickStation?.(station.label)}
              className={`absolute top-[72px] -translate-x-1/2 text-center transition ${
                current ? "scale-110" : ""
              } disabled:cursor-not-allowed`}
              style={{ left: `${(index / Math.max(1, route.length - 1)) * 100}%` }}
              type="button"
            >
              <span
                className={`mx-auto block h-5 w-5 rounded-full ${
                  done ? "bg-emerald-400" : current ? "bg-amber-300 ring-4 ring-amber-100" : "bg-teal-300"
                }`}
              />
              <span className="mt-1 block w-20 text-[11px] font-semibold text-teal-950">{station.station}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FoodGuessChestStage({
  answers,
  completed,
  currentRound,
  onOpenChest,
  onPickOption,
  options = [],
  revealedHintCount = 1,
  roundIndex,
  total,
}: {
  answers: string[];
  completed: boolean;
  currentRound?: { hints: string[]; icon: string; treasure: string };
  onOpenChest?: () => void;
  onPickOption?: (label: string) => void;
  options?: string[];
  revealedHintCount?: number;
  roundIndex: number;
  total: number;
}) {
  const opened = answers.length > roundIndex || completed;
  const visibleHints = (currentRound?.hints ?? []).slice(0, Math.max(1, revealedHintCount));

  return (
    <div className="grid gap-4 rounded-[1.6rem] bg-cyan-100/80 p-4 md:grid-cols-[150px_1fr]">
      <button
        aria-label="打开美食宝箱"
        disabled={completed}
        onClick={onOpenChest}
        className="relative mx-auto flex h-32 w-36 items-end justify-center transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-75"
        type="button"
      >
        <div className="absolute bottom-0 h-20 w-32 rounded-b-[1.4rem] bg-amber-700 shadow-lg" />
        <div
          className="absolute bottom-16 h-12 w-32 rounded-t-[1.4rem] bg-amber-500 transition-transform duration-500"
          style={{ transform: opened || revealedHintCount > 1 ? "rotate(-10deg) translateY(-12px)" : "rotate(0deg)" }}
        />
        <span className="relative z-10 mb-8 text-4xl">{opened ? currentRound?.icon ?? "⭐" : "?"}</span>
      </button>
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold text-cyan-900">
          {completed ? "宝箱全部打开" : `第 ${roundIndex + 1}/${total} 个宝箱`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleHints.map((hint, index) => (
            <span
              key={`${hint}-${index}`}
              className="rounded-[1rem] bg-white px-3 py-2 text-xs font-semibold text-cyan-950 shadow-sm"
            >
              线索 {index + 1}：{hint}
            </span>
          ))}
          {!completed && visibleHints.length < (currentRound?.hints.length ?? 0) ? (
            <button
              onClick={onOpenChest}
              className="rounded-[1rem] bg-cyan-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-800"
              type="button"
            >
              再翻一条线索
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.slice(0, 4).map((option) => (
            <button
              key={option}
              onClick={() => onPickOption?.(option)}
              disabled={completed}
              className="rounded-[1rem] bg-white px-3 py-2 text-left text-xs font-semibold text-cyan-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FoodTreasureMapStage({
  completed,
  currentIndex,
  ingredientsComplete,
  matched,
  onPickFood,
  questFoods,
  selectedApproachStep,
  selectedFood,
}: {
  completed?: boolean;
  currentIndex: number;
  ingredientsComplete: boolean;
  matched: string[];
  onPickFood?: (label: string) => void;
  questFoods: Array<{ icon: string; label: string; stall: string }>;
  selectedApproachStep: string;
  selectedFood: string;
}) {
  return (
    <div className="rounded-[1.6rem] bg-teal-100/80 p-4">
      <div className="relative min-h-44 overflow-hidden rounded-[1.3rem] bg-[linear-gradient(135deg,#ecfeff_0%,#fef3c7_100%)] p-4">
        <div className="absolute inset-x-8 top-20 border-t-4 border-dashed border-teal-300" />
        {questFoods.map((food, index) => {
          const done = matched.includes(food.label);
          const current = index === currentIndex;
          const locked = !current && !done;

          return (
            <button
              key={`${food.label}-${index}`}
              aria-label={`摊位：${food.stall}`}
              disabled={completed || done || locked}
              onClick={() => onPickFood?.(food.label)}
              className={`absolute flex h-20 w-20 flex-col items-center justify-center rounded-[1.3rem] text-center text-xs font-semibold shadow-sm transition ${
                done ? "bg-emerald-500 text-white" : current ? "bg-white text-teal-950 ring-2 ring-teal-300" : "bg-white/70 text-slate-500"
              } ${current && !completed ? "hover:-translate-y-1 hover:bg-teal-50" : ""}`}
              style={{
                left: `${6 + index * 22}%`,
                top: index % 2 === 0 ? "22px" : "86px",
              }}
              type="button"
            >
              <span className="text-2xl">{done || current ? food.icon : "☆"}</span>
              <span className="mt-1">{food.stall}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          ["找到摊位", selectedFood],
          ["食材卡", ingredientsComplete ? "已集齐" : ""],
          ["靠近小步", selectedApproachStep],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-[1rem] px-3 py-2 text-xs font-semibold ${value ? "bg-teal-700 text-white" : "bg-white text-slate-600"}`}>
            {label}：{value || "等待"}
          </div>
        ))}
      </div>
    </div>
  );
}

function FoodApproachLadderStage({
  foodImageUrl,
  onPickStep,
  selectedApproachStep,
  selectedFood,
}: {
  foodImageUrl?: string;
  onPickStep?: (step: string) => void;
  selectedApproachStep: string;
  selectedFood: string;
}) {
  const currentIndex = Math.max(0, foodPreferenceApproachSteps.indexOf(selectedApproachStep));
  const stepVisuals = [
    {
      icon: selectedFood ? getFoodPreferenceIcon(selectedFood) : "👀",
      imageUrl: foodImageUrl,
      hint: selectedFood ? `看${selectedFood}` : "看一看",
    },
    { icon: "👃", hint: "闻香味" },
    { icon: "🤲", hint: "小手碰" },
    { icon: "🥄", hint: "小勺尝" },
    { icon: "💬", hint: "今天先看" },
  ];

  return (
    <div className="rounded-[1.6rem] bg-emerald-100/80 p-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {foodPreferenceApproachSteps.slice(0, 5).map((step, index) => {
          const active = selectedApproachStep === step;
          const reached = Boolean(selectedApproachStep) && index <= currentIndex;
          const visual = stepVisuals[index];

          return (
            <button
              key={step}
              onClick={() => onPickStep?.(step)}
              className={`min-h-24 rounded-[1.2rem] px-3 py-3 text-center text-xs font-semibold shadow-sm transition ${
                active ? "bg-emerald-700 text-white" : reached ? "bg-emerald-200 text-emerald-950" : "bg-white text-slate-600"
              } hover:-translate-y-1 hover:bg-emerald-50`}
              style={{ transform: active ? "translateY(-6px)" : "translateY(0)" }}
              type="button"
            >
              {visual?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={visual.imageUrl}
                  alt={`${selectedFood || "食物"}图片`}
                  className="mx-auto h-12 w-12 rounded-[0.9rem] object-cover"
                />
              ) : (
                <span className="block text-2xl">{visual?.icon ?? "☆"}</span>
              )}
              <span className="mt-2 block">{step}</span>
              <span className="mt-1 block text-[11px] opacity-75">👉 {visual?.hint ?? "选一选"}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 rounded-[1rem] bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900">
        {selectedFood ? `当前食物：${selectedFood}` : "先选一种正在认识的食物"} · {selectedApproachStep || "再选一个靠近小步"}
      </p>
    </div>
  );
}

function TeacherMessageQuestStage({
  activeTemplate,
  childReply,
  onPlayStory,
  selectedCard,
}: {
  activeTemplate: HabitCheckinTemplate;
  childReply: string;
  onPlayStory?: () => void;
  selectedCard: string;
}) {
  return (
    <div className="grid gap-4 rounded-[1.6rem] bg-emerald-100/80 p-4 md:grid-cols-[150px_1fr]">
      <button
        aria-label={`播放老师的小故事：${activeTemplate.title}`}
        onClick={onPlayStory}
        className="relative mx-auto h-32 w-32 rounded-[1.5rem] bg-white shadow-sm transition hover:-translate-y-1"
        type="button"
      >
        <div className="absolute inset-x-4 top-8 h-16 rounded-b-[1rem] bg-emerald-200" />
        <div
          className="absolute left-7 top-2 h-16 w-20 rounded-[0.8rem] bg-white shadow transition-transform duration-500"
          style={{ transform: selectedCard ? "translateY(38px)" : childReply ? "translateY(18px)" : "translateY(0)" }}
        />
        <span className="absolute inset-x-0 bottom-4 text-center text-2xl">✉️</span>
      </button>
      <div className="flex flex-col justify-center">
        <p className="text-sm font-semibold text-emerald-900">给老师的小信件</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{activeTemplate.title} · {activeTemplate.habitFocus}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["说一句", childReply],
            ["说小发现", selectedCard],
            ["小任务", activeTemplate.habitTask],
          ].map(([label, value]) => (
            <span key={label} className={`rounded-full px-3 py-2 text-xs font-semibold ${value ? "bg-emerald-700 text-white" : "bg-white text-slate-600"}`}>
              {label}：{value || "等待"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuPlateStage({
  entries,
  onPickEntry,
  selectedMenuFood,
}: {
  entries: WeeklyMenuEntry[];
  onPickEntry?: (entry: WeeklyMenuEntry) => void;
  selectedMenuFood: string;
}) {
  const visibleEntries = entries.slice(0, 4);
  const featuredEntry = visibleEntries.find((entry) => entry.dishName === selectedMenuFood) ?? visibleEntries[0];
  const featuredCoverImage = getMenuCoverImage(featuredEntry);
  const featuredSourceLabel = getMenuMediaSourceText(
    featuredEntry?.mediaSource ?? getConfirmedMenuObservationImages(featuredEntry)[0]?.mediaSource,
  );

  return (
    <div className="rounded-[1.6rem] bg-cyan-100/80 p-4">
      <div className="grid gap-4 md:grid-cols-[150px_1fr]">
        <button
          onClick={() => {
            if (featuredEntry) {
              onPickEntry?.(featuredEntry);
            }
          }}
          className="relative mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-white transition hover:-translate-y-0.5 hover:ring-cyan-300"
          type="button"
        >
          {featuredCoverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredCoverImage}
                alt={`${featuredEntry?.dishName ?? "今日食谱"}观察主图`}
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/92 px-2 py-1 text-[11px] font-semibold text-cyan-900">
                {featuredSourceLabel}
              </span>
            </>
          ) : (
            <>
              <div className="h-24 w-24 rounded-full border-8 border-cyan-100 bg-amber-50" />
              <span className="absolute text-4xl">🍽️</span>
            </>
          )}
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleEntries.map((entry, index) => {
            const selected = selectedMenuFood === entry.dishName;

            return (
              <button
                key={entry.id}
                onClick={() => onPickEntry?.(entry)}
                className={`rounded-[1.1rem] px-3 py-3 text-sm font-semibold shadow-sm transition ${
                  selected ? "bg-cyan-700 text-white" : "bg-white text-cyan-950"
                } hover:-translate-y-1 hover:bg-cyan-50`}
                type="button"
              >
                <span className="text-xl">{["🥣", "🍚", "🥬", "🍲"][index] ?? "🍽️"}</span>
                <span className="ml-2">{entry.mealType}</span>
                <span className="mt-1 block text-xs opacity-75">{entry.dishName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const habitStoryMissions: HabitStoryMission[] = [
  {
    topic: "洗手",
    title: "泡泡小手去吃饭",
    storyText:
      "《泡泡小手去吃饭》开始啦。小星闻到午餐香香的，可是它先停在水池边。小星说：饭前先把小手打湿，搓出泡泡，再冲干净、擦一擦。小朋友也跟着一步一步做，干净小手准备好，才开心坐到餐桌旁。",
    question: "故事里的小星先做了什么好习惯？",
    answerCards: ["饭前洗手", "拿着杯子跑", "把图书丢地上"],
    habitTask: "饭前洗手",
    feedback: "你听到饭前先洗手啦，等会儿也可以按顺序洗小手。",
  },
  {
    topic: "喝水",
    title: "小水杯慢慢走",
    storyText:
      "《小水杯慢慢走》开始啦。户外活动后，小星觉得有点口渴。它没有拿着杯子跑，而是坐到小椅子上，双手扶好杯子，咕噜咕噜慢慢喝。喝完后，小星把杯子放回自己的位置，还轻轻说：我的身体舒服多啦。",
    question: "小星喝水时做了哪一步？",
    answerCards: ["坐好慢慢喝", "拿杯子奔跑", "一直不喝水"],
    habitTask: "坐好慢慢喝水",
    feedback: "你知道喝水要坐好慢慢喝，喝水小勇士稳稳的。",
  },
  {
    topic: "排队",
    title: "小脚排成一条线",
    storyText:
      "《小脚排成一条线》开始啦。小朋友要去操场，小星举起小队牌，说：一个跟着一个走，小脚慢慢走，眼睛看前面。队伍不推不挤，像一条安静的小路，很快就安全走到了操场。",
    question: "排队时可以怎么做？",
    answerCards: ["慢慢跟着走", "推前面朋友", "突然跑开"],
    habitTask: "排队慢慢走",
    feedback: "你听到排队要慢慢跟着走，排队小队长准备好啦。",
  },
  {
    topic: "整理",
    title: "玩具回家啦",
    storyText:
      "《玩具回家啦》开始啦。区域游戏结束后，小星看到积木还在地上。它弯下腰，把积木送回盒子，把小书放回书架。桌面变清爽了，小朋友都能很快找到下一次要玩的材料。",
    question: "玩完以后可以怎么做？",
    answerCards: ["放回原位", "扔在地上", "藏到椅子下"],
    habitTask: "玩具图书归位",
    feedback: "你知道玩完要送回家，整理小能手已经上线啦。",
  },
  {
    topic: "图书归位",
    title: "小书回书架",
    storyText:
      "《小书回书架》开始啦。午睡前，小星听完一本小故事。它轻轻合上书，看一看书架上的标记，把图书送回原来的小格子。小星说：书回家了，下一位小朋友也能找到它。",
    question: "听完故事后，小书可以去哪里？",
    answerCards: ["回到书架", "躲到地上", "放到水池边"],
    habitTask: "图书归位",
    feedback: "你听到图书要回书架，阅读习惯也亮起来啦。",
  },
  {
    topic: "文明进餐",
    title: "小碗稳稳坐",
    storyText:
      "《小碗稳稳坐》开始啦。午餐时，小星把小脚放稳，小手扶好碗，嘴巴轻轻嚼。遇到还在认识的菜，它先看一看、闻一闻，再说：我今天愿意靠近一点点。餐后，小星还帮忙把桌面整理干净。",
    question: "文明进餐时可以做哪一步？",
    answerCards: ["小手扶好碗", "边吃边玩", "把食物乱撒"],
    habitTask: "扶好碗慢慢吃",
    feedback: "你听到文明进餐的小动作，完成一步就有小贴纸。",
  },
  {
    topic: "如厕",
    title: "我会轻轻说",
    storyText:
      "《我会轻轻说》开始啦。小星想上厕所时，没有着急跑开，而是走到老师身边轻轻说：老师，我想去如厕。回来后，小星整理好衣服，再认真洗手。老师说：你会表达自己的需要，也会照顾自己。",
    question: "想上厕所时可以先做什么？",
    answerCards: ["告诉老师", "憋着不说", "推开朋友"],
    habitTask: "如厕前告诉老师",
    feedback: "你听到可以轻轻告诉老师，如厕小任务完成一步啦。",
  },
  {
    topic: "情绪表达",
    title: "小云朵说出来",
    storyText:
      "《小云朵说出来》开始啦。小星今天有一点难过，它没有推人，也没有大喊，而是轻轻告诉老师：我有点难过，我想抱一抱小枕头。老师陪它深呼吸，小星慢慢平静下来，又能和朋友一起玩了。",
    question: "难过或生气时可以怎么做？",
    answerCards: ["说出我的感受", "推开朋友", "大声乱喊"],
    habitTask: "说一句自己的感受",
    feedback: "你知道可以说出感受，情绪小天气变温柔啦。",
  },
  {
    topic: "礼貌",
    title: "谢谢小种子",
    storyText:
      "《谢谢小种子》开始啦。小星的彩笔掉到地上，旁边的小朋友帮它捡起来。小星看着朋友说：谢谢你。朋友笑了，小星也觉得心里暖暖的。礼貌的话像一颗小种子，会让班级更舒服。",
    question: "别人帮了你，可以说什么？",
    answerCards: ["谢谢你", "我不要", "大声抢过来"],
    habitTask: "说一句谢谢",
    feedback: "你会说谢谢，礼貌小种子发芽啦。",
  },
  {
    topic: "等待轮流",
    title: "轮到我再玩",
    storyText:
      "《轮到我再玩》开始啦。区域里只有一个小锅铲，小星也很想玩。它没有抢，而是拿着小牌子等一等。轮到小星时，它开心地说：谢谢你，我现在来炒菜。等一等，朋友也会更开心。",
    question: "还没轮到自己时可以怎么做？",
    answerCards: ["等一等", "马上抢过来", "把材料藏起来"],
    habitTask: "等待轮流",
    feedback: "你会等一等，班级规则小星亮起来啦。",
  },
  {
    topic: "班级规则",
    title: "小脚慢慢走",
    storyText:
      "《小脚慢慢走》开始啦。小星要去拿材料，它记得教室里要慢慢走。它小脚放轻，绕过朋友，把材料拿回来。老师说：你照顾了自己，也照顾了旁边的小朋友。",
    question: "在教室里走动时可以怎么做？",
    answerCards: ["小脚慢慢走", "追着朋友跑", "推开椅子冲过去"],
    habitTask: "按班级规则慢慢走",
    feedback: "你记得班级规则，能照顾自己和同伴。",
  },
];

function buildHabitStoryMission(input: string): HabitStoryMission {
  const cleanInput = input.trim();
  const matched =
    habitStoryMissions.find((item) => cleanInput.includes(item.topic)) ??
    (cleanInput.includes("书") || cleanInput.includes("阅读")
      ? habitStoryMissions.find((item) => item.topic === "图书归位")
      : undefined) ??
    (cleanInput.includes("吃") || cleanInput.includes("餐")
      ? habitStoryMissions.find((item) => item.topic === "文明进餐")
      : undefined) ??
    (cleanInput.includes("情绪") || cleanInput.includes("生气") || cleanInput.includes("难过")
      ? habitStoryMissions.find((item) => item.topic === "情绪表达")
      : undefined) ??
    (cleanInput.includes("礼貌") || cleanInput.includes("谢谢")
      ? habitStoryMissions.find((item) => item.topic === "礼貌")
      : undefined) ??
    (cleanInput.includes("等待") || cleanInput.includes("轮流")
      ? habitStoryMissions.find((item) => item.topic === "等待轮流")
      : undefined) ??
    (cleanInput.includes("规则") || cleanInput.includes("班级")
      ? habitStoryMissions.find((item) => item.topic === "班级规则")
      : undefined) ??
    habitStoryMissions[0];

  if (!cleanInput || cleanInput.includes(matched.topic)) {
    return matched;
  }

  const friend = cleanInput
    .replace(/我想听|的故事|故事|。|，|,|\./g, "")
    .trim()
    .slice(0, 12);

  if (!friend) {
    return matched;
  }

  return {
    ...matched,
    title: `${friend}也来练${matched.topic}`,
    storyText: `《${friend}也来练${matched.topic}》开始啦。${friend}来到幼儿园，遇见幼习宝小星。小星没有讲大道理，只带着${friend}做一个小小的${matched.topic}动作：${matched.habitTask}。${friend}试了一次，发现自己也能照顾好自己。故事讲完啦，我们也来选一张答案卡，再完成一个小任务。`,
  };
}

function normalizeKitchenDishLabel(value: string) {
  return value
    .replace(/我想做|我想要做|我要做|想做|做一个|做一道|。|！|!|，|,|\s/g, "")
    .trim()
    .slice(0, 16);
}

function getKitchenDishIcon(label: string) {
  if (/海蛎|蛏|鱼|虾|贝/.test(label)) return "🐟";
  if (/面|汤|糊|粥/.test(label)) return "🥣";
  if (/饼|卷/.test(label)) return "🌯";
  if (/甜|膏|冻|水果/.test(label)) return "🍧";
  if (/粽|饭|米/.test(label)) return "🍙";
  if (/菜|青|菇|葱|蒜|南瓜|豆腐/.test(label)) return "🥬";
  return "🍽️";
}

function buildKitchenActionsForDish(label: string) {
  if (/汤|糊|粥|面/.test(label)) {
    return [`看一看${label}食材`, "搅一搅热汤", "盛一盛小碗", "说一句暖暖的发现"];
  }

  if (/饼|卷/.test(label)) {
    return ["铺一铺材料", "放一放蔬菜或馅料", "卷一卷食材", "介绍一下颜色和形状"];
  }

  if (/甜|膏|冻|水果/.test(label)) {
    return [`舀一舀${label}`, "加一加清甜配料", "拌一拌小勺子", "分享一句甜甜发现"];
  }

  if (/粽|饭|米/.test(label)) {
    return ["看一看米粒", "找一找配料", "闻一闻香味", "介绍一下形状"];
  }

  return [`看一看${label}`, "洗一洗或摆一摆食材", "拌一拌小盘子", "说一句我发现了什么"];
}

function buildCustomKitchenRecipe(rawLabel: string): FoodKitchenRecipe {
  const label = normalizeKitchenDishLabel(rawLabel) || "我的小厨房菜";

  return {
    label,
    icon: getKitchenDishIcon(label),
    area: "幼儿点菜小厨房",
    actions: buildKitchenActionsForDish(label),
    chant: `${label}，看一看，闻一闻，小厨师慢慢说发现。`,
  };
}

function getKitchenActionIcon(action: string) {
  if (/看|找/.test(action)) return "👀";
  if (/洗/.test(action)) return "💧";
  if (/拌|搅/.test(action)) return "🥄";
  if (/煎|热/.test(action)) return "🔥";
  if (/卷|包/.test(action)) return "🤲";
  if (/盛|舀|摆/.test(action)) return "🍽️";
  if (/闻/.test(action)) return "🌿";
  if (/说|介绍|分享/.test(action)) return "💬";
  return "⭐";
}

function buildKitchenStepVisual(action: string, recipe: FoodKitchenRecipe) {
  return `${getKitchenActionIcon(action)} ${recipe.label}步骤图卡：${action}`;
}

function getKitchenRecipeIngredients(recipe: FoodKitchenRecipe) {
  const label = recipe.label;
  const mappedIngredients = getFoodIngredientNames(label);

  if (mappedIngredients.length >= 2) {
    return mappedIngredients.slice(0, 5);
  }

  if (/海蛎煎/.test(label)) return ["海蛎", "鸡蛋", "地瓜粉"];
  if (/面线糊/.test(label)) return ["面线", "清汤", "小葱"];
  if (/润饼/.test(label)) return ["青菜", "薄饼皮", "花生"];
  if (/石花膏/.test(label)) return ["石花膏", "水果", "蜂蜜水"];
  if (/烧肉粽|闽南肉粽|肉粽/.test(label)) return ["糯米", "粽叶", "香菇", "肉丁"];
  if (/姜母鸭/.test(label)) return ["鸭肉", "老姜", "芝麻油"];
  if (/土笋冻/.test(label)) return ["土笋冻原料", "清汤冻", "蒜蓉酱"];
  if (/炸醋肉/.test(label)) return ["猪肉", "地瓜粉", "香醋"];
  if (/芋头饼/.test(label)) return ["芋头", "糯米粉", "芝麻"];
  if (/牛肉羹/.test(label)) return ["牛肉", "清汤", "香菜"];
  if (/洪濑鸡爪/.test(label)) return ["鸡爪", "卤汁", "香料"];
  if (/崇武鱼卷/.test(label)) return ["鱼肉", "地瓜粉", "葱花"];
  if (/四果汤/.test(label)) return ["水果丁", "石花膏", "蜂蜜水"];
  if (/咸饭/.test(label)) return ["米饭", "香菇", "青菜"];

  return [label];
}

function buildKitchenBroadcastText(recipe: FoodKitchenRecipe, childThought: string, uploadedFileName = "") {
  const cleanThought = childThought.trim().replace(/[。！!]+$/g, "");
  const unsure = !cleanThought || /不知道|不会|不懂|随便|没有/.test(cleanThought);
  const textureMap: Record<string, string> = {
    泉州海蛎煎: "金黄金黄、边边香香，里面有海蛎、鸡蛋和地瓜粉",
    面线糊: "热热的、软软的，里面有面线和汤",
    润饼菜: "卷卷的、颜色很多，里面有薄饼皮和蔬菜",
    石花膏: "透明凉凉、会轻轻晃，是泉州常见的小甜品",
    闽南肉粽: "粽叶香香、米粒亮亮，里面可能有香菇和家常配料",
    烧肉粽: "粽叶香香、米粒亮亮，也叫闽南肉粽",
    姜母鸭: "热热香香，能看到老姜片和鸭肉",
    土笋冻: "透明凉凉，像小果冻一样亮晶晶",
    炸醋肉: "金黄金黄、外皮香香，味道带一点闽南香",
    芋头饼: "圆圆香香，里面有软软的芋头",
    牛肉羹: "热热软软，小勺舀起来滑滑的",
    洪濑鸡爪: "颜色深深、卤香明显，形状很特别",
    崇武鱼卷: "白白圆圆，带着海边鱼肉味",
    四果汤: "清凉甜甜，颜色很多，有好多小配料",
    咸饭: "米粒香香，里面有香菇和家常小菜",
  };
  const description = textureMap[recipe.label] ?? "有自己的颜色、形状和家乡味道";
  const stepText = recipe.actions.slice(0, 3).join("、");
  const nutritionText = buildFoodNutritionIntro(recipe.label, getKitchenRecipeIngredients(recipe));
  const uploadText = uploadedFileName ? "我上传了作品。" : "";

  if (unsure) {
    return `我今天介绍的是${recipe.label}。它${description}。我做了${stepText}。${nutritionText}${uploadText}我愿意把它介绍给大家。`;
  }

  if (cleanThought.length <= 8) {
    return `我今天介绍的是${recipe.label}。我发现它${cleanThought}。我做了${stepText}。${nutritionText}${uploadText}我愿意把它介绍给大家。`;
  }

  return `我今天介绍的是${recipe.label}。${cleanThought}。我做了${stepText}。${nutritionText}${uploadText}我愿意把它介绍给大家。`;
}

const habitTaskAnswerOptions: Record<
  string,
  {
    question: string;
    options: string[];
    correct: string;
    feedback: string;
    nextStep: string;
  }
> = {
  专注小耳朵: {
    question: "刚才故事里出现了谁？",
    options: ["小兔和老师", "飞机和司机", "大海和小船"],
    correct: "小兔和老师",
    feedback: "你听得很认真，故事小耳朵亮起来啦。",
    nextStep: "可以再去阅读打卡，或者换一张成长任务卡。",
  },
  阅读小书虫: {
    question: "听完故事后，你想说什么？",
    options: ["我看到了一个角色", "我喜欢这个画面", "我想把书放回去"],
    correct: "我看到了一个角色",
    feedback: "愿意说出一个发现，就是阅读小书虫的一步。",
    nextStep: "可以继续听绘本，或者把图书送回原位。",
  },
  文明进餐操: {
    question: "吃饭时可以先做哪一个好动作？",
    options: ["扶好碗坐稳", "边吃边跑", "把饭菜撒着玩"],
    correct: "扶好碗坐稳",
    feedback: "你会做进餐好动作，文明进餐章亮起来啦。",
    nextStep: "午餐时可以试一试扶好碗、慢慢嚼和餐后整理。",
  },
  好习惯红绿牌: {
    question: "饭前洗手应该举什么牌？",
    options: ["绿牌", "红牌", "不举牌"],
    correct: "绿牌",
    feedback: "你能分清好习惯，红绿牌判断完成啦。",
    nextStep: "可以继续听行为，练习说出正确做法。",
  },
  洗手小任务: {
    question: "饭前第一步可以做什么？",
    options: ["先洗小手", "直接去拿饭", "拿玩具来玩"],
    correct: "先洗小手",
    feedback: "小手先洗干净，洗手闪亮章亮起来啦。",
    nextStep: "可以把打湿、搓泡泡、冲干净、擦干连起来做一遍。",
  },
  喝水小任务: {
    question: "喝水时身体可以怎么做？",
    options: ["坐好慢慢喝", "拿杯子跑", "一直不喝水"],
    correct: "坐好慢慢喝",
    feedback: "坐好慢慢喝，喝水小勇士真稳。",
    nextStep: "可以把小水杯放回自己的位置。",
  },
  如厕小任务: {
    question: "想上厕所时可以先做什么？",
    options: ["告诉老师", "一直忍着", "推开别人跑"],
    correct: "告诉老师",
    feedback: "会轻轻告诉老师，如厕小任务完成啦。",
    nextStep: "如厕后记得整理衣物，再把小手洗干净。",
  },
  排队小队长: {
    question: "排队时可以怎么走？",
    options: ["一个跟一个", "推着同伴走", "跑到前面抢"],
    correct: "一个跟一个",
    feedback: "一个跟着一个走，排队小队长上线啦。",
    nextStep: "可以练一练看前方、慢慢走、不推挤。",
  },
  习惯故事小剧场: {
    question: "听完习惯故事后可以做什么？",
    options: ["完成一个小习惯", "不听就跑走", "把书丢在地上"],
    correct: "完成一个小习惯",
    feedback: "愿意把故事里的好习惯做到一步，故事小耳朵亮起来啦。",
    nextStep: "可以再听一个洗手、喝水、排队、整理或文明进餐故事。",
  },
  上课小坐姿: {
    question: "上课时身体可以怎么做？",
    options: ["小脚放稳", "身体乱晃", "趴在桌上"],
    correct: "小脚放稳",
    feedback: "小脚放稳，眼睛看老师，坐姿小星亮起来啦。",
    nextStep: "可以再玩一个任务，或者看看小贴纸。",
  },
  礼貌小种子: {
    question: "别人帮了你，可以说什么？",
    options: ["谢谢你", "我不要", "大声抢过来"],
    correct: "谢谢你",
    feedback: "会说谢谢，礼貌小种子发芽啦。",
    nextStep: "可以把这句话送给老师或同伴听。",
  },
  情绪小天气: {
    question: "生气或难过时，可以怎么说？",
    options: ["我有点难过", "我不说就推人", "我大喊大叫"],
    correct: "我有点难过",
    feedback: "能说出感受，就是照顾自己的好办法。",
    nextStep: "可以再说一句自己的小天气。",
  },
  整理小能手: {
    question: "看完书或玩完玩具后，可以怎么做？",
    options: ["放回原位", "扔在地上", "藏到椅子下"],
    correct: "放回原位",
    feedback: "图书玩具回家啦，整理小能手完成任务。",
    nextStep: "可以看看还有哪一本书要回家。",
  },
  喝水小勇士: {
    question: "口渴时可以怎么做？",
    options: ["坐好慢慢喝", "拿着杯子跑", "一直不喝水"],
    correct: "坐好慢慢喝",
    feedback: "坐好慢慢喝，喝水小勇士真稳。",
    nextStep: "可以把小水杯放回自己的位置。",
  },
  实验小侦探: {
    question: "做小实验时，可以先做什么？",
    options: ["认真观察", "抢材料", "先不听"],
    correct: "认真观察",
    feedback: "先观察再动手，实验小侦探上线啦。",
    nextStep: "可以说一句：我发现了什么。",
  },
};

type MealPhotoReviewResponse = {
  ok?: boolean;
  mode?: "demo" | "ai";
  message?: string;
  filename?: string;
  sizeKb?: number;
  summary?: string;
  plateState?: string;
  confidenceLabel?: string;
  highlightTags?: string[];
  scoreCards?: Array<{
    label: string;
    value: string;
  }>;
  guessedFoods?: string[];
  stickers?: string[];
  nextMission?: string;
  tips?: string[];
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  fallbackUsed?: boolean;
  source?: "ai-vision" | "demo-template";
  awardBadge?: boolean;
  badgeKind?: "verified_meal_review" | "experience_sticker";
  warning?: string;
  warningCode?: "vision_provider_failed" | "vision_response_invalid";
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type SpeakHandler = (text: string) => void;
type ChildVoiceRecognitionRef = { current: BrowserSpeechRecognition | null };

function startChildVoiceInput({
  recognitionRef,
  isListening,
  setListening,
  onResult,
  onSpeak,
  onStart,
  onUnsupported = "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
  onError = "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
}: {
  recognitionRef: ChildVoiceRecognitionRef;
  isListening: boolean;
  setListening: (next: boolean) => void;
  onResult: (text: string) => void;
  onSpeak?: SpeakHandler;
  onStart: string;
  onUnsupported?: string;
  onError?: string;
}) {
  if (typeof window === "undefined") {
    return;
  }

  if (isListening && recognitionRef.current) {
    recognitionRef.current.stop();
    setListening(false);
    return;
  }

  const voiceWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  const SpeechRecognitionApi = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

  if (!SpeechRecognitionApi) {
    onSpeak?.(onUnsupported);
    return;
  }

  try {
    recognitionRef.current?.stop();
  } catch {
    // Start a fresh child voice turn without surfacing browser internals.
  }

  const recognition = new SpeechRecognitionApi();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";

    if (transcript) {
      onResult(transcript);
    } else {
      onSpeak?.(onError);
    }
  };
  recognition.onerror = () => {
    onSpeak?.(onError);
    setListening(false);
  };
  recognition.onend = () => setListening(false);
  recognitionRef.current = recognition;
  try {
    recognition.start();
    setListening(true);
    onSpeak?.(onStart);
  } catch {
    setListening(false);
    onSpeak?.(onError);
  }
}

const storyStateStorageKey = "tongqu-growth-web-story-state";
const teacherAccountStorageKey = "tongqu-growth-web-teacher-account";
const teacherPasscodeStorageKey = "tongqu-growth-web-teacher-passcode";
const storyInputMaxLength = 120;
const miniGameThemeMap: Record<MiniGameKey, ThemeId> = {
  washSteps: "habit",
  queue: "habit",
  habitJudge: "habit",
  readingCheckin: "habit",
  childTalk: "habit",
  teacherTask: "habit",
  kindWords: "food",
  todayMenu: "food",
  foodObserve: "food",
  foodClue: "food",
  foodTrain: "food",
  foodGuess: "food",
  foodPreference: "food",
  foodReporter: "food",
  foodKitchen: "food",
  peerEncourage: "food",
  mealTray: "food",
  mealManners: "habit",
  habitTrafficLight: "habit",
};
const minnanTasteSteps = "闽食小列车、泉州美食摊位寻宝、美食观察与靠近一点点、小小闽食播报员";

function getMiniGameSourceLabel(gameKey: MiniGameKey) {
  const sourceLabels: Record<MiniGameKey, string> = {
    washSteps: "child-habit-wash-steps",
    queue: "child-habit-queue",
    habitJudge: "child-habit-task",
    readingCheckin: "child-reading-checkin",
    childTalk: "child-to-teacher",
    teacherTask: "teacher-assigned-task",
    kindWords: "child-expression",
    todayMenu: "child-today-menu",
    foodObserve: "child-food-observe",
    foodClue: "child-food-clue",
    foodTrain: "child-food-broadcast",
    foodGuess: "child-food-guess",
    foodPreference: "child-food-preference",
    foodReporter: "child-food-reporter",
    foodKitchen: "child-food-kitchen",
    peerEncourage: "child-peer-encourage",
    mealTray: "child-meal-tray",
    mealManners: "child-meal-manners",
    habitTrafficLight: "child-habit-traffic-light",
  };

  return sourceLabels[gameKey];
}

function shuffleItems<T>(items: readonly T[]) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function createFoodTrainRound() {
  const route = shuffleItems(foodTrainStations).slice(0, Math.min(4, foodTrainStations.length));
  const routeLabels = new Set(route.map((item) => item.label));
  const distractors = shuffleItems(foodTrainStations.filter((item) => !routeLabels.has(item.label))).slice(
    0,
    Math.max(0, 8 - route.length),
  );

  return {
    route,
    choices: shuffleItems([...route, ...distractors]),
  };
}

function createFoodTreasureRound(randomize = true) {
  const sensitiveFoods = minnanFoodClues.filter((item) => /^(香菇|小葱|蒜)$/.test(item.label));
  const targetSource = randomize ? shuffleItems(minnanFoodClues) : [...minnanFoodClues];
  const shuffledTargets = targetSource.slice(0, Math.min(5, minnanFoodClues.length));
  const hasSensitiveFood = shuffledTargets.some((item) => sensitiveFoods.some((food) => food.label === item.label));
  const targets =
    hasSensitiveFood || sensitiveFoods.length === 0
      ? shuffledTargets
      : [
          ...shuffledTargets.slice(0, Math.max(0, shuffledTargets.length - 1)),
          randomize ? shuffleItems(sensitiveFoods)[0] : sensitiveFoods[0],
        ];
  const targetLabels = new Set(targets.map((item) => item.label));
  const distractorSource = minnanFoodClues.filter((item) => !targetLabels.has(item.label));
  const distractors = (randomize ? shuffleItems(distractorSource) : distractorSource).slice(
    0,
    Math.max(0, 8 - targets.length),
  );

  return {
    targets,
    choices: randomize ? shuffleItems([...targets, ...distractors]) : [...targets, ...distractors],
  };
}

function createFoodGuessRound(randomize = true) {
  const sourceRounds = randomize ? shuffleItems(foodGuessRounds) : [...foodGuessRounds];

  return sourceRounds
    .slice(0, Math.min(4, foodGuessRounds.length))
    .map((round) => ({
      ...round,
      options: randomize ? shuffleItems(round.options) : [...round.options],
    }));
}

function createMenuFoodPreferenceChoices(todayMenuEntries: WeeklyMenuEntry[] = []) {
  const menuLabels = todayMenuEntries.flatMap((entry) => [
    entry.dishName,
    ...entry.focusIngredients,
    ...entry.ingredients,
  ]);
  const uniqueMenuLabels = uniqueTextItems(menuLabels);

  return dedupeFoodPreferenceOptions(uniqueMenuLabels.map(buildFoodPreferenceOption));
}

function createFoodPreferenceRound(todayMenuEntries: WeeklyMenuEntry[] = [], randomize = true) {
  const menuChoices = createMenuFoodPreferenceChoices(todayMenuEntries);
  const menuLabelSet = new Set(menuChoices.map((item) => item.label));
  const fallbackChoices = createFoodPreferenceChoices(randomize).filter((item) => !menuLabelSet.has(item.label));
  const foods = dedupeFoodPreferenceOptions(menuChoices.length > 0
    ? [...menuChoices, ...fallbackChoices].slice(0, 18)
    : fallbackChoices);

  return {
    foods,
    reasons: randomize ? shuffleItems(foodPreferenceReasons) : [...foodPreferenceReasons],
  };
}

const foodPreferenceFixedLabels = [
  "香菇",
  "小葱",
  "蒜",
  "青椒",
  "胡萝卜",
  "茄子",
  "豆腐",
  "鱼",
  "青菜",
  "肉粒",
  "海蛎",
  "紫菜",
  "芥菜",
  "蛏子",
  "面线",
  "鸡蛋",
  "地瓜粉",
];

function buildFoodPreferenceOption(label: string) {
  const existing = minnanFoodClues.find((food) => food.label === label || food.ingredients.includes(label));

  if (existing?.label === label) {
    return existing;
  }

  return {
    label,
    icon: getFoodPreferenceIcon(label),
    stall: "食材观察台",
    clue: `${label}今天还在慢慢认识。`,
    pictureHint: `找一找${label}的样子。`,
    colorShape: getFoodPreferenceShapeHint(label),
    ingredients: [label],
    ingredientIntro: `${label}是幼儿园餐桌上可能见到的食材，可以先看一看、闻一闻、说出名字。`,
    cultureStory: `${label}常会出现在家常饭菜或汤里，先认识它也是食育探索的一步。`,
    gentleTryTip: `如果今天还不熟悉${label}，可以先看一看或闻一闻，不急着吃完。`,
    approachSteps: foodPreferenceApproachSteps,
  };
}

function uniqueTextItems(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const text = item.trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    result.push(text);
  }

  return result;
}

function dedupeFoodPreferenceOptions<T extends ReturnType<typeof buildFoodPreferenceOption>>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = item.label.trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function getFoodOptionKey(food: ReturnType<typeof buildFoodPreferenceOption>, index = 0) {
  const label = food.label.trim() || "food";
  const stall = food.stall?.trim() || "card";

  return `${label}-${stall}-${index}`;
}

function getFoodCardNutritionText(label: string, ingredients: string[] = []) {
  const intro = buildFoodNutritionIntro(label, ingredients);

  return /营养小发现/.test(intro) ? intro : `${label}营养小发现：${intro}`;
}

function getMenuEntrySourceLabel(entry: WeeklyMenuEntry) {
  return "sourceLabel" in entry && typeof entry.sourceLabel === "string"
    ? entry.sourceLabel
    : "每周食谱自动发布";
}

function getChildMenuEntrySourceLabel(entry: WeeklyMenuEntry) {
  const label = getMenuEntrySourceLabel(entry);

  if (label === "临时改餐") {
    return "今天换餐";
  }

  if (label === "每周食谱自动发布") {
    return "本周食谱";
  }

  return label;
}

function getConfirmedMenuObservationImages(entry?: WeeklyMenuEntry): MenuObservationImage[] {
  return (entry?.observationImages ?? [])
    .filter((image) => image.teacherConfirmed && Boolean(image.url))
    .slice(0, 6);
}

function getMenuCoverImage(entry?: WeeklyMenuEntry) {
  if (entry?.teacherConfirmed && entry.coverImageUrl) {
    return entry.coverImageUrl;
  }

  return getConfirmedMenuObservationImages(entry)[0]?.url || "";
}

function getMenuMediaSourceText(source?: MenuMediaSource) {
  if (source === "video_frame") {
    return "今天视频里的图";
  }

  if (source === "teacher_uploaded") {
    return "老师确认图片";
  }

  if (source === "ai_generated") {
    return "AI生成，教师审核后使用";
  }

  return "食材小图卡";
}

function findMenuImageContext(foodLabel: string, entries: WeeklyMenuEntry[]) {
  const cleanFoodLabel = foodLabel.trim();
  const matchedEntry = cleanFoodLabel
    ? entries.find((entry) => {
        const candidates = [entry.dishName, ...entry.focusIngredients, ...entry.ingredients]
          .map((item) => item.trim())
          .filter(Boolean);

        return candidates.some((item) => item === cleanFoodLabel || item.includes(cleanFoodLabel) || cleanFoodLabel.includes(item));
      })
    : entries.find((entry) => getMenuCoverImage(entry));
  const images = getConfirmedMenuObservationImages(matchedEntry);
  const coverImageUrl = getMenuCoverImage(matchedEntry);

  return {
    entry: matchedEntry,
    images,
    coverImageUrl,
    mediaSource: matchedEntry?.mediaSource ?? images[0]?.mediaSource,
    sourceLabel: matchedEntry ? getMenuMediaSourceText(matchedEntry.mediaSource ?? images[0]?.mediaSource) : "",
  };
}

function findBestMenuImageContext(
  foodLabel: string,
  entries: WeeklyMenuEntry[],
  scene: FoodImageScene = "observationFoodImage",
) {
  const context = findMenuImageContext(foodLabel, entries);
  const priority: MenuMediaSource[] = ["teacher_uploaded", "video_frame", "ai_generated"];
  const bestImage = priority
    .map((source) => context.images.find((image) => image.mediaSource === source))
    .find(Boolean);
  const safeFoodImage = resolveSafeFoodImage(foodLabel || context.entry?.dishName || "", {
    scene,
    menuEntries: context.entry ? [context.entry] : [],
    ingredients: context.entry ? uniqueTextItems([...context.entry.focusIngredients, ...context.entry.ingredients]) : [],
  });
  const bestSource = bestImage?.mediaSource ?? context.mediaSource ?? safeFoodImage.mediaSource;
  const hasConfirmedImage = Boolean(bestImage?.url ?? context.coverImageUrl);

  return {
    ...context,
    coverImageUrl: bestImage?.url ?? context.coverImageUrl ?? safeFoodImage.url,
    mediaSource: bestSource,
    sourceLabel: hasConfirmedImage
      ? getMenuMediaSourceText(bestSource)
      : safeFoodImage.url
        ? safeFoodImage.sourceLabel
        : "",
    imageSource: safeFoodImage.sourceType,
    teacherConfirmed: safeFoodImage.teacherConfirmed,
    aiGenerated: safeFoodImage.aiGenerated,
    imageCandidates: safeFoodImage.candidates,
    fallbackSource: safeFoodImage.fallbackSource,
  };
}

function resolveFoodMaterialSource(
  selectedFood: string,
  customFoodName: string,
  selectedFoodInfo: ReturnType<typeof buildFoodPreferenceOption> | null,
  todayMenuEntries: WeeklyMenuEntry[] = [],
) {
  const cleanSelectedFood = selectedFood.trim();
  const cleanCustomFood = customFoodName.trim();
  const matchedMenu = cleanSelectedFood
    ? todayMenuEntries.find(
        (entry) =>
          entry.dishName === cleanSelectedFood ||
          entry.focusIngredients.includes(cleanSelectedFood) ||
          entry.ingredients.includes(cleanSelectedFood),
      )
    : todayMenuEntries[0];
  const matchedMenuIngredients = matchedMenu
    ? Array.from(new Set([...matchedMenu.focusIngredients, ...matchedMenu.ingredients])).slice(0, 5)
    : [];
  const isMenuIngredient =
    Boolean(cleanSelectedFood && matchedMenu) && matchedMenu?.dishName !== cleanSelectedFood;
  const subject =
    cleanCustomFood ||
    cleanSelectedFood ||
    matchedMenu?.dishName ||
    matchedMenu?.focusIngredients[0] ||
    selectedFoodInfo?.label ||
    "今日食材";
  const ingredients = matchedMenu
    ? Array.from(new Set([subject, ...matchedMenuIngredients])).slice(0, 5)
    : selectedFoodInfo?.ingredients ?? (cleanSelectedFood ? [cleanSelectedFood] : []);
  const focusIngredient = cleanSelectedFood || matchedMenu?.focusIngredients[0] || ingredients[0] || subject;

  return {
    subject,
    focusIngredient,
    ingredients,
    sourceLabel: matchedMenu
      ? isMenuIngredient
        ? "今日食谱重点食材"
        : "今日食谱菜品"
      : cleanCustomFood
        ? "幼儿输入的观察对象"
        : cleanSelectedFood
          ? "当前选择的食物卡"
          : "食材图文材料卡",
  };
}

function getFoodMaterialPalette(label: string) {
  const palettes = [
    { background: "#ecfeff", accent: "#0891b2", border: "#bae6fd" },
    { background: "#f0fdf4", accent: "#16a34a", border: "#bbf7d0" },
    { background: "#fff7ed", accent: "#ea580c", border: "#fed7aa" },
    { background: "#fefce8", accent: "#ca8a04", border: "#fde68a" },
    { background: "#fdf2f8", accent: "#db2777", border: "#fbcfe8" },
  ];
  const index = Math.abs(Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palettes.length;

  return palettes[index];
}

function getFoodDishShortIntro(label: string, ingredients: string[] = []) {
  return getCatalogFoodDishShortIntro(label, ingredients);
}

function matchFoodPreferenceReasonFromSpeech(text: string) {
  const cleanText = text.replace(/\s+/g, "");
  const matchers = [
    { label: "味道重", pattern: /味道.{0,4}重|味道重|太咸|太辣|很辣|味道浓|太浓|重口/ },
    { label: "气味冲", pattern: /气味|味儿|味道冲|闻起来|太臭|太香|冲鼻/ },
    { label: "口感怪", pattern: /口感|怪怪|奇怪|黏|粘|沙沙|刺刺|颗粒/ },
    { label: "颜色不熟悉", pattern: /颜色|黑黑|绿绿|黄黄|不熟悉|没见过/ },
    { label: "太硬", pattern: /太硬|硬硬|咬不动|不好咬/ },
    { label: "太滑", pattern: /太滑|滑滑|软软|滑溜|溜/ },
    { label: "今天没胃口", pattern: /没胃口|不饿|吃不下|今天不想吃/ },
    { label: "以前没吃过", pattern: /没吃过|第一次|不知道|不认识|陌生/ },
  ];

  return matchers.find((item) => item.pattern.test(cleanText))?.label ?? "以前没吃过";
}

function SafeFoodImage({
  image,
  alt,
  className,
}: {
  image: SafeFoodImageResolution | FoodImageResolution | { url?: string; candidates?: SafeFoodImageCandidate[] };
  alt: string;
  className: string;
}) {
  const candidates = useMemo(() => {
    const explicitCandidates = "candidates" in image && Array.isArray(image.candidates) ? image.candidates : [];
    const directUrl = image.url
      ? [
          {
            url: image.url,
            sourceType: "sourceType" in image ? image.sourceType : "fallback_icon",
            sourceLabel: "sourceLabel" in image ? image.sourceLabel : "菜品图",
            fallbackSource:
              "fallbackSource" in image
                ? image.fallbackSource
                : "sourceLabel" in image
                  ? image.sourceLabel
                  : "菜品图",
            teacherConfirmed: "teacherConfirmed" in image ? image.teacherConfirmed : true,
            aiGenerated: "aiGenerated" in image ? image.aiGenerated : false,
          } satisfies SafeFoodImageCandidate,
        ]
      : [];
    const seen = new Set<string>();

    return [...explicitCandidates, ...directUrl].filter((candidate) => {
      if (!candidate.url || seen.has(candidate.url)) {
        return false;
      }

      seen.add(candidate.url);
      return true;
    });
  }, [image]);
  const candidateKey = candidates.map((candidate) => candidate.url).join("|");

  return <SafeFoodImageInner key={candidateKey || alt} candidates={candidates} alt={alt} className={className} />;
}

function getSafeFoodImageBadge(candidate: SafeFoodImageCandidate) {
  if (candidate.aiGenerated || candidate.sourceType === "ai_generated_teacher_confirmed") {
    return "AI生成，教师审核后使用";
  }

  if (candidate.sourceType === "local_food_asset" || candidate.sourceType === "local_ingredient_asset") {
    return candidate.sourceLabel || "素材图，教师审核后使用";
  }

  if (candidate.sourceType === "fallback_icon") {
    return "示例图，教师审核后使用";
  }

  return "";
}

function SafeFoodImageInner({
  candidates,
  alt,
  className,
}: {
  candidates: SafeFoodImageCandidate[];
  alt: string;
  className: string;
}) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [showFallbackCard, setShowFallbackCard] = useState(false);
  const currentCandidate = candidates[candidateIndex];

  if (showFallbackCard || !currentCandidate) {
    return (
      <span
        aria-label={alt}
        className={`flex items-center justify-center bg-orange-50 text-center text-sm font-semibold text-orange-900 ${className}`}
        role="img"
      >
        {alt.replace(/菜品图|观察图|播报作品图|成品图|做好啦|播报完成/g, "") || "今日食物"}
      </span>
    );
  }

  const badge = getSafeFoodImageBadge(currentCandidate);
  const imageFitClass = className.includes("object-contain") ? "object-contain" : "object-cover";

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentCandidate.url}
        alt={alt}
        className={`h-full w-full ${imageFitClass}`}
        onError={() => {
          setCandidateIndex((currentIndex) => {
            if (currentIndex < candidates.length - 1) {
              return currentIndex + 1;
            }

            setShowFallbackCard(true);
            return currentIndex;
          });
        }}
      />
      {badge ? (
        <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] rounded-full bg-amber-100/95 px-2 py-1 text-[10px] font-semibold leading-4 text-amber-950 shadow-sm">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

function FoodMiniMaterialCard({
  label,
  ingredients = [],
  compact = false,
  imageResolution,
}: {
  label: string;
  ingredients?: string[];
  compact?: boolean;
  imageResolution?: FoodImageResolution;
}) {
  const palette = getFoodMaterialPalette(label);
  const icon = getFoodPreferenceIcon(label);
  const resolvedImage =
    imageResolution ??
    resolveSafeFoodImage(label, {
      scene: "observationFoodImage",
      ingredients,
      allowPlaceholder: true,
    });
  const displayName = resolvedImage.label || label;
  const shapeHint = getFoodDishShortIntro(label, ingredients);

  return (
    <span
      className={`block rounded-[1.2rem] border px-3 py-3 text-left shadow-sm ${
        compact ? "min-h-[116px]" : "min-h-[150px]"
      }`}
      style={{ backgroundColor: palette.background, borderColor: palette.border }}
    >
      <span className="block overflow-hidden rounded-[1rem] bg-white p-1.5 shadow-sm">
        <SafeFoodImage
          image={resolvedImage}
          alt={`${displayName}菜品图`}
          className={compact ? "h-24 w-full rounded-[0.8rem] object-cover" : "h-32 w-full rounded-[0.9rem] object-cover"}
        />
      </span>
      <span className="mt-2 flex items-center gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.8rem] bg-white text-xl shadow-sm"
          style={{ color: palette.accent }}
        >
          {icon === "🥢" ? displayName.slice(0, 1) : icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{displayName}</span>
          <span className="mt-1 block text-[11px] leading-4 text-slate-600">
            {shapeHint}
          </span>
        </span>
      </span>
      {!compact && resolvedImage.sourceLabel ? (
        <span
          className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
            resolvedImage.aiGenerated ? "bg-amber-100 text-amber-900" : "bg-white/80 text-slate-600"
          }`}
        >
          {resolvedImage.aiGenerated ? "AI生成，教师审核后使用" : resolvedImage.sourceLabel}
        </span>
      ) : null}
    </span>
  );
}

function createFoodPreferenceChoices(randomize = true) {
  const choices = foodPreferenceFixedLabels.map(buildFoodPreferenceOption);

  return randomize ? shuffleItems(choices) : choices;
}

function resolveFoodMenuContext(label: string, todayMenuEntries: WeeklyMenuEntry[] = []) {
  const cleanLabel = label.trim();
  const matchedEntry = todayMenuEntries.find(
    (entry) =>
      entry.dishName === cleanLabel ||
      entry.ingredients.includes(cleanLabel) ||
      entry.focusIngredients.includes(cleanLabel),
  );

  if (!matchedEntry) {
    return {
      menuDate: undefined,
      mealType: undefined,
      dishName: cleanLabel,
      ingredientName: cleanLabel,
    };
  }

  const isDish = matchedEntry.dishName === cleanLabel;
  const ingredientName = isDish
    ? matchedEntry.focusIngredients[0] ?? matchedEntry.ingredients[0] ?? cleanLabel
    : cleanLabel;

  return {
    menuDate: matchedEntry.date,
    mealType: matchedEntry.mealType,
    dishName: matchedEntry.dishName,
    ingredientName,
  };
}

function getFoodPreferenceIcon(label: string) {
  if (/香菇/.test(label)) return "🍄";
  if (/葱|青菜|芥菜/.test(label)) return "🌿";
  if (/蒜/.test(label)) return "🧄";
  if (/胡萝卜/.test(label)) return "🥕";
  if (/茄子/.test(label)) return "🍆";
  if (/豆腐/.test(label)) return "⬜";
  if (/鱼|海蛎|蛏/.test(label)) return "🐟";
  if (/紫菜/.test(label)) return "🌊";
  if (/面线/.test(label)) return "🥣";
  if (/鸡蛋/.test(label)) return "🥚";
  if (/地瓜粉/.test(label)) return "🥄";
  return "🥢";
}

function getFoodPreferenceShapeHint(label: string) {
  if (/香菇/.test(label)) return "棕色、像小伞，味道比较明显。";
  if (/小葱|葱/.test(label)) return "绿色、细细碎碎，常撒在汤或饭上。";
  if (/蒜/.test(label)) return "白色小瓣，气味比较冲。";
  if (/青椒/.test(label)) return "绿色或红色，边边弯弯，味道比较明显。";
  if (/胡萝卜/.test(label)) return "橙色、长长的，熟了会变软。";
  if (/茄子/.test(label)) return "紫色、软软滑滑，形状长长。";
  if (/豆腐/.test(label)) return "白白软软，方方块块。";
  if (/鱼/.test(label)) return "白白嫩嫩，有一点海味或鱼香。";
  if (/青菜|芥菜/.test(label)) return "绿色叶子，煮熟后软软的。";
  if (/海蛎|蛏/.test(label)) return "来自海边，味道比较鲜。";
  if (/紫菜/.test(label)) return "深紫色或黑绿色，薄薄一片。";
  if (/面线/.test(label)) return "细细长长，泡在汤里软软的。";
  if (/鸡蛋/.test(label)) return "黄黄白白，熟了香香软软。";
  if (/地瓜粉/.test(label)) return "会让食物变得软糯或金黄。";
  return `${label}的颜色、形状和气味可以先观察。`;
}

function getKitchenDishDisplayKey(label: string) {
  if (/闽南肉粽|烧肉粽|肉粽/.test(label)) return "烧肉粽";
  if (/泉州海蛎煎|石井海蛎煎|海蛎煎/.test(label)) return "泉州海蛎煎";
  if (/润饼菜|润饼/.test(label)) return "润饼菜";
  if (/崇武鱼卷|鱼卷/.test(label)) return "崇武鱼卷";

  return label;
}

function createFoodKitchenRound(randomize = true) {
  const recipeMap = new Map<string, FoodKitchenRecipe>();

  foodKitchenRecipes.forEach((recipe) => {
    const key = getKitchenDishDisplayKey(recipe.label);
    const existing = recipeMap.get(key);

    if (!existing || recipe.label === key) {
      recipeMap.set(key, recipe);
    }
  });

  const recipes = Array.from(recipeMap.values());

  return randomize ? shuffleItems(recipes) : recipes;
}

function createFoodReporterRound(randomize = true): FoodKitchenRecipe[] {
  const recipes = foodReporterFoods.map((food) => ({
    label: food.label,
    icon: food.icon,
    area: "小小闽食播报台",
    actions: ["选作品", "说一句原话", "整理播报词", "听一听", "提交分享"],
    chant: food.reporterLine,
  }));

  return randomize ? shuffleItems(recipes) : recipes;
}

function getThemeReadyStatus(themeId: ThemeId) {
  return themeId === "food"
    ? "闽食成长岛准备好了：今天像逛泉州美食小岛一样，认识名字、食材和小故事。"
    : "幼习宝一日生活提醒准备好了：今天先练洗手、喝水、如厕、排队、整理和文明进餐。";
}

function formatFoodList(items: string[]) {
  return items.length > 0 ? items.join("、") : "泉州海蛎煎、面线糊和润饼菜";
}

function formatInteractionRecord(items: string[]) {
  return items.filter(Boolean).slice(0, 5).join("、") || "完成了一个小步骤";
}

const aiObservationGameKeys = new Set<MiniGameKey>([
  "washSteps",
  "queue",
  "readingCheckin",
  "childTalk",
  "teacherTask",
  "mealManners",
  "habitTrafficLight",
  "todayMenu",
  "foodTrain",
  "foodObserve",
  "foodGuess",
  "foodPreference",
  "foodReporter",
  "foodKitchen",
]);

function getGameInstanceMetadata(
  gameKey: MiniGameKey,
  detail: Partial<
    Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">
  > = {},
) {
  if (detail.gameInstanceId || detail.gameInstanceTitle || detail.gameInstanceMechanic) {
    return {
      gameInstanceId: detail.gameInstanceId,
      gameInstanceMechanic: detail.gameInstanceMechanic,
      gameInstanceTitle: detail.gameInstanceTitle,
      gameRuleName: detail.gameRuleName,
    };
  }

  const defaults: Partial<Record<MiniGameKey, {
    gameInstanceId: string;
    gameInstanceMechanic: string;
    gameInstanceTitle: string;
    gameRuleName: string;
  }>> = {
    foodGuess: {
      gameInstanceId: "foodGuessChest",
      gameInstanceMechanic: "treasureClue",
      gameInstanceTitle: "美食猜猜乐",
      gameRuleName: "宝箱线索猜食材",
    },
    todayMenu: {
      gameInstanceId: "todayMenuPlate",
      gameInstanceMechanic: "todayMenu",
      gameInstanceTitle: "今日食谱认识",
      gameRuleName: "菜品营养点听",
    },
    foodKitchen: {
      gameInstanceId: "foodKitchenCounter",
      gameInstanceMechanic: "recipeSteps",
      gameInstanceTitle: "泉州小厨房",
      gameRuleName: "料理步骤台",
    },
    foodObserve: {
      gameInstanceId: "foodTreasureMap",
      gameInstanceMechanic: "stallMap",
      gameInstanceTitle: "泉州美食摊位寻宝",
      gameRuleName: "摊位地图找食材",
    },
    foodPreference: {
      gameInstanceId: "foodApproachLadder",
      gameInstanceMechanic: "approachLadder",
      gameInstanceTitle: "美食观察与靠近一点点",
      gameRuleName: "靠近阶梯",
    },
    foodReporter: {
      gameInstanceId: "foodReporterStage",
      gameInstanceMechanic: "broadcastStage",
      gameInstanceTitle: "小小闽食播报员",
      gameRuleName: "作品播报台",
    },
    foodTrain: {
      gameInstanceId: "foodTrainTrack",
      gameInstanceMechanic: "trainRoute",
      gameInstanceTitle: "闽食小列车",
      gameRuleName: "列车站点推进",
    },
    habitTrafficLight: {
      gameInstanceId: "habitTrafficLightStage",
      gameInstanceMechanic: "trafficDecision",
      gameInstanceTitle: "好习惯红绿牌",
      gameRuleName: "红绿牌判断",
    },
    mealManners: {
      gameInstanceId: "mealMannersRhythm",
      gameInstanceMechanic: "rhythmActions",
      gameInstanceTitle: "文明进餐操",
      gameRuleName: "节拍动作轨道",
    },
    readingCheckin: {
      gameInstanceId: "habitStoryTheater",
      gameInstanceMechanic: "storyCurtain",
      gameInstanceTitle: "习惯故事小剧场",
      gameRuleName: "幕布三幕推进",
    },
    childTalk: {
      gameInstanceId: "childWarmMailbox",
      gameInstanceMechanic: "warmMailbox",
      gameInstanceTitle: "温馨小信箱",
      gameRuleName: "幼儿表达送达",
    },
    teacherTask: {
      gameInstanceId: "teacherAssignedTask",
      gameInstanceMechanic: "teacherTaskSteps",
      gameInstanceTitle: "老师给我的任务",
      gameRuleName: "教师小任务完成",
    },
  };

  return defaults[gameKey] ?? {
    gameInstanceId: gameKey,
    gameInstanceMechanic: "taskCards",
    gameInstanceTitle: getMiniGameSourceLabel(gameKey),
    gameRuleName: "图卡任务",
  };
}

function getHabitTaskGameInstance(title: string) {
  if (title.includes("洗手")) {
    return {
      gameInstanceId: "washBubbleSteps",
      gameInstanceMechanic: "cleanBubble",
      gameInstanceTitle: "洗手小任务",
      gameRuleName: "泡泡洗手顺序",
    };
  }

  if (title.includes("喝水")) {
    return {
      gameInstanceId: "drinkWaterCup",
      gameInstanceMechanic: "waterBalance",
      gameInstanceTitle: "喝水小任务",
      gameRuleName: "水杯平衡赛",
    };
  }

  if (title.includes("如厕")) {
    return {
      gameInstanceId: "toiletRoute",
      gameInstanceMechanic: "toiletRoutine",
      gameInstanceTitle: "如厕小任务",
      gameRuleName: "如厕路线图",
    };
  }

  if (title.includes("排队")) {
    return {
      gameInstanceId: "queueLine",
      gameInstanceMechanic: "queueDistance",
      gameInstanceTitle: "排队小队长",
      gameRuleName: "安全队列",
    };
  }

  if (title.includes("整理")) {
    return {
      gameInstanceId: "tidyHomes",
      gameInstanceMechanic: "tidyReturn",
      gameInstanceTitle: "整理小能手",
      gameRuleName: "物品回家",
    };
  }

  return {
    gameInstanceId: "habitTaskCards",
    gameInstanceMechanic: "taskCards",
    gameInstanceTitle: title,
    gameRuleName: "图卡任务",
  };
}

function getRewardVisualForRecord(record: MiniGameRecord) {
  const mechanic = record.gameInstanceMechanic ?? getGameInstanceMetadata(record.gameKey).gameInstanceMechanic;
  const title = record.gameInstanceTitle ?? getGameInstanceMetadata(record.gameKey).gameInstanceTitle;
  const visualMap: Record<string, { icon: string; tone: string; verb: string }> = {
    approachLadder: { icon: "🪜", tone: "bg-emerald-50 text-emerald-950", verb: "靠近一步" },
    broadcastStage: { icon: "🎙️", tone: "bg-rose-50 text-rose-950", verb: "播报完成" },
    cleanBubble: { icon: "🫧", tone: "bg-cyan-50 text-cyan-950", verb: "泡泡收集" },
    queueDistance: { icon: "🚶", tone: "bg-emerald-50 text-emerald-950", verb: "队列稳定" },
    recipeSteps: { icon: "🍳", tone: "bg-orange-50 text-orange-950", verb: "步骤完成" },
    rhythmActions: { icon: "🥣", tone: "bg-amber-50 text-amber-950", verb: "节拍完成" },
    stallMap: { icon: "🏮", tone: "bg-teal-50 text-teal-950", verb: "摊位发现" },
    storyCurtain: { icon: "🎭", tone: "bg-violet-50 text-violet-950", verb: "剧场通关" },
    taskCards: { icon: "⭐", tone: "bg-slate-50 text-slate-950", verb: "任务完成" },
    todayMenu: { icon: "🍱", tone: "bg-cyan-50 text-cyan-950", verb: "食谱认识" },
    tidyReturn: { icon: "🧺", tone: "bg-orange-50 text-orange-950", verb: "物品回家" },
    toiletRoutine: { icon: "👣", tone: "bg-violet-50 text-violet-950", verb: "路线完成" },
    trafficDecision: { icon: "🚦", tone: "bg-rose-50 text-rose-950", verb: "判断正确" },
    trainRoute: { icon: "🚂", tone: "bg-teal-50 text-teal-950", verb: "到站成功" },
    treasureClue: { icon: "🎁", tone: "bg-cyan-50 text-cyan-950", verb: "宝箱打开" },
    waterBalance: { icon: "🥤", tone: "bg-sky-50 text-sky-950", verb: "小口喝水" },
  };
  const visual = visualMap[mechanic ?? ""] ?? visualMap.taskCards;

  return {
    ...visual,
    rule: record.gameRuleName ?? getGameInstanceMetadata(record.gameKey).gameRuleName ?? visual.verb,
    title,
  };
}

function GameRewardTrail({
  records,
}: {
  records: MiniGameRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-[1.4rem] bg-white/78 px-4 py-4 text-sm font-semibold text-slate-500 shadow-sm">
        今天还没有游戏贴纸。先从一个入口开始，完成后这里会出现对应的游戏奖励。
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {records.slice(0, 4).map((record) => {
        const visual = getRewardVisualForRecord(record);

        return (
          <div
            key={`${record.gameKey}-${record.completedAt}-${record.badgeName}`}
            className={`min-h-32 rounded-[1.35rem] px-4 py-4 shadow-sm ${visual.tone}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-white text-2xl shadow-sm">
                {visual.icon}
              </span>
              <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold shadow-sm">
                {visual.verb}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold">{visual.title}</p>
            <p className="mt-1 text-xs leading-5 opacity-75">{visual.rule}</p>
            <p className="mt-2 line-clamp-1 text-[11px] opacity-70">
              {record.pickedItems.slice(0, 3).join("、") || record.badgeName}
            </p>
          </div>
        );
      })}
    </div>
  );
}

type GameCompletionState = {
  title: string;
  badgeName: string;
  detail: string;
  themeId: ThemeId;
  panelKey: ChildPanelKey;
  gameKey?: MiniGameKey;
  imageUrl?: string;
  imageAlt?: string;
  imageSourceLabel?: string;
  imageAiGenerated?: boolean;
};

function GameCompletionPanel({
  completion,
  onReplay,
  onBackToDirectory,
  onSpeak,
}: {
  completion: GameCompletionState;
  onReplay: () => void;
  onBackToDirectory: () => void;
  onSpeak?: SpeakHandler;
}) {
  const tone =
    completion.themeId === "food"
      ? "from-cyan-50 via-white to-orange-50 text-cyan-950"
      : "from-amber-50 via-white to-emerald-50 text-emerald-950";

  return (
    <div className={`rounded-[2rem] bg-gradient-to-br ${tone} p-5 shadow-[0_18px_50px_rgba(35,88,95,0.12)]`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.3rem] bg-white text-4xl shadow-sm">
            🏅
          </span>
          <div>
            <p className="text-sm font-semibold opacity-75">完成啦</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950">{completion.title}</h3>
          </div>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">
          {completion.badgeName}
        </span>
      </div>
      <p className="mt-4 rounded-[1.2rem] bg-white/82 px-4 py-3 text-sm font-semibold leading-7 text-slate-800">
        {completion.detail || "这次游戏完成啦，老师看得到你的努力。"}
      </p>
      {completion.imageUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.4rem] bg-white/86 p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={completion.imageUrl}
            alt={completion.imageAlt ?? "完成图片"}
            className="h-48 w-full rounded-[1.1rem] object-cover"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">这道菜做好啦</p>
            {completion.imageSourceLabel ? (
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  completion.imageAiGenerated
                    ? "bg-amber-100 text-amber-900"
                    : "bg-cyan-100 text-cyan-900"
                }`}
              >
                {completion.imageSourceLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={onReplay}
          className="rounded-full bg-orange-400 px-5 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-300"
          type="button"
        >
          再玩一次
        </button>
        <button
          onClick={onBackToDirectory}
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5"
          type="button"
        >
          🏠 回到我的小首页
        </button>
        <SpeechCueButton
          text={`${completion.title}完成啦，获得${completion.badgeName}。小贴纸来啦。`}
          onSpeak={onSpeak}
          label="听完成"
          tone={completion.themeId === "food" ? "cyan" : "emerald"}
        />
      </div>
    </div>
  );
}

function getAiObservationStage(gameKey: MiniGameKey, pickedItems: string[]) {
  const pickedText = pickedItems.join("、");

  if (gameKey === "washSteps") {
    return "一日生活常规从听提醒，进入能按顺序完成洗手步骤的阶段";
  }

  if (gameKey === "queue") {
    return "一日生活常规从听提醒，进入能选择喝水、如厕、排队或整理合适做法的阶段";
  }

  if (gameKey === "readingCheckin") {
    return "习惯故事从愿意听，进入能翻页并完成阅读打卡的阶段";
  }

  if (gameKey === "mealManners") {
    return "进餐习惯从愿意听口令，进入能模仿动作和迁移到餐前餐后的阶段";
  }

  if (gameKey === "habitTrafficLight") {
    return "好习惯判断从愿意选择，进入能说出替代做法的阶段";
  }

  if (gameKey === "todayMenu") {
    return "今日食谱从看菜名，进入愿意听营养并选择观察对象的阶段";
  }

  if (gameKey === "foodPreference") {
    if (/尝|吃|一点/.test(pickedText)) {
      return "食物接受处于愿意尝一点的阶段";
    }

    if (/闻|香|味/.test(pickedText)) {
      return "食物接受处于愿意闻一闻的阶段";
    }

    if (/说|名字|介绍/.test(pickedText)) {
      return "食物接受处于能说出名字和发现的阶段";
    }

    return "食物接受处于愿意看一看、正在认识的阶段";
  }

  if (gameKey === "foodKitchen") {
    return "闽食探索从认识食物，进入按步骤参与和作品播报的阶段";
  }

  if (gameKey === "foodTrain" || gameKey === "foodObserve" || gameKey === "foodReporter") {
    return "闽食探索从认识名字，进入找食材、听故事和说发现的阶段";
  }

  return "孩子已留下可供教师继续观察和家园同步的互动线索";
}

function buildAiMiniGameCompletionCopy(
  gameKey: MiniGameKey,
  badgeName: string,
  pickedItems: string[],
  contentConfig?: EditableGameContent,
) {
  if (!aiObservationGameKeys.has(gameKey)) {
    return null;
  }

  const title = contentConfig?.title.trim() || getMiniGameSourceLabel(gameKey);
  const pickedText = formatInteractionRecord(pickedItems);
  const reminder = contentConfig?.reminderText.trim();
  const fallback = `${title}完成啦，小贴纸来啦。老师看得到这次小脚印。`;
  const statusByGame: Partial<Record<MiniGameKey, string>> = {
    washSteps: "小手洗干净啦。打湿、搓泡泡、冲干净、擦小手都做到啦。",
    queue: "好习惯闯关完成啦。你会选一个舒服又安全的小动作。",
    readingCheckin: "今天听了一个故事，也说出了一个小发现。",
    childTalk: "你把心里的话送给老师了。老师会认真看见你。",
    teacherTask: "老师给的小任务完成啦。你慢慢试了一小步。",
    mealManners: "吃饭小动作完成啦。扶好碗、慢慢嚼，做得很稳。",
    habitTrafficLight: "红绿牌举对啦。你知道哪个做法更合适。",
    todayMenu: "你认识了一种食物。先看一看、听一听，真不错。",
    foodTrain: "闽食小列车到站啦。你认识了新的泉州味道。",
    foodObserve: "你认识了一种食物，也找到了它的小线索。",
    foodGuess: "美食猜猜乐完成啦。你找到了食材小线索。",
    foodPreference: "你愿意靠近一点点。今天先做到这一小步就很好。",
    foodReporter: "小播报员说得真清楚。声音小舞台亮起来啦。",
    foodKitchen: "小厨师完成一道菜。你会按步骤慢慢来。",
  };

  return {
    feedback: `${title}完成啦 · ${badgeName}`,
    status: [reminder || statusByGame[gameKey] || fallback, `刚刚做了：${pickedText}`]
      .filter(Boolean)
      .join(" "),
  };
}

function buildKitchenStepSpeech(recipe: FoodKitchenRecipe, nextAction?: string) {
  return nextAction
    ? `${recipe.label}小厨房，下一步是：${nextAction}。${recipe.chant}`
    : `${recipe.label}小厨房完成啦。${recipe.chant}你愿意参与制作步骤，也会帮忙整理。`;
}

function buildMiniGameCompletionCopy(
  gameKey: MiniGameKey,
  badgeName: string,
  pickedItems: string[] = [],
  contentConfig?: EditableGameContent,
) {
  const configuredTitle = contentConfig?.title.trim();
  const configuredReminder = contentConfig?.reminderText.trim();
  const aiObservationCopy = buildAiMiniGameCompletionCopy(gameKey, badgeName, pickedItems, contentConfig);

  if (aiObservationCopy) {
    return aiObservationCopy;
  }

  if (gameKey === "washSteps") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "小手清洁任务"}`,
      status: configuredReminder || "小手清洁任务完成啦：打湿、泡泡、搓洗、冲净、擦干，每一步都记住了。",
    };
  }

  if (gameKey === "queue") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "一日好习惯路线"}`,
      status: configuredReminder || "一日好习惯路线完成啦：喝水、整理、排队、如厕都能自己选合适做法。",
    };
  }

  if (gameKey === "habitJudge") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "安全小判断"}`,
      status: configuredReminder || "安全小判断完成啦：你能分清好做法和需要换一换的做法。",
    };
  }

  if (gameKey === "readingCheckin") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "习惯故事小剧场"}`,
      status: configuredReminder || "习惯故事小剧场完成啦：你认真听故事，也完成了阅读打卡。",
    };
  }

  if (gameKey === "mealManners") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "文明进餐操"}`,
      status: configuredReminder || "文明进餐操完成啦：扶好碗、坐稳、细嚼慢咽、按需取餐和餐后整理都练习到了。",
    };
  }

  if (gameKey === "habitTrafficLight") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "好习惯红绿牌"}`,
      status: configuredReminder || "好习惯红绿牌完成啦：能分清好习惯和需要调整的做法。",
    };
  }

  if (gameKey === "kindWords") {
    return {
      feedback: `刚刚点亮：${badgeName} · 闽食三步完成`,
      status: `闽食尝试三步完成啦：${minnanTasteSteps}。`,
    };
  }

  if (gameKey === "foodObserve") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "泉州美食摊位寻宝"}`,
      status: configuredReminder || "泉州美食摊位寻宝完成啦：认识名字、找食材、听故事、说发现。",
    };
  }

  if (gameKey === "foodClue") {
    return {
      feedback: `刚刚点亮：${badgeName} · 闽食摊位寻宝`,
      status: "你找到了泉州美食摊位宝藏，也认识了更多家乡食材。",
    };
  }

  if (gameKey === "foodTrain") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "闽食小列车"}`,
      status: configuredReminder || "闽食小列车到站啦：认识了多个泉州美食名字，也练习了小小播报。",
    };
  }

  if (gameKey === "foodGuess") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "美食猜猜乐"}`,
      status: configuredReminder || "美食猜猜乐完成啦：你能根据线索找到食材，也能做小小美食播报员。",
    };
  }

  if (gameKey === "foodPreference") {
    const pickedText = pickedItems.length > 0 ? pickedItems.join("、") : "今天都愿意试一点";

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || pickedText}`,
      status: configuredReminder
        ? `${configuredReminder} 这次选了：${pickedText}。`
        : `你愿意靠近一点点：${pickedText}。老师看得到你的勇敢小步。`,
    };
  }

  if (gameKey === "foodReporter") {
    const pickedText = formatFoodList(pickedItems);

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "闽食小小播报员"}`,
      status: configuredReminder
        ? `${configuredReminder} 本次播报：${pickedText}。`
        : `闽食小小播报员完成啦：${pickedText}，能介绍一种家乡美食，也能说出一个发现。`,
    };
  }

  if (gameKey === "foodKitchen") {
    const pickedText = formatFoodList(pickedItems);

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "泉州小厨房"}`,
      status: configuredReminder
        ? `${configuredReminder} 本次小厨房：${pickedText}。`
        : `泉州小厨房完成啦：${pickedText}，能按步骤参与制作角色扮演，也懂得帮忙和整理。`,
    };
  }

  if (gameKey === "peerEncourage") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "同伴鼓励小贴纸"}`,
      status: configuredReminder || "同伴鼓励小贴纸收好啦，现在可以继续玩闽食小小播报员。",
    };
  }

  if (gameKey === "mealTray") {
    const pickedText = formatFoodList(pickedItems);

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "午餐小餐盘"}`,
      status: configuredReminder
        ? `${configuredReminder} 这次看到了：${pickedText}。`
        : `午餐小餐盘收好啦：${pickedText}。现在可以继续玩泉州小厨房。`,
    };
  }

  return {
    feedback: `刚刚点亮：${badgeName}`,
    status: `完成啦，点亮了${badgeName}。`,
  };
}

function buildRepeatedMiniGameStatus(gameKey: MiniGameKey, contentConfig?: EditableGameContent) {
  const configuredTitle = contentConfig?.title.trim();
  const configuredReminder = contentConfig?.reminderText.trim();

  if (gameKey === "washSteps") {
    return `${configuredTitle || "小手清洁任务"}已经玩过一次啦，可以继续听提示、按图卡练习洗手顺序。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "queue") {
    return `${configuredTitle || "一日好习惯路线"}已经玩过一次啦，可以继续练习喝水、整理、排队和如厕选择。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "habitJudge") {
    return `${configuredTitle || "好习惯红绿牌"}已经玩过一次啦，可以继续举红绿牌。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "readingCheckin") {
    return `${configuredTitle || "习惯故事小剧场"}已经玩过一次啦，可以继续找绘本、听绘本，再完成阅读打卡。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "mealManners") {
    return `${configuredTitle || "文明进餐操"}已经玩过一次啦，可以继续跟口令练习。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "habitTrafficLight") {
    return `${configuredTitle || "好习惯红绿牌"}已经玩过一次啦，可以继续听行为、举红绿牌、说正确做法。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "kindWords") {
    return "闽食探索已经玩过一次啦，可以继续练习认名字、找食材、说发现。";
  }

  if (gameKey === "foodObserve") {
    return `${configuredTitle || "泉州美食摊位寻宝"}已经玩过一次啦，可以继续听线索、找摊位、认食材和听小故事。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodClue") {
    return "闽食摊位寻宝已经玩过一次啦，可以继续认一认这些泉州闽南食物。";
  }

  if (gameKey === "foodTrain") {
    return `${configuredTitle || "闽食小列车"}已经玩过一次啦，可以继续听站名、认美食、练习小小播报。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodGuess") {
    return `${configuredTitle || "美食猜猜乐"}已经玩过一次啦，可以继续根据线索找食材。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "peerEncourage") {
    return `${configuredTitle || "小小播报员"}已经玩过一次啦，可以继续练习介绍一种泉州美食。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodPreference") {
    return `${configuredTitle || "美食观察与靠近一点点"}已经玩过一次啦，可以继续换一种食物说说今天的感受。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodReporter") {
    return `${configuredTitle || "闽食小小播报员"}已经玩过一次啦，可以继续换一种泉州美食，练习名字、食材和发现。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodKitchen") {
    return `${configuredTitle || "泉州小厨房"}已经玩过一次啦，可以继续换一道泉州美食，按步骤做区域游戏。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "mealTray") {
    return `${configuredTitle || "午餐小餐盘"}已经玩过一次啦，可以继续玩泉州小厨房。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  return "这个小任务已经玩过一次啦，可以继续练习。";
}

function SpeechCueButton({
  text,
  onSpeak,
  label = "听提示",
  tone = "slate",
}: {
  text: string;
  onSpeak?: SpeakHandler;
  label?: string;
  tone?: "slate" | "teal" | "cyan" | "rose" | "orange" | "amber" | "emerald" | "violet";
}) {
  const [voiceState, setVoiceState] = useState<"idle" | "playing" | "replay">("idle");
  const resetTimerRef = useRef<number | null>(null);
  const toneClassMap = {
    slate: "bg-sky-100 text-sky-900 hover:bg-sky-200",
    teal: "bg-teal-700 text-white hover:bg-teal-800",
    cyan: "bg-cyan-700 text-white hover:bg-cyan-800",
    rose: "bg-rose-600 text-white hover:bg-rose-700",
    orange: "bg-orange-700 text-white hover:bg-orange-800",
    amber: "bg-amber-100 text-amber-950 hover:bg-amber-200",
    emerald: "bg-emerald-700 text-white hover:bg-emerald-800",
    violet: "bg-violet-700 text-white hover:bg-violet-800",
  };

  if (!onSpeak || !text.trim()) {
    return null;
  }

  const buttonLabel =
    voiceState === "playing" ? "正在听" : voiceState === "replay" ? "再听一次" : label;

  return (
    <button
      className={`rounded-full px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${toneClassMap[tone]}`}
      onClick={() => {
        if (resetTimerRef.current) {
          window.clearTimeout(resetTimerRef.current);
        }
        setVoiceState("playing");
        onSpeak(text);
        resetTimerRef.current = window.setTimeout(() => setVoiceState("replay"), 1600);
      }}
      type="button"
    >
      🔊 {buttonLabel}
    </button>
  );
}

function getStoryOptionVisual(text: string, themeId: ThemeId) {
  if (/今日食谱/.test(text)) {
    return {
      icon: "🍱",
      title: text,
      description: "先听今天的菜品和重点食材。",
    };
  }

  if (/小列车/.test(text)) {
    return {
      icon: "🚂",
      title: text,
      description: "听站名口令，点正确的泉州美食站。",
    };
  }

  if (/摊位寻宝/.test(text)) {
    return {
      icon: "🏮",
      title: text,
      description: "听线索找摊位，再收集食材卡。",
    };
  }

  if (/观察|靠近|认识/.test(text)) {
    return {
      icon: "🔍",
      title: text,
      description: "先认名字，再选靠近小步。",
    };
  }

  if (/小厨房|厨房/.test(text)) {
    return {
      icon: "👩‍🍳",
      title: text,
      description: "说菜名，按步骤图卡做一小步。",
    };
  }

  if (/播报员|闽食播报/.test(text)) {
    return {
      icon: "📣",
      title: text,
      description: "把认识到的美食整理成一句播报。",
    };
  }

  if (/习惯故事小剧场/.test(text)) {
    return {
      icon: "📖",
      title: text,
      description: "找一本小故事，听一听绘本，今天读完啦。",
    };
  }

  if (/对老师说|小秘密|想法/.test(text)) {
    return {
      icon: "🗣️",
      title: text,
      description: "用语音或文字把想法告诉老师。",
    };
  }

  if (/老师给|老师发布|小任务|本周重点/.test(text)) {
    return {
      icon: "⭐",
      title: text,
      description: "完成老师放好的一个小练习。",
    };
  }

  if (/海蛎|海蛎煎/.test(text)) {
    return {
      icon: "🦪",
      title: text,
      description: "泉州海蛎煎，先看金黄边，再听海味故事。",
    };
  }

  if (/姜母鸭|鸭/.test(text)) {
    return {
      icon: "🦆",
      title: text,
      description: "姜母鸭香香暖暖，可以先看姜片和鸭肉。",
    };
  }

  if (/烧肉粽|闽南肉粽|肉粽|粽/.test(text)) {
    return {
      icon: "🍙",
      title: text,
      description: "粽叶抱着米粒和馅料，先闻一闻粽叶香。",
    };
  }

  if (/炸醋肉|醋肉/.test(text)) {
    return {
      icon: "🥢",
      title: text,
      description: "炸醋肉金黄金黄，先看外皮再听小发现。",
    };
  }

  if (/芋头饼|芋头|芋/.test(text)) {
    return {
      icon: "🟣",
      title: text,
      description: "芋头饼圆圆香香，可以找一找紫紫的芋头。",
    };
  }

  if (/牛肉羹|牛肉/.test(text)) {
    return {
      icon: "🥣",
      title: text,
      description: "牛肉羹软软热热，先看汤和小勺。",
    };
  }

  if (/洪濑鸡爪|鸡爪/.test(text)) {
    return {
      icon: "🍗",
      title: text,
      description: "洪濑鸡爪颜色深深，先看形状和小骨头。",
    };
  }

  if (/四果汤|四果|水果汤/.test(text)) {
    return {
      icon: "🍨",
      title: text,
      description: "四果汤清凉甜甜，里面有好多小配料。",
    };
  }

  if (/咸饭|米饭|饭/.test(text)) {
    return {
      icon: "🍚",
      title: text,
      description: "咸饭米粒香香，先找里面的菜和香菇。",
    };
  }

  if (/紫菜|汤/.test(text)) {
    return {
      icon: "🌊",
      title: text,
      description: "海边汤品，听一听食材和热汤的小线索。",
    };
  }

  if (/面线|糊/.test(text)) {
    return {
      icon: "🥣",
      title: text,
      description: "面线糊细细软软，像古城早餐的小线索。",
    };
  }

  if (/土笋冻|透明|冻/.test(text)) {
    return {
      icon: "🧊",
      title: text,
      description: "土笋冻透明凉凉，可以先看样子、听故事。",
    };
  }

  if (/润饼|蔬菜|菜/.test(text)) {
    return {
      icon: "🌯",
      title: text,
      description: "润饼菜卷着好多颜色，找一找里面的食材。",
    };
  }

  if (/石花|甜|清凉/.test(text)) {
    return {
      icon: "🍧",
      title: text,
      description: "石花膏清清凉凉，像泉州夏天的小甜碗。",
    };
  }

  if (/好习惯闯关|洗手|喝水|排队|如厕|整理|手/.test(text)) {
    const taskName = text.includes("：") ? text.split("：").pop() || "好习惯小任务" : "好习惯小任务";

    return {
      icon: "🏅",
      title: text,
      description: `${taskName}，点一张图卡试一试。`,
    };
  }

  if (/阅读|故事|绘本|图书|角色|画面|书虫|看到/.test(text)) {
    return {
      icon: "📚",
      title: text,
      description: "听一个短故事，说一个角色、画面或喜欢的地方。",
    };
  }

  if (/红绿牌|绿牌|红牌/.test(text)) {
    return {
      icon: "🟢",
      title: text,
      description: "听行为，举绿牌或红牌，再听正确做法。",
    };
  }

  return {
    icon: themeId === "food" ? "🍽️" : "✨",
    title: text,
    description: themeId === "food" ? "继续闽食故事，听伙伴怎么说。" : "继续成长故事，完成一个小任务。",
  };
}

function getStoryOptionTarget(text: string, themeId: ThemeId) {
  if (themeId === "habit") {
    if (/故事|绘本/.test(text)) return "#habit-story";
    if (/老师|想法|秘密|对老师说/.test(text)) return "#habit-talk";
    if (/进餐|吃饭|餐桌|小口|碗|筷|擦嘴|红绿牌|绿牌|红牌|判断/.test(text)) return "#habit-challenge";
    if (/好习惯|闯关|洗手|喝水|水杯|排队|等一等|如厕|厕所|整理|玩具|图书/.test(text)) return "#habit-challenge";
    if (/老师发布|本周重点|老师给我的任务|老师给/.test(text)) return "#habit-template";

    return "#habit-challenge";
  }

  if (/今日食谱|食谱/.test(text)) return "#food-menu";
  if (/小列车|列车/.test(text)) return "#food-train";
  if (/猜|猜猜|宝箱|线索/.test(text)) return "#food-stall";
  if (/摊位|寻宝/.test(text)) return "#food-stall";
  if (/观察|靠近|认识|食材|尝|闻|看一看/.test(text)) return "#food-observation-card";
  if (/小厨房|厨房|做菜|菜名/.test(text)) return "#food-kitchen";
  if (/播报员|闽食播报/.test(text)) return "#food-broadcast";

  return "#food-observation-card";
}

function recommendStoryOptionsFromInput(text: string, themeId: ThemeId) {
  const cleanText = text.trim();
  const habitDefaultChoices = ["好习惯闯关：洗手小任务", "习惯故事小剧场"];
  const foodDefaultChoices = ["今日食谱", "美食观察与靠近一点点"];
  const foodDishPattern = /姜母鸭|烧肉粽|闽南肉粽|肉粽|土笋冻|炸醋肉|芋头饼|牛肉羹|洪濑鸡爪|崇武鱼卷|四果汤|咸饭|海蛎煎|面线糊|润饼菜|石花膏/;

  if (!cleanText) {
    return themeId === "food" ? foodDefaultChoices : habitDefaultChoices;
  }

  if (themeId === "habit") {
    const ranked = [
      /洗手|泡泡|小手/.test(cleanText) ? "好习惯闯关：洗手小任务" : "",
      /喝水|水杯|口渴/.test(cleanText) ? "好习惯闯关：喝水小任务" : "",
      /排队|等一等|挤/.test(cleanText) ? "好习惯闯关：排队等一等" : "",
      /如厕|厕所|尿尿/.test(cleanText) ? "好习惯闯关：如厕小任务" : "",
      /整理|玩具|图书|收拾|椅子/.test(cleanText) ? "好习惯闯关：整理小能手" : "",
      /进餐|吃饭|餐桌|小口|碗|筷|擦嘴|红绿牌|绿牌|红牌|判断/.test(cleanText) ? "好习惯闯关：文明进餐" : "",
      /好习惯|闯关/.test(cleanText) ? "好习惯闯关：洗手小任务" : "",
      /故事|绘本/.test(cleanText) ? "习惯故事小剧场" : "",
      /老师|想说|秘密|心情/.test(cleanText) ? "对老师说" : "",
      /本周|重点|小任务|老师发布|老师给/.test(cleanText) ? "老师给我的任务" : "",
    ].filter(Boolean);

    return ranked.length > 0
      ? Array.from(new Set(ranked)).slice(0, 2)
      : habitDefaultChoices.slice(0, 2);
  }

  const ranked = [
    /食谱|今天吃/.test(cleanText) ? "今日食谱" : "",
    /列车|火车|车/.test(cleanText) ? "闽食小列车" : "",
    /猜|猜猜|宝箱|线索/.test(cleanText) ? "泉州美食摊位寻宝" : "",
    /摊位|寻宝|找/.test(cleanText) ? "泉州美食摊位寻宝" : "",
    /厨房|做菜|菜名|我想做|想做|我要做|做姜母鸭|做/.test(cleanText) ? "泉州小厨房" : "",
    /播报|介绍|分享/.test(cleanText) ? "小小闽食播报员" : "",
    /观察|认识|材料|食材|靠近|尝|闻|看一看/.test(cleanText) ? "美食观察与靠近一点点" : "",
    foodDishPattern.test(cleanText) ? "美食观察与靠近一点点" : "",
    foodDishPattern.test(cleanText) ? "泉州小厨房" : "",
  ].filter(Boolean);

  return ranked.length > 0
    ? Array.from(new Set(ranked)).slice(0, 2)
    : foodDefaultChoices.slice(0, 2);
}

const supportedMealPhotoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const supportedMealPhotoExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const maxMealPhotoSizeBytes = 8 * 1024 * 1024;
const blockedPlaybackPatterns = [
  "play() failed",
  "notallowed",
  "user didn't interact",
  "user gesture",
  "interact with the document",
];
const benignPlaybackStopPatterns = [
  "signal is aborted",
  "aborted without reason",
  "aborterror",
  "the operation was aborted",
];

function canAwardMealReviewBadge(review: MealPhotoReviewResponse) {
  if (
    review.fallbackUsed ||
    review.mode !== "ai" ||
    review.source !== "ai-vision" ||
    review.awardBadge !== true ||
    review.badgeKind !== "verified_meal_review"
  ) {
    return false;
  }

  return !/结构化分析中|不确定|低把握|仅供参考|示例|基础分析/.test(
    review.confidenceLabel ?? "",
  );
}

function isAiMealPhotoReview(review: MealPhotoReviewResponse | null) {
  return review?.mode === "ai" && !review.fallbackUsed && review.source === "ai-vision";
}

function isLocalMealPhotoReview(review: MealPhotoReviewResponse | null) {
  return Boolean(review && !isAiMealPhotoReview(review));
}

function buildMealPhotoStatus(review: MealPhotoReviewResponse) {
  const sizeText = review.sizeKb ? ` 当前文件约 ${review.sizeKb}KB。` : "";

  if (isAiMealPhotoReview(review)) {
    return `${review.message ?? "照片收好啦，餐盘小发现来啦。"}${sizeText}`;
  }

  return `照片收好啦，这次先做拍照练习，请老师或家长一起看一看。${sizeText}`;
}

function buildMealPhotoEncouragement(review: MealPhotoReviewResponse) {
  if (!isAiMealPhotoReview(review)) {
    return "可以对孩子说：“你愿意把照片传上来一起观察，任务已经完成啦。”";
  }

  const firstFood = review.guessedFoods?.[0];

  if (firstFood) {
    return `可以对孩子说：“你愿意观察${firstFood}，已经是很棒的尝试啦。”`;
  }

  if (review.plateState) {
    return `可以对孩子说：“你把餐盘观察得很认真，${review.plateState}也被看见啦。”`;
  }

  return "可以对孩子说：“谢谢你愿意一起看一看、说一说，尝试本身就很勇敢。”";
}

function isBlockedPlaybackMessage(message: string) {
  const lower = message.toLowerCase();

  return blockedPlaybackPatterns.some((pattern) => lower.includes(pattern));
}

function isBenignPlaybackStopMessage(message: string) {
  const lower = message.toLowerCase();

  return benignPlaybackStopPatterns.some((pattern) => lower.includes(pattern));
}

function normalizeSpeechPlaybackError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (isBenignPlaybackStopMessage(message)) {
    return {
      blocked: false,
      message: "语音停好啦，我们换一个继续。",
    };
  }

  if (isBlockedPlaybackMessage(message)) {
    return {
      blocked: true,
      message: "浏览器拦截了自动播放，请点“重听上一句”播放语音。",
    };
  }

  return {
    blocked: false,
    message: message || "高质量播报暂时不可用，当前先用浏览器播报。",
  };
}

function normalizeRestoredStoryStatus(status: string) {
  return isBlockedPlaybackMessage(status) || isBenignPlaybackStopMessage(status) ? "准备出发啦。" : status;
}

function HabitVisualBoard({
  onSpeak,
  onTaskComplete,
}: {
  onSpeak?: SpeakHandler;
  onTaskComplete?: (
    gameKey: MiniGameKey,
    badgeName: string,
    pickedItems: string[],
    detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>,
  ) => void;
}) {
  const [activeTaskTitle, setActiveTaskTitle] = useState(habitSkillCards[0]?.title ?? "");
  const [taskFeedback, setTaskFeedback] = useState("👉 选一关，听口令，再点答案卡。");
  const [completedTaskTitles, setCompletedTaskTitles] = useState<string[]>([]);
  const [habitStepProgress, setHabitStepProgress] = useState<Record<string, number>>({});
  const [wrongAttemptCounts, setWrongAttemptCounts] = useState<Record<string, number>>({});
  const visibleHabitSkillCards = habitSkillCards.filter((item) => habitChallengeTitles.has(item.title));
  const effectiveActiveTaskTitle = activeTaskTitle;
  const activeTask =
    habitSkillCards.find((item) => item.title === effectiveActiveTaskTitle) ??
    visibleHabitSkillCards[0] ??
    habitSkillCards[0];
  const activeTaskIndex = Math.max(
    0,
    visibleHabitSkillCards.findIndex((item) => item.title === activeTask?.title),
  );
  const activeTaskGameSteps = activeTask ? getHabitGameSteps(activeTask.title) : [];
  const activeTaskInstance = activeTask ? getHabitTaskGameInstance(activeTask.title) : undefined;
  const activeTaskCompleted = completedTaskTitles.includes(activeTask?.title ?? "");
  const activeTaskStepProgress = activeTask
    ? Math.min(activeTaskGameSteps.length, habitStepProgress[activeTask.title] ?? 0)
    : 0;
  const answerConfig = activeTask
    ? habitTaskAnswerOptions[activeTask.title] ?? {
        question: activeTask.question,
        options: [activeTask.actionLabel, "我还想听一遍", "换一个任务"],
        correct: activeTask.actionLabel,
        feedback: `${activeTask.badgeName}亮起来啦。`,
        nextStep: "可以再玩一个任务，或者看看小贴纸。",
      }
    : null;

  function startTask(item: (typeof habitSkillCards)[number]) {
    setActiveTaskTitle(item.title);
    const nextAnswerConfig = habitTaskAnswerOptions[item.title];
    const question = nextAnswerConfig?.question ?? item.question;
    const progress = habitStepProgress[item.title] ?? 0;
    const taskSteps = getHabitGameSteps(item.title);
    const nextStep = taskSteps[progress] ?? taskSteps.at(-1) ?? item.actionLabel;
    setTaskFeedback(`👉 图卡亮起来啦，先在游戏舞台点第 ${Math.min(progress + 1, taskSteps.length)} 步：${nextStep}。`);
    onSpeak?.(`${item.taskName}。${item.command}${item.rhyme} 先点游戏舞台里的步骤：${nextStep}。再选一张小发现：${question}`);
  }

  function playHabitStep(item: (typeof habitSkillCards)[number], step: string, index: number) {
    const taskSteps = getHabitGameSteps(item.title);
    const currentProgress = Math.min(taskSteps.length, habitStepProgress[item.title] ?? 0);

    if (completedTaskTitles.includes(item.title)) {
      const message = `${item.taskName}已经拿到贴纸啦，可以再玩别的关卡。`;
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (index > currentProgress) {
      const message = `先点第 ${currentProgress + 1} 步：${taskSteps[currentProgress] ?? step}。`;
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextProgress = Math.min(taskSteps.length, Math.max(currentProgress, index + 1));
    const nextStep = taskSteps[nextProgress];
    const allStepsDone = nextProgress >= taskSteps.length;
    const message = allStepsDone
      ? `${step}完成啦。这个关卡的动作步骤都走完了，现在选正确答案卡拿贴纸。`
      : `${step}完成啦。下一步：${nextStep}。`;

    setHabitStepProgress((current) => ({
      ...current,
      [item.title]: nextProgress,
    }));
    setTaskFeedback(message);
    onSpeak?.(message);
  }

  function chooseAnswer(item: (typeof habitSkillCards)[number], answer: string) {
    const currentAnswerConfig =
      habitTaskAnswerOptions[item.title] ?? {
        question: item.question,
        correct: item.actionLabel,
        feedback: `${item.badgeName}点亮啦。`,
        nextStep: "可以再玩一个任务，或者看看小贴纸。",
      };

    if (completedTaskTitles.includes(item.title)) {
      const message = `${item.taskName}已经拿到贴纸啦，可以再玩一个任务，老师也看得到。`;
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    const taskSteps = getHabitGameSteps(item.title);
    const currentProgress = Math.min(taskSteps.length, habitStepProgress[item.title] ?? 0);
    if (taskSteps.length > 0 && currentProgress < taskSteps.length) {
      const message = `先把舞台上的第 ${currentProgress + 1} 步“${taskSteps[currentProgress]}”点完，再选一张小发现。`;
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (answer !== currentAnswerConfig.correct) {
      const message = `这个做法需要换一换，我们可以这样做：${currentAnswerConfig.correct}。`;
      setWrongAttemptCounts((current) => ({
        ...current,
        [item.title]: (current[item.title] ?? 0) + 1,
      }));
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    const pickedItems = [item.taskName, ...taskSteps, currentAnswerConfig.question, answer];
    const message = `${currentAnswerConfig.feedback} ${currentAnswerConfig.nextStep} 小贴纸来啦，老师看得到这次小步骤。`;
    const attempts = (wrongAttemptCounts[item.title] ?? 0) + 1;

    onTaskComplete?.(item.gameKey as MiniGameKey, item.badgeName, pickedItems, {
      ...getHabitTaskGameInstance(item.title),
      habitTask: `${item.title}：${currentAnswerConfig.correct}`,
      activityType: "habit-challenge",
      habitType: item.title,
      levelId: activeTaskInstance?.gameInstanceId ?? item.title,
      result: "success",
      attempts,
      retryCount: Math.max(0, attempts - 1),
      status: "completed",
    });
    setCompletedTaskTitles((current) =>
      current.includes(item.title) ? current : [...current, item.title],
    );
    setTaskFeedback(message);
    onSpeak?.(message);
  }

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-700">幼习宝·好习惯闯关</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            第 {activeTaskIndex + 1} 关 · {activeTask?.title ?? "选一关"}
          </h3>
        </div>
        <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          👉 选一个
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleHabitSkillCards.map((item, index) => (
          <button
            key={item.title}
            id={getHabitTaskAnchor(item.title)}
            onClick={() => startTask(item)}
            className={`story-card scroll-mt-24 rounded-[1.7rem] bg-[linear-gradient(180deg,#fffdf7_0%,#f5fffe_100%)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
              activeTask?.title === item.title ? "ring-2 ring-teal-300" : ""
            }`}
            type="button"
          >
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.1rem] text-2xl ${item.tone}`}
            >
              {item.icon}
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">
              第 {index + 1} 关 {item.title.replace("小任务", "").replace("小提醒", "")}
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.hint.split("，")[0]}。</p>
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 shadow-sm">
              {activeTask?.title === item.title ? "👉 正在玩" : "👉 点我开始"}
            </span>
          </button>
        ))}
      </div>
      {activeTask ? (
        <div className="mt-5 rounded-[1.8rem] bg-emerald-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-emerald-800">现在的小任务</p>
              <h4 className="mt-1 text-xl font-semibold text-slate-900">
                {activeTask.icon} {activeTask.taskName}
              </h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">{activeTask.command}</p>
              <p className="mt-2 rounded-[1.2rem] bg-white/85 px-4 py-3 text-sm font-semibold text-emerald-900">
                {activeTask.rhyme}
              </p>
              <div className="mt-3">
                <HabitTaskPlayfield
                  title={activeTask.title}
                  steps={activeTaskGameSteps}
                  activeStep={activeTaskStepProgress}
                  completed={activeTaskCompleted}
                  onStepClick={(step, index) => playHabitStep(activeTask, step, index)}
                />
              </div>
              <div className="mt-3 grid gap-3 rounded-[1.3rem] bg-white/85 p-3 sm:grid-cols-[auto_1fr]">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-[1.2rem] text-3xl ${activeTask.tone}`}
                >
                  {activeTask.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">图卡</p>
                  <p className="mt-1 text-sm leading-7 text-slate-700">
                    {activeTask.hint.split("，")[0]}。
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {answerConfig?.question ?? activeTask.question}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SpeechCueButton
                text={`${activeTask.taskName}。${activeTask.command}${activeTask.rhyme} ${answerConfig?.question ?? activeTask.question}`}
                onSpeak={onSpeak}
            label="听一听"
                tone="emerald"
              />
            </div>
          </div>
          {activeTaskStepProgress >= activeTaskGameSteps.length ? (
            <>
              <p className="mt-4 text-sm font-semibold text-slate-800">👉 选一个答案卡</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(answerConfig?.options ?? []).map((answer) => {
                  const isCorrect = answer === answerConfig?.correct;
                  const isDone = completedTaskTitles.includes(activeTask.title);

                  return (
                    <button
                      key={answer}
                      onClick={() => chooseAnswer(activeTask, answer)}
                      className={`rounded-[1.3rem] px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
                        isDone && isCorrect
                          ? "bg-emerald-700 text-white"
                          : "bg-white text-slate-800 shadow-sm"
                      }`}
                      type="button"
                    >
                      {answer}
                      <span className="mt-1 block text-xs opacity-70">
                        {isCorrect ? "可以完成任务" : "想一想要不要换一换"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-[1.2rem] bg-white/80 px-4 py-3 text-sm font-semibold text-emerald-900">
              先完成当前步骤：{activeTaskGameSteps[activeTaskStepProgress] ?? "再听任务"}。
            </div>
          )}
          <div className="mt-4 rounded-[1.2rem] bg-white/80 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">{taskFeedback}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              完成后可以再玩一个任务、去听故事，或看看小贴纸。
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HabitMissionPoster({ badges, missions }: { badges: string[]; missions: string[] }) {
  const hasBadges = badges.length > 0;

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#dff8f7_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <p className="text-sm font-semibold text-teal-700">今日成长任务</p>
      <h3 className="mt-1 text-2xl font-semibold text-slate-900">今天想点亮哪一项</h3>
      <div className="mt-5 rounded-[2rem] bg-white/80 p-5">
        <div className="flex flex-wrap gap-3">
          {missions.map((mission, index) => (
            <div
              key={mission}
              className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              {index + 1}. {mission}
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.6rem] bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">进餐动作</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              先坐稳，再扶好碗，慢慢嚼，最后餐后整理。
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-800">阅读表达</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              听一个短故事，说一个角色、画面或喜欢的地方。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {hasBadges ? (
          badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
            >
              {badge}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
            完成成长任务后，第一枚勋章会出现在这里
          </span>
        )}
      </div>
    </div>
  );
}

function RewardStickerShelf({ badges }: { badges: string[] }) {
  const hasBadges = badges.length > 0;
  const stickerPool = hasBadges
    ? badges.map((badge, index) => ({
        ...rewardStickerCards[index % rewardStickerCards.length],
        title: badge,
      }))
    : rewardStickerCards.slice(0, 3);

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-rose-700">奖励贴纸墙</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">孩子最爱看的成果区</h3>
        </div>
        <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
          {hasBadges ? "已经点亮" : "等待点亮"}
        </div>
      </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stickerPool.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className={`story-card rounded-[1.7rem] p-4 shadow-sm ${
                hasBadges
                  ? "bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)]"
                  : "bg-slate-50 opacity-75"
              }`}
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-[1rem] text-2xl ${
                  hasBadges ? item.tone : "bg-slate-200 text-slate-400"
                }`}
              >
                {hasBadges ? item.icon : "☆"}
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {hasBadges ? "已经放进成长小书里。" : "完成对应任务后会点亮。"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

function FoodBadgeWall({
  onSpeak,
  onSubmit,
}: {
  onSpeak?: SpeakHandler;
  onSubmit?: (gameKey: MiniGameKey, badgeName: string, pickedItems: string[]) => void;
}) {
  const [activeTask, setActiveTask] = useState(foodBadgeCards[0]?.title ?? "");
  const [selectedFood, setSelectedFood] = useState("泉州海蛎煎");
  const [selectedPlace, setSelectedPlace] = useState("家里");
  const [selectedStep, setSelectedStep] = useState("看一看");
  const [selectedAction, setSelectedAction] = useState("摆碗筷");
  const [sentence, setSentence] = useState("");
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [submitFeedback, setSubmitFeedback] = useState("选一张任务卡，完成后可以提交并点亮闽食小勋章。");
  const taskTextMap: Record<string, string> = {
    闽食小寻宝: "闽食小寻宝任务：说出你找到了哪一种泉州美食，也说说在哪里看到它。",
    亲近美食章: "亲近美食章任务：选一种还在认识的美食，再选一个愿意靠近的小步骤。",
    家庭小主厨: "家庭小主厨任务：说一说你在家帮忙做了哪一个小步骤，可以选择一张照片留在本机。",
    闽食宣传员: "闽食宣传员任务：选一种泉州美食，试着用一句话介绍给家人或同伴。",
  };
  const taskSubmitMap: Record<
    string,
    {
      gameKey: MiniGameKey;
      badgeName: string;
      reply: string;
    }
  > = {
    闽食小寻宝: {
      gameKey: "foodObserve",
      badgeName: "闽食小寻宝章",
      reply: "你找到了一种泉州美食，真像小侦探！能说出名字，就是很棒的闽食发现。",
    },
    亲近美食章: {
      gameKey: "foodPreference",
      badgeName: "亲近美食章",
      reply: "愿意先靠近一点点，就是勇敢尝试。今天不用着急吃完，认识它也很棒。",
    },
    家庭小主厨: {
      gameKey: "foodKitchen",
      badgeName: "家庭小主厨章",
      reply: "你帮家人完成了小任务，懂得感谢劳动，家庭小主厨上线啦。",
    },
    闽食宣传员: {
      gameKey: "foodReporter",
      badgeName: "闽食宣传员章",
      reply: "你已经能介绍一种家乡美食啦，今天的小播报员任务完成！",
    },
  };
  const foodOptions = [
    "泉州海蛎煎",
    "面线糊",
    "润饼菜",
    "石花膏",
    "土笋冻",
    "崇武鱼卷",
    "姜母鸭",
    "烧肉粽",
    "炸醋肉",
    "芋头饼",
    "牛肉羹",
    "洪濑鸡爪",
    "四果汤",
    "咸饭",
    "其他",
  ];
  const placeOptions = ["家里", "学校", "街边", "餐桌", "其他"];
  const stepOptions = ["看一看", "闻一闻", "摸一摸", "尝一点", "说一说"];
  const actionOptions = ["洗菜", "摆碗筷", "搅拌", "端盘", "餐后整理", "其他"];
  const activeTaskText =
    taskTextMap[activeTask] ?? "选择一张闽食勋章卡，听一听今天可以完成的小任务。";
  const currentSubmit = taskSubmitMap[activeTask] ?? taskSubmitMap["闽食小寻宝"];

  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  function handleMediaSelect(file?: File) {
    if (!file) {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      setMediaPreview("");
      setMediaName("");
      setMediaType("");
      return;
    }

    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }

    setMediaName(file.name);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  }

  function submitTask() {
    const trimmedSentence = sentence.trim();
    const pickedItems =
      activeTask === "闽食小寻宝"
        ? [`我找到了：${selectedFood}`, `看到地点：${selectedPlace}`, trimmedSentence ? `我想说：${trimmedSentence}` : ""]
        : activeTask === "亲近美食章"
          ? [`食物名称：${selectedFood}`, `靠近一步：${selectedStep}`, trimmedSentence ? `我的感受：${trimmedSentence}` : ""]
          : activeTask === "家庭小主厨"
            ? [`我做了：${selectedAction}`, trimmedSentence ? `我想说：${trimmedSentence}` : ""]
            : [`介绍美食：${selectedFood}`, trimmedSentence ? `介绍语：${trimmedSentence}` : "我会介绍了"];
    const cleanedItems = [
      ...pickedItems.filter(Boolean),
      mediaName ? `本机${mediaType === "video" ? "视频" : "照片"}：${mediaName}` : "",
    ].filter(Boolean);

    if (activeTask === "闽食宣传员" && !trimmedSentence) {
      const message = "先试着说一句介绍，再点“我会介绍了”。";
      setSubmitFeedback(message);
      onSpeak?.(message);
      return;
    }

    onSubmit?.(currentSubmit.gameKey, currentSubmit.badgeName, [
      "闽食家园任务提交区",
      activeTask,
      ...cleanedItems,
    ]);
    setSubmitFeedback(currentSubmit.reply);
    setSentence("");
    onSpeak?.(currentSubmit.reply);
  }

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-rose-700">闽食家园任务</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">闽食家园任务提交区</h3>
        </div>
        <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
          提交后点亮
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {foodBadgeCards.map((item) => (
          <button
            key={item.title}
            onClick={() => {
              const taskText =
                taskTextMap[item.title] ??
                `${item.title}任务：选一种泉州美食，说一说你看到了什么。`;
              setActiveTask(item.title);
              setSubmitFeedback("任务已经换好啦，完成后可以点亮小章。");
              onSpeak?.(taskText);
            }}
            className={`story-card rounded-[1.8rem] bg-[linear-gradient(180deg,#fff9ec_0%,#ffffff_100%)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${
              activeTask === item.title ? "ring-2 ring-amber-300" : ""
            }`}
            type="button"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-amber-100 text-3xl">
                {item.icon}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{item.title}</h4>
                <p className="mt-1 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-[1.5rem] bg-amber-50 px-4 py-4">
        <p className="text-sm font-semibold text-amber-900">当前小任务</p>
        <p className="mt-2 text-sm leading-7 text-slate-700">{activeTaskText}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {["选任务", "上传照片/视频", "提交点亮"].map((step, index) => (
            <span key={step} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-amber-900">
              {index + 1}. {step}
            </span>
          ))}
        </div>
        <div className="mt-3">
          <SpeechCueButton text={activeTaskText} onSpeak={onSpeak} label="听任务" tone="amber" />
        </div>
      </div>
      <div className="mt-5 rounded-[1.6rem] bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {activeTask === "家庭小主厨" ? (
            <label className="text-sm font-semibold text-slate-700">
              我做了
              <select
                value={selectedAction}
                onChange={(event) => setSelectedAction(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                {actionOptions.map((item, index) => (
                  <option key={`${item}-${index}`}>{item}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm font-semibold text-slate-700">
              {activeTask === "闽食宣传员" ? "我介绍的美食" : activeTask === "闽食小寻宝" ? "我找到了" : "食物名称"}
              <select
                value={selectedFood}
                onChange={(event) => setSelectedFood(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                {foodOptions.map((item, index) => (
                  <option key={`${item}-${index}`}>{item}</option>
                ))}
              </select>
            </label>
          )}

          {activeTask === "闽食小寻宝" ? (
            <label className="text-sm font-semibold text-slate-700">
              我在哪里看到
              <select
                value={selectedPlace}
                onChange={(event) => setSelectedPlace(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                {placeOptions.map((item, index) => (
                  <option key={`${item}-${index}`}>{item}</option>
                ))}
              </select>
            </label>
          ) : activeTask === "亲近美食章" ? (
            <label className="text-sm font-semibold text-slate-700">
              我愿意靠近一步
              <select
                value={selectedStep}
                onChange={(event) => setSelectedStep(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                {stepOptions.map((item, index) => (
                  <option key={`${item}-${index}`}>{item}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-[1.3rem] bg-white px-4 py-3 text-sm font-semibold leading-6 text-cyan-900">
              {activeTask === "家庭小主厨" ? "完成动作后，可以上传作品照片或小视频。" : "按钮口令：我会介绍了"}
            </div>
          )}
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          放一张照片或小视频
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(event) => handleMediaSelect(event.target.files?.[0])}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          />
        </label>

        {mediaPreview ? (
          <div className="mt-4 overflow-hidden rounded-[1.4rem] bg-white p-3 shadow-sm">
            {mediaType === "video" ? (
              <video src={mediaPreview} controls className="h-48 w-full rounded-[1rem] object-cover" />
            ) : (
              <div
                aria-label="闽食任务本机预览"
                className="h-48 w-full rounded-[1rem] bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url(${mediaPreview})` }}
              />
            )}
            <p className="mt-2 text-xs font-semibold text-slate-500">
              当前文件：{mediaName}。文件只在这台设备预览，小脚印只保存文件名。
            </p>
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          {activeTask === "闽食宣传员" ? "我会这样介绍" : activeTask === "亲近美食章" ? "我的感受" : "我想说一句"}
          <input
            value={sentence}
            onChange={(event) => setSentence(event.target.value.slice(0, 80))}
            placeholder={
              activeTask === "闽食宣传员"
                ? "例如：面线糊细细软软，是泉州早餐的暖暖味道。"
                : "可以不填，也可以说一句自己的发现。"
            }
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-amber-300"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold leading-6 text-emerald-900">
            {submitFeedback}
          </p>
          <button
            onClick={submitTask}
            className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5"
            type="button"
          >
            {activeTask === "闽食宣传员" ? "我会介绍了" : "完成啦"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeVideoBoard({ themeId }: { themeId: ThemeId }) {
  const cards = themeVideoCards[themeId];
  const [teacherVideos, setTeacherVideos] = useState<TeacherVideoResource[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const restoreHandle = window.setTimeout(() => {
      setTeacherVideos(
        parseVideoLibrary(window.localStorage.getItem(videoLibraryStorageKey)).filter(
          (item) => item.themeId === themeId,
        ),
      );
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [themeId]);

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">放松学视频</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            {themeId === "food" ? "闽食与非遗小影院" : "习惯与安全小影院"}
          </h3>
        </div>
        <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
          预留视频播放位
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[1.8rem] bg-[linear-gradient(180deg,#f3fffd_0%,#ffffff_100%)] p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-amber-100 text-3xl">
                {card.icon}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{card.title}</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">{card.description}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {card.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-4 flex h-36 items-center justify-center rounded-[1.4rem] border border-dashed border-cyan-200 bg-cyan-50 text-center">
              <p className="px-4 text-sm leading-7 font-semibold text-cyan-900">
                视频资源由教师工作台上传或登记
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-[1.8rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">教师已配置的视频资源</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {teacherVideos.length > 0 ? (
            teacherVideos.map((video) => (
              <article key={video.id} className="rounded-[1.3rem] bg-white px-4 py-3 shadow-sm">
                <p className="font-semibold text-slate-900">{video.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{video.description}</p>
                <p className="mt-2 text-xs font-semibold text-cyan-800">
                  {video.sourceType === "upload"
                    ? `教师上传素材：${video.fileName ?? "本地视频"}`
                    : "教师登记素材：待补充适合本班使用的视频"}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-[1.3rem] bg-white px-4 py-3 text-sm leading-7 text-slate-500 md:col-span-2">
              小影院还没有视频，请老师先放入适合今天主题的小视频。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChildIdentityPanel({
  childRoster,
  selectedChildId,
}: {
  childRoster: ChildProfile[];
  selectedChildId: string;
}) {
  const selectedChild = childRoster.find((child) => child.id === selectedChildId) ?? null;

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">我的小名牌</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">
            {selectedChild ? formatChildLabel(selectedChild) : "先拿小名牌"}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            拿好小名牌再玩游戏，今天的小脚印就会记到自己的成长小本本里。
          </p>
        </div>
        <Link
          href="/children"
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
        >
          🏠 回到儿童入口重新识别
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {selectedChild ? (
          <span className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white">
            {formatChildLabel(selectedChild)}
          </span>
        ) : childRoster.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            还没有拿到小名牌，请回儿童入口说名字或号数。
          </span>
        ) : (
          <Link
            href="/teachers"
            className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
          >
            请老师先放入小朋友名单
          </Link>
        )}
      </div>
    </div>
  );
}

function MealPhotoBooth({
  onReviewLogged,
}: {
  onReviewLogged?: (review: MealPhotoReviewResponse, fileName: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [reviewStatus, setReviewStatus] = useState("拍下餐盘小发现，看看今天的勇敢尝试。");
  const [reviewTips, setReviewTips] = useState<string[]>(mealPhotoChecklist);
  const [reviewResult, setReviewResult] = useState<MealPhotoReviewResponse | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canAwardReviewSticker = reviewResult ? canAwardMealReviewBadge(reviewResult) : false;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function resetSelectedPhoto(status: string) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    setPreviewUrl("");
    setFileName("");
    setReviewStatus(status);
    setReviewResult(null);
    setReviewTips(mealPhotoChecklist);
  }

  function getPhotoValidationMessage(file: File) {
    const normalizedName = file.name.toLowerCase();
    const typeSupported = file.type ? supportedMealPhotoTypes.has(file.type) : false;
    const extensionSupported = supportedMealPhotoExtensions.some((extension) =>
      normalizedName.endsWith(extension),
    );

    if (!typeSupported && !extensionSupported) {
      return "当前支持 JPG、PNG、WebP 或 HEIC 图片，请重新选择照片。";
    }

    if (file.size > maxMealPhotoSizeBytes) {
      return "这张照片超过 8MB，请先压缩或换一张更小的照片。";
    }

    return "";
  }

  function handleSelectPhoto(file: File | null) {
    if (!file) {
      return;
    }

    const validationMessage = getPhotoValidationMessage(file);
    if (validationMessage) {
      resetSelectedPhoto(validationMessage);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    setFileName(file.name);
    setReviewStatus("照片已选好，可以看看餐盘小发现。");
    setReviewResult(null);
  }

  async function reviewPhoto() {
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setReviewStatus("先选一张孩子餐盘或闽食作品照片。");
      return;
    }

    const validationMessage = getPhotoValidationMessage(file);
    if (validationMessage) {
      resetSelectedPhoto(validationMessage);
      return;
    }

    setIsReviewing(true);
    setReviewStatus("正在看这张餐盘照片...");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/meal-photo-review", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as MealPhotoReviewResponse;

      if (!response.ok) {
        throw new Error(data.error || "照片检查暂时失败了");
      }

      setReviewResult(data);
      setReviewStatus(buildMealPhotoStatus(data));
      setReviewTips(data.tips && data.tips.length > 0 ? data.tips : mealPhotoChecklist);

      if (data.ok) {
        onReviewLogged?.(data, file.name);
      }
    } catch (error) {
      setReviewStatus(error instanceof Error ? error.message : "照片检查暂时失败了");
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#e6fbfa_0%,#ffffff_50%,#fff7dc_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">闽食餐盘观察</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">餐盘小发现</h3>
        </div>
        <div className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800">
          支持手机直接拍照
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.8rem] bg-white/80 p-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="餐盘照片预览"
              className="h-64 w-full rounded-[1.4rem] object-cover"
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-cyan-200 bg-white/70 text-center">
              <div className="text-4xl">🍱</div>
              <p className="mt-3 text-lg font-semibold text-slate-700">拍一张餐盘照片</p>
              <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                拍菜品、餐盘或小作品就好。
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="rounded-full bg-orange-300 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5">
              选择照片
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => handleSelectPhoto(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={() => void reviewPhoto()}
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={isReviewing || !fileName}
            >
              {isReviewing ? "正在看..." : "看看餐盘"}
            </button>
          </div>
          {fileName ? (
            <p className="mt-3 text-sm font-semibold text-slate-600">当前照片：{fileName}</p>
          ) : null}
          <p className="mt-3 text-xs leading-6 font-semibold text-slate-500">
            请只选择餐盘或闽食作品照片，不拍孩子正脸。
          </p>
          <p className="mt-2 text-xs leading-6 font-semibold text-amber-800">
            拍照时尽量避开孩子正脸、姓名牌和班级牌，只拍餐盘或作品。
          </p>
        </div>

        <div className="rounded-[1.8rem] bg-white/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">餐盘小照片</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                reviewResult?.mode === "ai"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {!reviewResult
                ? "等照片"
                : isAiMealPhotoReview(reviewResult)
                  ? "餐盘小发现"
                  : "拍照练习卡"}
            </span>
          </div>
          <p aria-live="polite" className="mt-3 text-base leading-8 font-semibold text-slate-900">
            {reviewStatus}
          </p>

          {reviewResult?.fallbackUsed ? (
            <div className="mt-5 rounded-[1.5rem] bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">拍照练习卡</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {reviewResult.warning ??
                  "照片已经收好啦，这次先练习观察，食物名字请老师或家长一起确认。"}
              </p>
              <p className="mt-2 text-xs leading-6 font-semibold text-amber-900">
                这次已经完成；先给体验贴纸，不点亮正式小章。
              </p>
            </div>
          ) : null}

          {isLocalMealPhotoReview(reviewResult) && !reviewResult?.fallbackUsed ? (
            <div className="mt-5 rounded-[1.5rem] bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">拍照练习卡</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                照片已经收好啦，这次先练习看一看、说一说。
              </p>
              <p className="mt-2 text-xs leading-6 font-semibold text-amber-900">
                请以老师或家长现场看到的餐盘为准。
              </p>
            </div>
          ) : null}

          {reviewResult?.summary ? (
            <div className="mt-5 rounded-[1.5rem] bg-cyan-50 px-4 py-4">
              <p className="text-sm font-semibold text-cyan-800">
                {isAiMealPhotoReview(reviewResult) ? "餐盘小发现" : "观察小结"}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{reviewResult.summary}</p>
            </div>
          ) : null}

          {reviewResult?.plateState || reviewResult?.confidenceLabel ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">餐盘状态</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {reviewResult?.plateState ?? "等待现场确认"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">
                  {isAiMealPhotoReview(reviewResult) ? "发现说明" : "照片小卡"}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {isAiMealPhotoReview(reviewResult)
                    ? (reviewResult?.confidenceLabel ?? "等待现场确认")
                    : "拍照练习卡"}
                </p>
              </div>
            </div>
          ) : null}

          {reviewResult?.highlightTags && reviewResult.highlightTags.length > 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">照片亮点</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {uniqueTextItems(reviewResult.highlightTags).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-cyan-100 px-3 py-2 text-sm font-semibold text-cyan-900"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {isLocalMealPhotoReview(reviewResult) ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["照片已收好", "观察已完成", "请大人一起看"].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-center shadow-sm"
                >
                  <p className="text-xs font-semibold text-slate-500">照片小脚印</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{item}</p>
                </div>
              ))}
            </div>
          ) : reviewResult?.scoreCards && reviewResult.scoreCards.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {reviewResult.scoreCards.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-center shadow-sm"
                >
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-2 text-base leading-6 font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {reviewResult?.guessedFoods && reviewResult.guessedFoods.length > 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">
                  {isAiMealPhotoReview(reviewResult) ? "餐盘发现" : "观察提示"}
                </p>
                {isLocalMealPhotoReview(reviewResult) ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    请大人确认
                  </span>
                ) : null}
              </div>
              {isLocalMealPhotoReview(reviewResult) ? (
                <p className="mt-2 text-xs leading-6 font-semibold text-slate-500">
                  这些只是拍照练习提示，请以老师或家长现场看到的餐盘为准。
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {uniqueTextItems(reviewResult.guessedFoods).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {reviewResult?.stickers && reviewResult.stickers.length > 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">
                  {canAwardReviewSticker ? "点亮勋章" : "体验贴纸"}
                </p>
                {!canAwardReviewSticker ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    已收好
                  </span>
                ) : null}
              </div>
              {!canAwardReviewSticker ? (
                <p className="mt-2 text-xs leading-6 font-semibold text-slate-500">
                  这次给孩子正向完成反馈，先给观察贴纸，不点亮正式小章。
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {uniqueTextItems(reviewResult.stickers).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {reviewResult?.nextMission ? (
            <div className="mt-5 rounded-[1.5rem] bg-orange-50 px-4 py-4 text-orange-950">
              <p className="text-sm font-semibold text-orange-800">下一小步</p>
              <p className="mt-2 text-sm leading-7">{reviewResult.nextMission}</p>
            </div>
          ) : null}

          {reviewResult ? (
            <div className="mt-5 rounded-[1.5rem] bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-800">老师可以这样夸一夸</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {buildMealPhotoEncouragement(reviewResult)}
              </p>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {reviewTips.map((tip) => (
              <div
                key={tip}
                className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
              >
                {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingCheckinGame({
  contentConfig,
  teacherBooks = [],
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  teacherBooks?: TeacherPictureBook[];
  onComplete?: (
    pickedItems: string[],
    detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>,
  ) => void;
  onSpeak?: SpeakHandler;
}) {
  type ReadingBook = {
    id: string;
    title: string;
    coverIcon: string;
    pages: string[];
    source: "teacher" | "ai";
  };

  const [storyIdea, setStoryIdea] = useState("");
  const teacherReadingBooks = useMemo<ReadingBook[]>(
    () =>
      teacherBooks
        .filter((book) => book.themeId === "habit")
        .slice(0, 6)
        .map((book) => ({
          id: book.id,
          title: book.title,
          coverIcon: "📚",
          pages: splitStoryPages(book.storyText),
          source: "teacher" as const,
        })),
    [teacherBooks],
  );
  const defaultBook = teacherReadingBooks[0] ?? buildReadingBookFromIdea("洗手");
  const [activeBook, setActiveBook] = useState<ReadingBook | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [listenCount, setListenCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [checkInCount, setCheckInCount] = useState(0);
  const [favoriteStory, setFavoriteStory] = useState("");
  const [feedback, setFeedback] = useState("先找一本小故事，再听一听绘本。");
  const [isStoryListening, setIsStoryListening] = useState(false);
  const [isFindingStory, setIsFindingStory] = useState(false);
  const completionReportedRef = useRef(false);
  const generatedStorySequenceRef = useRef(0);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shownBook = activeBook ?? defaultBook;
  const currentPage = shownBook.pages[Math.min(pageIndex, shownBook.pages.length - 1)] ?? shownBook.title;
  const completed = checkInCount > 0;
  const introText = "找一本小故事，听一听绘本，读完后点亮阅读贴纸。";

  useEffect(() => {
    const storyRecognitionRef = recognitionRef;

    return () => {
      storyRecognitionRef.current?.stop();
    };
  }, []);

  function splitStoryPages(text: string) {
    const pages = text
      .split(/(?<=[。！？!?])|\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4);

    return pages.length > 0 ? pages : ["翻开小绘本，我们一起听一个温暖的小故事。"];
  }

  function getReadingIcon(topic: string) {
    if (/洗手|泡泡/.test(topic)) return "🧼";
    if (/喝水|水杯/.test(topic)) return "🥤";
    if (/排队|等待/.test(topic)) return "🚶";
    if (/整理|玩具|图书/.test(topic)) return "🧸";
    if (/如厕|厕所/.test(topic)) return "🚻";
    return "📖";
  }

  function buildReadingBookFromIdea(rawIdea: string): ReadingBook {
    const mission = buildHabitStoryMission(rawIdea || "洗手");

    return {
      id: `ai-${mission.topic}`,
      title: mission.title,
      coverIcon: getReadingIcon(mission.topic),
      pages: splitStoryPages(mission.storyText),
      source: "ai",
    };
  }

  function buildReadingBookFromStoryResponse(rawIdea: string, response: StoryApiResponse): ReadingBook {
    const cleanIdea = rawIdea.trim() || "小故事";
    const reply = response.reply?.trim() || buildHabitStoryMission(cleanIdea).storyText;
    const titleMatch = reply.match(/《([^》]{1,24})》/);
    const title =
      titleMatch?.[1]?.trim() ||
      (cleanIdea.replace(/^我想听/, "").replace(/的故事$/, "").trim()
        ? `${cleanIdea.replace(/^我想听/, "").replace(/的故事$/, "").trim()}小故事`
        : "幼习宝小故事");
    const pages = splitStoryPages(reply.replace(/^绘本故事开始啦。?/, ""));

    generatedStorySequenceRef.current += 1;

    return {
      id: `ai-story-${generatedStorySequenceRef.current}-${title.replace(/\s+/g, "-").slice(0, 16)}`,
      title,
      coverIcon: getReadingIcon(cleanIdea),
      pages: pages.slice(0, 4),
      source: "ai",
    };
  }

  function resetReadingState(book: ReadingBook, message: string) {
    setActiveBook(book);
    setPageIndex(0);
    setListenCount(0);
    setFinished(false);
    setCheckInCount(0);
    setFavoriteStory("");
    completionReportedRef.current = false;
    setFeedback(message);
    onSpeak?.(message);
  }

  async function findStoryFromIdea(ideaOverride?: string) {
    const cleanIdea = (ideaOverride ?? storyIdea).trim();
    const teacherMatch = teacherReadingBooks.find(
      (book) => cleanIdea && (book.title.includes(cleanIdea) || cleanIdea.includes(book.title)),
    );

    if (teacherMatch) {
      resetReadingState(teacherMatch, `找到老师放好的《${teacherMatch.title}》。我们先听一听。`);
      return;
    }

    setIsFindingStory(true);
    setFeedback("正在帮你找一本小故事。");

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "child",
          theme: "habit",
          storyType: "pictureBook",
          userInput: cleanIdea || "洗手的小故事",
        }),
      });
      const data = (await response.json()) as StoryApiResponse;
      const nextBook = buildReadingBookFromStoryResponse(cleanIdea || "洗手", data);

      resetReadingState(nextBook, `找到《${nextBook.title}》。我们先听一听。`);
    } catch {
      const nextBook = buildReadingBookFromIdea(cleanIdea || "洗手");

      resetReadingState(nextBook, `找到《${nextBook.title}》。我们先听一听。`);
    } finally {
      setIsFindingStory(false);
    }
  }

  function pickTeacherBook(book: ReadingBook) {
    resetReadingState(book, `选好了《${book.title}》。点“听一听绘本”开始。`);
  }

  function playCurrentPage() {
    const nextListenCount = listenCount + 1;
    const message = `第 ${pageIndex + 1} 页：${currentPage}`;

    setListenCount(nextListenCount);
    setFeedback("正在听绘本。听完可以翻下一页。");
    onSpeak?.(message);
  }

  function goPreviousPage() {
    if (pageIndex <= 0) {
      const message = "已经是第一页啦。我们从这里开始听。";

      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextIndex = pageIndex - 1;
    const nextText = shownBook.pages[nextIndex] ?? "";

    setPageIndex(nextIndex);
    setFeedback("翻到上一页啦。可以再听一听。");
    onSpeak?.(`上一页。${nextText}`);
  }

  function goNextPage() {
    if (pageIndex < shownBook.pages.length - 1) {
      const nextIndex = pageIndex + 1;
      const nextText = shownBook.pages[nextIndex] ?? "";

      setPageIndex(nextIndex);
      setFeedback("翻到下一页啦。可以再点听一听。");
      onSpeak?.(`下一页。${nextText}`);
      return;
    }

    setFinished(true);
    setFeedback("这本小故事听完啦，可以点“今天读完啦”。");
    onSpeak?.("这本小故事听完啦，可以点今天读完啦。");
  }

  function markFavoriteStory() {
    setFavoriteStory(shownBook.title);
    const message = `你喜欢《${shownBook.title}》，老师会看到这个小喜欢。`;

    setFeedback(message);
    onSpeak?.(message);
  }

  function completeReadingCheckin() {
    if (completionReportedRef.current) {
      const message = "这次故事小贴纸已经拿到啦，可以换一个故事继续听。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextCheckInCount = checkInCount + 1;
    const message = `今天读完啦。阅读小贴纸来啦。`;
    const pickedItems = [
      `绘本:${shownBook.title}`,
      `听了:${listenCount}次`,
      `喜欢:${favoriteStory || "未选择"}`,
      `阅读打卡:${nextCheckInCount}`,
    ];

    setFinished(true);
    setCheckInCount(nextCheckInCount);
    setFeedback(message);
    onSpeak?.(message);
    completionReportedRef.current = true;
    onComplete?.(pickedItems, {
      activityType: "habit-reading",
      templateType: "reading-checkin",
      activityId: shownBook.id,
      action: "reading-checkin",
      storyId: shownBook.id,
      storyTopic: shownBook.title,
      bookTitle: shownBook.title,
      listenCount,
      finished: true,
      checkInCount: nextCheckInCount,
      favoriteStory: favoriteStory || shownBook.title,
      result: "success",
      attempts: 1,
      status: "completed",
      source: shownBook.source === "teacher" ? "teacher-picture-book" : "ai-reading-story",
    });
  }

  function resetGame() {
    const nextBook = teacherReadingBooks[0] ?? buildReadingBookFromIdea("洗手");

    setStoryIdea("");
    resetReadingState(nextBook, "我们重新找一本小故事。可以说：我想听洗手的故事。");
  }

  function toggleStoryVoiceInput() {
    startChildVoiceInput({
      recognitionRef,
      isListening: isStoryListening,
      setListening: setIsStoryListening,
      onStart: "我在听啦，可以说：我想听洗手的小故事。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setFeedback(message);
        onSpeak?.(message);
      },
      onResult: (transcript) => {
        const nextIdea = transcript.slice(0, 40);
        const message = `我听见啦：${nextIdea}。我来帮你找一本小故事。`;

        setStoryIdea(nextIdea);
        setFeedback(message);
        onSpeak?.(message);
        void findStoryFromIdea(nextIdea);
      },
    });
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-700">找一本小故事</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "习惯故事小剧场"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-900 transition hover:bg-violet-200"
          type="button"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="violet" />
      </div>

      <div className="mt-4 rounded-[1.6rem] bg-violet-50 p-4">
        <p className="text-sm font-semibold text-violet-900">第一步：找一本小故事</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={storyIdea}
            onChange={(event) => setStoryIdea(event.target.value.slice(0, 40))}
            placeholder="例如：我想听洗手的故事 / 我想听小兔排队"
            className="rounded-[1.3rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-300"
          />
          <button
            onClick={toggleStoryVoiceInput}
            className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
              isStoryListening ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-900"
            }`}
            type="button"
          >
            {isStoryListening ? "停止听写" : "语音输入"}
          </button>
          <button
            onClick={() => void findStoryFromIdea()}
            disabled={isFindingStory}
            className="rounded-full bg-violet-200 px-5 py-3 text-sm font-semibold text-violet-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            {isFindingStory ? "正在找故事" : "找一本故事"}
          </button>
        </div>
        {teacherReadingBooks.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {teacherReadingBooks.map((book) => (
              <button
                key={book.id}
                onClick={() => pickTeacherBook(book)}
                className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm transition hover:-translate-y-0.5"
                type="button"
              >
                老师放好的：{book.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-violet-50 p-5">
        <div className="grid gap-4">
          <section className="rounded-[1.6rem] bg-white/92 p-5 shadow-sm">
            <p className="text-xs font-semibold text-violet-700">第二步：听绘本</p>
            <div className="mt-3 grid gap-4 md:grid-cols-[10rem_1fr]">
              <div className="flex min-h-40 items-center justify-center rounded-[1.5rem] bg-violet-100 text-7xl shadow-inner">
                {shownBook.coverIcon}
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-xs font-semibold text-violet-700">绘本封面</p>
                <h4 className="mt-1 text-2xl font-semibold text-slate-900">{shownBook.title}</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900">
                    共 {shownBook.pages.length} 页
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    {shownBook.source === "teacher" ? "老师发布绘本" : "AI生成故事，教师确认后使用"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-violet-100 bg-[linear-gradient(135deg,#ffffff_0%,#fff7ed_100%)] p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
                <div className="flex min-h-56 w-full items-center justify-center rounded-[1.8rem] bg-violet-50 text-7xl shadow-inner">
                  {getReadingIcon(currentPage)}
                </div>
                <span className="mt-4 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-900">
                  第 {pageIndex + 1} 页 / 共 {shownBook.pages.length} 页
                </span>
                <p className="mt-4 max-w-2xl text-2xl font-semibold leading-10 text-slate-900">
                  {currentPage}
                </p>
                <span className="mt-4 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
                  当前页插图：AI生成故事，教师确认后使用
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={playCurrentPage}
                  className="rounded-full bg-violet-300 px-5 py-3 text-sm font-semibold text-violet-950 transition hover:-translate-y-0.5 hover:bg-violet-200"
                  type="button"
                >
                  听这一页
                </button>
                <button
                  onClick={goPreviousPage}
                  disabled={pageIndex === 0}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                >
                  上一页
                </button>
                <button
                  onClick={goNextPage}
                  className="rounded-full bg-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                  type="button"
                >
                  {pageIndex < shownBook.pages.length - 1 ? "下一页" : "我听完啦"}
                </button>
                <button
                  onClick={markFavoriteStory}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:-translate-y-0.5"
                  type="button"
                >
                  我喜欢这个
                </button>
              </div>
            </div>
          </section>

          <div className="rounded-[1.4rem] bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">第三步：阅读打卡</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              听完或翻完小绘本，就可以点“今天读完啦”。
            </p>
            <button
              onClick={completeReadingCheckin}
              disabled={completed}
              className="mt-3 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              今天读完啦
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            1. 找绘本
          </span>
          <span
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              listenCount > 0 || finished ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700"
            }`}
          >
            {listenCount > 0 || finished ? "✓ " : ""}2. 听绘本
          </span>
          <span
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              completed ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700"
            }`}
          >
            {completed ? "✓ " : ""}3. 阅读打卡
          </span>
        </div>
        {completed ? (
          <div className="mt-4 rounded-[1.6rem] bg-emerald-100 p-5">
            <p className="text-sm font-semibold text-emerald-900">今天读完啦</p>
            <h4 className="mt-1 text-2xl font-semibold text-slate-900">阅读小贴纸来啦</h4>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              你听了《{shownBook.title}》，老师和家长都能看到这次阅读打卡。
            </p>
            <button
              onClick={resetGame}
              className="mt-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:-translate-y-0.5"
              type="button"
            >
              再找一本
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-violet-950">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="violet" />
        </div>
      </div>
    </div>
  );
}

function HabitTemplateCheckinPanel({
  mode = "talk",
  templates,
  onBackToHome,
  onSpeak,
  onComplete,
}: {
  mode?: "talk" | "task";
  templates: HabitCheckinTemplate[];
  onBackToHome?: () => void;
  onSpeak?: SpeakHandler;
  onComplete?: (
    pickedItems: string[],
    detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>,
  ) => void;
}) {
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [childReply, setChildReply] = useState("");
  const [mediaName, setMediaName] = useState("");
  const [mediaType, setMediaType] = useState<"photo" | "video" | "">("");
  const [talkType, setTalkType] = useState("我想说开心的事");
  const [replyInputMode, setReplyInputMode] = useState<"text" | "voice">("text");
  const [selectedCard, setSelectedCard] = useState("");
  const [feedback, setFeedback] = useState(
    mode === "task" ? "先看老师的小任务，听一听，再做一小步。" : "可以说一句、写一句，也可以拍一张或放一段小视频给老师。",
  );
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const defaultTemplate = useMemo<HabitCheckinTemplate>(
    () => ({
      id: "child-to-teacher-free-talk",
      title: "我想对老师说",
      habitFocus: "幼儿表达",
      childPrompt: "我想对老师说：",
      teacherPrompt: "请关注幼儿想法、心情、需要帮助的地方和愿意完成的小步。",
      storyText: "这里可以说一个想法、一个心情，或者一个想请老师帮忙的小秘密。老师会收到。",
      answerCards: ["我想告诉老师", "我想请老师帮忙", "我完成了一小步"],
      habitTask: "说一句想法或心情",
      publishedAt: new Date(0).toISOString(),
    }),
    [],
  );
  const availableTemplates = mode === "talk" ? [defaultTemplate] : templates;
  const activeTemplate =
    availableTemplates.find((template) => template.id === activeTemplateId) ?? availableTemplates[0];
  const completed = Boolean(selectedCard);

  useEffect(() => {
    const templateRecognitionRef = recognitionRef;

    return () => {
      templateRecognitionRef.current?.stop();
    };
  }, []);

  function pickTemplate(template: HabitCheckinTemplate) {
    setActiveTemplateId(template.id);
    setChildReply("");
    setMediaName("");
    setMediaType("");
    setSelectedCard("");
    const message =
      mode === "task"
        ? `老师给了${template.title}。先听任务，再完成一个小步骤。`
        : `这里是${template.title}。你可以说一句、写一句，也可以拍一张或放一段小视频给老师。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function handleMediaSelect(file?: File) {
    if (!file) {
      setMediaName("");
      setMediaType("");
      return;
    }

    setMediaName(file.name);
    setMediaType(file.type.startsWith("video/") ? "video" : "photo");
    setFeedback(
      mode === "task"
        ? `已经选择${file.name}。完成后可以给老师看。`
        : `已经放好${file.name}。想说的话也可以一起送给老师。`,
    );
  }

  function toggleVoiceInput() {
    startChildVoiceInput({
      recognitionRef,
      isListening,
      setListening: setIsListening,
      onStart: mode === "task" ? "我在听啦，可以说说你完成了哪一步。" : "我在听啦，可以跟老师说开心、不开心，或一个小秘密。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setFeedback(message);
        onSpeak?.(message);
      },
      onResult: (transcript) => {
        const nextReply = transcript.slice(0, 80);
        const message = mode === "task" ? `我听见啦：${nextReply}。再选一张答案卡。` : `我听见啦：${nextReply}。可以送给老师。`;

        setChildReply(nextReply);
        setReplyInputMode("voice");
        setFeedback(message);
        onSpeak?.(message);
      },
    });
  }

  function completeTemplate(card: string) {
    if (!activeTemplate || completed) {
      return;
    }

    const reply = childReply.trim() || (mediaName ? `我上传了${mediaName}` : activeTemplate.childPrompt);
    const message =
      mode === "task"
        ? `老师给我的任务完成啦：你选择了“${card}”，也完成了“${activeTemplate.habitTask}”。小贴纸来啦。`
        : `老师收到啦：你选择了“${card}”，也说了“${reply}”。`;
    setSelectedCard(card);
    setFeedback(message);
    onSpeak?.(message);
    onComplete?.([
      `小任务:${activeTemplate.title}`,
      `回应:${reply}`,
      `答案:${card}`,
      `小任务:${activeTemplate.habitTask}`,
    ], {
      storyTopic: activeTemplate.title,
      answerContent: card,
      habitTask: activeTemplate.habitTask,
      childUtterance: reply,
      activityType: mode === "talk" ? "child-message" : "teacher-task",
      taskId: activeTemplate.id,
      assignedByTeacher: mode === "task",
      status: "completed",
      result: "success",
      attempts: 1,
      retryCount: 0,
      messageType: mediaType || (childReply.trim() ? "text" : "mixed"),
      mediaUrl: mediaName,
      uploadedFileName: mediaName,
      teacherRead: false,
      teacherReply: "",
      source: mode === "task" ? "teacher-assigned-task" : "child-to-teacher",
    });
  }

  function resetTalkMailbox() {
    setChildReply("");
    setMediaName("");
    setMediaType("");
    setSelectedCard("");
    setReplyInputMode("text");
    const message = "小信箱打开啦。你可以再跟老师说一件事。";
    setFeedback(message);
    onSpeak?.(message);
  }

  function sendTalkMessage() {
    const reply = childReply.trim();

    if (!reply && !mediaName) {
      const message = "可以先说一句，或者写一句，再送给老师。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const safeReply = reply || `我给老师放了${mediaName}`;
    const message = "老师收到啦。老师会认真看见你。";

    setSelectedCard("老师收到啦");
    setFeedback(message);
    onSpeak?.(message);
    onComplete?.([
      "对老师说",
      `心情:${talkType}`,
      `内容:${safeReply}`,
      mediaName ? `小文件:${mediaName}` : "",
    ].filter(Boolean), {
      activityType: "child-message",
      templateType: "child-to-teacher",
      activityId: "child-warm-mailbox",
      action: "send-to-teacher",
      storyTopic: "对老师说",
      answerContent: talkType,
      childUtterance: safeReply,
      result: "success",
      attempts: 1,
      status: "completed",
      messageType: mediaType ? mediaType : replyInputMode,
      mediaUrl: mediaName,
      uploadedFileName: mediaName,
      teacherRead: false,
      teacherReply: "",
      source: "child-to-teacher",
    });
  }

  if (mode === "talk") {
    const canSendTalk = Boolean(childReply.trim() || mediaName);
    const talkSent = Boolean(selectedCard);
    const introText =
      "你可以跟老师分享快乐的事、不开心的事，或者一个小秘密。老师会认真看见你。";
    const talkTypeOptions = [
      { icon: "😊", label: "我想说开心的事", hint: "把快乐说给老师听" },
      { icon: "☁️", label: "我有一点不开心", hint: "老师陪你慢慢说" },
      { icon: "🤝", label: "我想请老师帮忙", hint: "告诉老师需要什么" },
      { icon: "💌", label: "我有一个小秘密", hint: "放进温馨小信箱" },
    ];

    return (
      <div className="rounded-[2rem] border border-rose-100 bg-[linear-gradient(135deg,#fff7fb_0%,#ffffff_52%,#effdf6_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)] xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-700">温馨小信箱</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">我想对老师说</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700">{introText}</p>
          </div>
          <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="rose" />
        </div>

        {talkSent ? (
          <div className="mt-5 rounded-[1.8rem] bg-emerald-100 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white text-5xl shadow-sm">
                💌
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">老师收到啦</p>
                <h4 className="mt-1 text-2xl font-semibold text-slate-900">你的小话已经送到啦</h4>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  老师会认真看见你，也会温柔地回应你。
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={resetTalkMailbox}
                className="rounded-full bg-rose-200 px-5 py-3 text-sm font-semibold text-rose-950 transition hover:-translate-y-0.5"
                type="button"
              >
                我还想说
              </button>
              <button
                onClick={() => {
                  resetTalkMailbox();
                  onBackToHome?.();
                }}
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:-translate-y-0.5"
                type="button"
              >
                🏠 回到我的小首页
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {talkTypeOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    setTalkType(option.label);
                    const message = `${option.label}。可以说给老师听。`;
                    setFeedback(message);
                    onSpeak?.(message);
                  }}
                  className={`min-h-32 rounded-[1.5rem] p-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
                    talkType === option.label
                      ? "bg-rose-100 text-rose-950 ring-2 ring-rose-200"
                      : "bg-white/85 text-slate-800"
                  }`}
                  type="button"
                >
                  <span className="text-4xl">{option.icon}</span>
                  <span className="mt-3 block">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">👉 {option.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[1.7rem] bg-white/86 p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <textarea
                  value={childReply}
                  onChange={(event) => {
                    setReplyInputMode("text");
                    setChildReply(event.target.value.slice(0, 120));
                  }}
                  placeholder="可以写：老师，我今天很开心……"
                  className="min-h-28 rounded-[1.2rem] border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300"
                />
                <div className="flex flex-col gap-3">
                  <button
                    onClick={toggleVoiceInput}
                    className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      isListening ? "bg-rose-700 text-white" : "bg-cyan-100 text-cyan-900"
                    }`}
                    type="button"
                  >
                    {isListening ? "我说完啦" : "🎤 说给老师听"}
                  </button>
                  <label className="rounded-[1.2rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                    <span className="flex items-center gap-2">
                      <span className="text-2xl">📷</span>
                      拍一张给老师看
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleMediaSelect(event.target.files?.[0])}
                      className="mt-2 w-full text-xs font-semibold text-slate-700"
                    />
                  </label>
                  <label className="rounded-[1.2rem] bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
                    <span className="flex items-center gap-2">
                      <span className="text-2xl">🎬</span>
                      放一段小视频给老师看
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(event) => handleMediaSelect(event.target.files?.[0])}
                      className="mt-2 w-full text-xs font-semibold text-slate-700"
                    />
                  </label>
                </div>
              </div>
              {mediaName ? (
                <p className="mt-3 rounded-[1rem] bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
                  已选择：{mediaName}。点“送给老师”，老师就能看到。
                </p>
              ) : null}
              {canSendTalk ? (
                <button
                  onClick={sendTalkMessage}
                  className="mt-4 rounded-full bg-orange-300 px-6 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-200"
                  type="button"
                >
                  送给老师
                </button>
              ) : null}
              <p className="mt-4 rounded-[1.2rem] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-950">
                {feedback}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)] xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            {mode === "task" ? "老师给我的任务" : "对老师说"}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {mode === "task" ? "完成老师的小任务" : "我想告诉老师"}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {mode === "task"
              ? "只看老师给的小练习，做完老师就知道啦。"
              : "可以说想法、心情或小秘密，老师会收到并回复。"}
          </p>
        </div>
        <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听提示" tone="emerald" />
      </div>

      {availableTemplates.length === 0 ? (
        <div className="mt-5 rounded-[1.5rem] bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900">
          今天先去好习惯闯关或故事小剧场玩一玩，小任务等会儿再来。
        </div>
      ) : null}

      {availableTemplates.length > 0 ? (
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {availableTemplates.slice(0, 6).map((template) => (
          <button
            key={template.id}
            onClick={() => pickTemplate(template)}
            className={`rounded-[1.4rem] px-4 py-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
              activeTemplate?.id === template.id ? "bg-emerald-100 text-emerald-950 ring-2 ring-emerald-200" : "bg-slate-50 text-slate-800"
            }`}
            type="button"
          >
            <span className="text-3xl">🗣️</span>
            <span className="mt-2 block">{template.title}</span>
            <span className="mt-1 inline-flex rounded-full bg-white/80 px-2 py-1 text-[11px] text-emerald-800">
              👉 选这个
            </span>
            <span className="mt-1 block text-xs leading-5 text-emerald-700">{template.habitFocus}</span>
          </button>
        ))}
      </div>
      ) : null}

      {activeTemplate ? (
        <div className="mt-5 rounded-[1.6rem] bg-emerald-50 p-5">
          <TeacherMessageQuestStage
            activeTemplate={activeTemplate}
            childReply={childReply}
            onPlayStory={() => onSpeak?.(activeTemplate.storyText)}
            selectedCard={selectedCard}
          />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-800">现在想说</p>
              <h4 className="mt-1 text-xl font-semibold text-slate-900">{activeTemplate.title}</h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">{activeTemplate.storyText}</p>
            </div>
            <SpeechCueButton text={activeTemplate.storyText} onSpeak={onSpeak} label="听故事" tone="emerald" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={childReply}
              onChange={(event) => setChildReply(event.target.value.slice(0, 80))}
              placeholder={activeTemplate.childPrompt}
              className="rounded-[1.1rem] border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-300"
            />
            <button
              onClick={toggleVoiceInput}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                isListening ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-900"
              }`}
              type="button"
            >
              {isListening ? "停止听写" : "🎤 语音对老师说"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {activeTemplate.answerCards.map((card) => (
              <button
                key={card}
                onClick={() => completeTemplate(card)}
                disabled={completed}
                className={`rounded-[1.3rem] px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selectedCard === card ? "bg-emerald-700 text-white" : "bg-white text-emerald-950"
                }`}
                type="button"
              >
                👉 选这个：{card}
              </button>
            ))}
          </div>
          <p className="mt-4 rounded-[1.2rem] bg-white/80 px-4 py-3 text-sm font-semibold text-emerald-950">
            {feedback}
          </p>
          {completed ? (
            <div className="mt-4 rounded-[1.6rem] bg-emerald-100 p-5">
              <p className="text-sm font-semibold text-emerald-900">老师的小任务完成啦</p>
              <h4 className="mt-1 text-2xl font-semibold text-slate-900">小贴纸来啦</h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                你完成了“{activeTemplate.title}”，老师能看到这次小练习。
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => pickTemplate(activeTemplate)}
                  className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5"
                  type="button"
                >
                  再试一次也可以
                </button>
                <button
                  onClick={() => onBackToHome?.()}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:-translate-y-0.5"
                  type="button"
                >
                  🏠 回到我的小首页
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MealMannersGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (pickedItems: string[]) => void;
  onSpeak?: SpeakHandler;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("听一个动作口令，做到了就点“我做到了”。");
  const completionReportedRef = useRef(false);
  const completed = completedActions.length === mealMannerActions.length;
  const currentAction = mealMannerActions[currentIndex];
  const introText =
    contentConfig?.childGoal.trim() ||
    "跟着 AI 口令做进餐好习惯动作：扶好碗、脚放稳、轻轻嚼、按需取餐、餐后整理。";

  function completeCurrentAction() {
    if (completed || !currentAction) {
      return;
    }

    const nextActions = [...completedActions, currentAction.label];
    const allDone = nextActions.length === mealMannerActions.length;
    const message = allDone
      ? "文明进餐操全部完成啦。轻声用餐、按需取餐、珍惜食物和餐后整理都练到了。"
      : `做得稳稳的。下一句口令：${mealMannerActions[currentIndex + 1].command}`;

    setCompletedActions(nextActions);
    setFeedback(message);
    onSpeak?.(message);

    if (allDone && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(nextActions);
    }

    if (!allDone) {
      setCurrentIndex((index) => index + 1);
    }
  }

  function resetGame() {
    setCurrentIndex(0);
    setCompletedActions([]);
    setFeedback("听一个动作口令，做到了就点“我做到了”。");
    completionReportedRef.current = false;
    onSpeak?.("文明进餐操重新开始。先听第一句口令，再做动作。");
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-700">一日生活任务</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "文明进餐操"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
          type="button"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
          <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="amber" />
      </div>
      <div className="mt-4">
        <GameEngineStage
          gameKey="mealManners"
          activeStep={completedActions.length}
          pickedItems={completedActions}
          tone="amber"
        />
      </div>
      <div className="mt-4">
        <MealMannersRhythmStage
          actions={mealMannerActions}
          currentIndex={currentIndex}
          completedActions={completedActions}
          onPickAction={completeCurrentAction}
        />
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-amber-50 p-5">
        <div className="rounded-[1.5rem] bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold text-amber-800">
            第 {Math.min(currentIndex + 1, mealMannerActions.length)} 组动作
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-amber-100 text-5xl">
                {currentAction?.icon ?? "🌟"}
              </div>
              <h4 className="mt-4 text-xl font-semibold text-slate-900">
                {currentAction?.label ?? "全部完成"}
              </h4>
              <p className="mt-2 text-sm leading-7 font-semibold text-amber-950">
                {completed ? "进餐操完成啦。" : currentAction.command}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SpeechCueButton
                text={completed ? feedback : currentAction.command}
                onSpeak={onSpeak}
                label="听口令"
                tone="amber"
              />
              <button
                onClick={completeCurrentAction}
                disabled={completed}
                className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                我做到了
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {mealMannerActions.map((action) => {
            const done = completedActions.includes(action.label);

            return (
              <span
                key={action.label}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  done ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-600"
                }`}
              >
                {done ? "✓ " : ""}
                {action.icon} {action.label}
              </span>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="amber" />
        </div>
      </div>
    </div>
  );
}

function HabitTrafficLightGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (pickedItems: string[]) => void;
  onSpeak?: SpeakHandler;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("听一个行为，好习惯选绿牌，需要调整选红牌。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = answers.length === habitTrafficLightCards.length;
  const currentCard = habitTrafficLightCards[currentIndex];
  const introText =
    contentConfig?.childGoal.trim() ||
    "听一个行为，觉得是好习惯就选绿牌；需要调整就选红牌，再听正确做法。";

  function answer(cardColor: "green" | "red") {
    if (completed || !currentCard) {
      return;
    }

    if (cardColor !== currentCard.answer) {
      const message = `再听一次。${currentCard.goodPractice}`;
      setMistakeCount((count) => count + 1);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextAnswers = [
      ...answers,
      `${currentCard.behavior}:${cardColor === "green" ? "绿牌" : "红牌"}`,
    ];
    const allDone = nextAnswers.length === habitTrafficLightCards.length;
    const message = allDone
      ? "红绿牌全部完成啦。你能判断好习惯，也知道需要调整时怎么做。"
      : `选对啦。${currentCard.goodPractice} 下一题：${habitTrafficLightCards[currentIndex + 1].behavior}。`;

    setAnswers(nextAnswers);
    setFeedback(message);
    onSpeak?.(message);

    if (allDone && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(nextAnswers);
    }

    if (!allDone) {
      setCurrentIndex((index) => index + 1);
    }
  }

  function resetGame() {
    setCurrentIndex(0);
    setAnswers([]);
    setMistakeCount(0);
    setFeedback("听一个行为，好习惯选绿牌，需要调整选红牌。");
    completionReportedRef.current = false;
    onSpeak?.("好习惯红绿牌重新开始。听行为，选绿牌或红牌。");
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-rose-700">红绿牌小游戏</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "好习惯红绿牌"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-200"
          type="button"
        >
          再玩一次
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="rose" />
      </div>
      <div className="mt-4">
        <GameEngineStage
          gameKey="habitTrafficLight"
          activeStep={answers.length}
          pickedItems={answers}
          tone="rose"
        />
      </div>
      <div className="mt-4">
        <TrafficLightDecisionStage
          answers={answers}
          completed={completed}
          currentIndex={currentIndex}
          onAnswer={answer}
        />
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-rose-50 p-5">
        <div className="rounded-[1.5rem] bg-white/90 p-5 shadow-sm">
          <p className="text-xs font-semibold text-rose-700">
            第 {Math.min(currentIndex + 1, habitTrafficLightCards.length)} 题
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-rose-100 text-5xl">
                {currentCard?.icon ?? "🌟"}
              </div>
              <h4 className="mt-4 text-xl font-semibold text-slate-900">
                {currentCard?.behavior ?? "全部完成"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {completed ? "红绿牌完成啦。" : "这个行为应该举绿牌，还是红牌？"}
              </p>
            </div>
            <SpeechCueButton
              text={
                completed
                  ? feedback
                  : `${currentCard.behavior}。这是好习惯选绿牌，需要调整选红牌。`
              }
              onSpeak={onSpeak}
              label="听行为"
              tone="rose"
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => answer("green")}
              disabled={completed}
              className="rounded-[1.4rem] bg-emerald-100 px-5 py-4 text-left font-semibold text-emerald-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              🟢 绿牌
              <span className="mt-1 block text-xs leading-5 text-emerald-800">这是可以保持的好习惯。</span>
            </button>
            <button
              onClick={() => answer("red")}
              disabled={completed}
              className="rounded-[1.4rem] bg-rose-100 px-5 py-4 text-left font-semibold text-rose-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              🔴 红牌
              <span className="mt-1 block text-xs leading-5 text-rose-800">这个做法需要换一换。</span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-rose-900">
            已判断 {answers.length}/{habitTrafficLightCards.length} 题，重新听 {mistakeCount} 次。
          </p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="rose" />
        </div>
        <p className="mt-2 text-sm font-semibold text-rose-800">{feedback}</p>
      </div>
    </div>
  );
}

function FoodTrainGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (pickedItems: string[]) => void;
  onSpeak?: SpeakHandler;
}) {
  const defaultTrainRoute = foodTrainStations.slice(0, Math.min(4, foodTrainStations.length));
  const defaultTrainChoices = foodTrainStations.slice(0, Math.min(8, foodTrainStations.length));
  const [route, setRoute] = useState(defaultTrainRoute);
  const [choiceBoard, setChoiceBoard] = useState(defaultTrainChoices);
  const [stationIndex, setStationIndex] = useState(0);
  const [arrivedStations, setArrivedStations] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("小列车准备出发。先听进站口令，再点正确的美食站。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = arrivedStations.length === route.length;
  const currentStation = route[stationIndex];
  const introText =
    contentConfig?.childGoal.trim() ||
    "小列车到站啦。听站名和短儿歌，点击正确的泉州美食站，全部到站后可以把一种美食介绍给家人。";

  function pickStation(label: string) {
    if (completed || !currentStation) {
      return;
    }

    if (label !== currentStation.label) {
      const message = `这次还没到${label}站。再听一遍：${currentStation.command}`;
      setMistakeCount((count) => count + 1);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextStations = [...arrivedStations, label];
    const allDone = nextStations.length === route.length;
    const message = allDone
      ? "闽食小列车全部到站啦。你认识了好多泉州美食，可以选一种介绍给家人。"
      : `到站成功。${currentStation.chant} 下一站：${route[stationIndex + 1].station}。`;

    setArrivedStations(nextStations);
    setFeedback(message);
    onSpeak?.(message);

    if (allDone && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(nextStations);
    }

    if (!allDone) {
      setStationIndex((index) => index + 1);
    }
  }

  function resetGame(shouldSpeak = true) {
    const nextRound = createFoodTrainRound();
    setRoute(nextRound.route);
    setChoiceBoard(nextRound.choices);
    setStationIndex(0);
    setArrivedStations([]);
    setMistakeCount(0);
    setFeedback("小列车换了一条新路线。先听进站口令，再点正确的美食站。");
    completionReportedRef.current = false;
    if (shouldSpeak) {
      onSpeak?.("闽食小列车重新发车。这次站点和顺序都换啦，先听第一站口令。");
    }
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">听站找美食</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "闽食小列车"}
          </h3>
        </div>
          <button
          onClick={() => resetGame()}
          className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-200"
          type="button"
        >
          重新发车
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="teal" />
      </div>
      <div className="mt-4">
        <GameEngineStage
          gameKey="foodTrain"
          activeStep={arrivedStations.length}
          pickedItems={arrivedStations}
          tone="teal"
        />
      </div>
      <div className="mt-4">
        <FoodTrainTrack
          route={route}
          stationIndex={stationIndex}
          arrivedStations={arrivedStations}
          completed={completed}
          onPickStation={pickStation}
        />
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-teal-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-white/90 p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              第 {Math.min(stationIndex + 1, route.length)} 站 · {currentStation?.station ?? "全部到站"}
            </p>
            <h4 className="mt-2 text-xl font-semibold text-slate-900">
              🚂 {completed ? "小列车休息站" : currentStation.command}
            </h4>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {completed ? "可以把一种泉州美食介绍给家人。" : currentStation.chant}
            </p>
          </div>
          <SpeechCueButton
            text={completed ? feedback : `${currentStation.command}${currentStation.chant}`}
            onSpeak={onSpeak}
            label="听进站"
            tone="teal"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {choiceBoard.map((station, index) => {
            const done = arrivedStations.includes(station.label);

            return (
              <button
                key={`${station.station}-${station.label}-${index}`}
                onClick={() => pickStation(station.label)}
                disabled={done || completed}
                className={`rounded-[1.3rem] px-3 py-4 text-center text-sm font-semibold transition ${
                  done
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-white text-slate-800 hover:-translate-y-0.5 hover:bg-teal-100"
                }`}
                type="button"
              >
                <FoodMiniMaterialCard label={station.label} compact />
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {done ? "已到站" : station.station}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-teal-900">
            已到站 {arrivedStations.length}/{route.length}，重新听 {mistakeCount} 次。
          </p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="teal" />
        </div>
      </div>
    </div>
  );
}

function FoodGuessGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (pickedItems: string[]) => void;
  onSpeak?: SpeakHandler;
}) {
  const [rounds, setRounds] = useState(() => createFoodGuessRound(false));
  const [roundIndex, setRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [revealedHintCount, setRevealedHintCount] = useState(1);
  const [feedback, setFeedback] = useState("打开美食宝箱，听线索猜食材。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = answers.length === rounds.length;
  const currentRound = rounds[roundIndex];
  const introText =
    contentConfig?.childGoal.trim() ||
    "听宝箱线索，从食材卡里找到答案。每次开箱都会换一组食材。";

  function pickAnswer(label: string) {
    if (completed || !currentRound) {
      return;
    }

    if (label !== currentRound.answer) {
      const message = `再找一找。线索是：${currentRound.hints.join("，")}。`;
      setMistakeCount((count) => count + 1);
      setRevealedHintCount(currentRound.hints.length);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextAnswers = [...answers, label];
    const allDone = nextAnswers.length === rounds.length;
    const message = allDone
      ? "美食猜猜乐完成啦。你已经是小小美食播报员。"
      : `${currentRound.praise} 下一只宝箱：${rounds[roundIndex + 1].treasure}。`;

    setAnswers(nextAnswers);
    setFeedback(message);
    onSpeak?.(message);

    if (allDone && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(nextAnswers);
    }

    if (!allDone) {
      setRevealedHintCount(1);
      setRoundIndex((index) => index + 1);
    }
  }

  function revealTreasureHint() {
    if (completed || !currentRound) {
      return;
    }

    const nextCount = Math.min(currentRound.hints.length, revealedHintCount + 1);
    setRevealedHintCount(nextCount);
    const hint = currentRound.hints[nextCount - 1] ?? currentRound.hints[0];
    const message =
      nextCount >= currentRound.hints.length
        ? `宝箱线索都翻开啦：${currentRound.hints.join("，")}。现在点食材卡。`
        : `翻开一条线索：${hint}。还可以继续翻，或者直接猜。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function resetGame() {
    setRounds(createFoodGuessRound());
    setRoundIndex(0);
    setAnswers([]);
    setRevealedHintCount(1);
    setMistakeCount(0);
    setFeedback("宝箱顺序已经换啦。听线索猜食材。");
    completionReportedRef.current = false;
    onSpeak?.("美食猜猜乐重新开始。这次食材和选项都换啦。");
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">闽食观察任务</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "美食猜猜乐"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-200"
          type="button"
        >
          重新开箱
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="cyan" />
      </div>
      <div className="mt-4">
        <GameEngineStage
          gameKey="foodGuess"
          activeStep={answers.length}
          pickedItems={answers}
          tone="cyan"
        />
      </div>
      <div className="mt-4">
        <FoodGuessChestStage
          answers={answers}
          completed={completed}
          currentRound={currentRound}
          onOpenChest={revealTreasureHint}
          onPickOption={pickAnswer}
          options={currentRound?.options ?? []}
          revealedHintCount={revealedHintCount}
          roundIndex={roundIndex}
          total={rounds.length}
        />
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-cyan-50 p-5">
        <div className="rounded-[1.5rem] bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-cyan-700">
                第 {Math.min(roundIndex + 1, rounds.length)} 个宝箱 · {currentRound?.treasure ?? "全部完成"}
              </p>
              <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-cyan-100 text-5xl">
                {currentRound?.icon ?? "🎁"}
              </div>
              <h4 className="mt-4 text-xl font-semibold text-slate-900">食材藏在哪里？</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {(currentRound?.hints ?? []).map((hint) => (
                  <span key={hint} className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900">
                    {hint}
                  </span>
                ))}
              </div>
            </div>
            <SpeechCueButton
              text={completed ? feedback : `宝箱线索：${currentRound?.hints.join("，")}。请找食材卡。`}
              onSpeak={onSpeak}
              label="听线索"
              tone="cyan"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {(currentRound?.options ?? []).map((option) => (
              <button
                key={option}
                onClick={() => pickAnswer(option)}
                disabled={completed}
                className="rounded-[1.3rem] bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-cyan-900">
            已猜中 {answers.length}/{rounds.length} 个，重新听 {mistakeCount} 次。
          </p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="cyan" />
        </div>
      </div>
    </div>
  );
}

function FoodTreasureQuestGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (pickedItems?: string[]) => void;
  onSpeak?: SpeakHandler;
}) {
  const [initialRound] = useState(() => createFoodTreasureRound(false));
  const [questFoods, setQuestFoods] = useState(initialRound.targets);
  const [choiceBoard, setChoiceBoard] = useState(initialRound.choices);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matched, setMatched] = useState<string[]>([]);
  const [stallObservations, setStallObservations] = useState<string[]>([]);
  const [selectedFood, setSelectedFood] = useState("");
  const [collectedIngredients, setCollectedIngredients] = useState<string[]>([]);
  const [selectedApproachStep, setSelectedApproachStep] = useState("");
  const [feedback, setFeedback] = useState("先听线索，像逛小岛一样找到第一个泉州美食摊位。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = matched.length === questFoods.length;
  const currentFood = questFoods[currentIndex];
  const currentStep = minnanFoodObserveSteps[currentIndex] ?? minnanFoodObserveSteps.at(-1);
  const ingredientTotal = currentFood?.ingredients.length ?? 0;
  const ingredientsComplete = ingredientTotal > 0 && collectedIngredients.length === ingredientTotal;
  const introText =
    contentConfig?.childGoal.trim() ||
    "像逛泉州美食小岛一样，先认名字、找食材、听小故事，再选一个愿意靠近的小步骤。";
  const clueText = currentFood
    ? `第 ${Math.min(currentIndex + 1, questFoods.length)} 站，${currentFood.stall}。线索：${currentFood.clue}${currentFood.pictureHint}`
    : "摊位寻宝完成啦。";
  const currentFoodNutritionText = currentFood
    ? buildFoodNutritionIntro(currentFood.label, currentFood.ingredients)
    : "";

  function handlePickFood(label: string) {
    if (completed || matched.includes(label) || !currentFood) {
      return;
    }

    if (selectedFood) {
      const message = "这一摊已经找对啦，先收集食材卡、选靠近小步，再点去下一摊。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (label !== currentFood.label) {
      const message = `还不是 ${label}。再听一次线索：${currentFood.stall}，${currentFood.clue}${currentFood.pictureHint}`;
      setMistakeCount((current) => current + 1);
      setFeedback(message);
      onSpeak?.(`再试一次。${message}`);
      return;
    }

    setSelectedFood(label);
    setCollectedIngredients([]);
    setSelectedApproachStep("");
    const message = `找对啦，这是${currentFood.label}，在${currentFood.stall}。这里有${currentFood.ingredients.join("、")}。${currentFoodNutritionText}先收集食材卡，再听一个小故事。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function handlePickIngredient(ingredient: string) {
    if (!selectedFood || collectedIngredients.includes(ingredient) || !currentFood) {
      return;
    }

    const nextIngredients = [...collectedIngredients, ingredient];
    setCollectedIngredients(nextIngredients);
    const nutritionText = buildIngredientNutritionIntro(ingredient);
    const shapeText = getFoodPreferenceShapeHint(ingredient);
    const message =
      nextIngredients.length === ingredientTotal
        ? `${ingredient}食材卡收好啦。样子线索：${shapeText}。${nutritionText}${currentFood.label}的食材卡集齐了，可以听故事、选小步，再去下一摊。`
        : `${ingredient}食材卡收好啦。样子线索：${shapeText}。${nutritionText}继续找下一张食材卡。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function goNextStall() {
    if (!currentFood || !selectedFood) {
      const message = "先根据线索点对这个摊位的美食。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!ingredientsComplete) {
      const message = "先把这个摊位的食材卡收集完，再去下一摊。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!selectedApproachStep) {
      const message = "再选一个愿意靠近的小步，比如看一看、闻一闻或说出名字。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextMatched = [...matched, currentFood.label];
    const nextObservations = [
      ...stallObservations,
      `${currentFood.label}｜食材：${currentFood.ingredients.join("、")}｜靠近小步：${selectedApproachStep}`,
    ];

    setMatched(nextMatched);
    setStallObservations(nextObservations);
    setSelectedFood("");
    setCollectedIngredients([]);
    setSelectedApproachStep("");

    if (nextMatched.length === questFoods.length) {
      const message = "泉州美食摊位寻宝完成啦。你认识了名字、食材、小故事，也愿意靠近一点点。小贴纸来啦。";
      setFeedback(message);
      onSpeak?.(message);
      if (!completionReportedRef.current) {
        completionReportedRef.current = true;
        onComplete?.(nextObservations);
      }
      return;
    }

    const nextFood = questFoods[currentIndex + 1];
    setCurrentIndex((index) => Math.min(index + 1, questFoods.length - 1));
    const message = `去下一摊。请听线索：${nextFood.stall}，${nextFood.clue}${nextFood.pictureHint}`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function resetGame(shouldSpeak = false) {
    const nextRound = createFoodTreasureRound();
    setQuestFoods(nextRound.targets);
    setChoiceBoard(nextRound.choices);
    setCurrentIndex(0);
    setMatched([]);
    setStallObservations([]);
    setSelectedFood("");
    setCollectedIngredients([]);
    setSelectedApproachStep("");
    setMistakeCount(0);
    setFeedback("摊位和顺序已经换新。先听线索，找到第一个泉州美食摊位。");
    completionReportedRef.current = false;
    if (shouldSpeak) {
      onSpeak?.("泉州美食摊位寻宝重新开始。这次摊位和顺序都换啦，先听第一个线索。");
    }
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">逛摊找食材</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "泉州美食摊位寻宝"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame(true);
          }}
          className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-200"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="teal" />
      </div>
      <div className="mt-4">
        <MiniLoopChips steps={["听线索", "看摊位", "找食材", "点图片", "靠近一步", "完成啦"]} />
      </div>
      <div className="mt-3">
        <GameEngineStage
          gameKey="foodObserve"
          activeStep={Math.min(
            3,
            matched.length + (selectedFood ? 1 : 0) + (ingredientsComplete ? 1 : 0) + (selectedApproachStep ? 1 : 0),
          )}
          pickedItems={[
            ...matched,
            selectedFood ? `找到:${selectedFood}` : "",
            ingredientsComplete ? "食材卡集齐" : "",
            selectedApproachStep,
          ].filter(Boolean)}
          tone="teal"
        />
      </div>
      <div className="mt-4">
        <FoodTreasureMapStage
          completed={completed}
          questFoods={questFoods}
          currentIndex={currentIndex}
          matched={matched}
          onPickFood={handlePickFood}
          selectedFood={selectedFood}
          ingredientsComplete={ingredientsComplete}
          selectedApproachStep={selectedApproachStep}
        />
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-teal-50 p-4">
        <div className="rounded-[1.4rem] bg-white/85 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-teal-700">当前摊位线索</p>
              <p className="mt-2 text-5xl">{currentFood?.icon ?? "⭐"}</p>
              <p className="mt-3 text-base font-semibold text-slate-900">
                {completed ? "摊位全部找到" : currentFood?.clue}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {completed ? "你已经认识了多个泉州美食摊位。" : `${currentFood?.stall ?? ""} · ${currentFood?.pictureHint ?? ""}`}
              </p>
            </div>
            <SpeechCueButton text={completed ? feedback : clueText} onSpeak={onSpeak} label="播放线索" tone="teal" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {questFoods.map((food, index) => {
            const done = matched.includes(food.label);
            const current = index === currentIndex && !completed;

            return (
              <div
                key={getFoodOptionKey(food, index)}
                className={`rounded-[1.3rem] px-3 py-4 text-center text-sm font-semibold ${
                  done
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-white text-teal-900 shadow-sm"
                      : "bg-white/60 text-slate-400"
                }`}
              >
                <span className="block text-3xl">{done || current ? food.icon : "☆"}</span>
                <span className="mt-2 block text-xs opacity-75">第 {index + 1} 摊</span>
                <span className="mt-1 block">{done ? "食材已认" : current ? "正在寻宝" : "等待"}</span>
                <span className="mt-1 block text-xs opacity-75">{food.stall}</span>
                <span className="mt-1 block text-xs opacity-75">{food.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-teal-900">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="teal" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {choiceBoard.map((food, index) => {
          const done = matched.includes(food.label);
          const disabled = done || completed;

          return (
          <button
            key={getFoodOptionKey(food, index)}
            onClick={() => handlePickFood(food.label)}
            disabled={disabled}
            className={`rounded-[1.5rem] px-3 py-3 text-left text-sm font-semibold transition ${
              done
                ? "bg-emerald-100 text-emerald-800"
                : disabled
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-amber-100 text-amber-950 hover:-translate-y-0.5 hover:bg-amber-200"
            }`}
          >
            <FoodMiniMaterialCard label={food.label} ingredients={food.ingredients} compact />
            <span className="mt-2 block text-xs leading-5 text-slate-600">
              {done ? "这个摊位食材已认识" : food.stall}
            </span>
          </button>
          );
        })}
      </div>

      {selectedFood && currentFood ? (
        <div className="mt-5 rounded-[1.6rem] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">摊位食材介绍</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-900">
                {currentFood.icon} {currentFood.label}
              </h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">{currentFood.ingredientIntro}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                样子线索：{currentFood.colorShape}
              </p>
              <p className="mt-2 rounded-[1.2rem] bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">
                {currentFoodNutritionText}
              </p>
              <p className="mt-2 rounded-[1.2rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                小故事：{currentFood.cultureStory}
              </p>
              {currentStep ? (
                <p className="mt-2 rounded-[1.2rem] bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
                  {currentStep.icon} 探味动作：{currentStep.label}，{currentStep.cue}
                </p>
              ) : null}
            </div>
            <SpeechCueButton
              text={`${currentFood.label}的食材有${currentFood.ingredients.join("、")}。${currentFood.ingredientIntro}${currentFoodNutritionText}样子线索：${currentFood.colorShape}。小故事：${currentFood.cultureStory}${currentStep ? `探味动作是${currentStep.label}，${currentStep.cue}` : ""}`}
              onSpeak={onSpeak}
              label="听食材"
              tone="teal"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {uniqueTextItems(currentFood.ingredients).map((ingredient) => {
              const collected = collectedIngredients.includes(ingredient);

              return (
                <button
                  key={`${currentFood.label}-${ingredient}`}
                  onClick={() => handlePickIngredient(ingredient)}
                  disabled={collected}
                  className={`rounded-[1.3rem] px-3 py-3 text-left text-sm font-semibold transition ${
                    collected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-teal-50 text-slate-800 hover:-translate-y-0.5 hover:bg-teal-100"
                  }`}
                >
                  <span className="mb-2 block text-xs font-semibold">
                    {collected ? "✓ 已收集" : "☆ 食材卡"}
                  </span>
                  <FoodMiniMaterialCard label={ingredient} compact />
                </button>
              );
            })}
          </div>

          {ingredientsComplete ? (
            <div className="mt-4 rounded-[1.4rem] bg-amber-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">美食小故事</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {currentFood.cultureStory}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-teal-900">
                    {currentFood.gentleTryTip}
                  </p>
                </div>
                <SpeechCueButton
                  text={`${currentFood.label}。${currentFood.cultureStory}${currentFood.gentleTryTip}`}
                  onSpeak={onSpeak}
                  label="听美食小故事"
                  tone="amber"
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-[1.2rem] bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
              先把食材卡收集齐，再听这个摊位的美食小故事。
            </p>
          )}

          <div className="mt-4 rounded-[1.4rem] bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">可以选择的靠近小步</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentFood.approachSteps.map((step) => (
                <button
                  key={step}
                  onClick={() => {
                    setSelectedApproachStep(step);
                    const message = `你选择了${step}。完成食材卡后，就可以去下一摊。`;
                    setFeedback(message);
                    onSpeak?.(message);
                  }}
                  className={`rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 ${
                    selectedApproachStep === step
                      ? "bg-teal-700 text-white"
                      : "bg-white text-slate-700 hover:bg-teal-50"
                  }`}
                  type="button"
                >
                  {step}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={goNextStall}
            className="mt-4 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-emerald-200"
            type="button"
          >
            {currentIndex + 1 === questFoods.length ? "完成探味寻宝" : "去下一摊"}
          </button>
        </div>
      ) : null}

      {mistakeCount > 0 ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          已帮你重新听线索 {mistakeCount} 次。
        </p>
      ) : null}
    </div>
  );
}

function TodayMenuBroadcast({
  entries,
  onSpeak,
  onPickFood,
}: {
  entries: WeeklyMenuEntry[];
  onSpeak?: SpeakHandler;
  onPickFood: (foodLabel: string, ingredients?: string[], entry?: WeeklyMenuEntry, nutritionPlayed?: boolean) => void;
}) {
  const [selectedMenuFood, setSelectedMenuFood] = useState("");
  const [pickedNutritionMessage, setPickedNutritionMessage] = useState("");
  const menuSpeech = buildTodayMenuSpeech(entries);
  const firstEntry = entries[0];
  const dateLine = firstEntry ? `今天 ${formatMenuDate(firstEntry.date)} ${getWeekdayLabel(firstEntry.date)}` : "";

  function pickMenuEntry(entry: WeeklyMenuEntry) {
    playMenuImageIntro(entry);
  }

  function playMenuImageIntro(entry: WeeklyMenuEntry) {
    const nutritionIngredients =
      entry.focusIngredients.length > 0 ? entry.focusIngredients : entry.ingredients;
    const ingredientText = nutritionIngredients.slice(0, 3).join("、") || "颜色、形状和气味";
    const intro = `${entry.dishName}，今天${entry.mealType}可以先看一看。找找它的颜色、形状，还有${ingredientText}。`;

    setSelectedMenuFood(entry.dishName);
    setPickedNutritionMessage(intro);
    onPickFood(entry.dishName, nutritionIngredients, entry, false);
    onSpeak?.(intro);
  }

  function playMenuNutritionTip(entry: WeeklyMenuEntry) {
    const nutritionIngredients =
      entry.focusIngredients.length > 0 ? entry.focusIngredients : entry.ingredients;
    const nutritionMessage = getFoodCardNutritionText(entry.dishName, nutritionIngredients);

    setSelectedMenuFood(entry.dishName);
    setPickedNutritionMessage(nutritionMessage);
    onPickFood(entry.dishName, nutritionIngredients, entry, true);
    onSpeak?.(nutritionMessage);
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-cyan-200 bg-white/78 p-5 shadow-sm xl:col-span-2">
        <p className="text-sm font-semibold text-cyan-700">今日闽食播报</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">等待老师录入今日食谱</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          老师在教师工作台录入本周食谱后，到了对应日期这里会先播报今天会遇见的菜品和重点食材。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#fff7ed_100%)] p-5 shadow-[0_18px_50px_rgba(35,88,95,0.10)] xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">今日闽食播报</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {entries.length === 1 ? `${dateLine} ${entries[0].mealType}` : `${dateLine} 闽食播报`}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            老师录入的今日食谱会优先进入美食观察与靠近一点点，孩子可以先看一看、闻一闻，不着急入口。
          </p>
        </div>
        <SpeechCueButton text={menuSpeech} onSpeak={onSpeak} label="听今日食谱" tone="cyan" />
      </div>
      <div className="mt-4">
        <MenuPlateStage
          entries={entries}
          onPickEntry={pickMenuEntry}
          selectedMenuFood={selectedMenuFood}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {entries.map((entry) => {
          const focusText =
            entry.focusIngredients.length > 0
              ? entry.focusIngredients.join("、")
              : entry.ingredients.slice(0, 3).join("、") || "观察颜色和气味";
          const selected = selectedMenuFood === entry.dishName;
          const coverImage = getMenuCoverImage(entry);
          const mediaSourceLabel = getMenuMediaSourceText(
            entry.mediaSource ?? getConfirmedMenuObservationImages(entry)[0]?.mediaSource,
          );
          const childSourceLabel = getChildMenuEntrySourceLabel(entry);

          return (
            <article
              key={entry.id}
              className={`rounded-[1.5rem] bg-white/86 px-4 py-4 text-left shadow-sm transition ${
                selected ? "ring-2 ring-cyan-500" : ""
              }`}
            >
              <span className="flex flex-wrap gap-2">
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-900">
                  {entry.mealType}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    childSourceLabel === "今天换餐"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {childSourceLabel}
                </span>
              </span>
              <span className="mt-3 block text-lg font-semibold text-slate-900">{entry.dishName}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">
                日期：{formatMenuDate(entry.date)} · {getWeekdayLabel(entry.date)}
              </span>
              <button
                onClick={() => playMenuImageIntro(entry)}
                className="mt-3 block w-full overflow-hidden rounded-[1.2rem] text-left ring-2 ring-transparent transition hover:-translate-y-0.5 hover:ring-cyan-200"
                type="button"
              >
                {coverImage ? (
                  <span className="block">
                    <SafeFoodImage
                      image={resolveSafeFoodImage(entry.dishName, {
                        scene: "menuImage",
                        menuEntries: entries,
                        ingredients:
                          entry.focusIngredients.length > 0 ? entry.focusIngredients : entry.ingredients.slice(0, 3),
                      })}
                      alt={`${entry.dishName}观察图`}
                      className="h-36 w-full object-cover"
                    />
                    <span className="block bg-cyan-900 px-3 py-2 text-xs font-semibold text-white">
                      👆 点图听菜名 · {mediaSourceLabel}
                    </span>
                  </span>
                ) : (
                  <FoodMiniMaterialCard
                    label={entry.dishName}
                    ingredients={
                      entry.focusIngredients.length > 0 ? entry.focusIngredients : entry.ingredients.slice(0, 3)
                    }
                    compact
                  />
                )}
              </button>
              <span className="mt-2 block text-sm leading-6 text-slate-600">
                食材：{entry.ingredients.join("、") || "老师稍后补充"}
              </span>
              <button
                onClick={() => playMenuNutritionTip(entry)}
                className="mt-2 w-full rounded-[1.1rem] bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                type="button"
              >
                🥕 听营养小发现 · 我想认识：{focusText}
              </button>
            </article>
          );
        })}
      </div>
      {pickedNutritionMessage ? (
        <p className="mt-4 rounded-[1.3rem] bg-cyan-900 px-4 py-3 text-sm font-semibold leading-7 text-white">
          🔊 已播放：{pickedNutritionMessage}
        </p>
      ) : null}
    </div>
  );
}

function FoodPreferenceGame({
  contentConfig,
  onComplete,
  onSpeak,
  preferredFoodLabel = "",
  todayMenuEntries = [],
  prioritizeTodayMenuFoods = true,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (record: FoodPreferenceRecord) => void;
  onSpeak?: SpeakHandler;
  preferredFoodLabel?: string;
  todayMenuEntries?: WeeklyMenuEntry[];
  prioritizeTodayMenuFoods?: boolean;
}) {
  const cleanPreferredFood = preferredFoodLabel.trim();
  const [foodChoices, setFoodChoices] = useState(() => {
    const initialFoods = createFoodPreferenceRound(todayMenuEntries, false).foods;

    return cleanPreferredFood && !initialFoods.some((food) => food.label === cleanPreferredFood)
      ? [buildFoodPreferenceOption(cleanPreferredFood), ...initialFoods].slice(0, 18)
      : initialFoods;
  });
  const [reasonChoices, setReasonChoices] = useState(() => createFoodPreferenceRound(todayMenuEntries, false).reasons);
  const [selectedFood, setSelectedFood] = useState(cleanPreferredFood);
  const [selectedReason, setSelectedReason] = useState("");
  const [selectedApproachStep, setSelectedApproachStep] = useState("");
  const [customFoodMode, setCustomFoodMode] = useState(false);
  const [customFoodName, setCustomFoodName] = useState("");
  const [isListeningForFood, setIsListeningForFood] = useState(false);
  const [isListeningForReason, setIsListeningForReason] = useState(false);
  const [expandedNutritionLabel, setExpandedNutritionLabel] = useState("");
  const [preferMenuFirst, setPreferMenuFirst] = useState(prioritizeTodayMenuFoods);
  const [feedback, setFeedback] = useState(
    cleanPreferredFood
      ? `已选择${cleanPreferredFood}。再说说原因，并选一个愿意靠近的小步。`
      : "选一种今天正在认识的食物，再说说原因和愿意靠近的小步。",
  );
  const [materialImageStatus, setMaterialImageStatus] =
    useState("先看老师确认的观察图；没有图片时，就用食材图文卡。");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const reasonRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const completionReportedRef = useRef(false);
  const displayFoodChoices = useMemo(() => {
    const menuChoices = createMenuFoodPreferenceChoices(todayMenuEntries);
    const menuLabelSet = new Set(menuChoices.map((item) => item.label));
    const customAndFallbackChoices = foodChoices.filter((item) => !menuLabelSet.has(item.label));

    return dedupeFoodPreferenceOptions(
      preferMenuFirst
        ? [...menuChoices, ...customAndFallbackChoices]
        : [...customAndFallbackChoices, ...menuChoices],
    ).slice(0, 18);
  }, [foodChoices, preferMenuFirst, todayMenuEntries]);
  const menuChoiceLabels = useMemo(
    () => new Set(createMenuFoodPreferenceChoices(todayMenuEntries).map((item) => item.label)),
    [todayMenuEntries],
  );
  const selectedFoodInfo =
    displayFoodChoices.find((food) => food.label === selectedFood) ??
    (selectedFood ? buildFoodPreferenceOption(selectedFood) : null);
  const introText = contentConfig?.childGoal.trim() || "先认名字，再选一个靠近小步。";
  const materialSource = resolveFoodMaterialSource(
    selectedFood,
    customFoodName,
    selectedFoodInfo,
    todayMenuEntries,
  );
  const menuImageContext = findBestMenuImageContext(materialSource.subject, todayMenuEntries, "observationFoodImage");
  const materialDisplayImageUrl = menuImageContext.coverImageUrl;
  const materialDisplaySourceLabel = menuImageContext.sourceLabel || "老师准备好的观察图";

  useEffect(() => {
    const foodRecognitionRef = recognitionRef;
    const foodReasonRecognitionRef = reasonRecognitionRef;

    return () => {
      foodRecognitionRef.current?.stop();
      foodReasonRecognitionRef.current?.stop();
    };
  }, []);

  function submitPreference(nextReason = selectedReason, nextApproach = selectedApproachStep) {
    if (!selectedFood || !nextReason || !nextApproach || completionReportedRef.current) {
      return;
    }

    const reason = foodPreferenceReasons.find((item) => item.label === nextReason);
    const food = selectedFoodInfo ?? buildFoodPreferenceOption(selectedFood);
    const menuContext = resolveFoodMenuContext(selectedFood, todayMenuEntries);
    completionReportedRef.current = true;
    onComplete?.({
      recordedAt: new Date().toISOString(),
      foodId: menuContext.ingredientName ?? food.label,
      foodLabel: selectedFood,
      reasonLabel: nextReason,
      reason: nextReason,
      strategy: reason?.strategy ?? "",
      gentleTryTip: `今天选择了一个靠近小步：${nextApproach}。${food.gentleTryTip}`,
      approachStep: nextApproach,
      acceptedLevel: nextApproach,
      nutritionPlayed: expandedNutritionLabel === food.label,
      themeSource: "foodPreference",
      ...menuContext,
    });
  }

  function playNutritionTip(food = selectedFoodInfo) {
    const targetFood = food ?? selectedFoodInfo;

    if (!targetFood) {
      const message = "先选一种食物，再听营养小发现。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nutritionText = buildFoodNutritionIntro(targetFood.label, targetFood.ingredients);
    const message = `${targetFood.label}营养小发现：${nutritionText}`;

    setExpandedNutritionLabel(targetFood.label);
    setFeedback(message);
    onSpeak?.(message);
  }

  function playMaterialIntro() {
    const targetFood = selectedFoodInfo ?? buildFoodPreferenceOption(materialSource.subject);
    const nutritionText = buildFoodNutritionIntro(targetFood.label, targetFood.ingredients);
    const message = `${materialSource.subject}。${getFoodDishShortIntro(targetFood.label, targetFood.ingredients)}营养小发现：${nutritionText}。`;

    setExpandedNutritionLabel(targetFood.label);
    setFeedback(message);
    onSpeak?.(message);
  }

  function handleFoodPick(label: string) {
    const food = displayFoodChoices.find((item) => item.label === label) ?? buildFoodPreferenceOption(label);
    setSelectedFood(label);
    setSelectedReason("");
    setSelectedApproachStep("");
    setCustomFoodMode(false);
    setExpandedNutritionLabel("");
    const nutritionText = buildFoodNutritionIntro(food.label, food.ingredients);
    const message = `${food.label}。${food.colorShape}。营养小发现：${nutritionText}。你可以说说原因，再选一个靠近小步。`;
    setExpandedNutritionLabel(food.label);
    setFeedback(message);
    onSpeak?.(message);
    completionReportedRef.current = false;
  }

  function handleReasonPick(label: string) {
    if (!selectedFood) {
      const message = "先选一种今天正在认识的食物。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const reason = foodPreferenceReasons.find((item) => item.label === label);
    const food = selectedFoodInfo ?? buildFoodPreferenceOption(selectedFood);
    setSelectedReason(label);
    const message =
      food && reason
        ? `谢谢你告诉我：今天可能是${reason.label}。接下来选一个愿意靠近的小步就好。`
        : "我知道你的想法啦，先认识这种食物就很好。";
    setFeedback(message);
    onSpeak?.(message);
    submitPreference(label, selectedApproachStep);
  }

  function handleApproachPick(step: string) {
    if (!selectedFood) {
      const message = "先选一种今天正在认识的食物。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!selectedReason) {
      const message = "再选一张原因卡，老师才知道怎么温和陪你。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    setSelectedApproachStep(step);
    const message = `你愿意靠近一点点：今天先${step}也很好。小贴纸来啦。`;
    setFeedback(message);
    onSpeak?.(message);
    submitPreference(selectedReason, step);
  }

  function applyCustomFoodName(value: string) {
    const label = value.trim().slice(0, 12);

    if (!label) {
      setFeedback("可以说出或输入一种今天正在认识的食物。");
      return;
    }

    setCustomFoodName(label);
    setFoodChoices((current) => {
      const exists = current.some((food) => food.label === label);
      return exists ? current : dedupeFoodPreferenceOptions([buildFoodPreferenceOption(label), ...current]).slice(0, 18);
    });
    handleFoodPick(label);
  }

  function toggleCustomFoodVoice() {
    startChildVoiceInput({
      recognitionRef,
      isListening: isListeningForFood,
      setListening: setIsListeningForFood,
      onStart: "我在听啦，可以说香菇、姜母鸭，或其他正在认识的食物。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setFeedback(message);
        onSpeak?.(message);
      },
      onResult: (transcript) => {
        applyCustomFoodName(transcript.replace(/[。？！,.，、\s]/g, ""));
      },
    });
  }

  function toggleReasonVoiceInput() {
    if (!selectedFood) {
      const message = "先选一种食物，再说说你的感觉。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    startChildVoiceInput({
      recognitionRef: reasonRecognitionRef,
      isListening: isListeningForReason,
      setListening: setIsListeningForReason,
      onStart: "我在听啦，可以说味道重、气味冲，或者今天没胃口。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setFeedback(message);
        onSpeak?.(message);
      },
      onResult: (transcript) => {
        const matchedReason = matchFoodPreferenceReasonFromSpeech(transcript);
        handleReasonPick(matchedReason);
      },
    });
  }

  function resetGame() {
    const nextRound = createFoodPreferenceRound(todayMenuEntries);
    setFoodChoices(nextRound.foods);
    setReasonChoices(nextRound.reasons);
    setPreferMenuFirst(false);
    setSelectedFood("");
    setSelectedReason("");
    setSelectedApproachStep("");
    setCustomFoodMode(false);
    setCustomFoodName("");
    setExpandedNutritionLabel("");
    setMaterialImageStatus("食物卡已换顺序，这次不把今日食谱排在最前面。");
    setFeedback("食物卡和原因卡已经换顺序啦。这次先换一种泉州美食，再说说原因和愿意靠近的小步。");
    completionReportedRef.current = false;
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">美食小观察</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "美食观察与靠近一点点"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame();
            onSpeak?.("美食观察与靠近一点点重新开始。这次换一种泉州美食。");
          }}
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-200"
        >
          再玩一次
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="cyan" />
      </div>
      <div className="mt-4">
        <MiniLoopChips
          steps={["选食物", "看观察卡", "听营养", "选原因", "靠近一步"]}
          activeIndex={selectedApproachStep ? 5 : selectedReason ? 3 : selectedFood ? 1 : 0}
        />
      </div>

      {selectedFood ? (
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <button
          onClick={playMaterialIntro}
          className="overflow-hidden rounded-[1.6rem] bg-white text-left shadow-sm ring-2 ring-transparent transition hover:-translate-y-0.5 hover:ring-cyan-200"
          type="button"
        >
          {materialDisplayImageUrl ? (
            <SafeFoodImage
              image={{ url: menuImageContext.coverImageUrl, candidates: menuImageContext.imageCandidates }}
              alt={`${materialSource.subject}食育材料图`}
              className="h-64 w-full object-cover"
            />
          ) : (
            <div className="flex h-64 flex-col justify-center bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#fef3c7_100%)] px-5">
              <FoodMiniMaterialCard
                label={materialSource.subject}
                ingredients={materialSource.ingredients}
              />
              <p className="mt-3 rounded-[1rem] bg-white/80 px-3 py-2 text-center text-sm leading-6 text-slate-700">
                重点看：{materialSource.focusIngredient} · {materialSource.ingredients.join("、") || "颜色、形状、气味"}
              </p>
            </div>
          )}
          <span className="block bg-cyan-900 px-4 py-3 text-center text-sm font-semibold text-white">
            👆 点图片听名字、观察和营养小发现
          </span>
        </button>
        <div className="rounded-[1.6rem] bg-cyan-50 p-5">
          <p className="text-sm font-semibold text-cyan-900">食育材料图</p>
          <h4 className="mt-1 text-xl font-semibold text-slate-900">{materialSource.subject}</h4>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
              materialDisplaySourceLabel.includes("AI") || materialDisplaySourceLabel.includes("老师确认")
                ? "bg-amber-100 text-amber-900"
                : "bg-white text-cyan-900"
            }`}
          >
            {materialDisplaySourceLabel}
          </span>
          <p className="mt-2 text-sm leading-7 text-slate-700">先看颜色、形状和名字。</p>
          {menuImageContext.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {menuImageContext.images.slice(0, 6).map((image) => (
                <button
                  key={image.id}
                  onClick={() => {
                    const message = `${materialSource.subject}观察图。可以找找颜色、形状和食材。`;
                    setFeedback(message);
                    onSpeak?.(message);
                  }}
                  className="overflow-hidden rounded-[0.9rem] ring-2 ring-white transition hover:-translate-y-0.5 hover:ring-cyan-300"
                  type="button"
                >
                  <SafeFoodImage image={{ url: image.url }} alt={image.label} className="h-16 w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueTextItems([materialSource.focusIngredient, ...materialSource.ingredients])
              .slice(0, 5)
              .map((item) => (
                <span
                  key={`${materialSource.subject}-${item}`}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 shadow-sm"
                >
                  {item}
                </span>
              ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => playNutritionTip(selectedFoodInfo ?? buildFoodPreferenceOption(materialSource.focusIngredient || materialSource.subject))}
              className="rounded-full bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
              type="button"
            >
              🥕 再听营养小发现
            </button>
            <SpeechCueButton
              text={`${materialSource.subject}材料图。重点看${materialSource.focusIngredient}。`}
              onSpeak={onSpeak}
              label="听材料"
              tone="cyan"
            />
          </div>
          <p className="mt-3 text-xs leading-6 font-semibold text-cyan-800">{materialImageStatus}</p>
        </div>
      </div>
      ) : (
        <div className="mt-4 rounded-[1.5rem] bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">
          👇 先选一种食物，观察卡和靠近小步会跟着出现。
        </div>
      )}

      <div className="mt-5 rounded-[1.6rem] bg-cyan-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cyan-900">今天哪一种正在认识？</p>
            {todayMenuEntries.length > 0 ? (
              <p className="mt-1 text-xs leading-6 text-cyan-800">
                已优先放入今日食谱里的菜品和食材；点击任一卡片会听到对应营养小发现。
              </p>
            ) : (
              <p className="mt-1 text-xs leading-6 text-cyan-800">
                老师录入本周食谱后，这里会按日期自动把当天菜品和食材排在前面。
              </p>
            )}
          </div>
          {todayMenuEntries.length > 0 ? (
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 shadow-sm">
              今日食谱优先
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {displayFoodChoices.map((food, index) => {
            const selected = selectedFood === food.label;
            const fromTodayMenu = menuChoiceLabels.has(food.label);
            const nutritionOpen = expandedNutritionLabel === food.label;
            const foodImageContext = findBestMenuImageContext(food.label, todayMenuEntries, "observationFoodImage");

            return (
              <article
                key={getFoodOptionKey(food, index)}
                className={`rounded-[1.4rem] p-3 text-center text-sm font-semibold transition ${
                  selected ? "bg-cyan-700 text-white" : "bg-white text-slate-800"
                }`}
              >
                <button
                  onClick={() => handleFoodPick(food.label)}
                  className="w-full overflow-hidden rounded-[1rem] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  type="button"
                >
                  {foodImageContext.coverImageUrl ? (
                    <span className="block bg-white text-left shadow-sm">
                      <SafeFoodImage
                        image={{ url: foodImageContext.coverImageUrl, candidates: foodImageContext.imageCandidates }}
                        alt={`${food.label}观察图`}
                        className="h-28 w-full object-cover"
                      />
                      <span className="block px-3 py-2 text-sm font-semibold text-slate-900">{food.label}</span>
                      <span className="block px-3 pb-2 text-[11px] leading-4 text-slate-600">
                        {getFoodDishShortIntro(food.label, food.ingredients)}
                      </span>
                    </span>
                  ) : (
                    <FoodMiniMaterialCard label={food.label} ingredients={food.ingredients} compact />
                  )}
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                      selected ? "bg-white/20 text-white" : "bg-cyan-50 text-cyan-800"
                    }`}
                  >
                    👆 点图片听一听
                  </span>
                </button>
                {fromTodayMenu ? (
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                      selected ? "bg-white/20 text-white" : "bg-cyan-50 text-cyan-800"
                    }`}
                  >
                    今日食谱
                  </span>
                ) : null}
                {nutritionOpen ? (
                  <details
                    className={`mt-2 rounded-[1rem] px-3 py-2 text-left text-xs leading-5 ${
                      selected ? "bg-white/15 text-white" : "bg-cyan-50 text-cyan-950"
                    }`}
                  >
                    <summary className="cursor-pointer font-semibold">营养小字</summary>
                    <p className="mt-2">{buildFoodNutritionIntro(food.label, food.ingredients)}</p>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="mt-4 rounded-[1.3rem] bg-white/80 p-4">
          <button
            onClick={() => setCustomFoodMode((current) => !current)}
            className="rounded-full bg-orange-300 px-4 py-2 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-200"
            type="button"
          >
            我想说别的食物
          </button>
          {customFoodMode ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={customFoodName}
                onChange={(event) => setCustomFoodName(event.target.value)}
                placeholder="输入食物名，如 香菜、南瓜、蘑菇"
                className="rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white"
              />
              <button
                onClick={() => applyCustomFoodName(customFoodName)}
                className="rounded-full bg-orange-300 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-200"
                type="button"
              >
                👉 选这个食物
              </button>
              <button
                onClick={toggleCustomFoodVoice}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  isListeningForFood ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-900"
                }`}
                type="button"
              >
                {isListeningForFood ? "我说完了" : "🎤 说食物"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {selectedFood ? (
      <div className="mt-5 rounded-[1.6rem] bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-900">可能是什么原因？</p>
          <button
            onClick={toggleReasonVoiceInput}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
              isListeningForReason ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-900"
            }`}
            type="button"
          >
            {isListeningForReason ? "我说完啦" : "🎤 我来说原因"}
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {reasonChoices.map((reason) => {
            const selected = selectedReason === reason.label;

            return (
              <button
                key={reason.label}
                onClick={() => handleReasonPick(reason.label)}
                className={`rounded-[1.4rem] px-4 py-3 text-left text-sm font-semibold transition ${
                  selected
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-800 hover:-translate-y-0.5 hover:bg-amber-100"
                }`}
              >
                <span className="mr-2 text-2xl">{reason.icon}</span>
                👉 {reason.label}
              </button>
            );
          })}
        </div>
      </div>
      ) : null}

      {selectedFood && selectedReason ? (
      <div className="mt-5 scroll-mt-24 rounded-[1.6rem] bg-emerald-50 p-4">
        <p className="mb-3 text-sm font-semibold text-emerald-900">今天愿意靠近哪一步？</p>
        <FoodApproachLadderStage
          foodImageUrl={materialDisplayImageUrl}
          onPickStep={handleApproachPick}
          selectedFood={selectedFood}
          selectedApproachStep={selectedApproachStep}
        />
      </div>
      ) : null}

      <div className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听一听" tone="cyan" />
        </div>
        {selectedFoodInfo ? (
          <div className="mt-4 rounded-[1.3rem] bg-cyan-50 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-800">已选图卡</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {selectedFoodInfo.label} · {selectedFoodInfo.colorShape}
                </p>
              </div>
              <span className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-cyan-900 shadow-sm">
                👆 点图片自动播放
              </span>
            </div>
            {expandedNutritionLabel === selectedFoodInfo.label ? (
              <details className="mt-3 rounded-[1rem] bg-white/80 px-3 py-2 text-sm leading-6 text-cyan-950">
                <summary className="cursor-pointer font-semibold">营养小字</summary>
                <p className="mt-2">{buildFoodNutritionIntro(selectedFoodInfo.label, selectedFoodInfo.ingredients)}</p>
              </details>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {uniqueTextItems(selectedFoodInfo.ingredients).map((ingredient) => (
                <span
                  key={`${selectedFoodInfo.label}-${ingredient}`}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 shadow-sm"
                >
                  {ingredient}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FoodKitchenGame({
  contentConfig,
  mode = "kitchen",
  onComplete,
  onSpeak,
  onBackToHome,
  todayMenuEntries = [],
}: {
  contentConfig?: EditableGameContent;
  mode?: "kitchen" | "broadcast";
  onComplete?: (
    pickedItems: string[],
    detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>,
  ) => void;
  onSpeak?: SpeakHandler;
  onBackToHome?: () => void;
  todayMenuEntries?: WeeklyMenuEntry[];
}) {
  const isBroadcastMode = mode === "broadcast";
  const [recipeChoices, setRecipeChoices] = useState(() =>
    isBroadcastMode ? createFoodReporterRound(false) : createFoodKitchenRound(false),
  );
  const [selectedRecipeLabel, setSelectedRecipeLabel] = useState("");
  const [customRecipeInput, setCustomRecipeInput] = useState("");
  const [isListeningForKitchen, setIsListeningForKitchen] = useState(false);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [droppedKitchenIngredients, setDroppedKitchenIngredients] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("选一道泉州美食，按顺序点制作动作卡。");
  const [kitchenSentence, setKitchenSentence] = useState("");
  const [aiBroadcastText, setAiBroadcastText] = useState("");
  const [workMediaPreview, setWorkMediaPreview] = useState("");
  const [workMediaName, setWorkMediaName] = useState("");
  const [workMediaType, setWorkMediaType] = useState<"image" | "video" | "">("");
  const [kitchenSuccess, setKitchenSuccess] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [kitchenCookingStarted, setKitchenCookingStarted] = useState(false);
  const completionReportedRef = useRef(false);
  const kitchenRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const selectedRecipe = recipeChoices.find((item) => item.label === selectedRecipeLabel);
  const introText =
    contentConfig?.childGoal.trim() ||
    (isBroadcastMode
      ? "上传作品或说原话，我帮你整理成小小播报词。"
      : "说菜名，我帮你整理步骤图卡，孩子点一个参与步骤。");
  const nextAction = selectedRecipe?.actions[completedActions.length];
  const selectedRecipeIngredients = selectedRecipe ? getKitchenRecipeIngredients(selectedRecipe).slice(0, 5) : [];
  const allIngredientsInPot =
    selectedRecipeIngredients.length === 0 ||
    selectedRecipeIngredients.every((ingredient) => droppedKitchenIngredients.includes(ingredient));
  const completed = Boolean(selectedRecipe && completedActions.length === selectedRecipe.actions.length);
  const kitchenImageContext = selectedRecipe
    ? findBestMenuImageContext(
        selectedRecipe.label,
        todayMenuEntries,
        isBroadcastMode ? "reporterFoodImage" : "kitchenDishImage",
      )
    : {
        coverImageUrl: "",
        mediaSource: undefined,
        sourceLabel: "",
        imageSource: "",
        teacherConfirmed: false,
        aiGenerated: false,
        imageCandidates: [] as SafeFoodImageCandidate[],
        fallbackSource: "",
      };
  const hasSelectedRecipe = Boolean(selectedRecipeLabel);
  const canOrganizeBroadcast = hasSelectedRecipe;
  const hasActionOrUpload = isBroadcastMode
    ? Boolean(selectedRecipe && (workMediaName || kitchenSentence.trim() || selectedRecipeLabel))
    : completedActions.length > 0;

  useEffect(() => {
    return () => {
      if (workMediaPreview) {
        URL.revokeObjectURL(workMediaPreview);
      }
    };
  }, [workMediaPreview]);

  useEffect(() => {
    const recognitionRefForCleanup = kitchenRecognitionRef;

    return () => {
      recognitionRefForCleanup.current?.stop();
    };
  }, []);

  function handleWorkMediaSelect(file?: File) {
    if (!file) {
      if (workMediaPreview) {
        URL.revokeObjectURL(workMediaPreview);
      }
      setWorkMediaPreview("");
      setWorkMediaName("");
      setWorkMediaType("");
      return;
    }

    if (workMediaPreview) {
      URL.revokeObjectURL(workMediaPreview);
    }

    setWorkMediaName(file.name);
    setWorkMediaType(file.type.startsWith("video/") ? "video" : "image");
    setWorkMediaPreview(URL.createObjectURL(file));
  }

  function selectKitchenRecipe(recipe: FoodKitchenRecipe) {
    setSelectedRecipeLabel(recipe.label);
    setCompletedActions([]);
    setDroppedKitchenIngredients([]);
    setKitchenSentence("");
    setAiBroadcastText("");
    setKitchenSuccess(false);
    setBroadcastSuccess(false);
    setKitchenCookingStarted(false);
    handleWorkMediaSelect();
    completionReportedRef.current = false;
    const message = `${recipe.area}开张啦。第一步：${recipe.actions[0]}。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function pickRecipe(label: string) {
    const recipe = recipeChoices.find((item) => item.label === label);

    if (!recipe) {
      const message = "泉州小厨房还没找到这道菜，可以用语音或文字告诉我想做什么。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    selectKitchenRecipe(recipe);
  }

  function selectBroadcastRecipe(recipe: FoodKitchenRecipe) {
    setSelectedRecipeLabel(recipe.label);
    setCompletedActions([]);
    setDroppedKitchenIngredients([]);
    setKitchenSentence("");
    setAiBroadcastText("");
    setKitchenSuccess(false);
    setBroadcastSuccess(false);
    handleWorkMediaSelect();
    completionReportedRef.current = false;
    const message = `选好${recipe.label}啦。可以说一句你想介绍的话。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function pickBroadcastRecipe(label: string) {
    const recipe = recipeChoices.find((item) => item.label === label);

    if (!recipe) {
      const message = "还没找到这个作品，可以先输入名字，再说一句想介绍的话。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    selectBroadcastRecipe(recipe);
  }

  function applyCustomBroadcastRecipe(rawValue = customRecipeInput) {
    const label = normalizeKitchenDishLabel(rawValue);

    if (!label) {
      const message = "可以输入或说一个作品名，比如姜母鸭、烧肉粽、四果汤。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const recipe = buildCustomKitchenRecipe(label);
    setCustomRecipeInput(recipe.label);
    setRecipeChoices((current) => [
      recipe,
      ...current.filter((item) => item.label !== recipe.label),
    ].slice(0, 8));
    selectBroadcastRecipe(recipe);
  }

  function applyCustomKitchenRecipe(rawValue = customRecipeInput) {
    const label = normalizeKitchenDishLabel(rawValue);

    if (!label) {
      const message = "可以说或输入一道想做的菜，比如紫菜蛋汤、青菜豆腐或润饼菜。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const displayKey = getKitchenDishDisplayKey(label);
    const recipe =
      recipeChoices.find((item) => getKitchenDishDisplayKey(item.label) === displayKey || item.label === label) ??
      foodKitchenRecipes.find((item) => getKitchenDishDisplayKey(item.label) === displayKey || item.label === label);

    if (!recipe) {
      const message = `我听到啦：${label}。这道菜的步骤要先请老师确认，今天先从下面老师准备好的菜里选一道。`;

      setCustomRecipeInput(label);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    setCustomRecipeInput(recipe.label);
    setRecipeChoices((current) => [
      recipe,
      ...current.filter((item) => item.label !== recipe.label),
    ].slice(0, 8));
    selectKitchenRecipe(recipe);
    const message = `已经把“${recipe.label}”整理成小厨房步骤图卡。先看第一步：${recipe.actions[0]}。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function toggleKitchenVoiceInput() {
    startChildVoiceInput({
      recognitionRef: kitchenRecognitionRef,
      isListening: isListeningForKitchen,
      setListening: setIsListeningForKitchen,
      onStart: "我在听啦，可以说：我想做姜母鸭，或者我要做烧肉粽。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setFeedback(message);
        onSpeak?.(message);
      },
      onResult: (transcript) => {
        setCustomRecipeInput(transcript.slice(0, 24));
        applyCustomKitchenRecipe(transcript);
      },
    });
  }

  function toggleBroadcastSentenceVoice() {
    startChildVoiceInput({
      recognitionRef: kitchenRecognitionRef,
      isListening: isListeningForKitchen,
      setListening: setIsListeningForKitchen,
      onStart: "我在听你的原话，可以说：我今天认识了姜母鸭，热热香香。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setFeedback(message);
        onSpeak?.(message);
      },
      onResult: (transcript) => {
        setKitchenSentence(transcript.slice(0, 90));
        if (selectedRecipe) {
          const nextBroadcast = buildKitchenBroadcastText(selectedRecipe, transcript, workMediaName);
          const message = `我听见啦，整理成小播报：${nextBroadcast}`;

          setAiBroadcastText(nextBroadcast);
          setBroadcastSuccess(false);
          setFeedback(message);
          onSpeak?.(message);
          return;
        }

        const message = "我听见啦。先选一个作品，我再帮你整理成小播报。";
        setFeedback(message);
        onSpeak?.(message);
      },
    });
  }

  function pickAction(action: string) {
    if (!selectedRecipe || completed) {
      return;
    }

    setKitchenSuccess(false);

    if (!allIngredientsInPot) {
      const message = "先把材料放进锅里，再按步骤慢慢做。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!kitchenCookingStarted) {
      const message = "材料都在锅里啦，先点“开始变成一道菜”。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (action !== nextAction) {
      const message = `先做“${nextAction}”，小厨房要按顺序慢慢来。`;
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextActions = [...completedActions, action];
    setCompletedActions(nextActions);
    const done = nextActions.length === selectedRecipe.actions.length;
    const message = done
      ? `${buildKitchenStepSpeech(selectedRecipe)} 步骤完成啦，点完成小厨房拿贴纸。`
      : `做对啦。下一步：${selectedRecipe.actions[nextActions.length]}。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function completeKitchenStepRecord() {
    if (!selectedRecipe) {
      const message = "先选一道泉州美食，再按步骤做菜。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (completedActions.length === 0) {
      const message = "先点一个你参与的步骤卡。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!allIngredientsInPot) {
      const message = "先把材料卡放进锅里，再完成小厨房。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const message = `${selectedRecipe.label}小厨房完成啦：${droppedKitchenIngredients.join("、")}都进锅里了。安全提醒：请和老师或家长一起完成。`;
    setFeedback(message);
    onSpeak?.(message);
    setKitchenSuccess(true);

    if (!completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(
        [
          selectedRecipe.label,
          ...completedActions,
          `放进锅里:${droppedKitchenIngredients.join("、")}`,
          `步骤图卡:${selectedRecipe.actions.join("、")}`,
          kitchenImageContext.sourceLabel ? `成品图:${kitchenImageContext.sourceLabel}` : "",
          "安全提醒:和老师或家长一起完成",
        ].filter(Boolean),
        {
          foodLabel: selectedRecipe.label,
          dishName: selectedRecipe.label,
          activityType: "food-kitchen",
          dishId: selectedRecipe.label,
          stepOrder: completedActions,
          stepsCompleted: completedActions,
          ingredientsAdded: droppedKitchenIngredients,
          isCorrect: completed,
          attempts: completedActions.length,
          result: completed ? "success" : "completed",
          status: completed ? "completed" : "in-progress",
          childUtterance: `参与步骤：${completedActions.join("、")}`,
          coverImageUrl: kitchenImageContext.coverImageUrl,
          mediaSource: kitchenImageContext.mediaSource,
          teacherConfirmed: kitchenImageContext.teacherConfirmed,
          aiGenerated: kitchenImageContext.aiGenerated,
          imageSourceLabel: kitchenImageContext.sourceLabel,
          imageSource: kitchenImageContext.imageSource || kitchenImageContext.sourceLabel,
        },
      );
    }
  }

  function resetGame() {
    const nextRecipes = isBroadcastMode ? createFoodReporterRound() : createFoodKitchenRound();
    setRecipeChoices(nextRecipes);
    setCustomRecipeInput("");
    setIsListeningForKitchen(false);
    setSelectedRecipeLabel("");
    setCompletedActions([]);
    setDroppedKitchenIngredients([]);
    setKitchenSentence("");
    setAiBroadcastText("");
    setKitchenSuccess(false);
    setBroadcastSuccess(false);
    setKitchenCookingStarted(false);
    handleWorkMediaSelect();
    setFeedback(
      isBroadcastMode
        ? "播报菜单已经换顺序啦。选作品、说原话，再整理播报词。"
        : "小厨房菜单已经换顺序啦。选一道泉州美食，按顺序点制作动作卡。",
    );
    completionReportedRef.current = false;
  }

  function organizeKitchenBroadcast() {
    if (!canOrganizeBroadcast) {
      const message = "先选一道美食，或者说一句你的想法。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!selectedRecipe) {
      const message = "先选一道菜品或输入作品名，再整理播报词。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextBroadcast = buildKitchenBroadcastText(selectedRecipe, kitchenSentence, workMediaName);
    const message = `播报词整理好了：${nextBroadcast}`;

    setBroadcastSuccess(false);
    setAiBroadcastText(nextBroadcast);
    setFeedback(message);
    onSpeak?.(message);
  }

  function playKitchenBroadcast() {
    if (!aiBroadcastText) {
      const message = "先点整理播报词，再练小小播报。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    setFeedback("正在播放小小播报词。");
    onSpeak?.(aiBroadcastText);
  }

  function putKitchenIngredientInPot(ingredient: string) {
    if (!selectedRecipe || isBroadcastMode) {
      return;
    }

    if (droppedKitchenIngredients.includes(ingredient)) {
      const message = `${ingredient}已经在锅里啦。`;
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextIngredients = [...droppedKitchenIngredients, ingredient];
    const done = selectedRecipeIngredients.every((item) => nextIngredients.includes(item));
    const message = done
      ? "材料都进锅里啦。现在按步骤图卡慢慢做。"
      : `${ingredient}放进锅里啦，再选一个材料。`;

    setDroppedKitchenIngredients(nextIngredients);
    if (!done) {
      setKitchenCookingStarted(false);
    }
    setFeedback(message);
    onSpeak?.(message);
  }

  function completeKitchenShare() {
    if (!selectedRecipe) {
      const message = "先选一道菜品或输入作品名。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!hasActionOrUpload) {
      const message = isBroadcastMode ? "先上传作品或说一句孩子原话。" : "先完成一个做菜步骤。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!aiBroadcastText) {
      const message = "先点整理播报词，再完成播报分享。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const sentence = aiBroadcastText;
    const message = `小播报员说得真清楚：${sentence} 小贴纸来啦。`;
    setFeedback(message);
    onSpeak?.(message);
    setAiBroadcastText(sentence);
    setBroadcastSuccess(true);

    if (!completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.([
        selectedRecipe.label,
        ...completedActions,
        workMediaName ? `小作品:${workMediaName}` : "",
        `孩子原话:${kitchenSentence.trim() || "还在练习表达"}`,
        `小播报词:${sentence}`,
        workMediaName ? `本机${workMediaType === "video" ? "视频" : "照片"}：${workMediaName}` : "",
      ].filter(Boolean), {
        foodLabel: selectedRecipe.label,
        dishName: selectedRecipe.label,
        activityType: "food-reporter",
        dishId: selectedRecipe.label,
        scriptText: sentence,
        voiceText: kitchenSentence.trim() || sentence,
        mediaUrl: workMediaName,
        audioUrl: "",
        submittedAt: new Date().toISOString(),
        messageType:
          workMediaType === "video"
            ? "video"
            : workMediaType === "image"
              ? "photo"
              : kitchenSentence.trim()
                ? "text"
                : "mixed",
        result: "success",
        attempts: 1,
        status: "completed",
        uploadedFileName: workMediaName,
        mediaName: workMediaName,
        childUtterance: kitchenSentence.trim() || "还在练习表达",
        aiBroadcastText: sentence,
      });
    }
  }

  if (isBroadcastMode) {
    return (
      <div className="min-w-0 rounded-[2rem] border border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_52%,#eefdfa_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-rose-700">小小闽食播报员</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">
              {contentConfig?.title || "小小闽食播报员"}
            </h3>
          </div>
          <button
            onClick={() => {
              resetGame();
              onSpeak?.("小播报员重新开始。先选一个作品，再说一句发现。");
            }}
            className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-200"
            type="button"
          >
            换一个作品
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-7 text-slate-600">
            选菜品或上传作品，说一句原话，我帮你整理成小播报。
          </p>
          <SpeechCueButton
            text="先选一个作品，再说一句原话，最后提交分享。"
            onSpeak={onSpeak}
            label="听一听"
            tone="violet"
          />
        </div>
        <div className="mt-4">
          <MiniLoopChips steps={["选作品", "说原话", "整理词", "听一听", "提交分享"]} />
        </div>

        <div className="mt-5 rounded-[1.6rem] bg-white/82 p-4">
          <p className="text-sm font-semibold text-rose-900">我想介绍什么</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={customRecipeInput}
              onChange={(event) => setCustomRecipeInput(event.target.value.slice(0, 24))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyCustomBroadcastRecipe();
                }
              }}
              placeholder="例如：姜母鸭、烧肉粽、四果汤"
              className="rounded-[1.1rem] border border-rose-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300"
            />
            <button
              onClick={() => applyCustomBroadcastRecipe()}
              className="rounded-full bg-orange-300 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5"
              type="button"
            >
              选这个
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {recipeChoices.slice(0, 6).map((recipe, index) => {
            const recipeImageContext = findBestMenuImageContext(recipe.label, todayMenuEntries, "reporterFoodImage");
            const recipeIngredients = getKitchenRecipeIngredients(recipe);

            return (
              <button
                key={`broadcast-${recipe.area ?? "recipe"}-${recipe.label}-${index}`}
                onClick={() => pickBroadcastRecipe(recipe.label)}
                className={`w-full max-w-[13.5rem] rounded-[1.4rem] p-3 text-left text-sm font-semibold transition sm:w-[13.5rem] ${
                  selectedRecipeLabel === recipe.label
                    ? "bg-rose-100 text-rose-900 ring-2 ring-rose-200"
                    : "bg-white/82 text-slate-700 hover:-translate-y-0.5 hover:bg-rose-50"
                }`}
                type="button"
              >
                <span className="block overflow-hidden rounded-[1.1rem] bg-white p-2 shadow-sm">
                  <SafeFoodImage
                    image={{ url: recipeImageContext.coverImageUrl, candidates: recipeImageContext.imageCandidates }}
                    alt={`${recipe.label}菜品图`}
                    className="h-28 w-full rounded-[0.9rem] object-cover"
                  />
                </span>
                <span className="mt-3 block text-base font-semibold text-slate-900">🎤 {recipe.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {getFoodDishShortIntro(recipe.label, recipeIngredients)}
                </span>
              </button>
            );
          })}
        </div>

        {selectedRecipe ? (
          <div className="mt-5 rounded-[1.8rem] bg-rose-50 p-5">
            <div className="grid gap-4 md:grid-cols-[11rem_1fr]">
              <div className="overflow-hidden rounded-[1.2rem] bg-white p-2 shadow-sm">
                <SafeFoodImage
                  image={{ url: kitchenImageContext.coverImageUrl, candidates: kitchenImageContext.imageCandidates }}
                  alt={`${selectedRecipe.label}播报作品图`}
                  className="h-36 w-full rounded-[1rem] object-cover"
                />
                {kitchenImageContext.mediaSource === "ai_generated" ? (
                  <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    {aiConfirmedUseNotice}
                  </span>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-900">今天介绍：{selectedRecipe.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  上传作品可以，直接说一句也可以。
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    上传照片或视频
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(event) => handleWorkMediaSelect(event.target.files?.[0])}
                      className="mt-2 w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    我想这样说
                    <input
                      value={kitchenSentence}
                      onChange={(event) => setKitchenSentence(event.target.value.slice(0, 90))}
                      placeholder={`例如：我今天认识了${selectedRecipe.label}`}
                      className="mt-2 w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-rose-300"
                    />
                    <button
                      onClick={toggleBroadcastSentenceVoice}
                      className={`mt-2 rounded-full px-4 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                        isListeningForKitchen ? "bg-rose-200 text-rose-900" : "bg-white text-rose-900 shadow-sm"
                      }`}
                      type="button"
                    >
                      {isListeningForKitchen ? "我说完啦" : "说给小话筒"}
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {workMediaPreview ? (
              <div className="mt-4 overflow-hidden rounded-[1.3rem] bg-white p-3 shadow-sm">
                {workMediaType === "video" ? (
                  <video src={workMediaPreview} controls className="h-48 w-full rounded-[1rem] object-cover" />
                ) : (
                  <div
                    aria-label="闽食播报作品预览"
                    className="h-48 w-full rounded-[1rem] bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${workMediaPreview})` }}
                  />
                )}
                <p className="mt-2 text-xs font-semibold text-slate-500">当前作品：{workMediaName}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold leading-6 text-rose-900">
                {feedback}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={organizeKitchenBroadcast}
                  className="rounded-full bg-orange-300 px-5 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5"
                  type="button"
                >
                  整理播报词
                </button>
                <button
                  onClick={playKitchenBroadcast}
                  className={`rounded-full bg-sky-100 px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    aiBroadcastText ? "text-sky-900" : "text-slate-400"
                  }`}
                  type="button"
                >
                  听一听
                </button>
                <button
                  onClick={completeKitchenShare}
                  disabled={broadcastSuccess || !hasActionOrUpload}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    broadcastSuccess
                      ? "bg-emerald-100 text-emerald-700"
                      : hasActionOrUpload
                        ? "bg-emerald-300 text-emerald-950"
                        : "bg-slate-200 text-slate-500"
                  }`}
                  type="button"
                >
                  {broadcastSuccess ? "小贴纸来啦" : "提交分享"}
                </button>
              </div>
            </div>

            {aiBroadcastText ? (
              <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold leading-7 text-rose-950 shadow-sm">
                <span className="mb-2 block text-xs text-rose-700">{aiConfirmedUseNotice}</span>
                {aiBroadcastText}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.6rem] bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-900">
            👆 先选一个想介绍的美食或作品。
          </div>
        )}

        {broadcastSuccess && selectedRecipe ? (
          <div className="mt-4 rounded-[1.8rem] bg-emerald-100 p-5 text-emerald-950 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[10rem_1fr]">
              <div className="overflow-hidden rounded-[1.2rem] bg-white p-2">
                  <SafeFoodImage
                    image={{ url: kitchenImageContext.coverImageUrl, candidates: kitchenImageContext.imageCandidates }}
                    alt={`${selectedRecipe.label}播报完成`}
                    className="h-32 w-full rounded-[1rem] object-cover"
                  />
              </div>
              <div className="rounded-[1.2rem] bg-white/80 px-4 py-4">
                <p className="text-2xl font-semibold">小播报员完成啦</p>
                <p className="mt-2 text-sm font-semibold leading-7">
                  小播报员说得真清楚，老师和家人都能看见。
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={resetGame}
                    className="rounded-full bg-orange-200 px-5 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5"
                    type="button"
                  >
                    再选一道
                  </button>
                  <SpeechCueButton
                    text={`${selectedRecipe.label}播报完成啦，小播报员说得真清楚。`}
                    onSpeak={onSpeak}
                    label="听一听"
                    tone="emerald"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-700">
            {isBroadcastMode ? "小小闽食播报员" : "泉州小厨房"}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {isBroadcastMode ? "小小闽食播报员" : contentConfig?.title || "泉州小厨房"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame();
            onSpeak?.("泉州小厨房重新开始。选一道泉州美食，按顺序点制作动作卡。");
          }}
          className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-200"
          type="button"
        >
          重新开始
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听一听" tone="orange" />
      </div>
      <div className="mt-4">
        <MiniLoopChips
          steps={
            isBroadcastMode
              ? ["选作品", "说原话", "整理词", "听播报", "完成展示"]
              : ["选菜", "放材料", "点步骤", "安全提醒", "完成啦"]
          }
        />
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-orange-50 p-4">
        <p className="text-sm font-semibold text-orange-900">
          {isBroadcastMode ? "我想播报什么作品" : "我想做什么菜"}
        </p>
        <p className="mt-1 text-xs leading-6 text-orange-800">
          {isBroadcastMode
            ? "上传作品、说一句原话，我只帮你整理播报词。"
            : "说或输入一道想做的菜，我会整理成可点选的步骤图卡。"}
        </p>
        <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-orange-900 shadow-sm">
          {aiConfirmedUseNotice}
        </span>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={customRecipeInput}
            onChange={(event) => setCustomRecipeInput(event.target.value.slice(0, 24))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyCustomKitchenRecipe();
              }
            }}
            placeholder="例如：紫菜蛋汤、青菜豆腐、南瓜饭"
            className="rounded-[1.1rem] border border-orange-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-orange-300"
          />
          <button
            onClick={() => applyCustomKitchenRecipe()}
            className="rounded-full bg-orange-200 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5"
            type="button"
          >
            {isBroadcastMode ? "👉 选这个作品" : "▶ 变成步骤图卡"}
          </button>
          <button
            onClick={toggleKitchenVoiceInput}
            className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
              isListeningForKitchen ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-900"
            }`}
            type="button"
          >
            {isListeningForKitchen ? "我说完啦" : "🎤 说菜名"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {recipeChoices.map((recipe, index) => {
          const recipeImageContext = findBestMenuImageContext(recipe.label, todayMenuEntries, "kitchenDishImage");
          const recipeIngredients = getKitchenRecipeIngredients(recipe);

          return (
            <button
              key={`${recipe.area ?? "recipe"}-${recipe.label}-${index}`}
              onClick={() => pickRecipe(recipe.label)}
              className={`w-full max-w-[13.5rem] rounded-[1.4rem] p-3 text-left text-sm font-semibold transition sm:w-[13.5rem] ${
                selectedRecipeLabel === recipe.label
                  ? "bg-orange-100 text-orange-900 ring-2 ring-orange-200"
                  : "bg-amber-50 text-slate-700 hover:-translate-y-0.5 hover:bg-amber-100"
              }`}
              type="button"
            >
              {recipeImageContext.coverImageUrl ? (
                <span className="block overflow-hidden rounded-[1.1rem] bg-white p-2 shadow-sm">
                  <SafeFoodImage
                    image={{ url: recipeImageContext.coverImageUrl, candidates: recipeImageContext.imageCandidates }}
                    alt={`${recipe.label}菜品图`}
                    className="h-28 w-full rounded-[0.9rem] object-cover"
                  />
                </span>
              ) : (
                <FoodMiniMaterialCard label={recipe.label} ingredients={recipeIngredients} compact />
              )}
              <span className="mt-3 block text-base font-semibold text-slate-900">👉 {recipe.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                {recipeIngredients.slice(0, 3).join("、") || "看图做小菜"}
              </span>
            </button>
          );
        })}
      </div>

      {!isBroadcastMode && selectedRecipe ? (
      <div className="mt-5 rounded-[1.8rem] bg-orange-50 p-5">
        <p className="text-sm font-semibold text-orange-900">{selectedRecipe?.area ?? "泉州小厨房"}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[10rem_1fr]">
          {kitchenImageContext.coverImageUrl ? (
            <div className="overflow-hidden rounded-[1.2rem] bg-white p-2 shadow-sm">
              <SafeFoodImage
                image={{ url: kitchenImageContext.coverImageUrl, candidates: kitchenImageContext.imageCandidates }}
                alt={`${selectedRecipe.label}成品图`}
                className="h-32 w-full rounded-[1rem] object-cover"
              />
              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                  kitchenImageContext.mediaSource === "ai_generated"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-cyan-100 text-cyan-900"
                }`}
              >
                {kitchenImageContext.mediaSource === "ai_generated" ? aiConfirmedUseNotice : "老师准备好的菜品图"}
              </span>
            </div>
          ) : (
            <FoodMiniMaterialCard
              label={selectedRecipe.label}
              ingredients={selectedRecipe.actions.slice(0, 3)}
              compact
            />
          )}
          <div className="rounded-[1.2rem] bg-white/85 px-4 py-3">
            <p className="text-sm font-semibold text-orange-950">我们一起做：{selectedRecipe.label}</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              先把材料放进锅里，再按顺序点步骤。
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_14rem]">
          <div className="rounded-[1.5rem] bg-white/82 p-4">
            <p className="text-sm font-semibold text-orange-950">材料卡</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {selectedRecipeIngredients.map((ingredient) => {
                const inPot = droppedKitchenIngredients.includes(ingredient);

                return (
                  <button
                    key={`${selectedRecipe.label}-${ingredient}`}
                    draggable
                    onClick={() => putKitchenIngredientInPot(ingredient)}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", ingredient)}
                    className={`rounded-[1.2rem] border px-3 py-3 text-left transition hover:-translate-y-0.5 ${
                      inPot
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-orange-100 bg-white text-slate-800"
                    }`}
                    type="button"
                  >
                    <FoodMiniMaterialCard label={ingredient} ingredients={[ingredient]} compact />
                    <span className="mt-2 block text-xs font-semibold">
                      {inPot ? "已经在锅里" : "拖一拖，或点一下放进锅"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const ingredient = event.dataTransfer.getData("text/plain");
              if (ingredient) {
                putKitchenIngredientInPot(ingredient);
              }
            }}
            className="rounded-[1.6rem] bg-orange-50 p-4 text-center shadow-inner"
          >
            <div className="relative mx-auto flex aspect-[1.22/1] w-full max-w-[17rem] items-center justify-center">
              <span className="absolute -left-3 top-1/2 h-12 w-8 -translate-y-1/2 rounded-l-full bg-orange-900/75" />
              <span className="absolute -right-3 top-1/2 h-12 w-8 -translate-y-1/2 rounded-r-full bg-orange-900/75" />
              <div className="absolute inset-0 rounded-[50%] border-[12px] border-orange-900/75 bg-[radial-gradient(circle_at_center,#fff7ed_0%,#fed7aa_42%,#ea580c_100%)] shadow-[inset_0_18px_35px_rgba(124,45,18,0.22),0_14px_28px_rgba(124,45,18,0.18)]" />
              <div className="relative flex h-[72%] w-[78%] flex-wrap items-center justify-center gap-2 rounded-[50%] bg-[radial-gradient(circle_at_center,#ffffff_0%,#ffedd5_55%,#fdba74_100%)] p-4">
                {droppedKitchenIngredients.length > 0 ? (
                  droppedKitchenIngredients.map((ingredient) => (
                    <span
                      key={`pot-${ingredient}`}
                      className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-orange-900 shadow-sm"
                    >
                      <span aria-hidden="true">{getFoodPreferenceIcon(ingredient)}</span>
                      {ingredient}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-orange-700">
                    等材料来
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-orange-950">小锅在这里</p>
            <p className="mt-1 text-xs leading-5 text-orange-800">把材料卡拖进锅里，点一下也可以。</p>
            {allIngredientsInPot && !completed ? (
              <button
                onClick={() => {
                  const message = "材料都在锅里啦。开始变成一道菜，按步骤慢慢做。";
                  setKitchenCookingStarted(true);
                  setFeedback(message);
                  onSpeak?.(message);
                }}
                className="mt-3 rounded-full bg-orange-300 px-4 py-2 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5"
                type="button"
              >
                开始变成一道菜
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {selectedRecipe?.actions.map((action, index) => {
            const done = completedActions.includes(action);
            const active = action === nextAction;

            return (
              <button
                key={action}
                onClick={() => pickAction(action)}
                disabled={done || completed}
                className={`rounded-[1.4rem] px-4 py-4 text-left text-sm font-semibold transition ${
                  done
                    ? "bg-emerald-100 text-emerald-900"
                    : active
                      ? "bg-white text-orange-900 shadow-sm hover:-translate-y-0.5"
                      : "bg-orange-100/60 text-orange-700"
                }`}
                type="button"
              >
                <span className="block text-xs text-slate-500">第 {index + 1} 步</span>
                <span className="mt-2 flex min-h-16 items-center gap-3 rounded-[1rem] bg-white/70 px-3 py-3">
                  <span className="text-3xl">{getKitchenActionIcon(action)}</span>
                  <span className="text-sm leading-6">{action}</span>
                </span>
                <span className="mt-2 block text-xs leading-5 text-slate-600">
                  👆 点这步 · {buildKitchenStepVisual(action, selectedRecipe)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold leading-6 text-orange-900">
            {feedback}
          </p>
          <SpeechCueButton
            text={selectedRecipe ? buildKitchenStepSpeech(selectedRecipe, nextAction) : feedback}
            onSpeak={onSpeak}
              label="听一听"
            tone="orange"
          />
          {completed && !kitchenSuccess ? (
            <button
              onClick={completeKitchenStepRecord}
              className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-emerald-200"
              type="button"
            >
              ✅ 完成小厨房
            </button>
          ) : null}
        </div>
      </div>
      ) : null}

      {!isBroadcastMode && !selectedRecipe ? (
        <div className="mt-5 rounded-[1.6rem] bg-orange-50 px-4 py-4 text-sm font-semibold text-orange-900">
          👇 先选择一道菜，步骤图卡会在这里出现。
        </div>
      ) : null}

      {!isBroadcastMode && completed && !kitchenSuccess ? (
        <div className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">
          这道菜做好啦。可以点“完成小厨房”拿贴纸。
        </div>
      ) : null}

      {!isBroadcastMode && kitchenSuccess && selectedRecipe ? (
        <div className="mt-4 rounded-[1.8rem] bg-emerald-100 p-5 text-emerald-950 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[10rem_1fr]">
            {kitchenImageContext.coverImageUrl ? (
              <div className="overflow-hidden rounded-[1.2rem] bg-white p-2">
                <SafeFoodImage
                  image={{ url: kitchenImageContext.coverImageUrl, candidates: kitchenImageContext.imageCandidates }}
                  alt={`${selectedRecipe.label}做好啦`}
                  className="h-32 w-full rounded-[1rem] object-cover"
                />
                {kitchenImageContext.mediaSource === "ai_generated" ? (
                  <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    {aiConfirmedUseNotice}
                  </span>
                ) : null}
              </div>
            ) : (
              <FoodMiniMaterialCard
                label={selectedRecipe.label}
                ingredients={selectedRecipe.actions.slice(0, 3)}
                compact
              />
            )}
            <div className="rounded-[1.2rem] bg-white/80 px-4 py-4">
              <p className="text-2xl font-semibold">这道菜做好啦</p>
              <p className="mt-2 text-sm font-semibold leading-7">
                小厨师完成一道菜，小贴纸来啦。
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={resetGame}
                  className="rounded-full bg-orange-200 px-5 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5"
                  type="button"
                >
                  再做一道
                </button>
                {onBackToHome ? (
                  <button
                    onClick={onBackToHome}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-900 shadow-sm transition hover:-translate-y-0.5"
                    type="button"
                  >
                    🏠 回到闽食目录
                  </button>
                ) : null}
                <SpeechCueButton
                  text={`${selectedRecipe.label}做好啦，小厨师完成一道菜。`}
                  onSpeak={onSpeak}
                  label="听一听"
                  tone="emerald"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function GrowthArchivePanel({
  archive,
  childId,
}: {
  archive: GrowthArchive;
  childId?: string;
}) {
  const visibleBadgeRecords = childId
    ? archive.badgeRecords.filter((item) => item.childId === childId)
    : archive.badgeRecords;
  const visibleMealReviews = childId
    ? archive.mealReviews.filter((item) => item.childId === childId)
    : archive.mealReviews;
  const visibleMiniGameRecords = childId
    ? archive.miniGameRecords.filter((item) => item.childId === childId)
    : archive.miniGameRecords;
  const uniqueBadgeCount = countUniqueBadges(archive, childId);
  const totalMiniGames = getMiniGameCompletionTotal(archive, childId);
  const latestBadges = visibleBadgeRecords.slice(0, 4);
  const latestReviews = visibleMealReviews.slice(0, 2);
  const latestMiniGameBadge = visibleBadgeRecords.find((item) => item.source === "mini-game");
  const badgeLevel = getBadgeLevelSummary(archive, childId);
  const nextFocus =
    totalMiniGames < 2
      ? "先玩一个小任务"
      : uniqueBadgeCount < 3
        ? "继续点亮新小章"
        : "说一说今天喜欢什么";

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#e6fbfa_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">成长小书</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">孩子下次再来，也能接着成长</h3>
        </div>
        <p className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          下次推荐：{nextFocus}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">点亮勋章</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{uniqueBadgeCount}</p>
        </div>
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">今天玩过</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalMiniGames}</p>
          {latestMiniGameBadge ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              最近：{latestMiniGameBadge.name}
            </p>
          ) : null}
        </div>
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">习惯岛进入</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{archive.themeVisits.habit}</p>
        </div>
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">闽食岛进入</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{archive.themeVisits.food}</p>
        </div>
      </div>

      <div className="mt-5 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">奖章升级</p>
            <h4 className="mt-1 text-2xl font-semibold text-slate-900">{badgeLevel.level}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-600">{badgeLevel.description}</p>
          </div>
          <div className="rounded-[1.5rem] bg-amber-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold text-amber-900">已获得奖章</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{badgeLevel.badgeCount}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
            下一等级：{badgeLevel.nextLevel}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {badgeLevel.remainingToNext > 0
              ? `还差 ${badgeLevel.remainingToNext} 枚`
              : "已经到达当前最高等级"}
          </span>
          {badgeLevel.latestBadges.map((badge) => (
            <span
              key={`${badge.name}-${badge.earnedAt}`}
              className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              最近：{badge.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
          <p className="text-sm font-semibold text-teal-700">游戏贴纸轨迹</p>
          <h4 className="mt-1 text-xl font-semibold text-slate-900">最近完成的玩法会按自己的形式留下贴纸</h4>
        <div className="mt-4">
          <GameRewardTrail records={visibleMiniGameRecords} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.8rem] bg-white/82 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">最近点亮的勋章</p>
          <div className="mt-4 space-y-3">
            {latestBadges.length > 0 ? (
              latestBadges.map((item) => (
                <div
                  key={`${item.name}-${item.earnedAt}`}
                  className="rounded-[1.3rem] bg-slate-50 px-4 py-3"
                >
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.themeId === "habit" ? "习惯成长岛" : "闽食成长岛"} ·{" "}
                    {item.source === "story"
                      ? "故事解锁"
                      : item.source === "meal-review"
                        ? "拍图打卡"
                        : "成长任务完成"}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                还没有小章，先玩一个小任务或拍一张餐盘图吧。听故事也会先拿贴纸。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[1.8rem] bg-white/82 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">最近拍图打卡</p>
          <div className="mt-4 space-y-3">
            {latestReviews.length > 0 ? (
              latestReviews.map((item) => (
                <div
                  key={`${item.reviewedAt}-${item.imageName}`}
                  className="rounded-[1.3rem] bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.plateState}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.mode === "ai"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.mode === "ai" ? "AI 已确认" : "现场待确认"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.summary}</p>
                  {item.guessedFoods.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {uniqueTextItems(item.guessedFoods).map((food) => (
                        <span
                          key={`${item.reviewedAt}-${food}`}
                          className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900"
                        >
                          {food}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                还没有餐盘照片，等你拍第一张餐盘图后，这里会出现。
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

type StoryExperienceProps = {
  initialTheme?: ThemeId;
  initialChildId?: string;
};

export function StoryExperience({ initialTheme, initialChildId }: StoryExperienceProps = {}) {
  const initialThemeId = initialTheme ?? "habit";
  const imageFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === "true";
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const premiumVoiceLabel = process.env.NEXT_PUBLIC_TTS_VOICE_LABEL ?? defaultPremiumVoiceLabel;
  const growthArchiveHydratedRef = useRef(false);
  const lastRecordedThemeRef = useRef<ThemeId | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(initialThemeId);
  const [growthArchiveHydrated, setGrowthArchiveHydrated] = useState(false);
  const [storyStateHydrated, setStoryStateHydrated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: themes[initialThemeId].starter,
    },
  ]);
  const [quickChoices, setQuickChoices] = useState(themes[initialThemeId].choices);
  const isLoading = false;
  const [imageUrl, setImageUrl] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const [lastImagePrompt, setLastImagePrompt] = useState("");
  const [storyDraft, setStoryDraft] = useState("");
  const [recommendationRequested, setRecommendationRequested] = useState(false);
  const [status, setStatus] = useState(getThemeReadyStatus(initialThemeId));
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [usePremiumVoice, setUsePremiumVoice] = useState(premiumTtsEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [latestBadgeFeedback, setLatestBadgeFeedback] = useState("");
  const [latestExperienceStickerFeedback, setLatestExperienceStickerFeedback] = useState("");
  const [latestGrowthFeedbackSource, setLatestGrowthFeedbackSource] = useState<
    "story" | "mini-game" | "meal-review" | ""
  >("");
  const [latestCompletion, setLatestCompletion] = useState<GameCompletionState | null>(null);
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(createEmptyGrowthArchive());
  const [gameContentConfigs, setGameContentConfigs] =
    useState<EditableGameContent[]>(defaultGameContentConfigs);
  const [todayMenuEntries, setTodayMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [teacherPictureBooks, setTeacherPictureBooks] = useState<TeacherPictureBook[]>([]);
  const [habitTemplates, setHabitTemplates] = useState<HabitCheckinTemplate[]>([]);
  const [preferredFoodRequest, setPreferredFoodRequest] = useState({
    label: "",
    nonce: 0,
  });
  const [prioritizeTodayMenuInObservation, setPrioritizeTodayMenuInObservation] = useState(true);
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [childIdentityInput, setChildIdentityInput] = useState("");
  const [childIdentitySuggestions, setChildIdentitySuggestions] = useState<ChildProfile[]>([]);
  const [isChildIdentityListening, setIsChildIdentityListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const childIdentityRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const lastAutoSpokenMessageRef = useRef("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const activeTheme = themes[themeId];
  const activeChildDirectoryItems =
    themeId === "food" ? foodChildDirectoryItems : habitChildDirectoryItems;
  const storyPanelCopy =
    themeId === "food"
      ? {
          eyebrow: "说一说 / 写一写",
          title: "告诉 AI 今天想玩什么或想认识什么菜",
          prompt: "说菜名、玩法或小想法，我帮你找1到2个入口。",
          adventurePlaceholder: "可以说：我想认识姜母鸭 / 我想玩厨房",
          imageTitle: "闽食材料图",
        }
      : {
          eyebrow: "说一说 / 写一写",
          title: "告诉 AI 今天想玩什么",
          prompt: "说一说想听故事、闯关，还是想告诉老师一句话。",
          adventurePlaceholder: "我想玩洗手 / 我想听绘本 / 我想对老师说",
          imageTitle: "边听边看好习惯绘本画面",
        };
  const activeMissions = storyMissionMap[themeId];
  const selectedChild = useMemo(
    () => childRoster.find((child) => child.id === selectedChildId) ?? null,
    [childRoster, selectedChildId],
  );
  const [activeChildPanel, setActiveChildPanel] = useState<ChildPanelKey>("home");
  const activeChildPanelHref = activeChildPanel === "home" ? "" : `#${activeChildPanel}`;
  const childRecordFields = useMemo<ChildRecordFields>(
    () =>
      selectedChild
        ? {
            childId: selectedChild.id,
            childName: selectedChild.name,
          }
        : {},
    [selectedChild],
  );
  const getConfiguredGameContent = (gameKey: MiniGameKey) =>
    getGameContentConfig(gameContentConfigs, gameKey);
  const activeThemeBadges = useMemo(
    () =>
      Array.from(
        new Set(
          growthArchive.badgeRecords
            .filter(
              (record) =>
                record.themeId === themeId &&
                (selectedChild ? record.childId === selectedChild.id : false),
            )
            .map((record) => record.name),
        ),
      ),
    [growthArchive.badgeRecords, selectedChild, themeId],
  );
  const activeThemeMiniGameRecords = useMemo(
    () =>
      growthArchive.miniGameRecords.filter(
        (record) =>
          record.themeId === themeId &&
          (selectedChild ? record.childId === selectedChild.id : false),
      ),
    [growthArchive.miniGameRecords, selectedChild, themeId],
  );
  const todayAiRecordCount = useMemo(() => {
    const todayKey = new Date().toDateString();
    const isToday = (value: string) => {
      const date = new Date(value);

      return !Number.isNaN(date.getTime()) && date.toDateString() === todayKey;
    };
    const matchChild = (record: ChildRecordFields) =>
      selectedChild ? record.childId === selectedChild.id : false;
    const miniGameCount = growthArchive.miniGameRecords.filter(
      (record) => record.themeId === themeId && matchChild(record) && isToday(record.completedAt),
    ).length;
    const foodPreferenceCount = growthArchive.foodPreferenceRecords.filter(
      (record) => themeId === "food" && matchChild(record) && isToday(record.recordedAt),
    ).length;

    return miniGameCount + foodPreferenceCount;
  }, [growthArchive.foodPreferenceRecords, growthArchive.miniGameRecords, selectedChild, themeId]);
  const lastAssistantMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant")?.content ?? "",
    [messages],
  );
  function cleanupAudioPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  function stopSpeaking() {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    cleanupAudioPlayback();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }

  async function playPremiumSpeech(text: string) {
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const blob = await fetchPremiumSpeechAudio(text, "child", controller.signal);

    if (controller.signal.aborted) {
      return;
    }

    cleanupAudioPlayback();
    const nextUrl = URL.createObjectURL(blob);
    const audio = new Audio(nextUrl);

    audioUrlRef.current = nextUrl;
    audioRef.current = audio;

    audio.onended = () => {
      speechAbortRef.current = null;
      cleanupAudioPlayback();
      setIsSpeaking(false);
    };

    audio.onerror = () => {
      speechAbortRef.current = null;
      cleanupAudioPlayback();
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    await audio.play();
  }

  function playBrowserSpeech(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function startSpeechPlayback(text: string) {
    if (!text) {
      return;
    }

    stopSpeaking();

    if (usePremiumVoice && premiumTtsEnabled) {
      try {
        setStatus(`正在用 ${premiumVoiceLabel} 播报故事...`);
        await playPremiumSpeech(text);
        return;
      } catch (error) {
        const playbackError = normalizeSpeechPlaybackError(error);
        setStatus(playbackError.message);

        if (playbackError.blocked) {
          setAutoSpeak(false);
          return;
        }
      }
    }

    playBrowserSpeech(text);
  }

  const playAutoReply = useEffectEvent(async (text: string) => {
    await startSpeechPlayback(text);
  });

  useEffect(() => {
    if (!lastAssistantMessage || !autoSpeak) {
      return;
    }

    if (lastAutoSpokenMessageRef.current === lastAssistantMessage) {
      return;
    }

    lastAutoSpokenMessageRef.current = lastAssistantMessage;
    const playbackHandle = window.setTimeout(() => {
      void playAutoReply(lastAssistantMessage);
    }, 0);

    return () => window.clearTimeout(playbackHandle);
  }, [autoSpeak, lastAssistantMessage]);

  useEffect(() => {
    return () => {
      speechAbortRef.current?.abort();
      childIdentityRecognitionRef.current?.stop();
      cleanupAudioPlayback();

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readTodayMenuEntries = () =>
      getEffectiveMenuForDate(
        parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)),
        parseDailyMenuOverrides(window.localStorage.getItem(dailyMenuOverrideStorageKey)),
        getLocalDateKey(),
      );

    const restoreHandle = window.setTimeout(() => {
      const savedArchive = window.localStorage.getItem(growthArchiveStorageKey);
      setGrowthArchive(parseGrowthArchive(savedArchive));
      setGameContentConfigs(
        parseGameContentConfigs(window.localStorage.getItem(gameContentConfigStorageKey)),
      );
      setTodayMenuEntries(readTodayMenuEntries());
      setTeacherPictureBooks(
        parseTeacherPictureBooks(window.localStorage.getItem(teacherPictureBooksStorageKey)),
      );
      setHabitTemplates(parseHabitTemplates(window.localStorage.getItem(habitTemplatesStorageKey)));
      const savedRoster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));
      const savedChildId = window.localStorage.getItem(selectedChildStorageKey) ?? "";
      const routeChildId = initialChildId ? decodeURIComponent(initialChildId) : "";
      const nextChildId = savedRoster.some((child) => child.id === routeChildId)
        ? routeChildId
        : savedRoster.some((child) => child.id === savedChildId)
          ? savedChildId
          : "";
      const nextChild = savedRoster.find((child) => child.id === nextChildId);
      setChildRoster(savedRoster);
      setSelectedChildId(nextChildId);
      setChildIdentityInput(nextChild ? formatChildLabel(nextChild) : "");
      growthArchiveHydratedRef.current = true;
      setGrowthArchiveHydrated(true);
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [initialChildId]);

  useEffect(() => {
    if (typeof window === "undefined" || !growthArchiveHydratedRef.current) {
      return;
    }

    window.localStorage.setItem(growthArchiveStorageKey, JSON.stringify(growthArchive));
  }, [growthArchive]);

  useEffect(() => {
    if (typeof window === "undefined" || !growthArchiveHydratedRef.current) {
      return;
    }

    if (!selectedChildId) {
      window.localStorage.removeItem(selectedChildStorageKey);
      return;
    }

    window.localStorage.setItem(selectedChildStorageKey, selectedChildId);
  }, [selectedChildId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleSharedDataUpdate(event: StorageEvent) {
      if (event.key === weeklyMenuStorageKey || event.key === dailyMenuOverrideStorageKey) {
        setTodayMenuEntries(
          getEffectiveMenuForDate(
            parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)),
            parseDailyMenuOverrides(window.localStorage.getItem(dailyMenuOverrideStorageKey)),
            getLocalDateKey(),
          ),
        );
      }

      if (event.key === childRosterStorageKey) {
        const nextRoster = parseChildRoster(event.newValue);
        setChildRoster(nextRoster);
        setSelectedChildId((current) =>
          current && nextRoster.some((child) => child.id === current) ? current : "",
        );
      }

      if (event.key === teacherPictureBooksStorageKey) {
        setTeacherPictureBooks(parseTeacherPictureBooks(event.newValue));
      }

      if (event.key === habitTemplatesStorageKey) {
        setHabitTemplates(parseHabitTemplates(event.newValue));
      }
    }

    window.addEventListener("storage", handleSharedDataUpdate);

    return () => window.removeEventListener("storage", handleSharedDataUpdate);
  }, []);

  function chooseChildIdentity(child: ChildProfile) {
    setSelectedChildId(child.id);
    setChildIdentityInput(formatChildLabel(child));
    setChildIdentitySuggestions([]);
    setStatus(`${formatChildLabel(child)} 的小名牌拿好啦，今天的任务会记到这个名字下面。`);
  }

  function openChildPanel(panel: ChildPanelKey) {
    setActiveChildPanel(panel);
    setLatestCompletion(null);
    if (panel === "food-observation-card") {
      setPrioritizeTodayMenuInObservation(true);
    }
  }

  function openChildDirectoryItem(item: SectionDirectoryItem) {
    const nextPanel = getChildPanelFromHref(item.href);
    const guide = childDirectoryVoiceGuides[nextPanel];

    setActiveChildPanel(nextPanel);
    setLatestCompletion(null);
    if (nextPanel === "food-observation-card") {
      setPrioritizeTodayMenuInObservation(true);
    }
    void startSpeechPlayback(guide ? `${item.label}。${guide}` : item.label);
  }

  function applyChildIdentityText(rawValue = childIdentityInput) {
    const value = rawValue.trim();

    if (!value) {
      setStatus("可以手动输入名字或号数，也可以点语音说出“我是小何 / 3号”。");
      return;
    }

    if (childRoster.length === 0) {
      setChildIdentitySuggestions([]);
      setStatus("请老师先在教师工作台添加花名册，再选择小名牌。");
      return;
    }

    setChildIdentityInput(value);
    const suggestions = findChildIdentitySuggestions(value, childRoster);
    setChildIdentitySuggestions(suggestions);

    if (suggestions.length === 0) {
      setStatus(`没有找到“${value}”对应的小名牌，可以改一下输入框，或说完整姓名/号数。`);
      return;
    }

    if (suggestions.length === 1) {
      chooseChildIdentity(suggestions[0]);
      return;
    }

    setStatus(`找到 ${suggestions.length} 个相近的小名牌，请点自己的名字确认。`);
  }

  function toggleChildIdentityVoiceInput() {
    if (typeof window === "undefined") {
      return;
    }

    const voiceWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognitionApi = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setStatus("当前浏览器不能听声音，可以直接在小名牌输入框里输入名字或号数。");
      return;
    }

    if (isChildIdentityListening && childIdentityRecognitionRef.current) {
      childIdentityRecognitionRef.current.stop();
      setIsChildIdentityListening(false);
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";

      if (transcript) {
        setChildIdentityInput(transcript);
        applyChildIdentityText(transcript);
      }
    };
    recognition.onerror = () => {
      setStatus("刚刚没有听清，可以再说一次，也可以请老师帮你打字。");
      setIsChildIdentityListening(false);
    };
    recognition.onend = () => setIsChildIdentityListening(false);
    childIdentityRecognitionRef.current = recognition;
    recognition.start();
    setIsChildIdentityListening(true);
    setStatus("我在听小名牌，可以说：我是小何 / 3号。识别后也会填进输入框。");
  }

  useEffect(() => {
    if (!growthArchiveHydrated || !storyStateHydrated || lastRecordedThemeRef.current === themeId) {
      return;
    }

    lastRecordedThemeRef.current = themeId;
    setGrowthArchive((current) => recordThemeVisit(current, themeId));
  }, [growthArchiveHydrated, storyStateHydrated, themeId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialTheme) {
      const restoreHandle = window.setTimeout(() => {
        setThemeId(initialTheme);
        setMessages([
          {
            role: "assistant",
            content: themes[initialTheme].starter,
          },
        ]);
        setQuickChoices(themes[initialTheme].choices);
        setRecommendationRequested(false);
        setStatus(getThemeReadyStatus(initialTheme));
        setStoryStateHydrated(true);
      }, 0);

      return () => window.clearTimeout(restoreHandle);
    }

    const savedState = window.localStorage.getItem(storyStateStorageKey);

    if (!savedState) {
      const restoreHandle = window.setTimeout(() => {
        setStoryStateHydrated(true);
      }, 0);

      return () => window.clearTimeout(restoreHandle);
    }

    try {
      const parsed = JSON.parse(savedState) as {
        themeId?: ThemeId;
        messages?: ChatMessage[];
        quickChoices?: string[];
        imageUrl?: string;
        lastImagePrompt?: string;
        status?: string;
        badges?: string[];
      };
      const shouldRestoreSavedContent =
        !initialTheme || !parsed.themeId || parsed.themeId === initialTheme;

      const restoreHandle = window.setTimeout(() => {
        if (initialTheme && themes[initialTheme]) {
          setThemeId(initialTheme);
        } else if (parsed.themeId && themes[parsed.themeId]) {
          setThemeId(parsed.themeId);
        }

        if (shouldRestoreSavedContent && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }

        if (shouldRestoreSavedContent && Array.isArray(parsed.quickChoices) && parsed.quickChoices.length > 0) {
          setQuickChoices(parsed.quickChoices);
        }

        if (
          shouldRestoreSavedContent &&
          typeof parsed.imageUrl === "string" &&
          !parsed.imageUrl.startsWith("data:") &&
          parsed.imageUrl.length < 1200
        ) {
          setImageUrl(parsed.imageUrl);
        }

        if (shouldRestoreSavedContent && typeof parsed.lastImagePrompt === "string") {
          setLastImagePrompt(parsed.lastImagePrompt);
        }

        if (shouldRestoreSavedContent && typeof parsed.status === "string" && parsed.status.trim()) {
          setStatus(normalizeRestoredStoryStatus(parsed.status));
        }

        if (Array.isArray(parsed.badges)) {
          setBadges(parsed.badges);
        }
        setStoryStateHydrated(true);
      }, 0);

      return () => window.clearTimeout(restoreHandle);
    } catch {
      window.localStorage.removeItem(storyStateStorageKey);
      const restoreHandle = window.setTimeout(() => {
        setStoryStateHydrated(true);
      }, 0);

      return () => window.clearTimeout(restoreHandle);
    }
  }, [initialTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      themeId,
      messages,
      quickChoices,
      imageUrl: imageUrl.startsWith("data:") ? "" : imageUrl,
      lastImagePrompt,
      status,
      badges,
    };

    try {
      window.localStorage.setItem(storyStateStorageKey, JSON.stringify(payload));
    } catch {
      window.localStorage.removeItem(storyStateStorageKey);
    }
  }, [badges, imageUrl, lastImagePrompt, messages, quickChoices, status, themeId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isLoading, messages]);

  async function syncGrowthArchiveToClassAccount(nextArchive: GrowthArchive) {
    if (typeof window === "undefined") {
      return;
    }

    const account = window.localStorage.getItem(teacherAccountStorageKey)?.trim() ?? "";
    const passcode = window.localStorage.getItem(teacherPasscodeStorageKey)?.trim() ?? "";

    if (!account || !passcode) {
      return;
    }

    try {
      await fetch("/api/account-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "push",
          account,
          passcode,
          role: "child",
          payload: {
            growthArchive: JSON.stringify(nextArchive),
          },
          ...getAccountSyncDeviceInfo(),
        }),
      });
    } catch {
      // Growth records stay in localStorage with syncStatus=pending until the teacher syncs again.
    }
  }

  function updateGrowthArchive(updater: (current: GrowthArchive) => GrowthArchive) {
    setGrowthArchive((current) => {
      const baseArchive =
        typeof window !== "undefined" && !growthArchiveHydratedRef.current
          ? parseGrowthArchive(window.localStorage.getItem(growthArchiveStorageKey))
          : current;
      const nextArchive = updater(baseArchive);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(growthArchiveStorageKey, JSON.stringify(nextArchive));
        void syncGrowthArchiveToClassAccount(nextArchive);
      }

      return nextArchive;
    });
  }

  function logMiniGameCompletion(
    gameKey: MiniGameKey,
    badgeName: string,
    pickedItems: string[] = [],
    extraDetail: Partial<
      Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">
    > = {},
  ) {
    const theme = miniGameThemeMap[gameKey];
    const gameContent = getConfiguredGameContent(gameKey);
    const gameInstanceDetail = getGameInstanceMetadata(gameKey, extraDetail);
    const childHasBadge = growthArchive.badgeRecords.some(
      (record) =>
        record.name === badgeName &&
        record.themeId === theme &&
        (selectedChild ? record.childId === selectedChild.id : !record.childId),
    );

    updateGrowthArchive((current) => {
      const withGame = recordMiniGameCompletion(current, gameKey, {
        badgeName,
        themeId: theme,
        pickedItems,
        source: getMiniGameSourceLabel(gameKey),
        ...gameInstanceDetail,
        ...extraDetail,
        ...childRecordFields,
      });

      return childHasBadge
        ? withGame
        : recordBadge(withGame, badgeName, theme, "mini-game", childRecordFields);
    });
    const completionCopy = buildMiniGameCompletionCopy(gameKey, badgeName, pickedItems, gameContent);
    void recordGameEngineAttempt({
      gameKey,
      gameInstanceId: gameInstanceDetail.gameInstanceId,
      gameInstanceMechanic: gameInstanceDetail.gameInstanceMechanic,
      gameInstanceTitle: gameInstanceDetail.gameInstanceTitle,
      badgeName,
      themeId: theme,
      source: getMiniGameSourceLabel(gameKey),
      pickedItems,
      detail: {
        ...gameInstanceDetail,
        ...extraDetail,
      },
      ...childRecordFields,
    });

    setBadges((current) => (current.includes(badgeName) ? current : [...current, badgeName]));
    setLatestBadgeFeedback(childHasBadge ? "" : completionCopy.feedback);
    setLatestExperienceStickerFeedback(childHasBadge ? buildRepeatedMiniGameStatus(gameKey, gameContent) : "");
    setLatestGrowthFeedbackSource("mini-game");
    setLatestCompletion({
      title: gameInstanceDetail.gameInstanceTitle ?? gameContent?.title ?? childPanelLabels[activeChildPanel],
      badgeName,
      detail: formatInteractionRecord(pickedItems),
      themeId: theme,
      panelKey: activeChildPanel,
      gameKey,
      imageUrl: extraDetail.coverImageUrl,
      imageAlt: extraDetail.foodLabel ? `${extraDetail.foodLabel}完成图片` : undefined,
      imageSourceLabel: extraDetail.imageSourceLabel,
      imageAiGenerated: extraDetail.aiGenerated,
    });
    setStatus(childHasBadge ? buildRepeatedMiniGameStatus(gameKey, gameContent) : completionCopy.status);
  }

  function logFoodPreferenceObservation(record: FoodPreferenceRecord) {
    const badgeName = "美食认识观察章";
    const gameContent = getConfiguredGameContent("foodPreference");
    const recordWithChild = {
      ...record,
      ...childRecordFields,
    };
    const followUp = getFoodPreferenceFollowUp(recordWithChild);
    const pickedItems = [
      record.dishName && record.dishName !== record.foodLabel ? `菜品：${record.dishName}` : "",
      record.ingredientName ? `食材：${record.ingredientName}` : record.foodLabel,
      record.reasonLabel,
      record.approachStep ?? "",
    ].filter(Boolean);
    const stage = getAiObservationStage("foodPreference", pickedItems);
    const gameInstanceDetail = getGameInstanceMetadata("foodPreference");
    const hasPreferenceBadge = growthArchive.badgeRecords.some(
      (item) =>
        item.name === badgeName &&
        item.themeId === "food" &&
        (selectedChild ? item.childId === selectedChild.id : !item.childId),
    );

    updateGrowthArchive((current) => {
      const withPreference = recordFoodPreference(current, recordWithChild);
      const withGame = recordMiniGameCompletion(withPreference, "foodPreference", {
        badgeName,
        themeId: "food",
        pickedItems,
        source: getMiniGameSourceLabel("foodPreference"),
        ...gameInstanceDetail,
        activityType: "food-approach",
        foodId: recordWithChild.foodId ?? recordWithChild.ingredientName ?? recordWithChild.foodLabel,
        foodLabel: recordWithChild.foodLabel,
        dishId: recordWithChild.dishName ?? recordWithChild.foodLabel,
        approachStep: recordWithChild.approachStep,
        acceptedLevel: recordWithChild.acceptedLevel ?? recordWithChild.approachStep,
        nutritionPlayed: recordWithChild.nutritionPlayed ?? false,
        menuDate: recordWithChild.menuDate,
        mealType: recordWithChild.mealType,
        answerContent: recordWithChild.reasonLabel,
        result: "success",
        attempts: 1,
        status: "completed",
        ...childRecordFields,
      });

      return hasPreferenceBadge
        ? withGame
        : recordBadge(withGame, badgeName, "food", "mini-game", childRecordFields);
    });
    void recordGameEngineAttempt({
      gameKey: "foodPreference",
      gameInstanceId: gameInstanceDetail.gameInstanceId,
      gameInstanceMechanic: gameInstanceDetail.gameInstanceMechanic,
      gameInstanceTitle: gameInstanceDetail.gameInstanceTitle,
      badgeName,
      themeId: "food",
      source: getMiniGameSourceLabel("foodPreference"),
      pickedItems,
      detail: {
        ...gameInstanceDetail,
        ...recordWithChild,
      },
      ...childRecordFields,
    });

    if (!hasPreferenceBadge) {
      setBadges((current) => (current.includes(badgeName) ? current : [...current, badgeName]));
    }

    setLatestBadgeFeedback(
      hasPreferenceBadge
        ? `AI成长观察已更新：${record.foodLabel} · ${record.reasonLabel}`
        : `AI成长观察：${badgeName} · ${gameContent?.title || record.foodLabel} · ${record.reasonLabel}`,
    );
    setLatestExperienceStickerFeedback("");
    setLatestGrowthFeedbackSource("mini-game");
    setLatestCompletion({
      title: "美食观察与靠近一点点",
      badgeName,
      detail: `${record.foodLabel} · ${record.reasonLabel}${record.approachStep ? ` · ${record.approachStep}` : ""}`,
      themeId: "food",
      panelKey: activeChildPanel,
      gameKey: "foodPreference",
    });
    setStatus(
      [
        `老师会看到：正在认识“${record.foodLabel}”`,
        record.dishName && record.dishName !== record.foodLabel ? `今日食谱：${record.dishName}` : "",
        `这次选择：${record.reasonLabel}${record.approachStep ? `，${record.approachStep}` : ""}`,
        `老师会看到：${followUp.observation}`,
        `现在小步：${stage}`,
        `下一小步：${followUp.homeTask}`,
        gameContent?.reminderText ? `老师提醒：${gameContent.reminderText}` : "",
      ]
        .filter(Boolean)
        .join("。"),
    );
  }

  function handleMealReviewLogged(review: MealPhotoReviewResponse, imageName: string) {
    const nextStickers = review.stickers && review.stickers.length > 0 ? review.stickers : ["闽食观察员"];
    const shouldAwardBadges = canAwardMealReviewBadge(review);
    const recordedStickers = shouldAwardBadges ? nextStickers : [];

    updateGrowthArchive((current) => {
      const withReview = recordMealReview(current, {
        reviewedAt: new Date().toISOString(),
        mode: review.mode ?? "demo",
        summary: review.summary ?? "餐盘照片已完成一次观察。",
        guessedFoods: review.guessedFoods ?? [],
        stickers: recordedStickers,
        plateState: review.plateState ?? "等待现场确认",
        imageName,
        ...childRecordFields,
      });

      if (!shouldAwardBadges) {
        return withReview;
      }

      return nextStickers.reduce(
        (draft, sticker) => recordBadge(draft, sticker, "food", "meal-review", childRecordFields),
        withReview,
      );
    });

    const firstSticker = nextStickers[0];

    if (shouldAwardBadges) {
      setBadges((current) =>
        nextStickers.reduce(
          (draft, sticker) => (draft.includes(sticker) ? draft : [...draft, sticker]),
          current,
        ),
      );
      setLatestBadgeFeedback(`闽食小照片：${firstSticker}`);
      setStatus(`闽食照片收好啦，围绕${formatFoodList(review.guessedFoods ?? [])}继续说一说。`);
    } else {
      setLatestBadgeFeedback("");
      setStatus("闽食拍照练习完成啦，可以请老师或家长一起确认餐盘里的泉州闽南味。");
    }

    setLatestExperienceStickerFeedback(
      shouldAwardBadges ? "" : `闽食体验贴纸：${firstSticker}。拍照和观察小任务已经完成啦。`,
    );
    setLatestGrowthFeedbackSource("meal-review");
    setLatestCompletion({
      title: "闽食照片观察",
      badgeName: firstSticker,
      detail: `围绕${formatFoodList(review.guessedFoods ?? [])}完成拍图观察。`,
      themeId: "food",
      panelKey: activeChildPanel,
    });
  }

  function switchTheme(nextTheme: ThemeId) {
    recognitionRef.current?.stop();
    childIdentityRecognitionRef.current?.stop();
    stopSpeaking();
    setThemeId(nextTheme);
    setActiveChildPanel("home");
    setMessages([
      {
        role: "assistant",
        content: themes[nextTheme].starter,
      },
    ]);
    setQuickChoices(themes[nextTheme].choices);
    setRecommendationRequested(false);
    setImageUrl("");
    setLastImagePrompt("");
    setStoryDraft("");
    setIsListening(false);
    setIsChildIdentityListening(false);
    setIsPainting(false);
    setLatestExperienceStickerFeedback("");
    setLatestBadgeFeedback("");
    setLatestGrowthFeedbackSource("");
    setLatestCompletion(null);
    setStatus(getThemeReadyStatus(nextTheme));
  }

  function resetStoryProgress() {
    const resetTheme = themeId;

    setThemeId(resetTheme);
    setMessages([
      {
        role: "assistant",
        content: themes[resetTheme].starter,
      },
    ]);
    setQuickChoices(themes[resetTheme].choices);
    setRecommendationRequested(false);
    setImageUrl("");
    setLastImagePrompt("");
    setStoryDraft("");
    setStatus(
      resetTheme === "food"
        ? "闽食成长岛重新开始啦：可以先逛泉州美食摊，认识名字、食材和小故事。"
        : `${themes[resetTheme].label}重新开始啦。`,
    );
    setBadges([]);
    setLatestBadgeFeedback("");
    setLatestExperienceStickerFeedback("");
    setLatestGrowthFeedbackSource("");
    setLatestCompletion(null);
    stopSpeaking();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storyStateStorageKey);
    }
  }

  async function chooseStoryOption(choice: string) {
    const target = getStoryOptionTarget(choice, themeId);
    const visual = getStoryOptionVisual(choice, themeId);
    const nextPanel = getChildPanelFromHref(target);

    setActiveChildPanel(nextPanel);
    setLatestCompletion(null);
    setStatus(`先玩：${visual.title}。进去试一试，玩完小贴纸才会来。`);
    await startSpeechPlayback(visual.title);
  }

  async function applyStoryRecommendation(rawText: string, source: "text" | "voice" | "default" = "text") {
    const cleanText = rawText.trim();
    const nextChoices = recommendStoryOptionsFromInput(cleanText, themeId);

    setQuickChoices(nextChoices);
    setRecommendationRequested(true);
    const heardVerb = source === "text" ? "我看到啦" : "我听到啦";

    setStatus(
      cleanText
        ? `${heardVerb}，你想玩“${cleanText}”。我们一起去试试：${nextChoices[0]}。`
        : `先给你找两个小入口。点“开始玩”进去看看。`,
    );
    await startSpeechPlayback(
      cleanText
        ? `${heardVerb}，你想玩${cleanText}。我们一起去试试${nextChoices[0]}。`
        : `可以先玩${nextChoices[0]}。`,
    );
  }

  async function submitStoryDraft() {
    await applyStoryRecommendation(storyDraft, storyDraft.trim() ? "text" : "default");
    setStoryDraft("");
  }

  async function generateImage(imageIdea = "") {
    if (isPainting) {
      return;
    }

    const cleanIdea = imageIdea.trim();
    const prompt = `${activeTheme.imagePrompt} 当前剧情：${lastAssistantMessage || activeTheme.starter}${
      cleanIdea ? ` 孩子想画：${cleanIdea}` : ""
    }`;

    if (imageUrl && lastImagePrompt === prompt) {
      setStatus("这一章的插图已经画好了，不用重复等待啦。");
      return;
    }

    setIsPainting(true);
    setStatus("正在画本章插图，漂亮的画面会多等一小会儿...");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      const data = (await response.json()) as { imageUrl?: string; error?: string };

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "图片暂时画不出来");
      }

      setImageUrl(data.imageUrl);
      setLastImagePrompt(prompt);
      setStatus("绘本插图画好了。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "图片暂时画不出来，稍后再试。");
    } finally {
      setIsPainting(false);
    }
  }

  function toggleVoiceInput() {
    stopSpeaking();
    startChildVoiceInput({
      recognitionRef,
      isListening,
      setListening: setIsListening,
      onStart: themeId === "food" ? "我在听，你可以说：我想认识姜母鸭。" : "我在听，你可以说：我想洗手，或我想听故事。",
      onUnsupported: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onError: "刚刚没有听清，可以再说一次，也可以请老师帮你打字。",
      onSpeak: (message) => {
        setStatus(message);
        void startSpeechPlayback(message);
      },
      onResult: (transcript) => {
        const nextText = transcript.slice(0, storyInputMaxLength);
        setStoryDraft(nextText);
        void applyStoryRecommendation(nextText, "voice");
      },
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div
        className={`grid gap-6 ${
          selectedChild ? "lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" : ""
        }`}
      >
        <div className="flex min-w-0 flex-col gap-8">
          <section className="hidden">
            <ChildIdentityPanel
              childRoster={childRoster}
              selectedChildId={selectedChildId}
            />
          </section>

      {selectedChild && activeChildPanel !== "home" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-white/82 px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            现在玩：{childPanelLabels[activeChildPanel]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {Object.values(themes).map((theme) => (
              <button
                key={`switch-${theme.id}`}
                onClick={() => switchTheme(theme.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  theme.id === themeId
                    ? "bg-orange-300 text-orange-950 shadow-sm"
                    : "bg-white text-slate-700 shadow-sm"
                }`}
                type="button"
              >
                {theme.emoji} {theme.label}
              </button>
            ))}
            <button
              onClick={() => openChildPanel("home")}
              className="rounded-full bg-orange-200 px-4 py-2 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-100"
              type="button"
            >
              🏠 回到我的小首页
            </button>
          </div>
        </div>
      ) : null}

      {selectedChild && latestCompletion ? (
        <GameCompletionPanel
          completion={latestCompletion}
          onReplay={() => {
            if (latestCompletion.gameKey === "foodPreference") {
              setPreferredFoodRequest((current) => ({
                label: "",
                nonce: current.nonce + 1,
              }));
              setPrioritizeTodayMenuInObservation(false);
              setStatus("美食观察重新开始啦。这次不把今日食谱排在最前面，换一种食物看看。");
            } else {
              setStatus(`可以再玩一次：${childPanelLabels[latestCompletion.panelKey]}。`);
            }
            setLatestCompletion(null);
          }}
          onBackToDirectory={() => {
            setLatestCompletion(null);
            setActiveChildPanel("home");
            setStatus("已回到儿童首页，可以从右侧目录再选一个游戏。");
          }}
          onSpeak={(text) => {
            void startSpeechPlayback(text);
          }}
        />
      ) : null}

      <section
        id="child-status"
        hidden={
          Boolean(selectedChild) && activeChildPanel !== "home" && activeChildPanel !== "child-status"
        }
      >
        <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#fff6d6_0%,#ffffff_52%,#dff8f7_100%)] p-5 shadow-[0_20px_60px_rgba(49,93,104,0.14)] md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {Object.values(themes).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => switchTheme(theme.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    theme.id === themeId
                      ? "bg-orange-300 text-orange-950 shadow-md"
                      : "bg-white/80 text-slate-700 hover:-translate-y-0.5"
                  }`}
                  type="button"
                >
                  {theme.emoji} {theme.label}
                </button>
              ))}
            </div>
            <Link
              href="/children"
              className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
            >
              🏠 回到儿童入口重新识别
            </Link>
          </div>

          <div className="mt-5 rounded-[1.6rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal-700">我的小名牌 · 今天玩什么</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedChild ? formatChildLabel(selectedChild) : "还没拿到小名牌"}
                </h1>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  当前主题：{activeTheme.label}
                </p>
                {themeId === "food" ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-teal-900">
                    <span className="rounded-full bg-teal-50 px-3 py-1.5">
                      今日食谱：{todayMenuEntries.length > 0 ? `${todayMenuEntries.length} 道菜` : "等老师放好"}
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1.5">
                      今日闽食任务：看图、靠近、小播报
                    </span>
                  </div>
                ) : null}
                <p className="mt-3 max-w-3xl text-base leading-7 font-semibold text-slate-900">
                  {latestBadgeFeedback || status}
                </p>
                <p className="mt-3 max-w-3xl rounded-[1.1rem] bg-amber-50 px-4 py-3 text-sm leading-7 font-semibold text-amber-900">
                  今天玩 5-10 分钟就好。看一看、说一说，再回到线下画一画、闻一闻、试一小步。照片只拍食物或作品，不拍小朋友正脸。
                </p>
                {!selectedChild ? (
                <div className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    value={childIdentityInput}
                    onChange={(event) => setChildIdentityInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        applyChildIdentityText();
                      }
                    }}
                    placeholder="手动输入小名牌：姓名 / 号数 / 3号 小何"
                    className="rounded-[1.1rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                  />
                  <button
                    onClick={() => applyChildIdentityText()}
                    className="rounded-full bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    找小名牌
                  </button>
                  <button
                    onClick={toggleChildIdentityVoiceInput}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      isChildIdentityListening ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-900"
                    }`}
                    type="button"
                  >
                    {isChildIdentityListening ? "停止识别" : "语音识别"}
                  </button>
                </div>
                ) : null}
                {childIdentitySuggestions.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {childIdentitySuggestions.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => chooseChildIdentity(child)}
                        className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:-translate-y-0.5 hover:bg-amber-200"
                        type="button"
                      >
                        {formatChildLabel(child)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid w-full max-w-md grid-cols-3 gap-3 sm:w-auto">
                {[
                  { label: "今天玩了", value: `${todayAiRecordCount}次`, icon: "📝", tone: "bg-teal-50 text-teal-900" },
                  { label: "已点亮章", value: `${activeThemeBadges.length}个`, icon: "🏅", tone: "bg-emerald-50 text-emerald-900" },
                  { label: "播报", value: autoSpeak ? "开" : "关", icon: "🔊", tone: "bg-amber-50 text-amber-900" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`min-h-[112px] rounded-[1.2rem] px-3 py-3 text-center shadow-sm ${item.tone}`}
                  >
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-white text-xl shadow-sm">
                      {item.icon}
                    </span>
                    <p className="mt-2 text-xs font-semibold">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {activeThemeBadges.length === 0 ? (
                  <span className="rounded-full bg-amber-100 px-3 py-2 text-sm text-amber-800">
                    第一枚成长章还在路上
                  </span>
                ) : (
                  activeThemeBadges.slice(0, 4).map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
                    >
                      {badge}
                    </span>
                  ))
                )}
              </div>
              <div className="w-full">
                <p className="mb-3 text-sm font-semibold text-slate-700">最近游戏贴纸</p>
                <GameRewardTrail records={activeThemeMiniGameRecords} />
              </div>
              <details className="w-full rounded-[1.1rem] bg-white/72 px-3 py-2 sm:w-auto">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                  播报设置
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                {imageFeatureEnabled ? (
                  <button
                    onClick={() => void generateImage(storyDraft)}
                    className="hidden"
                    type="button"
                  >
                    {isPainting ? "正在画图..." : "画绘本图"}
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    if (autoSpeak) {
                      setAutoSpeak(false);
                      stopSpeaking();
                      setStatus("已关闭自动播报。");
                      return;
                    }

                    lastAutoSpokenMessageRef.current = lastAssistantMessage;
                    setAutoSpeak(true);
                    setStatus("已开启自动播报，下一句故事会自动播放。");
                  }}
                  className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
                  type="button"
                >
                  {autoSpeak ? "关闭播报" : "开启播报"}
                </button>
                {premiumTtsEnabled ? (
                  <button
                    onClick={() => {
                      stopSpeaking();
                      setUsePremiumVoice((current) => !current);
                    }}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      usePremiumVoice
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                    type="button"
                  >
                    {usePremiumVoice ? `${premiumVoiceLabel} 已启用` : "切回浏览器播报"}
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    if (!lastAssistantMessage) {
                      setStatus("还没有可以重听的内容，先完成一个任务吧。");
                      return;
                    }

                    void startSpeechPlayback(lastAssistantMessage);
                  }}
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
                  type="button"
                >
                  {isSpeaking ? "正在播报..." : "重听上一句"}
                </button>
                <button
                  onClick={resetStoryProgress}
                  className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
                  type="button"
                >
                  重新开始本轮
                </button>
                </div>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section
        id="child-play"
        hidden={activeChildPanel !== "home" && activeChildPanel !== "child-play"}
      >
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">{storyPanelCopy.eyebrow}</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{storyPanelCopy.title}</h2>
            </div>
            <span className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900">
              先说想法，再选任务
            </span>
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {storyPanelCopy.prompt}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-amber-900">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">🎙️ 语音输入：说一说想玩什么</span>
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">✍️ 文字输入：我想玩……</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={storyDraft}
                onChange={(event) => setStoryDraft(event.target.value.slice(0, storyInputMaxLength))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitStoryDraft();
                  }
                }}
                placeholder={storyPanelCopy.adventurePlaceholder}
                className="rounded-[1.4rem] border border-amber-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-300"
              />
              <button
                onClick={toggleVoiceInput}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  isListening ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-900"
                }`}
                type="button"
              >
                {isListening ? "我说完啦" : "🎤 说一说"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void submitStoryDraft()}
                disabled={isLoading}
                className="rounded-full bg-orange-300 px-5 py-3 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                type="button"
              >
                {isLoading ? "正在想..." : "帮我找玩法"}
              </button>
              <span className="text-xs font-semibold text-slate-500">
                还可输入 {storyInputMaxLength - storyDraft.length} 字
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-white/80 p-4">
            <p className="text-sm font-semibold text-teal-700">
              {recommendationRequested ? "我帮你找到啦" : "猜你想试试"}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(recommendationRequested ? quickChoices : recommendStoryOptionsFromInput("", themeId))
                .slice(0, 2)
                .map((choice, index) => {
                  const visual = getStoryOptionVisual(choice, themeId);

                  return (
                    <div
                      key={`${themeId}-${choice}-${index}`}
                      className="rounded-[1.5rem] bg-slate-50 px-4 py-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-white text-3xl shadow-sm">
                          {visual.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{visual.title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {visual.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void chooseStoryOption(choice)}
                          aria-label={`开始玩：${visual.title}`}
                          disabled={isLoading}
                          className="rounded-full bg-orange-300 px-4 py-2 text-xs font-semibold text-orange-950 transition hover:-translate-y-0.5 hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                          type="button"
                        >
                          ▶ 开始玩
                        </button>
                        <SpeechCueButton
                          text={`${visual.title}。${visual.description}`}
                          onSpeak={(text) => {
                            void startSpeechPlayback(text);
                          }}
                          label="听介绍"
                          tone="teal"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      </section>

      {themeId === "habit" ? (
        <>
          <section className="hidden">
            <HabitVisualBoard
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onTaskComplete={(gameKey, badgeName, pickedItems, detail) =>
                logMiniGameCompletion(gameKey, badgeName, pickedItems, detail)
              }
            />
            <HabitMissionPoster badges={badges} missions={activeMissions} />
          </section>
        </>
      ) : (
        <section className="hidden">
          <details className="rounded-[2.2rem] border border-white/70 bg-white/88 p-5 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rose-700">作品上传与家园延续</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">上传、拍图和回家小任务</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  主游戏完成后再打开这里，提交闽食家园任务或拍一张餐盘观察。
                </p>
              </div>
              <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
                可选延伸
              </span>
            </summary>
            <div className="mt-5 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <FoodBadgeWall
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onSubmit={(gameKey, badgeName, pickedItems) =>
                  logMiniGameCompletion(gameKey, badgeName, pickedItems)
                }
              />
              <div className="grid gap-5">
                <MealPhotoBooth onReviewLogged={handleMealReviewLogged} />
            {latestGrowthFeedbackSource === "meal-review" && latestBadgeFeedback ? (
              <div
                aria-live="polite"
                className="rounded-[2rem] bg-emerald-50 p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-emerald-800">拍图小反馈</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  你愿意观察餐盘和闽食，这个小尝试老师看得到。
                </p>
              </div>
            ) : null}
            {latestGrowthFeedbackSource === "meal-review" && latestExperienceStickerFeedback ? (
              <div
                aria-live="polite"
                className="rounded-[2rem] bg-amber-50 p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-amber-900">拍图打卡完成</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {latestExperienceStickerFeedback}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  这次先给体验贴纸，等老师或家长一起确认后再点亮成长勋章。
                </p>
              </div>
            ) : null}
              </div>
            </div>
          </details>
        </section>
      )}

      <section className="hidden">
        <ThemeVideoBoard themeId={themeId} />
      </section>

      <section className="hidden">
        <RewardStickerShelf badges={badges} />
        <GrowthArchivePanel archive={growthArchive} childId={selectedChild?.id} />
      </section>

      <section
        className="grid gap-6 xl:grid-cols-2"
        hidden={
          !selectedChild ||
          activeChildPanel === "home" ||
          activeChildPanel === "child-status" ||
          activeChildPanel === "child-play"
        }
      >
        {!growthArchiveHydrated ? (
          <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm xl:col-span-2">
            <p className="text-sm font-semibold text-teal-700">正在准备今天的小任务</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">稍等一下，卡片马上来</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              正在读取小名牌、老师放好的内容和今日食谱，准备好后会出现好玩的卡片。
            </p>
          </div>
        ) : themeId === "habit" ? (
          <>
            {activeChildPanel === "habit-story" ? (
            <details
              id="habit-story"
              open
              className="rounded-[2rem] bg-white/80 p-5 shadow-sm xl:col-span-2"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                习惯故事小剧场
              </summary>
              <div className="mt-4 grid gap-4">
                <ReadingCheckinGame
                  contentConfig={getConfiguredGameContent("readingCheckin")}
                  teacherBooks={teacherPictureBooks}
                  onSpeak={(text) => {
                    void startSpeechPlayback(text);
                  }}
                  onComplete={(pickedItems, detail) =>
                    logMiniGameCompletion("readingCheckin", "故事小耳朵", pickedItems, detail)
                  }
                />
              </div>
            </details>
            ) : null}
            {activeChildPanel === "habit-talk" ? (
            <div id="habit-talk" className="xl:col-span-2">
              <HabitTemplateCheckinPanel
                mode="talk"
                templates={[]}
                onBackToHome={() => openChildPanel("home")}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={(pickedItems, detail) =>
                  logMiniGameCompletion("childTalk", "幼儿表达小章", pickedItems, {
                    ...detail,
                    source: "child-to-teacher",
                  })
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "habit-template" ? (
            <div id="habit-template" className="xl:col-span-2">
              <HabitTemplateCheckinPanel
                mode="task"
                templates={habitTemplates}
                onBackToHome={() => openChildPanel("home")}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={(pickedItems, detail) =>
                  logMiniGameCompletion("teacherTask", "老师小任务章", pickedItems, {
                    ...detail,
                    source: "teacher-assigned-task",
                  })
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "habit-challenge" ? (
            <div id="habit-challenge" className="xl:col-span-2">
              <HabitVisualBoard
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onTaskComplete={(gameKey, badgeName, pickedItems, detail) =>
                  logMiniGameCompletion(gameKey, badgeName, pickedItems, detail)
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "habit-meal-manners" ? (
            <div id="habit-meal-manners" className="xl:col-span-2">
              <MealMannersGame
                contentConfig={getConfiguredGameContent("mealManners")}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={(pickedItems) =>
                  logMiniGameCompletion("mealManners", "文明进餐章", pickedItems)
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "habit-traffic-light" ? (
            <div id="habit-traffic-light" className="xl:col-span-2">
              <HabitTrafficLightGame
                contentConfig={getConfiguredGameContent("habitTrafficLight")}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={(pickedItems) =>
                  logMiniGameCompletion("habitTrafficLight", "好习惯判断章", pickedItems)
                }
              />
            </div>
            ) : null}
          </>
        ) : (
          <>
            {activeChildPanel === "food-menu" ? (
            <div id="food-menu" className="xl:col-span-2">
              <TodayMenuBroadcast
                entries={todayMenuEntries}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onPickFood={(foodLabel, ingredients = [], entry, nutritionPlayed = false) => {
                  setPreferredFoodRequest((current) => ({
                    label: foodLabel,
                    nonce: current.nonce + 1,
                  }));
                  setPrioritizeTodayMenuInObservation(true);
                  const foodOption = buildFoodPreferenceOption(foodLabel);
                  const nutritionText = getFoodCardNutritionText(
                    foodLabel,
                    ingredients.length > 0 ? ingredients : foodOption.ingredients,
                  );
                  logMiniGameCompletion(
                    "todayMenu",
                    nutritionPlayed ? "今日食谱营养章" : "今日食谱观察章",
                    ["点击菜品", foodLabel, nutritionPlayed ? "听营养小发现" : "听菜品介绍"],
                    {
                    activityType: "today-menu",
                    gameInstanceId: "todayMenuPlate",
                    gameInstanceMechanic: "todayMenu",
                    gameInstanceTitle: "今日食谱认识",
                    gameRuleName: nutritionPlayed ? "菜品营养点听" : "菜品看图点听",
                    menuDate: entry?.date ?? getLocalDateKey(),
                    mealType: entry?.mealType ?? "今日食谱",
                    foodId: foodLabel,
                    foodLabel,
                    dishId: entry?.dishName ?? foodLabel,
                    clicked: true,
                    nutritionPlayed,
                    answerContent: nutritionPlayed ? nutritionText : `${foodLabel}看图观察`,
                    result: "success",
                    attempts: 1,
                    status: "completed",
                    },
                  );
                  const message = nutritionPlayed
                    ? `${nutritionText} 已把${foodLabel}带到美食观察与靠近一点点。可以先认名字，再选一个靠近小步。`
                    : `${foodLabel}已经带到美食观察与靠近一点点。可以先看图，再听营养小发现。`;
                  setStatus(message);
                  void startSpeechPlayback(message);
                }}
              />
            </div>
            ) : null}
            {activeChildPanel === "food-observation-card" ? (
            <div id="food-observation-card" className="xl:col-span-2">
              <FoodPreferenceGame
                key={`food-preference-${preferredFoodRequest.nonce}-${prioritizeTodayMenuInObservation ? "menu-first" : "replay-free"}`}
                contentConfig={getConfiguredGameContent("foodPreference")}
                todayMenuEntries={todayMenuEntries}
                preferredFoodLabel={preferredFoodRequest.label}
                prioritizeTodayMenuFoods={prioritizeTodayMenuInObservation}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={logFoodPreferenceObservation}
              />
            </div>
            ) : null}
            {activeChildPanel === "food-stall" ? (
            <div id="food-stall" className="xl:col-span-2">
              <FoodTreasureQuestGame
                contentConfig={getConfiguredGameContent("foodObserve")}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={(pickedItems = []) =>
                  logMiniGameCompletion("foodObserve", "美食摊位寻宝章", pickedItems)
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "food-kitchen" ? (
            <div id="food-kitchen" className="xl:col-span-2">
              <FoodKitchenGame
                mode="kitchen"
                contentConfig={getConfiguredGameContent("foodKitchen")}
                todayMenuEntries={todayMenuEntries}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onBackToHome={() => setActiveChildPanel("home")}
                onComplete={(pickedItems, detail) =>
                  logMiniGameCompletion("foodKitchen", "泉州小厨师章", pickedItems, detail)
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "food-broadcast" ? (
            <div id="food-broadcast" className="xl:col-span-2">
              <FoodKitchenGame
                mode="broadcast"
                contentConfig={getConfiguredGameContent("foodReporter")}
                todayMenuEntries={todayMenuEntries}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onBackToHome={() => setActiveChildPanel("home")}
                onComplete={(pickedItems, detail) =>
                  logMiniGameCompletion("foodReporter", "小小闽食播报章", pickedItems, detail)
                }
              />
            </div>
            ) : null}
            {activeChildPanel === "food-train" ? (
            <div id="food-train" className="xl:col-span-2">
              <div>
                <FoodTrainGame
                  contentConfig={getConfiguredGameContent("foodTrain")}
                  onSpeak={(text) => {
                    void startSpeechPlayback(text);
                  }}
                  onComplete={(pickedItems) =>
                    logMiniGameCompletion("foodTrain", "闽食小勇士章", pickedItems)
                  }
                />
              </div>
            </div>
            ) : null}
            {activeChildPanel === "food-guess" ? (
            <div id="food-guess" className="xl:col-span-2">
              <FoodGuessGame
                contentConfig={getConfiguredGameContent("foodGuess")}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onComplete={(pickedItems) =>
                  logMiniGameCompletion("foodGuess", "食材发现章", pickedItems)
                }
              />
            </div>
            ) : null}
          </>
        )}
      </section>

        </div>
        {selectedChild ? (
        <aside className="order-first lg:order-last lg:sticky lg:top-6 lg:w-[300px]">
          <SectionDirectory
            eyebrow="幼儿端目录"
            title={themeId === "food" ? "闽食成长岛" : "幼习宝"}
            items={activeChildDirectoryItems}
            variant="sidebar"
            activeHref={activeChildPanelHref}
            onItemClick={openChildDirectoryItem}
          />
        </aside>
        ) : null}
      </div>
    </div>
  );
}
