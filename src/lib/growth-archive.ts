import type { ThemeId } from "@/lib/site-data";

export const growthArchiveStorageKey = "tongqu-growth-web-growth-archive";
export const childRosterStorageKey = "tongqu-growth-web-child-roster";
export const selectedChildStorageKey = "tongqu-growth-web-selected-child";

export type ChildProfile = {
  id: string;
  name: string;
  rosterNumber?: string;
  createdAt: string;
};

export type ChildRecordFields = {
  childId?: string;
  childName?: string;
};

export type MiniGameKey =
  | "washSteps"
  | "queue"
  | "habitJudge"
  | "readingCheckin"
  | "kindWords"
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
} & ChildRecordFields;

export type MealReviewRecord = {
  reviewedAt: string;
  mode: "demo" | "ai";
  summary: string;
  guessedFoods: string[];
  stickers: string[];
  plateState: string;
  imageName: string;
} & ChildRecordFields;

export type FoodPreferenceRecord = {
  recordedAt: string;
  foodLabel: string;
  reasonLabel: string;
  strategy: string;
  gentleTryTip: string;
} & ChildRecordFields;

export type MiniGameRecord = {
  gameKey: MiniGameKey;
  badgeName: string;
  themeId: ThemeId;
  completedAt: string;
  pickedItems: string[];
} & ChildRecordFields;

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
      kindWords: 0,
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
            .slice(0, 40)
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
            .slice(0, 12)
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
            .slice(0, 16)
        : empty.foodPreferenceRecords,
      miniGameRecords: Array.isArray(parsed.miniGameRecords)
        ? parsed.miniGameRecords
            .filter(
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
            )
            .slice(0, 32)
        : empty.miniGameRecords,
      miniGameProgress: {
        washSteps: normalizeMiniGameCount(parsed.miniGameProgress?.washSteps),
        queue: normalizeMiniGameCount(parsed.miniGameProgress?.queue),
        habitJudge: normalizeMiniGameCount(parsed.miniGameProgress?.habitJudge),
        readingCheckin: normalizeMiniGameCount(parsed.miniGameProgress?.readingCheckin),
        kindWords: normalizeMiniGameCount(parsed.miniGameProgress?.kindWords),
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

  return {
    ...archive,
    miniGameProgress: alreadyCompleted
      ? archive.miniGameProgress
      : {
          ...archive.miniGameProgress,
          [gameKey]: 1,
        },
    miniGameRecords: detail
      ? [
          {
            ...detail,
            gameKey,
            completedAt: new Date().toISOString(),
          },
          ...archive.miniGameRecords,
        ].slice(0, 32)
      : archive.miniGameRecords,
    lastUpdated: new Date().toISOString(),
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

  return {
    ...archive,
    badgeRecords: [
      {
        name: normalizedBadge,
        themeId,
        source,
        childId: child?.childId,
        childName: child?.childName,
        earnedAt: new Date().toISOString(),
      },
      ...archive.badgeRecords,
    ].slice(0, 40),
    lastUpdated: new Date().toISOString(),
  };
}

export function recordMealReview(
  archive: GrowthArchive,
  mealReview: MealReviewRecord,
): GrowthArchive {
  return {
    ...archive,
    mealReviews: [mealReview, ...archive.mealReviews].slice(0, 12),
    lastUpdated: new Date().toISOString(),
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

  return {
    ...archive,
    foodPreferenceRecords: [
      {
        ...preference,
        foodLabel: normalizedFood,
        reasonLabel: normalizedReason,
      },
      ...archive.foodPreferenceRecords,
    ].slice(0, 16),
    lastUpdated: new Date().toISOString(),
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
        rosterNumber:
          "rosterNumber" in item && typeof item.rosterNumber === "string"
            ? item.rosterNumber.trim().slice(0, 8)
            : undefined,
        createdAt: item.createdAt,
      }))
      .filter((item) => item.id.trim() && item.name)
      .slice(0, 60);
  } catch {
    return [];
  }
}
