import type { ThemeId } from "@/lib/site-data";

export const growthArchiveStorageKey = "tongqu-growth-web-growth-archive";
export const childRosterStorageKey = "tongqu-growth-web-child-roster";
export const selectedChildStorageKey = "tongqu-growth-web-selected-child";
export const classIdStorageKey = "tongqu-growth-web-class-id";
export const teacherIdStorageKey = "tongqu-growth-web-teacher-id";
export const guardianIdStorageKey = "tongqu-growth-web-guardian-id";
export const deviceIdStorageKey = "tongqu-growth-web-device-id";
export const sessionIdStorageKey = "tongqu-growth-web-session-id";

export type ChildProfile = {
  id: string;
  name: string;
  className?: string;
  rosterNumber?: string;
  familyBindingCode?: string;
  createdAt: string;
};

export type ChildRecordFields = {
  childId?: string;
  childName?: string;
};

export type ActivitySyncFields = {
  eventId?: string;
  classId?: string;
  guardianId?: string;
  teacherId?: string;
  deviceId?: string;
  sessionId?: string;
  syncStatus?: "local" | "pending" | "synced";
  updatedAt?: string;
};

export type MiniGameKey =
  | "washSteps"
  | "queue"
  | "habitJudge"
  | "readingCheckin"
  | "childTalk"
  | "teacherTask"
  | "kindWords"
  | "todayMenu"
  | "foodObserve"
  | "foodClue"
  | "foodTrain"
  | "foodGuess"
  | "foodPreference"
  | "foodReporter"
  | "foodKitchen"
  | "peerEncourage"
  | "mealTray"
  | "mealManners"
  | "habitTrafficLight";
export type BadgeSource = "story" | "meal-review" | "mini-game";

export type BadgeRecord = {
  name: string;
  themeId: ThemeId;
  earnedAt: string;
  source: BadgeSource;
} & ChildRecordFields & ActivitySyncFields;

export type MealReviewRecord = {
  reviewedAt: string;
  mode: "demo" | "ai";
  summary: string;
  guessedFoods: string[];
  stickers: string[];
  plateState: string;
  imageName: string;
} & ChildRecordFields & ActivitySyncFields;

export type FoodPreferenceRecord = {
  recordedAt: string;
  foodId?: string;
  foodLabel: string;
  reasonLabel: string;
  strategy: string;
  gentleTryTip: string;
  approachStep?: string;
  acceptedLevel?: string;
  nutritionPlayed?: boolean;
  themeSource?: string;
  menuDate?: string;
  mealType?: string;
  dishName?: string;
  ingredientName?: string;
  reason?: string;
} & ChildRecordFields & ActivitySyncFields;

export type MiniGameRecord = {
  gameKey: MiniGameKey;
  badgeName: string;
  themeId: ThemeId;
  completedAt: string;
  createdAt?: string;
  templateType?: string;
  activityId?: string;
  action?: string;
  pickedItems: string[];
  source?: string;
  activityType?: string;
  result?: "success" | "retry" | "wrong" | "completed";
  attempts?: number;
  retryCount?: number;
  levelId?: string;
  habitType?: string;
  storyId?: string;
  roleChoice?: string;
  taskId?: string;
  assignedByTeacher?: boolean;
  status?: string;
  messageType?: "voice" | "text" | "photo" | "video" | "mixed";
  mediaUrl?: string;
  teacherRead?: boolean;
  teacherReply?: string;
  foodId?: string;
  approachStep?: string;
  acceptedLevel?: string;
  nutritionPlayed?: boolean;
  menuDate?: string;
  mealType?: string;
  clicked?: boolean;
  dishId?: string;
  stepOrder?: string[];
  isCorrect?: boolean;
  scriptText?: string;
  voiceText?: string;
  audioUrl?: string;
  submittedAt?: string;
  storyTopic?: string;
  answerContent?: string;
  habitTask?: string;
  bookTitle?: string;
  listenCount?: number;
  finished?: boolean;
  checkInCount?: number;
  favoriteStory?: string;
  foodLabel?: string;
  dishName?: string;
  stepsCompleted?: string[];
  ingredientsAdded?: string[];
  imageSource?: string;
  mediaName?: string;
  gameInstanceId?: string;
  gameInstanceTitle?: string;
  gameInstanceMechanic?: string;
  gameRuleName?: string;
  uploadedFileName?: string;
  childUtterance?: string;
  aiBroadcastText?: string;
  coverImageUrl?: string;
  mediaSource?: string;
  teacherConfirmed?: boolean;
  aiGenerated?: boolean;
  imageSourceLabel?: string;
} & ChildRecordFields & ActivitySyncFields;

