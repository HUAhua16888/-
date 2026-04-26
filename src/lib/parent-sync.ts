import type { FoodPreferenceRecord, MiniGameRecord } from "@/lib/growth-archive";
import type { ThemeId } from "@/lib/site-data";

export const parentSyncStorageKey = "tongqu-growth-web-parent-sync-records";
export const parentFeedbackStorageKey = "tongqu-growth-web-parent-feedback-records";

export type ParentSyncRecord = {
  id: string;
  childId: string;
  childName: string;
  title: string;
  themeId: ThemeId;
  summary: string;
  strategy: string;
  homePractice: string;
  sourceLabel: string;
  syncedAt: string;
};

export type ParentFeedbackCategory = "question" | "idea" | "home-observation";

export type ParentFeedbackRecord = {
  id: string;
  childId: string;
  childName: string;
  category: ParentFeedbackCategory;
  content: string;
  createdAt: string;
  status: "new" | "read";
  teacherReply?: string;
  teacherGuidance?: string;
  teacherRepliedAt?: string;
  teacherReplySource?: "ai" | "manual";
};

const parentSyncLimit = 80;
const parentFeedbackLimit = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeParentFeedbackCategory(value: unknown): ParentFeedbackCategory {
  if (value === "idea" || value === "home-observation") {
    return value;
  }

  return "question";
}

function normalizeParentRecord(value: unknown): ParentSyncRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const themeId = value.themeId === "food" ? "food" : "habit";
  const childId = typeof value.childId === "string" ? value.childId.trim() : "";
  const childName = typeof value.childName === "string" ? value.childName.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const strategy = typeof value.strategy === "string" ? value.strategy.trim() : "";
  const homePractice = typeof value.homePractice === "string" ? value.homePractice.trim() : "";
  const sourceLabel = typeof value.sourceLabel === "string" ? value.sourceLabel.trim() : "";
  const syncedAt = typeof value.syncedAt === "string" ? value.syncedAt.trim() : "";
  const id = typeof value.id === "string" ? value.id.trim() : "";

  if (!id || !childId || !childName || !title || !summary || !strategy || !homePractice) {
    return null;
  }

  return {
    id,
    childId,
    childName,
    title: title.slice(0, 40),
    themeId,
    summary: summary.slice(0, 220),
    strategy: strategy.slice(0, 260),
    homePractice: homePractice.slice(0, 220),
    sourceLabel: sourceLabel.slice(0, 40),
    syncedAt: syncedAt || new Date().toISOString(),
  };
}

function normalizeParentFeedbackRecord(value: unknown): ParentFeedbackRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const childId = typeof value.childId === "string" ? value.childId.trim() : "";
  const childName = typeof value.childName === "string" ? value.childName.trim() : "";
  const content = typeof value.content === "string" ? value.content.trim() : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt.trim() : "";
  const teacherReply = typeof value.teacherReply === "string" ? value.teacherReply.trim() : "";
  const teacherGuidance =
    typeof value.teacherGuidance === "string" ? value.teacherGuidance.trim() : "";
  const teacherRepliedAt =
    typeof value.teacherRepliedAt === "string" ? value.teacherRepliedAt.trim() : "";
  const teacherReplySource = value.teacherReplySource === "ai" ? "ai" : "manual";
  const status = value.status === "read" ? "read" : "new";

  if (!id || !childId || !childName || !content) {
    return null;
  }

  return {
    id,
    childId,
    childName: childName.slice(0, 16),
    category: normalizeParentFeedbackCategory(value.category),
    content: content.slice(0, 320),
    createdAt: createdAt || new Date().toISOString(),
    status,
    ...(teacherReply || teacherGuidance
      ? {
          ...(teacherReply ? { teacherReply: teacherReply.slice(0, 360) } : {}),
          ...(teacherGuidance ? { teacherGuidance: teacherGuidance.slice(0, 360) } : {}),
          teacherRepliedAt: teacherRepliedAt || new Date().toISOString(),
          teacherReplySource,
        }
      : {}),
  };
}

export function parseParentSyncRecords(raw: string | null): ParentSyncRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeParentRecord)
      .filter((item): item is ParentSyncRecord => Boolean(item))
      .sort((left, right) => new Date(right.syncedAt).getTime() - new Date(left.syncedAt).getTime())
      .slice(0, parentSyncLimit);
  } catch {
    return [];
  }
}

export function parseParentFeedbackRecords(raw: string | null): ParentFeedbackRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeParentFeedbackRecord)
      .filter((item): item is ParentFeedbackRecord => Boolean(item))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, parentFeedbackLimit);
  } catch {
    return [];
  }
}

export function upsertParentSyncRecord(
  records: ParentSyncRecord[],
  record: ParentSyncRecord,
) {
  return [
    record,
    ...records.filter((item) => item.id !== record.id),
  ]
    .sort((left, right) => new Date(right.syncedAt).getTime() - new Date(left.syncedAt).getTime())
    .slice(0, parentSyncLimit);
}

export function addParentFeedbackRecord(
  records: ParentFeedbackRecord[],
  record: ParentFeedbackRecord,
) {
  return [record, ...records]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, parentFeedbackLimit);
}

