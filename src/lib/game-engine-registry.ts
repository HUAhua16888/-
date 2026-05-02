import type { MiniGameKey } from "@/lib/growth-archive";
import type { ThemeId } from "@/lib/site-data";

export const gameEngineVersion = "0.9.5";
export const gameEngineSchemaVersion = 3;

export type GameEngineMode = "sequence" | "choice" | "voice" | "upload" | "mixed";
export type GameEngineVerb = "choose" | "sort" | "speak" | "observe" | "upload" | "match" | "act";
export type GameEngineClearMode = "ordered" | "unique" | "score";
export type GameEngineMechanic =
  | "cleanSteps"
  | "queueDistance"
  | "dailyJudge"
  | "storyTheater"
  | "tableRhythm"
  | "trafficCards"
  | "kindWords"
  | "todayMenu"
  | "stallHunt"
  | "clueMatch"
  | "foodTrain"
  | "foodGuess"
  | "approachLadder"
  | "foodReporter"
  | "foodKitchen"
  | "peerEncourage"
  | "mealTray";

export type GameEngineDefinition = {
  gameKey: MiniGameKey;
  themeId: ThemeId;
  title: string;
  clearMode: GameEngineClearMode;
  mechanic: GameEngineMechanic;
  modes: GameEngineMode[];
  verbs: GameEngineVerb[];
  steps: string[];
  minActions: number;
  maxScore: number;
  rules: string[];
};