export type MiniGameProgress = Record<MiniGameKey, number>;

export type GrowthArchive = {
  version: 1;
  badgeRecords: BadgeRecord[];
  mealReviews: MealReviewRecord[];
  foodPreferenceRecords: FoodPreferenceRecord[];
  miniGameRecords: MiniGameRecord[];
  miniGameProgress: MiniGameProgress;
  themeVisits: Record<ThemeId, number>;
  lastUpdated: string;
};

function randomToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredId(key: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(key)?.trim();

  if (stored) {
    return stored;
  }

  window.localStorage.setItem(key, fallback);
  return fallback;
}

function readSessionId() {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const stored = window.sessionStorage.getItem(sessionIdStorageKey)?.trim();

  if (stored) {
    return stored;
  }

  const nextId = `session-${randomToken()}`;
  window.sessionStorage.setItem(sessionIdStorageKey, nextId);
  return nextId;
}

export function buildActivitySyncFields(
  activityType: string,
  child?: ChildRecordFields,
  timestamp = new Date().toISOString(),
): ActivitySyncFields {
  const deviceId = readStoredId(deviceIdStorageKey, `device-${randomToken()}`);
  const classId = readStoredId(classIdStorageKey, "default-class");
  const teacherId =
    typeof window === "undefined" ? "" : window.localStorage.getItem(teacherIdStorageKey)?.trim() ?? "";
  const guardianId =
    typeof window === "undefined" ? "" : window.localStorage.getItem(guardianIdStorageKey)?.trim() ?? "";
  const eventSeed = [
    classId,
    child?.childId ?? child?.childName ?? "unbound-child",
    activityType,
    timestamp,
    deviceId,
    randomToken(),
  ].join(":");

  return {
    eventId: `evt-${eventSeed.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96)}`,
    classId,
    teacherId: teacherId || undefined,
    guardianId: guardianId || undefined,
    deviceId,
    sessionId: readSessionId(),
    syncStatus: "pending",
    updatedAt: timestamp,
  };
}

