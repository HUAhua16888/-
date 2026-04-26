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
    headline: "和海蛎小勇士逛泉州美食小岛，认识名字、食材和小故事。",
    subtitle: "适合餐前引导、食育故事和家园共育。",
    starter:
      "欢迎来到闽食成长岛，我是海蛎小勇士。今天我们要逛泉州美食小摊，认识海蛎煎、面线糊、润饼菜和石花膏，找食材、听小故事，再选一个愿意靠近的小步骤。你想先逛哪一摊？",
    choices: ["逛古城小吃摊", "找食材卡", "听美食故事"],
    imagePrompt:
      "儿童绘本风，闽南海边和幼儿园餐桌场景，海蛎小勇士、紫菜公主、芥菜小精灵围着发光的餐盘讲故事，珊瑚橙、海盐蓝、叶子绿配色，卡通可爱，柔和高质感。",
    badgePool: ["闽食小侦探", "食材发现章", "古城小导游", "亲近美食章"],
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
    title: "亲近美食章",
    icon: "🥢",
    description: "愿意认名字、找食材、靠近一点点，也算勇敢。",
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
    id: "home",
    label: "活动课程方案",
    starter: "年龄段：中班 4-5 岁。活动时长：15-20 分钟。主题：饭前洗手。幼儿已有经验：知道要洗手，但步骤容易漏。希望目标：能按顺序说出并模仿洗手步骤。",
  },
  {
    id: "story",
    label: "故事引导",
    starter: "请为 4-5 岁幼儿生成一个 3 分钟内可以讲完的互动故事，主题围绕生活习惯或泉州食育，语言温柔、有提问、有结尾小任务。",
  },
  {
    id: "picture-book",
    label: "绘本导入",
    starter: "请围绕一个幼儿生活情境生成绘本式导入，要求有角色、有画面、有一句能让幼儿回答的问题。",
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
    label: "认名字",
    food: "泉州美食",
    icon: "🏷️",
    picture: "🏮",
    cue: "先把美食名字轻轻念一遍。",
  },
  {
    label: "找食材",
    food: "泉州美食",
    icon: "🧺",
    picture: "🥬",
    cue: "找一找它身体里的食材卡。",
  },
  {
    label: "看样子",
    food: "泉州美食",
    icon: "👀",
    picture: "🎨",
    cue: "说说它的颜色、形状或样子。",
  },
  {
    label: "听故事",
    food: "泉州美食",
    icon: "📖",
    picture: "🏠",
    cue: "听一听它常在哪里出现。",
  },
  {
    label: "说发现",
    food: "泉州美食",
    icon: "💬",
    picture: "⭐",
    cue: "说一句我看到了什么。",
  },
  {
    label: "选小步",
    food: "泉州美食",
    icon: "🫶",
    picture: "🥄",
    cue: "选看一看、闻一闻、碰一碰或尝一点点。",
  },
];

