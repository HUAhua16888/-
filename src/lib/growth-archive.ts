import type { ThemeId } from "@/lib/site-data";

export const growthArchiveStorageKey = "tongqu-growth-web-growth-archive";

export type MiniGameKey = "washSteps" | "queue" | "kindWords" | "mealTray";
export type BadgeSource = "story" | "meal-review" | "mini-game";

export type BadgeRecord = {
  name: string;
  themeId: ThemeId;
  earnedAt: string;
  source: BadgeSource;
};

export type MealReviewRecord = {
  reviewedAt: string;
  mode: "demo" | "ai";
  summary: string;
  guessedFoods: string[];
  stickers: string[];
  plateState: string;
  imageName: string;
};

export type MiniGameProgress = Record<MiniGameKey, number>;

export type GrowthArchive = {
  version: 1;
  badgeRecords: BadgeRecord[];
  mealReviews: MealReviewRecord[];
  miniGameProgress: MiniGameProgress;
  themeVisits: Record<ThemeId, number>;
  lastUpdated: string;
};

export function createEmptyGrowthArchive(): GrowthArchive {
  return {
    version: 1,
    badgeRecords: [],
    mealReviews: [],
    miniGameProgress: {
      washSteps: 0,
      queue: 0,
      kindWords: 0,
      mealTray: 0,
    },
    themeVisits: {
      habit: 0,
      food: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
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
      miniGameProgress: {
        washSteps:
          typeof parsed.miniGameProgress?.washSteps === "number"
            ? parsed.miniGameProgress.washSteps
            : 0,
        queue:
          typeof parsed.miniGameProgress?.queue === "number" ? parsed.miniGameProgress.queue : 0,
        kindWords:
          typeof parsed.miniGameProgress?.kindWords === "number"
            ? parsed.miniGameProgress.kindWords
            : 0,
        mealTray:
          typeof parsed.miniGameProgress?.mealTray === "number"
            ? parsed.miniGameProgress.mealTray
            : 0,
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
): GrowthArchive {
  return {
    ...archive,
    miniGameProgress: {
      ...archive.miniGameProgress,
      [gameKey]: archive.miniGameProgress[gameKey] + 1,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function recordBadge(
  archive: GrowthArchive,
  badge: string,
  themeId: ThemeId,
  source: BadgeSource,
): GrowthArchive {
  const normalizedBadge = badge.trim();

  if (!normalizedBadge) {
    return archive;
  }

  const exists = archive.badgeRecords.some(
    (item) => item.name === normalizedBadge && item.themeId === themeId,
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

export function countUniqueBadges(archive: GrowthArchive) {
  return new Set(archive.badgeRecords.map((item) => item.name)).size;
}

export function getMiniGameCompletionTotal(archive: GrowthArchive) {
  return Object.values(archive.miniGameProgress).reduce((sum, value) => sum + value, 0);
}
