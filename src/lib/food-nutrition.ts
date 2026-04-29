type FoodNutritionProfile = {
  label: string;
  aliases: string[];
  nutrition: string;
  observeHint: string;
};

const foodNutritionProfiles: FoodNutritionProfile[] = [
  {
    label: "海蛎",
    aliases: ["蚝", "牡蛎"],
    nutrition: "有蛋白质和锌，能帮助身体长力气、支持生长",
    observeHint: "先看小小海味形状，再闻一闻鲜味",
  },
  {
    label: "紫菜",
    aliases: ["海苔"],
    nutrition: "含有碘和矿物质，是来自海里的深色食材",
    observeHint: "找一找深紫色或黑绿色的薄薄叶片",
  },
  {
    label: "芥菜",
    aliases: ["青菜", "绿叶菜", "包菜", "白菜", "菠菜", "生菜"],
    nutrition: "有膳食纤维和维生素，能帮助肚子舒服、支持身体防护",
    observeHint: "看绿色叶子和叶脉，熟了会变软",
  },
  {
    label: "蛏子",
    aliases: ["蛏", "贝肉", "贝类"],
    nutrition: "有蛋白质和铁，是海边贝类给身体的小能量",
    observeHint: "先看贝肉形状，再闻一闻海边鲜味",
  },
  {
    label: "香菇",
    aliases: ["蘑菇", "菌菇", "菇"],
    nutrition: "有膳食纤维和多糖，能给饭菜带来香味，也帮助肚子工作",
    observeHint: "找棕色小伞和菇盖纹路",
  },
  {
    label: "小葱",
    aliases: ["葱", "葱花"],
    nutrition: "有清香味和少量维生素，常给汤和面线糊增加香气",
    observeHint: "找绿色小圈圈，先用勺子拨一拨",
  },
  {
    label: "蒜",
    aliases: ["大蒜", "蒜蓉", "蒜香"],
    nutrition: "有特别气味和植物营养，可以帮助菜变香",
    observeHint: "先远远闻一闻，说出白色小瓣的名字",
  },
  {
    label: "胡萝卜",
    aliases: ["红萝卜"],
    nutrition: "有胡萝卜素，对眼睛和身体防护有帮助",
    observeHint: "找橙色长长的形状，熟了会软软甜甜",
  },
  {
    label: "鸡蛋",
    aliases: ["蛋", "蛋花"],
    nutrition: "有优质蛋白，能给身体长力气",
    observeHint: "找黄黄白白的蛋花或软软蛋块",
  },
  {
    label: "豆腐",
    aliases: ["豆干", "豆制品"],
    nutrition: "有植物蛋白和钙，软软的，适合先用勺子看一看",
    observeHint: "找白白方方的小块，轻轻碰一碰",
  },
  {
    label: "鱼",
    aliases: ["鱼肉", "鱼卷", "崇武鱼卷"],
    nutrition: "有蛋白质和来自鱼肉的营养，能帮助身体长力气",
    observeHint: "找白白圆片或鱼肉纹理，先闻一闻清汤味",
  },
  {
    label: "面线",
    aliases: ["面条", "面线糊"],
    nutrition: "主要提供碳水能量，细细软软，适合慢慢用勺子认识",
    observeHint: "看细细长长的面线在汤里游",
  },
  {
    label: "地瓜粉",
    aliases: ["红薯粉", "淀粉"],
    nutrition: "能让食物变得软糯或金黄，给身体提供一点能量",
    observeHint: "找金黄边边或软糯口感",
  },
  {
    label: "糯米",
    aliases: ["米饭", "大米", "米粒"],
    nutrition: "能提供主食能量，让身体有精神活动",
    observeHint: "找一粒一粒亮亮的米",
  },
  {
    label: "肉",
    aliases: ["猪肉", "肉丁", "肉粒"],
    nutrition: "有蛋白质和铁，能帮助身体长力气",
    observeHint: "先看小块形状，闻一闻熟肉香",
  },
  {
    label: "青椒",
    aliases: ["彩椒", "甜椒"],
    nutrition: "有维生素C和清脆口感，颜色很明显",
    observeHint: "找绿色或红色弯弯边，先看颜色",
  },
  {
    label: "茄子",
    aliases: [],
    nutrition: "有膳食纤维和紫色植物营养，煮熟后软软的",
    observeHint: "看紫色外皮和软软口感",
  },
  {
    label: "南瓜",
    aliases: [],
    nutrition: "有胡萝卜素和主食能量，熟了软软甜甜",
    observeHint: "找黄橙色和软软块",
  },
  {
    label: "花生",
    aliases: ["花生碎", "坚果"],
    nutrition: "有植物油脂和蛋白质，香香脆脆",
    observeHint: "先闻坚果香，再看小碎粒",
  },
  {
    label: "水果",
    aliases: ["水果丁", "苹果", "香蕉", "梨"],
    nutrition: "有维生素和水分，能让味道更清甜",
    observeHint: "找颜色和果香",
  },
  {
    label: "清汤",
    aliases: ["热汤", "汤", "汤汁"],
    nutrition: "能带来水分和温暖味道，帮助孩子先从汤汁靠近",
    observeHint: "先闻热汤香，再看食材在汤里",
  },
];

function normalizeFoodLabel(label: string) {
  return label.replace(/[\s、，,。；;：:（）()]/g, "").toLowerCase();
}

export function getFoodNutritionProfile(label: string) {
  const normalizedLabel = normalizeFoodLabel(label);

  return foodNutritionProfiles.find((profile) => {
    const candidates = [profile.label, ...profile.aliases].map(normalizeFoodLabel);

    return candidates.some(
      (candidate) =>
        normalizedLabel === candidate ||
        normalizedLabel.includes(candidate) ||
        candidate.includes(normalizedLabel),
    );
  });
}

export function buildIngredientNutritionIntro(label: string) {
  const profile = getFoodNutritionProfile(label);

  if (!profile) {
    return `${label}有自己的颜色、气味和营养，可以先观察名字、样子和味道。`;
  }

  return `${profile.label}${profile.nutrition}。${profile.observeHint}。`;
}

export function buildFoodNutritionIntro(label: string, ingredients: string[] = []) {
  const cleanIngredients = Array.from(
    new Set(ingredients.map((item) => item.trim()).filter(Boolean)),
  );

  if (cleanIngredients.length === 0) {
    return buildIngredientNutritionIntro(label);
  }

  const nutritionLines = cleanIngredients
    .map((ingredient) => getFoodNutritionProfile(ingredient))
    .filter((profile): profile is FoodNutritionProfile => Boolean(profile))
    .filter(
      (profile, index, list) =>
        list.findIndex((item) => item.label === profile.label) === index,
    )
    .slice(0, 3)
    .map((profile) => `${profile.label}${profile.nutrition}`);

  if (nutritionLines.length === 0) {
    return buildIngredientNutritionIntro(label);
  }

  return `${label}的营养小发现：${nutritionLines.join("；")}。`;
}

export function buildFoodObservationHint(label: string) {
  const profile = getFoodNutritionProfile(label);

  return profile?.observeHint ?? `先观察${label}的颜色、形状和气味。`;
}
