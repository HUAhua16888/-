import { foodAssets } from "@/data/foodAssets";
import { foodIngredientMap } from "@/data/foodIngredientMap";
import { ingredientAssets } from "@/data/ingredientAssets";
import type { MenuMediaSource, WeeklyMenuEntry } from "@/lib/weekly-menu";

export type FoodImageSourceType =
  | "teacher_uploaded"
  | "video_frame"
  | "ai_generated_teacher_confirmed"
  | "local_food_asset"
  | "local_ingredient_asset"
  | "fallback_icon";

export type FoodImageScene =
  | "menuImage"
  | "menuObservationImage"
  | "observationFoodImage"
  | "kitchenDishImage"
  | "ingredientImage"
  | "reporterFoodImage";

export type FoodImageContext = {
  menuEntries?: WeeklyMenuEntry[];
  ingredients?: string[];
  allowPlaceholder?: boolean;
  scene?: FoodImageScene;
};

export type FoodImageResolution = {
  label: string;
  url: string;
  sourceType: FoodImageSourceType;
  sourceLabel: string;
  mediaSource?: MenuMediaSource;
  teacherConfirmed: boolean;
  aiGenerated: boolean;
  sourceUrl?: string;
  assetUrl?: string;
};

export type SafeFoodImageCandidate = {
  url: string;
  sourceType: FoodImageSourceType;
  sourceLabel: string;
  fallbackSource: string;
  teacherConfirmed: boolean;
  aiGenerated: boolean;
};

export type SafeFoodImageResolution = FoodImageResolution & {
  candidates: SafeFoodImageCandidate[];
  fallbackSource: string;
};

type FoodArtworkConfig = {
  label: string;
  aliases: string[];
  intro: string;
  ingredients: string[];
  bg: string;
  plate: string;
  main: string;
  accent: string;
  garnish: string;
  shape:
    | "pot"
    | "pancake"
    | "soup"
    | "roll"
    | "dessert"
    | "zongzi"
    | "jelly"
    | "fried"
    | "cake"
    | "claw"
    | "fishroll"
    | "rice"
    | "mushroom"
    | "stalk"
    | "garlic"
    | "pepper"
    | "carrot"
    | "eggplant"
    | "tofu"
    | "greens"
    | "egg"
    | "shell";
};

type FoodAsset = (typeof foodAssets)[number];
type IngredientAsset = (typeof ingredientAssets)[number];
type FoodIngredientMapEntry = {
  foodName: string;
  ingredientIds: readonly string[];
};

function toSafeSourceType(mediaSource?: MenuMediaSource): FoodImageSourceType {
  if (mediaSource === "teacher_uploaded") return "teacher_uploaded";
  if (mediaSource === "video_frame") return "video_frame";
  if (mediaSource === "ai_generated") return "ai_generated_teacher_confirmed";

  return "fallback_icon";
}

function toMenuMediaSource(sourceType?: FoodImageSourceType): MenuMediaSource | undefined {
  if (sourceType === "teacher_uploaded" || sourceType === "video_frame") return sourceType;
  if (sourceType === "ai_generated_teacher_confirmed") return "ai_generated";

  return undefined;
}

const foodAssetAliasPairs = [
  ["泉州海蛎煎", "石井海蛎煎"],
  ["海蛎煎", "石井海蛎煎"],
  ["蚵仔煎", "石井海蛎煎"],
  ["润饼菜", "润饼"],
  ["薄饼卷", "润饼"],
  ["闽南肉粽", "烧肉粽"],
  ["炸醋肉", "泉州醋肉"],
  ["醋肉", "泉州醋肉"],
  ["崇武鱼卷", "鱼卷"],
  ["鱼肉卷", "鱼卷"],
] as const;

const ingredientAssetAliasPairs = [
  ["葱", "小葱"],
  ["葱花", "小葱"],
  ["蒜", "大蒜"],
  ["蒜蓉", "大蒜"],
  ["姜", "生姜"],
  ["姜片", "生姜"],
  ["红萝卜", "胡萝卜"],
  ["青椒", "青辣椒"],
  ["辣椒", "青辣椒"],
  ["米饭", "大米"],
  ["米粒", "大米"],
  ["甜汤", "白糖"],
  ["米酒", "料酒/米酒"],
  ["米酒/麻油", "料酒/米酒"],
  ["麻油", "香油"],
  ["芝麻油", "香油"],
  ["鱼肉", "鱼肉浆"],
  ["鱼卷", "鱼肉浆"],
  ["蔬菜", "青菜"],
] as const;

