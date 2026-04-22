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
    label: "习惯小卫队",
    emoji: "✨",
    headline: "跟着习惯小星闯关，学会喝水、洗手、整理和排队。",
    subtitle: "更适合晨间谈话、过渡环节和班级集体互动。",
    starter:
      "你好呀，我是习惯小星。今天我们要去成长探险岛，帮助小朋友完成洗手、喝水和整理物品的任务。你想先挑战哪一关？",
    choices: ["我想先学洗手", "我想变成排队小队长", "帮我讲一个整理小故事"],
    imagePrompt:
      "绘本风，明亮温暖，幼儿园教室里，圆润可爱的习惯小星带着孩子洗手、排队、整理书本，奶油黄和海盐蓝配色，儿童插画，高细节，安全友好。",
    badgePool: ["洗手闪亮章", "整理小能手", "喝水勇士章", "排队小队长"],
  },
  food: {
    id: "food",
    label: "闽食成长岛",
    emoji: "🦪",
    headline: "和海蛎小勇士一起认识闽南美食，勇敢尝试新食物。",
    subtitle: "适合餐前引导、食育故事和家园共育展示。",
    starter:
      "欢迎来到闽食成长岛，我是海蛎小勇士。今天我们要认识海蛎、紫菜和芥菜，还会玩一个勇敢尝一口的小挑战。你想先听哪一种美食故事？",
    choices: ["讲讲海蛎煎", "我想认识紫菜蛋汤", "帮我鼓励一个挑食的小朋友"],
    imagePrompt:
      "儿童绘本风，闽南海边和幼儿园餐桌场景，海蛎小勇士、紫菜公主、芥菜小精灵围着发光的餐盘讲故事，珊瑚橙、海盐蓝、叶子绿配色，卡通可爱，柔和高质感。",
    badgePool: ["勇敢尝鲜章", "闽食小侦探", "海蛎小勇士章", "紫菜发现家"],
  },
};

export const landingHighlights = [
  {
    title: "AI 互动故事",
    description: "孩子可以打字、点选，也可以用语音和角色聊天推进剧情。",
  },
  {
    title: "轻量小游戏",
    description: "每个故事节点都能接一个小游戏，让知识点变成可操作的小任务。",
  },
  {
    title: "老师家长辅助",
    description: "一键生成课堂引导语、鼓励话术、家园共育文案和食育活动方案。",
  },
];

export const showcaseStats = [
  {
    label: "双入口模式",
    value: "儿童端 + 老师端",
  },
  {
    label: "互动玩法",
    value: "AI 对话 + 3 个小游戏",
  },
  {
    label: "部署状态",
    value: "香港服务器已上线",
  },
];

export const showcaseHighlights = [
  {
    title: "适合比赛展示",
    description: "首页、儿童互动、老师辅助三条主线清晰，评审一看就能明白项目结构。",
  },
  {
    title: "可直接公网访问",
    description: "当前版本已经完成服务器部署，支持通过公网地址直接打开体验。",
  },
  {
    title: "后续扩展方便",
    description: "后面可以继续补语音 API、数据库、勋章记录和更多主题小游戏。",
  },
];

export const miniGameCards = [
  {
    title: "洗手步骤排序",
    hint: "按正确顺序完成洗手任务，解锁洗手闪亮章。",
  },
  {
    title: "排队不拥挤",
    hint: "帮助小朋友按先后顺序站好队，养成安静排队好习惯。",
  },
  {
    title: "勇敢尝一口",
    hint: "选出最温柔的鼓励话术，陪孩子勇敢尝试新食物。",
  },
  {
    title: "午餐小餐盘",
    hint: "挑选适合孩子的餐盘搭配，完成一轮食育小任务。",
  },
];

export const teacherTasks = [
  {
    id: "guide",
    label: "课堂引导语",
    starter: "请为 4-5 岁幼儿生成一段 80 字以内的课堂引导语，语言温柔童趣。",
  },
  {
    id: "story",
    label: "餐前故事",
    starter: "请生成一个 120 字以内的闽南食育小故事，适合午餐前讲给孩子听。",
  },
  {
    id: "home",
    label: "家园共育",
    starter: "请生成一段发给家长的共育话术，说明本周孩子在园所练习的习惯任务。",
  },
  {
    id: "praise",
    label: "鼓励话术",
    starter: "请给一个有点挑食但愿意尝试的孩子写三句鼓励语，必须正向温柔。",
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

export const kindPhrases = [
  {
    text: "你今天愿意闻一闻、看一看，已经很勇敢啦。",
    isPositive: true,
  },
  {
    text: "快吃，不然老师要不高兴了。",
    isPositive: false,
  },
  {
    text: "我们一起试一小口，慢慢来也很棒。",
    isPositive: true,
  },
  {
    text: "你再不吃就不能去玩。",
    isPositive: false,
  },
];

export const storyMissionMap: Record<ThemeId, string[]> = {
  habit: ["完成洗手步骤排序", "帮小队排好队", "说出一句整理提醒"],
  food: ["听完一段食育故事", "说一句鼓励尝试的话", "点亮一枚勇敢尝鲜章"],
};

export const demoRouteSteps = [
  {
    step: "01",
    title: "先看首页",
    description: "30 秒说明项目定位：儿童互动 + 老师辅助 + 已上线可访问。",
  },
  {
    step: "02",
    title: "切到儿童端",
    description: "展示 AI 对话、快捷选项、图片生成和小游戏，最容易吸引评审注意。",
  },
  {
    step: "03",
    title: "打开老师页",
    description: "现场生成课堂引导语或家园共育文案，突出实际教育价值。",
  },
];

export const judgeFocusCards = [
  {
    title: "教育价值",
    description: "把生活习惯养成和闽南食育合并成一个可落地的幼儿成长场景。",
  },
  {
    title: "互动体验",
    description: "孩子不是只看内容，而是能聊天、点选、听播报、玩小游戏和拿勋章。",
  },
  {
    title: "部署能力",
    description: "项目已经完成公网部署，评审可以直接通过线上地址体验完整流程。",
  },
];

export const teacherPitchCards = [
  {
    title: "课堂引导",
    description: "把备课时的零散想法，快速变成适合 4-5 岁幼儿听懂的简短引导语。",
  },
  {
    title: "家园共育",
    description: "老师和家长能围绕同一个主题协同表达，减少家园沟通成本。",
  },
  {
    title: "比赛展示",
    description: "老师页适合演示“一键生成结果并复制带走”，很容易体现实用价值。",
  },
];

export const mealTrayOptions = [
  {
    label: "海蛎煎",
    isHealthy: true,
  },
  {
    label: "紫菜蛋汤",
    isHealthy: true,
  },
  {
    label: "南瓜小块",
    isHealthy: true,
  },
  {
    label: "苹果片",
    isHealthy: true,
  },
  {
    label: "汽水",
    isHealthy: false,
  },
  {
    label: "薯片",
    isHealthy: false,
  },
];