export function getParentFeedbackCategoryLabel(category: ParentFeedbackCategory) {
  if (category === "idea") {
    return "家长想法";
  }

  if (category === "home-observation") {
    return "在家观察";
  }

  return "家长疑惑";
}

export function getMiniGameFollowUp(record: MiniGameRecord) {
  const pickedText = record.pickedItems.length > 0 ? record.pickedItems.join("、") : "已完成互动任务";
  const fallback = {
    displayName: record.badgeName,
    observation: "孩子完成了一项儿童互动任务。",
    activityScenario: `儿童端互动记录：${pickedText}。请生成一节幼儿园活动方案，帮助幼儿把本次经验迁移到一日生活中。`,
    homeTask: "今晚请孩子说一说今天完成了什么小任务，家长只追问一个小步骤。",
    encouragement: "你愿意试一试这个小任务，已经有新的进步啦。",
    focus: false,
  };

  const map: Partial<Record<MiniGameRecord["gameKey"], typeof fallback>> = {
    readingCheckin: {
      displayName: "阅读小书虫打卡",
      observation: "孩子完成了阅读表达任务，能听故事并说出一个角色、画面或喜欢的地方。",
      activityScenario: `阅读小书虫打卡记录：${pickedText}。请生成阅读延伸活动，包含听故事、故事复述、讲一个画面和图书整理。`,
      homeTask: "亲子共读 5 分钟，请孩子说一句“我看到了……”，看完书放回原位。",
      encouragement: "你认真听故事，还能说出自己的发现，阅读小书虫亮起来啦。",
      focus: false,
    },
    habitTrafficLight: {
      displayName: "好习惯红绿牌",
      observation: "孩子参与了好习惯判断，可继续练习把需要调整的做法换成正确动作。",
      activityScenario: `好习惯红绿牌记录：${pickedText}。请生成红绿牌情境游戏和好习惯替代动作练习。`,
      homeTask: "在家找一个好习惯，请孩子说给家长听，或拍一张完成好习惯的照片。",
      encouragement: "你会用红绿牌想一想，还能把做法换一换，真会照顾自己。",
      focus: true,
    },
    mealManners: {
      displayName: "文明进餐操",
      observation: "孩子练习了文明进餐动作，可继续关注坐姿、轻声用餐、细嚼慢咽和餐后整理。",
      activityScenario: `文明进餐操记录：${pickedText}。请生成文明进餐操、餐前口令和餐后整理练习活动。`,
      homeTask: "饭前洗手、摆碗筷，餐后整理一个小地方；完成一个步骤就具体表扬。",
      encouragement: "你的小手、小脚和小嘴巴都在练习文明进餐，完成一步也值得记录。",
      focus: true,
    },
    foodTrain: {
      displayName: "闽食小列车",
      observation: "孩子认识了泉州美食站点，可继续从名称、食材和一句播报延伸。",
      activityScenario: `闽食小列车记录：${pickedText}。请生成闽食小列车集体游戏，帮助幼儿认识泉州美食名称和食材。`,
      homeTask: "和家长找一种家里或街边见过的泉州美食，说出它的名字。",
      encouragement: "你坐上闽食小列车，认识了新的泉州美食站点。",
      focus: false,
    },
    foodGuess: {
      displayName: "美食猜猜乐",
      observation: "孩子能根据线索认识食材，可继续用颜色、形状和来源做食材发现。",
      activityScenario: `美食猜猜乐记录：${pickedText}。请生成美食宝箱猜猜乐，围绕颜色、形状、来源和用途认识食材。`,
      homeTask: "和家长找一种食材，说一说它的颜色或形状。",
      encouragement: "你会听线索找食材，像小小美食侦探一样认真。",
      focus: false,
    },
    foodObserve: {
      displayName: "泉州美食摊位寻宝",
      observation: "孩子完成泉州美食摊位寻宝，能从名字、食材和小故事靠近家乡美食。",
      activityScenario: `泉州美食摊位寻宝记录：${pickedText}。请生成泉州美食小发现活动，包含认名字、找食材、听小故事和说发现。`,
      homeTask: "介绍一种泉州美食名字和一个食材。",
      encouragement: "你找到泉州美食摊位，还愿意听它的小故事。",
      focus: false,
    },
    foodPreference: {
      displayName: "美食认识观察卡",
      observation: "孩子正在认识一种暂时陌生的食物，需要温和小步靠近。",
      activityScenario: `美食认识观察记录：${pickedText}。请生成亲近美食小步任务，不贴标签，从看一看、闻一闻、说发现开始。`,
      homeTask: "看一看、闻一闻、尝一点、说发现；不催促，不比较。",
      encouragement: "愿意靠近一点点，就是很棒的尝试。",
      focus: true,
    },
    foodReporter: {
      displayName: "闽食小小播报员",
      observation: "孩子尝试介绍一种泉州美食，能用名字、食材或发现组成表达。",
      activityScenario: `闽食小小播报员记录：${pickedText}。请生成小小闽食主播语言区活动，包含播报示范、同伴展示和表扬语。`,
      homeTask: "请孩子向家人介绍一种泉州美食，说出名字和一个食材或发现。",
      encouragement: "你已经能介绍一种家乡美食，像小小播报员一样自信。",
      focus: false,
    },
    foodKitchen: {
      displayName: "泉州小厨房",
      observation: "孩子愿意参与泉州美食制作步骤和角色扮演，可继续发展顺序表达和生活参与。",
      activityScenario: `泉州小厨房记录：${pickedText}。请生成区域活动方案，包含食材图片、锅铲玩具、步骤卡、围裙和家园延伸。`,
      homeTask: "在家参与一个小步骤：摆碗筷、洗菜、搅拌、端盘或餐后整理。",
      encouragement: "你会按步骤做小厨师任务，也懂得帮忙和整理。",
      focus: false,
    },
    mealTray: {
      displayName: "历史午餐小餐盘记录",
      observation: "这是旧版午餐小餐盘历史记录，可查看和同步，但当前主线建议转为泉州小厨房。",
      activityScenario: `历史午餐小餐盘记录：${pickedText}。请转化为泉州小厨房区域活动，围绕步骤卡和角色扮演延伸。`,
      homeTask: "在家参与一个小厨房步骤，如摆碗筷或餐后整理。",
      encouragement: "你认识过餐盘里的食物，现在可以继续当泉州小厨师。",
      focus: false,
    },
    peerEncourage: {
      displayName: "历史同伴鼓励记录",
      observation: "这是旧版同伴鼓励历史记录，可查看和同步，但当前主线建议转为闽食小小播报员。",
      activityScenario: `历史同伴鼓励记录：${pickedText}。请转化为小小闽食主播活动，鼓励幼儿介绍一种家乡美食。`,
      homeTask: "请孩子向家人介绍一种泉州美食，说出名字和一个发现。",
      encouragement: "你愿意把认识美食的方法说出来，可以继续练习小小播报。",
      focus: false,
    },
    habitJudge: {
      displayName: "历史安全判断记录",
      observation: "这是旧版安全判断历史记录，可查看和同步，但不作为当前推荐主线。",
      activityScenario: `历史安全判断记录：${pickedText}。请转化为好习惯红绿牌复习活动，帮助幼儿说出正确替代做法。`,
      homeTask: "在家复习一个安全做法，用短句说“我可以这样做”。",
      encouragement: "你能回想正确做法，这条历史记录还可以继续帮助我们复习。",
      focus: false,
    },
  };

  return map[record.gameKey] ?? fallback;
}

