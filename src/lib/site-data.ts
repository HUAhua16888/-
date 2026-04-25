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
    choices: ["练习七步洗手", "排队慢慢走", "玩具送回家"],
    imagePrompt:
      "绘本风，明亮温暖，幼儿园教室里，圆润可爱的习惯小星带着孩子洗手、排队、整理书本，奶油黄和海盐蓝配色，儿童插画，高细节，安全友好。",
    badgePool: ["洗手闪亮章", "整理小能手", "喝水勇士章", "排队小队长"],
  },
  food: {
    id: "food",
    label: "闽食成长岛",
    emoji: "🦪",
    headline: "和海蛎小勇士一起认识闽南美食，勇敢尝试新食物。",
    subtitle: "适合餐前引导、食育故事和家园共育。",
    starter:
      "欢迎来到闽食成长岛，我是海蛎小勇士。今天我们要认识海蛎、紫菜和芥菜，还会玩一个勇敢尝一口的小挑战。你想先听哪一种美食故事？",
    choices: ["看一看海蛎煎", "闻一闻紫菜汤", "勇敢尝一小口"],
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
    title: "成长闯关图卡",
    description: "习惯养成、闽食探索、勋章打卡和图卡任务能自然串成一条成长路线。",
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
    value: "AI 对话 + 4 个小游戏",
  },
  {
    label: "部署状态",
    value: "香港服务器已上线",
  },
];

export const showcaseHighlights = [
  {
    title: "入口清晰",
    description: "首页、儿童互动、老师辅助三条主线清晰，第一次使用也能快速找到入口。",
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

export const posterVisionCards = [
  {
    title: "会聊天",
    icon: "🤖",
    caption: "一句话就能推进故事",
    tone: "bg-teal-100 text-teal-900",
  },
  {
    title: "会听说",
    icon: "🎧",
    caption: "语音输入 + 童声播报",
    tone: "bg-amber-100 text-amber-900",
  },
  {
    title: "会奖励",
    icon: "🏅",
    caption: "勋章、贴纸、任务卡一起用",
    tone: "bg-rose-100 text-rose-900",
  },
  {
    title: "会打卡",
    icon: "📸",
    caption: "闽食光盘拍图上传入口",
    tone: "bg-cyan-100 text-cyan-900",
  },
  {
    title: "会上线",
    icon: "🚀",
    caption: "公网可访问，打开就能用",
    tone: "bg-emerald-100 text-emerald-900",
  },
  {
    title: "会辅助",
    icon: "🧑‍🏫",
    caption: "老师家长一键生成内容",
    tone: "bg-violet-100 text-violet-900",
  },
];

export const posterJourneySteps = [
  {
    step: "A",
    icon: "🏝️",
    title: "先进成长岛",
  },
  {
    step: "B",
    icon: "💬",
    title: "再和 AI 聊一轮",
  },
  {
    step: "C",
    icon: "🖼️",
    title: "切图卡或插图",
  },
  {
    step: "D",
    icon: "🏆",
    title: "最后点亮勋章",
  },
];

export const serviceSceneCards = [
  {
    title: "家庭陪伴",
    icon: "👨‍👩‍👧",
    description: "晚饭后聊一轮习惯故事，再点亮一枚贴纸勋章。",
  },
  {
    title: "晨间谈话",
    icon: "🌞",
    description: "先看一张能力图卡，再让孩子点选回答进入状态。",
  },
  {
    title: "餐前食育",
    icon: "🍲",
    description: "讲一段闽食小故事，再试着勇敢闻一闻、尝一口。",
  },
  {
    title: "阅读角延伸",
    icon: "📖",
    description: "听完故事后重听上一句，把语言和阅读习惯连起来。",
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
    title: "礼貌微笑章",
    icon: "😊",
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

export const adventureFeaturePills = [
  {
    label: "AI 剧情",
    icon: "💬",
  },
  {
    label: "插图节点",
    icon: "🖼️",
  },
  {
    label: "语音播报",
    icon: "🔊",
  },
  {
    label: "拍图打卡",
    icon: "📸",
  },
  {
    label: "闯关勋章",
    icon: "🏅",
  },
  {
    label: "老师辅助",
    icon: "🧑‍🏫",
  },
];

export const mealPhotoChecklist = [
  "先拍清楚整张餐盘，再上传到网站。",
  "建议先讲闽食故事，再带孩子完成一次拍图打卡。",
  "当前版本先支持上传预览，后续接视觉模型可做剩饭识别和闽食识别。",
];

export const teacherTasks = [
  {
    id: "guide",
    label: "晨间接待",
    starter: "请为 4-5 岁幼儿生成一段晨间接待引导语，帮助孩子从入园情绪过渡到今天的好习惯练习。",
  },
  {
    id: "story",
    label: "餐前提醒",
    starter: "请生成一段 120 字以内的餐前提醒或闽南食育小故事，鼓励孩子愿意观察、闻一闻、尝一尝。",
  },
  {
    id: "home",
    label: "家长同步",
    starter: "请生成一段发给家长的共育话术，说明孩子今天在园所完成的习惯或闽食探索任务。",
  },
  {
    id: "praise",
    label: "情绪安抚",
    starter: "请给一个刚入园有点紧张、但愿意慢慢尝试的孩子写三句情绪安抚和鼓励话术。",
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
    description: "先了解网站的两个主题线和主要功能入口。",
  },
  {
    step: "02",
    title: "切到儿童端",
    description: "体验 AI 对话、快捷选项、图片生成和小游戏。",
  },
  {
    step: "03",
    title: "打开老师页",
    description: "继续生成课堂引导语或家园共育内容，形成完整闭环。",
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
    description: "项目已经完成公网部署，老师和家长可以直接通过线上地址体验完整流程。",
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
    title: "内容带走",
    description: "生成结果支持复制、试播和二次调整，方便老师和家长直接拿去用。",
  },
];

export const teacherWorkflowCards = [
  {
    title: "晨间接待",
    icon: "☀️",
    description: "接住入园情绪、放好书包，再把孩子带进今天的小任务。",
  },
  {
    title: "餐前提醒",
    icon: "🍽️",
    description: "从洗手、等待、看一看闻一闻开始，温柔引出闽食探索。",
  },
  {
    title: "情绪安抚",
    icon: "🌈",
    description: "遇到想家、紧张或不愿参与时，先共情，再给一个小台阶。",
  },
  {
    title: "家长同步",
    icon: "💌",
    description: "说清孩子今天完成了什么，也给家里一句能接上的鼓励。",
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
