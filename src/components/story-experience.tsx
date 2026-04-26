"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import { formatChildLabel } from "@/lib/child-identity";
import {
  defaultGameContentConfigs,
  gameContentConfigStorageKey,
  getGameContentConfig,
  parseGameContentConfigs,
  type EditableGameContent,
} from "@/lib/game-content-config";
import {
  parseVideoLibrary,
  videoLibraryStorageKey,
  type TeacherVideoResource,
} from "@/lib/video-library";
import {
  childRosterStorageKey,
  countUniqueBadges,
  createEmptyGrowthArchive,
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
} from "@/lib/growth-archive";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  foodBadgeCards,
  foodPreferenceReasons,
  habitSkillCards,
  mealTrayOptions,
  mealPhotoChecklist,
  minnanFoodClues,
  minnanFoodObserveSteps,
  peerEncouragementPrompts,
  rewardStickerCards,
  storyMissionMap,
  themeVideoCards,
  themes,
  washSteps,
  type ThemeId,
} from "@/lib/site-data";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoryApiResponse = {
  reply?: string;
  choices?: string[];
  badge?: string;
  templateBadge?: string;
  badgeKind?: string;
  source?: string;
  mode?: string;
  awardBadge?: boolean;
  fallbackUsed?: boolean;
  error?: string;
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

const initialWashOrder = ["抹上泡泡", "擦干小手", "打湿小手", "冲洗干净", "搓搓手心手背"];
const storyStateStorageKey = "tongqu-growth-web-story-state";
const storyInputMaxLength = 120;
const miniGameThemeMap: Record<MiniGameKey, ThemeId> = {
  washSteps: "habit",
  queue: "habit",
  habitJudge: "habit",
  kindWords: "food",
  foodObserve: "food",
  foodClue: "food",
  foodPreference: "food",
  peerEncourage: "food",
  mealTray: "food",
};
const minnanTasteSteps = "逛泉州美食摊、找食材卡、听小故事、说出一个发现";

const washStepVisuals: Record<string, { icon: string; cue: string }> = {
  打湿小手: {
    icon: "💧",
    cue: "先让小手碰到清水。",
  },
  抹上泡泡: {
    icon: "🫧",
    cue: "挤一点洗手液，搓出泡泡。",
  },
  搓搓手心手背: {
    icon: "👐",
    cue: "手心、手背、指缝都要搓一搓。",
  },
  冲洗干净: {
    icon: "🚰",
    cue: "用清水把泡泡冲干净。",
  },
  擦干小手: {
    icon: "🧻",
    cue: "最后用小毛巾把手擦干。",
  },
};

const habitRoutineScenarios = [
  {
    title: "户外回来有点口渴",
    icon: "🥤",
    prompt: "小水杯在桌上，下一步怎么做？",
    correct: "坐好慢慢喝水",
    options: [
      { label: "坐好慢慢喝水", icon: "🥤", cue: "一口一口喝，喝完放回杯架。" },
      { label: "拿着水杯跑", icon: "🏃", cue: "跑的时候拿水杯容易洒出来。" },
      { label: "一直不喝水", icon: "😶", cue: "身体需要水，先喝几口更舒服。" },
    ],
  },
  {
    title: "玩具散在垫子上",
    icon: "🧺",
    prompt: "故事时间快到了，玩具应该去哪里？",
    correct: "按标记送回家",
    options: [
      { label: "按标记送回家", icon: "🧺", cue: "积木回积木盒，图书回书架。" },
      { label: "放在地上不管", icon: "🧩", cue: "地上有玩具，别人容易踩到。" },
      { label: "藏到椅子下面", icon: "🪑", cue: "藏起来老师和同伴都找不到。" },
    ],
  },
  {
    title: "准备去操场",
    icon: "🚩",
    prompt: "小队已经站好了，你要怎么跟队伍？",
    correct: "跟着队伍慢慢走",
    options: [
      { label: "跟着队伍慢慢走", icon: "🚩", cue: "一个跟着一个，保持小距离。" },
      { label: "挤到最前面", icon: "↗️", cue: "挤来挤去容易碰到同伴。" },
      { label: "边走边追跑", icon: "💨", cue: "排队时追跑不安全。" },
    ],
  },
  {
    title: "想上厕所",
    icon: "🚻",
    prompt: "身体发出提醒了，应该怎么做？",
    correct: "告诉老师再去整理",
    options: [
      { label: "告诉老师再去整理", icon: "🚻", cue: "先告诉老师，回来记得洗手。" },
      { label: "一直忍着不说", icon: "😣", cue: "身体不舒服要及时告诉老师。" },
      { label: "跑出去不告诉人", icon: "🚪", cue: "老师不知道你在哪里会担心。" },
    ],
  },
];

const habitJudgeCards = [
  {
    title: "饭前先洗手",
    icon: "🧼",
    scene: "小朋友准备吃点心前，先走到洗手池洗手。",
    isCorrect: true,
    habit: "行为习惯",
    cue: "饭前洗手能把小手变干净，是正确做法。",
  },
  {
    title: "拿着水杯追跑",
    icon: "🥤",
    scene: "小朋友一边拿着水杯，一边在教室里追跑。",
    isCorrect: false,
    habit: "安全知识",
    cue: "拿着水杯追跑容易摔倒或洒水，要坐好慢慢喝。",
  },
  {
    title: "玩具按标记送回家",
    icon: "🧺",
    scene: "游戏结束后，把积木放回积木盒，把图书放回书架。",
    isCorrect: true,
    habit: "行为习惯",
    cue: "玩具按标记送回家，教室更整齐，也更安全。",
  },
  {
    title: "排队时推同伴",
    icon: "🚩",
    scene: "去操场时，有小朋友用手推前面的同伴。",
    isCorrect: false,
    habit: "安全知识",
    cue: "排队时推同伴不安全，要一个跟着一个慢慢走。",
  },
  {
    title: "想上厕所告诉老师",
    icon: "🚻",
    scene: "身体想上厕所时，先告诉老师，再去整理，回来洗手。",
    isCorrect: true,
    habit: "行为习惯",
    cue: "及时告诉老师，回来洗手，是照顾身体的好习惯。",
  },
];

function getThemeReadyStatus(themeId: ThemeId) {
  return themeId === "food"
    ? "闽食成长岛准备好了：今天像逛泉州美食小岛一样，认识名字、食材和小故事。"
    : `${themes[themeId].label}准备好了。`;
}

function formatFoodList(items: string[]) {
  return items.length > 0 ? items.join("、") : "泉州海蛎煎、面线糊和润饼菜";
}

function buildMealNutritionSpeech({
  label,
  nutrient,
  benefit,
  tryTip,
}: {
  label: string;
  nutrient: string;
  benefit: string;
  tryTip: string;
}) {
  return `这是${label}，里面有${nutrient}。${benefit}${tryTip}多认识一种食物，多尝试一小口，就会更勇敢。`;
}

function buildMiniGameCompletionCopy(
  gameKey: MiniGameKey,
  badgeName: string,
  pickedItems: string[] = [],
  contentConfig?: EditableGameContent,
) {
  const configuredTitle = contentConfig?.title.trim();
  const configuredReminder = contentConfig?.reminderText.trim();

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
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "看图判断做法"}`,
      status: configuredReminder || "看图判断完成啦：你能分清哪些做法正确，哪些做法需要换成更安全的方式。",
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

  if (gameKey === "foodPreference") {
    const pickedText = pickedItems.length > 0 ? pickedItems.join("、") : "今天都愿意试一点";

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || pickedText}`,
      status: configuredReminder
        ? `${configuredReminder} 本次记录：${pickedText}。`
        : `美食认识观察卡完成：${pickedText}。老师辅助页会保留这条观察记录。`,
    };
  }

  if (gameKey === "peerEncourage") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "陪同伴认识新美食"}`,
      status: configuredReminder || "你陪同伴认识了新美食：先看名字和样子，再慢慢靠近。",
    };
  }

  if (gameKey === "mealTray") {
    const pickedText = formatFoodList(pickedItems);

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || pickedText}`,
      status: configuredReminder
        ? `${configuredReminder} 本次餐盘：${pickedText}。`
        : `午餐小餐盘搭好啦：${pickedText}，认识了更多泉州美食和营养。`,
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
    return `${configuredTitle || "小手清洁任务"}已经记录过啦，可以继续听提示、按图卡练习洗手顺序。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "queue") {
    return `${configuredTitle || "一日好习惯路线"}已经记录过啦，可以继续练习喝水、整理、排队和如厕选择。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "habitJudge") {
    return `${configuredTitle || "看图判断做法"}已经记录过啦，可以继续练习分辨正确习惯和安全做法。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "kindWords") {
    return "闽食探索已经记录过啦，可以继续练习认名字、找食材、说发现。";
  }

  if (gameKey === "foodObserve") {
    return `${configuredTitle || "泉州美食摊位寻宝"}已经记录过啦，可以继续听线索、找摊位、认食材和听小故事。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodClue") {
    return "闽食摊位寻宝已经记录过啦，可以继续认一认这些泉州闽南食物。";
  }

  if (gameKey === "peerEncourage") {
    return `${configuredTitle || "陪同伴认识新美食"}已经记录过啦，可以继续把认识美食的小方法送给小伙伴。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodPreference") {
    return `${configuredTitle || "美食认识观察卡"}已经记录过啦，可以继续换一种食物说说今天的感受。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "mealTray") {
    return `${configuredTitle || "午餐小餐盘"}已经记录过啦，可以换一种泉州闽南食物搭配继续玩。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  return "这个小游戏已经记录过啦，可以继续练习，但不会重复增加成长次数。";
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
  tone?: "slate" | "teal" | "cyan" | "rose" | "orange" | "amber" | "emerald";
}) {
  const toneClassMap = {
    slate: "bg-slate-900 text-white hover:bg-slate-800",
    teal: "bg-teal-700 text-white hover:bg-teal-800",
    cyan: "bg-cyan-700 text-white hover:bg-cyan-800",
    rose: "bg-rose-600 text-white hover:bg-rose-700",
    orange: "bg-orange-700 text-white hover:bg-orange-800",
    amber: "bg-amber-100 text-amber-950 hover:bg-amber-200",
    emerald: "bg-emerald-700 text-white hover:bg-emerald-800",
  };

  if (!onSpeak || !text.trim()) {
    return null;
  }

  return (
    <button
      className={`rounded-full px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${toneClassMap[tone]}`}
      onClick={() => onSpeak(text)}
      type="button"
    >
      🔊 {label}
    </button>
  );
}

function getStoryOptionVisual(text: string, themeId: ThemeId) {
  if (/海蛎|海蛎煎/.test(text)) {
    return {
      icon: "🦪",
      title: text,
      description: "泉州海蛎煎，先看金黄边，再听海味故事。",
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

  if (/洗手|手/.test(text)) {
    return {
      icon: "💧",
      title: text,
      description: "跟着泡泡和清水，把小手洗干净。",
    };
  }

  if (/排队|队/.test(text)) {
    return {
      icon: "🚩",
      title: text,
      description: "跟着小队长，一个一个排整齐。",
    };
  }

  if (/喝水|水杯/.test(text)) {
    return {
      icon: "🥤",
      title: text,
      description: "听身体提醒，一口一口慢慢喝水。",
    };
  }

  if (/玩具|整理|送回家/.test(text)) {
    return {
      icon: "🧺",
      title: text,
      description: "把玩具、图书和文具送回自己的位置。",
    };
  }

  return {
    icon: themeId === "food" ? "🍽️" : "✨",
    title: text,
    description: themeId === "food" ? "继续闽食故事，听伙伴怎么说。" : "继续成长故事，完成一个小任务。",
  };
}

function getMissionOptionVisual(text: string, themeId: ThemeId) {
  if (/探味|寻宝|摊位/.test(text)) {
    return {
      icon: "🧭",
      description: "听线索、找摊位、认食材。",
    };
  }

  if (/还在认识|偏好|饮食|美食认识/.test(text)) {
    return {
      icon: "📝",
      description: "记录孩子今天还在认识的食物。",
    };
  }

  if (/同伴|鼓励|陪/.test(text)) {
    return {
      icon: "🤝",
      description: "陪小伙伴一起认识新美食。",
    };
  }

  if (/餐盘|午餐/.test(text)) {
    return {
      icon: "🍱",
      description: "认识食物名称和营养。",
    };
  }

  if (/洗手/.test(text)) {
    return {
      icon: "💧",
      description: "看泡泡图卡，听提示，按顺序完成小手清洁。",
    };
  }

  if (/判断|对不对|正确/.test(text)) {
    return {
      icon: "✅",
      description: "看图判断这个做法是否正确，练习行为习惯和安全知识。",
    };
  }

  if (/排队|路线|习惯/.test(text)) {
    return {
      icon: "🚩",
      description: "遇到喝水、整理、排队和如厕情境，选出合适做法。",
    };
  }

  return {
    icon: themeId === "food" ? "🍽️" : "✨",
    description: themeId === "food" ? "继续闽食探索。" : "继续习惯练习。",
  };
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
    return `${review.message ?? "照片已记录，餐盘小发现生成啦。"}${sizeText}`;
  }

  return `照片已记录，这次先做拍照练习，请老师或家长一起看一看。${sizeText}`;
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
    return `可以对孩子说：“你把餐盘观察得很认真，${review.plateState}也被记录下来啦。”`;
  }

  return "可以对孩子说：“谢谢你愿意一起看一看、说一说，尝试本身就很勇敢。”";
}

function isBlockedPlaybackMessage(message: string) {
  const lower = message.toLowerCase();

  return blockedPlaybackPatterns.some((pattern) => lower.includes(pattern));
}

function normalizeSpeechPlaybackError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

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
  return isBlockedPlaybackMessage(status) ? "准备出发啦。" : status;
}

function isValidStoryReply(reply: unknown): reply is string {
  return typeof reply === "string" && reply.trim().length > 0;
}

function isReliableStoryBadgeResponse(data: StoryApiResponse) {
  if (data.fallbackUsed || data.error) {
    return false;
  }

  if (data.source === "fallback" || data.source === "demo" || data.mode === "fallback") {
    return false;
  }

  return data.awardBadge === true;
}

function HabitVisualBoard() {
  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-700">行为习惯与安全知识</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">幼习宝勋章图卡</h3>
        </div>
        <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          行为 + 安全
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {habitSkillCards.map((item) => (
          <article
            key={item.title}
            className="story-card rounded-[1.7rem] bg-[linear-gradient(180deg,#fffdf7_0%,#f5fffe_100%)] p-4 shadow-sm"
          >
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.1rem] text-2xl ${item.tone}`}
            >
              {item.icon}
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.hint}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          { title: "行为习惯掌握章", icon: "🧼", text: "洗手、喝水、整理、如厕等一日生活习惯。" },
          { title: "生活安全实践章", icon: "🚩", text: "排队、慢走、收纳、照顾身体的安全做法。" },
          { title: "安全知识判断章", icon: "✅", text: "看图判断做法是否正确，知道哪里需要调整。" },
        ].map((item) => (
          <div key={item.title} className="rounded-[1.5rem] bg-emerald-50 p-4">
            <p className="text-3xl">{item.icon}</p>
            <p className="mt-2 font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HabitMissionPoster({ badges, missions }: { badges: string[]; missions: string[] }) {
  const hasBadges = badges.length > 0;

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#dff8f7_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <p className="text-sm font-semibold text-teal-700">今日任务海报</p>
      <h3 className="mt-1 text-2xl font-semibold text-slate-900">今日习惯闯关</h3>
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
            <p className="text-sm font-semibold text-amber-800">上课图示</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              先坐好，再看老师，再举小手，最后认真听任务。
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-800">喝水打卡</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              一口一口慢慢喝，喝完记得放回小水杯。
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
            完成小游戏后，第一枚勋章会出现在这里
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
                {hasBadges ? "已经记录在成长册里。" : "完成对应任务后会点亮。"}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

function FoodBadgeWall() {
  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-rose-700">闽食小勋章</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">闽食探索勋章墙</h3>
        </div>
        <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
          带回家也能玩
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {foodBadgeCards.map((item) => (
          <article
            key={item.title}
            className="story-card rounded-[1.8rem] bg-[linear-gradient(180deg,#fff9ec_0%,#ffffff_100%)] p-5 shadow-sm"
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
          </article>
        ))}
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
                视频资源由老师辅助页上传或登记
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
                    : "文字生成视频需求待接入真实生成服务"}
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
  onSelectChild,
}: {
  childRoster: ChildProfile[];
  selectedChildId: string;
  onSelectChild: (child: ChildProfile) => void;
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
          href="/"
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
        >
          回去选小名牌
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {childRoster.length > 0 ? (
          childRoster.slice(0, 18).map((child) => (
            <button
              key={child.id}
              onClick={() => onSelectChild(child)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                child.id === selectedChildId
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {formatChildLabel(child)}
            </button>
          ))
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
                适合记录孩子餐盘观察、闽食制作或闽食宣传打卡。
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
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
            拍照时尽量避开孩子正脸、姓名牌和班级牌，只记录餐盘或作品。
          </p>
        </div>

        <div className="rounded-[1.8rem] bg-white/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">餐盘记录</p>
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
                拍照任务已经完成；这次只给体验贴纸，不当作真实成长勋章。
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
                  {isAiMealPhotoReview(reviewResult) ? "发现说明" : "记录类型"}
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
                {reviewResult.highlightTags.map((item) => (
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
                  <p className="text-xs font-semibold text-slate-500">拍照记录</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{item}</p>
                </div>
              ))}
            </div>
          ) : reviewResult?.scoreCards && reviewResult.scoreCards.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {reviewResult.scoreCards.map((item) => (
                <div
                  key={item.label}
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
                {reviewResult.guessedFoods.map((item) => (
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
                    已完成记录
                  </span>
                ) : null}
              </div>
              {!canAwardReviewSticker ? (
                <p className="mt-2 text-xs leading-6 font-semibold text-slate-500">
                  这次给孩子正向完成反馈，只记录观察贴纸，不写入真实成长勋章。
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewResult.stickers.map((item) => (
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
            <div className="mt-5 rounded-[1.5rem] bg-slate-900 px-4 py-4 text-white">
              <p className="text-sm font-semibold text-white/70">下一步挑战</p>
              <p className="mt-2 text-sm leading-7 text-white/90">{reviewResult.nextMission}</p>
            </div>
          ) : null}

          {reviewResult ? (
            <div className="mt-5 rounded-[1.5rem] bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-800">下一句鼓励话术</p>
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

function ShuffleStepsGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: () => void;
  onSpeak?: SpeakHandler;
}) {
  const [shuffled, setShuffled] = useState(initialWashOrder);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("先看水滴图卡，找到第一步：打湿小手。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = selected.length === washSteps.length;
  const expectedStep = washSteps[selected.length];
  const introText =
    contentConfig?.childGoal.trim() ||
    "小手清洁任务开始啦。请看图卡，按顺序点：打湿小手、抹上泡泡、搓搓手心手背、冲洗干净、擦干小手。";

  function handlePick(step: string) {
    if (selected.includes(step) || completed) {
      return;
    }

    if (step !== expectedStep) {
      const message = `这一步还没到，先找“${expectedStep}”。${washStepVisuals[expectedStep]?.cue ?? ""}`;
      setMistakeCount((current) => current + 1);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextSelected = [...selected, step];
    const allDone = nextSelected.length === washSteps.length;
    const message =
      allDone
        ? "小手清洁顺序完成啦。打湿、泡泡、搓洗、冲净、擦干都做到了。"
        : `做得对，${washStepVisuals[step]?.cue ?? ""} 下一步找“${washSteps[nextSelected.length]}”。`;
    setSelected(nextSelected);
    setFeedback(message);
    onSpeak?.(message);

    if (allDone && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }

  function resetGame() {
    setShuffled(initialWashOrder);
    setSelected([]);
    setFeedback("先看水滴图卡，找到第一步：打湿小手。");
    setMistakeCount(0);
    completionReportedRef.current = false;
    onSpeak?.("小手清洁任务重新开始。先找到第一步，打湿小手。");
  }

  const isCorrect = completed && selected.every((step, index) => step === washSteps[index]);

  useEffect(() => {
    if (completed && isCorrect && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [completed, isCorrect, onComplete]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">互动小游戏 1</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "小手清洁任务站"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-200"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="teal" />
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-teal-50 p-4">
        <div className="flex flex-wrap gap-2">
          {washSteps.map((step, index) => {
            const done = selected[index] === step;
            const current = index === selected.length && !completed;
            const visual = washStepVisuals[step];

            return (
              <div
                key={step}
                className={`min-w-28 rounded-[1.2rem] px-3 py-3 text-center text-sm font-semibold ${
                  done
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-white text-teal-800 shadow-sm"
                      : "bg-white/60 text-slate-400"
                }`}
              >
                <span className="block text-2xl">{visual.icon}</span>
                <span className="block text-xs opacity-75">第 {index + 1} 步</span>
                {done ? step : current ? "正在找" : "等待"}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-teal-900">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听提示" tone="teal" />
        </div>
        {mistakeCount > 0 ? (
          <p className="mt-2 text-xs font-semibold text-amber-800">已经纠正 {mistakeCount} 次。</p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {shuffled.map((step) => {
          const visual = washStepVisuals[step];

          return (
            <button
              key={step}
              onClick={() => handlePick(step)}
              disabled={selected.includes(step) || completed}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                selected.includes(step)
                  ? "bg-slate-200 text-slate-400"
                  : "bg-amber-100 text-amber-900 hover:-translate-y-0.5 hover:bg-amber-200"
              }`}
            >
              <span className="text-xl">{visual.icon}</span>
              {step}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">你的顺序</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.length === 0 ? (
            <span className="text-sm text-slate-400">还没开始，点上面的步骤按钮。</span>
          ) : (
            selected.map((step, index) => (
              <span
                key={`${step}-${index}`}
                className="rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
              >
                {index + 1}. {washStepVisuals[step]?.icon} {step}
              </span>
            ))
          )}
        </div>
      </div>

      {completed ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
          }`}
        >
          {isCorrect ? "答对啦，你拿到了洗手闪亮章。" : "这次差一点点，重新试试会更棒。"}
        </p>
      ) : null}
    </div>
  );
}

function QueueGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: () => void;
  onSpeak?: SpeakHandler;
}) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [completedScenarios, setCompletedScenarios] = useState<string[]>([]);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [feedback, setFeedback] = useState("先听情境，再选一个适合的好习惯做法。");
  const completionReportedRef = useRef(false);
  const completed = completedScenarios.length === habitRoutineScenarios.length;
  const currentScenario = habitRoutineScenarios[scenarioIndex];
  const introText =
    contentConfig?.childGoal.trim() ||
    "一日好习惯路线开始啦。请根据情境选择合适做法：喝水要慢慢喝，整理要送回家，排队要跟好队伍，如厕要告诉老师并洗手。";

  function handleChoice(option: { label: string; icon: string; cue: string }) {
    if (completed) {
      return;
    }

    if (option.label !== currentScenario.correct) {
      const message = `这次先不选“${option.label}”。${option.cue} 再看看：${currentScenario.prompt}`;
      setMistakeCount((current) => current + 1);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextCompleted = [...completedScenarios, currentScenario.title];
    const allDone = nextCompleted.length === habitRoutineScenarios.length;
    const message = allDone
      ? "一日好习惯路线完成啦。喝水、整理、排队、如厕，你都能选出合适做法。"
      : `选对啦，${option.cue} 下一站：${habitRoutineScenarios[scenarioIndex + 1].title}。`;
    setCompletedScenarios(nextCompleted);
    setFeedback(message);
    onSpeak?.(message);

    if (allDone && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }

    if (!allDone) {
      setScenarioIndex((current) => current + 1);
    }
  }

  function resetGame() {
    setScenarioIndex(0);
    setCompletedScenarios([]);
    setMistakeCount(0);
    setFeedback("先听情境，再选一个适合的好习惯做法。");
    completionReportedRef.current = false;
    onSpeak?.("一日好习惯路线重新开始。先听第一个情境，再选合适做法。");
  }

  useEffect(() => {
    if (completed && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [completed, onComplete]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">互动小游戏 2</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "一日好习惯路线"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-200"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="cyan" />
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-cyan-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-cyan-700">第 {Math.min(scenarioIndex + 1, habitRoutineScenarios.length)} 站</p>
            <h4 className="mt-1 text-xl font-semibold text-slate-900">
              {currentScenario.icon} {currentScenario.title}
            </h4>
            <p className="mt-2 text-sm leading-7 font-semibold text-cyan-950">
              {completed ? "路线全部完成啦。" : currentScenario.prompt}
            </p>
          </div>
          <SpeechCueButton
            text={completed ? feedback : `${currentScenario.title}。${currentScenario.prompt}`}
            onSpeak={onSpeak}
            label="听情境"
            tone="cyan"
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {currentScenario.options.map((option) => (
            <button
              key={option.label}
              onClick={() => handleChoice(option)}
              disabled={completed}
              className="rounded-[1.4rem] bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <span className="block text-3xl">{option.icon}</span>
              <span className="mt-3 block text-sm font-semibold text-slate-900">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{option.cue}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-cyan-900">
            已完成 {completedScenarios.length}/{habitRoutineScenarios.length} 站，纠正 {mistakeCount} 次。
          </p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="cyan" />
        </div>
        <p className="mt-2 text-sm font-semibold text-cyan-800">{feedback}</p>
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">路线进度</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {habitRoutineScenarios.map((scenario) => {
            const done = completedScenarios.includes(scenario.title);

            return (
              <span
                key={scenario.title}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  done ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500"
                }`}
              >
                {done ? "✓ " : ""}
                {scenario.icon} {scenario.title}
              </span>
            );
          })}
        </div>
      </div>

      {completed ? (
        <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
          做得真稳，你已经是一日好习惯小队长啦。
        </p>
      ) : null}
    </div>
  );
}

function HabitJudgeGame({
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
  const [feedback, setFeedback] = useState("先看图片和文字，再判断这个做法对不对。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = answers.length === habitJudgeCards.length;
  const currentCard = habitJudgeCards[currentIndex];
  const introText =
    contentConfig?.childGoal.trim() ||
    "看图判断做法对不对。看到正确做法点“正确”，看到不安全或不合适的做法点“不正确”。";

  function answerCard(answer: boolean) {
    if (completed) {
      return;
    }

    const right = answer === currentCard.isCorrect;

    if (!right) {
      const message = `再想一想。${currentCard.cue}`;
      setMistakeCount((current) => current + 1);
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextAnswers = [...answers, `${currentCard.title}:${answer ? "正确" : "不正确"}`];
    const allDone = nextAnswers.length === habitJudgeCards.length;
    const message = allDone
      ? "看图判断全部完成啦。你能分清正确习惯和安全做法。"
      : `判断正确。${currentCard.cue} 下一张图：${habitJudgeCards[currentIndex + 1].title}。`;
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
    setFeedback("先看图片和文字，再判断这个做法对不对。");
    completionReportedRef.current = false;
    onSpeak?.("看图判断重新开始。先看第一张图，再判断这个做法对不对。");
  }

  useEffect(() => {
    if (completed && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(answers);
    }
  }, [answers, completed, onComplete]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">互动小游戏 3</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "看图判断做法对不对"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="emerald" />
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-emerald-50 p-4">
        <div className="rounded-[1.5rem] bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-emerald-700">
                第 {Math.min(currentIndex + 1, habitJudgeCards.length)} 张 · {currentCard.habit}
              </p>
              <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-amber-100 text-5xl">
                {currentCard.icon}
              </div>
              <h4 className="mt-4 text-xl font-semibold text-slate-900">{currentCard.title}</h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">{currentCard.scene}</p>
            </div>
            <SpeechCueButton
              text={`${currentCard.title}。${currentCard.scene} 请判断这个做法对不对。`}
              onSpeak={onSpeak}
              label="听图片"
              tone="emerald"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => answerCard(true)}
              disabled={completed}
              className="rounded-[1.4rem] bg-emerald-100 px-5 py-4 text-left font-semibold text-emerald-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              ✅ 正确
              <span className="mt-1 block text-xs leading-5 text-emerald-800">这个做法可以继续保持。</span>
            </button>
            <button
              onClick={() => answerCard(false)}
              disabled={completed}
              className="rounded-[1.4rem] bg-rose-100 px-5 py-4 text-left font-semibold text-rose-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              ✋ 不正确
              <span className="mt-1 block text-xs leading-5 text-rose-800">这个做法需要换成更安全的方式。</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            已判断 {answers.length}/{habitJudgeCards.length} 张，纠正 {mistakeCount} 次。
          </p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="emerald" />
        </div>
        <p className="mt-2 text-sm font-semibold text-emerald-800">{feedback}</p>
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">判断记录</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {habitJudgeCards.map((card) => {
            const done = answers.some((answer) => answer.startsWith(`${card.title}:`));

            return (
              <span
                key={card.title}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  done ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500"
                }`}
              >
                {done ? "✓ " : ""}
                {card.icon} {card.title}
              </span>
            );
          })}
        </div>
      </div>

      {completed ? (
        <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
          你已经点亮行为习惯和安全知识判断能力啦。
        </p>
      ) : null}
    </div>
  );
}

function FoodTreasureQuestGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: () => void;
  onSpeak?: SpeakHandler;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matched, setMatched] = useState<string[]>([]);
  const [selectedFood, setSelectedFood] = useState("");
  const [collectedIngredients, setCollectedIngredients] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("先听线索，像逛小岛一样找到第一个泉州美食摊位。");
  const [mistakeCount, setMistakeCount] = useState(0);
  const completionReportedRef = useRef(false);
  const completed = matched.length === minnanFoodClues.length;
  const currentFood = minnanFoodClues[currentIndex];
  const currentStep = minnanFoodObserveSteps[currentIndex] ?? minnanFoodObserveSteps.at(-1);
  const ingredientTotal = currentFood?.ingredients.length ?? 0;
  const ingredientsComplete = ingredientTotal > 0 && collectedIngredients.length === ingredientTotal;
  const introText =
    contentConfig?.childGoal.trim() ||
    "像逛泉州美食小岛一样，先认名字、找食材、听小故事，再选一个愿意靠近的小步骤。";
  const clueText = currentFood
    ? `第 ${Math.min(currentIndex + 1, minnanFoodClues.length)} 站，${currentFood.stall}。线索：${currentFood.clue}${currentFood.pictureHint}`
    : "摊位寻宝完成啦。";

  function handlePickFood(label: string) {
    if (completed || selectedFood || matched.includes(label) || !currentFood) {
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
    const message = `找对啦，这是${currentFood.label}，在${currentFood.stall}。这里有${currentFood.ingredients.join("、")}。先收集食材卡，再听一个小故事。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function handlePickIngredient(ingredient: string) {
    if (!selectedFood || collectedIngredients.includes(ingredient) || !currentFood) {
      return;
    }

    const nextIngredients = [...collectedIngredients, ingredient];
    setCollectedIngredients(nextIngredients);
    const message =
      nextIngredients.length === ingredientTotal
        ? `${ingredient}食材卡收好啦。${currentFood.label}的食材卡集齐了，可以听故事、选小步，再去下一摊。`
        : `${ingredient}食材卡收好啦，继续找下一张食材卡。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function goNextStall() {
    if (!currentFood || !selectedFood) {
      return;
    }

    if (!ingredientsComplete) {
      const message = "先把这个摊位的食材卡收集完，再去下一摊。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextMatched = [...matched, currentFood.label];
    setMatched(nextMatched);
    setSelectedFood("");
    setCollectedIngredients([]);

    if (nextMatched.length === minnanFoodClues.length) {
      const message = "泉州美食摊位寻宝完成啦。你认识了名字、食材、小故事，也选了靠近美食的小步骤。";
      setFeedback(message);
      onSpeak?.(message);
      if (!completionReportedRef.current) {
        completionReportedRef.current = true;
        onComplete?.();
      }
      return;
    }

    const nextFood = minnanFoodClues[currentIndex + 1];
    setCurrentIndex((index) => Math.min(index + 1, minnanFoodClues.length - 1));
    const message = `去下一摊。请听线索：${nextFood.stall}，${nextFood.clue}${nextFood.pictureHint}`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function resetGame() {
    setCurrentIndex(0);
    setMatched([]);
    setSelectedFood("");
    setCollectedIngredients([]);
    setMistakeCount(0);
    setFeedback("先听线索，像逛小岛一样找到第一个泉州美食摊位。");
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (completed && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [completed, onComplete]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">互动小游戏 1</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "泉州美食摊位寻宝"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame();
            onSpeak?.("泉州美食摊位寻宝重新开始。先听线索，找到第一个美食摊位。");
          }}
          className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-200"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="teal" />
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
          {minnanFoodClues.map((food, index) => {
            const done = matched.includes(food.label);
            const current = index === currentIndex && !completed;

            return (
              <div
                key={food.label}
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
        {minnanFoodClues.map((food) => {
          const done = matched.includes(food.label);
          const disabled = done || completed || Boolean(selectedFood);

          return (
          <button
            key={food.label}
            onClick={() => handlePickFood(food.label)}
            disabled={disabled}
            className={`rounded-[1.5rem] px-4 py-4 text-left text-sm font-semibold transition ${
              done
                ? "bg-emerald-100 text-emerald-800"
                : disabled
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-amber-100 text-amber-950 hover:-translate-y-0.5 hover:bg-amber-200"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-white text-3xl shadow-sm">
                {food.icon}
              </span>
              <span>
                <span className="block text-base">{food.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  {done ? "这个摊位食材已认识" : food.stall}
                </span>
              </span>
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
              text={`${currentFood.label}的食材有${currentFood.ingredients.join("、")}。${currentFood.ingredientIntro}样子线索：${currentFood.colorShape}。小故事：${currentFood.cultureStory}${currentStep ? `探味动作是${currentStep.label}，${currentStep.cue}` : ""}`}
              onSpeak={onSpeak}
              label="听食材"
              tone="teal"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {currentFood.ingredients.map((ingredient) => {
              const collected = collectedIngredients.includes(ingredient);

              return (
                <button
                  key={ingredient}
                  onClick={() => handlePickIngredient(ingredient)}
                  disabled={collected}
                  className={`rounded-[1.3rem] px-4 py-3 text-left text-sm font-semibold transition ${
                    collected
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-teal-50 text-slate-800 hover:-translate-y-0.5 hover:bg-teal-100"
                  }`}
                >
                  {collected ? "✓" : "☆"} 食材卡：{ingredient}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-[1.4rem] bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">可以选择的靠近小步</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentFood.approachSteps.map((step) => (
                <span key={step} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                  {step}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={goNextStall}
            className="mt-4 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!ingredientsComplete}
            type="button"
          >
            {currentIndex + 1 === minnanFoodClues.length ? "完成探味寻宝" : "去下一摊"}
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

function FoodPreferenceGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (record: FoodPreferenceRecord) => void;
  onSpeak?: SpeakHandler;
}) {
  const [selectedFood, setSelectedFood] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [feedback, setFeedback] = useState("选一种今天还在认识的泉州美食，再说说可能的原因。");
  const completionReportedRef = useRef(false);
  const selectedFoodInfo = minnanFoodClues.find((food) => food.label === selectedFood);
  const selectedReasonInfo = foodPreferenceReasons.find((reason) => reason.label === selectedReason);
  const completed = Boolean(selectedFood && selectedReason);
  const introText =
    contentConfig?.childGoal.trim() ||
    "这不是给孩子贴标签，只记录今天还在认识的食物，帮助老师和家长温和陪伴。";
  const foodRoleIntroText = selectedFoodInfo
    ? `我是${selectedFoodInfo.label}。我的身体里有${selectedFoodInfo.ingredients.join("、")}。${selectedFoodInfo.ingredientIntro}你今天还在认识我也没关系，先看见名字和食材就很好。`
    : "";

  function handleFoodPick(label: string) {
    const food = minnanFoodClues.find((item) => item.label === label);
    setSelectedFood(label);
    setSelectedReason("");
    const message = food
      ? `我是${food.label}。我的身体里有${food.ingredients.join("、")}。${food.ingredientIntro}你今天还在认识我也没关系，先看见名字和食材就很好。`
      : "记录下来：今天有一种食物还在慢慢认识。";
    setFeedback(message);
    onSpeak?.(message);
    completionReportedRef.current = false;
  }

  function handleReasonPick(label: string) {
    if (!selectedFood) {
      const message = "先选一种今天还在认识的食物。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const reason = foodPreferenceReasons.find((item) => item.label === label);
    const food = minnanFoodClues.find((item) => item.label === selectedFood);
    setSelectedReason(label);
    const message =
      food && reason
        ? `谢谢你告诉我：今天可能是${reason.label}。我是${food.label}，我里面有${food.ingredients.join("、")}。${food.ingredientIntro}先认识我，也是一种尝试。`
        : "已经记录原因，先认识这种食物就很好。";
    setFeedback(message);
    onSpeak?.(message);

    if (!completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.({
        recordedAt: new Date().toISOString(),
        foodLabel: selectedFood,
        reasonLabel: label,
        strategy: reason?.strategy ?? "",
        gentleTryTip: food?.gentleTryTip ?? "",
      });
    }
  }

  function resetGame() {
    setSelectedFood("");
    setSelectedReason("");
    setFeedback("选一种今天还在认识的泉州美食，再说说可能的原因。");
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (completed && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.({
        recordedAt: new Date().toISOString(),
        foodLabel: selectedFood,
        reasonLabel: selectedReason,
        strategy: selectedReasonInfo?.strategy ?? "",
        gentleTryTip: selectedFoodInfo?.gentleTryTip ?? "",
      });
    }
  }, [completed, onComplete, selectedFood, selectedFoodInfo, selectedReason, selectedReasonInfo]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">互动小游戏 2</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "美食认识观察卡"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame();
            onSpeak?.("美食认识观察卡重新开始。先选一种今天还在认识的泉州美食。");
          }}
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-200"
        >
          重新记录
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听说明" tone="cyan" />
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-cyan-50 p-4">
        <p className="text-sm font-semibold text-cyan-900">今天哪一种还在认识？</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {minnanFoodClues.map((food) => {
            const selected = selectedFood === food.label;

            return (
              <button
                key={food.label}
                onClick={() => handleFoodPick(food.label)}
                className={`rounded-[1.4rem] px-4 py-4 text-center text-sm font-semibold transition ${
                  selected
                    ? "bg-cyan-700 text-white"
                    : "bg-white text-slate-800 hover:-translate-y-0.5 hover:bg-cyan-100"
                }`}
              >
                <span className="block text-4xl">{food.icon}</span>
                <span className="mt-2 block">{food.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">可能是什么原因？</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {foodPreferenceReasons.map((reason) => {
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
                {reason.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听记录" tone="cyan" />
        </div>
        {selectedFoodInfo ? (
          <div className="mt-4 rounded-[1.3rem] bg-cyan-50 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-800">食物小角色自我介绍</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{foodRoleIntroText}</p>
              </div>
              <SpeechCueButton
                text={foodRoleIntroText}
                onSpeak={onSpeak}
                label="听食材"
                tone="cyan"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedFoodInfo.ingredients.map((ingredient) => (
                <span
                  key={ingredient}
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

function PeerEncouragementGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: () => void;
  onSpeak?: SpeakHandler;
}) {
  const [sent, setSent] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("选一位小伙伴，把认识美食的小方法送给他。");
  const completionReportedRef = useRef(false);
  const completed = sent.length === peerEncouragementPrompts.length;
  const introText =
    contentConfig?.childGoal.trim() ||
    "不判断对错，陪同伴认识新美食：找颜色、找食材、听小故事。";

  function handleSend(peer: string, encouragement: string) {
    if (sent.includes(peer) || completed) {
      return;
    }

    const nextSent = [...sent, peer];
    setSent(nextSent);
    const message =
      nextSent.length === peerEncouragementPrompts.length
        ? "三位小伙伴都收到认识美食的小方法啦。"
        : `你送出了：“${encouragement}”`;
    setFeedback(message);
    onSpeak?.(message);

    if (nextSent.length === peerEncouragementPrompts.length && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }

  function resetGame() {
    setSent([]);
    setFeedback("选一位小伙伴，把认识美食的小方法送给他。");
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (completed && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [completed, onComplete]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-rose-700">互动小游戏 3</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "陪同伴认识新美食"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame();
            onSpeak?.("陪同伴认识新美食重新开始。选一位小伙伴，把认识美食的小方法送给他。");
          }}
          className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-200"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="rose" />
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-rose-50 p-4">
        <p className="text-sm font-semibold text-rose-900">同伴认识墙</p>
        <div className="mt-3 flex min-h-14 flex-wrap gap-2 rounded-[1.3rem] bg-white/80 p-3">
          {sent.length === 0 ? (
            <span className="text-sm text-slate-400">还没有送出认识方法。</span>
          ) : (
            sent.map((peer) => (
              <span
                key={peer}
                className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
              >
                {peer}
              </span>
            ))
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-rose-900">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听鼓励" tone="rose" />
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {peerEncouragementPrompts.map((item) => {
          const done = sent.includes(item.peer);

          return (
            <button
              key={item.peer}
              onClick={() => handleSend(item.peer, item.encouragement)}
              disabled={done || completed}
              className={`rounded-[1.5rem] px-4 py-4 text-left text-sm font-semibold transition ${
                done
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-orange-50 text-slate-800 hover:-translate-y-0.5 hover:bg-orange-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{item.foodIcon} {item.peer}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">
                    “{item.encouragement}”
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        {completed ? "完成啦，点亮同伴认识星。" : `已陪伴 ${sent.length} / 3 位同伴`}
      </p>
    </div>
  );
}

function MealTrayGame({
  contentConfig,
  onComplete,
  onSpeak,
  onSpeakNutrition,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (pickedItems: string[]) => void;
  onSpeak?: SpeakHandler;
  onSpeakNutrition?: (text: string) => void;
}) {
  const [pickedItems, setPickedItems] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("先点一种泉州食物，看看它叫什么、有哪些食材。");
  const completionReportedRef = useRef(false);
  const pickedCount = pickedItems.length;
  const completed = pickedCount === 3;
  const healthyCount = pickedItems.filter((item) =>
    mealTrayOptions.find((option) => option.label === item)?.isHealthy,
  ).length;
  const introText =
    contentConfig?.childGoal.trim() ||
    "点选泉州食物，认识名称、食材和营养；每样都可以先看样子、听故事。";

  function handlePick(item: string) {
    if (pickedItems.includes(item) || completed) {
      return;
    }

    const nextPickedItems = [...pickedItems, item];
    setPickedItems(nextPickedItems);
    const pickedOption = mealTrayOptions.find((option) => option.label === item);
    const message = pickedOption?.isHealthy
      ? `${pickedOption.icon} ${item}：${pickedOption.nutrient}，${pickedOption.benefit}`
      : `${pickedOption?.icon ?? "⭐"} ${item}先认识一下，今天把泉州美食放到餐盘中间。`;
    setFeedback(message);
    onSpeak?.(message);

    const nextHealthyCount = nextPickedItems.filter((pickedItem) =>
      mealTrayOptions.find((option) => option.label === pickedItem)?.isHealthy,
    ).length;

    if (
      nextPickedItems.length === 3 &&
      nextHealthyCount >= 2 &&
      !completionReportedRef.current
    ) {
      completionReportedRef.current = true;
      onComplete?.(nextPickedItems);
    }
  }

  function resetGame() {
    setPickedItems([]);
    setFeedback("先点一种泉州食物，看看它叫什么、有哪些食材。");
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (completed && healthyCount >= 2 && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.(pickedItems);
    }
  }, [completed, healthyCount, onComplete, pickedItems]);

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-700">互动小游戏 4</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "午餐小餐盘"}
          </h3>
        </div>
        <button
          onClick={() => {
            resetGame();
            onSpeak?.("午餐小餐盘重新搭配。先点一种泉州食物，听听它叫什么、有哪些食材。");
          }}
          className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-200"
        >
          重新搭配
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="orange" />
      </div>

      <div className="mt-5 rounded-[1.8rem] bg-orange-50 p-5">
        <p className="text-sm font-semibold text-orange-900">餐盘格子</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((slot) => {
            const item = pickedItems[slot];
            const option = mealTrayOptions.find((entry) => entry.label === item);

            return (
              <div
                key={slot}
                className={`flex min-h-24 items-center justify-center rounded-[1.4rem] border border-dashed px-3 text-center text-sm font-semibold ${
                  item
                    ? option?.isHealthy
                      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                      : "border-amber-200 bg-amber-100 text-amber-900"
                    : "border-orange-200 bg-white/70 text-slate-400"
                }`}
              >
                {item ? (
                  <span>
                    <span className="block text-3xl">{option?.icon ?? "🍽️"}</span>
                    <span className="mt-2 block">{item}</span>
                  </span>
                ) : (
                  `空格 ${slot + 1}`
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-orange-900">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听提示" tone="orange" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {mealTrayOptions.map((item) => {
          const isPicked = pickedItems.includes(item.label);
          const disabled = completed && !isPicked;

          return (
            <button
              key={item.label}
              onClick={() => handlePick(item.label)}
              disabled={disabled}
              className={`rounded-[1.4rem] px-4 py-3 text-left text-sm font-semibold transition ${
                isPicked
                  ? item.isHealthy
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-700"
                  : disabled
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-orange-50 text-slate-700 hover:-translate-y-0.5 hover:bg-orange-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-2xl">{item.icon}</span>
                <span>
                  <span className="block">{item.label}</span>
                  <span className="mt-0.5 block text-xs opacity-75">{item.nutrient}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">你认识的食物</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pickedCount === 0 ? (
            <span className="text-sm text-slate-400">还没有选食物，点上面的食物按钮。</span>
          ) : (
            pickedItems.map((item) => {
              const option = mealTrayOptions.find((entry) => entry.label === item);

              return (
                <span
                  key={item}
                  className="rounded-[1.2rem] bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                >
                  {option?.icon ?? "🍽️"} {item} · {option?.nutrient ?? "认识食物"}
                </span>
              );
            })
          )}
        </div>
      </div>

      {pickedCount > 0 ? (
        <div className="mt-5 grid gap-3">
          {pickedItems.map((item) => {
            const option = mealTrayOptions.find((entry) => entry.label === item);

            if (!option) {
              return null;
            }

            return (
              <div
                key={`${item}-nutrition`}
                className="rounded-[1.4rem] bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"
              >
                <p className="font-semibold text-slate-900">
                  {option.icon} {option.label}：{option.nutrient}
                </p>
                <p className="mt-1">{option.benefit}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-amber-800">{option.tryTip}</p>
                  <button
                    onClick={() => onSpeakNutrition?.(buildMealNutritionSpeech(option))}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    🔊 听营养
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {completed ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            healthyCount >= 2 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {healthyCount >= 2
                ? `今天认识了：${formatFoodList(pickedItems)}。能说出名字、食材和营养，就是很棒的探索。`
                : "今天先认识这些食物也可以。点“重新搭配”，再多选一种泉州美食看看。"}
            </p>
            <SpeechCueButton
              text={
                healthyCount >= 2
                  ? `今天认识了：${formatFoodList(pickedItems)}。每样食物都可以从一小口开始，多尝试就更勇敢。`
                  : "今天先认识这些食物也可以。点重新搭配，再多选一种泉州美食看看。"
              }
              onSpeak={onSpeak}
              label="听结果"
              tone={healthyCount >= 2 ? "emerald" : "amber"}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GrowthArchivePanel({ archive }: { archive: GrowthArchive }) {
  const uniqueBadgeCount = countUniqueBadges(archive);
  const totalMiniGames = getMiniGameCompletionTotal(archive);
  const latestBadges = archive.badgeRecords.slice(0, 4);
  const latestReviews = archive.mealReviews.slice(0, 2);
  const latestMiniGameBadge = archive.badgeRecords.find((item) => item.source === "mini-game");
  const nextFocus =
    totalMiniGames < 2
      ? "先完成一个小游戏"
      : uniqueBadgeCount < 3
        ? "继续点亮新勋章"
        : "鼓励孩子复述收获";

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#e6fbfa_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">成长记录册</p>
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
          <p className="text-xs font-semibold text-slate-500">小游戏记录</p>
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
                        : "小游戏完成"}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                还没有勋章记录，先完成一个小游戏或经确认的拍图记录吧。故事互动会先给进度贴纸。
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
                      {item.guessedFoods.map((food) => (
                        <span
                          key={food}
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
                还没有拍图记录，等你记录第一张餐盘照片后，这里会自动保存。
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
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const [lastImagePrompt, setLastImagePrompt] = useState("");
  const [storyDraft, setStoryDraft] = useState("");
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
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(createEmptyGrowthArchive());
  const [gameContentConfigs, setGameContentConfigs] =
    useState<EditableGameContent[]>(defaultGameContentConfigs);
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const lastAutoSpokenMessageRef = useRef("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const activeTheme = themes[themeId];
  const activeMissions = storyMissionMap[themeId];
  const selectedChild = useMemo(
    () => childRoster.find((child) => child.id === selectedChildId) ?? null,
    [childRoster, selectedChildId],
  );
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
                (selectedChild ? record.childId === selectedChild.id : true),
            )
            .map((record) => record.name),
        ),
      ),
    [growthArchive.badgeRecords, selectedChild, themeId],
  );
  const unlockedChapterCount = Math.max(
    1,
    messages.filter((message) => message.role === "assistant").length,
  );
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

    const restoreHandle = window.setTimeout(() => {
      const savedArchive = window.localStorage.getItem(growthArchiveStorageKey);
      setGrowthArchive(parseGrowthArchive(savedArchive));
      setGameContentConfigs(
        parseGameContentConfigs(window.localStorage.getItem(gameContentConfigStorageKey)),
      );
      const savedRoster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));
      const savedChildId = window.localStorage.getItem(selectedChildStorageKey) ?? "";
      const routeChildId = initialChildId ? decodeURIComponent(initialChildId) : "";
      setChildRoster(savedRoster);
      setSelectedChildId(
        savedRoster.some((child) => child.id === routeChildId)
          ? routeChildId
          : savedRoster.some((child) => child.id === savedChildId)
            ? savedChildId
          : (savedRoster[0]?.id ?? ""),
      );
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
    if (typeof window === "undefined" || !selectedChildId) {
      return;
    }

    window.localStorage.setItem(selectedChildStorageKey, selectedChildId);
  }, [selectedChildId]);

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

      const restoreHandle = window.setTimeout(() => {
        if (parsed.themeId && themes[parsed.themeId]) {
          setThemeId(parsed.themeId);
        }

        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }

        if (Array.isArray(parsed.quickChoices) && parsed.quickChoices.length > 0) {
          setQuickChoices(parsed.quickChoices);
        }

        if (
          typeof parsed.imageUrl === "string" &&
          !parsed.imageUrl.startsWith("data:") &&
          parsed.imageUrl.length < 1200
        ) {
          setImageUrl(parsed.imageUrl);
        }

        if (typeof parsed.lastImagePrompt === "string") {
          setLastImagePrompt(parsed.lastImagePrompt);
        }

        if (typeof parsed.status === "string" && parsed.status.trim()) {
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

  function updateGrowthArchive(updater: (current: GrowthArchive) => GrowthArchive) {
    setGrowthArchive((current) => {
      const baseArchive =
        typeof window !== "undefined" && !growthArchiveHydratedRef.current
          ? parseGrowthArchive(window.localStorage.getItem(growthArchiveStorageKey))
          : current;
      const nextArchive = updater(baseArchive);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(growthArchiveStorageKey, JSON.stringify(nextArchive));
      }

      return nextArchive;
    });
  }

  function logBadgeRecords(nextBadges: string[], source: "story" | "meal-review" | "mini-game") {
    if (nextBadges.length === 0) {
      return;
    }

    updateGrowthArchive((current) =>
      nextBadges.reduce(
        (draft, badge) => recordBadge(draft, badge, themeId, source, childRecordFields),
        current,
      ),
    );
  }

  function logMiniGameCompletion(gameKey: MiniGameKey, badgeName: string, pickedItems: string[] = []) {
    const theme = miniGameThemeMap[gameKey];
    const gameContent = getConfiguredGameContent(gameKey);
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
        ...childRecordFields,
      });

      return childHasBadge
        ? withGame
        : recordBadge(withGame, badgeName, theme, "mini-game", childRecordFields);
    });
    const completionCopy = buildMiniGameCompletionCopy(gameKey, badgeName, pickedItems, gameContent);

    setBadges((current) => (current.includes(badgeName) ? current : [...current, badgeName]));
    setLatestBadgeFeedback(childHasBadge ? "" : completionCopy.feedback);
    setLatestExperienceStickerFeedback(childHasBadge ? buildRepeatedMiniGameStatus(gameKey, gameContent) : "");
    setLatestGrowthFeedbackSource("mini-game");
    setStatus(childHasBadge ? buildRepeatedMiniGameStatus(gameKey, gameContent) : completionCopy.status);
  }

  function logFoodPreferenceObservation(record: FoodPreferenceRecord) {
    const badgeName = "饮食观察章";
    const gameContent = getConfiguredGameContent("foodPreference");
    const recordWithChild = {
      ...record,
      ...childRecordFields,
    };
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
        pickedItems: [record.foodLabel, record.reasonLabel],
        ...childRecordFields,
      });

      return hasPreferenceBadge
        ? withGame
        : recordBadge(withGame, badgeName, "food", "mini-game", childRecordFields);
    });

    if (!hasPreferenceBadge) {
      setBadges((current) => (current.includes(badgeName) ? current : [...current, badgeName]));
    }

    setLatestBadgeFeedback(
      hasPreferenceBadge
        ? `已记录美食认识：${record.foodLabel} · ${record.reasonLabel}`
        : `刚刚点亮：${badgeName} · ${gameContent?.title || record.foodLabel} · ${record.reasonLabel}`,
    );
    setLatestExperienceStickerFeedback("");
    setLatestGrowthFeedbackSource("mini-game");
    setStatus(
      gameContent?.reminderText
        ? `${gameContent.reminderText} 本次记录：${record.foodLabel}，原因是${record.reasonLabel}。`
        : `美食认识观察已记录：${record.foodLabel}，原因是${record.reasonLabel}。老师辅助页会保留这条观察。`,
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
        summary: review.summary ?? "餐盘照片已完成一次观察记录。",
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
      setLatestBadgeFeedback(`泉州闽食拍图打卡：${firstSticker}`);
      setStatus(`闽食照片记录完成啦，围绕${formatFoodList(review.guessedFoods ?? [])}继续说一说。`);
    } else {
      setLatestBadgeFeedback("");
      setStatus("闽食拍照练习完成啦，可以请老师或家长一起确认餐盘里的泉州闽南味。");
    }

    setLatestExperienceStickerFeedback(
      shouldAwardBadges ? "" : `闽食体验贴纸：${firstSticker}。拍照和观察任务已经完成啦。`,
    );
    setLatestGrowthFeedbackSource("meal-review");
  }

  function switchTheme(nextTheme: ThemeId) {
    stopSpeaking();
    setThemeId(nextTheme);
    setMessages([
      {
        role: "assistant",
        content: themes[nextTheme].starter,
      },
    ]);
    setQuickChoices(themes[nextTheme].choices);
    setImageUrl("");
    setLastImagePrompt("");
    setLatestExperienceStickerFeedback("");
    setLatestBadgeFeedback("");
    setLatestGrowthFeedbackSource("");
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
    stopSpeaking();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storyStateStorageKey);
    }
  }

  async function sendMessage(messageText: string) {
    const cleanText = messageText.trim();

    if (!cleanText || isLoading) {
      return;
    }

    if (cleanText.length > storyInputMaxLength) {
      setStatus(`故事请求太长啦，请控制在 ${storyInputMaxLength} 个字以内。`);
      return;
    }

    setMessages((current) => [...current, { role: "user", content: cleanText }]);
    setIsLoading(true);
    setStatus("故事伙伴正在想下一段...");

    try {
      const nextMessages = [...messages, { role: "user" as const, content: cleanText }];
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "child",
          theme: themeId,
          userInput: cleanText,
          messages: nextMessages,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as StoryApiResponse;
      const reply = isValidStoryReply(data.reply) ? data.reply.trim() : "";

      if (!response.ok || !reply) {
        throw new Error(data.error || "故事伙伴暂时没有接上，请再试一次。");
      }

      const choices =
        Array.isArray(data.choices) && data.choices.length > 0 ? data.choices : activeTheme.choices;
      const badgeName = typeof data.badge === "string" ? data.badge.trim() : "";
      const progressSticker =
        typeof data.templateBadge === "string" && data.templateBadge.trim()
          ? data.templateBadge.trim()
          : badgeName;
      const shouldAwardStoryBadge = Boolean(badgeName && isReliableStoryBadgeResponse(data));

      startTransition(() => {
        setMessages((current) => [...current, { role: "assistant", content: reply }]);
        setQuickChoices(choices);

        if (!shouldAwardStoryBadge) {
          setLatestBadgeFeedback("");
          setLatestGrowthFeedbackSource("");
          setLatestExperienceStickerFeedback(
            progressSticker
              ? `故事进度贴纸：${progressSticker}。继续讲故事，不计入真实成长勋章。`
              : "故事进度贴纸：新的故事节点已经解锁。",
          );
        }
      });

      if (shouldAwardStoryBadge) {
        setBadges((current) => {
          if (current.includes(badgeName)) {
            return current;
          }

          return [...current, badgeName];
        });
        logBadgeRecords([badgeName], "story");
        setLatestBadgeFeedback(`刚刚点亮：${badgeName}`);
        setLatestExperienceStickerFeedback("");
        setLatestGrowthFeedbackSource("story");
      }

      const fallbackReminder = data.error ?? "这是体验备用故事，不计入真实成长勋章。";
      setStatus(
        data.error || data.fallbackUsed || data.source === "fallback" || data.source === "demo"
          ? `故事已经接上啦，不过还有一点小提醒：${fallbackReminder}`
          : shouldAwardStoryBadge
            ? `太棒啦，点亮了${badgeName}。`
            : "新的故事节点已经解锁，获得一枚故事进度贴纸。",
      );
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "我刚刚被海风吹乱了故事书，我们再试一次，好吗？",
        },
      ]);
      setStatus(error instanceof Error ? error.message : "刚才连接有点不稳，可以再点一次。");
    } finally {
      setIsLoading(false);
    }
  }

  async function chooseStoryOption(choice: string) {
    await startSpeechPlayback(choice);
    await sendMessage(choice);
  }

  async function submitStoryDraft() {
    const cleanText = storyDraft.trim();

    if (!cleanText) {
      setStatus("可以先说一句或输入一句想听的故事。");
      return;
    }

    await sendMessage(cleanText);
    setStoryDraft("");
  }

  async function generatePictureBookStory() {
    if (isLoading) {
      return;
    }

    const cleanText = storyDraft.trim() || "我想听一个幼习宝好习惯绘本故事";
    setIsLoading(true);
    setStatus("幼习宝正在翻绘本，马上讲给你听...");
    setMessages((current) => [...current, { role: "user", content: `我想听绘本：${cleanText}` }]);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "child",
          storyType: "pictureBook",
          theme: "habit",
          userInput: cleanText,
          messages,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as StoryApiResponse;
      const reply = isValidStoryReply(data.reply) ? data.reply.trim() : "";

      if (!response.ok || !reply) {
        throw new Error(data.error || "绘本故事暂时没有接上，请再试一次。");
      }

      const choices =
        Array.isArray(data.choices) && data.choices.length > 0 ? data.choices : themes.habit.choices;

      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      setQuickChoices(choices);
      setLatestBadgeFeedback("");
      setLatestGrowthFeedbackSource("");
      setLatestExperienceStickerFeedback("绘本倾听贴纸：已经听完一个幼习宝绘本故事。");
      setStatus("绘本故事生成好了，正在播放给你听。");
      void startSpeechPlayback(reply);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "绘本书页刚刚卡住了，我们换一句想听的内容再试一次。",
        },
      ]);
      setStatus(error instanceof Error ? error.message : "绘本故事暂时没有接上，可以再点一次。");
    } finally {
      setIsLoading(false);
    }
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
        throw new Error(data.error || "图片生成失败");
      }

      setImageUrl(data.imageUrl);
      setLastImagePrompt(prompt);
      setStatus("绘本插图生成好了。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "图片暂时画不出来，稍后再试。");
    } finally {
      setIsPainting(false);
    }
  }

  function toggleVoiceInput() {
    if (typeof window === "undefined") {
      return;
    }

    const voiceWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    const SpeechRecognitionApi =
      voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setStatus("当前浏览器不支持语音输入，建议用 Chrome 或 Edge。");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    stopSpeaking();

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        const nextText = transcript.slice(0, storyInputMaxLength);
        setStoryDraft(nextText);
        setStatus(
          themeId === "food"
            ? "已经听到你的闽食想法啦，可以点“继续故事”或“按这句话画图”。"
            : "已经听到你的想法啦，可以点“播放绘本”或继续故事。",
        );
      }
    };

    recognition.onerror = () => {
      setStatus("刚才没有听清楚，你可以再说一次。");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatus(themeId === "food" ? "正在听你说想听或想画的闽食内容..." : "正在听你说想听的绘本或故事内容...");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section>
        <ChildIdentityPanel
          childRoster={childRoster}
          selectedChildId={selectedChildId}
          onSelectChild={(child) => {
            setSelectedChildId(child.id);
            setStatus(`${formatChildLabel(child)} 的学习身份已启动。`);
          }}
        />
      </section>

      <section>
        <div className="overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#fff6d6_0%,#ffffff_48%,#dff8f7_100%)] p-8 shadow-[0_28px_90px_rgba(49,93,104,0.18)]">
          <div className="flex flex-wrap items-center gap-3">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => switchTheme(theme.id)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  theme.id === themeId
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-white/80 text-slate-700 hover:-translate-y-0.5"
                }`}
              >
                {theme.emoji} {theme.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
                儿童互动
              </p>
              <h1 className="mt-4 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
                {activeTheme.label}
                <span className="mt-2 block text-2xl text-slate-700 md:text-3xl">
                  {activeTheme.headline}
                </span>
              </h1>
            </div>

            <div className="w-full max-w-xs rounded-[2rem] bg-white/85 p-5 shadow-[0_16px_50px_rgba(43,104,98,0.12)]">
              <p className="text-sm font-semibold text-slate-500">
                {themeId === "food" ? "闽食成长状态" : "今日成长状态"}
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{status}</p>
              {latestBadgeFeedback ? (
                <p className="mt-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {latestBadgeFeedback}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-500">当前主题</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{activeTheme.label}</p>
                </div>
                <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-500">解锁章节</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{unlockedChapterCount}</p>
                </div>
                <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-500">本主题勋章</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {activeThemeBadges.length}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activeThemeBadges.length === 0 ? (
                  <span className="rounded-full bg-amber-100 px-3 py-2 text-sm text-amber-800">
                    {themeId === "food"
                      ? "第一枚闽食勋章还在路上"
                      : "第一枚勋章还在路上"}
                  </span>
                ) : (
                  activeThemeBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
                    >
                      {badge}
                      {latestBadgeFeedback.includes(badge) ? " · 最新点亮" : ""}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {imageFeatureEnabled ? (
                  <button
                    onClick={() => void generateImage(storyDraft)}
                    className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    {isPainting ? "插图生成中..." : "生成绘本插图"}
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
                  >
                    {usePremiumVoice ? `${premiumVoiceLabel} 已启用` : "切回浏览器播报"}
                  </button>
                ) : null}
                <button
                  onClick={() => void startSpeechPlayback(lastAssistantMessage)}
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!lastAssistantMessage}
                >
                  {isSpeaking ? "正在播报..." : "重听上一句"}
                </button>
                <button
                  onClick={resetStoryProgress}
                  className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
                >
                  重新开始本轮
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 max-w-xl">
            <AmbientMusicToggle scene={themeId} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">互动故事</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">聊天冒险台</h2>
            </div>
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">说一句，故事和插图都用这一句</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={storyDraft}
                onChange={(event) => setStoryDraft(event.target.value.slice(0, storyInputMaxLength))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitStoryDraft();
                  }
                }}
                placeholder={
                  themeId === "food"
                    ? "可以说：我想听海蛎小勇士的故事"
                    : "可以说：我想听洗手小星的故事"
                }
                className="rounded-[1.4rem] border border-amber-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-300"
              />
              <button
                onClick={toggleVoiceInput}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  isListening ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
                }`}
                type="button"
              >
                {isListening ? "停止听写" : "语音输入"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void submitStoryDraft()}
                disabled={!storyDraft.trim() || isLoading}
                className="rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                type="button"
              >
                {isLoading ? "故事生成中..." : "继续故事"}
              </button>
              {imageFeatureEnabled ? (
                <button
                  onClick={() => void generateImage(storyDraft)}
                  disabled={isPainting || !storyDraft.trim()}
                  className="rounded-full bg-cyan-100 px-5 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  type="button"
                >
                  {isPainting ? "插图生成中..." : "按这句话画图"}
                </button>
              ) : null}
              <span className="text-xs font-semibold text-slate-500">
                还可输入 {storyInputMaxLength - storyDraft.length} 字
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.8rem] bg-[linear-gradient(180deg,#e6fbfa_0%,#fff7dc_100%)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-700">故事画面</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">边聊边看绘本画面</h3>
              </div>
              <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800">
                绘本贴纸
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-[1.5rem]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="故事插图"
                  className="h-[280px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center border border-dashed border-teal-200 bg-white/70 text-center">
                  {imageFeatureEnabled ? (
                    <>
                      <p className="text-lg font-semibold text-slate-700">说一句想画什么</p>
                      <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">
                        我会结合当前故事和孩子说的话，画一张绘本风插图，漂亮的画面会多等一小会儿。
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-slate-700">先听故事和玩小游戏</p>
                      <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">
                        今天先用声音、故事和小游戏完成任务，贴纸会在成长册里点亮。
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto pr-2">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-[2rem] px-5 py-4 text-sm leading-7 shadow-sm md:text-base ${
                    message.role === "assistant"
                      ? "bg-teal-50 text-slate-800"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading ? (
              <div className="flex justify-start">
                <div className="rounded-[2rem] bg-teal-50 px-5 py-4 text-sm text-slate-500">
                  故事伙伴正在想下一段...
                </div>
              </div>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          {latestBadgeFeedback ? (
            <div
              aria-live="polite"
              className="mt-5 rounded-[1.8rem] bg-emerald-50 px-5 py-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-emerald-800">成长勋章点亮</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                这是你认真尝试的小小成长印记，可以继续下一步啦。
              </p>
            </div>
          ) : null}

          {latestExperienceStickerFeedback ? (
            <div
              aria-live="polite"
              className="mt-5 rounded-[1.8rem] bg-amber-50 px-5 py-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-amber-900">体验贴纸</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {latestExperienceStickerFeedback}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                这是本次体验进度，不会当作真实成长勋章写入成长册。
              </p>
            </div>
          ) : null}

          <div className="mt-5 rounded-[1.8rem] bg-white/80 p-4">
            <p className="text-sm font-semibold text-teal-700">点一个成长任务</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {quickChoices.map((choice) => {
                const visual = getStoryOptionVisual(choice, themeId);

                return (
                  <div
                    key={choice}
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
                        disabled={isLoading}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                        type="button"
                      >
                        选择
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

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#fff7dc_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-rose-700">本轮任务</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{activeTheme.label}</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {(themeId === "food"
              ? ["闽食探索", "表达练习", "带回家玩"]
              : ["习惯养成", "生活练习", "带回家玩"]
            ).map((item) => (
              <span
                key={item}
                className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {activeMissions.map((mission) => {
              const visual = getMissionOptionVisual(mission, themeId);

              return (
                <div
                  key={mission}
                  className="rounded-[1.3rem] bg-white/85 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-teal-50 text-2xl">
                      {visual.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-900">{mission}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{visual.description}</p>
                    </div>
                    <SpeechCueButton
                      text={`${mission}。${visual.description}`}
                      onSpeak={(text) => {
                        void startSpeechPlayback(text);
                      }}
                      label="听"
                      tone="teal"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {themeId === "habit" ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <HabitVisualBoard />
            <HabitMissionPoster badges={badges} missions={activeMissions} />
          </section>

          <section className="rounded-[2.3rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_52%,#e5fbfa_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-700">幼习宝听绘本</p>
                <h3 className="mt-1 text-2xl font-semibold text-slate-900">我想听一个绘本故事</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                  可以自己说想听什么，也可以输入一句。幼习宝会生成一段短短的绘本故事，并直接播放给你听。
                </p>
              </div>
              <SpeechCueButton
                text="这里可以听绘本故事。先说出想听的内容，比如我想听洗手小星的故事，再点播放绘本。"
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                label="听玩法"
                tone="amber"
              />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                value={storyDraft}
                onChange={(event) => setStoryDraft(event.target.value.slice(0, storyInputMaxLength))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void generatePictureBookStory();
                  }
                }}
                placeholder="可以说：我想听洗手小星的故事"
                className="rounded-[1.4rem] border border-amber-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-300"
              />
              <button
                onClick={toggleVoiceInput}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  isListening ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
                }`}
                type="button"
              >
                {isListening ? "我说完了" : "说给幼习宝听"}
              </button>
              <button
                onClick={() => void generatePictureBookStory()}
                disabled={isLoading}
                className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-amber-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                type="button"
              >
                {isLoading ? "正在翻绘本..." : "播放绘本"}
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <FoodBadgeWall />
          <div className="grid gap-5">
            <MealPhotoBooth onReviewLogged={handleMealReviewLogged} />
            {latestGrowthFeedbackSource === "meal-review" && latestBadgeFeedback ? (
              <div
                aria-live="polite"
                className="rounded-[2rem] bg-emerald-50 p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-emerald-800">拍图打卡成长反馈</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  你愿意观察餐盘和闽食，这个小尝试已经被记录下来啦。
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
        </section>
      )}

      <section>
        <ThemeVideoBoard themeId={themeId} />
      </section>

      <section className="grid gap-6">
        <RewardStickerShelf badges={badges} />
        <GrowthArchivePanel archive={growthArchive} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {latestGrowthFeedbackSource === "mini-game" && latestBadgeFeedback ? (
          <div
            aria-live="polite"
            className="rounded-[2rem] bg-amber-50 p-5 shadow-sm xl:col-span-2"
          >
            <p className="text-sm font-semibold text-amber-900">小游戏成长反馈</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
              <SpeechCueButton
                text={`${latestBadgeFeedback}。${
                  themeId === "food"
                    ? "你认真完成了闽食小挑战，可以把看到、闻到、尝到的发现说给同伴听。"
                    : "你认真完成了这个小挑战，可以带着这个好习惯继续玩啦。"
                }`}
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                label="听成长反馈"
                tone="amber"
              />
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {themeId === "food"
                ? "你认真完成了闽食小挑战，可以把名字、食材和小故事说给同伴听。"
                : "你认真完成了这个小挑战，可以带着这个好习惯继续玩啦。"}
            </p>
          </div>
        ) : null}
        {themeId === "habit" ? (
          <>
            <ShuffleStepsGame
              contentConfig={getConfiguredGameContent("washSteps")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={() => logMiniGameCompletion("washSteps", "行为习惯掌握章", washSteps)}
            />
            <QueueGame
              contentConfig={getConfiguredGameContent("queue")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={() =>
                logMiniGameCompletion(
                  "queue",
                  "生活安全实践章",
                  habitRoutineScenarios.map((item) => item.title),
                )
              }
            />
            <HabitJudgeGame
              contentConfig={getConfiguredGameContent("habitJudge")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems) =>
                logMiniGameCompletion("habitJudge", "安全知识判断章", pickedItems)
              }
            />
          </>
        ) : (
          <>
            <FoodTreasureQuestGame
              contentConfig={getConfiguredGameContent("foodObserve")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={() => logMiniGameCompletion("foodObserve", "美食摊位寻宝章")}
            />
            <FoodPreferenceGame
              contentConfig={getConfiguredGameContent("foodPreference")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={logFoodPreferenceObservation}
            />
            <PeerEncouragementGame
              contentConfig={getConfiguredGameContent("peerEncourage")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={() => logMiniGameCompletion("peerEncourage", "同伴认识星")}
            />
            <MealTrayGame
              contentConfig={getConfiguredGameContent("mealTray")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onSpeakNutrition={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems) =>
                logMiniGameCompletion("mealTray", "均衡小餐盘", pickedItems)
              }
            />
          </>
        )}
      </section>

    </div>
  );
}
