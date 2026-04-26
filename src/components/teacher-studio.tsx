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
  getFoodPreferenceFollowUp,
  getMiniGameFollowUp,
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
  teacherGroupActivityCards,
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
  const isFood = /餐|食|闽|海蛎|紫菜|尝|播报|厨房|小厨师/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const ageGroup = resolveTeacherAgeGroup(target);
  const ageFocus = getTeacherAgeFocus(ageGroup);
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
        "活动时长：15-20 分钟",
        isFood
          ? `活动目标：1. 能说出一种泉州美食名称。2. 能从图片或实物中找到一种食材。3. 愿意用短句介绍一个发现或选择靠近一小步。`
          : `活动目标：1. 能模仿一个进餐好习惯动作。2. 能判断一种行为是好习惯还是需要调整。3. 愿意把一个小步骤带到午餐或家庭生活里。`,
        isFood
          ? `准备材料：泉州美食站点图、食材卡、美食宝箱、贴纸。`
          : `准备材料：红绿牌、进餐动作图卡、碗筷模型、贴纸。`,
        isFood
          ? `活动流程：导入 2 分钟，用闽食小列车口令进站；感知/操作 6 分钟，幼儿看图找美食和食材卡；互动表达 5 分钟，请幼儿做小小美食播报员；生活迁移 3 分钟，选择回家介绍的一种美食；收束 2 分钟，用贴纸肯定具体发现。`
          : `活动流程：导入 2 分钟，用文明进餐操口令热身；感知/操作 6 分钟，幼儿模仿扶碗、坐稳、细嚼慢咽、整理动作；互动表达 5 分钟，用红绿牌判断行为；生活迁移 3 分钟，说说午餐或家里可以做哪一步；收束 2 分钟，肯定一个具体好习惯。`,
        `教师提问：你看到了什么？下一步可以怎么做？你愿意试哪一小步？`,
        `观察要点：是否能参与操作；是否能说出一个可观察发现；是否愿意尝试或模仿目标动作。`,
        isFood
          ? `家园延伸：回家完成睡前美食小回顾，说一种今天认识的美食、一个颜色或食材，以及明天愿意靠近哪一小步。`
          : `家园延伸：回家做家庭美食小管家，饭前洗手、摆碗筷、按需取餐，餐后整理一个小地方。`,
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
    : `年龄段：${ageGroup}。活动时长：15-20 分钟。活动主题：幼习宝班级成长任务。幼儿已有经验：刚在儿童端完成了洗手、进餐、阅读或红绿牌小游戏。希望目标：能用动作、图卡或短句完成一个生活习惯、进餐习惯或阅读表达任务，并在生活环节尝试迁移。${classroomPlanRequirement}`;
}

