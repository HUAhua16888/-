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

export function buildParentSyncFromMiniGame(record: MiniGameRecord): ParentSyncRecord | null {
  if (!record.childId || !record.childName) {
    return null;
  }

  const pickedText = record.pickedItems.length > 0 ? record.pickedItems.join("、") : "已完成互动任务";
  const themeName = record.themeId === "habit" ? "幼习宝" : "闽食成长岛";

  const strategy =
    record.themeId === "habit"
      ? "在家继续用短句提醒和图卡复习，不比较、不催促；孩子做对一个动作时，说出具体行为进行肯定。"
      : "在家延续看一看、闻一闻、尝一小口的节奏，先接纳孩子的感受，再邀请孩子认识食材。";
  const homePractice =
    record.themeId === "habit"
      ? "今晚可以请孩子说一说：今天我做对了哪个好习惯？家长只追问一个小步骤。"
      : "今晚可以请孩子介绍一种今天认识的闽南食物，说出一个食材或一种味道。";

  return {
    id: `game-${record.completedAt}-${record.gameKey}-${record.childId}`,
    childId: record.childId,
    childName: record.childName,
    title: `${record.childName}的${record.badgeName}`,
    themeId: record.themeId,
    summary: `${record.childName}今天完成了“${themeName}”中的${record.badgeName}。互动记录：${pickedText}。`,
    strategy,
    homePractice,
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

  return {
    id: `food-${record.recordedAt}-${record.foodLabel}-${record.childId}`,
    childId: record.childId,
    childName: record.childName,
    title: `${record.childName}的美食认识观察`,
    themeId: "food",
    summary: `${record.childName}今天正在认识“${record.foodLabel}”，选择的感受原因是“${record.reasonLabel}”。`,
    strategy: record.strategy || "先接纳孩子的感受，不贴挑食标签，再从认名字、找食材、说发现开始温和靠近。",
    homePractice: record.gentleTryTip || "回家可以先介绍这道家乡美食的名字，找一找食材或说一说颜色，不要求马上吃完。",
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