export const minnanFoodClues = [
  {
    label: "泉州海蛎煎",
    icon: "🦪",
    stall: "海边鲜味摊",
    clue: "金黄金黄，有海蛎和蛋香。",
    pictureHint: "找圆圆金黄的小饼。",
    colorShape: "金黄边、圆圆饼、能看到小葱点。",
    ingredients: ["海蛎", "鸡蛋", "地瓜粉", "小葱"],
    ingredientIntro: "海蛎带来海味，鸡蛋和地瓜粉让边边变得金黄软糯。",
    cultureStory: "在泉州海边，家人常把新鲜海味做成热乎乎的小吃。",
    gentleTryTip: "如果还不熟悉海蛎口感，可以先看金黄边、闻蛋香，再尝很小一口边边。",
    approachSteps: ["看金黄边", "闻蛋香", "碰一碰边边", "尝一点点"],
  },
  {
    label: "面线糊",
    icon: "🥣",
    stall: "古城小吃摊",
    clue: "细细软软，热热的一碗糊。",
    pictureHint: "找白白细细的面线和小勺子。",
    colorShape: "白白软软、细细长长、像温暖的小汤。",
    ingredients: ["面线", "清汤", "葱花", "少量海味配料"],
    ingredientIntro: "面线细细的，放进热汤里会变得软软滑滑，适合用小勺慢慢认识。",
    cultureStory: "泉州古城早晨常能看到热乎乎的面线糊，是很多家庭熟悉的早餐味道。",
    gentleTryTip: "如果第一次见面线糊，可以先用勺子搅一搅，看细面线在汤里游。",
    approachSteps: ["看细面线", "闻热汤香", "用勺搅一搅", "尝一小勺"],
  },
  {
    label: "土笋冻",
    icon: "🧊",
    stall: "海边鲜味摊",
    clue: "凉凉透明，像小果冻。",
    pictureHint: "找透明小圆冻和酱料点。",
    colorShape: "透明、圆圆、凉凉弹弹。",
    ingredients: ["土笋冻原料", "清汤冻", "蒜蓉酱", "香菜"],
    ingredientIntro: "土笋冻看起来像小果冻，是泉州很有名的海边小吃，可以先观察它透明的样子。",
    cultureStory: "在泉州小吃摊，土笋冻常被装在小碟里，大家会先看看它晶亮的样子。",
    gentleTryTip: "如果还不熟悉，可以先看透明颜色，轻轻碰一碰小碟边，不急着入口。",
    approachSteps: ["看透明样子", "碰小碟边", "闻一闻酱香", "尝一点点冻"],
  },
  {
    label: "闽南肉粽",
    icon: "🍙",
    stall: "家常饭菜摊",
    clue: "粽叶包着香香米粒。",
    pictureHint: "找三角粽和绿色粽叶。",
    colorShape: "三角形、粽叶绿、米粒亮亮。",
    ingredients: ["糯米", "粽叶", "香菇", "肉丁"],
    ingredientIntro: "粽叶把米粒和食材抱在一起，打开时会闻到香香的家常味。",
    cultureStory: "泉州家庭节日里常会包粽子，孩子可以先认识粽叶和米粒。",
    gentleTryTip: "可以先闻粽叶香，找一找米粒，再尝一点点米饭。",
    approachSteps: ["闻粽叶香", "找米粒", "看三角形", "尝一点米饭"],
  },
  {
    label: "润饼菜",
    icon: "🌯",
    stall: "古城小吃摊",
    clue: "薄薄饼皮卷着好多菜。",
    pictureHint: "找卷起来的小饼和五颜六色的菜。",
    colorShape: "卷卷的、长长的、里面颜色很多。",
    ingredients: ["薄饼皮", "胡萝卜", "包菜", "花生碎"],
    ingredientIntro: "润饼菜把蔬菜卷进薄饼里，像给食材盖上一条软软小被子。",
    cultureStory: "泉州人常在节日或家人团聚时吃润饼菜，边卷边聊很热闹。",
    gentleTryTip: "如果不熟悉，可以先看里面的颜色，找一种自己认识的蔬菜。",
    approachSteps: ["看颜色", "找蔬菜", "闻花生香", "咬一点饼皮"],
  },
  {
    label: "石花膏",
    icon: "🍧",
    stall: "甜甜清凉摊",
    clue: "清清凉凉，像透明小甜冻。",
    pictureHint: "找小碗里的透明冻和甜汤。",
    colorShape: "透明、细滑、凉凉的甜碗。",
    ingredients: ["石花膏", "蜂蜜水", "水果丁", "少量坚果"],
    ingredientIntro: "石花膏是泉州常见清凉甜品，透明滑滑，可以先用勺子看一看。",
    cultureStory: "天气热的时候，家人会带孩子吃一碗清凉甜甜的石花膏。",
    gentleTryTip: "可以先看透明冻晃一晃，再尝一小勺甜汤。",
    approachSteps: ["看透明冻", "用勺晃一晃", "闻甜香", "尝一小勺"],
  },
  {
    label: "炸醋肉",
    icon: "🥢",
    stall: "家常饭菜摊",
    clue: "外面酥酥，闻起来有一点香香酸味。",
    pictureHint: "找金黄小块和小筷子。",
    colorShape: "金黄小块、外面酥酥。",
    ingredients: ["猪肉", "地瓜粉", "香醋", "蒜香调味"],
    ingredientIntro: "炸醋肉外面裹着地瓜粉，炸好后金黄金黄，味道带一点闽南香。",
    cultureStory: "泉州家常饭桌上常见炸醋肉，大人会夹成小块让孩子慢慢认识。",
    gentleTryTip: "可以先闻一闻香气，看看金黄外皮，再尝很小一块。",
    approachSteps: ["看金黄块", "闻香味", "夹一小块", "尝一点点"],
  },
  {
    label: "崇武鱼卷",
    icon: "🐟",
    stall: "海边鲜味摊",
    clue: "白白圆圆，里面有鱼肉香。",
    pictureHint: "找白色圆片和海边小鱼。",
    colorShape: "白白圆片、软软弹弹。",
    ingredients: ["鱼肉", "地瓜粉", "葱花", "清汤"],
    ingredientIntro: "崇武鱼卷把鱼肉做成圆圆卷片，放进汤里会有清清的海味。",
    cultureStory: "惠安崇武靠海，鱼卷是当地很有代表性的家乡味。",
    gentleTryTip: "如果第一次见鱼卷，可以先看圆片，再喝一小口清汤。",
    approachSteps: ["看圆片", "闻清汤", "找葱花", "尝一点鱼卷"],
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
    peer: "小伙伴正在认识海蛎煎",
    icon: "🧒",
    foodIcon: "🦪",
    encouragement: "我陪你先找金黄边。",
  },
  {
    peer: "小伙伴第一次看土笋冻",
    icon: "👧",
    foodIcon: "🧊",
    encouragement: "我们先看透明样子。",
  },
  {
    peer: "小伙伴想介绍润饼菜",
    icon: "👦",
    foodIcon: "🌯",
    encouragement: "我听你说里面的菜。",
  },
];

