export type ThemeId = "habit" | "food";

export type ThemeConfig = {
  id: ThemeId;
  label: string;
  emoji: string;
  headline: string;
  subtitle: string;
  starter: string;
  choices: string[];
  imagePrompt: string;
  badgePool: string[];
};

export const themes: Record<ThemeId, ThemeConfig> = {
  habit: {
    id: "habit",
    label: "幼习宝",
    emoji: "✨",
    headline: "跟着习惯小星闯关，学会喝水、洗手、整理和排队。",
    subtitle: "更适合晨间谈话、过渡环节和班级集体互动。",
    starter:
      "你好呀，我是习惯小星。今天我们要去成长探险岛，帮助小朋友完成洗手、喝水和整理物品的任务。你想先挑战哪一关？",
    choices: ["洗手泡泡任务", "喝水小任务", "玩具送回家"],
    imagePrompt:
      "绘本风，明亮温暖，幼儿园教室里，圆润可爱的习惯小星带着孩子洗手、排队、整理书本，奶油黄和海盐蓝配色，儿童插画，高细节，安全友好。",
    badgePool: ["洗手闪亮章", "整理小能手", "喝水勇士章", "排队小队长"],
  },
  food: {
    id: "food",
    label: "闽食成长岛",
    emoji: "🦪",
    headline: "和海蛎小勇士一起认识泉州闽南美食，勇敢尝试新食物。",
    subtitle: "适合餐前引导、食育故事和家园共育。",
    starter:
      "欢迎来到闽食成长岛，我是海蛎小勇士。今天我们要认识泉州海蛎煎、晋江紫菜汤和闽南芥菜饭，还会玩一个看一看、闻一闻、尝一小口的小挑战。你想先听哪一种美食故事？",
    choices: ["看泉州海蛎煎", "闻晋江紫菜汤", "尝闽南芥菜饭"],
    imagePrompt:
      "儿童绘本风，闽南海边和幼儿园餐桌场景，海蛎小勇士、紫菜公主、芥菜小精灵围着发光的餐盘讲故事，珊瑚橙、海盐蓝、叶子绿配色，卡通可爱，柔和高质感。",
    badgePool: ["勇敢尝鲜章", "闽食小侦探", "海蛎小勇士章", "紫菜发现家"],
  },
};

export const habitSkillCards = [
  {
    title: "上课小坐姿",
    icon: "🪑",
    hint: "学会坐端正、脚放稳、眼睛看老师。",
    tone: "bg-amber-100 text-amber-900",
  },
  {
    title: "专注小耳朵",
    icon: "👂",
    hint: "练习认真听、少分心，跟上课堂节奏。",
    tone: "bg-sky-100 text-sky-900",
  },
  {
    title: "礼貌小种子",
    icon: "🌱",
    hint: "会说请、谢谢、对不起，做有礼貌的小朋友。",
    tone: "bg-emerald-100 text-emerald-900",
  },
  {
    title: "阅读小书虫",
    icon: "📚",
    hint: "愿意翻书、看图、听故事，养成阅读习惯。",
    tone: "bg-violet-100 text-violet-900",
  },
  {
    title: "情绪小天气",
    icon: "🌤️",
    hint: "会说开心、生气和难过，慢慢学会安抚自己。",
    tone: "bg-rose-100 text-rose-900",
  },
  {
    title: "实验小侦探",
    icon: "🔬",
    hint: "跟着任务做小实验，练习观察和任务意识。",
    tone: "bg-cyan-100 text-cyan-900",
  },
  {
    title: "整理小能手",
    icon: "🧺",
    hint: "玩具、图书和文具都能慢慢归位。",
    tone: "bg-orange-100 text-orange-900",
  },
  {
    title: "喝水小勇士",
    icon: "🥤",
    hint: "愿意主动喝水，记得一口一口慢慢喝。",
    tone: "bg-teal-100 text-teal-900",
  },
];

export const foodBadgeCards = [
  {
    title: "闽食小寻宝",
    icon: "🧭",
    description: "去找一找家里、学校或街边看到的闽食。",
  },
  {
    title: "勇敢品尝章",
    icon: "🥢",
    description: "愿意闻一闻、看一看、尝一小口，也算勇敢。",
  },
  {
    title: "家庭小主厨",
    icon: "👨‍🍳",
    description: "和家人一起做一份简单闽食，拍照留念。",
  },
  {
    title: "闽食宣传员",
    icon: "📣",
    description: "会介绍一种闽食名字和它的特别之处。",
  },
];

