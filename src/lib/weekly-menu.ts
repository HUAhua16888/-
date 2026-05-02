import { buildFoodNutritionIntro, buildIngredientNutritionIntro } from "@/lib/food-nutrition";

export const weeklyMenuStorageKey = "tongqu-growth-web-weekly-menu";
export const dailyMenuOverrideStorageKey = "tongqu-growth-web-daily-menu-override";

export const mealTypeOptions = ["早餐", "午餐", "点心", "晚餐"] as const;

export type MealType = (typeof mealTypeOptions)[number];

export type MenuMediaSource = "video_frame" | "ai_generated" | "teacher_uploaded";
export type MenuImageSourceType =
  | "teacher_uploaded"
  | "video_frame"
  | "ai_generated_teacher_confirmed"
  | "local_food_asset"
  | "local_ingredient_asset"
  | "fallback_icon";

export type MenuObservationImage = {
  id: string;
  url: string;
  label: string;
  mediaSource: MenuMediaSource;
  sourceType: MenuImageSourceType;
  teacherConfirmed: boolean;
  createdAt: string;
  sourceVideoName?: string;
  aiPrompt?: string;
};

export type WeeklyMenuEntry = {
  id: string;
  date: string;
  mealType: MealType;
  dishName: string;
  ingredients: string[];
  focusIngredients: string[];
  videoUrl?: string;
  coverImageUrl?: string;
  observationImages?: MenuObservationImage[];
  mediaSource?: MenuMediaSource;
  teacherConfirmed?: boolean;
  createdAt: string;
  publishedAt?: string;
};

export type DailyMenuOverrideEntry = WeeklyMenuEntry & {
  overrideId: string;
  updatedAt: string;
  source: "dailyOverride";
};

export type EffectiveMenuEntry = WeeklyMenuEntry & {
  publishSource: "weeklyMenu" | "dailyOverride";
  sourceLabel: "每周食谱自动发布" | "临时改餐";
  weekdayLabel: string;
  displayDate: string;
};