export const storyMissionMap: Record<ThemeId, string[]> = {
  habit: ["完成小手清洁任务", "完成一日好习惯路线", "判断做法对不对"],
  food: ["逛泉州美食摊", "记录还在认识的食物", "陪同伴认识新美食", "认识午餐小餐盘"],
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
    title: "快速活动方案",
    description: "先选主题、年龄和目标，生成适合 3-6 岁幼儿的活动初稿。",
  },
  {
    title: "结构清楚",
    description: "包含目标、材料、流程、提问、观察和家园延伸，方便继续修改。",
  },
  {
    title: "可复制可试播",
    description: "生成结果支持复制、语音试播和二次调整，备课前能快速校对。",
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
    label: "面线糊",
    icon: "🥣",
    nutrient: "主食能量",
    benefit: "让小肚子有暖暖的力气。",
    tryTip: "先用勺子搅一搅，看细面线。",
    isHealthy: true,
  },
  {
    label: "润饼菜",
    icon: "🌯",
    nutrient: "蔬菜和主食",
    benefit: "认识卷起来的蔬菜和饼皮。",
    tryTip: "先找一种认识的蔬菜。",
    isHealthy: true,
  },
  {
    label: "崇武鱼卷",
    icon: "🐟",
    nutrient: "蛋白质",
    benefit: "认识来自海边的鱼肉味。",
    tryTip: "先看圆圆鱼卷，再喝一口汤。",
    isHealthy: true,
  },
  {
    label: "闽南肉粽",
    icon: "🍙",
    nutrient: "主食和家常食材",
    benefit: "认识粽叶、米粒和家乡节日味。",
    tryTip: "先闻粽叶香，再找米粒。",
    isHealthy: true,
  },
  {
    label: "石花膏",
    icon: "🍧",
    nutrient: "清凉甜品",
    benefit: "认识泉州夏天常见的透明甜品。",
    tryTip: "先看透明冻晃一晃。",
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