export const rewardStickerCards = [
  {
    title: "坐姿闪亮章",
    icon: "⭐",
    tone: "bg-amber-100 text-amber-900",
  },
  {
    title: "勇敢尝试章",
    icon: "🥄",
    tone: "bg-rose-100 text-rose-900",
  },
  {
    title: "阅读小书虫",
    icon: "🐛",
    tone: "bg-violet-100 text-violet-900",
  },
  {
    title: "勇敢尝鲜章",
    icon: "🥢",
    tone: "bg-emerald-100 text-emerald-900",
  },
  {
    title: "闽食宣传员",
    icon: "📣",
    tone: "bg-cyan-100 text-cyan-900",
  },
  {
    title: "喝水小勇士",
    icon: "💧",
    tone: "bg-teal-100 text-teal-900",
  },
];

export const mealPhotoChecklist = [
  "先拍清楚整张餐盘，再上传到网站。",
  "餐盘边缘和食物都尽量拍完整。",
  "拍完后请孩子说一句最想介绍的食物。",
];

export const teacherTasks = [
  {
    id: "story",
    label: "生成故事",
    starter: "请为 4-5 岁幼儿生成一个 3 分钟内可以讲完的互动故事，主题围绕生活习惯或闽南食育，语言温柔、有提问、有结尾小任务。",
  },
  {
    id: "home",
    label: "活动课程方案",
    starter: "请生成一份幼儿园活动课程方案，包含活动名称、年龄段、活动目标、准备材料、导入故事、活动流程、教师提问和观察要点。",
  },
  {
    id: "picture-book",
    label: "绘本导入",
    starter: "请围绕一个幼儿生活情境生成绘本式导入语，要求有角色、有画面、有一句能让幼儿回答的问题。",
  },
  {
    id: "extension",
    label: "活动延伸",
    starter: "请根据幼儿已完成的互动记录，生成一段活动延伸方案，包含再玩一次的变化玩法、教师观察点和下一次活动建议。",
  },
];

export const washSteps = [
  "打湿小手",
  "抹上泡泡",
  "搓搓手心手背",
  "冲洗干净",
  "擦干小手",
];

export const queueOrder = ["小队长举牌", "第一位小朋友", "第二位小朋友", "第三位小朋友"];

export const minnanFoodObserveSteps = [
  {
    label: "看颜色",
    food: "泉州海蛎煎",
    icon: "👀",
    picture: "🦪",
    cue: "找一找金黄边和小葱点。",
  },
  {
    label: "闻香气",
    food: "晋江紫菜汤",
    icon: "👃",
    picture: "🌊",
    cue: "轻轻闻一闻海的味道。",
  },
  {
    label: "小口尝",
    food: "闽南芥菜饭",
    icon: "🥄",
    picture: "🥬",
    cue: "准备好了再尝一小口。",
  },
  {
    label: "说发现",
    food: "今天的闽食",
    icon: "💬",
    picture: "⭐",
    cue: "说一句我看到了什么。",
  },
];

export const minnanFoodClues = [
  {
    label: "泉州海蛎煎",
    icon: "🦪",
    clue: "金黄金黄，有海蛎和蛋香。",
    pictureHint: "找圆圆金黄的小饼。",
    ingredients: ["海蛎", "鸡蛋", "地瓜粉", "小葱"],
    ingredientIntro: "海蛎带来海味，鸡蛋和地瓜粉让边边变得金黄软糯。",
    gentleTryTip: "如果还不熟悉海蛎口感，可以先看金黄边、闻蛋香，再尝很小一口边边。",
  },
  {
    label: "晋江紫菜汤",
    icon: "🌊",
    clue: "一碗热汤，有紫菜的海味。",
    pictureHint: "找蓝蓝海浪和紫菜。",
    ingredients: ["紫菜", "清汤", "葱花", "少量海味配料"],
    ingredientIntro: "紫菜来自海边，放进热汤里会变软，也会带来一点海的味道。",
    gentleTryTip: "如果闻起来不习惯，可以先看紫菜在汤里飘，再喝一小口清汤。",
  },
  {
    label: "闽南芥菜饭",
    icon: "🥬",
    clue: "米饭里有绿色芥菜，香香的。",
    pictureHint: "找绿色叶子和米饭。",
    ingredients: ["米饭", "芥菜", "胡萝卜丁", "少量香菇"],
    ingredientIntro: "米饭是主角，芥菜和蔬菜丁让饭里有绿色和清香。",
    gentleTryTip: "如果第一次见芥菜，可以先找绿色叶子，再尝一小勺米饭。",
  },
];

export const foodPreferenceReasons = [
  {
    label: "味道陌生",
    icon: "👃",
    strategy: "先闻一闻、看一看，不急着入口，给孩子一点熟悉时间。",
  },
  {
    label: "口感担心",
    icon: "🥄",
    strategy: "先从边缘或汤汁开始，份量小到孩子愿意尝试即可。",
  },
  {
    label: "颜色不熟悉",
    icon: "🎨",
    strategy: "请孩子找一找颜色、形状和食材名字，把陌生感变成观察任务。",
  },
  {
    label: "今天没胃口",
    icon: "☁️",
    strategy: "先接纳状态，保留少量尝试机会，不用催促或贴标签。",
  },
];