function isMealType(value: string): value is MealType {
  return mealTypeOptions.some((item) => item === value);
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMenuDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${year}/${month}/${day}`;
}

export function getWeekdayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "星期";
  }

  return date.toLocaleDateString("zh-CN", { weekday: "long" });
}

export function splitMenuText(value: string) {
  return value
    .split(/[、,，;；\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function isMenuMediaSource(value: unknown): value is MenuMediaSource {
  return value === "video_frame" || value === "ai_generated" || value === "teacher_uploaded";
}

function getMenuImageSourceType(source: MenuMediaSource): MenuImageSourceType {
  if (source === "ai_generated") return "ai_generated_teacher_confirmed";

  return source;
}

function parseObservationImages(value: unknown) {
  const source = Array.isArray(value) ? value : [];

  return source
    .map((item): MenuObservationImage | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Partial<MenuObservationImage>;
      const id = cleanText(record.id, 80);
      const url = typeof record.url === "string" && record.url.startsWith("data:image/")
        ? record.url.slice(0, 500_000)
        : cleanText(record.url, 500_000);
      const mediaSource = isMenuMediaSource(record.mediaSource) ? record.mediaSource : "teacher_uploaded";
      const createdAt = cleanText(record.createdAt, 40) || new Date().toISOString();

      if (!id || !url) {
        return null;
      }

      return {
        id,
        url,
        label: cleanText(record.label, 40) || "观察图片",
        mediaSource,
        sourceType: getMenuImageSourceType(mediaSource),
        teacherConfirmed: record.teacherConfirmed === true,
        createdAt,
        sourceVideoName: cleanText(record.sourceVideoName, 120) || undefined,
        aiPrompt: cleanText(record.aiPrompt, 400) || undefined,
      };
    })
    .filter((item): item is MenuObservationImage => Boolean(item))
    .slice(0, 6);
}

function normalizeMenuMediaFields<T extends WeeklyMenuEntry>(item: T): T {
  const observationImages = parseObservationImages(item.observationImages);
  const coverImageUrl =
    typeof item.coverImageUrl === "string" && item.coverImageUrl.startsWith("data:image/")
      ? item.coverImageUrl.slice(0, 500_000)
      : cleanText(item.coverImageUrl, 500_000) || observationImages[0]?.url;
  const mediaSource =
    isMenuMediaSource(item.mediaSource)
      ? item.mediaSource
      : observationImages.find((image) => image.url === coverImageUrl)?.mediaSource;

  return {
    ...item,
    videoUrl: cleanText(item.videoUrl, 240) || undefined,
    coverImageUrl: coverImageUrl || undefined,
    observationImages,
    mediaSource,
    teacherConfirmed: item.teacherConfirmed === true && observationImages.length > 0,
  } as T;
}

export function parseWeeklyMenuEntries(raw: string | null): WeeklyMenuEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is WeeklyMenuEntry => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const record = item as Partial<WeeklyMenuEntry>;

        return Boolean(
          typeof record.id === "string" &&
            typeof record.date === "string" &&
            typeof record.mealType === "string" &&
            isMealType(record.mealType) &&
            typeof record.dishName === "string" &&
            Array.isArray(record.ingredients) &&
            Array.isArray(record.focusIngredients) &&
            typeof record.createdAt === "string",
        );
      })
      .map((item) =>
        normalizeMenuMediaFields({
          ...item,
          dishName: item.dishName.trim(),
          ingredients: item.ingredients.filter((value): value is string => typeof value === "string").slice(0, 12),
          focusIngredients: item.focusIngredients
            .filter((value): value is string => typeof value === "string")
            .slice(0, 8),
          publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : undefined,
        }),
      )
      .filter((item) => item.dishName)
      .sort((left, right) => {
        if (left.date !== right.date) {
          return right.date.localeCompare(left.date);
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 80);
  } catch {
    return [];
  }
}

export function parseDailyMenuOverrides(raw: string | null): DailyMenuOverrideEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is DailyMenuOverrideEntry => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const record = item as Partial<DailyMenuOverrideEntry>;

        return Boolean(
          typeof record.id === "string" &&
            typeof record.overrideId === "string" &&
            typeof record.date === "string" &&
            typeof record.mealType === "string" &&
            isMealType(record.mealType) &&
            typeof record.dishName === "string" &&
            Array.isArray(record.ingredients) &&
            Array.isArray(record.focusIngredients) &&
            typeof record.createdAt === "string" &&
            typeof record.updatedAt === "string" &&
            record.source === "dailyOverride",
        );
      })
      .map((item) =>
        normalizeMenuMediaFields({
          ...item,
          dishName: item.dishName.trim(),
          ingredients: item.ingredients.filter((value): value is string => typeof value === "string").slice(0, 12),
          focusIngredients: item.focusIngredients
            .filter((value): value is string => typeof value === "string")
            .slice(0, 8),
          publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : item.updatedAt,
        }),
      )
      .filter((item) => item.dishName)
      .sort((left, right) => {
        if (left.date !== right.date) {
          return right.date.localeCompare(left.date);
        }

        return mealTypeOptions.indexOf(left.mealType) - mealTypeOptions.indexOf(right.mealType);
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function serializeWeeklyMenuEntries(entries: WeeklyMenuEntry[]) {
  return JSON.stringify(entries.slice(0, 80));
}

export function serializeDailyMenuOverrides(entries: DailyMenuOverrideEntry[]) {
  return JSON.stringify(entries.slice(0, 40));
}

export function getPublishedMenuForDate(entries: WeeklyMenuEntry[], dateKey = getLocalDateKey()) {
  return entries.filter((item) => item.date === dateKey);
}

function decorateEffectiveMenuEntry(
  entry: WeeklyMenuEntry,
  publishSource: EffectiveMenuEntry["publishSource"],
): EffectiveMenuEntry {
  return {
    ...entry,
    publishSource,
    sourceLabel: publishSource === "dailyOverride" ? "临时改餐" : "每周食谱自动发布",
    weekdayLabel: getWeekdayLabel(entry.date),
    displayDate: formatMenuDate(entry.date),
  };
}

export function getEffectiveMenuForDate(
  weeklyEntries: WeeklyMenuEntry[],
  dailyOverrides: DailyMenuOverrideEntry[] = [],
  dateKey = getLocalDateKey(),
) {
  const overridesForDate = dailyOverrides.filter((item) => item.date === dateKey);
  const overrideMealTypes = new Set(overridesForDate.map((item) => item.mealType));
  const weeklyForDate = weeklyEntries.filter(
    (item) => item.date === dateKey && !overrideMealTypes.has(item.mealType),
  );

  return [...overridesForDate.map((entry) => decorateEffectiveMenuEntry(entry, "dailyOverride")),
    ...weeklyForDate.map((entry) => decorateEffectiveMenuEntry(entry, "weeklyMenu"))]
    .sort((left, right) => mealTypeOptions.indexOf(left.mealType) - mealTypeOptions.indexOf(right.mealType));
}

export function buildTodayMenuSpeech(entries: WeeklyMenuEntry[]) {
  if (entries.length === 0) {
    return "今天老师还没有发布闽食播报。可以先从美食认识观察卡开始。";
  }

  const dateText = `${formatMenuDate(entries[0].date)} ${getWeekdayLabel(entries[0].date)}`;
  const dishText = entries
    .map((item) => {
      const ingredientText = item.ingredients.length > 0 ? `里面有${item.ingredients.join("、")}` : "里面有家常食材";
      const nutritionText =
        item.focusIngredients.length > 0
          ? `营养小发现：${item.focusIngredients
              .slice(0, 3)
              .map((ingredient) => buildIngredientNutritionIntro(ingredient))
              .join("")}`
          : buildFoodNutritionIntro(item.dishName, item.ingredients);
      const focusText =
        item.focusIngredients.length > 0
          ? `今天可以重点认识${item.focusIngredients.join("、")}`
          : "可以先观察颜色、形状和气味";

      return `${item.mealType}会遇见${item.dishName}，${ingredientText}。${nutritionText}${focusText}`;
    })
    .join("。");

  return `今天 ${dateText}，我们会遇见${entries.map((item) => item.dishName).join("、")}。${dishText}。可以先看一看、闻一闻，不着急入口。`;
}
