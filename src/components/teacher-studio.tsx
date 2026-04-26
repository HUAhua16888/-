"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import {
  defaultGameContentConfigs,
  gameContentConfigStorageKey,
  parseGameContentConfigs,
  resetGameContentConfig,
  updateGameContentConfig,
  type EditableGameContent,
} from "@/lib/game-content-config";
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
  getParentFeedbackCategoryLabel,
  parentFeedbackStorageKey,
  parentSyncStorageKey,
  parseParentFeedbackRecords,
  parseParentSyncRecords,
  upsertParentSyncRecord,
  type ParentFeedbackRecord,
  type ParentSyncRecord,
} from "@/lib/parent-sync";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  parseVideoLibrary,
  videoLibraryStorageKey,
  type TeacherVideoResource,
} from "@/lib/video-library";
import {
  teacherPitchCards,
  teacherTasks,
  teacherWorkflowCards,
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

type TeacherHistoryFilter = "all" | "theme" | "task";
type ParentFeedbackDraft = {
  reply: string;
  guidance: string;
};

const teacherScenarioMaxLength = 680;
const teacherHistoryLimit = 6;
const teacherAccountStorageKey = "tongqu-growth-web-teacher-account";
const teacherPasscodeStorageKey = "tongqu-growth-web-teacher-passcode";
const teacherSessionStorageKey = "tongqu-growth-web-teacher-session";
const classroomPlanRequirement =
  "请生成一节幼儿园活动方案，结构包含活动名称、适用年龄、活动时长、活动目标、准备材料、活动流程、教师提问、观察要点、家园延伸和注意事项。";
const teacherAgeOptions = [
  {
    label: "小班 3-4 岁",
    focus: "以模仿、感知、短句回应和动作游戏为主。",
  },
  {
    label: "中班 4-5 岁",
    focus: "加入简单排序、比较和说出一点原因。",
  },
  {
    label: "大班 5-6 岁",
    focus: "加入合作、简单记录、规则意识和迁移表达。",
  },
] as const;
const defaultTeacherAgeGroup = teacherAgeOptions[1].label;
const defaultTeacherTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
type TeacherTaskItem = (typeof teacherTasks)[number];

function isActivityPlanTask(task: string) {
  return /活动课程方案/.test(task);
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
  const isFood = /餐|食|闽|海蛎|紫菜|挑食|尝/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const ageGroup = resolveTeacherAgeGroup(target);
  const ageFocus = getTeacherAgeFocus(ageGroup);
  const activityName = isFood ? "家乡美食小发现" : "小手泡泡按顺序";
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
        "活动时长：15-20 分钟",
        `活动目标：1. 愿意观察图片或实物，说出一个发现。2. 能用动作或短句完成一个小任务。3. 在生活中尝试迁移一步做法。`,
        `准备材料：情境图片、实物或模型、小任务卡、贴纸。`,
        `活动流程：导入 2 分钟，用角色或图片引出问题；感知/操作 6 分钟，让幼儿看、摸、摆或模仿；互动表达 5 分钟，请幼儿说一句发现或演示一个动作；生活迁移 3 分钟，说说今天在哪里能用到；收束 2 分钟，用贴纸肯定具体行为。`,
        `教师提问：你看到了什么？下一步可以怎么做？你愿意试哪一小步？`,
        `观察要点：是否能参与操作；是否能说出一个可观察发现；是否愿意尝试或模仿目标动作。`,
        `家园延伸：回家和家长完成一个很小的同主题任务，并说一句“我今天发现了……”。`,
        `注意事项：${ageFocus} 不考试、不背诵、不要求全部幼儿同一速度完成。`,
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
    "【童趣成长乐园｜老师辅助生成】",
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
  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：15-20 分钟。活动主题：泉州闽食探索。幼儿已有经验：刚在儿童端完成了均衡餐盘或闽食探索小游戏。希望目标：能说出一种泉州美食名称，观察食材或外形，并选择一个愿意靠近的小步骤。${classroomPlanRequirement}`
    : `年龄段：${ageGroup}。活动时长：15-20 分钟。活动主题：幼习宝生活习惯。幼儿已有经验：刚在儿童端完成了洗手或排队小游戏。希望目标：能按图片或动作提示说出步骤，并在生活环节尝试迁移。${classroomPlanRequirement}`;
}

function buildHomePlanScenario(themeId: ThemeId, ageGroup: string = defaultTeacherAgeGroup) {
  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：15-20 分钟。主题：泉州美食小发现。幼儿已有经验：认识少量家乡食物，但对食材、颜色和味道表达还不充分。希望目标：能说出一种泉州美食名称，找一找食材或外形特征，选择一个愿意靠近的小步骤。`
    : `年龄段：${ageGroup}。活动时长：15-20 分钟。主题：饭前洗手。幼儿已有经验：知道要洗手，但步骤容易漏。希望目标：能按顺序说出并模仿洗手步骤，在餐前主动尝试。`;
}

function buildPreferenceInterventionScenario(record: FoodPreferenceRecord, ageGroup: string = defaultTeacherAgeGroup) {
  return `年龄段：${ageGroup}。活动时长：15-20 分钟。儿童端记录：孩子正在认识“${record.foodLabel}”，原因选择为“${record.reasonLabel}”。已有温和策略：${record.strategy}${record.gentleTryTip}。${classroomPlanRequirement}要求不贴“挑食”标签，围绕看见名字、观察食材、说出发现和选择愿意靠近的一小步设计食育课堂。`;
}

function buildTeacherTaskScenario(item: TeacherTaskItem, themeId: ThemeId, ageGroup: string) {
  return item.id === "home" ? buildHomePlanScenario(themeId, ageGroup) : item.starter;
}

function buildTeacherRequestInput(task: string, scenario: string, ageGroup: string, themeId: ThemeId) {
  const themeLabel = themeId === "food" ? "闽食成长岛" : "幼习宝";
  const ageFocus = getTeacherAgeFocus(ageGroup);

  return isActivityPlanTask(task)
    ? [
        `年龄段：${ageGroup}`,
        `主题来源：${themeLabel}`,
        `年龄特点：${ageFocus}`,
        scenario.trim(),
        "请按幼儿园活动方案结构输出，目标写成可观察行为，环节短、游戏化、可操作。",
      ].join("\n")
    : [`年龄段参考：${ageGroup}`, `主题来源：${themeLabel}`, scenario.trim()].join("\n");
}

function hasThemeMiniGameRecord(rawArchive: string | null, themeId: ThemeId) {
  const archive = parseGrowthArchive(rawArchive);

  return themeId === "food"
    ? archive.miniGameProgress.foodObserve > 0 ||
        archive.miniGameProgress.foodClue > 0 ||
        archive.miniGameProgress.kindWords > 0 ||
        archive.miniGameProgress.foodPreference > 0 ||
        archive.miniGameProgress.peerEncourage > 0 ||
        archive.miniGameProgress.mealTray > 0
    : archive.miniGameProgress.washSteps > 0 ||
        archive.miniGameProgress.queue > 0 ||
        archive.miniGameProgress.habitJudge > 0;
}

function parseRosterImportText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/,|\t|，/).map((item) => item.trim()))
    .filter((parts) => {
      const joined = parts.join("");
      return !/姓名|幼儿|号数|序号|number|name/i.test(joined);
    })
    .map((parts) => {
      const [first = "", second = ""] = parts;
      const numberFirst = first.replace(/[^\d]/g, "");
      const numberSecond = second.replace(/[^\d]/g, "");
      const rosterNumber = numberFirst || numberSecond;
      const name = numberFirst ? second : first;

      return {
        name: name.trim().slice(0, 12),
        rosterNumber: rosterNumber.slice(0, 3),
      };
    })
    .filter((item) => item.name && item.rosterNumber);
}

