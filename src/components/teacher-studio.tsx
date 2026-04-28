"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { formatChildLabel } from "@/lib/child-identity";
import {
  childRosterStorageKey,
  createEmptyGrowthArchive,
  growthArchiveStorageKey,
  parseChildRoster,
  parseGrowthArchive,
  selectedChildStorageKey,
  type ChildProfile,
  type FoodPreferenceRecord,
  type GrowthArchive,
  type MiniGameRecord,
} from "@/lib/growth-archive";
import {
  buildParentSyncFromFoodPreference,
  buildParentSyncFromMiniGame,
  formatParentSyncTime,
  getFoodPreferenceFollowUp,
  getMiniGameFollowUp,
  getParentFeedbackCategoryLabel,
  parentFeedbackStorageKey,
  parentSyncStorageKey,
  parseParentFeedbackRecords,
  parseParentSyncRecords,
  type ParentFeedbackRecord,
  type ParentSyncRecord,
} from "@/lib/parent-sync";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  getLocalDateKey,
  mealTypeOptions,
  parseWeeklyMenuEntries,
  serializeWeeklyMenuEntries,
  splitMenuText,
  weeklyMenuStorageKey,
  type MealType,
  type WeeklyMenuEntry,
} from "@/lib/weekly-menu";
import {
  teacherTasks,
  themes,
  type ThemeId,
} from "@/lib/site-data";

type TeacherResponse = {
  title: string;
  content: string;
  tips: string[];
  error?: string;
  fallbackUsed?: boolean;
  needsReview?: boolean;
};

type SavedTeacherResult = TeacherResponse & {
  id: string;
  themeId: ThemeId;
  task: string;
  scenario: string;
  savedAt: string;
  pinned?: boolean;
};

type ParentFeedbackDraft = {
  reply: string;
  guidance: string;
};

const teacherScenarioMaxLength = 680;
const teacherHistoryLimit = 6;
const teacherAccountStorageKey = "tongqu-growth-web-teacher-account";
const teacherPasscodeStorageKey = "tongqu-growth-web-teacher-passcode";
const teacherSessionStorageKey = "tongqu-growth-web-teacher-session";
const trialTeacherAccount = "班级试用教师";
const trialTeacherPasscode = "1234";
const menuFocusIngredientSuggestions = ["香菇", "小葱", "蒜", "青菜", "芥菜", "海蛎", "紫菜", "蛏子"];
const classroomPlanRequirement =
  "请依据《3-6岁儿童学习与发展指南》和《幼儿园教育指导纲要》生成一节幼儿园活动方案，语言童趣温柔、正向不贴标签，结构包含活动名称、适用年龄、活动时长、活动目标、准备材料、活动流程、儿歌/口令、教师引导语、观察要点、家园延伸和注意事项。";
const teacherAgeOptions = [
  {
    label: "小班 3-4 岁",
    focus: "参考《指南》和《纲要》，集中活动建议 10-15 分钟，以模仿、感知、短句回应和动作游戏为主。",
  },
  {
    label: "中班 4-5 岁",
    focus: "参考《指南》和《纲要》，集中活动建议 15-20 分钟，加入观察、表达、简单排序、比较和初步合作。",
  },
  {
    label: "大班 5-6 岁",
    focus: "参考《指南》和《纲要》，集中活动建议 20-30 分钟，加入讨论、简单记录、分享、规则意识和迁移表达。",
  },
] as const;
const defaultTeacherAgeGroup = teacherAgeOptions[1].label;
const defaultTeacherTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
type TeacherTaskItem = (typeof teacherTasks)[number];
const quickTeacherKeywords = [
  "洗手",
  "喝水",
  "如厕",
  "整理",
  "排队",
  "文明进餐",
  "今日食谱",
  "食物观察",
  "家园任务",
] as const;

function generateFamilyBindingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function isActivityPlanTask(task: string) {
  return /活动课程方案|课堂活动方案/.test(task);
}

function resolveTeacherAgeGroup(text: string) {
  if (/小班|3\s*-\s*4|3-4|3 至 4|3到4/.test(text)) {
    return teacherAgeOptions[0].label;
  }

  if (/大班|5\s*-\s*6|5-6|5 至 6|5到6/.test(text)) {
    return teacherAgeOptions[2].label;
  }

  return defaultTeacherAgeGroup;
}

function getTeacherAgeFocus(ageGroup: string) {
  return teacherAgeOptions.find((item) => item.label === ageGroup)?.focus ?? teacherAgeOptions[1].focus;
}

function getTeacherActivityDuration(ageGroup: string) {
  if (ageGroup.includes("小班")) {
    return "10-15 分钟";
  }

  if (ageGroup.includes("大班")) {
    return "20-30 分钟";
  }

  return "15-20 分钟";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTeacherPayload(payload: unknown): TeacherResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  const tips = Array.isArray(payload.tips)
    ? payload.tips
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const error = typeof payload.error === "string" ? payload.error.trim() : "";

  if (!title || !content || tips.length === 0) {
    return null;
  }

  return {
    title,
    content,
    tips,
    ...(error ? { error } : {}),
  };
}

function buildTeacherClientFallback(task: string, userInput = ""): TeacherResponse {
  const target = `${task} ${userInput}`;
  const isActivity = /活动|课程|方案|流程|目标|材料|观察|延伸/.test(target);
  const isStory = /故事|绘本|角色|情境|讲/.test(target);
  const isFood = /餐|食|闽|海蛎|紫菜|尝|播报|厨房|小厨师/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const ageGroup = resolveTeacherAgeGroup(target);
  const ageFocus = getTeacherAgeFocus(ageGroup);
  const activityDuration = getTeacherActivityDuration(ageGroup);
  const activityName = isFood ? "泉州美食探索小列车" : "文明进餐好习惯操";
  const title = isActivity
    ? "幼儿活动课程方案"
    : isStory
      ? "幼儿互动引导"
      : isPraise
        ? "情绪支持活动"
        : isFood
          ? "闽南食育活动"
          : "幼儿故事活动";
  const content = isActivity
    ? [
        `活动名称：${activityName}`,
        `适用年龄：${ageGroup}`,
        `活动时长：${activityDuration}`,
        "设计依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》，以可观察行为、游戏化操作和生活迁移为主。",
        isFood
          ? `活动目标：1. 能说出一种泉州美食名称。2. 能从图片或实物中找到一种食材。3. 愿意用短句介绍一个发现或选择靠近一小步。`
          : `活动目标：1. 能模仿一个进餐好习惯动作。2. 能判断一种行为是好习惯还是需要调整。3. 愿意把一个小步骤带到午餐或家庭生活里。`,
        isFood
          ? `准备材料：泉州美食站点图、食材卡、美食宝箱、贴纸。`
          : `准备材料：红绿牌、进餐动作图卡、碗筷模型、贴纸。`,
        isFood
          ? `活动流程：导入 2 分钟，用闽食小列车口令进站；感知/操作 6 分钟，幼儿看图找美食和食材卡；互动表达 5 分钟，请幼儿做小小美食播报员；生活迁移 3 分钟，选择回家介绍的一种美食；收束 2 分钟，用贴纸肯定具体发现。`
          : `活动流程：导入 2 分钟，用文明进餐操口令热身；感知/操作 6 分钟，幼儿模仿扶碗、坐稳、细嚼慢咽、整理动作；互动表达 5 分钟，用红绿牌判断行为；生活迁移 3 分钟，说说午餐或家里可以做哪一步；收束 2 分钟，肯定一个具体好习惯。`,
        isFood
          ? "儿歌/口令：闽食小列车，慢慢进小站，先看食材卡，再说小发现。"
          : "儿歌/口令：小本领，练一练，一步一步我能行。",
        isFood
          ? "教师引导语：我们先认识名字和食材，愿意靠近一点点就值得记录。"
          : "教师引导语：老师看到你正在练一个小步骤，先做一小步也很棒。",
        `教师提问：你看到了什么？下一步可以怎么做？你愿意试哪一小步？`,
        `观察要点：是否能参与操作；是否能说出一个可观察发现；是否愿意尝试或模仿目标动作。`,
        isFood
          ? `家园延伸：回家完成睡前美食小回顾，说一种今天认识的美食、一个颜色或食材，以及明天愿意靠近哪一小步。`
          : `家园延伸：回家做家庭美食小管家，饭前洗手、摆碗筷、按需取餐，餐后整理一个小地方。`,
        `注意事项：${ageFocus} 活动目标写成可观察行为，不考试、不背诵、不要求全部幼儿同一速度完成。`,
      ].join("\n")
    : isStory
      ? "有一颗小星星来到教室，它想请小朋友帮忙完成一个小任务：先看一看图片，再说一说自己的发现，最后一起试一试。"
      : isPraise
        ? "活动先接住孩子的情绪，再用角色邀请孩子完成一个很小的动作。教师只给一步提示，完成后说出具体进步。"
        : isFood
          ? "活动从闽南食物图片导入，请幼儿看颜色、闻味道、说食材，再选择愿意尝试的一小步。"
          : "请老师先讲一个短故事，再出示图片提问，最后让幼儿用动作或语言完成一个小任务。";
  const tips = isActivity
    ? ["目标只写一两条。", "流程保留操作环节。", "观察点要能记录。"]
    : isStory
      ? ["角色要贴近幼儿。", "问题不要太难。", "结尾带一个任务。"]
      : isPraise
        ? ["先接住情绪。", "不催促不比较。", "给孩子一个台阶。"]
        : isFood
          ? ["先认名字食材。", "允许只靠近一步。", "用泉州故事引入。"]
          : ["语言短一点。", "先示范再邀请。", "完成后及时表扬。"];

  return {
    title,
    content,
    tips,
  };
}

function isTeacherFallbackPayload(payload: TeacherResponse, task: string, scenario: string) {
  const fallback = buildTeacherClientFallback(task, scenario);

  return (
    payload.title === fallback.title &&
    payload.content === fallback.content &&
    payload.tips.length === fallback.tips.length &&
    payload.tips.every((tip, index) => tip === fallback.tips[index])
  );
}

function buildTeacherCopyText(
  result: TeacherResponse,
  extensionLine: string,
  task: string,
  scenario: string,
  themeId: ThemeId,
) {
  return [
    "【幼芽成长智伴｜幼习宝教育智能体教师工作台生成】",
    `主题：${themeId === "habit" ? "好习惯练习" : "闽食探索"}`,
    `任务：${task}`,
    `场景：${scenario.trim()}`,
    "",
    `【标题】${result.title}`,
    `【生成内容】${result.content}`,
    extensionLine ? `【活动延伸】${extensionLine}` : "",
    result.tips.length > 0 ? `【使用建议】\n${result.tips.map((tip, index) => `${index + 1}. ${tip}`).join("\n")}` : "",
    result.fallbackUsed ? "【提醒】当前是备用内容，请人工确认后再使用。" : "【提醒】请老师人工确认后再使用。",
  ]
    .filter(Boolean)
    .join("\n");
}

function sortTeacherHistory(history: SavedTeacherResult[]) {
  return [...history].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime();
  });
}

function limitTeacherHistory(history: SavedTeacherResult[]) {
  return sortTeacherHistory(history).slice(0, teacherHistoryLimit);
}

function buildMiniGameExtensionScenario(themeId: ThemeId, ageGroup: string = defaultTeacherAgeGroup) {
  const duration = getTeacherActivityDuration(ageGroup);

  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：${duration}。活动主题：泉州闽食探索。幼儿已有经验：刚在儿童端完成了闽食小列车、摊位寻宝、美食观察卡或泉州小厨房任务。希望目标：能说出一种泉州美食名称，观察食材或外形，并选择一个愿意靠近的小步骤。${classroomPlanRequirement}`
    : `年龄段：${ageGroup}。活动时长：${duration}。活动主题：幼习宝一日生活常规提醒。幼儿已有经验：刚在儿童端完成了洗手、喝水、如厕、整理、排队、文明进餐或红绿牌任务。希望目标：能用动作、图卡或短句完成一个生活常规或进餐习惯任务，并在生活环节尝试迁移。${classroomPlanRequirement}`;
}

function buildHomePlanScenario(themeId: ThemeId, ageGroup: string = defaultTeacherAgeGroup) {
  const duration = getTeacherActivityDuration(ageGroup);

  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：${duration}。主题：泉州美食探索。幼儿已有经验：认识少量家乡食物，但对食材、颜色和味道表达还不充分。希望目标：能说出一种泉州美食名称，找一找食材或外形特征，选择一个愿意靠近的小步骤。`
    : `年龄段：${ageGroup}。活动时长：${duration}。主题：幼习宝一日生活常规提醒。幼儿已有经验：知道饭前要洗手，但喝水、如厕表达、整理、排队和文明进餐仍需要反复提醒。希望目标：能完成一个可观察的生活常规或进餐习惯小任务，并在班级或家庭生活里尝试迁移。`;
}

function buildPreferenceInterventionScenario(record: FoodPreferenceRecord, ageGroup: string = defaultTeacherAgeGroup) {
  const followUp = getFoodPreferenceFollowUp(record);

  return `年龄段：${ageGroup}。活动时长：15-20 分钟。${followUp.activityScenario}${classroomPlanRequirement}要求不贴标签，围绕看见名字、观察食材、说出发现和选择愿意靠近的一小步设计食育课堂。`;
}

function buildTeacherTaskScenario(item: TeacherTaskItem, themeId: ThemeId, ageGroup: string) {
  return item.id === "home" ? buildHomePlanScenario(themeId, ageGroup) : item.starter;
}

function buildTeacherRequestInput(task: string, scenario: string, ageGroup: string, themeId: ThemeId) {
  const themeLabel = themeId === "food" ? "闽食成长岛" : "幼习宝";
  const ageFocus = getTeacherAgeFocus(ageGroup);
  const duration = getTeacherActivityDuration(ageGroup);

  return isActivityPlanTask(task)
    ? [
        `年龄段：${ageGroup}`,
        `主题来源：${themeLabel}`,
        "设计依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》",
        `活动时长建议：${duration}`,
        `年龄特点：${ageFocus}`,
        scenario.trim(),
        "请按幼儿园活动方案结构输出，目标写成可观察行为，环节短、游戏化、可操作，避免小学化讲授。",
      ].join("\n")
    : [
        `年龄段参考：${ageGroup}`,
        `主题来源：${themeLabel}`,
        "依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》",
        `年龄特点：${ageFocus}`,
        scenario.trim(),
      ].join("\n");
}

function hasThemeMiniGameRecord(rawArchive: string | null, themeId: ThemeId) {
  const archive = parseGrowthArchive(rawArchive);

  return themeId === "food"
    ? archive.miniGameProgress.foodObserve > 0 ||
        archive.miniGameProgress.foodClue > 0 ||
        archive.miniGameProgress.kindWords > 0 ||
        archive.miniGameProgress.foodTrain > 0 ||
        archive.miniGameProgress.foodGuess > 0 ||
        archive.miniGameProgress.foodPreference > 0 ||
        archive.miniGameProgress.foodReporter > 0 ||
        archive.miniGameProgress.foodKitchen > 0 ||
        archive.miniGameProgress.peerEncourage > 0 ||
        archive.miniGameProgress.mealTray > 0
    : archive.miniGameProgress.washSteps > 0 ||
        archive.miniGameProgress.queue > 0 ||
        archive.miniGameProgress.habitJudge > 0 ||
        archive.miniGameProgress.readingCheckin > 0 ||
        archive.miniGameProgress.mealManners > 0 ||
        archive.miniGameProgress.habitTrafficLight > 0;
}