export const peerEncouragementPrompts = [
  {
    peer: "小伙伴不敢尝海蛎煎",
    icon: "🧒",
    foodIcon: "🦪",
    encouragement: "我陪你先看一看金黄边。",
  },
  {
    peer: "小伙伴闻到紫菜汤有点犹豫",
    icon: "👧",
    foodIcon: "🌊",
    encouragement: "我们一起闻一闻海味，不着急。",
  },
  {
    peer: "小伙伴第一次见芥菜饭",
    icon: "👦",
    foodIcon: "🥬",
    encouragement: "你可以先尝一小口，我给你加油。",
  },
];

export const storyMissionMap: Record<ThemeId, string[]> = {
  habit: ["完成小手清洁任务", "完成一日好习惯路线", "判断做法对不对"],
  food: ["完成闽食探味寻宝", "记录今天不太想吃的食物", "给同伴一句鼓励", "认识午餐小餐盘"],
};

export const themeVideoCards: Record<
  ThemeId,
  Array<{
    title: string;
    icon: string;
    description: string;
    topics: string[];
  }>
> = {
  habit: [
    {
      title: "生活习惯小影院",
      icon: "🧼",
      description: "适合播放洗手、排队、如厕等一日生活习惯视频。",
      topics: ["洗手步骤", "排队等待", "如厕整理"],
    },
    {
      title: "安全放松学",
      icon: "🛟",
      description: "适合播放交通安全、饮食安全、防火安全等短视频。",
      topics: ["交通安全", "饮食安全", "防火安全"],
    },
  ],
  food: [
    {
      title: "泉州闽食小课堂",
      icon: "🍽️",
      description: "适合播放食物来源、营养价值、泉州美食做法视频。",
      topics: ["食物来源", "营养价值", "泉州美食做法"],
    },
    {
      title: "非遗文化小剧场",
      icon: "🎬",
      description: "适合播放泉州非遗文化、南音、传统饮食宣传视频。",
      topics: ["泉州非遗", "南音文化", "闽南饮食宣传"],
    },
  ],
};

export const teacherPitchCards = [
  {
    title: "故事生成",
    description: "把主题、角色和教育目标，整理成适合 4-5 岁幼儿听懂的互动故事。",
  },
  {
    title: "活动课程方案",
    description: "生成活动目标、材料准备、流程、提问和观察要点，方便老师继续修改使用。",
  },
  {
    title: "可复制可试播",
    description: "生成结果支持复制、语音试播和二次调整，方便老师备课前快速校对。",
  },
];

export const teacherWorkflowCards = [
  {
    title: "故事导入",
    icon: "📖",
    description: "先生成角色、场景和第一个问题，让幼儿愿意进入活动。",
  },
  {
    title: "活动目标",
    icon: "🎯",
    description: "把习惯培养、食育认知或安全知识转成清楚的小目标。",
  },
  {
    title: "活动流程",
    icon: "🧩",
    description: "生成导入、操作、互动提问和收束环节，老师可以继续调整。",
  },
  {
    title: "观察延伸",
    icon: "📝",
    description: "把儿童互动记录转成观察要点和下一次活动延伸建议。",
  },
];

export const mealTrayOptions = [
  {
    label: "泉州海蛎煎",
    icon: "🦪",
    nutrient: "蛋白质",
    benefit: "帮助身体长力气。",
    tryTip: "先看金黄边，再尝一小口。",
    isHealthy: true,
  },
  {
    label: "晋江紫菜汤",
    icon: "🌊",
    nutrient: "碘和矿物质",
    benefit: "认识来自大海的味道。",
    tryTip: "先闻一闻汤香，再喝一小口。",
    isHealthy: true,
  },
  {
    label: "闽南芥菜饭",
    icon: "🥬",
    nutrient: "膳食纤维",
    benefit: "帮助小肚子舒服运动。",
    tryTip: "找一找绿色芥菜，慢慢尝。",
    isHealthy: true,
  },
  {
    label: "苹果片",
    icon: "🍎",
    nutrient: "维生素",
    benefit: "给餐盘添一点清甜。",
    tryTip: "咔嚓咬一小口。",
    isHealthy: true,
  },
  {
    label: "汽水",
    icon: "🥤",
    nutrient: "甜饮料",
    benefit: "偶尔认识，不做今天主角。",
    tryTip: "今天先把水和汤放前面。",
    isHealthy: false,
  },
  {
    label: "薯片",
    icon: "🍟",
    nutrient: "油炸零食",
    benefit: "偶尔认识，不做今天主角。",
    tryTip: "今天先多看看闽南食物。",
    isHealthy: false,
  },
];