function getGameDisplayName(gameKey: MiniGameRecord["gameKey"]) {
  const labelMap: Record<MiniGameRecord["gameKey"], string> = {
    washSteps: "小手清洁任务",
    queue: "一日好习惯路线",
    habitJudge: "看图判断做法",
    kindWords: "闽食三步练习",
    foodObserve: "泉州美食摊位寻宝",
    foodClue: "闽食摊位寻宝",
    foodPreference: "美食认识观察卡",
    peerEncourage: "陪同伴认识新美食",
    mealTray: "午餐小餐盘",
  };

  return labelMap[gameKey];
}

function buildMiniGameInterventionScenario(record: MiniGameRecord) {
  const childName = record.childName ?? "这位幼儿";
  const pickedText = record.pickedItems.length > 0 ? record.pickedItems.join("、") : "未记录具体选择";

  if (record.gameKey === "washSteps") {
    return `${childName}完成了“小手清洁任务”，已练习步骤：${pickedText}。${classroomPlanRequirement}重点帮助幼儿把饭前便后洗手变成稳定行为习惯。`;
  }

  if (record.gameKey === "queue") {
    return `${childName}完成了“一日好习惯路线”，涉及喝水、整理、排队、如厕等情境：${pickedText}。${classroomPlanRequirement}帮助幼儿在一日生活中迁移行为习惯与安全做法。`;
  }

  if (record.gameKey === "habitJudge") {
    return `${childName}完成了“看图判断做法对不对”，判断记录：${pickedText}。${classroomPlanRequirement}帮助幼儿看图说出正确做法和不安全原因。`;
  }

  if (record.gameKey === "foodPreference") {
    return `${childName}完成了美食认识观察，选择记录：${pickedText}。${classroomPlanRequirement}不贴标签，围绕认识名字、观察食材、说出发现和选择靠近一小步推进。`;
  }

  if (record.gameKey === "mealTray") {
    return `${childName}完成了午餐小餐盘，选择食物：${pickedText}。${classroomPlanRequirement}帮助幼儿认识食物名称、营养和均衡搭配。`;
  }

  if (record.gameKey === "peerEncourage") {
    return `${childName}完成了陪同伴认识新美食互动，选择记录：${pickedText}。${classroomPlanRequirement}支持幼儿用温柔语言陪同伴认识食材、颜色和小故事。`;
  }

  return `${childName}完成了${getGameDisplayName(record.gameKey)}，选择记录：${pickedText}。${classroomPlanRequirement}请根据本次互动情况设计课堂重点。`;
}

