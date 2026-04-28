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
    headline: "一日生活提醒智能体，练习喝水、洗手、如厕、整理、排队和文明进餐。",
    subtitle: "适合晨间、餐前餐后、如厕整理、排队过渡和班级常规跟进。",
    starter:
      "你好呀，我是幼习宝小星。今天我们一起练一日生活小本领：洗手、喝水、如厕、排队、整理和文明进餐。你想先听哪个 AI 小提醒？",
    choices: ["洗手小任务", "喝水小任务", "如厕小提醒", "整理小能手"],
    imagePrompt:
      "绘本风，明亮温暖，幼儿园教室里，圆润可爱的习惯小星带着孩子洗手、排队、整理书本，奶油黄和海盐蓝配色，儿童插画，高细节，安全友好。",
    badgePool: ["洗手闪亮章", "喝水小勇士章", "排队小队长章", "文明进餐章"],
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
      "儿童绘本风，泉州古城和海边美食小岛场景，海蛎小勇士带着孩子逛古城小吃摊、海边鲜味摊、甜甜清凉摊和家常饭菜摊，画面中有海蛎煎、面线糊、润饼菜、石花膏、土笋冻、炸醋肉、崇武鱼卷，孩子在找食材卡、听小故事，明亮温暖，卡通可爱，安全友好。",
    badgePool: ["闽食小侦探", "食材发现章", "古城小导游", "亲近美食章"],
  },
};

export const lifeHabitKnowledge = [
  {
    key: "喝水",
    cue: "小水杯，双手拿，接半杯，慢慢喝。",
    steps: ["双手拿杯", "接半杯", "坐好慢慢喝", "放回水杯"],
    homeTask: "回家请孩子自己拿水杯，接半杯，坐好慢慢喝一口。",
  },
  {
    key: "洗手",
    cue: "挽袖子，打湿手，搓泡泡，冲干净，擦小手。",
    steps: ["挽袖子", "打湿手", "搓泡泡", "冲干净", "擦小手"],
    homeTask: "饭前请孩子说出洗手顺序，再完成一次洗手。",
  },
  {
    key: "如厕",
    cue: "轻轻进，便后冲，整理好，洗小手。",
    steps: ["轻轻进入", "便后冲水", "整理衣物", "洗小手"],
    homeTask: "回家提醒孩子如厕后冲水、整理衣物、再洗手。",
  },
  {
    key: "整理",
    cue: "玩具回家，书本摆齐，椅子归位。",
    steps: ["玩具回家", "书本摆齐", "椅子归位", "桌面清爽"],
    homeTask: "睡前请孩子把一本书或一个玩具送回原位。",
  },
  {
    key: "排队",
    cue: "不推挤，跟上前，静悄悄，排整齐。",
    steps: ["不推挤", "跟上前", "静悄悄", "排整齐"],
    homeTask: "外出等待时，请孩子练习排队、等待和跟上前面的人。",
  },
  {
    key: "进餐",
    cue: "手扶碗，脚放稳，安静嚼，不撒饭，愿意认识新食物。",
    steps: ["手扶碗", "脚放稳", "安静嚼", "不撒饭", "按需取餐"],
    homeTask: "晚餐时请孩子练一项：手扶碗、慢慢嚼或餐后整理。",
  },
];

