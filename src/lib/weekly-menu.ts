import { buildFoodNutritionIntro, buildIngredientNutritionIntro } from "@/lib/food-nutrition";

export const weeklyMenuStorageKey = "tongqu-growth-web-weekly-menu";

export const mealTypeOptions = ["早餐", "午餐", "点心"] as const;

export type MealType = (typeof mealTypeOptions)[number];

export type WeeklyMenuEntry = {
  id: string;
  date: string;
  mealType: MealType;
  dishName: string;
  ingredients: string[];
  focusIngredients: string[];
  createdAt: string;
  publishedAt?: string;
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

export function splitMenuText(value: string) {
  return value
    .split(/[、,，;；\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
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
      .map((item) => ({
        ...item,
        dishName: item.dishName.trim(),
        ingredients: item.ingredients.filter((value): value is string => typeof value === "string").slice(0, 12),
        focusIngredients: item.focusIngredients
          .filter((value): value is string => typeof value === "string")
          .slice(0, 8),
        publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : undefined,
      }))
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

export function serializeWeeklyMenuEntries(entries: WeeklyMenuEntry[]) {
  return JSON.stringify(entries.slice(0, 80));
}

export function getPublishedMenuForDate(entries: WeeklyMenuEntry[], dateKey = getLocalDateKey()) {
  return entries.filter((item) => item.date === dateKey && item.publishedAt);
}

export function buildTodayMenuSpeech(entries: WeeklyMenuEntry[]) {
  if (entries.length === 0) {
    return "今天老师还没有发布闽食播报。可以先从美食认识观察卡开始。";
  }

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

  return `今天我们会遇见${entries.map((item) => item.dishName).join("、")}。${dishText}。可以先看一看、闻一闻，不着急入口。`;
}
