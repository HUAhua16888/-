"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

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
import { getFoodPreferenceFollowUp, getMiniGameFollowUp } from "@/lib/parent-sync";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  buildTodayMenuSpeech,
  getLocalDateKey,
  getPublishedMenuForDate,
  parseWeeklyMenuEntries,
  weeklyMenuStorageKey,
  type WeeklyMenuEntry,
} from "@/lib/weekly-menu";
import {
  foodBadgeCards,
  foodGuessRounds,
  foodKitchenRecipes,
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
  badge?: string;
  templateBadge?: string;
  badgeKind?: string;
  source?: string;
  mode?: string;
  awardBadge?: boolean;
  fallbackUsed?: boolean;
  error?: string;
};

type StoryInteractionMode = "pictureBook" | "adventure";

type PictureBookCheckinOption = {
  label: string;
  source: string;
  feedback: string;
};

type HabitStoryMission = {
  topic: string;
  title: string;
  storyText: string;
  question: string;
  answerCards: string[];
  habitTask: string;
  feedback: string;
};

const defaultPictureBookCheckinOptions: PictureBookCheckinOption[] = [
  {
    label: "我听到了一个角色",
    source: "听故事里的角色或伙伴",
    feedback: "你听得很认真，故事小耳朵亮起来啦。",
  },
  {
    label: "我看到了一个画面",
    source: "看故事里出现的画面",
    feedback: "愿意说出一个画面，就是阅读小书虫的一步。",
  },
  {
    label: "我喜欢这个地方",
    source: "说一处喜欢的情节",
    feedback: "能说出喜欢的地方，说明你正在认真听故事。",
  },
  {
    label: "我想把书放回去",
    source: "把阅读习惯带到图书归位",
    feedback: "听完故事把图书送回家，阅读任务完成啦。",
  },
];