function buildHomePlanScenario(themeId: ThemeId, ageGroup: string = defaultTeacherAgeGroup) {
  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：15-20 分钟。主题：泉州美食探索。幼儿已有经验：认识少量家乡食物，但对食材、颜色和味道表达还不充分。希望目标：能说出一种泉州美食名称，找一找食材或外形特征，选择一个愿意靠近的小步骤。`
    : `年龄段：${ageGroup}。活动时长：15-20 分钟。主题：幼习宝班级成长任务。幼儿已有经验：知道饭前要洗手，也接触过听故事、整理图书、文明进餐和红绿牌判断。希望目标：能完成一个可观察的生活习惯或阅读表达小任务，并在班级或家庭生活里尝试迁移。`;
}

function buildPreferenceInterventionScenario(record: FoodPreferenceRecord, ageGroup: string = defaultTeacherAgeGroup) {
  const followUp = getFoodPreferenceFollowUp(record);

  return `年龄段：${ageGroup}。活动时长：15-20 分钟。${followUp.activityScenario}${classroomPlanRequirement}要求不贴标签，围绕看见名字、观察食材、说出发现和选择愿意靠近的一小步设计食育课堂。`;
}

function buildGroupActivityScenario(
  card: (typeof teacherGroupActivityCards)[number],
  ageGroup: string,
) {
  return [
    `年龄段：${ageGroup}。`,
    "活动时长：15-20 分钟。",
    `主题：${card.title}。`,
    `适合场景：${card.scene}。`,
    `活动目标：${card.goal}。`,
    `游戏步骤：${card.steps.join("；")}。`,
    `AI 可生成内容：${card.aiCanGenerate}。`,
    classroomPlanRequirement,
    "要求活动游戏化、短句提问、可操作，不强迫孩子吃完，不用小学化讲解。",
  ].join("");
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
    habitJudge: "历史安全判断记录",
    readingCheckin: "阅读小书虫打卡",
    kindWords: "闽食三步练习",
    foodObserve: "泉州美食摊位寻宝",
    foodClue: "闽食摊位寻宝",
    foodTrain: "闽食小列车",
    foodGuess: "美食猜猜乐",
    foodPreference: "美食认识观察卡",
    foodReporter: "闽食小小播报员",
    foodKitchen: "泉州小厨房",
    peerEncourage: "历史同伴鼓励记录",
    mealTray: "历史午餐小餐盘记录",
    mealManners: "文明进餐操",
    habitTrafficLight: "好习惯红绿牌",
  };

  return labelMap[gameKey];
}

type MiniGameFollowUpCardProps = {
  record: MiniGameRecord;
  onGeneratePlan: (record: MiniGameRecord) => void;
  onSyncParent: (record: MiniGameRecord) => void;
  onGenerateEncouragement: (record: MiniGameRecord) => void;
};

function MiniGameFollowUpCard({
  record,
  onGeneratePlan,
  onSyncParent,
  onGenerateEncouragement,
}: MiniGameFollowUpCardProps) {
  return (
    <article className="rounded-[1.7rem] bg-slate-50 p-4">
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
          onClick={() => onGeneratePlan(record)}
          className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          type="button"
        >
          生成方案
        </button>
        <button
          onClick={() => onSyncParent(record)}
          className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
          type="button"
        >
          同步家长
        </button>
        <button
          onClick={() => onGenerateEncouragement(record)}
          className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
          type="button"
        >
          生成鼓励语
        </button>
      </div>
    </article>
  );
}

type FoodPreferenceFollowUpCardProps = {
  record: FoodPreferenceRecord;
  onGeneratePlan: (record: FoodPreferenceRecord) => void;
  onSyncParent: (record: FoodPreferenceRecord) => void;
  onGenerateEncouragement: (record: FoodPreferenceRecord) => void;
};

function FoodPreferenceFollowUpCard({
  record,
  onGeneratePlan,
  onSyncParent,
  onGenerateEncouragement,
}: FoodPreferenceFollowUpCardProps) {
  return (
    <article className="rounded-[1.7rem] bg-orange-50 p-4">
      <p className="text-sm font-semibold text-orange-700">美食认识</p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">
        {record.childName ?? "未选择身份"} · {record.foodLabel}
      </h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        原因：{record.reasonLabel}。{record.strategy}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={() => onGeneratePlan(record)}
          className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          type="button"
        >
          生成方案
        </button>
        <button
          onClick={() => onSyncParent(record)}
          className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
          type="button"
        >
          同步家长
        </button>
        <button
          onClick={() => onGenerateEncouragement(record)}
          className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
          type="button"
        >
          生成鼓励语
        </button>
      </div>
    </article>
  );
}

function buildMiniGameInterventionScenario(record: MiniGameRecord) {
  const childName = record.childName ?? "这位幼儿";
  const followUp = getMiniGameFollowUp(record);

  return `${childName}的互动记录：${followUp.observation}${followUp.activityScenario}${classroomPlanRequirement}家庭延伸建议可参考：${followUp.homeTask}`;
}

function buildLocalInterventionTips(record: MiniGameRecord) {
  const followUp = getMiniGameFollowUp(record);

  if (followUp.homeTask) {
    return [followUp.observation, followUp.homeTask, followUp.encouragement];
  }

  if (record.gameKey === "washSteps") {
    return ["保留洗手图卡，饭前便后先指图再行动。", "把步骤拆成一句口令，避免一次说太多。", "家里用同样顺序提醒，减少场景切换。"];
  }

  if (record.gameKey === "queue") {
    return ["把喝水、整理、排队、如厕做成一日流程图。", "孩子做对时马上说出具体行为。", "对不安全做法只说替代动作，不贴标签。"];
  }

  if (record.gameKey === "habitJudge") {
    return ["把历史记录转成红绿牌复习。", "把需要调整的做法转成正确动作示范。", "安全知识用短句重复，不用吓唬式提醒。"];
  }

  if (record.gameKey === "readingCheckin") {
    return ["继续用短绘本和图卡引导孩子说“我看到了”。", "亲子共读控制在 5-10 分钟，保留轻松节奏。", "看完书马上做图书归位小任务。"];
  }

  if (record.gameKey === "mealManners") {
    return ["午餐前用同一套动作口令。", "完成一个动作就及时肯定。", "家里同步扶碗、坐稳和餐后整理。"];
  }

  if (record.gameKey === "habitTrafficLight") {
    return ["用红绿牌复习进餐行为。", "看到红牌行为时说替代动作。", "不批评孩子，只示范正确做法。"];
  }

  if (record.gameKey === "foodTrain") {
    return ["保留站点图卡复述美食名字。", "请孩子选一种美食介绍给家人。", "搭配短儿歌帮助记忆。"];
  }

  if (record.gameKey === "foodGuess") {
    return ["继续用颜色形状线索猜食材。", "让孩子做一句小播报。", "把猜中食材放进美食故事里。"];
  }

  if (record.gameKey === "foodPreference") {
    return ["先接纳正在认识的理由。", "从看一看、闻一闻开始，不催促入口。", "只推进一个靠近小步骤。"];
  }

  if (record.gameKey === "foodReporter") {
    return ["请孩子先说美食名字。", "用食材卡帮孩子补一句发现。", "可延伸到语言区或班级小主播展示。"];
  }

  if (record.gameKey === "foodKitchen") {
    return ["保留步骤卡，支持幼儿按顺序操作。", "投放围裙、锅铲玩具和食材图片。", "家里同步摆碗筷、洗菜或餐后整理。"];
  }

  if (record.gameKey === "mealTray") {
    return ["这是历史午餐小餐盘记录。", "可转化为泉州小厨房步骤活动。", "同步家庭时只保留一个可做的小步骤。"];
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
  const [parentSyncRecords, setParentSyncRecords] = useState<ParentSyncRecord[]>([]);
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
    const hasMeal = records.some(
      (record) => record.gameKey === "mealManners" || record.gameKey === "habitTrafficLight",
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
      return ["生成阅读延伸活动", "同步亲子共读 5 分钟"];
    }

    if (hasMeal) {
      return ["生成文明进餐活动", "同步饭前洗手和餐后整理"];
    }

    if (hasFood) {
      return ["生成泉州美食探索活动", "同步家庭找一种泉州美食"];
    }

    return ["从活动模板生成一节课", "引导幼儿先完成一个任务"];
  }, [growthArchive.miniGameRecords, newParentFeedbackCount]);
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
      setDraftStatus("先输入故事或活动课程方案需求，再开始生成。");
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

  function applyGroupActivityCard(card: (typeof teacherGroupActivityCards)[number]) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const nextScenario = buildGroupActivityScenario(card, teacherAgeGroup);

    setThemeId(card.themeId);
    setTask(homeTask.label);
    setScenario(nextScenario);
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(`已带入“${card.title}”，请确认后点击“开始生成”。`);
  }

  function generateGroupActivityCard(card: (typeof teacherGroupActivityCards)[number]) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const nextScenario = buildGroupActivityScenario(card, teacherAgeGroup);

    setThemeId(card.themeId);
    setTask(homeTask.label);
    setScenario(nextScenario);
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(`正在根据“${card.title}”生成活动方案。`);
    void generate({
      scenario: nextScenario,
      task: homeTask.label,
      themeId: card.themeId,
      ageGroup: teacherAgeGroup,
    });
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

  function generateMiniGamePlan(record: MiniGameRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const nextScenario = buildMiniGameInterventionScenario(record);

    setThemeId(record.themeId);
    setTask(homeTask.label);
    setScenario(nextScenario);
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus("正在根据这条幼儿互动记录生成跟进方案。");
    void generate({
      scenario: nextScenario,
      task: homeTask.label,
      themeId: record.themeId,
      ageGroup: teacherAgeGroup,
    });
  }

  function generateMiniGameEncouragement(record: MiniGameRecord) {
    const followUp = getMiniGameFollowUp(record);

    setResult({
      title: `${record.childName ?? "孩子"}的鼓励语`,
      content: followUp.encouragement,
      tips: ["说具体行为。", "不比较不催促。", "鼓励下一小步。"],
      needsReview: true,
    });
    setDraftStatus("已生成本地鼓励语，可复制或试播后再使用。");
  }

  function generateFoodPreferencePlan(record: FoodPreferenceRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const nextScenario = buildPreferenceInterventionScenario(record, teacherAgeGroup);

    setThemeId("food");
    setTask(homeTask.label);
    setScenario(nextScenario);
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus("正在根据美食认识观察生成跟进方案。");
    void generate({
      scenario: nextScenario,
      task: homeTask.label,
      themeId: "food",
      ageGroup: teacherAgeGroup,
    });
  }

  function generateFoodPreferenceEncouragement(record: FoodPreferenceRecord) {
    const followUp = getFoodPreferenceFollowUp(record);

    setResult({
      title: `${record.childName ?? "孩子"}的美食鼓励语`,
      content: followUp.encouragement,
      tips: ["先接纳感受。", "只推进一小步。", "不贴饮食标签。"],
      needsReview: true,
    });
    setDraftStatus("已生成本地美食鼓励语，可复制或试播后再使用。");
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
      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              今日班级概览
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
              查看班级成长记录，
              <span className="block text-2xl text-slate-700 md:text-3xl">
                快速生成跟进方案
              </span>
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              这里汇总幼儿在儿童端完成的阅读、习惯、进餐和闽食探索记录。老师可以根据记录生成课堂活动方案、鼓励语和家园同步建议，也可以从活动模板快速带入一节课。
              {premiumTtsEnabled ? ` ${premiumVoiceLabel} 可用于试播老师引导语和活动口令。` : ""}
            </p>
          </div>
          <button
            onClick={logoutTeacherAccount}
            className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
          >
            退出本机教师账号
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
              需要关注包含：美食认识观察、红绿牌或进餐类记录、未回复家长反馈，以及未绑定幼儿身份的记录。
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

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <details className="rounded-[2.2rem] bg-white/90 p-5 shadow-[0_18px_58px_rgba(35,88,95,0.1)]">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700">班级设置</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">花名册管理</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{rosterStatus}</p>
            </div>
            <span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-900">
              {childRoster.length} 位
            </span>
          </summary>

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
        </details>

        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#f5fffe_0%,#ffffff_54%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-700">幼儿互动记录</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">按记录类型跟进</h2>
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
            <div className="hidden grid-cols-[1.1fr_0.75fr_0.9fr_1.45fr] gap-3 bg-slate-900 px-4 py-3 text-xs font-semibold text-white md:grid">
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
                    className="grid gap-3 px-4 py-4 text-sm text-slate-700 md:grid-cols-[1.1fr_0.75fr_0.9fr_1.45fr]"
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
                              onClick={() => generateMiniGamePlan(record)}
                              className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                              type="button"
                            >
                              生成方案
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
                        {recentMiniGameRecords
                          .filter((record) => record.gameKey === row.gameKey)
                          .slice(0, 1)
                          .map((record) => (
                            <button
                              key={`encourage-${record.completedAt}-${record.gameKey}-${record.childId ?? "anon"}`}
                              onClick={() => generateMiniGameEncouragement(record)}
                              className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                              type="button"
                            >
                              生成鼓励语
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
            最近明细 {recentMiniGameRecords.length} 条可继续在方案生成中心查看；老师可先从这里按类型生成方案、同步家长或生成鼓励语。
          </p>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_52%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">课堂活动方案生成中心</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">按记录或模板生成</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              先从幼儿互动记录生成跟进方案，也可以从班级活动模板直接生成或带入修改。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            记录 {interventionRecords.length} 条 · 模板 {teacherGroupActivityCards.length} 张
          </span>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-emerald-800">按活动模板生成</p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {teacherGroupActivityCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      card.themeId === "food" ? "text-orange-700" : "text-teal-700"
                    }`}
                  >
                    {card.themeId === "food" ? "闽食成长岛" : "幼习宝"}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{card.title}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  成长任务
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">适合场景：</span>
                  {card.scene}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">活动目标：</span>
                  {card.goal}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">游戏步骤：</span>
                  {card.steps.join(" → ")}
                </p>
                <p className="rounded-[1.2rem] bg-slate-50 px-4 py-3">
                  <span className="font-semibold text-slate-900">AI 可生成：</span>
                  {card.aiCanGenerate}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => generateGroupActivityCard(card)}
                  className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  type="button"
                >
                  生成方案
                </button>
                <button
                  onClick={() => applyGroupActivityCard(card)}
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
                  type="button"
                >
                  带入修改
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <details className="rounded-[2.2rem] bg-[linear-gradient(135deg,#f6fffb_0%,#ffffff_52%,#fff5e6_100%)] p-5 shadow-[0_18px_58px_rgba(35,88,95,0.1)]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">高级设置</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">小游戏文案配置</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              用于老师后期微调儿童端任务话术，默认收起，不影响日常跟进流程。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {gameContentConfigs.length} 个游戏
          </span>
        </summary>

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
      </details>

      <details className="rounded-[2.2rem] bg-[linear-gradient(135deg,#eefcfc_0%,#ffffff_55%,#fff7dc_100%)] p-5 shadow-[0_18px_58px_rgba(35,88,95,0.1)]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">更多工具</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">素材与扩展</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              视频素材登记和背景音乐放在这里，避免打断“看记录、做跟进”的主流程。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {videoResources.length} 条资源
          </span>
        </summary>

        <div className="mt-5 rounded-[1.6rem] bg-white/82 p-4 shadow-sm">
          <AmbientMusicToggle scene="teacher" />
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
      </details>

      <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">按幼儿记录生成</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">根据互动记录生成跟进方案</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              从幼儿游戏记录、美食认识观察中直接生成跟进方案，也可以同步家长或生成一句鼓励语。
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
                <MiniGameFollowUpCard
                  key={`game-${record.completedAt}-${record.gameKey}`}
                  record={record}
                  onGeneratePlan={generateMiniGamePlan}
                  onSyncParent={syncMiniGameRecordToParent}
                  onGenerateEncouragement={generateMiniGameEncouragement}
                />
              ) : (
                <FoodPreferenceFollowUpCard
                  key={`food-${record.recordedAt}-${record.foodLabel}`}
                  record={record}
                  onGeneratePlan={generateFoodPreferencePlan}
                  onSyncParent={syncFoodPreferenceRecordToParent}
                  onGenerateEncouragement={generateFoodPreferenceEncouragement}
                />
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
            <p className="text-sm font-semibold text-rose-700">家园共育</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">家长同步与反馈跟进</h2>
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

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">生成结果与修改区</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">确认草稿后再生成</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            先选主题、年龄段和任务；也可以从上方互动记录带入线索，再生成可修改的活动方案、鼓励语或家园任务。
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

      <details className="rounded-[2.2rem] bg-white/90 p-5 shadow-[0_18px_58px_rgba(35,88,95,0.1)]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">生成历史</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              固定收藏优先，保留 6 条可复用内容
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {savedResults.length} 条
          </span>
        </summary>

        <div className="mt-5 flex flex-wrap justify-between gap-4">
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
      </details>
    </div>
  );
}