export const gameEngineDefinitions: GameEngineDefinition[] = [
  {
    gameKey: "washSteps",
    themeId: "habit",
    title: "洗手小任务",
    clearMode: "ordered",
    mechanic: "cleanSteps",
    modes: ["sequence", "choice"],
    verbs: ["sort", "act"],
    steps: ["打湿", "搓泡泡", "冲干净", "擦小手"],
    minActions: 4,
    maxScore: 100,
    rules: ["按洗手步骤顺序收集", "顺序错误会打断连击", "泡泡护盾可抵消一次干扰"],
  },
  {
    gameKey: "queue",
    themeId: "habit",
    title: "排队小队长",
    clearMode: "ordered",
    mechanic: "queueDistance",
    modes: ["sequence", "choice"],
    verbs: ["choose", "act"],
    steps: ["看前面", "等一等", "不挤一挤"],
    minActions: 3,
    maxScore: 100,
    rules: ["沿队伍安全线移动", "离队太远会扣生命", "依次完成排队动作"],
  },
  {
    gameKey: "habitJudge",
    themeId: "habit",
    title: "一日生活常规任务",
    clearMode: "score",
    mechanic: "dailyJudge",
    modes: ["choice", "mixed"],
    verbs: ["choose", "act"],
    steps: ["看情境", "选做法", "说一小步"],
    minActions: 2,
    maxScore: 100,
    rules: ["收集正确常规卡", "避开不合适行为卡", "连击提升判断能量"],
  },
  {
    gameKey: "readingCheckin",
    themeId: "habit",
    title: "习惯故事小剧场",
    clearMode: "ordered",
    mechanic: "storyTheater",
    modes: ["voice", "choice", "mixed"],
    verbs: ["speak", "choose", "act"],
    steps: ["听故事", "选角色", "说发现", "做一步"],
    minActions: 2,
    maxScore: 100,
    rules: ["按四幕故事顺序推进", "乱序会停留在当前幕", "完成后记录阅读打卡"],
  },
  {
    gameKey: "kindWords",
    themeId: "food",
    title: "亲切表达收集",
    clearMode: "score",
    mechanic: "kindWords",
    modes: ["voice", "choice"],
    verbs: ["speak", "choose"],
    steps: ["听同伴说", "选鼓励语", "说一句"],
    minActions: 2,
    maxScore: 100,
    rules: ["接住礼貌表达泡泡", "避开着急和抢话", "连击形成温柔能量"],
  },
  {
    gameKey: "todayMenu",
    themeId: "food",
    title: "今日食谱认识",
    clearMode: "unique",
    mechanic: "todayMenu",
    modes: ["choice", "mixed"],
    verbs: ["observe", "choose"],
    steps: ["点菜品", "听播报", "听营养"],
    minActions: 1,
    maxScore: 100,
    rules: ["点击真实菜品或重点食材", "营养播放后写入观察事件", "同一幼儿可在多设备追加记录"],
  },
  {
    gameKey: "foodObserve",
    themeId: "food",
    title: "泉州美食摊位寻宝",
    clearMode: "unique",
    mechanic: "stallHunt",
    modes: ["choice", "mixed"],
    verbs: ["observe", "match", "choose"],
    steps: ["找摊位", "找食材", "说发现"],
    minActions: 3,
    maxScore: 100,
    rules: ["在摊位地图收集不同美食", "重复摊位只给少量分", "集齐关键摊位通关"],
  },
  {
    gameKey: "foodClue",
    themeId: "food",
    title: "食材线索",
    clearMode: "ordered",
    mechanic: "clueMatch",
    modes: ["choice", "mixed"],
    verbs: ["observe", "match"],
    steps: ["听线索", "找食材", "确认答案"],
    minActions: 2,
    maxScore: 100,
    rules: ["按照当前线索找食材", "拿错食材会打断线索链", "全部线索匹配后通关"],
  },
  {
    gameKey: "foodTrain",
    themeId: "food",
    title: "闽食小列车",
    clearMode: "ordered",
    mechanic: "foodTrain",
    modes: ["sequence", "choice"],
    verbs: ["choose", "sort"],
    steps: ["听站名", "找美食", "上小列车"],
    minActions: 3,
    maxScore: 100,
    rules: ["按站名顺序到站", "错误站点会扣生命", "站点越准列车越快"],
  },
  {
    gameKey: "foodGuess",
    themeId: "food",
    title: "美食猜猜乐",
    clearMode: "unique",
    mechanic: "foodGuess",
    modes: ["choice", "mixed"],
    verbs: ["observe", "choose"],
    steps: ["看线索", "猜食材", "听反馈"],
    minActions: 2,
    maxScore: 100,
    rules: ["收集不同感官线索", "重复线索降分", "错误答案会扣生命"],
  },
  {
    gameKey: "foodPreference",
    themeId: "food",
    title: "美食认识观察卡",
    clearMode: "ordered",
    mechanic: "approachLadder",
    modes: ["choice", "voice", "mixed"],
    verbs: ["observe", "choose", "speak"],
    steps: ["认一认", "选原因", "选靠近小步"],
    minActions: 3,
    maxScore: 100,
    rules: ["按看闻摸尝说阶梯靠近", "不能跳步", "尊重不强迫"],
  },
  {
    gameKey: "foodReporter",
    themeId: "food",
    title: "闽食小小播报员",
    clearMode: "ordered",
    mechanic: "foodReporter",
    modes: ["voice", "mixed"],
    verbs: ["speak", "observe"],
    steps: ["听范例", "选美食", "播报一句"],
    minActions: 2,
    maxScore: 100,
    rules: ["依次组装播报词", "完成名字食材发现家乡四段", "通关后写入成长记录"],
  },
  {
    gameKey: "foodKitchen",
    themeId: "food",
    title: "泉州小厨房",
    clearMode: "ordered",
    mechanic: "foodKitchen",
    modes: ["sequence", "choice", "mixed"],
    verbs: ["sort", "choose", "act"],
    steps: ["选菜名", "排步骤", "说做法"],
    minActions: 3,
    maxScore: 100,
    rules: ["按厨房操作顺序收集", "避开乱切和洒出", "完整菜品步骤后通关"],
  },
  {
    gameKey: "peerEncourage",
    themeId: "food",
    title: "同伴鼓励大收集",
    clearMode: "score",
    mechanic: "peerEncourage",
    modes: ["voice", "choice"],
    verbs: ["speak", "choose"],
    steps: ["看同伴", "选鼓励", "说一句"],
    minActions: 2,
    maxScore: 100,
    rules: ["收集鼓励语给同伴加油", "避开嘲笑和催促", "鼓励连击提升同伴能量"],
  },
  {
    gameKey: "mealTray",
    themeId: "food",
    title: "午餐小餐盘",
    clearMode: "unique",
    mechanic: "mealTray",
    modes: ["upload", "choice", "mixed"],
    verbs: ["upload", "observe", "choose"],
    steps: ["看餐盘", "找食物", "说发现"],
    minActions: 2,
    maxScore: 100,
    rules: ["集齐餐盘观察清单", "漏拍遮挡会扣生命", "完成后接入餐盘记录"],
  },
  {
    gameKey: "mealManners",
    themeId: "habit",
    title: "文明进餐操",
    clearMode: "ordered",
    mechanic: "tableRhythm",
    modes: ["sequence", "choice"],
    verbs: ["sort", "act"],
    steps: ["坐坐好", "小口吃", "轻轻放", "擦擦嘴"],
    minActions: 3,
    maxScore: 100,
    rules: ["跟着餐桌节拍收集动作", "按进餐动作顺序推进", "节拍命中奖励更高"],
  },
  {
    gameKey: "habitTrafficLight",
    themeId: "habit",
    title: "好习惯红绿牌",
    clearMode: "score",
    mechanic: "trafficCards",
    modes: ["choice", "mixed"],
    verbs: ["choose", "act"],
    steps: ["看情境", "亮红绿牌", "说替代动作"],
    minActions: 2,
    maxScore: 100,
    rules: ["收集绿牌行为", "避开红牌动作", "连续判断提升技能"],
  },
];

export const gameEngineDefinitionMap = new Map(
  gameEngineDefinitions.map((definition) => [definition.gameKey, definition]),
);

export function getGameEngineDefinition(gameKey: MiniGameKey) {
  return gameEngineDefinitionMap.get(gameKey);
}

export function isGameEngineKey(value: unknown): value is MiniGameKey {
  return typeof value === "string" && gameEngineDefinitionMap.has(value as MiniGameKey);
}