function buildPictureBookCheckinOptions(choices: string[]): PictureBookCheckinOption[] {
  const safeChoices = choices
    .map((choice) => choice.trim())
    .filter(Boolean)
    .slice(0, 3);
  const [roleChoice, pictureChoice, favoriteChoice] = safeChoices;

  return [
    {
      label: roleChoice ? `我听到了：${roleChoice}` : defaultPictureBookCheckinOptions[0].label,
      source: "来自刚才 AI 绘本的角色或事件",
      feedback: "你能听到故事里的角色，故事小耳朵亮起来啦。",
    },
    {
      label: pictureChoice ? `我看到了：${pictureChoice}` : defaultPictureBookCheckinOptions[1].label,
      source: "来自刚才 AI 绘本的画面线索",
      feedback: "你会把画面说出来，阅读小书虫在认真观察。",
    },
    {
      label: favoriteChoice ? `我喜欢：${favoriteChoice}` : defaultPictureBookCheckinOptions[2].label,
      source: "来自刚才 AI 绘本的喜欢点",
      feedback: "能说出喜欢的地方，说明你真的听进故事了。",
    },
    defaultPictureBookCheckinOptions[3],
  ];
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
    feedback: "你听到文明进餐的小动作，完成一步也值得记录。",
  },
  {
    topic: "如厕",
    title: "我会轻轻说",
    storyText:
      "《我会轻轻说》开始啦。小星想上厕所时，没有着急跑开，而是走到老师身边轻轻说：老师，我想去如厕。回来后，小星整理好衣服，再认真洗手。老师说：你会表达自己的需要，也会照顾自己。",
    question: "想上厕所时可以先做什么？",
    answerCards: ["告诉老师", "憋着不说", "推开朋友"],
    habitTask: "如厕前告诉老师",
    feedback: "你听到可以轻轻告诉老师，如厕小提醒完成一步啦。",
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

function buildKitchenBroadcastText(
  recipe: (typeof foodKitchenRecipes)[number],
  childThought: string,
  uploadedFileName = "",
) {
  const cleanThought = childThought.trim().replace(/[。！!]+$/g, "");
  const unsure = !cleanThought || /不知道|不会|不懂|随便|没有/.test(cleanThought);
  const textureMap: Record<string, string> = {
    泉州海蛎煎: "金黄金黄、边边香香，里面有海蛎、鸡蛋和地瓜粉",
    面线糊: "热热的、软软的，里面有面线和汤",
    润饼菜: "卷卷的、颜色很多，里面有薄饼皮和蔬菜",
    石花膏: "透明凉凉、会轻轻晃，是泉州常见的小甜品",
    闽南肉粽: "粽叶香香、米粒亮亮，里面可能有香菇和家常配料",
  };
  const description = textureMap[recipe.label] ?? "有自己的颜色、形状和家乡味道";
  const uploadText = uploadedFileName ? "我上传了作品。" : "";

  if (unsure) {
    return `我今天介绍的是${recipe.label}。它${description}。${uploadText}我愿意把它介绍给大家。`;
  }

  if (cleanThought.length <= 8) {
    return `我今天介绍的是${recipe.label}。我发现它${cleanThought}。${uploadText}我愿意把它介绍给大家。`;
  }

  return `我今天介绍的是${recipe.label}。${cleanThought}。${uploadText}我愿意把它介绍给大家。`;
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
  如厕小提醒: {
    question: "想上厕所时可以先做什么？",
    options: ["告诉老师", "一直忍着", "推开别人跑"],
    correct: "告诉老师",
    feedback: "会轻轻告诉老师，如厕小提醒完成啦。",
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
    nextStep: "可以再玩一个任务，或者看看成长记录。",
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
    options: ["认真观察", "抢材料", "不听规则"],
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

const storyStateStorageKey = "tongqu-growth-web-story-state";
const storyInputMaxLength = 120;
const miniGameThemeMap: Record<MiniGameKey, ThemeId> = {
  washSteps: "habit",
  queue: "habit",
  habitJudge: "habit",
  readingCheckin: "habit",
  kindWords: "food",
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
const minnanTasteSteps = "逛泉州美食摊、找食材卡、听小故事、说出一个发现";

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

function createFoodTreasureRound() {
  const sensitiveFoods = minnanFoodClues.filter((item) => /^(香菇|小葱|蒜)$/.test(item.label));
  const shuffledTargets = shuffleItems(minnanFoodClues).slice(0, Math.min(5, minnanFoodClues.length));
  const hasSensitiveFood = shuffledTargets.some((item) => sensitiveFoods.some((food) => food.label === item.label));
  const targets =
    hasSensitiveFood || sensitiveFoods.length === 0
      ? shuffledTargets
      : [
          ...shuffledTargets.slice(0, Math.max(0, shuffledTargets.length - 1)),
          shuffleItems(sensitiveFoods)[0],
        ];
  const targetLabels = new Set(targets.map((item) => item.label));
  const distractors = shuffleItems(minnanFoodClues.filter((item) => !targetLabels.has(item.label))).slice(
    0,
    Math.max(0, 8 - targets.length),
  );

  return {
    targets,
    choices: shuffleItems([...targets, ...distractors]),
  };
}

function createFoodGuessRound() {
  return shuffleItems(foodGuessRounds)
    .slice(0, Math.min(4, foodGuessRounds.length))
    .map((round) => ({
      ...round,
      options: shuffleItems(round.options),
    }));
}

function createMenuFoodPreferenceChoices(todayMenuEntries: WeeklyMenuEntry[] = []) {
  const menuLabels = todayMenuEntries.flatMap((entry) => [
    entry.dishName,
    ...entry.focusIngredients,
    ...entry.ingredients,
  ]);
  const uniqueMenuLabels = Array.from(
    new Set(menuLabels.map((item) => item.trim()).filter(Boolean)),
  );

  return uniqueMenuLabels.map(buildFoodPreferenceOption);
}

function createFoodPreferenceRound(todayMenuEntries: WeeklyMenuEntry[] = []) {
  const menuChoices = createMenuFoodPreferenceChoices(todayMenuEntries);
  const menuLabelSet = new Set(menuChoices.map((item) => item.label));
  const fallbackChoices = createFoodPreferenceChoices().filter((item) => !menuLabelSet.has(item.label));
  const foods = menuChoices.length > 0
    ? [...menuChoices, ...fallbackChoices].slice(0, 18)
    : fallbackChoices;

  return {
    foods,
    reasons: shuffleItems(foodPreferenceReasons),
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

function createFoodPreferenceChoices() {
  return shuffleItems(foodPreferenceFixedLabels.map(buildFoodPreferenceOption));
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

function createFoodKitchenRound() {
  return shuffleItems(foodKitchenRecipes);
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
  "mealManners",
  "habitTrafficLight",
  "foodTrain",
  "foodObserve",
  "foodGuess",
  "foodPreference",
  "foodReporter",
  "foodKitchen",
]);

function getAiObservationStage(gameKey: MiniGameKey, pickedItems: string[]) {
  const pickedText = pickedItems.join("、");

  if (gameKey === "washSteps") {
    return "一日生活常规从听提醒，进入能按顺序完成洗手步骤的阶段";
  }

  if (gameKey === "queue") {
    return "一日生活常规从听提醒，进入能选择喝水、如厕、排队或整理合适做法的阶段";
  }

  if (gameKey === "readingCheckin") {
    return "习惯故事从愿意听，进入能选择答案并完成一个生活小任务的阶段";
  }

  if (gameKey === "mealManners") {
    return "进餐习惯从愿意听口令，进入能模仿动作和迁移到餐前餐后的阶段";
  }

  if (gameKey === "habitTrafficLight") {
    return "好习惯判断从愿意选择，进入能说出替代做法的阶段";
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

  const miniGameRecord: MiniGameRecord = {
    gameKey,
    badgeName,
    themeId: miniGameThemeMap[gameKey],
    completedAt: new Date().toISOString(),
    pickedItems,
  };
  const followUp = getMiniGameFollowUp(miniGameRecord);
  const title = contentConfig?.title.trim() || followUp.displayName;
  const pickedText = formatInteractionRecord(pickedItems);
  const stage = getAiObservationStage(gameKey, pickedItems);
  const reminder = contentConfig?.reminderText.trim();

  return {
    feedback: `AI成长观察：${title}已记录 · ${pickedText}`,
    status: [
      `AI成长观察：孩子完成了“${followUp.displayName}”`,
      `选择/动作记录：${pickedText}`,
      `观察线索：${followUp.observation}`,
      `阶段提示：${stage}`,
      `下一步温和跟进：${followUp.homeTask}`,
      reminder ? `老师提醒：${reminder}` : "",
    ]
      .filter(Boolean)
      .join("。"),
  };
}

function buildKitchenStepSpeech(recipe: (typeof foodKitchenRecipes)[number], nextAction?: string) {
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
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "历史安全判断记录"}`,
      status: configuredReminder || "历史安全判断完成啦：你能分清哪些做法正确，哪些做法需要换成更安全的方式。",
    };
  }

  if (gameKey === "readingCheckin") {
    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "习惯故事小剧场"}`,
      status: configuredReminder || "习惯故事小剧场完成啦：你认真听故事，也把故事里的好习惯做到一步。",
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
        ? `${configuredReminder} 本次记录：${pickedText}。`
        : `美食认识观察卡完成：${pickedText}。教师工作台会保留这条观察记录。`,
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
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "历史同伴鼓励记录"}`,
      status: configuredReminder || "历史同伴鼓励记录已保留，现在可以继续玩闽食小小播报员。",
    };
  }

  if (gameKey === "mealTray") {
    const pickedText = formatFoodList(pickedItems);

    return {
      feedback: `刚刚点亮：${badgeName} · ${configuredTitle || "历史午餐小餐盘记录"}`,
      status: configuredReminder
        ? `${configuredReminder} 历史记录：${pickedText}。`
        : `历史午餐小餐盘记录已保留：${pickedText}。现在可以继续玩泉州小厨房。`,
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
    return `${configuredTitle || "历史安全判断记录"}已经记录过啦，可以继续用好习惯红绿牌练习分辨正确习惯和安全做法。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "readingCheckin") {
    return `${configuredTitle || "习惯故事小剧场"}已经记录过啦，可以继续听故事、选答案卡，再完成一个生活小任务。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "mealManners") {
    return `${configuredTitle || "文明进餐操"}已经记录过啦，可以继续跟口令练习扶碗、坐稳、轻声用餐和餐后整理。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "habitTrafficLight") {
    return `${configuredTitle || "好习惯红绿牌"}已经记录过啦，可以继续听行为、举红绿牌、说正确做法。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
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

  if (gameKey === "foodTrain") {
    return `${configuredTitle || "闽食小列车"}已经记录过啦，可以继续听站名、认美食、练习小小播报。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodGuess") {
    return `${configuredTitle || "美食猜猜乐"}已经记录过啦，可以继续根据线索找食材。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "peerEncourage") {
    return `${configuredTitle || "历史同伴鼓励记录"}已经记录过啦，可以继续玩闽食小小播报员，练习介绍一种泉州美食。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodPreference") {
    return `${configuredTitle || "美食认识观察卡"}已经记录过啦，可以继续换一种食物说说今天的感受。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodReporter") {
    return `${configuredTitle || "闽食小小播报员"}已经记录过啦，可以继续换一种泉州美食，练习名字、食材和发现。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "foodKitchen") {
    return `${configuredTitle || "泉州小厨房"}已经记录过啦，可以继续换一道泉州美食，按步骤做区域游戏。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  if (gameKey === "mealTray") {
    return `${configuredTitle || "历史午餐小餐盘记录"}已经记录过啦，可以继续玩泉州小厨房，按步骤认识家乡美食。${configuredReminder ? `老师提醒：${configuredReminder}` : ""}`;
  }

  return "这个成长任务已经记录过啦，可以继续练习，但不会重复增加成长次数。";
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
  const toneClassMap = {
    slate: "bg-slate-900 text-white hover:bg-slate-800",
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

  if (/阅读|故事|图书/.test(text)) {
    return {
      icon: "📚",
      description: "听故事、说角色、讲画面，并把图书归位。",
    };
  }

  if (/红绿牌/.test(text)) {
    return {
      icon: "🟢",
      description: "听一个行为，判断好习惯或需要调整的做法。",
    };
  }

  if (/判断|对不对|正确/.test(text)) {
    return {
      icon: "✅",
      description: "练习分辨好习惯和需要调整的安全做法。",
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

function HabitVisualBoard({
  onSpeak,
  onTaskComplete,
}: {
  onSpeak?: SpeakHandler;
  onTaskComplete?: (gameKey: MiniGameKey, badgeName: string, pickedItems: string[]) => void;
}) {
  const [activeTaskTitle, setActiveTaskTitle] = useState(habitSkillCards[0]?.title ?? "");
  const [taskFeedback, setTaskFeedback] = useState("先点一张精选任务卡，我会根据图标和文字生成对应的学习问题。");
  const [completedTaskTitles, setCompletedTaskTitles] = useState<string[]>([]);
  const activeTask =
    habitSkillCards.find((item) => item.title === activeTaskTitle) ?? habitSkillCards[0];
  const answerConfig = activeTask
    ? habitTaskAnswerOptions[activeTask.title] ?? {
        question: activeTask.question,
        options: [activeTask.actionLabel, "我还想听一遍", "换一个任务"],
        correct: activeTask.actionLabel,
        feedback: `${activeTask.badgeName}亮起来啦。`,
        nextStep: "可以再玩一个任务，或者查看成长记录。",
      }
    : null;

  function startTask(item: (typeof habitSkillCards)[number]) {
    setActiveTaskTitle(item.title);
    const nextAnswerConfig = habitTaskAnswerOptions[item.title];
    const question = nextAnswerConfig?.question ?? item.question;
    setTaskFeedback("这张图卡已经生成学习问题，听完后选一张答案卡。");
    onSpeak?.(`${item.taskName}。${item.command}${item.rhyme} ${question}`);
  }

  function chooseAnswer(item: (typeof habitSkillCards)[number], answer: string) {
    const currentAnswerConfig =
      habitTaskAnswerOptions[item.title] ?? {
        question: item.question,
        correct: item.actionLabel,
        feedback: `${item.badgeName}点亮啦。`,
        nextStep: "可以再玩一个任务，或者查看成长记录。",
      };

    if (completedTaskTitles.includes(item.title)) {
      const message = `${item.taskName}已经打卡啦，可以再玩一个任务，或者查看成长记录。`;
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (answer !== currentAnswerConfig.correct) {
      const message = `这个做法需要换一换，我们可以这样做：${currentAnswerConfig.correct}。`;
      setTaskFeedback(message);
      onSpeak?.(message);
      return;
    }

    const pickedItems = [item.taskName, currentAnswerConfig.question, answer];
    const message = `${currentAnswerConfig.feedback} ${currentAnswerConfig.nextStep}`;

    onTaskComplete?.(item.gameKey as MiniGameKey, item.badgeName, pickedItems);
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
          <p className="text-sm font-semibold text-amber-700">幼习宝·一日生活常规提醒</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">点图卡，听 AI 小口令</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            主线围绕洗手、喝水、如厕、排队、整理和文明进餐；每张卡都有问题、答案卡和 AI 成长观察记录。
          </p>
        </div>
        <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          {habitSkillCards.length} 个常规任务
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {habitSkillCards.map((item) => (
          <button
            key={item.title}
            onClick={() => startTask(item)}
            className={`story-card rounded-[1.7rem] bg-[linear-gradient(180deg,#fffdf7_0%,#f5fffe_100%)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
              activeTask?.title === item.title ? "ring-2 ring-teal-300" : ""
            }`}
            type="button"
          >
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.1rem] text-2xl ${item.tone}`}
            >
              {item.icon}
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.hint}</p>
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 shadow-sm">
              {activeTask?.title === item.title ? "正在玩" : "点我开始"}
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
              <div className="mt-3 grid gap-3 rounded-[1.3rem] bg-white/85 p-3 sm:grid-cols-[auto_1fr]">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-[1.2rem] text-3xl ${activeTask.tone}`}
                >
                  {activeTask.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">图文学习卡</p>
                  <p className="mt-1 text-sm leading-7 text-slate-700">
                    {activeTask.knowledge}
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
                label="听任务"
                tone="emerald"
              />
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-800">选择一张答案卡</p>
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
          <div className="mt-4 rounded-[1.2rem] bg-white/80 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">{taskFeedback}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              完成后可以再玩一个任务、去阅读打卡，或查看成长记录。
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
                {hasBadges ? "已经记录在成长册里。" : "完成对应任务后会点亮。"}
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
  const foodOptions = ["泉州海蛎煎", "面线糊", "润饼菜", "石花膏", "土笋冻", "崇武鱼卷", "其他"];
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
              setSubmitFeedback("任务已经切换啦，完成后可以提交并记录到成长册。");
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
                {actionOptions.map((item) => (
                  <option key={item}>{item}</option>
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
                {foodOptions.map((item) => (
                  <option key={item}>{item}</option>
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
                {placeOptions.map((item) => (
                  <option key={item}>{item}</option>
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
                {stepOptions.map((item) => (
                  <option key={item}>{item}</option>
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
          上传照片或视频打卡
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
              当前文件：{mediaName}。文件只在这台设备预览，成长记录保存文件名。
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
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            type="button"
          >
            {activeTask === "闽食宣传员" ? "我会介绍了" : "提交任务"}
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
          回到儿童入口重新识别
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

function ReadingCheckinGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (
    pickedItems: string[],
    detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>,
  ) => void;
  onSpeak?: SpeakHandler;
}) {
  const [storyIdea, setStoryIdea] = useState("");
  const [storyMission, setStoryMission] = useState(() => buildHabitStoryMission("洗手"));
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [taskDone, setTaskDone] = useState(false);
  const [feedback, setFeedback] = useState("先说想听什么故事，再听短故事、选答案卡、完成一个习惯小任务。");
  const [isStoryListening, setIsStoryListening] = useState(false);
  const completionReportedRef = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const completed = Boolean(selectedAnswer && taskDone);
  const introText =
    contentConfig?.childGoal.trim() ||
    "听一个围绕洗手、喝水、排队、整理、图书归位或文明进餐的短故事，选答案卡，再完成一个习惯小任务。";

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function generateStoryFromIdea() {
    const nextMission = buildHabitStoryMission(storyIdea || "洗手");

    setStoryMission(nextMission);
    setSelectedAnswer("");
    setTaskDone(false);
    completionReportedRef.current = false;
    const message = `AI已经把故事收回到“${nextMission.topic}”这个好习惯。先听故事，再选答案卡。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function playStory() {
    setFeedback("短故事讲完啦，请选一张答案卡，再完成下面的小习惯任务。");
    onSpeak?.(storyMission.storyText);
  }

  function pickAnswer(answer: string) {
    if (completed) {
      return;
    }

    const message =
      answer === storyMission.answerCards[0]
        ? `${storyMission.feedback} 现在可以完成一个小习惯任务。`
        : `你愿意回答就是认真听。我们再听一遍正确做法：${storyMission.answerCards[0]}。现在可以试试小习惯任务。`;
    setSelectedAnswer(answer);
    setFeedback(message);
    onSpeak?.(message);
  }

  function completeHabitTask() {
    if (!selectedAnswer) {
      const message = "先选一张答案卡，或者点“我说了一个发现”。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (completionReportedRef.current) {
      const message = "这次习惯故事小任务已经记录啦，可以换一个故事继续听。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const message = `AI成长观察已记录：你听了“${storyMission.topic}”故事，回答了“${selectedAnswer}”，也完成了“${storyMission.habitTask}”。`;
    const pickedItems = [
      `故事主题:${storyMission.topic}`,
      `回答:${selectedAnswer}`,
      `完成小习惯:${storyMission.habitTask}`,
    ];

    setTaskDone(true);
    setFeedback(message);
    onSpeak?.(message);
    completionReportedRef.current = true;
    onComplete?.(pickedItems, {
      storyTopic: storyMission.topic,
      answerContent: selectedAnswer,
      habitTask: storyMission.habitTask,
    });
  }

  function resetGame() {
    const nextMission = buildHabitStoryMission("洗手");

    setStoryIdea("");
    setStoryMission(nextMission);
    setSelectedAnswer("");
    setTaskDone(false);
    setFeedback("习惯故事小剧场重新开始。你可以说：我想听洗手的故事。");
    completionReportedRef.current = false;
    onSpeak?.("习惯故事小剧场重新开始。先说想听什么好习惯故事。");
  }

  function toggleStoryVoiceInput() {
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
      setFeedback("当前浏览器不支持语音输入，可以先用键盘输入。");
      return;
    }

    if (isStoryListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsStoryListening(false);
      return;
    }

    const recognition = new SpeechRecognitionApi();

    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        setStoryIdea(transcript.slice(0, 40));
        setFeedback("听到啦。AI会把它整理成一个好习惯短故事。");
      }
    };
    recognition.onerror = () => {
      setFeedback("刚才没有听清楚，可以再说一次。");
      setIsStoryListening(false);
    };
    recognition.onend = () => setIsStoryListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsStoryListening(true);
    setFeedback("正在听你说：我想听……的故事。");
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-700">听故事做任务</p>
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
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="violet" />
      </div>

      <div className="mt-4 rounded-[1.6rem] bg-violet-50 p-4">
        <p className="text-sm font-semibold text-violet-900">我想听……的故事</p>
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
              isStoryListening ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
            }`}
            type="button"
          >
            {isStoryListening ? "停止听写" : "语音输入"}
          </button>
          <button
            onClick={generateStoryFromIdea}
            className="rounded-full bg-violet-200 px-5 py-3 text-sm font-semibold text-violet-950 transition hover:-translate-y-0.5"
            type="button"
          >
            生成习惯故事
          </button>
        </div>
        <p className="mt-2 text-xs leading-6 font-semibold text-violet-700">
          AI 会把孩子想听的内容收回到洗手、喝水、排队、整理、图书归位、文明进餐等当前主题习惯。
        </p>
      </div>

      <div className="mt-5 rounded-[1.7rem] bg-violet-50 p-5">
        <div className="rounded-[1.5rem] bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-violet-700">当前习惯故事</p>
              <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-violet-100 text-5xl">
                📖
              </div>
              <h4 className="mt-4 text-xl font-semibold text-slate-900">
                {storyMission.title}
              </h4>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {storyMission.question}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SpeechCueButton text={storyMission.storyText} onSpeak={onSpeak} label="听短故事" tone="violet" />
              <button
                onClick={playStory}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                播放故事
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {storyMission.answerCards.map((answer) => (
              <button
                key={answer}
                onClick={() => pickAnswer(answer)}
                disabled={completed}
                className={`rounded-[1.4rem] px-4 py-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selectedAnswer === answer
                    ? "bg-emerald-100 text-emerald-900 ring-2 ring-emerald-200"
                    : "bg-violet-100 text-violet-950"
                }`}
                type="button"
              >
                {answer}
                <span className="mt-1 block text-xs leading-5 text-violet-800">点我说发现</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => pickAnswer("我说了一个发现")}
            disabled={completed}
            className="mt-4 rounded-full bg-white px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            我说了一个发现
          </button>
          <button
            onClick={completeHabitTask}
            disabled={completed}
            className="mt-4 ml-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            完成小习惯：{storyMission.habitTask}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            1. 听短故事
          </span>
          <span
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              selectedAnswer ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700"
            }`}
          >
            {selectedAnswer ? "✓ " : ""}2. 选答案/说发现
          </span>
          <span
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              taskDone ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700"
            }`}
          >
            {taskDone ? "✓ " : ""}3. 完成小习惯
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-white/80 px-4 py-3">
          <p className="text-sm font-semibold text-violet-950">{feedback}</p>
          <SpeechCueButton text={feedback} onSpeak={onSpeak} label="听反馈" tone="violet" />
        </div>
      </div>
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
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="amber" />
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
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="text-sm font-semibold text-rose-700">常规判断任务</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "好习惯红绿牌"}
          </h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-200"
          type="button"
        >
          重新开始
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-slate-600">{introText}</p>
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="rose" />
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
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="teal" />
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
          {choiceBoard.map((station) => {
            const done = arrivedStations.includes(station.label);

            return (
              <button
                key={station.label}
                onClick={() => pickStation(station.label)}
                disabled={done || completed}
                className={`rounded-[1.3rem] px-3 py-4 text-center text-sm font-semibold transition ${
                  done
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-white text-slate-800 hover:-translate-y-0.5 hover:bg-teal-100"
                }`}
                type="button"
              >
                <span className="block text-3xl">{station.icon}</span>
                <span className="mt-2 block">{station.label}</span>
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
  const [rounds, setRounds] = useState(() => createFoodGuessRound());
  const [roundIndex, setRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
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
      setRoundIndex((index) => index + 1);
    }
  }

  function resetGame() {
    setRounds(createFoodGuessRound());
    setRoundIndex(0);
    setAnswers([]);
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
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="cyan" />
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
  const [initialRound] = useState(() => createFoodTreasureRound());
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
      const message = "泉州美食摊位寻宝完成啦。你认识了名字、食材、小故事，也选了靠近美食的小步骤。AI成长观察已记录。";
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
          {questFoods.map((food, index) => {
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
        {choiceBoard.map((food) => {
          const done = matched.includes(food.label);
          const disabled = done || completed;

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
            className="mt-4 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
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
  onPickFood: (foodLabel: string) => void;
}) {
  const menuSpeech = buildTodayMenuSpeech(entries);

  if (entries.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-cyan-200 bg-white/78 p-5 shadow-sm xl:col-span-2">
        <p className="text-sm font-semibold text-cyan-700">今日闽食播报</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">等待老师发布今日食谱</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          老师在教师工作台发布今日食谱后，这里会先播报今天会遇见的菜品和重点食材。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#fff7ed_100%)] p-5 shadow-[0_18px_50px_rgba(35,88,95,0.10)] xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">今日闽食播报</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">先听今天会遇见的菜和食材</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            老师发布的今日食谱会优先进入美食认识观察卡，孩子可以先看一看、闻一闻，不着急入口。
          </p>
        </div>
        <SpeechCueButton text={menuSpeech} onSpeak={onSpeak} label="听今日食谱" tone="cyan" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {entries.map((entry) => {
          const focusText =
            entry.focusIngredients.length > 0
              ? entry.focusIngredients.join("、")
              : entry.ingredients.slice(0, 3).join("、") || "观察颜色和气味";

          return (
            <button
              key={entry.id}
              onClick={() => onPickFood(entry.dishName)}
              className="rounded-[1.5rem] bg-white/86 px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-50"
              type="button"
            >
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-900">
                {entry.mealType}
              </span>
              <span className="mt-3 block text-lg font-semibold text-slate-900">{entry.dishName}</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">
                食材：{entry.ingredients.join("、") || "老师稍后补充"}
              </span>
              <span className="mt-2 block rounded-[1.1rem] bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                点击进入观察：{focusText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FoodPreferenceGame({
  contentConfig,
  onComplete,
  onSpeak,
  preferredFoodLabel = "",
  todayMenuEntries = [],
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (record: FoodPreferenceRecord) => void;
  onSpeak?: SpeakHandler;
  preferredFoodLabel?: string;
  todayMenuEntries?: WeeklyMenuEntry[];
}) {
  const cleanPreferredFood = preferredFoodLabel.trim();
  const [foodChoices, setFoodChoices] = useState(() => {
    const initialFoods = createFoodPreferenceRound(todayMenuEntries).foods;

    return cleanPreferredFood && !initialFoods.some((food) => food.label === cleanPreferredFood)
      ? [buildFoodPreferenceOption(cleanPreferredFood), ...initialFoods].slice(0, 18)
      : initialFoods;
  });
  const [reasonChoices, setReasonChoices] = useState(() => createFoodPreferenceRound(todayMenuEntries).reasons);
  const [selectedFood, setSelectedFood] = useState(cleanPreferredFood);
  const [selectedReason, setSelectedReason] = useState("");
  const [selectedApproachStep, setSelectedApproachStep] = useState("");
  const [customFoodMode, setCustomFoodMode] = useState(false);
  const [customFoodName, setCustomFoodName] = useState("");
  const [isListeningForFood, setIsListeningForFood] = useState(false);
  const [feedback, setFeedback] = useState(
    cleanPreferredFood
      ? `已选择${cleanPreferredFood}。再说说原因，并选一个愿意靠近的小步。`
      : "选一种今天正在认识的食物，再说说原因和愿意靠近的小步。",
  );
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const completionReportedRef = useRef(false);
  const displayFoodChoices = useMemo(() => {
    const menuChoices = createMenuFoodPreferenceChoices(todayMenuEntries);
    const menuLabelSet = new Set(menuChoices.map((item) => item.label));
    const customAndFallbackChoices = foodChoices.filter((item) => !menuLabelSet.has(item.label));

    return [...menuChoices, ...customAndFallbackChoices].slice(0, 18);
  }, [foodChoices, todayMenuEntries]);
  const selectedFoodInfo =
    displayFoodChoices.find((food) => food.label === selectedFood) ??
    (selectedFood ? buildFoodPreferenceOption(selectedFood) : null);
  const introText =
    contentConfig?.childGoal.trim() ||
    "这不是给孩子贴标签，只记录今天还在认识的食物，帮助老师和家长温和陪伴。";
  const foodRoleIntroText = selectedFoodInfo
    ? `我是${selectedFoodInfo.label}。我的身体里有${selectedFoodInfo.ingredients.join("、")}。${selectedFoodInfo.ingredientIntro}你今天还在认识我也没关系，先看见名字和食材就很好。`
    : "";

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
      foodLabel: selectedFood,
      reasonLabel: nextReason,
      reason: nextReason,
      strategy: reason?.strategy ?? "",
      gentleTryTip: `今天选择了一个靠近小步：${nextApproach}。${food.gentleTryTip}`,
      approachStep: nextApproach,
      themeSource: "foodPreference",
      ...menuContext,
    });
  }

  function handleFoodPick(label: string) {
    const food = displayFoodChoices.find((item) => item.label === label) ?? buildFoodPreferenceOption(label);
    setSelectedFood(label);
    setSelectedReason("");
    setSelectedApproachStep("");
    setCustomFoodMode(false);
    const message = food
      ? `我是${food.label}。我的身体里有${food.ingredients.join("、")}。${food.ingredientIntro}你今天还在认识我也没关系，先看见名字和食材就很好。`
      : "记录下来：今天有一种食物还在慢慢认识。";
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
        ? `谢谢你告诉我：今天可能是${reason.label}。我是${food.label}，我里面有${food.ingredients.join("、")}。接下来选一个愿意靠近的小步就好。`
        : "已经记录原因，先认识这种食物就很好。";
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
    const message = `你告诉我你正在认识${selectedFood}，今天先${step}也很好。AI成长观察已记录。`;
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
      return exists ? current : [buildFoodPreferenceOption(label), ...current].slice(0, 18);
    });
    handleFoodPick(label);
  }

  function toggleCustomFoodVoice() {
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
      setFeedback("当前浏览器不支持语音输入，可以先用文字输入。");
      return;
    }

    if (isListeningForFood && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningForFood(false);
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        applyCustomFoodName(transcript.replace(/[。？！,.，、\s]/g, ""));
      }
    };
    recognition.onerror = () => {
      setFeedback("刚才没听清楚，可以再说一次食物名字，或用文字输入。");
      setIsListeningForFood(false);
    };
    recognition.onend = () => setIsListeningForFood(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListeningForFood(true);
    setFeedback("我在听啦，可以说“香菇”“青椒”或其他正在认识的食物。");
  }

  function resetGame() {
    const nextRound = createFoodPreferenceRound(todayMenuEntries);
    setFoodChoices(nextRound.foods);
    setReasonChoices(nextRound.reasons);
    setSelectedFood("");
    setSelectedReason("");
    setSelectedApproachStep("");
    setCustomFoodMode(false);
    setCustomFoodName("");
    setFeedback("食物卡和原因卡已经换顺序啦。选一种今天正在认识的食物，再说说原因和愿意靠近的小步。");
    completionReportedRef.current = false;
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">观察陌生食材</p>
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
        <p className="text-sm font-semibold text-cyan-900">今天哪一种正在认识？</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {displayFoodChoices.map((food) => {
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
        <div className="mt-4 rounded-[1.3rem] bg-white/80 p-4">
          <button
            onClick={() => setCustomFoodMode((current) => !current)}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
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
                className="rounded-full bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                记录这个食物
              </button>
              <button
                onClick={toggleCustomFoodVoice}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  isListeningForFood ? "bg-rose-100 text-rose-800" : "bg-cyan-100 text-cyan-900"
                }`}
                type="button"
              >
                {isListeningForFood ? "我说完了" : "语音说食物"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">可能是什么原因？</p>
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
                {reason.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-[1.6rem] bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">今天愿意靠近哪一步？</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {foodPreferenceApproachSteps.map((step) => {
            const selected = selectedApproachStep === step;

            return (
              <button
                key={step}
                onClick={() => handleApproachPick(step)}
                className={`rounded-[1.4rem] px-4 py-3 text-left text-sm font-semibold transition ${
                  selected
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-800 hover:-translate-y-0.5 hover:bg-emerald-100"
                }`}
                type="button"
              >
                {step}
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

function FoodKitchenGame({
  contentConfig,
  onComplete,
  onSpeak,
}: {
  contentConfig?: EditableGameContent;
  onComplete?: (
    pickedItems: string[],
    detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>,
  ) => void;
  onSpeak?: SpeakHandler;
}) {
  const [recipeChoices, setRecipeChoices] = useState(() => createFoodKitchenRound());
  const [selectedRecipeLabel, setSelectedRecipeLabel] = useState("");
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("选一道泉州美食，按顺序点制作动作卡。");
  const [kitchenSentence, setKitchenSentence] = useState("");
  const [aiBroadcastText, setAiBroadcastText] = useState("");
  const [workMediaPreview, setWorkMediaPreview] = useState("");
  const [workMediaName, setWorkMediaName] = useState("");
  const [workMediaType, setWorkMediaType] = useState<"image" | "video" | "">("");
  const completionReportedRef = useRef(false);
  const selectedRecipe =
    recipeChoices.find((item) => item.label === selectedRecipeLabel) ?? recipeChoices[0] ?? foodKitchenRecipes[0];
  const introText =
    contentConfig?.childGoal.trim() ||
    "在区域或家庭发现、制作泉州美食后，选择美食、点动作卡、上传作品，再让 AI 帮忙整理一句播报词。";
  const nextAction = selectedRecipe?.actions[completedActions.length];
  const completed = Boolean(selectedRecipe && completedActions.length === selectedRecipe.actions.length);
  const hasSelectedRecipe = Boolean(selectedRecipeLabel);
  const canOrganizeBroadcast = hasSelectedRecipe || Boolean(kitchenSentence.trim()) || Boolean(workMediaName);
  const hasActionOrUpload = completedActions.length > 0 || Boolean(workMediaName);

  useEffect(() => {
    return () => {
      if (workMediaPreview) {
        URL.revokeObjectURL(workMediaPreview);
      }
    };
  }, [workMediaPreview]);

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

  function pickRecipe(label: string) {
    const recipe = recipeChoices.find((item) => item.label === label);

    setSelectedRecipeLabel(label);
    setCompletedActions([]);
    setKitchenSentence("");
    setAiBroadcastText("");
    handleWorkMediaSelect();
    completionReportedRef.current = false;
    const message = recipe
      ? `${recipe.area}开张啦。第一步：${recipe.actions[0]}。`
      : "泉州小厨房开张啦，请选一道美食。";
    setFeedback(message);
    onSpeak?.(message);
  }

  function pickAction(action: string) {
    if (!selectedRecipe || completed) {
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
      ? `${buildKitchenStepSpeech(selectedRecipe)} 步骤完成啦，可以上传照片或视频，再说一句介绍进行播报分享。`
      : `做对啦。下一步：${selectedRecipe.actions[nextActions.length]}。`;
    setFeedback(message);
    onSpeak?.(message);
  }

  function resetGame() {
    const nextRecipes = createFoodKitchenRound();
    setRecipeChoices(nextRecipes);
    setSelectedRecipeLabel(nextRecipes[0]?.label ?? "");
    setCompletedActions([]);
    setKitchenSentence("");
    setAiBroadcastText("");
    handleWorkMediaSelect();
    setFeedback("小厨房菜单已经换顺序啦。选一道泉州美食，按顺序点制作动作卡。");
    completionReportedRef.current = false;
  }

  function organizeKitchenBroadcast() {
    if (!canOrganizeBroadcast) {
      const message = "先选一道美食，或者说一句你的想法。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const nextBroadcast = buildKitchenBroadcastText(selectedRecipe, kitchenSentence, workMediaName);
    const message = `AI帮你整理好了：${nextBroadcast}`;

    setAiBroadcastText(nextBroadcast);
    setFeedback(message);
    onSpeak?.(message);
  }

  function playKitchenBroadcast() {
    if (!aiBroadcastText) {
      const message = "先点 AI帮我整理，生成播报词。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    setFeedback("正在播放小小播报词。");
    onSpeak?.(aiBroadcastText);
  }

  function completeKitchenShare() {
    if (!hasActionOrUpload) {
      const message = "先上传作品或完成一个动作。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    if (!aiBroadcastText) {
      const message = "先点 AI帮我整理，再完成播报分享。";
      setFeedback(message);
      onSpeak?.(message);
      return;
    }

    const sentence = aiBroadcastText;
    const message = `小厨师播报：${sentence} AI成长观察已记录，可以和同伴分享。`;
    setFeedback(message);
    onSpeak?.(message);
    setAiBroadcastText(sentence);

    if (!completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.([
        selectedRecipe.label,
        ...completedActions,
        `上传文件:${workMediaName}`,
        `孩子原话:${kitchenSentence.trim() || "还在练习表达"}`,
        `AI播报:${sentence}`,
        workMediaName ? `本机${workMediaType === "video" ? "视频" : "照片"}：${workMediaName}` : "",
      ].filter(Boolean), {
        foodLabel: selectedRecipe.label,
        uploadedFileName: workMediaName,
        childUtterance: kitchenSentence.trim() || "还在练习表达",
        aiBroadcastText: sentence,
      });
    }
  }

  return (
    <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-700">小厨房播报</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {contentConfig?.title || "泉州小厨房"}
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
        <SpeechCueButton text={introText} onSpeak={onSpeak} label="听规则" tone="orange" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {recipeChoices.map((recipe) => (
          <button
            key={recipe.label}
            onClick={() => pickRecipe(recipe.label)}
            className={`rounded-[1.4rem] px-4 py-3 text-left text-sm font-semibold transition ${
              selectedRecipeLabel === recipe.label
                ? "bg-orange-100 text-orange-900 ring-2 ring-orange-200"
                : "bg-amber-50 text-slate-700 hover:-translate-y-0.5 hover:bg-amber-100"
            }`}
            type="button"
          >
            <span className="text-2xl">{recipe.icon}</span> {recipe.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[1.8rem] bg-orange-50 p-5">
        <p className="text-sm font-semibold text-orange-900">{selectedRecipe?.area ?? "泉州小厨房"}</p>
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
                <span className="mt-1 block">{action}</span>
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
            label="听口令"
            tone="orange"
          />
        </div>
      </div>

      {completed ? (
        <div className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">
          步骤完成啦。上传照片或视频，说一句介绍，再点“AI帮我整理”和“听我的播报”。
        </div>
      ) : null}

      <div className="mt-4 rounded-[1.6rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">小厨房作品上传与播报</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            上传美食照片或视频
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => handleWorkMediaSelect(event.target.files?.[0])}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            我想这样介绍
            <input
              value={kitchenSentence}
              onChange={(event) => setKitchenSentence(event.target.value.slice(0, 90))}
              placeholder={selectedRecipe ? `例如：我做${selectedRecipe.label} / 热热的 / 我不知道怎么说` : "说一句小厨师介绍"}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-orange-300"
            />
          </label>
        </div>
        {workMediaPreview ? (
          <div className="mt-4 overflow-hidden rounded-[1.3rem] bg-white p-3 shadow-sm">
            {workMediaType === "video" ? (
              <video src={workMediaPreview} controls className="h-48 w-full rounded-[1rem] object-cover" />
            ) : (
              <div
                aria-label="泉州小厨房作品预览"
                className="h-48 w-full rounded-[1rem] bg-cover bg-center"
                role="img"
                style={{ backgroundImage: `url(${workMediaPreview})` }}
              />
            )}
            <p className="mt-2 text-xs font-semibold text-slate-500">
              当前作品：{workMediaName}。文件只在本机预览，成长记录保存文件名。
            </p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-7 text-slate-600">
            小小播报员可以接着小厨房作品做分享：先展示作品，再说名字、食材和一个发现。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={organizeKitchenBroadcast}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                canOrganizeBroadcast
                  ? "bg-orange-100 text-orange-900"
                  : "bg-slate-100 text-slate-500"
              }`}
              type="button"
            >
              AI帮我整理
            </button>
            <button
              onClick={playKitchenBroadcast}
              className={`rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${
                aiBroadcastText ? "text-slate-700" : "text-slate-400"
              }`}
              type="button"
            >
              听我的播报
            </button>
          </div>
          <button
            onClick={completeKitchenShare}
            className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
              hasActionOrUpload ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
            }`}
            type="button"
          >
            完成播报分享
          </button>
        </div>
        {aiBroadcastText ? (
          <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold leading-7 text-orange-950 shadow-sm">
            AI整理后的播报词：{aiBroadcastText}
          </div>
        ) : null}
      </div>
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
  const uniqueBadgeCount = countUniqueBadges(archive, childId);
  const totalMiniGames = getMiniGameCompletionTotal(archive, childId);
  const latestBadges = visibleBadgeRecords.slice(0, 4);
  const latestReviews = visibleMealReviews.slice(0, 2);
  const latestMiniGameBadge = visibleBadgeRecords.find((item) => item.source === "mini-game");
  const badgeLevel = getBadgeLevelSummary(archive, childId);
  const nextFocus =
    totalMiniGames < 2
      ? "先完成一个成长任务"
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
          <p className="text-xs font-semibold text-slate-500">成长任务记录</p>
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
                还没有勋章记录，先完成一个成长任务或经确认的拍图记录吧。故事互动会先给进度贴纸。
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
  const [storyInteractionMode, setStoryInteractionMode] =
    useState<StoryInteractionMode>("adventure");
  const [latestPictureBookText, setLatestPictureBookText] = useState("");
  const [pictureBookCheckinFeedback, setPictureBookCheckinFeedback] =
    useState("听完绘本后，选择一张阅读打卡答案卡。");
  const [pictureBookCheckinDone, setPictureBookCheckinDone] = useState(false);
  const [pictureBookCheckinOptions, setPictureBookCheckinOptions] = useState(
    defaultPictureBookCheckinOptions,
  );
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
  const [todayMenuEntries, setTodayMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [preferredFoodRequest, setPreferredFoodRequest] = useState({
    label: "",
    nonce: 0,
  });
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const lastAutoSpokenMessageRef = useRef("");
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const activeTheme = themes[themeId];
  const storyPanelCopy =
    themeId === "food"
      ? {
          eyebrow: "闽食绘本摊",
          title: "听泉州美食绘本，或继续闽食故事",
          pictureBookLabel: "听闽食绘本",
          adventureLabel: "逛闽食故事",
          prompt:
            storyInteractionMode === "pictureBook"
              ? "说一句想认识的泉州美食，AI 会讲一段闽食绘本，听完后用食物、画面或喜欢点打卡。"
              : "说一句闽食发现，AI 会继续泉州美食故事，也可以按这句话生成插图。",
          picturePlaceholder: "可以说：我想听海蛎小勇士的绘本",
          adventurePlaceholder: "可以说：我想让海蛎小勇士去古城小吃摊",
          imageTitle: "边听边看闽食绘本画面",
        }
      : {
          eyebrow: "幼习宝绘本馆",
          title: "听好习惯绘本，或继续成长故事",
          pictureBookLabel: "听习惯绘本",
          adventureLabel: "练成长故事",
          prompt:
            storyInteractionMode === "pictureBook"
              ? "说一句想练习的好习惯，AI 会讲一段生活化绘本，听完后用角色、画面或图书归位打卡。"
              : "说一句生活场景，AI 会继续成长故事，也可以按这句话生成插图。",
          picturePlaceholder: "可以说：我想听饭前洗手小星的绘本",
          adventurePlaceholder: "可以说：我想练习餐后整理的小故事",
          imageTitle: "边听边看好习惯绘本画面",
        };
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
  const todayAiRecordCount = useMemo(() => {
    const todayKey = new Date().toDateString();
    const isToday = (value: string) => {
      const date = new Date(value);

      return !Number.isNaN(date.getTime()) && date.toDateString() === todayKey;
    };
    const matchChild = (record: ChildRecordFields) =>
      selectedChild ? record.childId === selectedChild.id : !record.childId;
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
      setTodayMenuEntries(
        getPublishedMenuForDate(
          parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)),
          getLocalDateKey(),
        ),
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
        ...extraDetail,
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
        ? `AI成长观察已更新：${record.foodLabel} · ${record.reasonLabel}`
        : `AI成长观察：${badgeName} · ${gameContent?.title || record.foodLabel} · ${record.reasonLabel}`,
    );
    setLatestExperienceStickerFeedback("");
    setLatestGrowthFeedbackSource("mini-game");
    setStatus(
      [
        `AI成长观察：孩子正在认识“${record.foodLabel}”`,
        record.dishName && record.dishName !== record.foodLabel ? `今日食谱关联：${record.dishName}` : "",
        `选择/动作记录：${record.reasonLabel}${record.approachStep ? `，${record.approachStep}` : ""}`,
        `观察线索：${followUp.observation}`,
        `阶段提示：${stage}`,
        `下一步温和跟进：${followUp.homeTask}`,
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
    setPictureBookCheckinOptions(defaultPictureBookCheckinOptions);
    setPictureBookCheckinDone(false);
    setLatestPictureBookText("");
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
    setPictureBookCheckinOptions(defaultPictureBookCheckinOptions);
    setPictureBookCheckinDone(false);
    setLatestPictureBookText("");
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

    const cleanText =
      storyDraft.trim() ||
      (themeId === "food" ? "我想听一个泉州美食绘本故事" : "我想听一个幼习宝好习惯绘本故事");
    setIsLoading(true);
    setStoryInteractionMode("pictureBook");
    setStatus("故事伙伴正在翻绘本，马上讲给你听...");
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
          theme: themeId,
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
        Array.isArray(data.choices) && data.choices.length > 0 ? data.choices : activeTheme.choices;

      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      setQuickChoices(choices);
      setLatestPictureBookText(reply);
      setPictureBookCheckinOptions(buildPictureBookCheckinOptions(choices));
      setPictureBookCheckinDone(false);
      setPictureBookCheckinFeedback("绘本听完啦，选一张答案卡完成阅读打卡。");
      setLatestBadgeFeedback("");
      setLatestGrowthFeedbackSource("");
      setLatestExperienceStickerFeedback("绘本倾听贴纸：已经听完一个绘本故事，完成阅读打卡后会写入成长记录。");
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

  function completePictureBookCheckin(option: PictureBookCheckinOption) {
    if (!latestPictureBookText) {
      const message = "先生成并听一段绘本故事，再完成阅读打卡。";
      setPictureBookCheckinFeedback(message);
      setStatus(message);
      return;
    }

    if (pictureBookCheckinDone) {
      const message = "这次绘本已经完成阅读打卡啦，可以继续听绘本或去玩一个成长任务。";
      setPictureBookCheckinFeedback(message);
      void startSpeechPlayback(message);
      return;
    }

    const pickedItems = [themeId === "food" ? "闽食绘本摊" : "幼习宝绘本馆", option.label, option.source];
    logMiniGameCompletion("readingCheckin", "阅读小书虫", pickedItems);
    setPictureBookCheckinDone(true);
    setPictureBookCheckinFeedback(`${option.feedback} 下一步：再玩一个任务、继续冒险，或查看成长记录。`);
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
      <section className="hidden">
        <ChildIdentityPanel
          childRoster={childRoster}
          selectedChildId={selectedChildId}
        />
      </section>

      <section>
        <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#fff6d6_0%,#ffffff_52%,#dff8f7_100%)] p-5 shadow-[0_20px_60px_rgba(49,93,104,0.14)] md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {Object.values(themes).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => switchTheme(theme.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    theme.id === themeId
                      ? "bg-slate-900 text-white shadow-md"
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
              回到儿童入口重新识别
            </Link>
          </div>

          <div className="mt-5 rounded-[1.6rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal-700">我的小名牌 · 今日AI成长状态</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedChild ? formatChildLabel(selectedChild) : "还没拿到小名牌"}
                </h1>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  当前主题：{activeTheme.label}
                </p>
                <p className="mt-3 max-w-3xl text-base leading-7 font-semibold text-slate-900">
                  {latestBadgeFeedback || status}
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-2 gap-3 sm:w-auto sm:grid-cols-3">
                <div className="rounded-[1.2rem] bg-teal-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-teal-700">AI记录</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{todayAiRecordCount}</p>
                </div>
                <div className="rounded-[1.2rem] bg-emerald-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-emerald-700">已点亮章</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {activeThemeBadges.length}
                  </p>
                </div>
                <div className="rounded-[1.2rem] bg-amber-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-amber-700">播报</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {autoSpeak ? "开" : "关"}
                  </p>
                </div>
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
              <div className="flex flex-wrap gap-2">
                {imageFeatureEnabled ? (
                  <button
                    onClick={() => void generateImage(storyDraft)}
                    className="hidden"
                    type="button"
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
            </div>
          </div>
        </div>
      </section>

      <section className="hidden">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">{storyPanelCopy.eyebrow}</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{storyPanelCopy.title}</h2>
            </div>
            <div className="flex rounded-full bg-slate-100 p-1">
              {[
                { id: "pictureBook", label: storyPanelCopy.pictureBookLabel },
                { id: "adventure", label: storyPanelCopy.adventureLabel },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStoryInteractionMode(item.id as StoryInteractionMode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    storyInteractionMode === item.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  }`}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {storyPanelCopy.prompt}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={storyDraft}
                onChange={(event) => setStoryDraft(event.target.value.slice(0, storyInputMaxLength))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (storyInteractionMode === "pictureBook") {
                      void generatePictureBookStory();
                      return;
                    }

                    void submitStoryDraft();
                  }
                }}
                placeholder={
                  storyInteractionMode === "pictureBook"
                    ? storyPanelCopy.picturePlaceholder
                    : storyPanelCopy.adventurePlaceholder
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
              {storyInteractionMode === "pictureBook" ? (
                <>
                  <button
                    onClick={() => void generatePictureBookStory()}
                    disabled={isLoading}
                    className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-amber-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    type="button"
                  >
                    {isLoading ? "正在翻绘本..." : storyPanelCopy.pictureBookLabel}
                  </button>
                  <button
                    onClick={() => void startSpeechPlayback(latestPictureBookText || lastAssistantMessage)}
                    disabled={!latestPictureBookText && !lastAssistantMessage}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    type="button"
                  >
                    播放绘本
                  </button>
                </>
              ) : (
                <button
                  onClick={() => void submitStoryDraft()}
                  disabled={!storyDraft.trim() || isLoading}
                  className="rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  type="button"
                >
                  {isLoading ? "故事生成中..." : "继续故事"}
                </button>
              )}
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
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{storyPanelCopy.imageTitle}</h3>
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
                      <p className="text-lg font-semibold text-slate-700">先听故事和做成长任务</p>
                      <p className="mt-2 max-w-sm text-sm leading-7 text-slate-500">
                        今天先用声音、故事和成长任务完成练习，贴纸会在成长册里点亮。
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

          {storyInteractionMode === "pictureBook" ? (
            <div className="mt-5 rounded-[1.8rem] bg-violet-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-violet-700">阅读打卡</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">
                    听完故事，选一张答案卡
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    答案卡会根据刚才 AI 绘本里的后续选项生成，再加上“图书归位”习惯卡；幼儿只要选择角色、画面、喜欢点或归位动作中的一项，就能完成阅读打卡。
                  </p>
                </div>
                <SpeechCueButton
                  text={`听完故事后，选一张答案卡。${pictureBookCheckinOptions
                    .map((option) => option.label)
                    .join("。")}。`}
                  onSpeak={(text) => {
                    void startSpeechPlayback(text);
                  }}
                  label="听问题"
                  tone="violet"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {pictureBookCheckinOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => completePictureBookCheckin(option)}
                    className={`rounded-[1.4rem] px-4 py-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
                      pictureBookCheckinDone
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-white text-violet-950 shadow-sm"
                    }`}
                    type="button"
                  >
                    {option.label}
                    <span className="mt-1 block text-xs leading-5 opacity-75">{option.source}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-[1.2rem] bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-violet-900">{pictureBookCheckinFeedback}</p>
              </div>
            </div>
          ) : null}

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
          <section className="hidden">
            <HabitVisualBoard
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onTaskComplete={(gameKey, badgeName, pickedItems) =>
                logMiniGameCompletion(gameKey, badgeName, pickedItems)
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

      <section className="order-1 grid gap-6 xl:grid-cols-2">
        {themeId === "habit" ? (
          <>
            <div className="xl:col-span-2">
              <HabitVisualBoard
                onSpeak={(text) => {
                  void startSpeechPlayback(text);
                }}
                onTaskComplete={(gameKey, badgeName, pickedItems) =>
                  logMiniGameCompletion(gameKey, badgeName, pickedItems)
                }
              />
            </div>
            <MealMannersGame
              contentConfig={getConfiguredGameContent("mealManners")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems) =>
                logMiniGameCompletion("mealManners", "文明进餐章", pickedItems)
              }
            />
            <HabitTrafficLightGame
              contentConfig={getConfiguredGameContent("habitTrafficLight")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems) =>
                logMiniGameCompletion("habitTrafficLight", "好习惯判断章", pickedItems)
              }
            />
            <details open className="rounded-[2rem] bg-white/80 p-5 shadow-sm xl:col-span-2">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                习惯故事小剧场：听短故事、做小任务
              </summary>
              <div className="mt-4">
                <ReadingCheckinGame
                  contentConfig={getConfiguredGameContent("readingCheckin")}
                  onSpeak={(text) => {
                    void startSpeechPlayback(text);
                  }}
                  onComplete={(pickedItems, detail) =>
                    logMiniGameCompletion("readingCheckin", "故事小耳朵", pickedItems, detail)
                  }
                />
              </div>
            </details>
          </>
        ) : (
          <>
            <TodayMenuBroadcast
              entries={todayMenuEntries}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onPickFood={(foodLabel) => {
                setPreferredFoodRequest((current) => ({
                  label: foodLabel,
                  nonce: current.nonce + 1,
                }));
                const message = `已把${foodLabel}带到美食认识观察卡。可以先选原因，再选一个靠近小步。`;
                setStatus(message);
                void startSpeechPlayback(message);
              }}
            />
            <FoodTrainGame
              contentConfig={getConfiguredGameContent("foodTrain")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems) =>
                logMiniGameCompletion("foodTrain", "闽食小勇士章", pickedItems)
              }
            />
            <FoodTreasureQuestGame
              contentConfig={getConfiguredGameContent("foodObserve")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems = []) =>
                logMiniGameCompletion("foodObserve", "美食摊位寻宝章", pickedItems)
              }
            />
            <FoodPreferenceGame
              key={`food-preference-${preferredFoodRequest.nonce}`}
              contentConfig={getConfiguredGameContent("foodPreference")}
              todayMenuEntries={todayMenuEntries}
              preferredFoodLabel={preferredFoodRequest.label}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={logFoodPreferenceObservation}
            />
            <FoodKitchenGame
              contentConfig={getConfiguredGameContent("foodKitchen")}
              onSpeak={(text) => {
                void startSpeechPlayback(text);
              }}
              onComplete={(pickedItems, detail) =>
                logMiniGameCompletion("foodKitchen", "泉州小厨师章", pickedItems, detail)
              }
            />
            <details className="hidden">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                可选延伸：美食猜猜乐
              </summary>
              <div className="mt-4">
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
            </details>
          </>
        )}
      </section>

    </div>
  );
}