const foodArtworkCatalog: FoodArtworkConfig[] = [
  {
    label: "香菇",
    aliases: ["香菇", "蘑菇", "菇"],
    intro: "圆圆小伞盖，闻起来有淡淡香味。",
    ingredients: ["香菇"],
    bg: "#fff7ed",
    plate: "#ffffff",
    main: "#92400e",
    accent: "#f5e1c8",
    garnish: "#78350f",
    shape: "mushroom",
  },
  {
    label: "小葱",
    aliases: ["小葱", "葱", "葱花"],
    intro: "细细绿绿，常撒在汤面上。",
    ingredients: ["小葱"],
    bg: "#f0fdf4",
    plate: "#ffffff",
    main: "#22c55e",
    accent: "#bbf7d0",
    garnish: "#166534",
    shape: "stalk",
  },
  {
    label: "蒜",
    aliases: ["蒜", "大蒜", "蒜蓉"],
    intro: "白白一瓣瓣，闻起来香香的。",
    ingredients: ["蒜"],
    bg: "#f8fafc",
    plate: "#ffffff",
    main: "#f8fafc",
    accent: "#cbd5e1",
    garnish: "#a3e635",
    shape: "garlic",
  },
  {
    label: "青椒",
    aliases: ["青椒", "甜椒"],
    intro: "绿色弯弯，有清清的味道。",
    ingredients: ["青椒"],
    bg: "#ecfdf5",
    plate: "#ffffff",
    main: "#16a34a",
    accent: "#86efac",
    garnish: "#166534",
    shape: "pepper",
  },
  {
    label: "胡萝卜",
    aliases: ["胡萝卜", "红萝卜"],
    intro: "橙橙长长，咬起来脆脆的。",
    ingredients: ["胡萝卜"],
    bg: "#fff7ed",
    plate: "#ffffff",
    main: "#fb923c",
    accent: "#fdba74",
    garnish: "#22c55e",
    shape: "carrot",
  },
  {
    label: "茄子",
    aliases: ["茄子"],
    intro: "紫紫长长，煮熟后软软的。",
    ingredients: ["茄子"],
    bg: "#faf5ff",
    plate: "#ffffff",
    main: "#7e22ce",
    accent: "#c084fc",
    garnish: "#22c55e",
    shape: "eggplant",
  },
  {
    label: "豆腐",
    aliases: ["豆腐"],
    intro: "白白方方，入口软软嫩嫩。",
    ingredients: ["豆腐"],
    bg: "#f8fafc",
    plate: "#ffffff",
    main: "#fff7ed",
    accent: "#fde68a",
    garnish: "#94a3b8",
    shape: "tofu",
  },
  {
    label: "青菜",
    aliases: ["青菜", "绿叶菜", "蔬菜"],
    intro: "绿绿叶子，颜色很清爽。",
    ingredients: ["青菜"],
    bg: "#f0fdf4",
    plate: "#ffffff",
    main: "#16a34a",
    accent: "#86efac",
    garnish: "#166534",
    shape: "greens",
  },
  {
    label: "芥菜",
    aliases: ["芥菜"],
    intro: "叶子宽宽，味道有一点特别。",
    ingredients: ["芥菜"],
    bg: "#f7fee7",
    plate: "#ffffff",
    main: "#65a30d",
    accent: "#bef264",
    garnish: "#3f6212",
    shape: "greens",
  },
  {
    label: "肉粒",
    aliases: ["肉粒", "瘦肉", "肉丁"],
    intro: "小小肉粒，藏在菜里补充能量。",
    ingredients: ["肉粒"],
    bg: "#fff1f2",
    plate: "#ffffff",
    main: "#b91c1c",
    accent: "#fecaca",
    garnish: "#f97316",
    shape: "fried",
  },
  {
    label: "鸡蛋",
    aliases: ["鸡蛋", "蛋"],
    intro: "圆圆鸡蛋，煮熟后软软香香。",
    ingredients: ["鸡蛋"],
    bg: "#fffbeb",
    plate: "#ffffff",
    main: "#fef3c7",
    accent: "#f59e0b",
    garnish: "#fff7ed",
    shape: "egg",
  },
  {
    label: "蛏子",
    aliases: ["蛏子", "海蛏"],
    intro: "细长小贝壳，来自海边。",
    ingredients: ["蛏子"],
    bg: "#ecfeff",
    plate: "#ffffff",
    main: "#d6d3d1",
    accent: "#0ea5e9",
    garnish: "#fbbf24",
    shape: "shell",
  },
  {
    label: "姜母鸭",
    aliases: ["姜母鸭", "鸭肉", "老姜鸭"],
    intro: "砂锅里有鸭肉和姜片，热热香香。",
    ingredients: ["鸭肉", "老姜", "汤汁"],
    bg: "#fff7ed",
    plate: "#78350f",
    main: "#7c2d12",
    accent: "#f59e0b",
    garnish: "#fde68a",
    shape: "pot",
  },
  {
    label: "泉州海蛎煎",
    aliases: ["泉州海蛎煎", "海蛎煎", "蚵仔煎"],
    intro: "金黄小饼里有海蛎、鸡蛋和小葱。",
    ingredients: ["海蛎", "鸡蛋", "地瓜粉", "小葱"],
    bg: "#fff7ed",
    plate: "#ffffff",
    main: "#f4b63f",
    accent: "#8b5e34",
    garnish: "#22c55e",
    shape: "pancake",
  },
  {
    label: "面线糊",
    aliases: ["面线糊", "面线", "早餐面线"],
    intro: "细细软软，热乎乎的一碗。",
    ingredients: ["面线", "热汤", "葱花"],
    bg: "#eff6ff",
    plate: "#ffffff",
    main: "#f6d7a7",
    accent: "#b45309",
    garnish: "#16a34a",
    shape: "soup",
  },
  {
    label: "润饼菜",
    aliases: ["润饼菜", "润饼", "薄饼卷"],
    intro: "薄饼皮卷起蔬菜，能看到好多颜色。",
    ingredients: ["薄饼皮", "蔬菜", "家常配料"],
    bg: "#f0fdf4",
    plate: "#ffffff",
    main: "#f5d0a9",
    accent: "#22c55e",
    garnish: "#f97316",
    shape: "roll",
  },
  {
    label: "石花膏",
    aliases: ["石花膏", "石花冻", "石花"],
    intro: "透明凉凉，会轻轻晃的小甜品。",
    ingredients: ["石花草", "清甜水", "小配料"],
    bg: "#ecfeff",
    plate: "#ffffff",
    main: "#cffafe",
    accent: "#38bdf8",
    garnish: "#f59e0b",
    shape: "dessert",
  },
  {
    label: "土笋冻",
    aliases: ["土笋冻", "笋冻"],
    intro: "透明弹弹，可以先看一看样子。",
    ingredients: ["海边食材", "小碟", "酱汁"],
    bg: "#f0f9ff",
    plate: "#ffffff",
    main: "#dbeafe",
    accent: "#94a3b8",
    garnish: "#16a34a",
    shape: "jelly",
  },
  {
    label: "烧肉粽",
    aliases: ["烧肉粽", "闽南肉粽", "肉粽", "粽子"],
    intro: "粽叶包着米粒和家常馅料。",
    ingredients: ["糯米", "粽叶", "香菇", "肉丁"],
    bg: "#f7fee7",
    plate: "#ffffff",
    main: "#86a33a",
    accent: "#92400e",
    garnish: "#facc15",
    shape: "zongzi",
  },
  {
    label: "炸醋肉",
    aliases: ["炸醋肉", "醋肉"],
    intro: "金黄金黄，外面酥酥香香。",
    ingredients: ["猪肉", "地瓜粉", "香醋"],
    bg: "#fffbeb",
    plate: "#ffffff",
    main: "#d97706",
    accent: "#92400e",
    garnish: "#facc15",
    shape: "fried",
  },
  {
    label: "芋头饼",
    aliases: ["芋头饼", "芋饼", "芋头"],
    intro: "圆圆小饼，里面有软软芋头。",
    ingredients: ["芋头", "糯米粉", "芝麻"],
    bg: "#faf5ff",
    plate: "#ffffff",
    main: "#c084fc",
    accent: "#7e22ce",
    garnish: "#f5d0fe",
    shape: "cake",
  },
  {
    label: "牛肉羹",
    aliases: ["牛肉羹", "牛肉汤羹", "牛肉"],
    intro: "热热一碗，牛肉软软滑滑。",
    ingredients: ["牛肉", "清汤", "香菜"],
    bg: "#fff7ed",
    plate: "#ffffff",
    main: "#92400e",
    accent: "#fbbf24",
    garnish: "#16a34a",
    shape: "soup",
  },
  {
    label: "洪濑鸡爪",
    aliases: ["洪濑鸡爪", "鸡爪", "卤鸡爪"],
    intro: "颜色深深，闻起来是卤香味。",
    ingredients: ["鸡爪", "卤汁", "香料"],
    bg: "#fef2f2",
    plate: "#ffffff",
    main: "#9f1239",
    accent: "#7f1d1d",
    garnish: "#f59e0b",
    shape: "claw",
  },
  {
    label: "崇武鱼卷",
    aliases: ["崇武鱼卷", "鱼卷"],
    intro: "白白圆圆，常切成小圆片。",
    ingredients: ["鱼肉", "清汤", "葱花"],
    bg: "#ecfeff",
    plate: "#ffffff",
    main: "#f8fafc",
    accent: "#0e7490",
    garnish: "#22d3ee",
    shape: "fishroll",
  },
  {
    label: "四果汤",
    aliases: ["四果汤", "四果", "甜汤"],
    intro: "清凉甜甜，里面有好多小配料。",
    ingredients: ["水果丁", "石花膏", "甜汤"],
    bg: "#fdf2f8",
    plate: "#ffffff",
    main: "#f9a8d4",
    accent: "#38bdf8",
    garnish: "#facc15",
    shape: "dessert",
  },
  {
    label: "咸饭",
    aliases: ["咸饭", "米饭", "闽南咸饭"],
    intro: "米粒香香，里面藏着小食材。",
    ingredients: ["米饭", "香菇", "青菜"],
    bg: "#fefce8",
    plate: "#ffffff",
    main: "#d6a64f",
    accent: "#92400e",
    garnish: "#22c55e",
    shape: "rice",
  },
];

