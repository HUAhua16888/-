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
    title: "历史安全判断记录",
    childGoal: "看到正确做法点“正确”，看到不安全或不合适的做法点“不正确”。",
    reminderText: "历史安全判断记录完成啦：你能分清哪些做法正确，哪些做法需要换成更安全的方式。",
    teacherNote: "旧版看图判断记录兼容项；儿童端当前主游戏已改为好习惯红绿牌。",
    itemLines: ["🧼 饭前先洗手｜正确做法。", "🥤 拿着水杯追跑｜不安全做法。", "🧺 玩具按标记送回家｜正确做法。", "🚩 排队时推同伴｜不安全做法。", "🚻 想上厕所告诉老师｜正确做法。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "readingCheckin",
    themeId: "habit",
    title: "习惯故事小剧场",
    childGoal: "听一个围绕洗手、喝水、排队、整理、图书归位或文明进餐的短故事，选答案卡，再完成一个习惯小任务。",
    reminderText: "习惯故事小剧场完成啦：你认真听故事，也把故事里的好习惯做到一步。",
    teacherNote: "用于观察幼儿是否能听懂习惯情境、选择答案卡，并把故事迁移到一个生活小任务。",
    itemLines: ["👂 听短故事｜我听到了一个好习惯。", "🃏 选答案卡｜我知道可以怎么做。", "🧺 做小任务｜洗手、喝水、排队、整理或图书归位。"],
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
    gameKey: "foodTrain",
    themeId: "food",
    title: "闽食小列车",
    childGoal: "小列车到站啦。听站名和短儿歌，点击正确的泉州美食站，全部到站后可以把一种美食介绍给家人。",
    reminderText: "闽食小列车到站啦：认识了多个泉州美食名字，也练习了小小播报。",
    teacherNote: "用于观察幼儿能否听懂站名、匹配美食名称，并愿意用短句介绍泉州美食。",
    itemLines: ["海蛎煎站｜金黄海味香。", "面线糊站｜细细软软热汤。", "润饼菜站｜薄饼卷蔬菜。", "石花膏站｜清凉透明甜品。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "foodGuess",
    themeId: "food",
    title: "美食猜猜乐",
    childGoal: "打开美食宝箱，听颜色、形状、来源和能做成什么菜，从食材卡中猜出答案。",
    reminderText: "美食猜猜乐完成啦：你能根据线索找到食材，也能做小小美食播报员。",
    teacherNote: "用于观察幼儿是否能根据感官线索和生活经验识别泉州美食食材。",
    itemLines: ["海蛎｜海边来的小鲜味。", "面线｜细细长长能做面线糊。", "芥菜｜绿绿叶子能做芥菜饭。", "地瓜粉｜能让海蛎煎边边软糯。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "foodPreference",
    themeId: "food",
    title: "美食认识观察卡",
    childGoal: "选一种今天还在认识的泉州美食，说说原因；先认识名字、样子和食材就很好。",
    reminderText: "美食认识观察卡完成啦：教师工作台会保留这条观察记录。",
    teacherNote: "用于观察幼儿对陌生泉州美食的接受情况，后续给老师生成温和食育策略。",
    itemLines: ["食物选择｜海蛎煎、面线糊、土笋冻、润饼菜、石花膏等。", "原因选择｜味道、颜色、口感、没见过。", "幼儿端反馈｜食物角色介绍食材，不贴负面标签。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "foodReporter",
    themeId: "food",
    title: "闽食小小播报员",
    childGoal: "选一种泉州美食，听提示卡，说出名字、食材和一个发现，完成一段小小播报。",
    reminderText: "闽食小小播报员完成啦：能介绍一种家乡美食，也能说出一个发现。",
    teacherNote: "用于观察幼儿语言表达、同伴展示和介绍家乡美食的能力。",
    itemLines: ["海蛎煎｜金黄边、海蛎、鸡蛋。", "面线糊｜细细软软、热汤、葱花。", "润饼菜｜薄饼皮、蔬菜、卷起来。", "石花膏｜透明清凉、夏天甜品。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "foodKitchen",
    themeId: "food",
    title: "泉州小厨房",
    childGoal: "选择一道泉州美食，点动作卡，上传区域或家庭作品，再让 AI 帮忙整理一句播报词。",
    reminderText: "泉州小厨房完成啦：能上传作品、说出原话，并借助 AI 整理成小小播报词。",
    teacherNote: "用于语言区、生活区和表演区活动，观察幼儿是否能按步骤操作、上传作品并完成展示表达。",
    itemLines: ["选择美食｜海蛎煎、面线糊、润饼菜、石花膏。", "动作步骤｜洗一洗、拌一拌、卷一卷、盛一盛。", "作品上传｜照片或视频只保留本机文件名。", "AI播报｜把孩子原话整理成幼儿能说的短句。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "peerEncourage",
    themeId: "food",
    title: "历史同伴鼓励记录",
    childGoal: "旧版同伴鼓励记录兼容项；儿童端当前主游戏已改为闽食小小播报员。",
    reminderText: "历史同伴鼓励记录已保留，可在教师工作台继续查看。",
    teacherNote: "旧版陪同伴认识新美食记录兼容项；不作为当前儿童端主游戏展示。",
    itemLines: ["海蛎煎｜找金黄边。", "土笋冻｜看透明样子。", "润饼菜｜说一说里面的蔬菜。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "mealTray",
    themeId: "food",
    title: "历史午餐小餐盘记录",
    childGoal: "旧版午餐小餐盘记录兼容项；儿童端当前主游戏已改为泉州小厨房。",
    reminderText: "历史午餐小餐盘记录已保留，可在教师工作台继续查看。",
    teacherNote: "旧版午餐小餐盘记录兼容项；不作为当前儿童端主游戏展示。",
    itemLines: ["海蛎煎｜认识蛋白质和海味。", "面线糊｜认识主食能量。", "润饼菜｜认识蔬菜和饼皮。", "崇武鱼卷｜认识鱼肉蛋白。", "石花膏｜认识泉州清凉甜品。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "mealManners",
    themeId: "habit",
    title: "文明进餐操",
    childGoal: "跟着 AI 口令做进餐好习惯动作：扶好碗、脚放稳、轻轻嚼、按需取餐、餐后整理。",
    reminderText: "文明进餐操完成啦：轻声用餐、细嚼慢咽、珍惜食物和餐后整理都练习到了。",
    teacherNote: "用于观察幼儿能否用动作模仿文明进餐要求，并迁移到午餐或点心环节。",
    itemLines: ["小手扶好碗｜碗不乱跑。", "小脚放稳｜身体坐舒服。", "嘴巴轻轻嚼｜细嚼慢咽。", "食物不乱撒｜慢慢送入口。", "餐后会整理｜碗筷桌面归位。"],
    updatedAt: nowLabel,
  },
  {
    gameKey: "habitTrafficLight",
    themeId: "habit",
    title: "好习惯红绿牌",
    childGoal: "听一个行为，觉得是好习惯就选绿牌；需要调整就选红牌，再听正确做法。",
    reminderText: "好习惯红绿牌完成啦：能判断饭前洗手、细嚼慢咽、阅读归位和安全喝水等做法。",
    teacherNote: "用于观察幼儿能否用红绿牌判断进餐和生活习惯，并说出替代做法。",
    itemLines: ["饭前洗手｜绿牌。", "边吃边玩｜红牌。", "细嚼慢咽｜绿牌。", "撒饭不收拾｜红牌。", "看完书放回书架｜绿牌。", "上课时大声打断别人｜红牌。", "生气时说“我有点难过”｜绿牌。", "拿着水杯跑来跑去｜红牌。"],
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

function isUserEditedConfig(value: unknown): value is Partial<EditableGameContent> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const updatedAt = (value as Partial<EditableGameContent>).updatedAt;

  return typeof updatedAt === "string" && updatedAt !== nowLabel && !Number.isNaN(Date.parse(updatedAt));
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

      return isUserEditedConfig(saved) ? normalizeConfig(saved, fallback) : fallback;
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