function buildLocalInterventionTips(record: MiniGameRecord) {
  if (record.gameKey === "washSteps") {
    return ["保留洗手图卡，饭前便后先指图再行动。", "把步骤拆成一句口令，避免一次说太多。", "家里用同样顺序提醒，减少场景切换。"];
  }

  if (record.gameKey === "queue") {
    return ["把喝水、整理、排队、如厕做成一日流程图。", "孩子做对时马上说出具体行为。", "对不安全做法只说替代动作，不贴标签。"];
  }

  if (record.gameKey === "habitJudge") {
    return ["继续用图片让孩子说“哪里对、哪里要换”。", "把错误做法转成正确动作示范。", "安全知识用短句重复，不用吓唬式提醒。"];
  }

  if (record.gameKey === "foodPreference") {
    return ["先接纳不喜欢的理由。", "从看一看、闻一闻开始，不直接要求吃完。", "只给一小口尝试目标。"];
  }

  if (record.gameKey === "mealTray") {
    return ["让孩子说出食物名字和一种营养。", "保留一种熟悉食物，再加入一种新食物。", "把均衡搭配说成餐盘小任务。"];
  }

  return ["先肯定参与。", "只推进一个小目标。", "同步给家长一句可延续的话。"];
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
    useState("请先确认本机教师账号，再进入老师辅助台。");
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [teacherAgeGroup, setTeacherAgeGroup] = useState<string>(defaultTeacherAgeGroup);
  const [task, setTask] = useState(defaultTeacherTask.label);
  const [scenario, setScenario] = useState(buildHomePlanScenario("habit", defaultTeacherAgeGroup));
  const [result, setResult] = useState<TeacherResponse | null>(null);
  const [savedResults, setSavedResults] = useState<SavedTeacherResult[]>([]);
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(() => createEmptyGrowthArchive());
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [newChildName, setNewChildName] = useState("");
  const [newChildNumber, setNewChildNumber] = useState("");
  const [rosterStatus, setRosterStatus] = useState("添加姓名和号数后，幼儿可以用小名牌进入对应互动任务。");
  const [videoResources, setVideoResources] = useState<TeacherVideoResource[]>([]);
  const [videoThemeId, setVideoThemeId] = useState<ThemeId>("habit");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoStatus, setVideoStatus] = useState("教师可以登记放松学视频素材，或先保存文字生成视频需求。记录保存在这台设备上。");
  const [gameContentConfigs, setGameContentConfigs] =
    useState<EditableGameContent[]>(defaultGameContentConfigs);
  const [selectedContentGameKey, setSelectedContentGameKey] =
    useState<EditableGameContent["gameKey"]>("washSteps");
  const [gameContentStatus, setGameContentStatus] =
    useState("教师可以在这里调整儿童端小游戏名称、规则引导、完成提醒和互动内容说明。");
  const [, setParentSyncRecords] = useState<ParentSyncRecord[]>([]);
  const [parentFeedbackRecords, setParentFeedbackRecords] = useState<ParentFeedbackRecord[]>([]);
  const [selectedParentFeedbackId, setSelectedParentFeedbackId] = useState("");
  const [parentFeedbackDrafts, setParentFeedbackDrafts] = useState<Record<string, ParentFeedbackDraft>>({});
  const [parentFeedbackAiLoadingId, setParentFeedbackAiLoadingId] = useState("");
  const [parentSyncStatus, setParentSyncStatus] =
    useState("请选择一条家长反馈，给出老师回复和可执行的家庭育儿指导。");
  const [historyFilter, setHistoryFilter] = useState<TeacherHistoryFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isPreviewSpeaking, setIsPreviewSpeaking] = useState(false);
  const [draftStatus, setDraftStatus] = useState("当前内容会自动保存在这台设备上。");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const historyReadFailedRef = useRef(false);
  const teacherScenarioRemaining = teacherScenarioMaxLength - scenario.length;
  const isActivityPlanSelected = isActivityPlanTask(task);
  const pinnedSavedResultCount = savedResults.filter((item) => item.pinned).length;
  const filteredSavedResults = useMemo(() => {
    if (historyFilter === "theme") {
      return savedResults.filter((item) => item.themeId === themeId);
    }

    if (historyFilter === "task") {
      return savedResults.filter((item) => item.task === task);
    }

    return savedResults;
  }, [historyFilter, savedResults, task, themeId]);
  const recentFoodPreferenceRecords = useMemo(
    () => growthArchive.foodPreferenceRecords.slice(0, 4),
    [growthArchive.foodPreferenceRecords],
  );
  const recentMiniGameRecords = useMemo(
    () => growthArchive.miniGameRecords.slice(0, 12),
    [growthArchive.miniGameRecords],
  );
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
  const miniGameSummaryRows = useMemo(() => {
    type SummaryDraft = {
      gameKey: MiniGameRecord["gameKey"];
      themeId: ThemeId;
      count: number;
      children: Set<string>;
      pickedCounter: Map<string, number>;
      latestRecord: MiniGameRecord;
    };
    const summaryMap = new Map<MiniGameRecord["gameKey"], SummaryDraft>();

    for (const record of growthArchive.miniGameRecords) {
      const current =
        summaryMap.get(record.gameKey) ??
        {
          gameKey: record.gameKey,
          themeId: record.themeId,
          count: 0,
          children: new Set<string>(),
          pickedCounter: new Map<string, number>(),
          latestRecord: record,
        };

      current.count += 1;

      if (record.childName || record.childId) {
        current.children.add(record.childName ?? record.childId ?? "未选择身份");
      }

      for (const item of record.pickedItems) {
        current.pickedCounter.set(item, (current.pickedCounter.get(item) ?? 0) + 1);
      }

      if (
        new Date(record.completedAt).getTime() >
        new Date(current.latestRecord.completedAt).getTime()
      ) {
        current.latestRecord = record;
        current.themeId = record.themeId;
      }

      summaryMap.set(record.gameKey, current);
    }

    return Array.from(summaryMap.values())
      .map((item) => ({
        gameKey: item.gameKey,
        themeId: item.themeId,
        gameName: getGameDisplayName(item.gameKey),
        count: item.count,
        childCount: item.children.size,
        childNames: Array.from(item.children).slice(0, 4),
        latestAt: item.latestRecord.completedAt,
        latestChild: item.latestRecord.childName ?? "未选择身份",
        topChoices: Array.from(item.pickedCounter.entries())
          .sort((left, right) => right[1] - left[1])
          .slice(0, 3)
          .map(([label, count]) => `${label} ${count}次`),
        followTip: buildLocalInterventionTips(item.latestRecord)[0] ?? "可继续观察下一次互动表现。",
      }))
      .sort((left, right) => new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime());
  }, [growthArchive.miniGameRecords]);
  const interventionRecords = useMemo(
    () => [...growthArchive.miniGameRecords.slice(0, 8), ...growthArchive.foodPreferenceRecords.slice(0, 4)],
    [growthArchive.foodPreferenceRecords, growthArchive.miniGameRecords],
  );
  const latestParentFeedbackRecords = useMemo(
    () => parentFeedbackRecords.slice(0, 10),
    [parentFeedbackRecords],
  );
  const newParentFeedbackCount = parentFeedbackRecords.filter((record) => record.status === "new").length;
  const repliedParentFeedbackCount = parentFeedbackRecords.filter(
    (record) => record.teacherReply || record.teacherGuidance,
  ).length;
  const selectedParentFeedback = useMemo(
    () =>
      parentFeedbackRecords.find((record) => record.id === selectedParentFeedbackId) ??
      latestParentFeedbackRecords[0] ??
      null,
    [latestParentFeedbackRecords, parentFeedbackRecords, selectedParentFeedbackId],
  );
  const selectedGameContent = useMemo(
    () =>
      gameContentConfigs.find((item) => item.gameKey === selectedContentGameKey) ??
      defaultGameContentConfigs.find((item) => item.gameKey === selectedContentGameKey) ??
      defaultGameContentConfigs[0],
    [gameContentConfigs, selectedContentGameKey],
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
      const savedAccount = window.localStorage.getItem(teacherAccountStorageKey) ?? "";
      const savedPasscode = window.localStorage.getItem(teacherPasscodeStorageKey) ?? "";
      const savedSession = window.sessionStorage.getItem(teacherSessionStorageKey) ?? "";

      setTeacherHasAccount(Boolean(savedAccount && savedPasscode));
      setTeacherAccountInput(savedAccount);
      setTeacherAuthenticated(Boolean(savedSession && savedSession === savedAccount && savedPasscode));
      setTeacherAuthStatus(
        savedAccount && savedPasscode
          ? "请输入本机教师账号口令，验证后进入老师辅助台。"
          : "首次使用请先创建本机教师账号和口令。",
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
            setDraftStatus("已恢复这台设备上次留下的老师端草稿。");
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
        setVideoResources(parseVideoLibrary(window.localStorage.getItem(videoLibraryStorageKey)));
        setGameContentConfigs(
          parseGameContentConfigs(window.localStorage.getItem(gameContentConfigStorageKey)),
        );
        setParentSyncRecords(parseParentSyncRecords(window.localStorage.getItem(parentSyncStorageKey)));
        setParentFeedbackRecords(
          parseParentFeedbackRecords(window.localStorage.getItem(parentFeedbackStorageKey)),
        );
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
            ? "已接上儿童端小游戏记录，可以直接生成一节课堂活动方案。"
              : "还没有读到儿童端小游戏记录，已切换为普通活动课程方案草稿。",
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

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(videoLibraryStorageKey, JSON.stringify(videoResources));
  }, [draftHydrated, videoResources]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(gameContentConfigStorageKey, JSON.stringify(gameContentConfigs));
  }, [draftHydrated, gameContentConfigs]);

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

  async function generate() {
    const cleanScenario = scenario.trim();

    if (!cleanScenario) {
      setDraftStatus("先输入故事或活动课程方案需求，再开始生成。");
      return;
    }

    if (cleanScenario.length > teacherScenarioMaxLength) {
      setDraftStatus(`场景描述太长了，请控制在 ${teacherScenarioMaxLength} 个字以内。`);
      return;
    }

    setIsLoading(true);
    try {
      const requestInput = buildTeacherRequestInput(task, cleanScenario, teacherAgeGroup, themeId);
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "teacher",
          theme: themeId,
          userInput: requestInput,
          teacherTask: task,
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
          ...buildTeacherClientFallback(task, requestInput),
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
          ...buildTeacherClientFallback(task, requestInput),
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
        Boolean(normalized.error) || isTeacherFallbackPayload(normalized, task, requestInput);
      const data: TeacherResponse = {
        ...normalized,
        fallbackUsed,
        needsReview: true,
      };
      const savedAt = new Date().toISOString();
      const nextId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
            themeId,
            task,
            scenario,
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
        ...buildTeacherClientFallback(task, buildTeacherRequestInput(task, cleanScenario, teacherAgeGroup, themeId)),
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
      !window.confirm("确认清空这台设备上的老师端草稿吗？当前输入会恢复为默认内容。")
    ) {
      setDraftStatus("已取消清空草稿，当前内容继续保留。");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }

    resetTeacherDraft("这台设备上的老师端草稿已经清空。");
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

  function clearTeacherHistory() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认清空这台设备上的全部老师端生成历史吗？固定收藏也会一起清空。")
    ) {
      setDraftStatus("已取消清空历史，生成记录继续保留。");
      return;
    }

    historyReadFailedRef.current = false;
    setSavedResults([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(historyStorageKey);
    }
    setDraftStatus("这台设备上的老师端生成历史已经清空。");
  }

  function deleteSavedResult(id: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认删除这条历史生成结果吗？删除后不会影响其他历史。")
    ) {
      setDraftStatus("已取消删除，这条历史仍然保留。");
      return;
    }

    historyReadFailedRef.current = false;
    setSavedResults((current) => current.filter((item) => item.id !== id));
    setDraftStatus("已删除这条历史生成结果，其他历史仍然保留。");
  }

  function toggleSavedResultPin(id: string) {
    historyReadFailedRef.current = false;
    setSavedResults((current) =>
      limitTeacherHistory(
        current.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)),
      ),
    );
    setDraftStatus("已更新这条历史的固定状态，固定内容会优先保留。");
  }

  function applyFoodPreferenceRecord(record: FoodPreferenceRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];

    setThemeId("food");
    setTask(homeTask.label);
    setScenario(buildPreferenceInterventionScenario(record, teacherAgeGroup));
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus("已带入儿童端美食认识记录，可以生成一节泉州食育课堂活动方案。");
  }

  function saveParentSyncRecord(record: ParentSyncRecord) {
    setParentSyncRecords((current) => {
      const nextRecords = upsertParentSyncRecord(current, record);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentSyncStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
    setParentSyncStatus(`${record.childName} 的“${record.title}”已同步到家长端。`);
  }

  function syncMiniGameRecordToParent(record: MiniGameRecord) {
    const parentRecord = buildParentSyncFromMiniGame(record);

    if (!parentRecord) {
      setParentSyncStatus("这条游戏记录没有绑定幼儿身份，无法同步到家长端。请先让幼儿选择姓名或号数。");
      return;
    }

    saveParentSyncRecord(parentRecord);
  }

  function syncFoodPreferenceRecordToParent(record: FoodPreferenceRecord) {
    const parentRecord = buildParentSyncFromFoodPreference(record);

    if (!parentRecord) {
      setParentSyncStatus("这条美食认识记录没有绑定幼儿身份，无法同步到家长端。请先让幼儿选择姓名或号数。");
      return;
    }

    saveParentSyncRecord(parentRecord);
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
    const isFood = /吃|餐|饭|食|挑|慢|海蛎|紫菜|芥菜|味道|营养/.test(content);
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
      setParentSyncStatus("请先填写老师回复或育儿指导，再保存给家长端。");
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
      rosterNumber,
      createdAt: new Date().toISOString(),
    };

    setChildRoster((current) => [...current, nextChild].slice(0, 60));
    setNewChildName("");
    setNewChildNumber("");
    setRosterStatus(`${rosterNumber}号 ${name} 已添加，儿童端可以说姓名或号数选择身份。`);
  }

  function removeChildFromRoster(childId: string) {
    const child = childRoster.find((item) => item.id === childId);

    setChildRoster((current) => current.filter((item) => item.id !== childId));

    if (typeof window !== "undefined" && window.localStorage.getItem(selectedChildStorageKey) === childId) {
      window.localStorage.removeItem(selectedChildStorageKey);
    }

    setRosterStatus(child ? `已移除 ${child.name}。历史互动记录仍保留，不会被删除。` : "已更新花名册。");
  }

  function mergeRosterItems(items: Array<{ name: string; rosterNumber: string }>) {
    if (items.length === 0) {
      setRosterStatus("没有识别到有效名单。请使用“号数,姓名”的格式。");
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
          name: item.name,
          rosterNumber: item.rosterNumber,
          createdAt: new Date().toISOString(),
        });
        addedCount += 1;
      }

      return next.slice(0, 60);
    });
    setRosterStatus(`已导入 ${addedCount} 位幼儿；重复姓名或号数已自动跳过。`);
  }

  function downloadRosterTemplate() {
    const template = "号数,姓名\n1,小安\n2,小宇\n3,小禾\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "童趣成长乐园-班级花名册模板.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setRosterStatus("已生成花名册模板，老师可以按“号数,姓名”补充后再导入。");
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

  function recordUploadedVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const cleanTitle = (videoTitle.trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, 40);
    const resource: TeacherVideoResource = {
      id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      themeId: videoThemeId,
      title: cleanTitle,
      description:
        videoThemeId === "habit"
          ? "教师上传的习惯与安全放松学视频素材。"
          : "教师上传的闽食与非遗放松学视频素材。",
      sourceType: "upload",
      fileName: file.name,
      createdAt: new Date().toISOString(),
    };

    setVideoResources((current) => [resource, ...current].slice(0, 24));
    setVideoTitle("");
    setVideoStatus(`已登记视频素材：${file.name}。当前保存的是本地文件信息，真实播放需保留原文件或接入服务器存储。`);
    event.target.value = "";
  }

  function recordPromptVideo() {
    const cleanTitle = videoTitle.trim().slice(0, 40);
    const cleanPrompt = videoPrompt.trim().slice(0, 500);

    if (!cleanTitle || !cleanPrompt) {
      setVideoStatus("请先填写视频标题和文字生成需求。");
      return;
    }

    const resource: TeacherVideoResource = {
      id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      themeId: videoThemeId,
      title: cleanTitle,
      description: "文字生成视频需求已保存，等待接入真实视频生成服务。",
      sourceType: "prompt",
      prompt: cleanPrompt,
      createdAt: new Date().toISOString(),
    };

    setVideoResources((current) => [resource, ...current].slice(0, 24));
    setVideoPrompt("");
    setVideoTitle("");
    setVideoStatus("已保存文字生成视频需求；当前没有接入真实视频生成接口，不会伪造视频成品。");
  }

  function deleteVideoResource(id: string) {
    setVideoResources((current) => current.filter((item) => item.id !== id));
    setVideoStatus("已移除这条视频资源记录。");
  }

  function updateSelectedGameContent(
    patch: Partial<Pick<EditableGameContent, "title" | "childGoal" | "reminderText" | "teacherNote" | "itemLines">>,
  ) {
    setGameContentConfigs((current) => {
      const nextConfigs = updateGameContentConfig(current, selectedContentGameKey, patch);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(gameContentConfigStorageKey, JSON.stringify(nextConfigs));
      }

      return nextConfigs;
    });
    setGameContentStatus("已保存到本机配置。儿童端重新进入对应主题后会读取新文案。");
  }

  function updateSelectedGameItemLines(value: string) {
    updateSelectedGameContent({
      itemLines: value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12),
    });
  }

  function resetSelectedGameContent() {
    setGameContentConfigs((current) => {
      const nextConfigs = resetGameContentConfig(current, selectedContentGameKey);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(gameContentConfigStorageKey, JSON.stringify(nextConfigs));
      }

      return nextConfigs;
    });
    setGameContentStatus("已恢复当前小游戏的默认设计和提醒文案。");
  }

  function applyMiniGameRecord(record: MiniGameRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];

    setThemeId(record.themeId);
    setTask(homeTask.label);
    setScenario(buildMiniGameInterventionScenario(record));
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus("已带入儿童端游戏互动记录，可以生成一节课堂活动方案。");
  }

  function createTeacherAccount() {
    const account = teacherSetupAccount.trim();
    const passcode = teacherSetupPasscode.trim();

    if (account.length < 2 || passcode.length < 4) {
      setTeacherAuthStatus("本机教师账号至少 2 个字，口令至少 4 位。");
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
    setTeacherAuthStatus("本机教师账号已创建，本次已进入老师辅助台。");
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
      setTeacherAuthStatus("本机教师身份已确认，可以查看互动汇总和生成方案。");
      return;
    }

    setTeacherAuthStatus("账号或口令不正确，请重新输入。");
  }

  function logoutTeacherAccount() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(teacherSessionStorageKey);
    }

    cleanupAudio();
    setTeacherAuthenticated(false);
    setTeacherPasscodeInput("");
    setTeacherAuthStatus("已退出老师辅助台，请重新登录后再查看。");
  }

  if (!teacherAuthHydrated || !teacherAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
        <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-10">
          <p className="text-sm font-semibold text-teal-700">老师身份确认</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            {teacherHasAccount ? "登录本机教师账号" : "创建本机教师账号"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            老师辅助台会看到幼儿游戏打卡、家长反馈和课程生成内容。当前账号只保存在这台设备上。
          </p>

          <div className="mt-8 grid gap-4 rounded-[1.5rem] bg-white/86 p-5 shadow-sm md:grid-cols-2">
            {teacherHasAccount ? (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  本机教师账号
                  <input
                    value={teacherAccountInput}
                    onChange={(event) => setTeacherAccountInput(event.target.value)}
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="请输入本机教师账号"
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
                  设置本机教师账号
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
            >
              {teacherHasAccount ? "进入教师辅助" : "创建并进入"}
            </button>
            <p className="text-sm font-semibold text-teal-700">{teacherAuthStatus}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-8 shadow-[0_22px_70px_rgba(49,93,104,0.14)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            老师辅助台
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
            快速生成活动方案
            <span className="mt-2 block text-2xl text-slate-700 md:text-3xl">
              也能改故事和导入语
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            先选主题、年龄段和任务，再生成可修改的幼儿园活动方案。这里也能管理花名册、查看互动汇总和处理家长反馈。
            {premiumTtsEnabled ? ` 当前已经预留 ${premiumVoiceLabel} 播报入口，适合直接试播老师引导语。` : ""}
          </p>
          <button
            onClick={logoutTeacherAccount}
            className="mt-5 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
          >
            退出本机教师账号
          </button>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {teacherPitchCards.map((item) => (
              <div key={item.title} className="rounded-[1.6rem] bg-white/75 p-4">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 max-w-xl">
            <AmbientMusicToggle scene="teacher" />
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-700">快速入口</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">先选模板，再生成</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {teacherTasks.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  selectTeacherTask(item);
                }}
                className={`rounded-[1.5rem] px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                  item.id === "home"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <p className="font-semibold">{item.id === "home" ? "推荐：" : ""}{item.label}</p>
                <p className={`mt-2 text-sm leading-7 ${item.id === "home" ? "text-white/75" : "text-slate-500"}`}>
                  {item.starter}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-[linear-gradient(135deg,#effcfc_0%,#ffffff_100%)] p-4">
            <p className="text-sm font-semibold text-slate-500">老师操作顺序</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              选择年龄段、主题和活动目标，系统会生成一份可直接修改的幼儿园活动方案。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700">班级幼儿名单</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">姓名和号数</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{rosterStatus}</p>
            </div>
            <span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-900">
              {childRoster.length} 位
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_0.7fr_auto]">
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
            >
              添加
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={downloadRosterTemplate}
              className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
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
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
              支持 CSV/TXT：号数,姓名
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {childRoster.length > 0 ? (
              childRoster.map((child) => (
                <span
                  key={child.id}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {child.rosterNumber ? `${child.rosterNumber}号 ` : ""}
                  {child.name}
                  <button
                    onClick={() => removeChildFromRoster(child.id)}
                    className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-rose-700"
                  >
                    移除
                  </button>
                </span>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                还没有名单。添加后，首页“说名字/号数”会从这里匹配，儿童互动记录也会对应到幼儿。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#f5fffe_0%,#ffffff_54%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-700">儿童互动汇总</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">游戏数据汇总</h2>
            </div>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              总记录 {miniGameSummaryStats.total} 条
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "总互动", value: miniGameSummaryStats.total, tone: "bg-white" },
              { label: "幼习宝", value: miniGameSummaryStats.habit, tone: "bg-cyan-50" },
              { label: "闽食成长岛", value: miniGameSummaryStats.food, tone: "bg-amber-50" },
              { label: "参与幼儿", value: miniGameSummaryStats.childCount, tone: "bg-emerald-50" },
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.5rem] ${item.tone} px-4 py-4 shadow-sm`}>
                <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.8rem] bg-white/88 shadow-sm">
            <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_1.1fr] gap-3 bg-slate-900 px-4 py-3 text-xs font-semibold text-white md:grid">
              <span>游戏项目</span>
              <span>次数 / 幼儿</span>
              <span>最近记录</span>
              <span>数据提示</span>
            </div>
            {miniGameSummaryRows.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {miniGameSummaryRows.map((row) => (
                  <div
                    key={row.gameKey}
                    className="grid gap-3 px-4 py-4 text-sm text-slate-700 md:grid-cols-[1.2fr_0.8fr_1fr_1.1fr]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-400 md:hidden">游戏项目</p>
                      <p className="mt-1 font-semibold text-slate-950">{row.gameName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {row.themeId === "habit" ? "幼习宝" : "闽食成长岛"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 md:hidden">次数 / 幼儿</p>
                      <p className="mt-1 font-semibold text-slate-950">{row.count} 次互动</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {row.childCount > 0
                          ? `${row.childCount} 名幼儿：${row.childNames.join("、")}`
                          : "暂无身份记录"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 md:hidden">最近记录</p>
                      <p className="mt-1 font-semibold text-slate-950">{row.latestChild}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {new Date(row.latestAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {row.topChoices.length > 0 ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          高频选择：{row.topChoices.join("、")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-slate-400 md:hidden">数据提示</p>
                      <p className="rounded-[1rem] bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-900">
                        {row.followTip}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recentMiniGameRecords
                          .filter((record) => record.gameKey === row.gameKey)
                          .slice(0, 1)
                          .map((record) => (
                            <button
                              key={`${record.completedAt}-${record.gameKey}-${record.childId ?? "anon"}`}
                              onClick={() => applyMiniGameRecord(record)}
                              className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                              type="button"
                            >
                              带入生成课堂方案
                            </button>
                          ))}
                        {recentMiniGameRecords
                          .filter((record) => record.gameKey === row.gameKey)
                          .slice(0, 1)
                          .map((record) => (
                            <button
                              key={`sync-${record.completedAt}-${record.gameKey}-${record.childId ?? "anon"}`}
                              onClick={() => syncMiniGameRecordToParent(record)}
                              className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                              type="button"
                            >
                              同步家长
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm leading-7 text-slate-600">
                暂无游戏互动数据。幼儿完成小游戏后，这里会按项目汇总次数、参与幼儿、高频选择和最近记录。
              </p>
            )}
          </div>

          <p className="mt-4 rounded-[1.2rem] bg-white/75 px-4 py-3 text-sm leading-7 text-slate-600">
            最近明细 {recentMiniGameRecords.length} 条仍保留在下方干预策略池；这里优先显示可用于班级分析和家园沟通的数据汇总。
          </p>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#f6fffb_0%,#ffffff_52%,#fff5e6_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">游戏内容配置</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">互动内容与提醒文案</h2>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {gameContentConfigs.length} 个游戏
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-[1.8rem] bg-white/85 p-4 shadow-sm">
            <div className="grid gap-2">
              {gameContentConfigs.map((config) => (
                <button
                  key={config.gameKey}
                  onClick={() => {
                    setSelectedContentGameKey(config.gameKey);
                    setGameContentStatus("已切换小游戏配置。");
                  }}
                  className={`rounded-[1.2rem] px-4 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
                    selectedContentGameKey === config.gameKey
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                  type="button"
                >
                  <span className="block">
                    {config.themeId === "habit" ? "幼习宝" : "闽食成长岛"}
                  </span>
                  <span className="mt-1 block text-base">{config.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">小游戏名称</span>
                <input
                  value={selectedGameContent.title}
                  onChange={(event) => updateSelectedGameContent({ title: event.target.value })}
                  className="mt-2 w-full rounded-[1.1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">所属主题</span>
                <input
                  value={selectedGameContent.themeId === "habit" ? "幼习宝" : "闽食成长岛"}
                  readOnly
                  className="mt-2 w-full rounded-[1.1rem] border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 outline-none"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">儿童端规则引导</span>
              <textarea
                value={selectedGameContent.childGoal}
                onChange={(event) => updateSelectedGameContent({ childGoal: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">弹窗 / 成长提醒文字</span>
              <textarea
                value={selectedGameContent.reminderText}
                onChange={(event) => updateSelectedGameContent({ reminderText: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">互动内容清单</span>
              <textarea
                value={selectedGameContent.itemLines.join("\n")}
                onChange={(event) => updateSelectedGameItemLines(event.target.value)}
                className="mt-2 min-h-36 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">教师观察备注</span>
              <textarea
                value={selectedGameContent.teacherNote}
                onChange={(event) => updateSelectedGameContent({ teacherNote: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={resetSelectedGameContent}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
                type="button"
              >
                恢复当前默认
              </button>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
                {gameContentStatus}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#eefcfc_0%,#ffffff_55%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">放松学视频资源</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">教师上传或文字生成入口</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              这里用于登记幼习宝和闽食成长岛的视频素材。上传视频当前保存本地文件信息；文字生成会先保存需求，等待接入真实视频生成服务。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {videoResources.length} 条资源
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.8rem] bg-white/85 p-5 shadow-sm">
            <div className="flex flex-wrap gap-3">
              {Object.values(themes).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setVideoThemeId(theme.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    videoThemeId === theme.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {theme.emoji} {theme.label}
                </button>
              ))}
            </div>
            <input
              value={videoTitle}
              onChange={(event) => setVideoTitle(event.target.value)}
              placeholder="视频标题，如 洗手安全小课堂"
              className="mt-4 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5">
                上传视频素材
                <input
                  type="file"
                  accept="video/*"
                  onChange={recordUploadedVideo}
                  className="sr-only"
                />
              </label>
            </div>
            <textarea
              value={videoPrompt}
              onChange={(event) => setVideoPrompt(event.target.value)}
              placeholder="文字生成视频需求：写清主题、场景、幼儿年龄、希望出现的画面和口播。"
              className="mt-4 min-h-28 w-full rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <button
              onClick={recordPromptVideo}
              className="mt-3 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              保存文字生成需求
            </button>
            <p className="mt-4 rounded-[1.3rem] bg-white/80 px-4 py-3 text-sm leading-7 font-semibold text-teal-800">
              {videoStatus}
            </p>
          </div>

          <div className="grid gap-3">
            {videoResources.length > 0 ? (
              videoResources.map((resource) => (
                <article key={resource.id} className="rounded-[1.6rem] bg-white/88 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{resource.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {resource.themeId === "habit" ? "幼习宝" : "闽食成长岛"} ·{" "}
                        {resource.sourceType === "upload" ? "教师上传素材" : "文字生成需求"}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteVideoResource(resource.id)}
                      className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-800"
                    >
                      移除
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{resource.description}</p>
                  {resource.fileName ? (
                    <p className="mt-2 rounded-[1.1rem] bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900">
                      文件：{resource.fileName}
                    </p>
                  ) : null}
                  {resource.prompt ? (
                    <p className="mt-2 rounded-[1.1rem] bg-amber-50 px-3 py-2 text-xs leading-6 font-semibold text-amber-900">
                      生成需求：{resource.prompt}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-[1.8rem] bg-white/78 px-5 py-6 text-sm leading-7 text-slate-600">
                还没有视频资源。老师可以先上传本地视频素材，或保存一条文字生成视频需求。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">课堂活动方案池</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">根据游戏情况生成一节课堂活动方案</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              从幼儿游戏记录、美食认识观察中带入生成器，生成老师可继续修改使用的一节课堂活动方案。
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
            {interventionRecords.length} 条线索
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {interventionRecords.length > 0 ? (
            interventionRecords.map((record) =>
              "gameKey" in record ? (
                <article
                  key={`game-${record.completedAt}-${record.gameKey}`}
                  className="rounded-[1.7rem] bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold text-teal-700">
                    {record.themeId === "habit" ? "习惯互动" : "闽食互动"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {record.childName ?? "未选择身份"} · {getGameDisplayName(record.gameKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {record.pickedItems.length > 0
                      ? `选择记录：${record.pickedItems.join("、")}`
                      : "已完成该互动，等待生成延伸策略。"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      onClick={() => applyMiniGameRecord(record)}
                      className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                    >
                      生成课堂活动方案
                    </button>
                    <button
                      onClick={() => syncMiniGameRecordToParent(record)}
                      className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                    >
                      同步家长
                    </button>
                  </div>
                </article>
              ) : (
                <article
                  key={`food-${record.recordedAt}-${record.foodLabel}`}
                  className="rounded-[1.7rem] bg-orange-50 p-4"
                >
                  <p className="text-sm font-semibold text-orange-700">美食认识</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {record.childName ?? "未选择身份"} · {record.foodLabel}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    原因：{record.reasonLabel}。{record.strategy}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      onClick={() => applyFoodPreferenceRecord(record)}
                      className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                    >
                      生成食育课堂方案
                    </button>
                    <button
                      onClick={() => syncFoodPreferenceRecordToParent(record)}
                      className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                    >
                      同步家长
                    </button>
                  </div>
                </article>
              ),
            )
          ) : (
            <p className="rounded-[1.8rem] bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              儿童端完成习惯或闽食游戏后，这里会出现可生成课堂活动方案的线索。
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_52%,#fff2f5_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-700">家长反馈处理</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">家长反馈与育儿指导</h2>
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
                  家长端还没有提交反馈。家长登录幼儿账号后，可在家长页填写疑惑、想法或在家观察。
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
                    </div>

                    {selectedParentFeedback.teacherReply || selectedParentFeedback.teacherGuidance ? (
                      <div className="mt-4 rounded-[1.4rem] bg-cyan-50 px-4 py-3">
                        <p className="text-xs font-semibold text-cyan-800">
                          已保存给家长端 ·{" "}
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

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_56%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">老师一天怎么用</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">四张场景卡就够了</h2>
            </div>
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              短、快、直接能拿走
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {teacherWorkflowCards.map((item) => (
              <div
                key={item.title}
                className="story-card rounded-[1.8rem] bg-white/88 p-5 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-amber-100 text-2xl">
                  {item.icon}
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-cyan-700">老师端能带走什么</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">不是只生成一句话</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[1.8rem] bg-cyan-50 p-4">
              <p className="text-lg font-semibold text-slate-900">课堂可说</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                故事导入和教师提问会尽量短一点，老师在教室里直接使用也不会太长。
              </p>
            </div>
            <div className="rounded-[1.8rem] bg-amber-50 p-4">
              <p className="text-lg font-semibold text-slate-900">方案可修改</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                复制以后可以继续改活动目标、材料准备、流程和观察要点。
              </p>
            </div>
            <div className="rounded-[1.8rem] bg-emerald-50 p-4">
              <p className="text-lg font-semibold text-slate-900">还能试播</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                语音播报能提前帮老师听一遍语气，决定要不要再润色一下。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-700">儿童端美食认识记录</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">食育活动延伸线索</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              干预策略只在老师辅助页查看；儿童端只给孩子听食物角色的食材介绍。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            最近 {recentFoodPreferenceRecords.length} 条
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {recentFoodPreferenceRecords.length > 0 ? (
            recentFoodPreferenceRecords.map((record) => (
              <article
                key={`${record.recordedAt}-${record.foodLabel}-${record.reasonLabel}`}
                className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{record.foodLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-teal-800">
                      幼儿：{record.childName ?? "未选择身份"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-orange-800">
                      原因：{record.reasonLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-900">
                    偏好观察
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  {record.strategy}
                  {record.gentleTryTip}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => applyFoodPreferenceRecord(record)}
                    className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    带入生成家园策略
                  </button>
                  <button
                    onClick={() => syncFoodPreferenceRecordToParent(record)}
                    className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                  >
                    同步到家长端
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.8rem] bg-white/78 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-2">
              儿童端完成“美食认识观察卡”后，这里会显示食物、原因和温和食育策略。
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">内容生成面板</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">快速生成活动方案</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            先选主题、年龄段和任务，再补充活动目标。生成内容会按幼儿园活动结构输出，方便继续修改。
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

          <div className="mt-5 flex flex-wrap gap-3">
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
              {result?.content ?? "点击左侧按钮后，这里会出现可以继续修改的故事或活动课程方案。"}
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

      <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">生成历史</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              固定收藏优先，保留 6 条可复用内容
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { id: "all", label: "全部" },
              { id: "theme", label: "当前主题" },
              { id: "task", label: "当前任务" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setHistoryFilter(item.id as TeacherHistoryFilter)}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  historyFilter === item.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={clearTeacherHistory}
              className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={savedResults.length === 0}
            >
              清空历史
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-500">
          当前显示 {filteredSavedResults.length} 条，全部历史 {savedResults.length} 条，已固定{" "}
          {pinnedSavedResultCount} 条。
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {filteredSavedResults.length > 0 ? (
            filteredSavedResults.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.8rem] bg-[linear-gradient(180deg,#f8fffe_0%,#ffffff_100%)] p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-900">
                      {item.themeId === "habit" ? "习惯" : "闽食"}
                    </span>
                    {item.pinned ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                        已固定
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      需确认
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{item.task}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-600">{item.content}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => reuseSavedResult(item)}
                    className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    套用这条
                  </button>
                  <button
                    onClick={() => toggleSavedResultPin(item.id)}
                    className="rounded-full bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
                  >
                    {item.pinned ? "取消固定" : "固定收藏"}
                  </button>
                  <button
                    onClick={() => deleteSavedResult(item.id)}
                    className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
                  >
                    删除这条
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.8rem] bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              {savedResults.length > 0
                ? "当前筛选下没有匹配内容，可以切回“全部”查看历史。"
                : "还没有生成历史。生成故事、绘本导入或活动课程方案后，会自动保存在这里，方便下一次继续使用。"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