function escapeSvg(value: string) {
  return value.replace(/[<>&"]/g, "");
}

function normalizeLabel(value: string) {
  return value.replace(/[。？！,.，、\s]/g, "").trim();
}

const foodAssetByName = new Map(
  foodAssets.map((food) => [normalizeLabel(food.name), food] as const),
);
const foodAssetById = new Map(
  foodAssets.map((food) => [normalizeLabel(food.id), food] as const),
);
const ingredientAssetByName = new Map(
  ingredientAssets.map((ingredient) => [normalizeLabel(ingredient.name), ingredient] as const),
);
const ingredientAssetByIdLabel = new Map(
  ingredientAssets.map((ingredient) => [normalizeLabel(ingredient.id), ingredient] as const),
);
const ingredientAssetById = new Map<string, IngredientAsset>(
  ingredientAssets.map((ingredient) => [ingredient.id, ingredient] as const),
);
const foodIngredientMapByFoodId = foodIngredientMap as unknown as Record<string, FoodIngredientMapEntry>;
const normalizedFoodAssetAliasPairs = foodAssetAliasPairs.map(([alias, target]) => [
  normalizeLabel(alias),
  normalizeLabel(target),
] as const);
const normalizedIngredientAssetAliasPairs = ingredientAssetAliasPairs.map(([alias, target]) => [
  normalizeLabel(alias),
  normalizeLabel(target),
] as const);

function findFoodAsset(value: string): FoodAsset | undefined {
  const cleanValue = normalizeLabel(value);

  if (!cleanValue) {
    return undefined;
  }

  const directMatch = foodAssetByName.get(cleanValue);

  if (directMatch) {
    return directMatch;
  }

  const idMatch = foodAssetById.get(cleanValue);

  if (idMatch) {
    return idMatch;
  }

  const foodAliasMatch = foodAssets.find((food) => {
    const aliases = "aliases" in food && Array.isArray(food.aliases) ? food.aliases : [];

    return aliases.some((alias) => {
      const normalizedAlias = normalizeLabel(alias);

      return (
        normalizedAlias &&
        (cleanValue === normalizedAlias || cleanValue.includes(normalizedAlias) || normalizedAlias.includes(cleanValue))
      );
    });
  });

  if (foodAliasMatch) {
    return foodAliasMatch;
  }

  const aliasMatch = normalizedFoodAssetAliasPairs.find(([alias]) =>
    cleanValue === alias || cleanValue.includes(alias) || alias.includes(cleanValue),
  );

  if (aliasMatch) {
    return foodAssetByName.get(aliasMatch[1]);
  }

  return foodAssets.find((food) => {
    const foodName = normalizeLabel(food.name);

    return foodName && (cleanValue.includes(foodName) || foodName.includes(cleanValue));
  });
}

function findIngredientAsset(value: string): IngredientAsset | undefined {
  const cleanValue = normalizeLabel(value);

  if (!cleanValue) {
    return undefined;
  }

  const directMatch = ingredientAssetByName.get(cleanValue);

  if (directMatch) {
    return directMatch;
  }

  const idMatch = ingredientAssetByIdLabel.get(cleanValue);

  if (idMatch) {
    return idMatch;
  }

  const aliasMatch = normalizedIngredientAssetAliasPairs.find(([alias]) =>
    cleanValue === alias || cleanValue.includes(alias) || alias.includes(cleanValue),
  );

  if (aliasMatch) {
    return ingredientAssetByName.get(aliasMatch[1]);
  }

  return ingredientAssets.find((ingredient) => {
    const ingredientName = normalizeLabel(ingredient.name);

    return ingredientName && (cleanValue.includes(ingredientName) || ingredientName.includes(cleanValue));
  });
}

export function getFoodAssetForLabel(value: string): FoodAsset | undefined {
  return findFoodAsset(value);
}

export function getIngredientAssetForLabel(value: string): IngredientAsset | undefined {
  return findIngredientAsset(value);
}

export function getFoodIngredientAssets(foodName: string): IngredientAsset[] {
  const asset = findFoodAsset(foodName);
  const mapEntry = asset ? foodIngredientMapByFoodId[asset.id] : undefined;

  if (mapEntry?.ingredientIds?.length) {
    return mapEntry.ingredientIds
      .map((id) => ingredientAssetById.get(id))
      .filter((ingredient): ingredient is IngredientAsset => Boolean(ingredient));
  }

  return ingredientAssets.filter((ingredient) =>
    ingredient.relatedFoods?.some((relatedFood) => {
      const cleanRelatedFood = normalizeLabel(relatedFood);
      const cleanFoodName = normalizeLabel(foodName);

      return cleanRelatedFood === cleanFoodName || cleanRelatedFood.includes(cleanFoodName) || cleanFoodName.includes(cleanRelatedFood);
    }),
  );
}

export function getFoodIngredientNames(foodName: string) {
  return getFoodIngredientAssets(foodName).map((ingredient) => ingredient.name);
}

export function normalizeFoodImageLabel(value: string) {
  const cleanValue = normalizeLabel(value);

  if (!cleanValue) {
    return "今日食物";
  }

  const matched = foodArtworkCatalog.find((item) =>
    item.aliases.some((alias) => cleanValue === alias || cleanValue.includes(alias) || alias.includes(cleanValue)),
  );

  return matched?.label ?? cleanValue;
}

function findFoodArtwork(value: string) {
  const normalized = normalizeFoodImageLabel(value);

  return foodArtworkCatalog.find((item) => item.label === normalized);
}

function renderFoodShape(config: FoodArtworkConfig) {
  const { main, accent, garnish } = config;

  if (config.shape === "mushroom") {
    return `
      <g>
        <ellipse cx="128" cy="114" rx="46" ry="31" fill="${main}"/>
        <ellipse cx="197" cy="120" rx="38" ry="27" fill="${main}" opacity="0.92"/>
        <rect x="113" y="118" width="30" height="54" rx="14" fill="${accent}"/>
        <rect x="185" y="122" width="25" height="48" rx="12" fill="${accent}"/>
        <g fill="${garnish}" opacity="0.65"><circle cx="113" cy="103" r="6"/><circle cx="143" cy="112" r="5"/><circle cx="198" cy="111" r="5"/></g>
      </g>`;
  }

  if (config.shape === "stalk") {
    return `
      <g stroke="${main}" stroke-width="13" stroke-linecap="round">
        <path d="M105 166c31-27 38-63 45-100"/>
        <path d="M146 169c9-38 12-75 9-108"/>
        <path d="M190 166c-16-31-22-65-18-101"/>
      </g>
      <g stroke="${accent}" stroke-width="7" stroke-linecap="round">
        <path d="M97 111c20 7 34 4 48-11"/>
        <path d="M159 103c22 7 39 2 55-13"/>
      </g>
      <ellipse cx="151" cy="174" rx="70" ry="13" fill="${garnish}" opacity="0.18"/>`;
  }

  if (config.shape === "garlic") {
    return `
      <g fill="${main}" stroke="${accent}" stroke-width="4">
        <path d="M114 158c-22-34 2-73 31-52 18-30 54-19 53 19 26-1 39 34 18 57-20 22-78 19-102-24Z"/>
        <path d="M151 97c0-16 14-28 28-36"/>
      </g>
      <g stroke="${accent}" stroke-width="4" stroke-linecap="round" opacity="0.72">
        <path d="M145 113c-12 22-11 43 2 62"/>
        <path d="M175 112c9 24 7 46-6 66"/>
      </g>
      <path d="M177 61c-7 11-1 22 10 27" stroke="${garnish}" stroke-width="7" stroke-linecap="round"/>`;
  }

  if (config.shape === "pepper") {
    return `
      <path d="M146 78c43-11 80 23 68 71-7 29-35 48-64 39-29-9-54-36-45-69 5-18 19-34 41-41Z" fill="${main}"/>
      <path d="M151 78c-4-15 7-26 23-30" stroke="${garnish}" stroke-width="9" stroke-linecap="round"/>
      <path d="M148 92c-10 30-6 62 17 88" stroke="${accent}" stroke-width="7" stroke-linecap="round" opacity="0.55"/>`;
  }

  if (config.shape === "carrot") {
    return `
      <path d="M130 76c52 10 77 30 85 84-45 19-82 8-105-40-11-22-2-40 20-44Z" fill="${main}"/>
      <g stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity="0.65">
        <path d="M134 101c18 5 37 4 55-2"/><path d="M149 129c15 3 31 2 46-3"/>
      </g>
      <g stroke="${garnish}" stroke-width="8" stroke-linecap="round"><path d="M128 76c-18-14-25-29-21-45"/><path d="M142 77c2-20 12-34 30-42"/></g>`;
  }

  if (config.shape === "eggplant") {
    return `
      <path d="M108 139c-3-52 45-82 91-56 36 21 35 73-3 94-36 20-85 4-88-38Z" fill="${main}"/>
      <path d="M124 91c-12-18-7-33 14-41" stroke="${garnish}" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="157" cy="124" rx="18" ry="43" fill="${accent}" opacity="0.28" transform="rotate(-28 157 124)"/>`;
  }

  if (config.shape === "tofu") {
    return `
      <g fill="${main}" stroke="${accent}" stroke-width="5">
        <rect x="92" y="108" width="58" height="48" rx="10"/>
        <rect x="151" y="89" width="64" height="54" rx="10"/>
        <rect x="168" y="139" width="58" height="45" rx="10"/>
      </g>
      <g fill="${garnish}" opacity="0.36"><circle cx="119" cy="131" r="5"/><circle cx="184" cy="114" r="5"/><circle cx="199" cy="161" r="5"/></g>`;
  }

  if (config.shape === "greens") {
    return `
      <g fill="${main}">
        <ellipse cx="121" cy="124" rx="28" ry="56" transform="rotate(-34 121 124)"/>
        <ellipse cx="160" cy="115" rx="31" ry="67"/>
        <ellipse cx="200" cy="126" rx="28" ry="56" transform="rotate(33 200 126)"/>
      </g>
      <g stroke="${accent}" stroke-width="6" stroke-linecap="round"><path d="M159 72v104"/><path d="M119 92c14 22 24 48 31 77"/><path d="M203 95c-17 25-29 52-35 79"/></g>`;
  }

  if (config.shape === "egg") {
    return `
      <g>
        <ellipse cx="139" cy="129" rx="38" ry="52" fill="${main}"/>
        <ellipse cx="194" cy="132" rx="34" ry="46" fill="#fff7ed"/>
        <circle cx="139" cy="136" r="18" fill="${accent}"/>
        <circle cx="194" cy="137" r="15" fill="${accent}" opacity="0.8"/>
      </g>`;
  }

  if (config.shape === "shell") {
    return `
      <g fill="${main}" stroke="${accent}" stroke-width="5">
        <ellipse cx="126" cy="132" rx="52" ry="22" transform="rotate(-13 126 132)"/>
        <ellipse cx="190" cy="126" rx="55" ry="21" transform="rotate(12 190 126)"/>
      </g>
      <g stroke="${garnish}" stroke-width="4" stroke-linecap="round" opacity="0.76">
        <path d="M86 133c24 4 52 0 79-14"/>
        <path d="M153 120c26 15 54 19 84 12"/>
      </g>`;
  }

  if (config.shape === "pot") {
    return `
      <path d="M70 84h180l-15 80c-3 18-19 31-38 31h-74c-19 0-35-13-38-31L70 84Z" fill="${main}"/>
      <ellipse cx="160" cy="84" rx="91" ry="25" fill="#78350f"/>
      <g fill="${garnish}">
        <ellipse cx="112" cy="109" rx="24" ry="8" transform="rotate(-24 112 109)"/>
        <ellipse cx="189" cy="113" rx="27" ry="8" transform="rotate(18 189 113)"/>
        <ellipse cx="151" cy="145" rx="25" ry="8" transform="rotate(-10 151 145)"/>
      </g>
      <g fill="#9a3412">
        <circle cx="129" cy="131" r="19"/>
        <circle cx="187" cy="136" r="21"/>
        <circle cx="162" cy="114" r="17"/>
      </g>`;
  }

  if (config.shape === "pancake") {
    return `
      <ellipse cx="160" cy="122" rx="88" ry="45" fill="${main}"/>
      <g fill="${accent}" opacity="0.82">
        <circle cx="120" cy="118" r="13"/><circle cx="170" cy="102" r="11"/><circle cx="201" cy="135" r="12"/>
      </g>
      <g stroke="${garnish}" stroke-width="7" stroke-linecap="round">
        <path d="M108 92c25 12 58 10 84 2"/><path d="M133 151c22-7 51-6 75 3"/>
      </g>`;
  }

  if (config.shape === "soup") {
    return `
      <ellipse cx="160" cy="142" rx="94" ry="42" fill="${main}"/>
      <path d="M75 126h170l-18 44c-6 15-20 25-37 25h-60c-17 0-31-10-37-25l-18-44Z" fill="#ffffff" opacity="0.95"/>
      <ellipse cx="160" cy="126" rx="88" ry="27" fill="${main}"/>
      <g stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity="0.8">
        <path d="M106 119c32-15 48 13 88-1"/><path d="M121 136c24-9 47 9 75-2"/>
      </g>
      <g fill="${garnish}"><circle cx="207" cy="113" r="7"/><circle cx="132" cy="132" r="5"/></g>`;
  }

  if (config.shape === "roll") {
    return `
      <rect x="93" y="82" width="134" height="83" rx="36" fill="${main}" transform="rotate(-9 160 123)"/>
      <rect x="111" y="73" width="84" height="100" rx="28" fill="#fff7ed" transform="rotate(-9 153 123)"/>
      <g stroke-width="9" stroke-linecap="round">
        <path d="M119 104c30 7 58 6 92-4" stroke="${garnish}"/>
        <path d="M125 126c29 8 58 8 86-4" stroke="${accent}"/>
        <path d="M137 145c22 5 44 5 65-3" stroke="#f97316"/>
      </g>`;
  }

  if (config.shape === "dessert") {
    return `
      <path d="M92 99h136l-18 73c-4 15-18 25-34 25h-32c-16 0-30-10-34-25L92 99Z" fill="#ffffff"/>
      <ellipse cx="160" cy="99" rx="68" ry="21" fill="${main}"/>
      <g fill="${accent}" opacity="0.72"><circle cx="130" cy="124" r="12"/><circle cx="171" cy="135" r="11"/><circle cx="198" cy="117" r="10"/></g>
      <g fill="${garnish}"><circle cx="145" cy="151" r="7"/><circle cx="187" cy="153" r="6"/></g>`;
  }

  if (config.shape === "zongzi") {
    return `
      <path d="M160 62 236 174H84L160 62Z" fill="${main}"/>
      <path d="M160 62 185 174H84L160 62Z" fill="#4d7c0f" opacity="0.72"/>
      <path d="M95 147c42-16 88-19 130 0" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="165" cy="139" r="12" fill="${garnish}"/>`;
  }

  if (config.shape === "jelly") {
    return `
      <g opacity="0.95">
        <ellipse cx="129" cy="127" rx="32" ry="26" fill="${main}"/><ellipse cx="180" cy="122" rx="37" ry="28" fill="${main}"/>
        <ellipse cx="164" cy="154" rx="49" ry="24" fill="${main}"/>
      </g>
      <g stroke="${accent}" stroke-width="4" opacity="0.5"><path d="M115 114c23 15 46 14 70 0"/><path d="M132 151c20 8 42 8 64-2"/></g>
      <circle cx="209" cy="149" r="7" fill="${garnish}"/>`;
  }

  if (config.shape === "fried") {
    return `
      <g fill="${main}">
        <rect x="92" y="112" width="54" height="34" rx="17" transform="rotate(-17 119 129)"/>
        <rect x="139" y="92" width="58" height="36" rx="18" transform="rotate(10 168 110)"/>
        <rect x="177" y="132" width="56" height="33" rx="16" transform="rotate(-8 205 148)"/>
      </g>
      <g stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity="0.55">
        <path d="M105 128h31"/><path d="M151 110h35"/><path d="M188 148h32"/>
      </g>
      <g fill="${garnish}"><circle cx="131" cy="151" r="6"/><circle cx="211" cy="110" r="7"/></g>`;
  }

  if (config.shape === "cake") {
    return `
      <ellipse cx="160" cy="125" rx="76" ry="42" fill="${main}"/>
      <ellipse cx="160" cy="112" rx="67" ry="28" fill="#e9d5ff"/>
      <path d="M112 122c28 18 67 18 97 1" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
      <g fill="${garnish}"><circle cx="133" cy="101" r="5"/><circle cx="161" cy="94" r="5"/><circle cx="190" cy="103" r="5"/></g>`;
  }

  if (config.shape === "claw") {
    return `
      <g fill="${main}">
        <path d="M101 138c17-37 42-39 57-12 15-28 42-24 53 12 6 20-10 41-34 43h-39c-24-2-43-23-37-43Z"/>
        <ellipse cx="112" cy="105" rx="14" ry="30" transform="rotate(-28 112 105)"/>
        <ellipse cx="154" cy="91" rx="14" ry="31"/>
        <ellipse cx="196" cy="105" rx="14" ry="30" transform="rotate(28 196 105)"/>
      </g>
      <g fill="${accent}"><circle cx="125" cy="147" r="7"/><circle cx="158" cy="151" r="7"/><circle cx="191" cy="147" r="7"/></g>`;
  }

  if (config.shape === "fishroll") {
    return `
      <g fill="${main}" stroke="${accent}" stroke-width="5">
        <ellipse cx="119" cy="128" rx="28" ry="33"/><ellipse cx="160" cy="126" rx="30" ry="36"/><ellipse cx="203" cy="128" rx="28" ry="33"/>
      </g>
      <g fill="#e0f2fe"><circle cx="119" cy="128" r="13"/><circle cx="160" cy="126" r="14"/><circle cx="203" cy="128" r="13"/></g>
      <path d="M91 164c43 11 95 13 142 0" stroke="${garnish}" stroke-width="8" stroke-linecap="round"/>`;
  }

  return `
    <ellipse cx="160" cy="133" rx="91" ry="46" fill="${main}"/>
    <g fill="${accent}" opacity="0.76"><circle cx="119" cy="119" r="10"/><circle cx="162" cy="105" r="10"/><circle cx="202" cy="134" r="11"/></g>
    <g fill="${garnish}" opacity="0.88"><circle cx="135" cy="151" r="7"/><circle cx="184" cy="155" r="7"/></g>`;
}

function makeDishSvgDataUrl(config: FoodArtworkConfig) {
  const label = escapeSvg(config.label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="${label}菜品图">
      <rect width="320" height="220" rx="28" fill="${config.bg}"/>
      <ellipse cx="160" cy="136" rx="112" ry="60" fill="${config.plate}" opacity="0.96"/>
      ${renderFoodShape(config)}
      <path d="M68 190c34 13 150 13 184 0" stroke="#0f172a" stroke-opacity="0.08" stroke-width="12" stroke-linecap="round"/>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function makeIconCardSvgDataUrl(label: string, icon = "🍽️") {
  const cleanLabel = escapeSvg(label || "今日食物");
  const cleanIcon = escapeSvg(icon);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="${cleanLabel}图卡">
      <rect width="320" height="220" rx="28" fill="#fff7ed"/>
      <circle cx="160" cy="94" r="48" fill="#fed7aa"/>
      <text x="160" y="112" text-anchor="middle" font-size="54">${cleanIcon}</text>
      <rect x="54" y="152" width="212" height="36" rx="18" fill="#ffffff" opacity="0.92"/>
      <text x="160" y="176" text-anchor="middle" font-size="20" font-weight="700" fill="#9a3412">${cleanLabel.slice(0, 8)}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getFoodPhotoAssetUrl(asset: FoodAsset) {
  if (!asset.image.startsWith("/assets/foods/single/") || !asset.image.endsWith(".png")) {
    return "";
  }

  return asset.image.replace("/assets/foods/single/", "/assets/foods/photos/");
}

function getFoodAssetSourceLabel(asset: FoodAsset, label: string, kind: "image" | "photo" = "image") {
  const sourceName = kind === "photo" ? "AI生成/整理菜品照片" : "AI生成/整理菜品图";

  return asset.name === label ? `${sourceName}，教师审核后使用` : `${sourceName}：${asset.name}，教师审核后使用`;
}

function getIngredientAssetSourceLabel(ingredient: IngredientAsset, label: string) {
  return ingredient.name === label
    ? "AI生成/整理食材图，教师审核后使用"
    : `AI生成/整理食材图：${ingredient.name}，教师审核后使用`;
}

function uniqueImageCandidates(candidates: SafeFoodImageCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    if (!candidate.url || seen.has(candidate.url)) {
      return false;
    }

    seen.add(candidate.url);
    return true;
  });
}

function getFoodImagePriority(scene?: FoodImageScene) {
  if (scene === "menuImage" || scene === "menuObservationImage") {
    return [
      "teacher_uploaded",
      "video_frame",
      "ai_generated_teacher_confirmed",
      "local_food_asset",
      "local_ingredient_asset",
      "fallback_icon",
    ] satisfies FoodImageSourceType[];
  }

  if (scene === "ingredientImage") {
    return [
      "local_ingredient_asset",
      "local_food_asset",
      "teacher_uploaded",
      "video_frame",
      "ai_generated_teacher_confirmed",
      "fallback_icon",
    ] satisfies FoodImageSourceType[];
  }

  return [
    "local_food_asset",
    "teacher_uploaded",
    "video_frame",
    "ai_generated_teacher_confirmed",
    "local_ingredient_asset",
    "fallback_icon",
  ] satisfies FoodImageSourceType[];
}

function orderImageCandidatesByScene(candidates: SafeFoodImageCandidate[], scene?: FoodImageScene) {
  const priority = getFoodImagePriority(scene);

  return [...candidates].sort((left, right) => {
    const leftIndex = priority.indexOf(left.sourceType);
    const rightIndex = priority.indexOf(right.sourceType);

    return (leftIndex === -1 ? priority.length : leftIndex) - (rightIndex === -1 ? priority.length : rightIndex);
  });
}

export function getFoodDishShortIntro(label: string, ingredients: string[] = []) {
  const artwork = findFoodArtwork(label);

  if (artwork) {
    return artwork.intro;
  }

  const asset = findFoodAsset(label);

  if (asset) {
    return `${asset.category}，先看清楚颜色和形状。`;
  }

  const ingredientAsset = findIngredientAsset(label);

  if (ingredientAsset) {
    return `${ingredientAsset.category}，先看清楚颜色和样子。`;
  }

  const ingredientPreview = ingredients.slice(0, 2).join("、");

  return ingredientPreview ? `可以先看${ingredientPreview}。` : "先看颜色和形状。";
}

export function getFoodDishImageDataUrl(label: string) {
  const asset = findFoodAsset(label);

  if (asset) {
    return asset.image;
  }

  const ingredientAsset = findIngredientAsset(label);

  if (ingredientAsset) {
    return ingredientAsset.image;
  }

  const artwork =
    findFoodArtwork(label) ??
    ({
      label: normalizeFoodImageLabel(label),
      aliases: [],
      intro: "先看颜色和形状。",
      ingredients: [],
      bg: "#f8fafc",
      plate: "#ffffff",
      main: "#bae6fd",
      accent: "#0891b2",
      garnish: "#bbf7d0",
      shape: "rice",
    } satisfies FoodArtworkConfig);

  return makeDishSvgDataUrl(artwork);
}

export function resolveSafeFoodImage(foodName: string, context: FoodImageContext = {}): SafeFoodImageResolution {
  const label = normalizeFoodImageLabel(foodName);
  const matchedEntry = findMatchedMenuEntry(foodName || label, context.menuEntries ?? []);
  const confirmedImages = getConfirmedImagesByPriority(matchedEntry);
  const candidates: SafeFoodImageCandidate[] = [];

  confirmedImages.forEach((image) => {
    candidates.push({
      url: image.url,
      sourceType: toSafeSourceType(image.mediaSource),
      sourceLabel: getMenuSourceLabel(image.mediaSource),
      fallbackSource: getMenuSourceLabel(image.mediaSource) || "教师确认图",
      teacherConfirmed: true,
      aiGenerated: image.mediaSource === "ai_generated",
    });
  });

  const coverMediaSource =
    matchedEntry?.mediaSource ?? confirmedImages.find((image) => image.url === matchedEntry?.coverImageUrl)?.mediaSource;

  if (matchedEntry?.teacherConfirmed && matchedEntry.coverImageUrl) {
    candidates.push({
      url: matchedEntry.coverImageUrl,
      sourceType: toSafeSourceType(coverMediaSource ?? "teacher_uploaded"),
      sourceLabel: getMenuSourceLabel(coverMediaSource) || "老师确认图片",
      fallbackSource: getMenuSourceLabel(coverMediaSource) || "教师确认图片",
      teacherConfirmed: true,
      aiGenerated: coverMediaSource === "ai_generated",
    });
  }

  const asset = findFoodAsset(foodName || label);

  if (asset) {
    const assetSourceLabel = getFoodAssetSourceLabel(asset, label);

    candidates.push({
      url: asset.image,
      sourceType: "local_food_asset",
      sourceLabel: assetSourceLabel,
      fallbackSource: assetSourceLabel,
      teacherConfirmed: true,
      aiGenerated: true,
    });

    const photoUrl = getFoodPhotoAssetUrl(asset);

    if (photoUrl) {
      const photoSourceLabel = getFoodAssetSourceLabel(asset, label, "photo");

      candidates.push({
        url: photoUrl,
        sourceType: "local_food_asset",
        sourceLabel: photoSourceLabel,
        fallbackSource: photoSourceLabel,
        teacherConfirmed: true,
        aiGenerated: true,
      });
    }
  }

  const directIngredientAsset = findIngredientAsset(foodName || label);
  const mappedIngredientAssets = getFoodIngredientAssets(foodName || label);

  [directIngredientAsset, ...mappedIngredientAssets].forEach((ingredient) => {
    if (!ingredient) {
      return;
    }

    candidates.push({
      url: ingredient.image,
      sourceType: "local_ingredient_asset",
      sourceLabel: getIngredientAssetSourceLabel(ingredient, label),
      fallbackSource: getIngredientAssetSourceLabel(ingredient, label),
      teacherConfirmed: true,
      aiGenerated: true,
    });
  });

  const artwork = findFoodArtwork(label);

  if (artwork) {
    candidates.push({
      url: makeDishSvgDataUrl(artwork),
      sourceType: "fallback_icon",
      sourceLabel: "菜品专属小图标",
      fallbackSource: "菜品专属小图标",
      teacherConfirmed: true,
      aiGenerated: false,
    });
  }

  candidates.push({
    url: makeIconCardSvgDataUrl(label),
    sourceType: "fallback_icon",
    sourceLabel: "菜品专属图卡",
    fallbackSource: "菜品专属图卡",
    teacherConfirmed: true,
    aiGenerated: false,
  });

  const imageCandidates = uniqueImageCandidates(orderImageCandidatesByScene(candidates, context.scene));
  const primaryCandidate = imageCandidates[0];

  return {
    label: asset?.name ?? directIngredientAsset?.name ?? artwork?.label ?? label,
    url: primaryCandidate?.url ?? "",
    sourceType: primaryCandidate?.sourceType ?? "fallback_icon",
    sourceLabel: primaryCandidate?.sourceLabel ?? "菜品专属图卡",
    fallbackSource: primaryCandidate?.fallbackSource ?? "菜品专属图卡",
    mediaSource: toMenuMediaSource(primaryCandidate?.sourceType),
    teacherConfirmed: primaryCandidate?.teacherConfirmed ?? true,
    aiGenerated: primaryCandidate?.aiGenerated ?? false,
    sourceUrl: primaryCandidate?.url,
    assetUrl: primaryCandidate?.url,
    candidates: imageCandidates,
  };
}

function getConfirmedImagesByPriority(entry?: WeeklyMenuEntry) {
  const confirmedImages = (entry?.observationImages ?? []).filter((image) => image.teacherConfirmed && image.url);
  const priority: MenuMediaSource[] = ["teacher_uploaded", "video_frame", "ai_generated"];

  return priority
    .flatMap((source) => confirmedImages.filter((image) => image.mediaSource === source))
    .concat(confirmedImages.filter((image) => !priority.includes(image.mediaSource)));
}

function entryMatchesFood(entry: WeeklyMenuEntry, foodName: string) {
  const cleanFoodName = normalizeLabel(foodName);
  const candidates = [entry.dishName, ...entry.focusIngredients, ...entry.ingredients]
    .map(normalizeLabel)
    .filter(Boolean);

  return candidates.some((item) => item === cleanFoodName || item.includes(cleanFoodName) || cleanFoodName.includes(item));
}

function findMatchedMenuEntry(foodName: string, entries: WeeklyMenuEntry[]) {
  if (!entries.length) {
    return undefined;
  }

  return entries.find((entry) => entryMatchesFood(entry, foodName));
}

function getMenuSourceLabel(source?: MenuMediaSource) {
  if (source === "teacher_uploaded") return "老师确认图片";
  if (source === "video_frame") return "今天视频里的图";
  if (source === "ai_generated") return "AI生成，教师确认后使用";

  return "";
}

export function resolveFoodImage(foodName: string, context: FoodImageContext = {}): FoodImageResolution {
  const label = normalizeFoodImageLabel(foodName);
  const matchedEntry = findMatchedMenuEntry(foodName || label, context.menuEntries ?? []);
  const confirmedImages = getConfirmedImagesByPriority(matchedEntry);
  const confirmedImage = confirmedImages[0];
  const coverMediaSource =
    matchedEntry?.mediaSource ?? confirmedImages.find((image) => image.url === matchedEntry?.coverImageUrl)?.mediaSource;

  if (confirmedImage) {
      return {
        label,
        url: confirmedImage.url,
        sourceType: toSafeSourceType(confirmedImage.mediaSource),
        sourceLabel: getMenuSourceLabel(confirmedImage.mediaSource),
        mediaSource: confirmedImage.mediaSource,
        teacherConfirmed: true,
      aiGenerated: confirmedImage.mediaSource === "ai_generated",
    };
  }

  if (matchedEntry?.teacherConfirmed && matchedEntry.coverImageUrl) {
      return {
        label,
        url: matchedEntry.coverImageUrl,
        sourceType: toSafeSourceType(coverMediaSource ?? "teacher_uploaded"),
        sourceLabel: getMenuSourceLabel(coverMediaSource) || "老师确认图片",
        mediaSource: coverMediaSource,
        teacherConfirmed: true,
      aiGenerated: coverMediaSource === "ai_generated",
    };
  }

  const asset = findFoodAsset(foodName || label);

  if (asset) {
      const assetSourceLabel = getFoodAssetSourceLabel(asset, label);

      return {
        label: asset.name,
        url: asset.image,
      sourceType: "local_food_asset",
      sourceLabel: assetSourceLabel,
      teacherConfirmed: true,
      aiGenerated: true,
      sourceUrl: asset.image,
      assetUrl: asset.image,
    };
  }

  const ingredientAsset = findIngredientAsset(foodName || label);

  if (ingredientAsset) {
      const ingredientSourceLabel = getIngredientAssetSourceLabel(ingredientAsset, label);

      return {
        label: ingredientAsset.name,
        url: ingredientAsset.image,
      sourceType: "local_ingredient_asset",
      sourceLabel: ingredientSourceLabel,
      teacherConfirmed: true,
      aiGenerated: true,
      sourceUrl: ingredientAsset.image,
      assetUrl: ingredientAsset.image,
    };
  }

  const artwork = findFoodArtwork(label);

  if (artwork) {
      return {
        label: artwork.label,
        url: makeDishSvgDataUrl(artwork),
      sourceType: "fallback_icon",
      sourceLabel: "本地菜品图",
      teacherConfirmed: true,
      aiGenerated: false,
      assetUrl: `food-image-catalog:${artwork.label}`,
    };
  }

  return {
    label,
    url: context.allowPlaceholder === false ? "" : getFoodDishImageDataUrl(label),
    sourceType: "fallback_icon",
    sourceLabel: "临时图卡",
    teacherConfirmed: false,
    aiGenerated: false,
  };
}

export function listFoodImageCatalogLabels() {
  return Array.from(
    new Set([
      ...foodAssets.map((food) => food.name),
      ...ingredientAssets.map((ingredient) => ingredient.name),
      ...foodArtworkCatalog.map((item) => item.label),
    ]),
  );
}