export function getFoodPreferenceFollowUp(record: FoodPreferenceRecord) {
  return {
    displayName: "美食认识观察卡",
    observation: `孩子正在认识“${record.foodLabel}”，感受原因是“${record.reasonLabel}”。`,
    activityScenario: `儿童端美食认识观察：孩子正在认识“${record.foodLabel}”，原因选择为“${record.reasonLabel}”。已有温和策略：${record.strategy}${record.gentleTryTip}。请生成亲近美食小步任务，不贴标签，围绕看一看、闻一闻、说发现和选择靠近一小步设计。`,
    homeTask: record.gentleTryTip || "看一看、闻一闻、尝一点、说发现；不催促，不比较。",
    encouragement: `你愿意靠近${record.foodLabel}一点点，就是很棒的尝试。`,
    focus: true,
  };
}

export function buildParentSyncFromMiniGame(record: MiniGameRecord): ParentSyncRecord | null {
  if (!record.childId || !record.childName) {
    return null;
  }

  const pickedText = record.pickedItems.length > 0 ? record.pickedItems.join("、") : "已完成互动任务";
  const themeName = record.themeId === "habit" ? "幼习宝" : "闽食成长岛";
  const followUp = getMiniGameFollowUp(record);

  return {
    id: `game-${record.completedAt}-${record.gameKey}-${record.childId}`,
    childId: record.childId,
    childName: record.childName,
    title: `${record.childName}的${record.badgeName}`,
    themeId: record.themeId,
    summary: `${record.childName}今天完成了“${themeName}”中的${followUp.displayName}。互动记录：${pickedText}。老师观察：${followUp.observation}`,
    strategy: followUp.observation,
    homePractice: followUp.homeTask,
    sourceLabel: "幼儿游戏记录",
    syncedAt: new Date().toISOString(),
  };
}

export function buildParentSyncFromFoodPreference(
  record: FoodPreferenceRecord,
): ParentSyncRecord | null {
  if (!record.childId || !record.childName) {
    return null;
  }

  const followUp = getFoodPreferenceFollowUp(record);

  return {
    id: `food-${record.recordedAt}-${record.foodLabel}-${record.childId}`,
    childId: record.childId,
    childName: record.childName,
    title: `${record.childName}的美食认识观察`,
    themeId: "food",
    summary: `${record.childName}今天正在认识“${record.foodLabel}”，选择的感受原因是“${record.reasonLabel}”。老师观察：${followUp.observation}`,
    strategy: followUp.observation,
    homePractice: followUp.homeTask,
    sourceLabel: "美食认识观察",
    syncedAt: new Date().toISOString(),
  };
}

export function formatParentSyncTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚同步";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