export const habitSkillCards = [
  {
    title: "洗手小任务",
    icon: "🫧",
    hint: "饭前便后先洗手，挽袖子、打湿手、搓泡泡、冲干净、擦小手。",
    tone: "bg-cyan-100 text-cyan-900",
    taskName: "洗手常规提醒",
    gameKey: "washSteps",
    badgeName: "洗手闪亮章",
    command: "挽袖子，打湿手，搓泡泡，冲干净，擦小手。",
    rhyme: "小袖子，卷一卷，小泡泡，转圈圈，冲一冲，擦一擦，干净小手来吃饭。",
    question: "饭前第一步可以做什么？",
    actionLabel: "我会先洗手",
    knowledge: "洗手任务用于观察幼儿能否记住饭前便后的基本顺序。",
  },
  {
    title: "喝水小任务",
    icon: "🥤",
    hint: "口渴或活动后，坐好慢慢喝，不拿杯子跑。",
    tone: "bg-sky-100 text-sky-900",
    taskName: "喝水常规提醒",
    gameKey: "queue",
    badgeName: "喝水小勇士章",
    command: "小水杯，双手拿，接半杯，慢慢喝。",
    rhyme: "小水杯，手里拿，接半杯，不洒啦，慢慢喝，身体舒服啦。",
    question: "喝水时身体可以怎么做？",
    actionLabel: "我会慢慢喝",
    knowledge: "喝水任务关注幼儿是否能在活动后主动补水，并保持安全动作。",
  },
  {
    title: "如厕小提醒",
    icon: "🚻",
    hint: "想上厕所先告诉老师，结束后整理衣物再洗手。",
    tone: "bg-teal-100 text-teal-900",
    taskName: "如厕常规提醒",
    gameKey: "queue",
    badgeName: "如厕小提醒章",
    command: "轻轻进，便后冲，整理好，洗小手。",
    rhyme: "如厕轻轻走，便后冲一冲，小手洗干净，自己真能行。",
    question: "想上厕所时可以先做什么？",
    actionLabel: "我会告诉老师",
    knowledge: "如厕提醒帮助幼儿把表达需要、整理衣物和洗手连成稳定流程。",
  },
  {
    title: "排队小队长",
    icon: "🚩",
    hint: "一个跟着一个走，慢慢走，不推不挤。",
    tone: "bg-amber-100 text-amber-900",
    taskName: "排队过渡提醒",
    gameKey: "queue",
    badgeName: "排队小队长章",
    command: "不推挤，跟上前，静悄悄，排整齐。",
    rhyme: "小队伍，一条线，静悄悄，不抢先。",
    question: "排队时可以怎么走？",
    actionLabel: "我会慢慢走",
    knowledge: "排队任务用于观察幼儿在过渡环节是否能等待、跟随和保持安全距离。",
  },
  {
    title: "整理小能手",
    icon: "🧺",
    hint: "玩具、图书、桌面物品都能慢慢归位。",
    tone: "bg-orange-100 text-orange-900",
    taskName: "整理归位提醒",
    gameKey: "queue",
    badgeName: "整理小能手",
    command: "玩具回家，书本摆齐，椅子归位。",
    rhyme: "小玩具，有个家，书本齐，椅子靠，教室笑哈哈。",
    question: "玩完以后可以怎么做？",
    actionLabel: "我送回家",
    knowledge: "整理任务能延伸到阅读区、建构区和餐后桌面，适合老师观察迁移能力。",
  },
  {
    title: "文明进餐操",
    icon: "🥣",
    hint: "扶好碗、坐稳、细嚼慢咽，练午餐前后能用的动作。",
    tone: "bg-amber-100 text-amber-900",
    taskName: "文明进餐动作任务",
    gameKey: "mealManners",
    badgeName: "文明进餐章",
    command: "手扶碗，脚放稳，安静嚼，不撒饭。",
    rhyme: "小手扶碗边，小脚稳稳站，饭菜慢慢嚼，餐后整理好。",
    question: "吃饭时可以先做哪一个好动作？",
    actionLabel: "我会扶好碗",
    knowledge: "进餐习惯不是催孩子吃完，而是练坐稳、慢慢嚼、按需取和餐后整理。",
  },
  {
    title: "好习惯红绿牌",
    icon: "🟢",
    hint: "听一个行为，举绿牌或红牌，再说出正确做法。",
    tone: "bg-emerald-100 text-emerald-900",
    taskName: "红绿牌判断任务",
    gameKey: "habitTrafficLight",
    badgeName: "好习惯判断章",
    command: "听到好习惯举绿牌，看到需要调整的做法举红牌。",
    rhyme: "绿牌亮，好习惯；红牌停，换办法。",
    question: "饭前洗手应该举什么牌？",
    actionLabel: "我会举绿牌",
    knowledge: "红绿牌适合识别进餐、整理、阅读和情绪表达中的正确做法。",
  },
  {
    title: "习惯故事小剧场",
    icon: "📚",
    hint: "听一个好习惯短故事，选答案卡，再完成一个生活小任务。",
    tone: "bg-violet-100 text-violet-900",
    taskName: "听故事做任务",
    gameKey: "readingCheckin",
    badgeName: "故事小耳朵",
    command: "听一个短故事，选一张答案卡，再做一个小习惯。",
    rhyme: "故事听一听，答案选一选，小习惯也亮一点。",
    question: "听完故事后可以做哪一步？",
    actionLabel: "我做小任务",
    knowledge: "故事在本案例中服务一日常规，重点观察幼儿是否能听懂情境并迁移到洗手、喝水、整理、排队或文明进餐。",
  },
];