function parseRosterImportText(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/,|\t|，/).map((item) => item.trim()));

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0];
  const hasHeader = header.some((item) => /班级|号数|姓名|class|number|name/i.test(item));
  const classIndex = hasHeader ? header.findIndex((item) => /班级|class/i.test(item)) : -1;
  const numberIndex = hasHeader ? header.findIndex((item) => /号数|序号|number|no\.?|学号/i.test(item)) : -1;
  const nameIndex = hasHeader ? header.findIndex((item) => /姓名|幼儿|name/i.test(item)) : -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((parts) => {
      if (hasHeader) {
        const className = classIndex >= 0 ? parts[classIndex] ?? "" : "";
        const rosterNumber = numberIndex >= 0 ? parts[numberIndex] ?? "" : "";
        const name = nameIndex >= 0 ? parts[nameIndex] ?? "" : "";

        return {
          className: className.trim().slice(0, 16),
          name: name.trim().slice(0, 12),
          rosterNumber: rosterNumber.replace(/[^\d]/g, "").slice(0, 3),
        };
      }

      const [first = "", second = "", third = ""] = parts;
      const hasThreeColumns = Boolean(third);
      const className = hasThreeColumns ? first : "";
      const numberFirst = first.replace(/[^\d]/g, "");
      const numberSecond = second.replace(/[^\d]/g, "");
      const rosterNumber = hasThreeColumns ? second.replace(/[^\d]/g, "") : numberFirst || numberSecond;
      const name = hasThreeColumns ? third : numberFirst ? second : first;

      return {
        className: className.trim().slice(0, 16),
        name: name.trim().slice(0, 12),
        rosterNumber: rosterNumber.slice(0, 3),
      };
    })
    .filter((item) => item.name && item.rosterNumber);
}

function buildMiniGameInterventionScenario(record: MiniGameRecord) {
  const childName = record.childName ?? "这位幼儿";
  const followUp = getMiniGameFollowUp(record);

  return `${childName}的互动记录：${followUp.observation}${followUp.activityScenario}${classroomPlanRequirement}家庭延伸建议可参考：${followUp.homeTask}`;
}

function formatTeacherPickedItems(items: string[]) {
  return items.filter(Boolean).slice(0, 4).join("、") || "已完成互动任务";
}

function getMiniGameInsightKey(record: MiniGameRecord) {
  return `${record.completedAt}-${record.gameKey}-${record.childId ?? record.childName ?? "anon"}`;
}

function getFoodPreferenceInsightKey(record: FoodPreferenceRecord) {
  return `${record.recordedAt}-${record.foodLabel}-${record.childId ?? record.childName ?? "anon"}`;
}

function getFoodAcceptanceStageText(text: string) {
  if (/尝|吃|一点/.test(text)) {
    return "愿意尝一点";
  }

  if (/闻|香|味/.test(text)) {
    return "愿意闻一闻";
  }

  if (/说|名字|介绍|播报/.test(text)) {
    return "能说出名字";
  }

  if (/看|观察|图片|颜色|形状/.test(text)) {
    return "愿意看一看";
  }

  return "正在认识";
}

function buildMiniGameEffectChangeLine(record: MiniGameRecord) {
  const childName = record.childName ?? "未选择身份";
  const pickedText = formatTeacherPickedItems(record.pickedItems);

  if (record.gameKey === "readingCheckin") {
    return `${childName}：习惯故事从愿意听，到能选择答案并完成“${record.habitTask ?? "一个生活小任务"}”。`;
  }

  if (record.gameKey === "washSteps") {
    return `${childName}：洗手常规从需要提醒，到能按顺序完成一个清洁步骤。`;
  }

  if (record.gameKey === "queue") {
    return `${childName}：一日常规从愿意听提示，到能选择喝水、如厕、排队或整理的合适做法。`;
  }

  if (record.gameKey === "mealManners") {
    return `${childName}：进餐操从需要听口令，到能主动练习扶好碗、坐稳和餐后整理。`;
  }

  if (record.gameKey === "habitTrafficLight") {
    return `${childName}：好习惯判断从愿意选择，到能尝试说出正确做法。`;
  }

  if (record.gameKey === "foodPreference") {
    return `${childName}：美食认识从正在观察，到${getFoodAcceptanceStageText(pickedText)}。`;
  }

  if (record.themeId === "food") {
    return `${childName}：闽食探索从认识名字，到能找食材或说一个发现。`;
  }

  return `${childName}：成长任务从愿意参与，到能完成一个可观察的小步骤。`;
}

function buildFoodPreferenceEffectChangeLine(record: FoodPreferenceRecord) {
  const childName = record.childName ?? "未选择身份";
  const stage = getFoodAcceptanceStageText(`${record.foodLabel}、${record.reasonLabel}、${record.gentleTryTip}`);

  return `${childName}：${record.foodLabel} 从正在认识，到${stage}。`;
}

