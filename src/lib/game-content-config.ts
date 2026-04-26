import type { MiniGameKey } from "@/lib/growth-archive";
import type { ThemeId } from "@/lib/site-data";

export const gameContentConfigStorageKey = "tongqu-growth-web-game-content-config";

export type EditableGameContent = {
  gameKey: MiniGameKey;
  themeId: ThemeId;
  title: string;
  childGoal: string;
  reminderText: string;
  teacherNote: string;
  itemLines: string[];
  updatedAt: string;
};

const nowLabel = "system-default";

export const defaultGameContentConfigs: EditableGameContent[] = [
  {
    gameKey: "washSteps",
    themeId: "habit",
    title: "小手清洁任务站",
    childGoal:
      "请看图卡，按顺序点：打湿小手、抹上泡泡、搓搓手心手背、冲洗干净、擦干小手。",
    reminderText: "小手清洁任务完成啦：打湿、泡泡、搓洗、冲净、擦干，每一步都记住了。",
    teacherNote: "用于观察幼儿是否掌握饭前便后洗手的基本步骤。",
    itemLines: ["💧 打湿小手｜先让小手碰到清水。", "🫧 抹上泡泡｜挤一点洗手液，搓出泡泡。", "👐 搓搓手心手背｜手心、手背、指缝都要搓一搓。", "🚰 冲洗干净｜用清水把泡泡冲干净。", "🧻 擦干小手｜最后用小毛巾把手擦干。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "queue",
    themeId: "habit",
    title: "一日好习惯路线",
    childGoal: "请根据喝水、整理、排队、如厕情境，选择合适又安全的做法。",
    reminderText: "一日好习惯路线完成啦：喝水、整理、排队、如厕都能自己选合适做法。",
    teacherNote: "用于观察幼儿能否把行为习惯迁移到一日生活情境。",
    itemLines: ["🥤 户外回来有点口渴｜坐好慢慢喝水。", "🧺 玩具散在垫子上｜按标记送回家。", "🚩 准备去操场｜跟着队伍慢慢走。", "🚻 想上厕所｜告诉老师再去整理。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "habitJudge",
    themeId: "habit",
    title: "看图判断做法对不对",
    childGoal: "看到正确做法点“正确”，看到不安全或不合适的做法点“不正确”。",
    reminderText: "看图判断完成啦：你能分清哪些做法正确，哪些做法需要换成更安全的方式。",
    teacherNote: "用于观察幼儿能否看图说出安全做法和需要调整的地方。",
    itemLines: ["🧼 饭前先洗手｜正确做法。", "🥤 拿着水杯追跑｜不安全做法。", "🧺 玩具按标记送回家｜正确做法。", "🚩 排队时推同伴｜不安全做法。", "🚻 想上厕所告诉老师｜正确做法。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "foodObserve",
    themeId: "food",
    title: "泉州美食摊位寻宝",
    childGoal: "像逛泉州美食小岛一样，听线索找摊位，收集食材卡，听小故事，再选一个愿意靠近的小步骤。",
    reminderText: "泉州美食摊位寻宝完成啦：认识名字、找食材、听故事、说发现。",
    teacherNote: "用于观察幼儿对泉州本地美食名称、食材、外形和生活场景的兴趣。",
    itemLines: ["🦪 海边鲜味摊｜海蛎煎、土笋冻、崇武鱼卷。", "🥣 古城小吃摊｜面线糊、润饼菜。", "🍧 甜甜清凉摊｜石花膏。", "🍙 家常饭菜摊｜肉粽、炸醋肉。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "foodPreference",
    themeId: "food",
    title: "美食认识观察卡",
    childGoal: "选一种今天还在认识的泉州美食，说说原因；先认识名字、样子和食材就很好。",
    reminderText: "美食认识观察卡完成啦：老师辅助页会保留这条观察记录。",
    teacherNote: "用于观察幼儿对陌生泉州美食的接受情况，后续给老师生成温和食育策略。",
    itemLines: ["食物选择｜海蛎煎、面线糊、土笋冻、润饼菜、石花膏等。", "原因选择｜味道、颜色、口感、没见过。", "幼儿端反馈｜食物角色介绍食材，不贴挑食标签。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "peerEncourage",
    themeId: "food",
    title: "陪同伴认识新美食",
    childGoal: "选一位小伙伴，把认识美食的小方法送给他：找颜色、找食材、听故事。",
    reminderText: "你陪同伴认识了新美食：先看名字和样子，再慢慢靠近。",
    teacherNote: "用于观察幼儿能否用温和语言陪伴同伴认识陌生食物。",
    itemLines: ["海蛎煎｜找金黄边。", "土笋冻｜看透明样子。", "润饼菜｜说一说里面的蔬菜。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "mealTray",
    themeId: "food",
    title: "午餐小餐盘",
    childGoal: "点选泉州食物，认识名称、食材和营养；每样都可以先看样子、听故事。",
    reminderText: "午餐小餐盘搭好啦：认识了更多泉州美食，也知道它们能帮身体做什么。",
    teacherNote: "用于观察幼儿是否能认识食物名称、营养和均衡搭配。",
    itemLines: ["海蛎煎｜认识蛋白质和海味。", "面线糊｜认识主食能量。", "润饼菜｜认识蔬菜和饼皮。", "崇武鱼卷｜认识鱼肉蛋白。", "石花膏｜认识泉州清凉甜品。"],
    updatedAt: nowLabel,
  },
];

function normalizeItemLines(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const lines = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 12);

  return lines.length > 0 ? lines : fallback;
}

function normalizeConfig(value: unknown, fallback: EditableGameContent): EditableGameContent {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<EditableGameContent> : {};

  return {
    gameKey: fallback.gameKey,
    themeId: fallback.themeId,
    title: typeof record.title === "string" && record.title.trim() ? record.title.trim().slice(0, 24) : fallback.title,
    childGoal:
      typeof record.childGoal === "string" && record.childGoal.trim()
        ? record.childGoal.trim().slice(0, 180)
        : fallback.childGoal,
    reminderText:
      typeof record.reminderText === "string" && record.reminderText.trim()
        ? record.reminderText.trim().slice(0, 180)
        : fallback.reminderText,
    teacherNote:
      typeof record.teacherNote === "string" && record.teacherNote.trim()
        ? record.teacherNote.trim().slice(0, 220)
        : fallback.teacherNote,
    itemLines: normalizeItemLines(record.itemLines, fallback.itemLines),
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt.trim()
        ? record.updatedAt
        : fallback.updatedAt,
  };
}

export function parseGameContentConfigs(raw: string | null): EditableGameContent[] {
  if (!raw) {
    return defaultGameContentConfigs;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];

    return defaultGameContentConfigs.map((fallback) => {
      const saved = list.find(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          "gameKey" in item &&
          item.gameKey === fallback.gameKey,
      );

      return normalizeConfig(saved, fallback);
    });
  } catch {
    return defaultGameContentConfigs;
  }
}

export function getGameContentConfig(
  configs: EditableGameContent[],
  gameKey: MiniGameKey,
) {
  return configs.find((item) => item.gameKey === gameKey) ??
    defaultGameContentConfigs.find((item) => item.gameKey === gameKey);
}

export function updateGameContentConfig(
  configs: EditableGameContent[],
  gameKey: MiniGameKey,
  patch: Partial<Pick<EditableGameContent, "title" | "childGoal" | "reminderText" | "teacherNote" | "itemLines">>,
) {
  return defaultGameContentConfigs.map((fallback) => {
    const current = configs.find((item) => item.gameKey === fallback.gameKey) ?? fallback;

    if (fallback.gameKey !== gameKey) {
      return current;
    }

    return normalizeConfig(
      {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
      fallback,
    );
  });
}

export function resetGameContentConfig(configs: EditableGameContent[], gameKey: MiniGameKey) {
  return defaultGameContentConfigs.map((fallback) => {
    if (fallback.gameKey === gameKey) {
      return fallback;
    }

    return configs.find((item) => item.gameKey === fallback.gameKey) ?? fallback;
  });
}