export function createEmptyGrowthArchive(): GrowthArchive {
  return {
    version: 1,
    badgeRecords: [],
    mealReviews: [],
    foodPreferenceRecords: [],
    miniGameRecords: [],
    miniGameProgress: {
      washSteps: 0,
      queue: 0,
      habitJudge: 0,
      readingCheckin: 0,
      childTalk: 0,
      teacherTask: 0,
      kindWords: 0,
      todayMenu: 0,
      foodObserve: 0,
      foodClue: 0,
      foodTrain: 0,
      foodGuess: 0,
      foodPreference: 0,
      foodReporter: 0,
      foodKitchen: 0,
      peerEncourage: 0,
      mealTray: 0,
      mealManners: 0,
      habitTrafficLight: 0,
    },
    themeVisits: {
      habit: 0,
      food: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function normalizeMiniGameCount(value: unknown) {
  return typeof value === "number" && value > 0 ? 1 : 0;
}

function getMiniGameRecordTime(record: Pick<MiniGameRecord, "createdAt" | "completedAt" | "updatedAt">) {
  const value = record.createdAt ?? record.completedAt ?? record.updatedAt ?? "";
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getMiniGameRecordDedupeKey(
  record: Pick<
    MiniGameRecord,
    | "childId"
    | "childName"
    | "gameKey"
    | "activityType"
    | "templateType"
    | "activityId"
    | "gameInstanceId"
    | "levelId"
    | "taskId"
    | "storyId"
    | "dishId"
    | "foodId"
    | "action"
    | "pickedItems"
  >,
) {
  return [
    record.childId ?? record.childName ?? "unbound-child",
    record.gameKey,
    record.activityType ?? record.templateType ?? "",
    record.activityId ??
      record.gameInstanceId ??
      record.levelId ??
      record.taskId ??
      record.storyId ??
      record.dishId ??
      record.foodId ??
      "",
    record.action ?? record.pickedItems.filter(Boolean).join("、"),
  ].join("::");
}

function isRecentDuplicateMiniGameRecord(left: MiniGameRecord, right: MiniGameRecord) {
  return (
    getMiniGameRecordDedupeKey(left) === getMiniGameRecordDedupeKey(right) &&
    Math.abs(getMiniGameRecordTime(left) - getMiniGameRecordTime(right)) <= 3000
  );
}

function dedupeMiniGameRecords(records: MiniGameRecord[]) {
  const result: MiniGameRecord[] = [];

  for (const record of records) {
    if (!result.some((item) => isRecentDuplicateMiniGameRecord(item, record))) {
      result.push(record);
    }
  }

  return result;
}

export function parseGrowthArchive(raw: string | null): GrowthArchive {
  if (!raw) {
    return createEmptyGrowthArchive();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GrowthArchive>;
    const empty = createEmptyGrowthArchive();

    return {
      version: 1,
      badgeRecords: Array.isArray(parsed.badgeRecords)
        ? parsed.badgeRecords
            .filter(
              (item): item is BadgeRecord =>
                Boolean(
                  item &&
                    typeof item === "object" &&
                    typeof item.name === "string" &&
                    typeof item.themeId === "string" &&
                    typeof item.earnedAt === "string" &&
                    typeof item.source === "string",
                ),
            )
            .slice(0, 240)
        : empty.badgeRecords,
      mealReviews: Array.isArray(parsed.mealReviews)
        ? parsed.mealReviews
            .filter(
              (item): item is MealReviewRecord =>
                Boolean(
                  item &&
                    typeof item === "object" &&
                    typeof item.reviewedAt === "string" &&
                    typeof item.mode === "string" &&
                    typeof item.summary === "string" &&
                    Array.isArray(item.guessedFoods) &&
                    Array.isArray(item.stickers) &&
                    typeof item.plateState === "string" &&
                    typeof item.imageName === "string",
                ),
            )
            .slice(0, 120)
        : empty.mealReviews,
      foodPreferenceRecords: Array.isArray(parsed.foodPreferenceRecords)
        ? parsed.foodPreferenceRecords
            .filter(
              (item): item is FoodPreferenceRecord =>
                Boolean(
                  item &&
                    typeof item === "object" &&
                    typeof item.recordedAt === "string" &&
                    typeof item.foodLabel === "string" &&
                    typeof item.reasonLabel === "string" &&
                    typeof item.strategy === "string" &&
                    typeof item.gentleTryTip === "string",
                ),
            )
            .slice(0, 240)
        : empty.foodPreferenceRecords,
      miniGameRecords: Array.isArray(parsed.miniGameRecords)
        ? dedupeMiniGameRecords(
            parsed.miniGameRecords.filter(
              (item): item is MiniGameRecord =>
                Boolean(
                  item &&
                    typeof item === "object" &&
                    typeof item.gameKey === "string" &&
                    typeof item.badgeName === "string" &&
                    typeof item.themeId === "string" &&
                    typeof item.completedAt === "string" &&
                    Array.isArray(item.pickedItems),
                ),
            ),
          ).slice(0, 360)
        : empty.miniGameRecords,
      miniGameProgress: {
        washSteps: normalizeMiniGameCount(parsed.miniGameProgress?.washSteps),
        queue: normalizeMiniGameCount(parsed.miniGameProgress?.queue),
        habitJudge: normalizeMiniGameCount(parsed.miniGameProgress?.habitJudge),
        readingCheckin: normalizeMiniGameCount(parsed.miniGameProgress?.readingCheckin),
        childTalk: normalizeMiniGameCount(parsed.miniGameProgress?.childTalk),
        teacherTask: normalizeMiniGameCount(parsed.miniGameProgress?.teacherTask),
        kindWords: normalizeMiniGameCount(parsed.miniGameProgress?.kindWords),
        todayMenu: normalizeMiniGameCount(parsed.miniGameProgress?.todayMenu),
        foodObserve: normalizeMiniGameCount(parsed.miniGameProgress?.foodObserve),
        foodClue: normalizeMiniGameCount(parsed.miniGameProgress?.foodClue),
        foodTrain: normalizeMiniGameCount(parsed.miniGameProgress?.foodTrain),
        foodGuess: normalizeMiniGameCount(parsed.miniGameProgress?.foodGuess),
        foodPreference: normalizeMiniGameCount(parsed.miniGameProgress?.foodPreference),
        foodReporter: normalizeMiniGameCount(parsed.miniGameProgress?.foodReporter),
        foodKitchen: normalizeMiniGameCount(parsed.miniGameProgress?.foodKitchen),
        peerEncourage: normalizeMiniGameCount(parsed.miniGameProgress?.peerEncourage),
        mealTray: normalizeMiniGameCount(parsed.miniGameProgress?.mealTray),
        mealManners: normalizeMiniGameCount(parsed.miniGameProgress?.mealManners),
        habitTrafficLight: normalizeMiniGameCount(parsed.miniGameProgress?.habitTrafficLight),
      },
      themeVisits: {
        habit: typeof parsed.themeVisits?.habit === "number" ? parsed.themeVisits.habit : 0,
        food: typeof parsed.themeVisits?.food === "number" ? parsed.themeVisits.food : 0,
      },
      lastUpdated:
        typeof parsed.lastUpdated === "string" && parsed.lastUpdated.trim()
          ? parsed.lastUpdated
          : empty.lastUpdated,
    };
  } catch {
    return createEmptyGrowthArchive();
  }
}

function getArchiveRecordValue<T>(record: T, field: string) {
  return (record as unknown as Record<string, unknown>)[field];
}

function getArchiveRecordTime<T>(record: T, fields: string[]) {
  for (const field of fields) {
    const value = getArchiveRecordValue(record, field);

    if (typeof value === "string") {
      const time = new Date(value).getTime();

      if (!Number.isNaN(time)) {
        return time;
      }
    }
  }

  return 0;
}

function getArchiveRecordKey<T extends ActivitySyncFields & ChildRecordFields>(
  record: T,
  fallbackFields: string[],
) {
  if (record.eventId) {
    return record.eventId;
  }

  return fallbackFields
    .map((field) => {
      const value = getArchiveRecordValue(record, field);

      return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "";
    })
    .join("::");
}

function mergeArchiveRecordArrays<T extends ActivitySyncFields & ChildRecordFields>(
  current: T[],
  incoming: T[],
  fallbackFields: string[],
  timestampFields: string[],
) {
  const merged = new Map<string, T>();

  for (const record of [...current, ...incoming]) {
    const key = getArchiveRecordKey(record, fallbackFields);
    const previous = merged.get(key);

    if (!previous || getArchiveRecordTime(record, timestampFields) >= getArchiveRecordTime(previous, timestampFields)) {
      merged.set(key, previous ? { ...previous, ...record } : record);
    }
  }

  return Array.from(merged.values()).sort(
    (left, right) => getArchiveRecordTime(right, timestampFields) - getArchiveRecordTime(left, timestampFields),
  );
}

function mergeArchiveCounts<T extends string>(current: Record<T, number>, incoming: Record<T, number>) {
  const result = { ...current };

  for (const key of Object.keys(incoming) as T[]) {
    result[key] = Math.max(current[key] ?? 0, incoming[key] ?? 0);
  }

  return result;
}

export function mergeGrowthArchives(current: GrowthArchive, incoming: GrowthArchive): GrowthArchive {
  const currentTime = new Date(current.lastUpdated).getTime();
  const incomingTime = new Date(incoming.lastUpdated).getTime();

  return {
    version: 1,
    badgeRecords: mergeArchiveRecordArrays(
      current.badgeRecords,
      incoming.badgeRecords,
      ["name", "childId", "earnedAt"],
      ["updatedAt", "earnedAt"],
    ).slice(0, 240),
    mealReviews: mergeArchiveRecordArrays(
      current.mealReviews,
      incoming.mealReviews,
      ["childId", "reviewedAt", "imageName"],
      ["updatedAt", "reviewedAt"],
    ).slice(0, 120),
    foodPreferenceRecords: mergeArchiveRecordArrays(
      current.foodPreferenceRecords,
      incoming.foodPreferenceRecords,
      ["childId", "foodId", "foodLabel", "recordedAt"],
      ["updatedAt", "recordedAt"],
    ).slice(0, 240),
    miniGameRecords: mergeArchiveRecordArrays(
      current.miniGameRecords,
      incoming.miniGameRecords,
      ["childId", "gameKey", "completedAt"],
      ["updatedAt", "completedAt", "createdAt"],
    ).slice(0, 360),
    miniGameProgress: mergeArchiveCounts(current.miniGameProgress, incoming.miniGameProgress),
    themeVisits: mergeArchiveCounts(current.themeVisits, incoming.themeVisits),
    lastUpdated:
      !Number.isNaN(incomingTime) && (Number.isNaN(currentTime) || incomingTime > currentTime)
        ? incoming.lastUpdated
        : current.lastUpdated,
  };
}

export function recordThemeVisit(archive: GrowthArchive, themeId: ThemeId): GrowthArchive {
  return {
    ...archive,
    themeVisits: {
      ...archive.themeVisits,
      [themeId]: archive.themeVisits[themeId] + 1,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function recordMiniGameCompletion(
  archive: GrowthArchive,
  gameKey: MiniGameKey,
  detail?: Omit<MiniGameRecord, "completedAt" | "gameKey">,
): GrowthArchive {
  const alreadyCompleted = archive.miniGameProgress[gameKey] > 0;
  const completedAt = new Date().toISOString();
  const syncFields = buildActivitySyncFields(
    `mini-game:${gameKey}`,
    detail,
    completedAt,
  );
  const activityId =
    detail?.activityId ??
    detail?.gameInstanceId ??
    detail?.levelId ??
    detail?.taskId ??
    detail?.storyId ??
    detail?.dishId ??
    detail?.foodId ??
    gameKey;
  const action = detail?.action ?? detail?.pickedItems.filter(Boolean).join("、") ?? "";
  const nextRecord = detail
    ? {
        ...syncFields,
        ...detail,
        gameKey,
        activityType: detail.activityType ?? `mini-game:${gameKey}`,
        templateType: detail.templateType ?? detail.activityType ?? `mini-game:${gameKey}`,
        activityId,
        action,
        result: detail.result ?? "success",
        status: detail.status ?? "completed",
        eventId: detail.eventId ?? syncFields.eventId,
        createdAt: detail.createdAt ?? completedAt,
        completedAt,
      }
    : null;
  const hasRecentDuplicate =
    nextRecord &&
    archive.miniGameRecords.some((record) => isRecentDuplicateMiniGameRecord(record, nextRecord));

  return {
    ...archive,
    miniGameProgress: alreadyCompleted
      ? archive.miniGameProgress
      : {
          ...archive.miniGameProgress,
          [gameKey]: 1,
        },
    miniGameRecords: nextRecord && !hasRecentDuplicate
      ? [nextRecord, ...archive.miniGameRecords].slice(0, 360)
      : archive.miniGameRecords,
    lastUpdated: completedAt,
  };
}

export function recordBadge(
  archive: GrowthArchive,
  badge: string,
  themeId: ThemeId,
  source: BadgeSource,
  child?: ChildRecordFields,
): GrowthArchive {
  const normalizedBadge = badge.trim();

  if (!normalizedBadge) {
    return archive;
  }

  const exists = archive.badgeRecords.some(
    (item) =>
      item.name === normalizedBadge &&
      item.themeId === themeId &&
      (child?.childId ? item.childId === child.childId : !item.childId),
  );

  if (exists) {
    return archive;
  }

  const earnedAt = new Date().toISOString();
  const syncFields = buildActivitySyncFields(`badge:${source}`, child, earnedAt);

  return {
    ...archive,
    badgeRecords: [
      {
        ...syncFields,
        name: normalizedBadge,
        themeId,
        source,
        childId: child?.childId,
        childName: child?.childName,
        earnedAt,
      },
      ...archive.badgeRecords,
    ].slice(0, 240),
    lastUpdated: earnedAt,
  };
}

export function recordMealReview(
  archive: GrowthArchive,
  mealReview: MealReviewRecord,
): GrowthArchive {
  const reviewedAt = mealReview.reviewedAt || new Date().toISOString();
  const syncFields = buildActivitySyncFields("meal-review", mealReview, reviewedAt);

  return {
    ...archive,
    mealReviews: [
      {
        ...syncFields,
        ...mealReview,
        eventId: mealReview.eventId ?? syncFields.eventId,
        reviewedAt,
      },
      ...archive.mealReviews,
    ].slice(0, 120),
    lastUpdated: reviewedAt,
  };
}

export function recordFoodPreference(
  archive: GrowthArchive,
  preference: FoodPreferenceRecord,
): GrowthArchive {
  const normalizedFood = preference.foodLabel.trim();
  const normalizedReason = preference.reasonLabel.trim();

  if (!normalizedFood || !normalizedReason) {
    return archive;
  }

  const recordedAt = preference.recordedAt || new Date().toISOString();
  const syncFields = buildActivitySyncFields("food-preference", preference, recordedAt);

  return {
    ...archive,
    foodPreferenceRecords: [
      {
        ...syncFields,
        ...preference,
        eventId: preference.eventId ?? syncFields.eventId,
        foodId: preference.foodId ?? normalizedFood,
        foodLabel: normalizedFood,
        reasonLabel: normalizedReason,
        acceptedLevel: preference.acceptedLevel ?? preference.approachStep ?? normalizedReason,
        nutritionPlayed: preference.nutritionPlayed ?? false,
        recordedAt,
      },
      ...archive.foodPreferenceRecords,
    ].slice(0, 240),
    lastUpdated: recordedAt,
  };
}

export function countUniqueBadges(archive: GrowthArchive, childId?: string) {
  const records = childId
    ? archive.badgeRecords.filter((item) => item.childId === childId)
    : archive.badgeRecords;

  return new Set(records.map((item) => item.name)).size;
}

export function getMiniGameCompletionTotal(archive: GrowthArchive, childId?: string) {
  if (childId) {
    return archive.miniGameRecords.filter((item) => item.childId === childId).length;
  }

  return Object.values(archive.miniGameProgress).reduce((sum, value) => sum + value, 0);
}

export type BadgeLevelSummary = {
  level: string;
  description: string;
  badgeCount: number;
  nextLevel: string;
  remainingToNext: number;
  latestBadges: BadgeRecord[];
};

const badgeLevels = [
  {
    min: 0,
    level: "成长启航",
    description: "已经开始认识好习惯和成长任务啦。",
  },
  {
    min: 5,
    level: "进餐小明星",
    description: "能完成多个进餐好习惯，也愿意尝试一小步。",
  },
  {
    min: 10,
    level: "阅读小书虫",
    description: "愿意听故事、看图书，也能说出自己的发现。",
  },
  {
    min: 15,
    level: "闽食小当家",
    description: "认识更多泉州美食，也能把发现分享给家人。",
  },
  {
    min: 20,
    level: "好习惯小队长",
    description: "能把好习惯带到班级生活和家庭生活里。",
  },
  {
    min: 30,
    level: "成长岛小主人",
    description: "坚持完成成长任务，能照顾自己，也能鼓励同伴。",
  },
];

export function getBadgeLevelSummary(
  archive: GrowthArchive,
  childId?: string,
): BadgeLevelSummary {
  const childBadges = childId
    ? archive.badgeRecords.filter((record) => record.childId === childId)
    : archive.badgeRecords;
  const childMiniGameRecords = childId
    ? archive.miniGameRecords.filter((record) => record.childId === childId)
    : archive.miniGameRecords;
  const uniqueBadges = new Map<string, BadgeRecord>();

  for (const record of childBadges) {
    const current = uniqueBadges.get(record.name);

    if (!current || new Date(record.earnedAt).getTime() > new Date(current.earnedAt).getTime()) {
      uniqueBadges.set(record.name, record);
    }
  }

  const latestBadges = Array.from(uniqueBadges.values()).sort(
    (left, right) => new Date(right.earnedAt).getTime() - new Date(left.earnedAt).getTime(),
  );
  const badgeCount = Math.max(latestBadges.length, childMiniGameRecords.length);
  const currentLevel =
    [...badgeLevels].reverse().find((level) => badgeCount >= level.min) ?? badgeLevels[0];
  const nextLevel = badgeLevels.find((level) => level.min > badgeCount);

  return {
    level: currentLevel.level,
    description: currentLevel.description,
    badgeCount,
    nextLevel: nextLevel?.level ?? "已到最高等级",
    remainingToNext: nextLevel ? Math.max(0, nextLevel.min - badgeCount) : 0,
    latestBadges: latestBadges.slice(0, 3),
  };
}

export function parseChildRoster(raw: string | null): ChildProfile[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is ChildProfile =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.createdAt === "string",
          ),
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        className:
          "className" in item && typeof item.className === "string"
            ? item.className.trim().slice(0, 16)
            : undefined,
        rosterNumber:
          "rosterNumber" in item && typeof item.rosterNumber === "string"
            ? item.rosterNumber.trim().slice(0, 8)
            : undefined,
        familyBindingCode:
          "familyBindingCode" in item && typeof item.familyBindingCode === "string"
            ? item.familyBindingCode.trim().toUpperCase().slice(0, 12)
            : undefined,
        createdAt: item.createdAt,
      }))
      .filter((item) => item.id.trim() && item.name)
      .slice(0, 60);
  } catch {
    return [];
  }
}