export function TeacherStudio() {
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const premiumVoiceLabel = process.env.NEXT_PUBLIC_TTS_VOICE_LABEL ?? defaultPremiumVoiceLabel;
  const draftStorageKey = "tongqu-growth-web-teacher-draft";
  const historyStorageKey = "tongqu-growth-web-teacher-history";
  const [teacherAuthHydrated, setTeacherAuthHydrated] = useState(false);
  const [teacherAuthenticated, setTeacherAuthenticated] = useState(false);
  const [teacherHasAccount, setTeacherHasAccount] = useState(false);
  const [teacherAccountInput, setTeacherAccountInput] = useState("");
  const [teacherPasscodeInput, setTeacherPasscodeInput] = useState("");
  const [teacherSetupAccount, setTeacherSetupAccount] = useState("");
  const [teacherSetupPasscode, setTeacherSetupPasscode] = useState("");
  const [teacherAuthStatus, setTeacherAuthStatus] =
    useState("班级试用模式：请先确认本机班级试用账号，再进入教师工作台。");
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [teacherAgeGroup, setTeacherAgeGroup] = useState<string>(defaultTeacherAgeGroup);
  const [task, setTask] = useState(defaultTeacherTask.label);
  const [scenario, setScenario] = useState(buildHomePlanScenario("habit", defaultTeacherAgeGroup));
  const [result, setResult] = useState<TeacherResponse | null>(null);
  const [savedResults, setSavedResults] = useState<SavedTeacherResult[]>([]);
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(() => createEmptyGrowthArchive());
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [newChildClassName, setNewChildClassName] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildNumber, setNewChildNumber] = useState("");
  const [rosterStatus, setRosterStatus] = useState("添加姓名和号数后，幼儿可以用小名牌进入对应互动任务。");
  const [selectedChildSummaryId, setSelectedChildSummaryId] = useState("");
  const todayMenuDateKey = getLocalDateKey();
  const [weeklyMenuEntries, setWeeklyMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [menuDate, setMenuDate] = useState(todayMenuDateKey);
  const [menuMealType, setMenuMealType] = useState<MealType>("午餐");
  const [menuDishName, setMenuDishName] = useState("");
  const [menuIngredients, setMenuIngredients] = useState("");
  const [menuFocusIngredients, setMenuFocusIngredients] = useState("");
  const [menuStatus, setMenuStatus] = useState("录入本周食谱后，可以发布今日食谱到儿童端。");
  const [parentSyncRecords, setParentSyncRecords] = useState<ParentSyncRecord[]>([]);
  const [parentFeedbackRecords, setParentFeedbackRecords] = useState<ParentFeedbackRecord[]>([]);
  const [selectedParentFeedbackId, setSelectedParentFeedbackId] = useState("");
  const [parentFeedbackDrafts, setParentFeedbackDrafts] = useState<Record<string, ParentFeedbackDraft>>({});
  const [parentFeedbackAiLoadingId, setParentFeedbackAiLoadingId] = useState("");
  const [parentSyncStatus, setParentSyncStatus] =
    useState("请选择一条家长反馈，给出老师回复和可执行的家庭育儿指导。");
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isPreviewSpeaking, setIsPreviewSpeaking] = useState(false);
  const [draftStatus, setDraftStatus] = useState("当前内容会自动保存在这台设备上。");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const historyReadFailedRef = useRef(false);
  const generationSectionRef = useRef<HTMLElement | null>(null);
  const teacherScenarioRemaining = teacherScenarioMaxLength - scenario.length;
  const isActivityPlanSelected = isActivityPlanTask(task);
  const filteredSavedResults = savedResults;
  const miniGameSummaryStats = useMemo(() => {
    const records = growthArchive.miniGameRecords;
    const childKeys = new Set(
      records
        .map((record) => record.childId ?? record.childName ?? "")
        .filter(Boolean),
    );

    return {
      total: records.length,
      habit: records.filter((record) => record.themeId === "habit").length,
      food: records.filter((record) => record.themeId === "food").length,
      childCount: childKeys.size,
      foodPreference: records.filter((record) => record.gameKey === "foodPreference").length,
    };
  }, [growthArchive.miniGameRecords]);
  const latestParentFeedbackRecords = useMemo(
    () => parentFeedbackRecords.slice(0, 10),
    [parentFeedbackRecords],
  );
  const newParentFeedbackCount = parentFeedbackRecords.filter((record) => record.status === "new").length;
  const repliedParentFeedbackCount = parentFeedbackRecords.filter(
    (record) => record.teacherReply || record.teacherGuidance,
  ).length;
  const classOverview = useMemo(() => {
    const todayKey = new Date().toDateString();
    const isToday = (value: string) => {
      const date = new Date(value);

      return !Number.isNaN(date.getTime()) && date.toDateString() === todayKey;
    };
    const todayMiniGameRecords = growthArchive.miniGameRecords.filter((record) =>
      isToday(record.completedAt),
    );
    const todayBadgeRecords = growthArchive.badgeRecords.filter((record) =>
      isToday(record.earnedAt),
    );
    const participatedChildren = new Set(
      todayMiniGameRecords
        .map((record) => record.childId ?? record.childName ?? "")
        .filter(Boolean),
    );
    const unboundRecords = growthArchive.miniGameRecords.filter(
      (record) => !record.childId && !record.childName,
    ).length;
    const followUpRecords = growthArchive.miniGameRecords.filter((record) => {
      const followUp = getMiniGameFollowUp(record);

      return followUp.focus || !record.childId || !record.childName;
    }).length;
    const focusCount =
      growthArchive.foodPreferenceRecords.length +
      followUpRecords +
      parentFeedbackRecords.filter((record) => record.status === "new").length;

    return {
      rosterCount: childRoster.length,
      participatedCount: participatedChildren.size,
      interactionCount: todayMiniGameRecords.length,
      badgeCount: todayBadgeRecords.length,
      newFeedbackCount: parentFeedbackRecords.filter((record) => record.status === "new").length,
      focusCount,
      unboundRecords,
    };
  }, [
    childRoster.length,
    growthArchive.badgeRecords,
    growthArchive.foodPreferenceRecords.length,
    growthArchive.miniGameRecords,
    parentFeedbackRecords,
  ]);
  const recommendedNextSteps = useMemo(() => {
    const records = growthArchive.miniGameRecords;
    const hasReading = records.some((record) => record.gameKey === "readingCheckin");
    const hasRoutine = records.some(
      (record) =>
        record.gameKey === "washSteps" ||
        record.gameKey === "queue" ||
        record.gameKey === "mealManners" ||
        record.gameKey === "habitTrafficLight",
    );
    const hasFood = records.some(
      (record) =>
        record.themeId === "food" ||
        record.gameKey === "foodTrain" ||
        record.gameKey === "foodGuess" ||
        record.gameKey === "foodObserve",
    );

    if (newParentFeedbackCount > 0) {
      return ["先回复家长反馈", "再同步一个家庭小任务"];
    }

    if (hasReading) {
      return ["生成习惯故事跟进", "同步一个家庭小习惯任务"];
    }

    if (hasRoutine) {
      return ["生成一日常规口令", "同步饭前洗手、喝水或整理"];
    }

    if (hasFood) {
      return ["生成泉州美食探索活动", "同步家庭找一种泉州美食"];
    }

    return ["从常规提醒生成一节课", "引导幼儿先完成一个生活任务"];
  }, [growthArchive.miniGameRecords, newParentFeedbackCount]);
  const aiDailyObservationCards = useMemo(() => {
    const habitRecords = growthArchive.miniGameRecords.filter((record) => record.themeId === "habit");
    const foodRecords = growthArchive.miniGameRecords.filter((record) => record.themeId === "food");
    const latestHabit = habitRecords[0] ? getMiniGameFollowUp(habitRecords[0]) : null;
    const latestFood = foodRecords[0] ? getMiniGameFollowUp(foodRecords[0]) : null;
    const latestFoodPreference = growthArchive.foodPreferenceRecords[0]
      ? getFoodPreferenceFollowUp(growthArchive.foodPreferenceRecords[0])
      : null;

    return [
      {
        label: "今日参与情况",
        value:
          classOverview.participatedCount > 0
            ? `${classOverview.participatedCount} 名幼儿参与，完成 ${classOverview.interactionCount} 次任务`
            : "今天还没有新的儿童端任务记录",
      },
      {
        label: "一日常规表现",
        value: latestHabit?.observation ?? "暂无常规互动记录，可先安排洗手、喝水、如厕、整理、排队或文明进餐提醒。",
      },
      {
        label: "闽食探索表现",
        value:
          latestFoodPreference?.observation ??
          latestFood?.observation ??
          "暂无闽食探索记录，可先从小列车或摊位寻宝开始。",
      },
      {
        label: "需要老师关注",
        value:
          classOverview.focusCount > 0
            ? `${classOverview.focusCount} 条线索需要跟进，优先看喝水洗手、排队整理、文明进餐、美食认识和家长新反馈。`
            : "暂无明显需要关注的线索，可继续观察孩子下一次选择。",
      },
      {
        label: "今日建议动作",
        value: recommendedNextSteps.join("；"),
      },
    ];
  }, [
    classOverview.focusCount,
    classOverview.interactionCount,
    classOverview.participatedCount,
    growthArchive.foodPreferenceRecords,
    growthArchive.miniGameRecords,
    recommendedNextSteps,
  ]);
  const aiFocusInsightRows = useMemo(() => {
    const gameRows = growthArchive.miniGameRecords.slice(0, 4).map((record) => {
      const followUp = getMiniGameFollowUp(record);

      return {
        id: `game-${getMiniGameInsightKey(record)}`,
        kind: "game" as const,
        recordKey: getMiniGameInsightKey(record),
        childName: record.childName ?? "未选择身份",
        title: followUp.displayName,
        meaning: `${followUp.observation} 记录：${formatTeacherPickedItems(record.pickedItems)}。`,
        nextAction: followUp.homeTask,
      };
    });
    const foodRows = growthArchive.foodPreferenceRecords.slice(0, 3).map((record) => {
      const followUp = getFoodPreferenceFollowUp(record);

      return {
        id: `food-${getFoodPreferenceInsightKey(record)}`,
        kind: "food" as const,
        recordKey: getFoodPreferenceInsightKey(record),
        childName: record.childName ?? "未选择身份",
        title: followUp.displayName,
        meaning: followUp.observation,
        nextAction: followUp.homeTask,
      };
    });

    return [...foodRows, ...gameRows].slice(0, 6);
  }, [growthArchive.foodPreferenceRecords, growthArchive.miniGameRecords]);
  const foodObservationSummaryRows = useMemo(() => {
    type FoodSummaryDraft = {
      foodLabel: string;
      records: FoodPreferenceRecord[];
      reasonCounter: Map<string, number>;
      childNames: Set<string>;
      approachCounter: Map<string, number>;
    };
    const summaryMap = new Map<string, FoodSummaryDraft>();

    for (const record of growthArchive.foodPreferenceRecords) {
      const foodLabel = record.foodLabel.trim() || "未命名食物";
      const current =
        summaryMap.get(foodLabel) ??
        {
          foodLabel,
          records: [],
          reasonCounter: new Map<string, number>(),
          childNames: new Set<string>(),
          approachCounter: new Map<string, number>(),
        };

      current.records.push(record);
      current.reasonCounter.set(record.reasonLabel, (current.reasonCounter.get(record.reasonLabel) ?? 0) + 1);

      if (record.childName || record.childId) {
        current.childNames.add(record.childName ?? record.childId ?? "未选择身份");
      }

      if (record.approachStep) {
        current.approachCounter.set(record.approachStep, (current.approachCounter.get(record.approachStep) ?? 0) + 1);
      }

      summaryMap.set(foodLabel, current);
    }

    const pickTop = (counter: Map<string, number>) =>
      Array.from(counter.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";

    return Array.from(summaryMap.values())
      .map((item) => {
        const records = [...item.records].sort(
          (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
        );
        const latestRecord = records[0];
        const topReason = pickTop(item.reasonCounter) || latestRecord.reasonLabel;
        const recommendedStep =
          pickTop(item.approachCounter) ||
          (/气味|味道|冲|重/.test(topReason)
            ? "闻一闻"
            : /口感|太滑|太硬/.test(topReason)
              ? "碰一碰"
              : "看一看");

        return {
          foodLabel: item.foodLabel,
          count: records.length,
          topReason,
          childCount: item.childNames.size,
          childNames: Array.from(item.childNames).slice(0, 6),
          latestRecord,
          recommendedStep,
        };
      })
      .sort((left, right) => right.count - left.count || new Date(right.latestRecord.recordedAt).getTime() - new Date(left.latestRecord.recordedAt).getTime())
      .slice(0, 6);
  }, [growthArchive.foodPreferenceRecords]);
  const todayPublishedMenuEntries = useMemo(
    () => weeklyMenuEntries.filter((entry) => entry.date === todayMenuDateKey && entry.publishedAt),
    [todayMenuDateKey, weeklyMenuEntries],
  );
  const todayMenuObservationRows = useMemo(() => {
    const todayMenuLabels = new Set(
      todayPublishedMenuEntries.flatMap((entry) => [
        entry.dishName,
        ...entry.ingredients,
        ...entry.focusIngredients,
      ]),
    );
    type MenuSummaryDraft = {
      dishName: string;
      records: FoodPreferenceRecord[];
      ingredients: Map<string, number>;
      reasons: Map<string, number>;
      steps: Map<string, number>;
      childIds: Set<string>;
    };
    const summaryMap = new Map<string, MenuSummaryDraft>();
    const pickTop = (counter: Map<string, number>) =>
      Array.from(counter.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";

    for (const record of growthArchive.foodPreferenceRecords) {
      const recordDate = record.menuDate ?? getLocalDateKey(new Date(record.recordedAt));
      const relatedToMenu =
        recordDate === todayMenuDateKey &&
        (Boolean(record.dishName) ||
          todayMenuLabels.has(record.foodLabel) ||
          (record.ingredientName ? todayMenuLabels.has(record.ingredientName) : false));

      if (!relatedToMenu) {
        continue;
      }

      const dishName = record.dishName?.trim() || record.foodLabel.trim() || "今日食谱";
      const current =
        summaryMap.get(dishName) ??
        {
          dishName,
          records: [],
          ingredients: new Map<string, number>(),
          reasons: new Map<string, number>(),
          steps: new Map<string, number>(),
          childIds: new Set<string>(),
        };
      const ingredient = record.ingredientName?.trim() || record.foodLabel.trim();

      current.records.push(record);
      current.ingredients.set(ingredient, (current.ingredients.get(ingredient) ?? 0) + 1);
      current.reasons.set(record.reasonLabel, (current.reasons.get(record.reasonLabel) ?? 0) + 1);

      if (record.approachStep) {
        current.steps.set(record.approachStep, (current.steps.get(record.approachStep) ?? 0) + 1);
      }

      if (record.childId || record.childName) {
        current.childIds.add(record.childId ?? record.childName ?? "未选择身份");
      }

      summaryMap.set(dishName, current);
    }

    return Array.from(summaryMap.values())
      .map((item) => {
        const sortedRecords = [...item.records].sort(
          (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
        );
        const topReason = pickTop(item.reasons) || "正在认识";
        const recommendedStep =
          pickTop(item.steps) ||
          (/气味|味道|冲|重/.test(topReason)
            ? "闻一闻"
            : /口感|太滑|太硬/.test(topReason)
              ? "碰一碰"
              : "看一看");

        return {
          dishName: item.dishName,
          count: item.records.length,
          topIngredient: pickTop(item.ingredients) || item.dishName,
          topReason,
          topStep: pickTop(item.steps) || recommendedStep,
          childCount: item.childIds.size,
          latestRecord: sortedRecords[0],
          recommendedStep,
        };
      })
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [growthArchive.foodPreferenceRecords, todayMenuDateKey, todayPublishedMenuEntries]);
  const childRecordSummaryRows = useMemo(() => {
    return childRoster.map((child) => {
      const miniRecords = growthArchive.miniGameRecords.filter(
        (record) => record.childId === child.id || record.childName === child.name,
      );
      const foodRecords = growthArchive.foodPreferenceRecords.filter(
        (record) => record.childId === child.id || record.childName === child.name,
      );
      const feedbackRecords = parentFeedbackRecords.filter((record) => record.childId === child.id);
      const badgeRecords = growthArchive.badgeRecords.filter(
        (record) => record.childId === child.id || record.childName === child.name,
      );
      const latestFoodRecord = [...foodRecords].sort(
        (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
      )[0];
      const latestMiniRecord = [...miniRecords].sort(
        (left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
      )[0];
      const latestFoodTime = latestFoodRecord ? new Date(latestFoodRecord.recordedAt).getTime() : 0;
      const latestMiniTime = latestMiniRecord ? new Date(latestMiniRecord.completedAt).getTime() : 0;
      const latestObservation =
        latestFoodTime >= latestMiniTime && latestFoodRecord
          ? getFoodPreferenceFollowUp(latestFoodRecord).observation
          : latestMiniRecord
            ? getMiniGameFollowUp(latestMiniRecord).observation
            : "还没有互动记录，可先从幼习宝一日常规任务开始。";
      const detailLines = [
        ...foodRecords.slice(0, 3).map((record) => {
          const followUp = getFoodPreferenceFollowUp(record);

          return `${formatParentSyncTime(record.recordedAt)} · ${followUp.displayName}：${followUp.observation}`;
        }),
        ...miniRecords.slice(0, 3).map((record) => {
          const followUp = getMiniGameFollowUp(record);

          return `${formatParentSyncTime(record.completedAt)} · ${followUp.displayName}：${formatTeacherPickedItems(record.pickedItems)}`;
        }),
        ...feedbackRecords.slice(0, 2).map(
          (record) => `${formatParentSyncTime(record.createdAt)} · 家庭反馈：${record.content}`,
        ),
      ].slice(0, 6);

      return {
        child,
        miniCount: miniRecords.length,
        foodCount: foodRecords.length,
        feedbackCount: feedbackRecords.length,
        badgeCount: badgeRecords.length,
        latestObservation,
        detailLines,
      };
    });
  }, [
    childRoster,
    growthArchive.badgeRecords,
    growthArchive.foodPreferenceRecords,
    growthArchive.miniGameRecords,
    parentFeedbackRecords,
  ]);
  const familyPlateActionSummary = useMemo(() => {
    const records = parentFeedbackRecords.filter((record) => record.content.includes("家庭光盘行动"));
    const childIds = new Set(records.map((record) => record.childId).filter(Boolean));

    return {
      count: records.length,
      childCount: childIds.size,
      latest: records[0] ?? null,
    };
  }, [parentFeedbackRecords]);
  const effectEvidenceStats = useMemo(() => {
    const routineGameKeys = new Set([
      "washSteps",
      "queue",
      "readingCheckin",
      "habitTrafficLight",
      "mealManners",
    ]);
    const routineTaskCount = growthArchive.miniGameRecords.filter(
      (record) => record.themeId === "habit" || routineGameKeys.has(record.gameKey),
    ).length;
    const foodApproachCount = growthArchive.foodPreferenceRecords.length;
    const familyFeedbackCount = parentFeedbackRecords.length;

    return [
      {
        label: "一日常规任务完成次数",
        value: routineTaskCount,
        hint: "洗手、喝水、如厕、整理、排队、文明进餐等互动记录",
      },
      {
        label: "食物观察/靠近小步次数",
        value: foodApproachCount,
        hint: "正在认识的食物、原因和靠近小步记录",
      },
      {
        label: "家庭反馈/家庭打卡次数",
        value: familyFeedbackCount,
        hint: "家长提交的居家观察、家庭光盘行动和延续任务",
      },
    ];
  }, [growthArchive.foodPreferenceRecords.length, growthArchive.miniGameRecords, parentFeedbackRecords.length]);
  const effectChangeRecords = useMemo(() => {
    const foodLines = growthArchive.foodPreferenceRecords
      .slice(0, 3)
      .map(buildFoodPreferenceEffectChangeLine);
    const gameLines = growthArchive.miniGameRecords
      .slice(0, 5)
      .map(buildMiniGameEffectChangeLine);
    const uniqueLines = Array.from(new Set([...foodLines, ...gameLines])).slice(0, 6);

    return uniqueLines.length > 0
      ? uniqueLines
      : [
          "暂无变化记录。孩子完成儿童端互动后，这里会自动整理从愿意听、愿意选择到能说出做法的变化。",
        ];
  }, [growthArchive.foodPreferenceRecords, growthArchive.miniGameRecords]);
  const selectedParentFeedback = useMemo(
    () =>
      parentFeedbackRecords.find((record) => record.id === selectedParentFeedbackId) ??
      latestParentFeedbackRecords[0] ??
      null,
    [latestParentFeedbackRecords, parentFeedbackRecords, selectedParentFeedbackId],
  );
  const resultQualityChecks = useMemo(() => {
    const content = result?.content?.trim() ?? "";
    const tips = result?.tips ?? [];
    const taskContext = `${task} ${scenario}`;
    const taskSpecificCheck = (() => {
      if (/故事|绘本|角色/.test(taskContext)) {
        return {
          label: "贴合故事生成",
          ok: /故事|角色|小朋友|看一看|说一说|试一试|问题/.test(content),
        };
      }

      if (/活动|课程|方案|流程|目标/.test(taskContext)) {
        return {
          label: "包含活动结构",
          ok: /活动|目标|流程|材料|观察|导入|提问/.test(content),
        };
      }

      if (/餐|食|闽|尝|闻/.test(taskContext)) {
        return {
          label: "贴合食育内容",
          ok: /看一看|闻一闻|尝|餐|食物|食材|闽|营养/.test(content),
        };
      }

      return {
        label: "适合老师使用",
        ok: /老师|幼儿|活动|故事|提问|观察|任务/.test(content),
      };
    })();

    return [
      {
        label: "内容已生成",
        ok: content.length > 0,
      },
      {
        label: "内容不冗长",
        ok: content.length > 0 && content.length <= 220,
      },
      {
        label: "无比较惩罚",
        ok: content.length > 0 && !/不然|不能|必须|别人|批评|惩罚|快点|不乖/.test(content),
      },
      {
        label: "有清楚互动",
        ok:
          /一步|先|再|小任务|试一试|看一看|闻一闻|提问|观察|操作/.test(content) ||
          tips.some((tip) => /一步|先|再|小任务|试一试|看一看|闻一闻|提问|观察|操作/.test(tip)),
      },
      {
        label: "适合4-5岁",
        ok: content.length > 0 && !/考核|评估|指标|达标|训练强度|必须完成/.test(content),
      },
      taskSpecificCheck,
    ];
  }, [result, scenario, task]);
  const parentShareLine = useMemo(() => {
    if (!result) {
      return "";
    }

    const taskContext = `${task} ${scenario}`;

    if (/故事|绘本|角色/.test(taskContext)) {
      return "讲完故事后，可以请幼儿选一个角色动作，再说一句自己的发现。";
    }

    if (/活动|课程|方案|流程|目标/.test(taskContext)) {
      return "活动后建议保留一张观察记录：幼儿是否愿意表达、是否能完成一个关键动作。";
    }

    if (/餐|食|闽|尝|闻/.test(taskContext)) {
      return "食育活动后可以让幼儿画出一种食材，或说出“我看到了什么、闻到了什么”。";
    }

    return "可以把生成内容拆成导入、操作、分享三个环节，方便老师按班级情况调整。";
  }, [result, scenario, task]);

  function cleanupAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsPreviewSpeaking(false);
  }

  useEffect(() => () => cleanupAudio(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAccount = (window.localStorage.getItem(teacherAccountStorageKey) ?? "").trim();
      const savedPasscode = (window.localStorage.getItem(teacherPasscodeStorageKey) ?? "").trim();
      const savedSession = window.sessionStorage.getItem(teacherSessionStorageKey) ?? "";
      const hasCompleteAccount = Boolean(savedAccount && savedPasscode);

      if ((savedAccount && !savedPasscode) || (!savedAccount && savedPasscode)) {
        window.localStorage.removeItem(teacherAccountStorageKey);
        window.localStorage.removeItem(teacherPasscodeStorageKey);
        window.sessionStorage.removeItem(teacherSessionStorageKey);
        setTeacherHasAccount(false);
        setTeacherAccountInput("");
        setTeacherAuthenticated(false);
        setTeacherAuthStatus("检测到本机教师账号不完整，已自动清除。请重新创建，或使用班级试用快速进入。");
        setTeacherAuthHydrated(true);
        return;
      }

      if (!hasCompleteAccount || (savedSession && savedSession !== savedAccount)) {
        window.sessionStorage.removeItem(teacherSessionStorageKey);
      }

      setTeacherHasAccount(hasCompleteAccount);
      setTeacherAccountInput(savedAccount);
      setTeacherAuthenticated(Boolean(hasCompleteAccount && savedSession && savedSession === savedAccount));
      setTeacherAuthStatus(
        hasCompleteAccount
          ? "班级试用模式：请输入本机班级试用账号口令，验证后进入教师工作台。"
          : "班级试用模式：首次使用请先创建本机班级试用账号和口令。",
      );
      setTeacherAuthHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftStorageKey);

        if (raw) {
          const parsed = JSON.parse(raw) as {
            themeId?: ThemeId;
            task?: string;
            scenario?: string;
            ageGroup?: string;
          };

          if (parsed.themeId && themes[parsed.themeId]) {
            setThemeId(parsed.themeId);
          }

          if (parsed.task) {
            setTask(parsed.task);
          }

          setTeacherAgeGroup(
            parsed.ageGroup && teacherAgeOptions.some((item) => item.label === parsed.ageGroup)
              ? parsed.ageGroup
              : defaultTeacherAgeGroup,
          );

          if (parsed.scenario) {
            setScenario(parsed.scenario);
            setDraftStatus("已恢复这台设备上次留下的教师工作台草稿。");
          }
        }
      } catch {
        setDraftStatus("草稿读取失败了，当前先用默认内容。");
      }

      try {
        const historyRaw = window.localStorage.getItem(historyStorageKey);
        if (historyRaw) {
          const history = JSON.parse(historyRaw) as SavedTeacherResult[];
          if (Array.isArray(history)) {
            setSavedResults(
              limitTeacherHistory(
                history
                  .filter(
                    (item): item is SavedTeacherResult =>
                      Boolean(
                        item &&
                          typeof item.id === "string" &&
                          typeof item.title === "string" &&
                          typeof item.content === "string" &&
                          Array.isArray(item.tips) &&
                          typeof item.themeId === "string" &&
                          themes[item.themeId as ThemeId] &&
                          typeof item.task === "string" &&
                          typeof item.scenario === "string" &&
                          typeof item.savedAt === "string",
                      ),
                  )
                  .map((item) => ({
                    ...item,
                    pinned: item.pinned === true,
                  })),
              ),
            );
            historyReadFailedRef.current = false;
          }
        }
      } catch {
        historyReadFailedRef.current = true;
        setDraftStatus("历史读取失败了，不影响当前草稿继续使用。");
      } finally {
        const rawGrowthArchive = window.localStorage.getItem(growthArchiveStorageKey);
        setGrowthArchive(parseGrowthArchive(rawGrowthArchive));
        const savedRoster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));
        setChildRoster(savedRoster);
        setParentSyncRecords(parseParentSyncRecords(window.localStorage.getItem(parentSyncStorageKey)));
        setParentFeedbackRecords(
          parseParentFeedbackRecords(window.localStorage.getItem(parentFeedbackStorageKey)),
        );
        setWeeklyMenuEntries(parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)));
        setRosterStatus(
          savedRoster.length > 0
            ? `已读取 ${savedRoster.length} 位幼儿，首页可以按姓名或号数识别身份。`
            : "还没有班级花名册。请先添加姓名和号数，儿童端记录才会对应到幼儿。",
        );

        const searchParams = new URLSearchParams(window.location.search);
        const linkedTheme = searchParams.get("theme");
        const linkedFrom = searchParams.get("from");

        if (linkedFrom === "mini-game" && (linkedTheme === "habit" || linkedTheme === "food")) {
          const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
          const hasMiniGameRecord = hasThemeMiniGameRecord(
            rawGrowthArchive,
            linkedTheme,
          );

          setThemeId(linkedTheme);
          setTask(homeTask.label);
          setScenario(
            hasMiniGameRecord
              ? buildMiniGameExtensionScenario(linkedTheme, defaultTeacherAgeGroup)
              : buildHomePlanScenario(linkedTheme, defaultTeacherAgeGroup),
          );
          setDraftStatus(
            hasMiniGameRecord
            ? "已接上儿童端互动记录，可以直接生成一节课堂跟进方案。"
              : "还没有读到儿童端互动记录，已切换为普通活动课程方案草稿。",
          );
        }

        setDraftHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        themeId,
        ageGroup: teacherAgeGroup,
        task,
        scenario,
      }),
    );
  }, [draftHydrated, draftStorageKey, scenario, task, teacherAgeGroup, themeId]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    if (historyReadFailedRef.current && savedResults.length === 0) {
      return;
    }

    window.localStorage.setItem(historyStorageKey, JSON.stringify(limitTeacherHistory(savedResults)));
  }, [draftHydrated, historyStorageKey, savedResults]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(childRosterStorageKey, JSON.stringify(childRoster));
  }, [childRoster, draftHydrated]);

  function scrollToGenerationSection() {
    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      generationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function bringIntoGenerationArea(options: {
    nextThemeId: ThemeId;
    nextTask: string;
    nextScenario: string;
    statusMessage: string;
    nextResult?: TeacherResponse | null;
  }) {
    setThemeId(options.nextThemeId);
    setTask(options.nextTask);
    setScenario(options.nextScenario);
    setResult(options.nextResult ?? null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(options.statusMessage);
    scrollToGenerationSection();
  }

  function selectTeacherTheme(nextThemeId: ThemeId) {
    setThemeId(nextThemeId);

    if (isActivityPlanSelected) {
      setScenario(buildHomePlanScenario(nextThemeId, teacherAgeGroup));
    }

    setDraftStatus("主题已切换，活动方案草稿会按当前年龄段更新。");
  }

  function selectTeacherAge(nextAgeGroup: string) {
    setTeacherAgeGroup(nextAgeGroup);

    if (isActivityPlanSelected) {
      setScenario(buildHomePlanScenario(themeId, nextAgeGroup));
    }

    setDraftStatus("年龄段已更新，生成时会按对应年龄特点调整活动。");
  }

  function selectTeacherTask(item: TeacherTaskItem, statusMessage = "已切换到新的老师任务模板，会自动保存到这台设备。") {
    setTask(item.label);
    setScenario(buildTeacherTaskScenario(item, themeId, teacherAgeGroup));
    setDraftStatus(statusMessage);
  }

  function applyQuickKeyword(keyword: (typeof quickTeacherKeywords)[number]) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const foodTask = teacherTasks.find((item) => item.id === "food-follow") ?? teacherTasks[0];
    const parentTask = teacherTasks.find((item) => item.id === "parent-sync") ?? teacherTasks[0];
    const ageLine = `年龄段：${teacherAgeGroup}。`;
    const keywordScenarios: Record<(typeof quickTeacherKeywords)[number], {
      nextThemeId: ThemeId;
      nextTask: TeacherTaskItem;
      nextScenario: string;
    }> = {
      洗手: {
        nextThemeId: "habit",
        nextTask: homeTask,
        nextScenario: `${ageLine}关键词：洗手。请围绕“挽袖子、打湿手、搓泡泡、冲干净、擦小手”生成跟进建议、短儿歌/口令、教师引导语和家园任务。`,
      },
      喝水: {
        nextThemeId: "habit",
        nextTask: homeTask,
        nextScenario: `${ageLine}关键词：喝水。请围绕“小水杯、双手拿、接半杯、慢慢喝、不拿杯子跑”生成正向提醒、操作步骤、教师引导语和家庭延续任务。`,
      },
      如厕: {
        nextThemeId: "habit",
        nextTask: homeTask,
        nextScenario: `${ageLine}关键词：如厕。请围绕“轻轻进、便后冲、整理好、洗小手”生成幼儿可理解的口令、情境故事和老师跟进建议。`,
      },
      整理: {
        nextThemeId: "habit",
        nextTask: homeTask,
        nextScenario: `${ageLine}关键词：整理。请围绕“玩具回家、书本摆齐、椅子归位、桌面清爽”生成班级常规跟进建议和家园延续任务。`,
      },
      排队: {
        nextThemeId: "habit",
        nextTask: homeTask,
        nextScenario: `${ageLine}关键词：排队。请围绕“不推挤、跟上前、静悄悄、排整齐”生成过渡环节口令、教师引导语和正向鼓励语。`,
      },
      文明进餐: {
        nextThemeId: "habit",
        nextTask: homeTask,
        nextScenario: `${ageLine}关键词：文明进餐。请围绕“手扶碗、脚放稳、安静嚼、不撒饭、按需取餐、餐后整理”生成跟进建议、进餐操口令和家庭小任务。`,
      },
      今日食谱: {
        nextThemeId: "food",
        nextTask: foodTask,
        nextScenario: `${ageLine}关键词：今日食谱。今日发布食谱：${
          todayPublishedMenuEntries.length > 0
            ? todayPublishedMenuEntries
                .map((entry) => `${entry.mealType}：${entry.dishName}（${[...entry.ingredients, ...entry.focusIngredients].join("、")}）`)
                .join("；")
            : "暂未发布今日食谱，请先生成通用闽食播报和食育引导。"
        } 请生成幼儿化今日闽食播报、观察食材提示、温和靠近小步和家园任务。`,
      },
      食物观察: {
        nextThemeId: "food",
        nextTask: foodTask,
        nextScenario: `${ageLine}关键词：食物观察。班级近期观察：${
          foodObservationSummaryRows.length > 0
            ? foodObservationSummaryRows
                .slice(0, 3)
                .map((row) => `${row.foodLabel}：${row.topReason}，推荐${row.recommendedStep}`)
                .join("；")
            : "暂无记录，可围绕香菇、小葱、蒜、紫菜、海蛎等食材生成通用观察方案。"
        } 请生成温和食育策略，不贴标签，包含教师引导语、区域活动和家园延续。`,
      },
      家园任务: {
        nextThemeId: themeId,
        nextTask: parentTask,
        nextScenario: `${ageLine}关键词：家园任务。请根据幼儿一日常规和闽食观察生成一段老师确认后可同步给家长的话术，包含孩子今天的具体表现、老师温和判断、回家轻轻做的一小步和家长观察重点。`,
      },
    };
    const config = keywordScenarios[keyword];

    bringIntoGenerationArea({
      nextThemeId: config.nextThemeId,
      nextTask: config.nextTask.label,
      nextScenario: config.nextScenario,
      statusMessage: `已带入“${keyword}”关键词，老师可直接修改后生成。`,
    });
  }

  async function generate(
    overrides: Partial<{
      scenario: string;
      task: string;
      themeId: ThemeId;
      ageGroup: string;
    }> = {},
  ) {
    const requestScenario = overrides.scenario ?? scenario;
    const requestTask = overrides.task ?? task;
    const requestThemeId = overrides.themeId ?? themeId;
    const requestAgeGroup = overrides.ageGroup ?? teacherAgeGroup;
    const cleanScenario = requestScenario.trim();

    if (!cleanScenario) {
      setDraftStatus("先输入跟进建议、课堂活动、家园同步话术或鼓励语需求，再开始生成。");
      return;
    }

    if (cleanScenario.length > teacherScenarioMaxLength) {
      setDraftStatus(`场景描述太长了，请控制在 ${teacherScenarioMaxLength} 个字以内。`);
      return;
    }

    setIsLoading(true);
    try {
      const requestInput = buildTeacherRequestInput(
        requestTask,
        cleanScenario,
        requestAgeGroup,
        requestThemeId,
      );
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "teacher",
          theme: requestThemeId,
          userInput: requestInput,
          teacherTask: requestTask,
        }),
      });

      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "生成接口暂时不可用。";
        setResult({
          ...buildTeacherClientFallback(requestTask, requestInput),
          error: errorMessage,
          fallbackUsed: true,
          needsReview: true,
        });
        setDraftStatus("这次生成接口未正常返回，已显示备用内容，但不会保存到历史。");
        setCopyStatus("");
        setVoiceStatus("");
        return;
      }

      const normalized = normalizeTeacherPayload(payload);

      if (!normalized) {
        setResult({
          ...buildTeacherClientFallback(requestTask, requestInput),
          error: "返回结构不完整，已切换为备用内容。",
          fallbackUsed: true,
          needsReview: true,
        });
        setDraftStatus("这次返回结构没有通过检查，已显示备用内容，但不会保存到历史。");
        setCopyStatus("");
        setVoiceStatus("");
        return;
      }

      const fallbackUsed =
        Boolean(normalized.error) || isTeacherFallbackPayload(normalized, requestTask, requestInput);
      const data: TeacherResponse = {
        ...normalized,
        fallbackUsed,
        needsReview: true,
      };
      const savedAt = new Date().toISOString();
      const nextId = `${savedAt}-${requestThemeId}-${requestTask}`;
      setResult(data);
      setCopyStatus("");
      setVoiceStatus("");

      if (fallbackUsed) {
        setDraftStatus(
          normalized.error
            ? "这次生成使用了备用内容，已显示供参考，但不会保存到历史。"
            : "检测到当前是本地备用模板，已显示供参考，但不会保存到历史。",
        );
        return;
      }

      historyReadFailedRef.current = false;
      setSavedResults((current) => {
        const nextHistory = limitTeacherHistory([
          {
            ...data,
            id: nextId,
            themeId: requestThemeId,
            task: requestTask,
            scenario: requestScenario,
            savedAt,
            pinned: false,
          },
          ...current,
        ]);
        const resultSaved = nextHistory.some((item) => item.id === nextId);

        setDraftStatus(
          resultSaved
            ? "已生成并保存到本机历史，之后可以继续套用。"
            : "生成结果已显示。当前历史固定收藏已满，这次结果不会自动挤掉固定内容。",
        );

        return nextHistory;
      });
    } catch {
      setResult({
        ...buildTeacherClientFallback(
          requestTask,
          buildTeacherRequestInput(requestTask, cleanScenario, requestAgeGroup, requestThemeId),
        ),
        error: "生成暂时失败，已切换为备用内容。",
        fallbackUsed: true,
        needsReview: true,
      });
      setDraftStatus("生成暂时失败了，已显示备用内容；这次结果不会保存到历史。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    const text = buildTeacherCopyText(result, parentShareLine, task, scenario, themeId);

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("已按标题、生成内容、活动延伸和使用建议分段复制。");
    } catch {
      setCopyStatus("这次没有复制成功，可以再试一次。");
    }
  }

  async function previewResultVoice() {
    const text = result?.content?.trim();

    if (!text) {
      return;
    }

    cleanupAudio();

    if (premiumTtsEnabled) {
      try {
        setVoiceStatus(`正在用 ${premiumVoiceLabel} 试播老师引导语...`);
        const blob = await fetchPremiumSpeechAudio(text, "teacher");
        const nextUrl = URL.createObjectURL(blob);
        const audio = new Audio(nextUrl);

        audioUrlRef.current = nextUrl;
        audioRef.current = audio;
        audio.onended = cleanupAudio;
        audio.onerror = cleanupAudio;
        setIsPreviewSpeaking(true);
        await audio.play();
        return;
      } catch (error) {
        setVoiceStatus(
          error instanceof Error && error.message
            ? error.message
            : "高质量播报暂时不可用，当前先用浏览器播报。",
        );
      }
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceStatus("当前浏览器不支持播报，可以先继续使用儿童互动页。");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.03;
    utterance.onstart = () => setIsPreviewSpeaking(true);
    utterance.onend = () => setIsPreviewSpeaking(false);
    utterance.onerror = () => setIsPreviewSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setVoiceStatus("当前正在用浏览器播报老师引导语。");
  }

  function resetTeacherDraft(statusMessage = "已经恢复到默认内容，可以重新开始输入。") {
    setThemeId("habit");
    setTeacherAgeGroup(defaultTeacherAgeGroup);
    setTask(defaultTeacherTask.label);
    setScenario(buildHomePlanScenario("habit", defaultTeacherAgeGroup));
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(statusMessage);
  }

  function clearTeacherDraft() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认清空这台设备上的教师工作台草稿吗？当前输入会恢复为默认内容。")
    ) {
      setDraftStatus("已取消清空草稿，当前内容继续保留。");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }

    resetTeacherDraft("这台设备上的教师工作台草稿已经清空。");
  }

  function reuseSavedResult(item: SavedTeacherResult) {
    setThemeId(item.themeId);
    setTask(item.task);
    setTeacherAgeGroup(resolveTeacherAgeGroup(item.scenario));
    setScenario(item.scenario);
    setResult({
      title: item.title,
      content: item.content,
      tips: item.tips,
      error: item.error,
      fallbackUsed: item.fallbackUsed,
      needsReview: true,
    });
    setDraftStatus("已套用一条历史生成结果，可以继续修改或换一版。");
  }

  function saveParentSyncRecord(record: ParentSyncRecord) {
    setParentSyncRecords((current) => {
      const nextRecords = [record, ...current.filter((item) => item.id !== record.id)].slice(0, 24);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentSyncStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
  }

  function syncMiniGameRecordToParent(record: MiniGameRecord) {
    const parentRecord = buildParentSyncFromMiniGame(record);

    if (!parentRecord) {
      setParentSyncStatus("这条互动记录没有绑定幼儿身份，无法同步到家庭延续。请先让幼儿选择姓名或号数。");
      return;
    }

    saveParentSyncRecord(parentRecord);
    const parentTask = teacherTasks.find((item) => item.id === "parent-sync") ?? teacherTasks[0];
    bringIntoGenerationArea({
      nextThemeId: record.themeId,
      nextTask: parentTask.label,
      nextScenario: `请生成一段家园同步话术，老师确认后再发给家长。\n孩子：${parentRecord.childName}\n今日表现：${parentRecord.summary}\n家庭小任务：${parentRecord.homePractice}`,
      statusMessage: "已同步一条温和家庭任务到家长端，并把话术带入生成区，可继续润色。",
    });
  }

  function syncFoodPreferenceRecordToParent(record: FoodPreferenceRecord) {
    const parentRecord = buildParentSyncFromFoodPreference(record);

    if (!parentRecord) {
      setParentSyncStatus("这条美食认识记录没有绑定幼儿身份，无法同步到家庭延续。请先让幼儿选择姓名或号数。");
      return;
    }

    saveParentSyncRecord(parentRecord);
    const parentTask = teacherTasks.find((item) => item.id === "parent-sync") ?? teacherTasks[0];
    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: parentTask.label,
      nextScenario: `请生成一段闽食进餐观察的家园同步话术，老师确认后再发给家长。\n孩子：${parentRecord.childName}\n今日表现：${parentRecord.summary}\n家庭小任务：${parentRecord.homePractice}`,
      statusMessage: "已同步一条闽食家庭小任务到家长端，并把话术带入生成区，可继续润色。",
    });
  }

  function getMiniGameRecordByInsightKey(recordKey: string) {
    return growthArchive.miniGameRecords.find(
      (record) => getMiniGameInsightKey(record) === recordKey,
    );
  }

  function getFoodPreferenceRecordByInsightKey(recordKey: string) {
    return growthArchive.foodPreferenceRecords.find(
      (record) => getFoodPreferenceInsightKey(record) === recordKey,
    );
  }

  function generateAiFocusPlan(kind: "game" | "food", recordKey: string) {
    if (kind === "game") {
      const record = getMiniGameRecordByInsightKey(recordKey);

      if (record) {
        generateMiniGamePlan(record);
      }

      return;
    }

    const record = getFoodPreferenceRecordByInsightKey(recordKey);

    if (record) {
      generateFoodPreferencePlan(record);
    }
  }

  function generateAiFocusEncouragement(kind: "game" | "food", recordKey: string) {
    if (kind === "game") {
      const record = getMiniGameRecordByInsightKey(recordKey);

      if (record) {
        generateMiniGameEncouragement(record);
      }

      return;
    }

    const record = getFoodPreferenceRecordByInsightKey(recordKey);

    if (record) {
      generateFoodPreferenceEncouragement(record);
    }
  }

  function bringFoodSummaryToGeneration(
    row: (typeof foodObservationSummaryRows)[number],
    mode: "food-follow" | "activity" | "parent-sync",
  ) {
    const taskItem = teacherTasks.find((item) => item.id === mode) ?? teacherTasks[0];
    const childNames = row.childNames.length > 0 ? row.childNames.join("、") : "未选择身份";
    const scenarioByMode: Record<"food-follow" | "activity" | "parent-sync", string> = {
      "food-follow": `班级食物观察汇总：${row.foodLabel}出现 ${row.count} 条记录，主要原因是“${row.topReason}”，涉及幼儿：${childNames}。推荐靠近小步：${row.recommendedStep}。请生成温和食育跟进建议，不贴挑食标签，包含教师口令、区域活动和观察点。`,
      activity: `请基于班级食物观察生成一节幼儿园课堂活动方案。食物：${row.foodLabel}；高频原因：${row.topReason}；涉及幼儿：${childNames}；推荐靠近小步：${row.recommendedStep}。要求包含导入、感知/操作、互动表达、生活迁移、家园延伸。`,
      "parent-sync": `请生成家园同步话术。班级里有幼儿正在认识“${row.foodLabel}”，常见原因是“${row.topReason}”，建议回家轻轻做一步：${row.recommendedStep}。话术要温和、具体，不直接写孩子不喜欢。`,
    };

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: taskItem.label,
      nextScenario: scenarioByMode[mode],
      statusMessage: `已把“${row.foodLabel}”班级食物观察汇总带入跟进生成区。`,
    });
  }

  function updateWeeklyMenuEntries(updater: (records: WeeklyMenuEntry[]) => WeeklyMenuEntry[]) {
    setWeeklyMenuEntries((current) => {
      const nextRecords = updater(current).slice(0, 80);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(weeklyMenuStorageKey, serializeWeeklyMenuEntries(nextRecords));
      }

      return nextRecords;
    });
  }

  function saveWeeklyMenuEntry() {
    const dishName = menuDishName.trim().slice(0, 24);
    const ingredients = splitMenuText(menuIngredients);
    const focusIngredients = splitMenuText(menuFocusIngredients);

    if (!menuDate) {
      setMenuStatus("请先选择日期。");
      return;
    }

    if (!dishName) {
      setMenuStatus("请填写菜品名称。");
      return;
    }

    if (ingredients.length === 0) {
      setMenuStatus("请至少填写一种主要食材。");
      return;
    }

    const nextEntry: WeeklyMenuEntry = {
      id: `menu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: menuDate,
      mealType: menuMealType,
      dishName,
      ingredients,
      focusIngredients: focusIngredients.length > 0 ? focusIngredients : ingredients.slice(0, 2),
      createdAt: new Date().toISOString(),
    };

    updateWeeklyMenuEntries((current) => [nextEntry, ...current]);
    setMenuDishName("");
    setMenuIngredients("");
    setMenuFocusIngredients("");
    setMenuStatus(`${menuDate} ${menuMealType}「${dishName}」已保存到本周食谱。`);
  }

  function publishTodayMenuToChildren() {
    const todayEntries = weeklyMenuEntries.filter((entry) => entry.date === todayMenuDateKey);

    if (todayEntries.length === 0) {
      setMenuStatus("今天还没有录入食谱，请先保存今日早餐、午餐或点心。");
      return;
    }

    const publishedAt = new Date().toISOString();

    updateWeeklyMenuEntries((current) =>
      current.map((entry) =>
        entry.date === todayMenuDateKey
          ? {
              ...entry,
              publishedAt,
            }
          : entry,
      ),
    );
    setMenuStatus(`已发布今日 ${todayEntries.length} 条食谱到儿童端“今日闽食播报”。`);
  }

  function removeWeeklyMenuEntry(entryId: string) {
    updateWeeklyMenuEntries((current) => current.filter((entry) => entry.id !== entryId));
    setMenuStatus("已从本周食谱中移除这条记录。");
  }

  function bringDailyMenuSummaryToGeneration(
    row: (typeof todayMenuObservationRows)[number],
    mode: "tomorrow" | "activity" | "canteen",
  ) {
    const taskItem =
      teacherTasks.find((item) =>
        mode === "activity" ? item.id === "activity" : item.id === "food-follow",
      ) ?? teacherTasks[0];
    const scenarioByMode: Record<"tomorrow" | "activity" | "canteen", string> = {
      tomorrow: `今日食谱观察：${row.dishName}被记录 ${row.count} 次，重点食材是“${row.topIngredient}”，高频原因是“${row.topReason}”，孩子常选择“${row.topStep}”。请生成明日进餐引导，语言温和，包含餐前口令、观察提示和一个可执行靠近小步。`,
      activity: `请基于今日食谱观察生成一节课堂食育活动。菜品：${row.dishName}；重点食材：${row.topIngredient}；高频原因：${row.topReason}；涉及幼儿数：${row.childCount}；推荐靠近小步：${row.recommendedStep}。要求包含导入、感知/操作、互动表达、生活迁移和家园延伸。`,
      canteen: `请生成给食堂的班级聚合参考建议，不展示幼儿姓名，不写“孩子不吃某菜”。观察：本周部分幼儿对${row.topIngredient}仍处于认识阶段，常见原因是“${row.topReason}”，靠近小步多为“${row.topStep}”。建议包含切小、搭配熟悉食材、先做看闻观察等温和做法。`,
    };

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: taskItem.label,
      nextScenario: scenarioByMode[mode],
      statusMessage: `已把今日食谱「${row.dishName}」观察汇总带入跟进生成区。`,
    });
  }

  function syncAiFocusToParent(kind: "game" | "food", recordKey: string) {
    if (kind === "game") {
      const record = getMiniGameRecordByInsightKey(recordKey);

      if (record) {
        syncMiniGameRecordToParent(record);
      }

      return;
    }

    const record = getFoodPreferenceRecordByInsightKey(recordKey);

    if (record) {
      syncFoodPreferenceRecordToParent(record);
    }
  }

  function updateParentFeedbackRecords(
    updater: (records: ParentFeedbackRecord[]) => ParentFeedbackRecord[],
  ) {
    setParentFeedbackRecords((current) => {
      const nextRecords = updater(current);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
  }

  function markParentFeedbackRead(id: string) {
    updateParentFeedbackRecords((current) =>
      current.map((record) =>
        record.id === id ? { ...record, status: "read" as const } : record,
      ),
    );
    setParentSyncStatus("已把这条家长反馈标记为已读。");
  }

  function getParentFeedbackDraft(record: ParentFeedbackRecord): ParentFeedbackDraft {
    const draft = parentFeedbackDrafts[record.id];

    return {
      reply: draft?.reply ?? record.teacherReply ?? "",
      guidance: draft?.guidance ?? record.teacherGuidance ?? "",
    };
  }

  function updateParentFeedbackDraft(
    id: string,
    field: keyof ParentFeedbackDraft,
    value: string,
  ) {
    setParentFeedbackDrafts((current) => ({
      ...current,
      [id]: {
        reply: current[id]?.reply ?? "",
        guidance: current[id]?.guidance ?? "",
        [field]: value.slice(0, 360),
      },
    }));
  }

  function buildParentFeedbackResponseFallback(record: ParentFeedbackRecord): ParentFeedbackDraft {
    const content = record.content;
    const isFood = /吃|餐|饭|食|慢|海蛎|紫菜|芥菜|味道|营养|闽食|泉州|播报|厨房/.test(content);
    const isEmotion = /哭|怕|不愿|紧张|生气|害怕|焦虑|抗拒/.test(content);
    const isHabit = /洗手|排队|如厕|整理|安全|玩具|喝水/.test(content);

    if (isFood) {
      return {
        reply: `${record.childName}家长您好，收到您的反馈。孩子进食慢或暂时不想尝试时，我们会先观察原因，不给孩子贴标签，再用认名字、找食材、说发现和靠近一小步的方式慢慢陪伴。`,
        guidance: "家庭配合建议：先固定安静进餐位置，少催促；保留孩子熟悉的一种食物，再加入一小口目标食物；饭后只记录一次具体进步，例如愿意闻一闻或尝一口。",
      };
    }

    if (isEmotion) {
      return {
        reply: `${record.childName}家长您好，您的担心我们看到了。孩子出现情绪或抗拒时，我们会先接住感受，再给一个很小、能完成的步骤，帮助孩子重新获得安全感。`,
        guidance: "家庭配合建议：先说出孩子感受，再给两个可选动作；避免比较和催促；每天固定一个成功小任务，完成后表扬具体行为。",
      };
    }

    if (isHabit) {
      return {
        reply: `${record.childName}家长您好，感谢您把在家情况告诉我们。我们会结合在园观察，用图片、短口令和示范动作帮助孩子巩固这个生活习惯。`,
        guidance: "家庭配合建议：家里和幼儿园使用同一句提醒；一次只练一个步骤；孩子做对时说清楚“你刚才哪里做对了”。",
      };
    }

    return {
      reply: `${record.childName}家长您好，收到您的反馈。我们会继续结合孩子在园互动记录观察，不急着下结论，先从一个小目标开始支持孩子。`,
      guidance: "家庭配合建议：请先记录孩子出现这个情况的时间、场景和前后原因；在家只推进一个可完成的小任务，第二天再和老师同步变化。",
    };
  }

  async function generateParentFeedbackResponse(record: ParentFeedbackRecord) {
    setParentFeedbackAiLoadingId(record.id);
    setParentSyncStatus("正在根据这条家长反馈生成老师回复和育儿指导...");

    const fallback = buildParentFeedbackResponseFallback(record);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "teacher",
          theme: /吃|餐|饭|食|海蛎|紫菜|芥菜|闽/.test(record.content) ? "food" : "habit",
          teacherTask: "家长反馈回复与育儿指导",
          userInput: [
            `幼儿：${record.childName}`,
            `反馈类型：${getParentFeedbackCategoryLabel(record.category)}`,
            `家长反馈：${record.content}`,
            "请生成老师回复家长的话和家庭育儿指导，语气温和，不夸大，不承诺效果。",
          ].join("。"),
        }),
      });
      const payload = normalizeTeacherPayload(await response.json());
      const nextDraft = {
        reply: (payload?.content ?? fallback.reply).slice(0, 360),
        guidance: (payload?.tips?.join("；") ?? fallback.guidance).slice(0, 360),
      };

      setParentFeedbackDrafts((current) => ({
        ...current,
        [record.id]: nextDraft,
      }));
      setParentSyncStatus("已生成一版回复和育儿指导，请老师确认后保存。");
    } catch {
      setParentFeedbackDrafts((current) => ({
        ...current,
        [record.id]: fallback,
      }));
      setParentSyncStatus("AI 生成暂时不可用，已先填入本地育儿指导模板，请老师确认后保存。");
    } finally {
      setParentFeedbackAiLoadingId("");
    }
  }

  function saveParentFeedbackResponse(record: ParentFeedbackRecord) {
    const draft = getParentFeedbackDraft(record);
    const reply = draft.reply.trim();
    const guidance = draft.guidance.trim();

    if (!reply && !guidance) {
      setParentSyncStatus("请先填写老师回复或育儿指导，再保存到家庭延续。");
      return;
    }

    updateParentFeedbackRecords((current) =>
      current.map((item) =>
        item.id === record.id
          ? {
              ...item,
              status: "read" as const,
              teacherReply: reply || item.teacherReply,
              teacherGuidance: guidance || item.teacherGuidance,
              teacherRepliedAt: new Date().toISOString(),
              teacherReplySource: "manual" as const,
            }
          : item,
      ),
    );
    setParentSyncStatus(`${record.childName} 的家长反馈已保存回复和育儿指导。`);
  }

  function addChildToRoster() {
    const className = newChildClassName.trim().slice(0, 16);
    const name = newChildName.trim().slice(0, 12);
    const rosterNumber = newChildNumber.trim().replace(/[^\d]/g, "").slice(0, 3);

    if (!name) {
      setRosterStatus("请先输入幼儿姓名。");
      return;
    }

    if (!rosterNumber) {
      setRosterStatus("请给幼儿填写号数，孩子说“几号”时才能匹配。");
      return;
    }

    if (childRoster.some((child) => child.name === name || child.rosterNumber === rosterNumber)) {
      setRosterStatus("这个姓名或号数已经在花名册里，请检查后再添加。");
      return;
    }

    const nextChild: ChildProfile = {
      id: `child-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      className,
      rosterNumber,
      familyBindingCode: generateFamilyBindingCode(),
      createdAt: new Date().toISOString(),
    };

    setChildRoster((current) => [...current, nextChild].slice(0, 60));
    setNewChildClassName("");
    setNewChildName("");
    setNewChildNumber("");
    setRosterStatus(
      `${className ? `${className} · ` : ""}${rosterNumber}号 ${name} 已添加，并已生成家庭绑定码。儿童端可以说姓名或号数选择身份。`,
    );
  }

  function removeChildFromRoster(childId: string) {
    const child = childRoster.find((item) => item.id === childId);

    setChildRoster((current) => current.filter((item) => item.id !== childId));

    if (typeof window !== "undefined" && window.localStorage.getItem(selectedChildStorageKey) === childId) {
      window.localStorage.removeItem(selectedChildStorageKey);
    }

    setRosterStatus(child ? `已移除 ${child.name}。历史互动记录仍保留，不会被删除。` : "已更新花名册。");
  }

  function resetChildFamilyBindingCode(childId: string) {
    const nextCode = generateFamilyBindingCode();
    const child = childRoster.find((item) => item.id === childId);

    setChildRoster((current) =>
      current.map((item) =>
        item.id === childId
          ? {
              ...item,
              familyBindingCode: nextCode,
            }
          : item,
      ),
    );
    setRosterStatus(
      child
        ? `${formatChildLabel(child)} 的家庭绑定码已更新为 ${nextCode}，旧绑定码已失效。`
        : `家庭绑定码已更新为 ${nextCode}。`,
    );
  }

  async function copyFamilyBindingCode(child: ChildProfile) {
    const code = child.familyBindingCode?.trim().toUpperCase();

    if (!code) {
      setRosterStatus(`请先为 ${formatChildLabel(child)} 生成家庭绑定码。`);
      return;
    }

    const text = `${formatChildLabel(child)} 的家庭绑定码：${code}。请家长进入家庭延续页，输入幼儿姓名或号数，并输入家庭绑定码后查看老师同步建议。`;

    try {
      await navigator.clipboard.writeText(text);
      setRosterStatus(`已复制 ${formatChildLabel(child)} 的家庭绑定码给家长。`);
    } catch {
      setRosterStatus(`浏览器未允许自动复制，请手动复制：${text}`);
    }
  }

  function mergeRosterItems(items: Array<{ className?: string; name: string; rosterNumber: string }>) {
    if (items.length === 0) {
      setRosterStatus("没有识别到有效名单。请使用“班级,号数,姓名”的格式。");
      return;
    }

    let addedCount = 0;
    setChildRoster((current) => {
      const next = [...current];

      for (const item of items) {
        const duplicated = next.some(
          (child) => child.name === item.name || child.rosterNumber === item.rosterNumber,
        );

        if (duplicated) {
          continue;
        }

        next.push({
          id: `child-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${addedCount}`,
          className: item.className,
          name: item.name,
          rosterNumber: item.rosterNumber,
          familyBindingCode: generateFamilyBindingCode(),
          createdAt: new Date().toISOString(),
        });
        addedCount += 1;
      }

      return next.slice(0, 60);
    });
    setRosterStatus(`已导入 ${addedCount} 位幼儿并生成家庭绑定码；重复姓名或号数已自动跳过。`);
  }

  function downloadRosterTemplate() {
    const template = "班级,号数,姓名\n中一班,1,小安\n中一班,2,小宇\n中一班,3,小禾\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "幼习宝班级花名册模板.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setRosterStatus("已生成花名册模板，老师可以按“班级,号数,姓名”补充后再导入。");
  }

  function importRosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      mergeRosterItems(parseRosterImportText(text));
    };
    reader.onerror = () => {
      setRosterStatus("花名册文件读取失败，请换成 CSV 或 TXT 后再试。");
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  function generateMiniGamePlan(record: MiniGameRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const nextScenario = buildMiniGameInterventionScenario(record);

    bringIntoGenerationArea({
      nextThemeId: record.themeId,
      nextTask: homeTask.label,
      nextScenario,
      statusMessage: "已把这条幼儿互动记录带入跟进生成区，请确认后点击“开始生成”。",
    });
  }

  function generateMiniGameEncouragement(record: MiniGameRecord) {
    const followUp = getMiniGameFollowUp(record);
    const encourageTask =
      teacherTasks.find((item) => item.id === "encouragement") ?? teacherTasks[0];

    bringIntoGenerationArea({
      nextThemeId: record.themeId,
      nextTask: encourageTask.label,
      nextScenario: `幼儿互动记录：${record.childName ?? "孩子"}完成“${followUp.displayName}”。记录内容：${formatTeacherPickedItems(record.pickedItems)}。请生成一句具体、温和、不比较的鼓励语，并给出下一小步。`,
      statusMessage: "已带入鼓励语草稿，可以直接修改或点击开始生成。",
      nextResult: {
      title: `${record.childName ?? "孩子"}的鼓励语`,
      content: followUp.encouragement,
      tips: ["说具体行为。", "不比较不催促。", "鼓励下一小步。"],
      needsReview: true,
      },
    });
  }

  function generateFoodPreferencePlan(record: FoodPreferenceRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "food-follow") ?? teacherTasks[0];
    const nextScenario = buildPreferenceInterventionScenario(record, teacherAgeGroup);

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: homeTask.label,
      nextScenario,
      statusMessage: "已把美食认识观察带入跟进生成区，请确认后点击“开始生成”。",
    });
  }

  function generateFoodPreferenceEncouragement(record: FoodPreferenceRecord) {
    const followUp = getFoodPreferenceFollowUp(record);
    const encourageTask =
      teacherTasks.find((item) => item.id === "encouragement") ?? teacherTasks[0];

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: encourageTask.label,
      nextScenario: `美食认识观察：${record.childName ?? "孩子"}正在认识“${record.foodLabel}”，原因是“${record.reasonLabel}”，靠近小步是“${record.approachStep ?? "看一看"}”。请生成一句温和鼓励语。`,
      statusMessage: "已带入美食鼓励语草稿，可以继续修改或点击开始生成。",
      nextResult: {
      title: `${record.childName ?? "孩子"}的美食鼓励语`,
      content: followUp.encouragement,
      tips: ["先接纳感受。", "只推进一小步。", "不贴饮食标签。"],
      needsReview: true,
      },
    });
  }

  function createTeacherAccount() {
    const account = teacherSetupAccount.trim();
    const passcode = teacherSetupPasscode.trim();

    if (account.length < 2 || passcode.length < 4) {
      setTeacherAuthStatus("本机班级试用账号至少 2 个字，口令至少 4 位。");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherAccountStorageKey, account);
      window.localStorage.setItem(teacherPasscodeStorageKey, passcode);
      window.sessionStorage.setItem(teacherSessionStorageKey, account);
    }

    setTeacherHasAccount(true);
    setTeacherAuthenticated(true);
    setTeacherAccountInput(account);
    setTeacherPasscodeInput("");
    setTeacherSetupPasscode("");
    setTeacherAuthStatus("本机班级试用账号已创建，本次已进入教师工作台。");
  }

  function loginTeacherAccount() {
    const account = teacherAccountInput.trim();
    const passcode = teacherPasscodeInput.trim();

    if (typeof window === "undefined") {
      return;
    }

    const savedAccount = window.localStorage.getItem(teacherAccountStorageKey) ?? "";
    const savedPasscode = window.localStorage.getItem(teacherPasscodeStorageKey) ?? "";

    if (account === savedAccount && passcode === savedPasscode) {
      window.sessionStorage.setItem(teacherSessionStorageKey, account);
      setTeacherAuthenticated(true);
      setTeacherPasscodeInput("");
      setTeacherAuthStatus("本机班级试用身份已确认，可以查看互动汇总和生成方案。");
      return;
    }

    setTeacherAuthStatus("账号或口令不正确。可以重新输入，或点击重置本机教师账号。");
  }

  function quickEnterTeacherTrialAccount() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherAccountStorageKey, trialTeacherAccount);
      window.localStorage.setItem(teacherPasscodeStorageKey, trialTeacherPasscode);
      window.sessionStorage.setItem(teacherSessionStorageKey, trialTeacherAccount);
    }

    setTeacherHasAccount(true);
    setTeacherAuthenticated(true);
    setTeacherAccountInput(trialTeacherAccount);
    setTeacherPasscodeInput("");
    setTeacherSetupAccount("");
    setTeacherSetupPasscode("");
    setTeacherAuthStatus("已用班级试用快速进入教师工作台。正式上线需使用园所账号系统。");
  }

  function logoutTeacherAccount() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(teacherSessionStorageKey);
    }

    cleanupAudio();
    setTeacherAuthenticated(false);
    setTeacherPasscodeInput("");
    setTeacherAuthStatus("已退出教师工作台，请重新登录后再查看。");
  }

  function resetTeacherAccountSetup() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认重置本机教师账号吗？这只会清除这台设备上的教师登录口令，不会删除幼儿记录、家长反馈或生成内容。")
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(teacherAccountStorageKey);
      window.localStorage.removeItem(teacherPasscodeStorageKey);
      window.sessionStorage.removeItem(teacherSessionStorageKey);
    }

    setTeacherHasAccount(false);
    setTeacherAuthenticated(false);
    setTeacherAccountInput("");
    setTeacherPasscodeInput("");
    setTeacherSetupAccount("");
    setTeacherSetupPasscode("");
    setTeacherAuthStatus("旧的本机教师账号已清除。请重新设置教师账号和至少 4 位口令。");
  }

  if (!teacherAuthHydrated || !teacherAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
        <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-10">
          <p className="text-sm font-semibold text-teal-700">老师身份确认</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            {teacherHasAccount ? "登录本机班级试用账号" : "创建本机班级试用账号"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            当前为班级试用模式。本机班级试用账号仅用于保护这台设备上的班级数据，老师可查看幼儿互动记录、家长反馈和课程生成内容。
            该口令仅用于本机试用，不用于正式上线；正式上线需后端账号、HTTPS 与加密存储。
            如果这台设备已经保存过旧账号，请使用下方“重置本机教师账号”，只会重设登录口令，不会删除幼儿记录。
          </p>

          <div className="mt-8 grid gap-4 rounded-[1.5rem] bg-white/86 p-5 shadow-sm md:grid-cols-2">
            {teacherHasAccount ? (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  本机班级试用账号
                  <input
                    value={teacherAccountInput}
                    onChange={(event) => setTeacherAccountInput(event.target.value)}
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="请输入本机班级试用账号"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  登录口令
                  <input
                    value={teacherPasscodeInput}
                    onChange={(event) => setTeacherPasscodeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        loginTeacherAccount();
                      }
                    }}
                    type="password"
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="请输入口令"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  设置本机班级试用账号
                  <input
                    value={teacherSetupAccount}
                    onChange={(event) => setTeacherSetupAccount(event.target.value)}
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="例如：中一班老师"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  设置登录口令
                  <input
                    value={teacherSetupPasscode}
                    onChange={(event) => setTeacherSetupPasscode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        createTeacherAccount();
                      }
                    }}
                    type="password"
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="至少 4 位"
                  />
                </label>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={teacherHasAccount ? loginTeacherAccount : createTeacherAccount}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              type="button"
            >
              {teacherHasAccount ? "进入教师工作台" : "创建并进入"}
            </button>
            <button
              onClick={quickEnterTeacherTrialAccount}
              className="rounded-full bg-teal-100 px-5 py-3 text-sm font-semibold text-teal-900 ring-1 ring-teal-200 transition hover:-translate-y-0.5 hover:bg-teal-200"
              type="button"
            >
              班级试用快速进入
            </button>
            <button
              onClick={resetTeacherAccountSetup}
              className="rounded-full bg-rose-100 px-5 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 transition hover:-translate-y-0.5 hover:bg-rose-200"
              type="button"
            >
              重置本机教师账号
            </button>
            <p className="text-sm font-semibold text-teal-700">{teacherAuthStatus}</p>
          </div>
          <p className="mt-3 rounded-[1.2rem] bg-teal-50 px-4 py-3 text-sm leading-7 text-teal-950">
            班级试用快速进入仅用于本机演示和班级试用，正式上线需使用园所账号系统。
          </p>
          {teacherHasAccount ? (
            <div className="mt-4 rounded-[1.3rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
              如果无法进入，通常是旧本机口令还保存在浏览器里。点击“重置本机教师账号”后，可立即设置新的本机班级试用账号；幼儿记录、家长反馈和生成内容都会保留。
            </div>
          ) : (
            <div className="mt-4 rounded-[1.3rem] bg-teal-50 px-4 py-3 text-sm leading-7 text-teal-950">
              首次使用请设置一个便于本班老师记住的本机班级试用账号，账号至少 2 个字，口令至少 4 位。
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              幼芽成长智伴 · 教师工作台
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
              看常规记录，
              <span className="block text-2xl text-slate-700 md:text-3xl">
                生成跟进并同步家长
              </span>
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              幼习宝一日生活习惯养成 + 闽食成长岛食育改善协同教育智能体。
              一个教育智能体平台，两条主线：幼习宝关注洗手、喝水、如厕、整理、排队、文明进餐；闽食成长岛关注每日食谱播报、泉州食材认识、食物观察和家园延续。
            </p>
            <p className="mt-3 max-w-3xl text-base leading-8 text-slate-600">
              这里不是功能超市，而是教师根据幼儿互动记录进行跟进的工作台。老师先看 AI 汇总的常规与进餐观察，再生成跟进建议，确认后同步家长，形成家园共育记录。
              {premiumTtsEnabled ? ` ${premiumVoiceLabel} 可用于试播老师引导语和活动口令。` : ""}
            </p>
          </div>
          <button
            onClick={logoutTeacherAccount}
            className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
          >
            退出班级试用账号
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            { label: "班级幼儿", value: classOverview.rosterCount, tone: "bg-white" },
            { label: "今日参与幼儿", value: classOverview.participatedCount, tone: "bg-cyan-50" },
            { label: "今日完成任务", value: classOverview.interactionCount, tone: "bg-amber-50" },
            { label: "今日获得奖章", value: classOverview.badgeCount, tone: "bg-emerald-50" },
            { label: "家长待回复", value: classOverview.newFeedbackCount, tone: "bg-rose-50" },
            { label: "需要关注", value: classOverview.focusCount, tone: "bg-orange-50" },
          ].map((item) => (
            <div key={item.label} className={`rounded-[1.4rem] ${item.tone} px-4 py-4 shadow-sm`}>
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[1.4rem] bg-white/78 px-4 py-4 text-sm leading-7 text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
          <p className="font-semibold text-slate-900">教育智能体证据链</p>
              <p className="mt-1 text-slate-600">
                把 AI 正向提醒、幼儿互动记录、教师跟进、家庭延续和反馈沉淀连起来，展示常规改善证据。
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
              班级试用可追踪
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {[
              { label: "儿童互动", value: miniGameSummaryStats.total, hint: "累计任务" },
              { label: "重点线索", value: classOverview.focusCount, hint: "待跟进" },
              { label: "家园同步", value: parentSyncRecords.length, hint: "已发送" },
              { label: "家庭反馈", value: parentFeedbackRecords.length, hint: "家长回流" },
              { label: "奖章沉淀", value: growthArchive.badgeRecords.length, hint: "成长表现" },
            ].map((item, index) => (
              <div key={item.label} className="rounded-[1.2rem] bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  {index + 1}. {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="rounded-[1.4rem] bg-white/78 px-4 py-3 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">推荐下一步</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendedNextSteps.map((step) => (
                <span
                  key={step}
                  className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"
                >
                  {step}
                </span>
              ))}
            </div>
            <p className="mt-2">
              需要关注包含：喝水洗手、排队整理、文明进餐、美食认识观察、未回复家长反馈，以及未绑定幼儿身份的记录。
            </p>
            {classOverview.unboundRecords > 0
              ? ` 当前有 ${classOverview.unboundRecords} 条未绑定记录，请先引导幼儿选择小名牌。`
              : ""}
          </div>
          <div className="flex flex-wrap gap-2">
            {teacherTasks.slice(0, 3).map((item) => (
              <button
                key={item.id}
                onClick={() => selectTeacherTask(item)}
                className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="order-1 rounded-[2.5rem] bg-[linear-gradient(135deg,#f6fffb_0%,#ffffff_52%,#fff8df_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">AI重点观察与问题汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">看常规、闽食和家园反馈线索</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              系统把儿童端的一日生活常规、文明进餐和闽食观察记录转成老师可跟进的教育线索。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            AI 分析 {aiDailyObservationCards.length} 项
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "一日常规",
              cards: aiDailyObservationCards.filter((card) =>
                ["今日参与情况", "一日常规表现", "今日建议动作"].includes(card.label),
              ),
            },
            {
              title: "闽食观察",
              cards: aiDailyObservationCards.filter((card) =>
                ["闽食探索表现", "需要老师关注"].includes(card.label),
              ),
            },
            {
              title: "家园反馈",
              cards: [
                {
                  label: "家长反馈",
                  value:
                    newParentFeedbackCount > 0
                      ? `${newParentFeedbackCount} 条家长反馈待回复，可先生成家园同步话术。`
                      : "暂无新的家长反馈，已同步建议可继续观察家庭回流。",
                },
              ],
            },
          ].map((group) => (
            <article key={group.title} className="rounded-[1.8rem] bg-white/88 p-4 shadow-sm">
              <p className="text-sm font-semibold text-teal-700">{group.title}</p>
              <div className="mt-3 space-y-3">
                {group.cards.map((card) => (
                  <div key={card.label} className="rounded-[1.2rem] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                    <p className="mt-1 text-sm leading-7 text-slate-700">{card.value}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cyan-700">重点记录操作</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">生成跟进、同步家长或鼓励语</h3>
            </div>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              {aiFocusInsightRows.length} 条
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {aiFocusInsightRows.length > 0 ? (
              aiFocusInsightRows.map((row) => (
                <article key={row.id} className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.childName} · {row.title}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{row.meaning}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                      AI 线索
                    </span>
                  </div>
                  <p className="mt-3 rounded-[1.1rem] bg-emerald-50 px-3 py-2 text-sm leading-7 text-emerald-900">
                    下一步：{row.nextAction}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => generateAiFocusPlan(row.kind, row.recordKey)}
                      className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                      type="button"
                    >
                      生成跟进建议
                    </button>
                    <button
                      onClick={() => syncAiFocusToParent(row.kind, row.recordKey)}
                      className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                      type="button"
                    >
                      AI 家园同步
                    </button>
                    <button
                      onClick={() => generateAiFocusEncouragement(row.kind, row.recordKey)}
                      className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                      type="button"
                    >
                      生成鼓励语
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600 lg:col-span-2">
                暂无重点线索。幼儿完成一次儿童端互动后，这里会自动给出教育含义和下一步跟进。
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">按幼儿查看近期记录</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">一个幼儿一个窗口</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                先看每位幼儿的次数、食物观察、家庭反馈和最新 AI 观察，再点开查看细节，不把全部记录铺满页面。
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800">
              {childRecordSummaryRows.length} 位
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {childRecordSummaryRows.length > 0 ? (
              childRecordSummaryRows.map((row) => {
                const expanded = selectedChildSummaryId === row.child.id;
                const trendMax = Math.max(row.miniCount, row.foodCount, row.feedbackCount, row.badgeCount, 1);
                const trendItems = [
                  { label: "常规互动", value: row.miniCount, tone: "bg-teal-500" },
                  { label: "食物观察", value: row.foodCount, tone: "bg-amber-500" },
                  { label: "家庭反馈", value: row.feedbackCount, tone: "bg-rose-500" },
                  { label: "奖章变化", value: row.badgeCount, tone: "bg-cyan-500" },
                ];

                return (
                  <article key={row.child.id} className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <button
                      onClick={() => setSelectedChildSummaryId(expanded ? "" : row.child.id)}
                      className="w-full text-left"
                      type="button"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {row.child.className ? `${row.child.className} · ` : ""}
                            {formatChildLabel(row.child)}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">{row.latestObservation}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                          {expanded ? "收起" : "展开"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        {trendItems.map((item) => (
                          <div key={item.label} className="rounded-[1rem] bg-white px-3 py-2">
                            <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                            <p className="mt-1 text-lg font-semibold text-slate-950">{item.value}</p>
                            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${item.tone}`}
                                style={{ width: `${Math.max(8, (item.value / trendMax) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>
                    {expanded ? (
                      <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3">
                        {row.detailLines.length > 0 ? (
                          <div className="grid gap-2">
                            {row.detailLines.map((line) => (
                              <p key={line} className="text-sm leading-7 text-slate-700">
                                {line}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm leading-7 text-slate-600">
                            暂无详细记录。孩子完成一次互动或家庭反馈后，这里会出现跟进线索。
                          </p>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600 lg:col-span-2">
                还没有花名册。请在底部基础设置导入或添加幼儿后，再查看个人窗口。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="order-2 rounded-[2.5rem] bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#fff7ed_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">闽食每日探味</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">每周食谱发布</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              老师录入本周食谱后，可发布今日食谱到儿童端。孩子会先听幼儿化播报，再进入美食认识观察卡。
            </p>
          </div>
          <button
            onClick={publishTodayMenuToChildren}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            type="button"
          >
            发布今日食谱到儿童端
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                日期
                <input
                  value={menuDate}
                  onChange={(event) => setMenuDate(event.target.value)}
                  className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
                  type="date"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                餐次
                <select
                  value={menuMealType}
                  onChange={(event) => setMenuMealType(event.target.value as MealType)}
                  className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
                >
                  {mealTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              菜品名称
              <input
                value={menuDishName}
                onChange={(event) => setMenuDishName(event.target.value)}
                placeholder="如 香菇青菜、紫菜蛋汤、面线糊"
                className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              主要食材
              <input
                value={menuIngredients}
                onChange={(event) => setMenuIngredients(event.target.value)}
                placeholder="用顿号或逗号分隔，如 香菇、青菜、鸡蛋"
                className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              重点观察食材
              <input
                value={menuFocusIngredients}
                onChange={(event) => setMenuFocusIngredients(event.target.value)}
                placeholder="如 香菇、小葱、蒜"
                className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {menuFocusIngredientSuggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    const current = splitMenuText(menuFocusIngredients);
                    setMenuFocusIngredients(
                      current.includes(item) ? current.join("、") : [...current, item].join("、"),
                    );
                  }}
                  className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-200"
                  type="button"
                >
                  + {item}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={saveWeeklyMenuEntry}
                className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                保存到本周食谱
              </button>
              <p className="text-sm font-semibold text-cyan-900">{menuStatus}</p>
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-700">今日已发布</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">儿童端今日闽食播报来源</h3>
              </div>
              <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
                {todayPublishedMenuEntries.length} 条
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {weeklyMenuEntries.filter((entry) => entry.date === todayMenuDateKey).length > 0 ? (
                weeklyMenuEntries
                  .filter((entry) => entry.date === todayMenuDateKey)
                  .map((entry) => (
                    <article key={entry.id} className="rounded-[1.4rem] bg-cyan-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {entry.mealType} · {entry.dishName}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            食材：{entry.ingredients.join("、")}；重点观察：{entry.focusIngredients.join("、")}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          entry.publishedAt ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-600"
                        }`}>
                          {entry.publishedAt ? "已发布" : "未发布"}
                        </span>
                      </div>
                      <button
                        onClick={() => removeWeeklyMenuEntry(entry.id)}
                        className="mt-3 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-rose-50 hover:text-rose-800"
                        type="button"
                      >
                        移除
                      </button>
                    </article>
                  ))
              ) : (
                <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                  今天还没有食谱。先在左侧录入，再点击“发布今日食谱到儿童端”。
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="order-2 rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_56%,#ecfeff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-700">每日食谱观察汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">今日菜品与食材接受度</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              按今日已发布食谱聚合儿童端观察记录，只用于温和食育跟进和班级聚合建议。
            </p>
          </div>
          <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-900">
            {todayMenuObservationRows.length} 类观察
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {todayMenuObservationRows.length > 0 ? (
            todayMenuObservationRows.map((row) => (
              <article key={row.dishName} className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-orange-700">今日菜品</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">{row.dishName}</h3>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-900">
                    {row.count} 条观察
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <p>重点食材：<span className="font-semibold text-slate-900">{row.topIngredient}</span></p>
                  <p>高频原因：<span className="font-semibold text-slate-900">{row.topReason}</span></p>
                  <p>靠近小步：{row.topStep}</p>
                  <p>涉及幼儿数：{row.childCount} 名</p>
                  <p className="rounded-[1.2rem] bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">
                    推荐：{row.recommendedStep}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => bringDailyMenuSummaryToGeneration(row, "tomorrow")}
                    className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    AI生成明日进餐引导
                  </button>
                  <button
                    onClick={() => bringDailyMenuSummaryToGeneration(row, "activity")}
                    className="rounded-full bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-900 transition hover:-translate-y-0.5"
                    type="button"
                  >
                    AI生成课堂食育活动
                  </button>
                  <button
                    onClick={() => bringDailyMenuSummaryToGeneration(row, "canteen")}
                    className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                    type="button"
                  >
                    生成食堂参考建议
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-[1.8rem] bg-white/88 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              今日食谱还没有关联观察。发布食谱后，儿童端完成美食认识观察卡，这里会显示菜品、食材、原因和靠近小步。
            </p>
          )}
        </div>
      </section>

      <section className="order-2 rounded-[2.5rem] bg-[linear-gradient(135deg,#fff8df_0%,#ffffff_56%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">班级食物观察汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">看见孩子正在认识的食物</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              聚合儿童端“美食认识观察卡”，帮助老师看到高频食物、原因、涉及幼儿和推荐靠近小步。
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            {foodObservationSummaryRows.length} 类食物
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {foodObservationSummaryRows.length > 0 ? (
            foodObservationSummaryRows.map((row) => (
              <article key={row.foodLabel} className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-700">高频食物</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">{row.foodLabel}</h3>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    {row.count} 条记录
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <p>高频原因：<span className="font-semibold text-slate-900">{row.topReason}</span></p>
                  <p>涉及幼儿：{row.childCount > 0 ? `${row.childCount} 名 · ${row.childNames.join("、")}` : "暂无绑定身份"}</p>
                  <p>最近记录：{row.latestRecord.childName ?? "未选择身份"} · {new Date(row.latestRecord.recordedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="rounded-[1.2rem] bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">
                    推荐靠近小步：{row.recommendedStep}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => bringFoodSummaryToGeneration(row, "food-follow")}
                    className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    AI生成食育跟进建议
                  </button>
                  <button
                    onClick={() => bringFoodSummaryToGeneration(row, "activity")}
                    className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:-translate-y-0.5"
                    type="button"
                  >
                    AI生成课堂活动方案
                  </button>
                  <button
                    onClick={() => bringFoodSummaryToGeneration(row, "parent-sync")}
                    className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                    type="button"
                  >
                    同步家长话术
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-[1.8rem] bg-white/88 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              暂无食物观察记录。儿童端完成“美食认识观察卡”后，这里会按食物名称自动汇总。
            </p>
          )}
        </div>
      </section>


      <section className="order-4 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_52%,#fff2f5_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-700">家园共育</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">家庭同步与反馈跟进</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              这里只显示家长提交的疑惑、想法和在家观察。老师选择一条反馈后，回复家长并给出可执行的家庭育儿指导。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
              待处理 {newParentFeedbackCount} 条
            </span>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              已回复 {repliedParentFeedbackCount} 条
            </span>
          </div>
        </div>

        <p className="mt-4 rounded-[1.4rem] bg-white/82 px-4 py-3 text-sm font-semibold text-cyan-900">
          {parentSyncStatus}
        </p>

        <div className="mt-4 rounded-[1.4rem] bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
          <p className="font-semibold">家庭光盘行动汇总</p>
          <p>
            已收到 {familyPlateActionSummary.count} 条家庭光盘行动反馈，涉及{" "}
            {familyPlateActionSummary.childCount} 名幼儿。这里不做排行，只作为个人成长和家园延续证据。
            {familyPlateActionSummary.latest
              ? ` 最近一条：${familyPlateActionSummary.latest.childName} · ${familyPlateActionSummary.latest.content}`
              : " 家长提交后会进入这里和反馈列表。"}
          </p>
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white/86 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cyan-700">已同步给家长</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">老师建议与居家任务</h3>
            </div>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              {parentSyncRecords.length} 条
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {parentSyncRecords.slice(0, 4).map((record) => (
              <article key={record.id} className="rounded-[1.4rem] bg-cyan-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{record.title}</p>
                    <p className="mt-1 text-xs font-semibold text-cyan-900">
                      {record.childName} · {formatParentSyncTime(record.syncedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900">
                    {record.sourceLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{record.summary}</p>
                <p className="mt-3 rounded-[1.1rem] bg-white/82 px-3 py-2 text-sm leading-7 text-slate-700">
                  家庭小任务：{record.homePractice}
                </p>
              </article>
            ))}
            {parentSyncRecords.length === 0 ? (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600 lg:col-span-2">
                还没有同步给家长的内容。可从互动记录中点击“同步家长”，这里会显示老师建议和家庭小任务。
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-rose-700">家长反馈列表</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">选择要回复的信息</h3>
              </div>
              <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
                {parentFeedbackRecords.length} 条
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {latestParentFeedbackRecords.length > 0 ? (
                latestParentFeedbackRecords.map((record) => {
                  const isSelected = selectedParentFeedback?.id === record.id;
                  const isReplied = Boolean(record.teacherReply || record.teacherGuidance);

                  return (
                    <button
                      key={record.id}
                      onClick={() => setSelectedParentFeedbackId(record.id)}
                      className={`rounded-[1.4rem] px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                        isSelected
                          ? "bg-rose-100 ring-2 ring-rose-300"
                          : record.status === "new"
                            ? "bg-rose-50"
                            : "bg-slate-50"
                      }`}
                      type="button"
                    >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {record.childName} · {getParentFeedbackCategoryLabel(record.category)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatParentSyncTime(record.createdAt)}
                          {record.status === "new" ? " · 新反馈" : " · 已读"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          isReplied ? "bg-cyan-100 text-cyan-900" : "bg-white text-rose-800"
                        }`}
                      >
                        {isReplied ? "已回复" : "待回复"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">
                      {record.content}
                    </p>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                  家庭延续还没有提交反馈。家长选择幼儿身份后，可在家庭延续页填写疑惑、想法或在家观察。
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            {selectedParentFeedback ? (
              (() => {
                const draft = getParentFeedbackDraft(selectedParentFeedback);

                return (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-cyan-700">回复与育儿指导</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-900">
                          {selectedParentFeedback.childName} ·{" "}
                          {getParentFeedbackCategoryLabel(selectedParentFeedback.category)}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatParentSyncTime(selectedParentFeedback.createdAt)}
                          {selectedParentFeedback.status === "new" ? " · 新反馈" : " · 已读"}
                        </p>
                      </div>
                      {selectedParentFeedback.status === "new" ? (
                        <button
                          onClick={() => markParentFeedbackRead(selectedParentFeedback.id)}
                          className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 transition hover:-translate-y-0.5"
                          type="button"
                        >
                          标记已读
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-[1.4rem] bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">家长反馈原文</p>
                      <p className="mt-2 text-sm leading-7 text-slate-800">
                        {selectedParentFeedback.content}
                      </p>
                      {selectedParentFeedback.attachmentDataUrl ? (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-slate-500">
                            家庭观察照片 · {selectedParentFeedback.attachmentName ?? "照片"}
                          </p>
                          <div
                            aria-label={
                              selectedParentFeedback.attachmentName ?? "家庭观察照片"
                            }
                            className="mt-2 h-32 w-32 rounded-[1.2rem] bg-cover bg-center shadow-sm"
                            role="img"
                            style={{
                              backgroundImage: `url(${selectedParentFeedback.attachmentDataUrl})`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {selectedParentFeedback.teacherReply || selectedParentFeedback.teacherGuidance ? (
                      <div className="mt-4 rounded-[1.4rem] bg-cyan-50 px-4 py-3">
                        <p className="text-xs font-semibold text-cyan-800">
                          已保存到家庭延续 ·{" "}
                          {formatParentSyncTime(
                            selectedParentFeedback.teacherRepliedAt ??
                              selectedParentFeedback.createdAt,
                          )}
                        </p>
                        {selectedParentFeedback.teacherReply ? (
                          <p className="mt-2 text-sm leading-7 text-slate-800">
                            回复：{selectedParentFeedback.teacherReply}
                          </p>
                        ) : null}
                        {selectedParentFeedback.teacherGuidance ? (
                          <p className="mt-2 text-sm leading-7 text-slate-800">
                            育儿指导：{selectedParentFeedback.teacherGuidance}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <label className="mt-4 block">
                      <span className="text-sm font-semibold text-slate-700">老师回复家长</span>
                      <textarea
                        value={draft.reply}
                        onChange={(event) =>
                          updateParentFeedbackDraft(
                            selectedParentFeedback.id,
                            "reply",
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-28 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-rose-300 focus:bg-white"
                        placeholder="先回应家长的担心，再说明老师会如何观察和支持孩子。"
                      />
                    </label>

                    <label className="mt-4 block">
                      <span className="text-sm font-semibold text-slate-700">家庭育儿指导</span>
                      <textarea
                        value={draft.guidance}
                        onChange={(event) =>
                          updateParentFeedbackDraft(
                            selectedParentFeedback.id,
                            "guidance",
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-28 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-300 focus:bg-white"
                        placeholder="给家长一到两个在家能执行的小建议，避免夸大和贴标签。"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => generateParentFeedbackResponse(selectedParentFeedback)}
                        className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={parentFeedbackAiLoadingId === selectedParentFeedback.id}
                        type="button"
                      >
                        {parentFeedbackAiLoadingId === selectedParentFeedback.id
                          ? "生成中..."
                          : "AI 生成回复"}
                      </button>
                      <button
                        onClick={() => saveParentFeedbackResponse(selectedParentFeedback)}
                        className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                        type="button"
                      >
                        保存回复与指导
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                请先在左侧选择一条家长反馈。选择后，这里会显示家长原话、老师回复和育儿指导输入区。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="order-5 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fff9_0%,#ffffff_52%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">成效变化记录</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">把互动变化沉淀成证据</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              成效证明不做复杂系统，先从提醒次数、主动完成次数、食物接受变化、家园反馈次数形成证据。
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
            最近 {effectChangeRecords.length} 条
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {effectEvidenceStats.map((item) => (
            <div key={item.label} className="rounded-[1.4rem] bg-white/88 px-4 py-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{item.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {effectChangeRecords.map((line) => (
            <p
              key={line}
              className="rounded-[1.4rem] bg-white/88 px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"
            >
              {line}
            </p>
          ))}
        </div>
      </section>

      <section ref={generationSectionRef} className="order-3 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">生成结果与修改区</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">确认草稿后再生成</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            先选主题、年龄段和生成类型；也可以从上方互动记录带入线索，再生成可修改的跟进建议、课堂活动、家园同步话术或鼓励语。
          </p>

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500">1. 选择主题</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {Object.values(themes).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => selectTeacherTheme(theme.id)}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    themeId === theme.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {theme.emoji} {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500">2. 选择年龄段</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {teacherAgeOptions.map((item) => (
                <button
                  key={item.label}
                  onClick={() => selectTeacherAge(item.label)}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    teacherAgeGroup === item.label
                      ? "bg-teal-700 text-white"
                      : "bg-teal-50 text-teal-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-teal-700">{getTeacherAgeFocus(teacherAgeGroup)}</p>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500">3. 选择生成类型</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {teacherTasks.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    selectTeacherTask(item, "任务类型已切换，会自动保存到这台设备。");
                  }}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                    task === item.label
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:-translate-y-0.5"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-amber-50 px-4 py-4">
            <p className="text-xs font-semibold text-amber-900">快捷关键词 · 1 分钟带入生成</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickTeacherKeywords.map((keyword) => (
                <button
                  key={keyword}
                  onClick={() => applyQuickKeyword(keyword)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100"
                  type="button"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={scenario}
            onChange={(event) => {
              setScenario(event.target.value);
              setDraftStatus("输入内容会自动保存到这台设备。");
            }}
            maxLength={teacherScenarioMaxLength}
            className="mt-5 min-h-48 w-full rounded-[2rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>
              {isActivityPlanSelected
                ? "建议保留年龄段、时长、主题、已有经验和目标，生成结果更适合直接使用。"
                : "建议写清年龄、场景和目标，生成结果会更适合直接使用。"}
            </span>
            <span className={teacherScenarioRemaining < 40 ? "text-amber-700" : "text-slate-500"}>
              还可输入 {teacherScenarioRemaining} 字
            </span>
          </div>

          <button
            onClick={() => void generate()}
            className="mt-5 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={isLoading || !scenario.trim()}
          >
            {isLoading ? "正在生成..." : "开始生成"}
          </button>

          <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4">
            <p className="text-sm leading-7 text-slate-600">
              小建议：活动目标尽量写成幼儿能做到、看得到的行为，例如“能按顺序模仿洗手步骤”。
            </p>
            <p className="mt-3 text-sm font-semibold text-teal-700">{draftStatus}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => resetTeacherDraft()}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
              >
                恢复默认内容
              </button>
              <button
                onClick={clearTeacherDraft}
                className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
              >
                清空这台设备草稿
              </button>
            </div>
          </div>

          <details className="mt-4 rounded-[1.5rem] bg-white/82 p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
              生成历史小折叠 · 最近 {Math.min(filteredSavedResults.length, 6)} 条
            </summary>
            <div className="mt-3 grid gap-3">
              {filteredSavedResults.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => reuseSavedResult(item)}
                  className="rounded-[1.2rem] bg-slate-50 px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-teal-50"
                  type="button"
                >
                  <span className="block font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                    {item.task} · {item.content}
                  </span>
                </button>
              ))}
              {filteredSavedResults.length === 0 ? (
                <p className="rounded-[1.2rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                  还没有生成历史。生成跟进内容后，会保留最近 6 条方便复用。
                </p>
              ) : null}
            </div>
          </details>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#e6fbfa_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-teal-700">生成结果</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {result?.title ?? "还没有生成内容"}
          </h2>

          {result ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  result.fallbackUsed
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {result.fallbackUsed ? "备用内容" : "生成内容"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                需人工确认
              </span>
            </div>
          ) : null}

          <div className="mt-5 rounded-[2rem] bg-white/80 p-5">
            <p className="whitespace-pre-line text-sm leading-8 text-slate-700">
              {result?.content ?? "点击左侧按钮后，这里会出现可以继续修改的跟进建议、课堂活动、家园同步话术或鼓励语。"}
            </p>
          </div>

          {parentShareLine ? (
            <div className="mt-5 rounded-[1.8rem] bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">活动延伸建议</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{parentShareLine}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void generate()}
              className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? "重新生成中..." : "换一版结果"}
            </button>
            <button
              onClick={() => void copyResult()}
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
            >
              复制结果
            </button>
            <button
              onClick={() => void previewResultVoice()}
              className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
            >
              {isPreviewSpeaking ? "正在试播..." : "试播结果"}
            </button>
          </div>

          {copyStatus ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
              {copyStatus}
            </p>
          ) : null}

          {voiceStatus ? (
            <p className="mt-4 rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900">
              {voiceStatus}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {(result?.tips ?? ["建议控制在 1 分钟内说完。", "优先用鼓励式表达。", "结尾加一句家园同步。"]).map((tip) => (
              <div key={tip} className="rounded-[1.5rem] bg-white/70 px-4 py-3 text-sm text-slate-700">
                {tip}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-white/75 p-4">
            <p className="text-sm font-semibold text-slate-700">可用性检查</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {resultQualityChecks.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-[1.2rem] px-3 py-3 text-sm font-semibold ${
                    item.ok ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.ok ? "已满足" : "待生成"} · {item.label}
                </div>
              ))}
            </div>
          </div>

          {result?.error ? (
            <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
              生成提醒：{result.error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="order-6 rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-600">基础设置</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">花名册、导入导出与本机账号</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                日常先看记录和 AI 分析；需要调整班级名单、家庭绑定码或重置本机班级试用账号时，再展开这里。
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {childRoster.length} 位幼儿
            </span>
          </summary>

          <div className="mt-5 grid gap-3 sm:grid-cols-[0.8fr_1fr_0.7fr_auto]">
            <input
              value={newChildClassName}
              onChange={(event) => setNewChildClassName(event.target.value)}
              placeholder="班级，如 中一班"
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <input
              value={newChildName}
              onChange={(event) => setNewChildName(event.target.value)}
              placeholder="幼儿姓名"
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <input
              value={newChildNumber}
              onChange={(event) => setNewChildNumber(event.target.value)}
              placeholder="号数，如 3"
              inputMode="numeric"
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <button
              onClick={addChildToRoster}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              type="button"
            >
              添加
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={downloadRosterTemplate}
              className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
              type="button"
            >
              下载花名册模板
            </button>
            <label className="cursor-pointer rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5">
              上传导入花名册
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={importRosterFile}
                className="sr-only"
              />
            </label>
            <button
              onClick={resetTeacherAccountSetup}
              className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
              type="button"
            >
              重置本机教师账号
            </button>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
              {rosterStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {childRoster.length > 0 ? (
              childRoster.map((child) => (
                <article
                  key={child.id}
                  className="rounded-[1.4rem] bg-slate-50 px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {child.className ? `${child.className} · ` : ""}
                        {formatChildLabel(child)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        班级：{child.className || "未填写"} · 家长端需输入姓名/号数和家庭绑定码后才能查看。
                      </p>
                    </div>
                    <button
                      onClick={() => removeChildFromRoster(child.id)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm"
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                  <div className="mt-3 rounded-[1.1rem] bg-white px-3 py-3">
                    <p className="text-xs font-semibold text-slate-500">家庭绑定码</p>
                    <p className="mt-1 text-2xl font-semibold tracking-[0.18em] text-slate-950">
                      {child.familyBindingCode || "未生成"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => resetChildFamilyBindingCode(child.id)}
                      className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                      type="button"
                    >
                      {child.familyBindingCode ? "重置家庭绑定码" : "生成家庭绑定码"}
                    </button>
                    <button
                      onClick={() => void copyFamilyBindingCode(child)}
                      className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                      type="button"
                    >
                      复制给家长
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                还没有名单。添加后，儿童端会通过名字或号数匹配小名牌。
              </p>
            )}
          </div>
        </details>
      </section>

    </div>
  );
}