export const readingCheckinTasks = [
  {
    title: "每日听故事",
    icon: "👂",
    prompt: "我听到了谁？",
    answerCards: ["小星", "小朋友", "会发光的小书"],
    praise: "你认真听到故事角色啦，故事小耳朵亮起来。",
  },
  {
    title: "亲子共读 5 分钟",
    icon: "👨‍👩‍👧",
    prompt: "我看到了什么？",
    answerCards: ["一页图画", "一个角色", "一个好习惯"],
    praise: "你会把看到的画面说出来，阅读小书虫真专注。",
  },
  {
    title: "图书归位",
    icon: "📚",
    prompt: "看完书放哪里？",
    answerCards: ["放回书架", "轻轻合上", "按标记归位"],
    praise: "图书回到自己的家，整理小能手也在发光。",
  },
  {
    title: "故事表达",
    icon: "💬",
    prompt: "我喜欢哪里？",
    answerCards: ["喜欢角色", "喜欢画面", "喜欢一个好办法"],
    praise: "你能说出喜欢的地方，故事表达完成啦。",
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
    title: "故事小耳朵",
    icon: "👂",
    tone: "bg-sky-100 text-sky-900",
  },
  {
    title: "勇敢尝鲜章",
    icon: "🥢",
    tone: "bg-emerald-100 text-emerald-900",
  },
  {
    title: "闽食小勇士章",
    icon: "🚂",
    tone: "bg-amber-100 text-amber-900",
  },
  {
    title: "食材发现章",
    icon: "🧺",
    tone: "bg-cyan-100 text-cyan-900",
  },
  {
    title: "文明进餐章",
    icon: "🍽️",
    tone: "bg-emerald-100 text-emerald-900",
  },
  {
    title: "好习惯判断章",
    icon: "🟢",
    tone: "bg-teal-100 text-teal-900",
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
    label: "一日常规跟进建议",
    starter: "年龄段：中班 4-5 岁。场景：饭前洗手、喝水、排队或整理反复需要提醒。请根据幼儿互动记录生成明日跟进口令、教师观察点和一个可同步家长的小步骤。",
  },
  {
    id: "food-follow",
    label: "闽食进餐/挑食观察建议",
    starter: "年龄段：中班 4-5 岁。幼儿正在认识某种食物。请生成温和食育策略，包含原因理解、靠近小步、课堂小活动和家园同步话术，不贴挑食标签。",
  },
  {
    id: "activity",
    label: "课堂活动方案",
    starter: "年龄段：中班 4-5 岁。活动时长：15-20 分钟。主题：饭前洗手。幼儿已有经验：知道要洗手，但步骤容易漏。希望目标：能按顺序说出并模仿洗手步骤。",
  },
  {
    id: "story",
    label: "故事/绘本引导",
    starter: "请为 4-5 岁幼儿生成一个 3 分钟内可以讲完的互动故事或绘本导入，围绕生活常规或泉州食育，语言温柔、有提问、有结尾小任务。",
  },
  {
    id: "parent-sync",
    label: "家园同步话术",
    starter: "请根据幼儿今天的互动记录，生成一段给家长看的同步话术：孩子完成了什么、老师温和观察到什么、回家可以轻轻做哪一步。",
  },
  {
    id: "encouragement",
    label: "鼓励语",
    starter: "请生成一句适合老师对幼儿说的正向鼓励语，要说具体行为，不比较、不催促，并给出下一小步。",
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

export const minnanFoodKnowledge = [
  {
    label: "海蛎",
    intro: "海蛎是泉州海边常见的小海味，圆圆软软，常出现在海蛎煎里。",
    ingredients: ["海蛎"],
    clue: "灰白小颗、海边鲜味。",
    approach: "先看一看形状，再闻一闻蛋香，不急着入口。",
    homeTask: "回家找一找海蛎煎里有没有海蛎，说出名字就完成一步。",
  },
  {
    label: "紫菜",
    intro: "紫菜像薄薄的小海叶，常在紫菜汤里漂起来。",
    ingredients: ["紫菜", "汤"],
    clue: "深紫色、薄薄的、在汤里会散开。",
    approach: "先看颜色，再喝一小口汤或说出名字。",
    homeTask: "晚餐看到汤时，找一找有没有紫菜。",
  },
  {
    label: "芥菜",
    intro: "芥菜是泉州家常饭菜里的绿色朋友，也会和米饭一起做成芥菜饭。",
    ingredients: ["芥菜", "米饭"],
    clue: "绿色叶子、切成小段。",
    approach: "先找绿色小叶子，再说它叫芥菜。",
    homeTask: "家里吃青菜时，请孩子找一种绿色叶子。",
  },
  {
    label: "蛏子",
    intro: "蛏子来自海边，有长长的壳，泉州餐桌上常能见到。",
    ingredients: ["蛏子"],
    clue: "长长壳、海边味。",
    approach: "先看壳的形状，愿意的话闻一闻。",
    homeTask: "看到海鲜时，说说它的形状是长的还是圆的。",
  },
  {
    label: "炸枣",
    intro: "炸枣是闽南传统小点心，圆圆的，外面香香，里面常有甜甜馅。",
    ingredients: ["糯米粉", "馅料"],
    clue: "圆圆金黄、像小球。",
    approach: "先看圆圆样子，再闻一闻香味。",
    homeTask: "遇到传统点心时，介绍它的颜色和形状。",
  },
  {
    label: "芥菜饭",
    intro: "芥菜饭把米饭和芥菜放在一起，是泉州家常味道。",
    ingredients: ["米饭", "芥菜"],
    clue: "白白米饭里有绿色芥菜。",
    approach: "先找绿色芥菜，再尝旁边一小口米饭。",
    homeTask: "饭桌上找一找米饭里有没有绿色食材。",
  },
  {
    label: "海蛎煎",
    intro: "海蛎煎是泉州常见小吃，金黄金黄，里面有海蛎、鸡蛋和地瓜粉。",
    ingredients: ["海蛎", "鸡蛋", "地瓜粉", "小葱"],
    clue: "金黄边、圆圆饼、能看到小葱点。",
    approach: "先看金黄边、闻蛋香，再尝一点点边边。",
    homeTask: "给家人介绍海蛎煎里的一种食材。",
  },
  {
    label: "面线糊",
    intro: "面线糊是泉州早餐里的暖暖味道，细细软软，适合用勺子慢慢看。",
    ingredients: ["面线", "汤", "葱花"],
    clue: "细细面线、热热汤、软软口感。",
    approach: "先用勺子搅一搅，再说出看到的细面线。",
    homeTask: "早餐时说一句：我看到细细的面线。",
  },
  {
    label: "香菇",
    intro: "香菇像一把小伞，气味比较明显，很多孩子可以先从看和闻开始。",
    ingredients: ["香菇"],
    clue: "小伞形状、棕色、气味明显。",
    approach: "先看小伞形状，再远远闻一闻。",
    homeTask: "今晚不用催入口，只找一找香菇在哪里。",
  },
  {
    label: "小葱",
    intro: "小葱是绿色细细的小香味，常点在汤和海蛎煎上。",
    ingredients: ["小葱"],
    clue: "绿色细条、小小葱花。",
    approach: "先找葱花点点，再说出名字。",
    homeTask: "饭桌上找绿色小葱花，说出名字就完成一步。",
  },
  {
    label: "蒜",
    intro: "蒜有明显气味，常帮助菜变香，可以先远远认识它。",
    ingredients: ["蒜"],
    clue: "白色小瓣、气味冲。",
    approach: "先看白色小瓣，再远远闻一闻。",
    homeTask: "家长做饭时，让孩子远远看一看蒜瓣，不急着尝。",
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
  {
    label: "香菇",
    icon: "🍄",
    stall: "食材观察台",
    clue: "小伞一样，闻起来有特别香味。",
    pictureHint: "找棕色小伞和菇盖纹路。",
    colorShape: "棕色、像小伞、切开会有纹路。",
    ingredients: ["香菇", "清汤", "米饭或肉粽"],
    ingredientIntro: "香菇是很多闽南家常菜里的香味食材，味道比较明显，可以先看样子和闻一闻。",
    cultureStory: "泉州家常饭菜、肉粽或汤里常会看到香菇，它会让饭菜更香。",
    gentleTryTip: "如果不喜欢香菇味，可以先找小伞形状，再闻一下，不急着吃。",
    approachSteps: ["看小伞", "闻一闻", "摸一摸边边", "尝米饭里的香味"],
  },
  {
    label: "小葱",
    icon: "🌿",
    stall: "食材观察台",
    clue: "绿绿细细，常常撒在汤和面线糊上。",
    pictureHint: "找绿色小圈圈或细细葱花。",
    colorShape: "绿色、细细碎碎、像小圆圈。",
    ingredients: ["小葱", "清汤", "面线糊"],
    ingredientIntro: "小葱常被切成小葱花，撒在汤、面线糊或鱼卷里，颜色很明显。",
    cultureStory: "很多泉州热汤和小吃上会撒一点葱花，让香味更明显。",
    gentleTryTip: "如果看到绿色葱花有点担心，可以先用勺子找一找、闻一闻，再决定靠近哪一步。",
    approachSteps: ["找绿色小圈", "闻葱香", "用勺拨一拨", "尝一点汤"],
  },
  {
    label: "蒜",
    icon: "🧄",
    stall: "食材观察台",
    clue: "白白小瓣，味道比较明显。",
    pictureHint: "找白色小蒜瓣或蒜蓉点。",
    colorShape: "白色、小瓣、切碎后像小点点。",
    ingredients: ["蒜", "蒜蓉酱", "家常调味"],
    ingredientIntro: "蒜常被做成蒜蓉或调味，味道很明显，孩子可以先认识名字和气味。",
    cultureStory: "泉州小吃有时会搭配蒜蓉酱，先认识它的味道也是一种食育探索。",
    gentleTryTip: "如果觉得蒜味很冲，可以先远远闻一闻，说出它的名字就很好。",
    approachSteps: ["看白色小瓣", "远远闻一闻", "找蒜蓉点", "说出名字"],
  },
];

export const foodTrainStations = [
  {
    label: "泉州海蛎煎",
    icon: "🦪",
    station: "海边金黄站",
    chant: "海蛎煎，金黄边，海味香香进小店。",
    command: "小列车进站，请找到海蛎煎。",
    ingredients: ["海蛎", "鸡蛋", "地瓜粉"],
  },
  {
    label: "面线糊",
    icon: "🥣",
    station: "古城暖汤站",
    chant: "面线糊，细又柔，热热一碗慢慢瞅。",
    command: "小列车进站，请找到面线糊。",
    ingredients: ["面线", "清汤", "葱花"],
  },
  {
    label: "紫菜汤",
    icon: "🌊",
    station: "海风紫菜站",
    chant: "紫菜汤，海风香，小勺轻轻尝一尝。",
    command: "小列车进站，请找到紫菜汤。",
    ingredients: ["紫菜", "清汤", "虾米"],
  },
  {
    label: "芥菜饭",
    icon: "🥬",
    station: "家常绿叶站",
    chant: "芥菜饭，绿叶香，米粒粒粒有力量。",
    command: "小列车进站，请找到芥菜饭。",
    ingredients: ["芥菜", "米饭", "香菇"],
  },
  {
    label: "蛏子",
    icon: "🦪",
    station: "海边贝壳站",
    chant: "小蛏子，住海边，贝壳开合像小船。",
    command: "小列车进站，请找到蛏子。",
    ingredients: ["蛏子", "姜丝", "清汤"],
  },
  {
    label: "炸枣",
    icon: "🟠",
    station: "甜甜糕点站",
    chant: "炸枣圆，香又甜，先看圆圆小笑脸。",
    command: "小列车进站，请找到炸枣。",
    ingredients: ["糯米粉", "豆沙", "芝麻"],
  },
  {
    label: "润饼菜",
    icon: "🌯",
    station: "古城卷卷站",
    chant: "润饼菜，卷起来，蔬菜朋友排成排。",
    command: "小列车进站，请找到润饼菜。",
    ingredients: ["薄饼皮", "包菜", "花生碎"],
  },
  {
    label: "石花膏",
    icon: "🍧",
    station: "清凉甜甜站",
    chant: "石花膏，透明亮，清清凉凉慢慢尝。",
    command: "小列车进站，请找到石花膏。",
    ingredients: ["石花膏", "蜂蜜水", "水果丁"],
  },
  {
    label: "土笋冻",
    icon: "🧊",
    station: "透明小冻站",
    chant: "土笋冻，亮晶晶，先看样子听故事。",
    command: "小列车进站，请找到土笋冻。",
    ingredients: ["土笋冻原料", "清汤冻", "蒜蓉酱"],
  },
  {
    label: "闽南肉粽",
    icon: "🍙",
    station: "粽叶香香站",
    chant: "肉粽香，粽叶包，米粒朋友抱一抱。",
    command: "小列车进站，请找到闽南肉粽。",
    ingredients: ["糯米", "粽叶", "香菇"],
  },
  {
    label: "崇武鱼卷",
    icon: "🐟",
    station: "海边鱼卷站",
    chant: "鱼卷白，圆片片，海边味道慢慢见。",
    command: "小列车进站，请找到崇武鱼卷。",
    ingredients: ["鱼肉", "地瓜粉", "葱花"],
  },
];

export const foodGuessRounds = [
  {
    answer: "海蛎",
    icon: "🦪",
    treasure: "海边宝箱",
    hints: ["来自海边", "小小软软", "可以做成泉州海蛎煎"],
    options: ["海蛎", "芥菜", "面线", "鱼肉"],
    praise: "你找到海蛎啦，可以播报：海蛎是海边来的鲜味食材。",
  },
  {
    answer: "面线",
    icon: "🥣",
    treasure: "古城宝箱",
    hints: ["细细长长", "放进热汤里软软的", "可以做成面线糊"],
    options: ["紫菜", "面线", "虾米", "地瓜粉"],
    praise: "你找到面线啦，可以播报：面线细细软软，是面线糊里的主角。",
  },
  {
    answer: "芥菜",
    icon: "🥬",
    treasure: "绿叶宝箱",
    hints: ["绿绿叶子", "有一点清香", "可以和米饭做成芥菜饭"],
    options: ["芥菜", "海蛎", "蛏子", "鱼肉"],
    praise: "你找到芥菜啦，可以播报：芥菜是绿叶食材，能做家常芥菜饭。",
  },
  {
    answer: "地瓜粉",
    icon: "⭐",
    treasure: "小厨师宝箱",
    hints: ["白白细细", "能让边边软糯", "海蛎煎里常见它"],
    options: ["面线", "紫菜", "地瓜粉", "虾米"],
    praise: "你找到地瓜粉啦，可以播报：地瓜粉能让海蛎煎有软糯口感。",
  },
  {
    answer: "香菇",
    icon: "🍄",
    treasure: "香香小伞宝箱",
    hints: ["像一把小伞", "味道比较明显", "肉粽、汤里都可能遇到它"],
    options: ["香菇", "小葱", "蒜", "紫菜"],
    praise: "你找到香菇啦，可以播报：香菇像小伞，先闻一闻、看一看也很勇敢。",
  },
  {
    answer: "小葱",
    icon: "🌿",
    treasure: "绿绿细丝宝箱",
    hints: ["绿绿细细", "常撒在面线糊上", "有一点清香味"],
    options: ["小葱", "芥菜", "海蛎", "地瓜粉"],
    praise: "你找到小葱啦，可以播报：小葱是绿色的小配料，会让食物更香。",
  },
  {
    answer: "蒜",
    icon: "🧄",
    treasure: "白白小瓣宝箱",
    hints: ["白白一瓣一瓣", "味道很明显", "可以做成蒜蓉酱"],
    options: ["蒜", "虾米", "面线", "鱼肉"],
    praise: "你找到蒜啦，可以播报：蒜味道很特别，先认识名字也是进步。",
  },
  {
    answer: "紫菜",
    icon: "🌊",
    treasure: "海风薄片宝箱",
    hints: ["来自海里", "薄薄一片", "可以做成紫菜汤"],
    options: ["紫菜", "面线", "小葱", "芥菜"],
    praise: "你找到紫菜啦，可以播报：紫菜来自海边，放进汤里软软的。",
  },
];

export const mealMannerActions = [
  {
    label: "小手扶好碗",
    icon: "🥣",
    command: "小手扶好碗，饭菜不乱跑。",
  },
  {
    label: "小脚放稳",
    icon: "🪑",
    command: "小脚放稳稳，身体坐舒服。",
  },
  {
    label: "嘴巴轻轻嚼",
    icon: "🥢",
    command: "嘴巴轻轻嚼，细嚼慢慢咽。",
  },
  {
    label: "食物不乱撒",
    icon: "🧻",
    command: "饭菜慢慢送入口，食物尽量不乱撒。",
  },
  {
    label: "餐后会整理",
    icon: "🧺",
    command: "餐后收一收，碗筷桌面都有家。",
  },
  {
    label: "轻声说需要",
    icon: "🤲",
    command: "想添饭、想喝水，轻声告诉老师。",
  },
  {
    label: "愿意靠近一步",
    icon: "🌱",
    command: "陌生食物先看一看、闻一闻，愿意靠近就是进步。",
  },
  {
    label: "感谢做饭人",
    icon: "💛",
    command: "吃到饭菜说谢谢，记得有人辛苦做出来。",
  },
];

export const habitTrafficLightCards = [
  {
    behavior: "饭前洗手",
    icon: "🧼",
    answer: "green",
    goodPractice: "饭前洗手是好习惯，小手干净再用餐。",
  },
  {
    behavior: "边吃边玩",
    icon: "🧸",
    answer: "red",
    goodPractice: "这个做法需要换一换，我们可以这样做：吃饭时先照顾小肚子，玩具等一等。",
  },
  {
    behavior: "细嚼慢咽",
    icon: "🥢",
    answer: "green",
    goodPractice: "慢慢嚼、轻轻咽，身体更舒服。",
  },
  {
    behavior: "撒饭不收拾",
    icon: "🍚",
    answer: "red",
    goodPractice: "这个做法需要换一换，我们可以这样做：不小心撒了饭，可以请老师帮忙一起整理。",
  },
  {
    behavior: "看完书放回书架",
    icon: "📚",
    answer: "green",
    goodPractice: "看完书放回书架，是照顾图书的好习惯。",
  },
  {
    behavior: "上课时大声打断别人",
    icon: "🙋",
    answer: "red",
    goodPractice: "这个做法需要换一换，我们可以这样做：先举小手，等老师看到再轻声说。",
  },
  {
    behavior: "生气时说“我有点难过”",
    icon: "🌤️",
    answer: "green",
    goodPractice: "能说出自己的心情，是照顾自己的好办法。",
  },
  {
    behavior: "拿着水杯跑来跑去",
    icon: "🥤",
    answer: "red",
    goodPractice: "这个做法需要换一换，我们可以这样做：拿水杯时慢慢走，坐稳再喝水。",
  },
  {
    behavior: "愿意先看一看陌生菜",
    icon: "👀",
    answer: "green",
    goodPractice: "愿意先看一看、闻一闻，就是靠近新食物的一小步。",
  },
  {
    behavior: "把不爱吃的菜偷偷丢掉",
    icon: "🗑️",
    answer: "red",
    goodPractice: "这个做法需要换一换，我们可以告诉老师：我还在认识它，先试一小步。",
  },
  {
    behavior: "听完故事说一个角色",
    icon: "📖",
    answer: "green",
    goodPractice: "听完故事能说一个角色，说明小耳朵和小脑袋都在认真工作。",
  },
  {
    behavior: "图书看完随手放地上",
    icon: "📚",
    answer: "red",
    goodPractice: "这个做法需要换一换，看完书要送回书架，让下一位小朋友也能找到。",
  },
];

export const foodPreferenceReasons = [
  {
    label: "味道重",
    icon: "👃",
    strategy: "先承认味道比较明显，允许孩子先看一看、闻一闻，不急着入口。",
  },
  {
    label: "气味冲",
    icon: "🌬️",
    strategy: "先远远闻一闻，说出这是什么气味，再选择是否靠近一点。",
  },
  {
    label: "口感怪",
    icon: "🥄",
    strategy: "先摸一摸或看一看口感特点，也可以只尝一点汤汁或旁边米饭。",
  },
  {
    label: "颜色不熟悉",
    icon: "🎨",
    strategy: "请孩子找一找颜色、形状和食材名字，把陌生感变成观察任务。",
  },
  {
    label: "太硬",
    icon: "🥕",
    strategy: "先看形状和颜色，必要时请成人切小、煮软，再由孩子选择一小步。",
  },
  {
    label: "太滑",
    icon: "🥣",
    strategy: "先用勺子看一看、碰一碰，等孩子熟悉后再尝一点点。",
  },
  {
    label: "今天没胃口",
    icon: "☁️",
    strategy: "先接纳状态，保留少量尝试机会，不用催促或贴标签。",
  },
  {
    label: "以前没吃过",
    icon: "❔",
    strategy: "把陌生感变成认识任务：先说名字、找食材，再选择一个靠近小步。",
  },
];

export const foodPreferenceApproachSteps = [
  "看一看",
  "闻一闻",
  "碰一碰",
  "尝一点汤汁",
  "尝旁边米饭",
  "说出名字",
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

export const foodReporterFoods = [
  {
    label: "泉州海蛎煎",
    icon: "🦪",
    ingredientText: "里面有海蛎、鸡蛋、地瓜粉和小葱。",
    discoveryText: "金黄金黄，边边香香，像海边来的小饼。",
    reporterLine: "大家好，我介绍的是泉州海蛎煎。它金黄金黄，里面有海蛎和鸡蛋，是泉州海边的香香味道。",
  },
  {
    label: "面线糊",
    icon: "🥣",
    ingredientText: "里面有细细的面线、热汤和葱花。",
    discoveryText: "细细软软，热乎乎，常在早餐时候出现。",
    reporterLine: "大家好，我介绍的是面线糊。它细细软软，里面有面线和葱花，是泉州早餐里的暖暖味道。",
  },
  {
    label: "润饼菜",
    icon: "🌯",
    ingredientText: "里面有薄饼皮、蔬菜和一点点家常配料。",
    discoveryText: "卷起来像小被子，能看到很多颜色。",
    reporterLine: "大家好，我介绍的是润饼菜。它用薄饼皮卷起蔬菜，颜色很多，是泉州家常的清爽味道。",
  },
  {
    label: "石花膏",
    icon: "🍧",
    ingredientText: "用石花草做成透明清凉的小甜品。",
    discoveryText: "透明、凉凉、会轻轻晃，夏天很常见。",
    reporterLine: "大家好，我介绍的是石花膏。它透明凉凉，是泉州夏天常见的清凉甜品。",
  },
  {
    label: "土笋冻",
    icon: "🧊",
    ingredientText: "来自海边食材，做成透明弹弹的小冻。",
    discoveryText: "圆圆透明，凉凉弹弹，可以先看样子。",
    reporterLine: "大家好，我介绍的是土笋冻。它透明弹弹，是泉州海边常见的特别小吃。",
  },
  {
    label: "崇武鱼卷",
    icon: "🐟",
    ingredientText: "里面有鱼肉，卷成圆圆长长的样子。",
    discoveryText: "白白圆圆，切开像小圆片，常放在汤里。",
    reporterLine: "大家好，我介绍的是崇武鱼卷。它用鱼肉做成，圆圆白白，是泉州海边的鲜味。",
  },
  {
    label: "闽南肉粽",
    icon: "🍙",
    ingredientText: "里面有糯米、粽叶、香菇和家常配料。",
    discoveryText: "三角形，粽叶香，打开能看到亮亮米粒。",
    reporterLine: "大家好，我介绍的是闽南肉粽。它用粽叶包着米粒和香菇，是泉州家常的香香味道。",
  },
];

export const foodKitchenRecipes = [
  {
    label: "泉州海蛎煎",
    icon: "🦪",
    area: "海边鲜味小厨房",
    actions: ["洗一洗海蛎", "拌一拌鸡蛋和地瓜粉", "煎一煎金黄边", "摆一摆小盘子"],
    chant: "洗一洗，拌一拌，煎出金黄边，小厨师请上盘。",
  },
  {
    label: "面线糊",
    icon: "🥣",
    area: "古城早餐小厨房",
    actions: ["看一看细面线", "搅一搅热汤", "盛一盛小碗", "说一句暖暖的"],
    chant: "细面线，热汤汤，慢慢搅，轻轻尝。",
  },
  {
    label: "润饼菜",
    icon: "🌯",
    area: "家常卷卷小厨房",
    actions: ["铺一铺薄饼皮", "放一放蔬菜", "卷一卷食材", "介绍一下颜色"],
    chant: "薄饼皮，蔬菜彩，卷一卷，介绍来。",
  },
  {
    label: "石花膏",
    icon: "🍧",
    area: "甜甜清凉小厨房",
    actions: ["舀一舀石花膏", "加一加清甜水", "拌一拌小勺子", "分享一句发现"],
    chant: "透明冻，轻轻晃，拌一拌，清凉香。",
  },
  {
    label: "闽南肉粽",
    icon: "🍙",
    area: "粽叶香香小厨房",
    actions: ["看一看粽叶", "找一找米粒", "闻一闻香菇味", "介绍一下形状"],
    chant: "粽叶包，米粒亮，闻一闻，香香香。",
  },
];

export const storyMissionMap: Record<ThemeId, string[]> = {
  habit: ["生活习惯", "进餐习惯", "阅读表达", "安全与情绪"],
  food: ["闽食小列车", "美食猜猜乐", "闽食小小播报员", "泉州小厨房"],
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

type TeacherGroupActivityCard = {
  title: string;
  themeId: ThemeId;
  scene: string;
  goal: string;
  steps: string[];
  aiCanGenerate: string;
};

export const teacherGroupActivityCards: TeacherGroupActivityCard[] = [
  {
    title: "文明进餐操",
    themeId: "habit" as const,
    scene: "午餐前、点心前、过渡环节",
    goal: "幼儿能跟随口令模仿扶碗、坐稳、细嚼慢咽和餐后整理动作。",
    steps: ["听动作口令", "模仿一个动作", "说出好习惯", "迁移到午餐环节"],
    aiCanGenerate: "动作口令、节奏儿歌、打卡话术、家园同步建议",
  },
  {
    title: "好习惯红绿牌",
    themeId: "habit" as const,
    scene: "生活习惯集体游戏、安全判断活动",
    goal: "幼儿能判断进餐和生活行为，看到需要调整的做法时说出替代动作。",
    steps: ["听行为", "举绿牌或红牌", "听正确做法", "演一演替代动作"],
    aiCanGenerate: "判断题、正确做法提示、表扬语、家庭复习话术",
  },
  {
    title: "习惯故事小剧场",
    themeId: "habit" as const,
    scene: "餐前餐后、排队过渡、整理后、午睡前短故事",
    goal: "幼儿能听完一个生活习惯短故事，选择答案卡，并完成一个洗手、喝水、排队、整理或文明进餐小任务。",
    steps: ["说想听的习惯故事", "听短故事", "选答案卡", "完成一个小习惯"],
    aiCanGenerate: "习惯短故事、答案卡、生活小任务、家园同步话术、表扬语",
  },
  {
    title: "闽食小小播报员",
    themeId: "food" as const,
    scene: "语言区、表演区、班级展示",
    goal: "幼儿能选择一种泉州美食，用名字、食材和发现组成一句小小播报词。",
    steps: ["选一种美食", "听提示卡", "组合介绍句", "上台播报或同伴分享"],
    aiCanGenerate: "播报示范、上台口令、表扬语、家园介绍任务",
  },
  {
    title: "泉州小厨房",
    themeId: "food" as const,
    scene: "生活区、角色区、食育区域活动",
    goal: "幼儿能按顺序点制作动作卡，参与泉州美食角色扮演，理解帮忙和整理。",
    steps: ["选一道美食", "按步骤做动作", "念小厨师口令", "分享完成感受"],
    aiCanGenerate: "小厨师口令、步骤儿歌、区域材料建议、家庭小任务",
  },
  {
    title: "珍惜粮食小列车",
    themeId: "habit" as const,
    scene: "进餐习惯、劳动教育、家园共育",
    goal: "幼儿能理解按需取餐、感谢劳动、餐后整理是珍惜粮食的小行动。",
    steps: ["听粮食旅行故事", "选按需取餐", "感谢劳动", "餐后整理打卡"],
    aiCanGenerate: "粮食旅行故事、进餐口号、感谢语、家庭小管家任务",
  },
  {
    title: "家庭美食小管家",
    themeId: "habit" as const,
    scene: "家园共育、进餐习惯延续、亲子任务",
    goal: "幼儿能在家参与饭前洗手、摆碗筷、尝试一小步和餐后整理。",
    steps: ["饭前洗手", "摆碗筷", "说一种食物发现", "餐后整理一个小地方"],
    aiCanGenerate: "家庭任务卡、亲子提醒语、家园同步建议、温和表扬语",
  },
  {
    title: "睡前故事小回顾",
    themeId: "habit" as const,
    scene: "离园前谈话、睡前亲子共读、家庭延续反馈",
    goal: "幼儿能回顾今天听到的故事或认识的食物，说出一个角色、画面或明天愿意尝试的一小步。",
    steps: ["回想今天故事", "说一个角色或画面", "说一个小发现", "约定明天一小步"],
    aiCanGenerate: "睡前回顾问题、亲子共读任务、家庭反馈话术、鼓励语",
  },
];

export const parentHomeTaskCards = [
  {
    title: "一日常规小接力",
    icon: "✨",
    tasks: ["饭前洗手", "主动喝水", "需要如厕会表达", "等待轮流", "整理玩具图书"],
  },
  {
    title: "习惯故事居家任务",
    icon: "📚",
    tasks: ["亲子共读 5 分钟", "孩子说一个角色", "讲一个画面", "看完书放回原位", "给老师留一句"],
  },
  {
    title: "家庭美食小管家",
    icon: "🏠",
    tasks: ["饭前洗手", "摆碗筷", "文明进餐", "感谢做饭的人", "餐后整理"],
  },
  {
    title: "亲子尝新小挑战",
    icon: "🥢",
    tasks: ["看一看", "闻一闻", "摸一摸", "尝米粒或汤汁", "说一个发现"],
  },
  {
    title: "香菇葱蒜观察卡",
    icon: "🍄",
    tasks: ["找一找香菇", "认一认小葱", "闻一闻蒜味", "不急着吃", "说出名字就打卡"],
  },
  {
    title: "睡前美食/故事小回顾",
    icon: "🌙",
    tasks: ["今天认识了什么", "哪一个味道最熟悉", "哪一种还陌生", "明天想试哪一小步"],
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
