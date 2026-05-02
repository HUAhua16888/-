import { NextResponse } from "next/server";

import { extractJsonObject, normalizeTextContent } from "@/lib/json";
import { themes, type ThemeId } from "@/lib/site-data";

export const maxDuration = 60;

type StoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoryRequest = {
  mode?: "child" | "teacher";
  theme?: ThemeId;
  storyType?: "chat" | "pictureBook";
  messages?: StoryMessage[];
  userInput?: string;
  teacherTask?: string;
};

type StoryFallbackReason = "missing_api_key" | "provider_failed" | "invalid_ai_response";

const childInputMaxLength = 120;
const teacherInputMaxLength = 720;
const teacherTaskMaxLength = 40;
const messageMaxLength = 180;

function normalizePlainText(input: unknown, fallback: string, maxLength: number) {
  if (typeof input !== "string") {
    return fallback;
  }

  const cleaned = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || fallback;
}

function normalizeTeacherContent(input: unknown, fallback: string, maxLength: number) {
  if (typeof input !== "string") {
    return fallback;
  }

  const cleaned = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength)
    .trim();

  return cleaned || fallback;
}

function normalizeTheme(input: unknown): ThemeId {
  return input === "food" ? "food" : "habit";
}

function normalizeMessages(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (item): item is StoryMessage =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    )
    .map((item) => ({
      role: item.role,
      content: normalizePlainText(item.content, "", messageMaxLength),
    }))
    .filter((item) => item.content)
    .slice(-6);
}

function normalizeShortList(
  input: unknown,
  fallback: string[],
  limit: number,
  maxItemLength = 18,
) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const cleaned = input
    .map((item) => normalizePlainText(item, "", maxItemLength))
    .filter(Boolean)
    .slice(0, limit);

  return cleaned.length === limit ? cleaned : fallback;
}

function normalizeChildChoices(input: unknown, fallback: string[]) {
  return normalizeShortList(input, fallback, 3, 10);
}

function normalizeBadgeName(input: unknown, fallback: string) {
  if (typeof input !== "string") {
    return fallback;
  }

  return input.trim().slice(0, 10) || fallback;
}

function withFallbackMeta<T extends Record<string, unknown>>(
  payload: T,
  reason: StoryFallbackReason,
  error?: string,
) {
  return {
    ...payload,
    source: "template",
    fallbackUsed: true,
    fallbackReason: reason,
    ...(error ? { error } : {}),
  };
}

function withAiMeta<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    source: "ai",
    fallbackUsed: false,
  };
}

function buildChildFallback(theme: ThemeId, userInput: string) {
  const currentTheme = themes[theme];
  const wantsFood = /海蛎|面线|土笋冻|肉粽|烧肉粽|姜母鸭|芋头饼|牛肉羹|洪濑鸡爪|四果汤|咸饭|润饼|石花|醋肉|鱼卷|食物|午餐|尝|吃|闽食|泉州|食材|摊位|播报|厨房|小厨师/.test(userInput);
  const wantsQueue = /排队|队长|不挤|站好|慢慢走/.test(userInput);
  const wantsWash = /洗手|泡泡|小手|七步/.test(userInput);
  const wantsDrink = /喝水|水杯|口渴/.test(userInput);
  const wantsToilet = /如厕|厕所|小便|大便|尿/.test(userInput);
  const wantsTidy = /整理|玩具|书|归位|送回家/.test(userInput);
  const wantsReading = /阅读|故事|图书|绘本|角色|画面|共读|书虫/.test(userInput);
  const reply =
    theme === "food" || wantsFood
      ? `🦪 海蛎小勇士听见啦：“${userInput}”。我们去泉州美食小摊认名字、找食材、听小故事，再选一个愿意靠近的小步骤。`
      : wantsWash
        ? `✨ 习惯小星来帮忙：“${userInput}”。我们先打湿小手，再搓出泡泡，最后把小手擦干净。`
        : wantsDrink
          ? `✨ 喝水提醒来啦：“${userInput}”。我们坐好，双手拿杯，慢慢喝一口，再把水杯放回去。`
        : wantsToilet
          ? `✨ 如厕小任务来啦：“${userInput}”。想上厕所可以轻轻告诉老师，整理好衣物，再洗小手。`
        : wantsQueue
          ? `✨ 小队长准备好啦：“${userInput}”。我们一个跟着一个站好，慢慢走，不着急也不拥挤。`
          : wantsTidy
            ? `✨ 整理小能手出发：“${userInput}”。玩具回家，图书排队，桌面马上变清爽。`
            : wantsReading
              ? `📚 阅读小书虫听见啦：“${userInput}”。我们先听一个短故事，再说一个角色、一张画面或一个喜欢的地方。`
            : `${currentTheme.emoji} ${currentTheme.label}收到啦。你刚才说的是“${userInput}”。我们先跟着故事走一步，再选一个小任务继续冒险吧。`;
  const choices =
    theme === "food" || wantsFood
      ? ["坐小列车", "猜食材卡", "说我看到"]
      : wantsWash
        ? ["打湿小手", "搓出泡泡", "冲洗擦干"]
      : wantsDrink
        ? ["坐好喝水", "放回水杯", "说我喝好了"]
      : wantsToilet
        ? ["告诉老师", "整理衣物", "洗干净手"]
      : wantsQueue
          ? ["小队长举牌", "第一位站好", "慢慢向前走"]
          : wantsTidy
            ? ["玩具找篮子", "图书排排队", "桌面变清爽"]
            : wantsReading
              ? ["听短故事", "说一个角色", "图书回家"]
            : currentTheme.choices;
  const badge =
    theme === "food" || wantsFood
      ? "勇敢尝鲜章"
      : wantsWash
        ? "洗手闪亮章"
        : wantsDrink
          ? "喝水小勇士章"
        : wantsToilet
          ? "如厕小任务章"
        : wantsQueue
          ? "排队小队长"
          : wantsTidy
            ? "整理小能手"
            : wantsReading
              ? "阅读小书虫"
            : currentTheme.badgePool[0];

  return {
    reply,
    choices,
    badge: "",
    templateBadge: badge,
    badgeKind: "template",
  };
}

function buildPictureBookFallback(theme: ThemeId, userInput: string) {
  const topic = userInput
    .replace(/^我想听/, "")
    .replace(/的故事$/, "")
    .trim();
  const wantsFood = theme === "food" || /海蛎|面线|土笋冻|肉粽|烧肉粽|姜母鸭|芋头饼|牛肉羹|洪濑鸡爪|四果汤|咸饭|润饼|石花|醋肉|鱼卷|食物|午餐|闽食|泉州|播报|厨房|小厨师/.test(topic);
  const reply = wantsFood
    ? "绘本故事开始啦。海蛎小勇士开着闽食小列车来到泉州古城小吃摊，先看见金黄的海蛎煎，又闻到姜母鸭的姜片香，还发现烧肉粽、土笋冻、芋头饼和四果汤。小朋友打开美食宝箱，找到了海蛎、老姜、糯米和芋头，还听见摊主阿姨说：“认识名字和食材，就是靠近家乡味的第一步。”最后，大家把今天看到的颜色画进成长小书里。"
    : "绘本故事开始啦。幼习宝小星在图书角发现一本会发光的小书，它邀请小朋友先坐稳、听故事，再说一句“我看到了……”。故事里，小手遇到清水和泡泡，图书排队回到书架，小朋友慢慢喝水、轻轻说话。小星笑着说：“每做好一个小动作，成长任务就会亮一点。”故事讲完啦，我们也试一个阅读或好习惯小任务吧。";

  return {
    reply: topic ? reply.replace("绘本故事开始啦。", `《${topic}》开始啦。`) : reply,
    choices: wantsFood ? ["坐小列车", "猜食材", "说发现"] : ["听短故事", "说我看到", "图书回家"],
    badge: "",
    templateBadge: "绘本倾听贴纸",
    badgeKind: "story_progress",
  };
}

function resolveTeacherAgeGroup(text: string) {
  if (/小班|3\s*-\s*4|3-4|3 至 4|3到4/.test(text)) {
    return "小班 3-4 岁";
  }

  if (/大班|5\s*-\s*6|5-6|5 至 6|5到6/.test(text)) {
    return "大班 5-6 岁";
  }

  return "中班 4-5 岁";
}

function buildTeacherAgeFocus(ageGroup: string) {
  if (ageGroup.includes("小班")) {
    return "参考《指南》和《纲要》，集中活动建议 10-15 分钟，以模仿、感知、短句回应和动作游戏为主。";
  }

  if (ageGroup.includes("大班")) {
    return "参考《指南》和《纲要》，集中活动建议 20-30 分钟，加入讨论、简单记录、分享、规则意识和迁移表达。";
  }

  return "参考《指南》和《纲要》，集中活动建议 15-20 分钟，加入观察、表达、简单排序、比较和初步合作。";
}

function buildTeacherActivityDuration(ageGroup: string) {
  if (ageGroup.includes("小班")) {
    return "10-15 分钟";
  }

  if (ageGroup.includes("大班")) {
    return "20-30 分钟";
  }

  return "15-20 分钟";
}

function buildTeacherFallback(task: string, userInput = "") {
  const target = `${task} ${userInput}`;
  const isActivity = /活动|课程|方案|流程|目标|材料|观察|延伸/.test(target);
  const isStory = /故事|绘本|角色|情境|讲/.test(target);
  const isHabitTask = /幼习宝|喝水|洗手|如厕|排队|整理|红绿牌|文明进餐|坐姿|图书|小书虫|成长任务|生活习惯|一日常规/.test(target);
  const isFood =
    !isHabitTask &&
    /闽|泉州美食|海蛎|紫菜|土笋|面线|润饼|石花|醋肉|鱼卷|姜母鸭|烧肉粽|肉粽|芋头饼|牛肉羹|洪濑鸡爪|四果汤|咸饭|食材|美食|尝新|播报|厨房|小厨师/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const ageGroup = resolveTeacherAgeGroup(target);
  const ageFocus = buildTeacherAgeFocus(ageGroup);
  const activityDuration = buildTeacherActivityDuration(ageGroup);
  const activityName = isFood ? "泉州闽食进餐改善活动" : "幼习宝一日生活常规活动";
  const title = isActivity
    ? "幼儿活动课程方案"
    : isStory
      ? "幼儿互动引导"
      : isPraise
        ? "情绪支持活动"
        : isFood
          ? "闽南食育活动"
          : "幼儿故事活动";
  const content = isActivity
    ? [
        `活动名称：${activityName}`,
        `适用年龄：${ageGroup}`,
        `活动时长：${activityDuration}`,
        "设计依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》，以可观察行为、游戏化操作和生活迁移为主。",
        isFood
          ? "活动目标：1. 能说出一种泉州美食名称。2. 能从图片或实物中找到一种食材。3. 愿意用短句介绍一个发现或选择靠近一小步。"
          : "活动目标：1. 能模仿一个一日生活常规动作。2. 能通过图卡或红绿牌判断一种做法是否合适。3. 能把洗手、喝水、如厕、整理、排队或文明进餐中的一个步骤迁移到生活环节。",
        isFood
          ? "准备材料：泉州美食站点图、食材卡、美食宝箱、贴纸。"
          : "准备材料：一日常规图卡、红绿牌、进餐动作图卡、洗手/喝水/整理提示卡、贴纸。",
        isFood
          ? "活动流程：导入 2 分钟，用闽食小列车口令进站；感知/操作 6 分钟，幼儿看图找美食和食材卡；互动表达 5 分钟，请幼儿做小小美食播报员；生活迁移 3 分钟，选择回家介绍的一种美食；收束 2 分钟，用贴纸肯定具体发现。"
          : "活动流程：导入 2 分钟，用幼习宝一日常规口令热身；感知/操作 6 分钟，幼儿模仿洗手、喝水、如厕表达、整理归位、排队等待或文明进餐动作；互动表达 5 分钟，用红绿牌判断行为并说出替代做法；生活迁移 3 分钟，说说今天在哪个生活环节可以做一步；收束 2 分钟，肯定一个具体常规进步。",
        isFood
          ? "儿歌/口令：闽食小列车，慢慢进小站，先看食材卡，再说小发现。"
          : "儿歌/口令：小水杯，双手拿；小手洗，泡泡花；小队伍，排整齐。",
        isFood
          ? "教师引导语：我们先认识泉州美食的名字和食材，愿意靠近一点点就值得记录。"
          : "教师引导语：老师看到你正在练一个生活小步骤，先做一小步也很棒。",
        "教师提问：你看到了什么？下一步可以怎么做？你愿意试哪一小步？",
        "观察要点：是否能参与操作；是否能说出一个可观察发现；是否愿意尝试或模仿目标动作。",
        isFood
          ? "家园延伸：回家完成睡前美食小回顾，说一种今天认识的美食、一个颜色或食材，以及明天愿意靠近哪一小步。"
          : "家园延伸：回家只选一个小步骤，如饭前洗手、慢慢喝水、整理玩具、餐后整理或睡前共读 5 分钟，并请家长记录一句观察。",
        `注意事项：${ageFocus} 活动目标写成可观察行为，不考试、不背诵、不要求全部幼儿同一速度完成。`,
      ].join("\n")
    : isStory
      ? "有一颗小星星来到教室，它想请小朋友帮忙完成一个小任务：先看一看图片，再说一说自己的发现，最后一起试一试。"
      : isPraise
        ? "活动先接住孩子的情绪，再用角色邀请孩子完成一个很小的动作。教师只给一步提示，完成后说出具体进步。"
        : isFood
          ? "活动从闽南食物图片导入，请幼儿看颜色、闻味道、说食材，再选择愿意尝试的一小步。"
          : "请老师先讲一个短故事，再出示图片提问，最后让幼儿用动作或语言完成一个小任务。";
  const tips = isActivity
    ? ["目标只写一两条。", "流程保留操作环节。", "观察点要能记录。"]
    : isStory
      ? ["角色要贴近幼儿。", "问题不要太难。", "结尾带一个任务。"]
      : isPraise
        ? ["先接住情绪。", "不催促不比较。", "给孩子一个台阶。"]
        : isFood
          ? ["先认名字食材。", "允许只靠近一步。", "用泉州故事引入。"]
          : ["语言短一点。", "先示范再邀请。", "完成后及时表扬。"];

  return {
    title,
    content,
    tips,
  };
}

export async function POST(request: Request) {
  let body: StoryRequest = {};

  try {
    const parsed = (await request.json()) as unknown;
    body = parsed && typeof parsed === "object" ? (parsed as StoryRequest) : {};
  } catch {
    body = {};
  }

  const mode = body.mode ?? "child";
  const theme = normalizeTheme(body.theme);
  const storyType = body.storyType === "pictureBook" ? "pictureBook" : "chat";
  const userInput = normalizePlainText(
    body.userInput,
    mode === "teacher" ? "请生成适合幼儿园老师使用的跟进建议、课堂活动、家园同步话术或鼓励语。" : "陪我继续故事吧",
    mode === "teacher" ? teacherInputMaxLength : childInputMaxLength,
  );
  const teacherTask = normalizePlainText(body.teacherTask, "课堂引导语", teacherTaskMaxLength);
  const messages = normalizeMessages(body.messages);

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.OPENAI_MODEL ?? "deepseek-reasoner";

  if (!apiKey) {
    return NextResponse.json(
      withFallbackMeta(
        mode === "teacher"
          ? buildTeacherFallback(teacherTask, userInput)
          : storyType === "pictureBook"
            ? buildPictureBookFallback(theme, userInput)
            : buildChildFallback(theme, userInput),
        "missing_api_key",
      ),
    );
  }

  const themeConfig = themes[theme];

  const systemPrompt =
    mode === "teacher"
      ? [
          "你是一名面向中国幼儿园老师的 AI 跟进助手。",
          "你需要生成简洁、温暖、正向、适合 3-6 岁幼儿园真实活动使用的中文内容。",
          "必须符合 3-6 岁幼儿认知特点，多用游戏、故事、图片、动作、操作材料和生活情境。",
          "少讲大道理，少抽象概念，不进行知识灌输。",
          "不要使用考试、背诵、书面作业、小学课堂化表达。",
          "活动目标必须写成幼儿可观察行为，例如能说出、能指出、愿意模仿、愿意尝试。",
          "每个活动环节不宜过长，教师提问要短、具体、幼儿能回答。",
          "活动流程必须包含：导入、感知/操作、互动表达、生活迁移、收束。",
          "按年龄差异处理：小班以模仿、感知、短句回应、动作游戏为主；中班加入简单排序、比较、表达原因；大班加入合作、简单记录、规则意识和迁移表达。",
          "活动设计需参考《3-6岁儿童学习与发展指南》和《幼儿园教育指导纲要》：小班集中活动建议 10-15 分钟，中班 15-20 分钟，大班 20-30 分钟。",
          theme === "food"
            ? "闽食主题要围绕泉州本地食育：认识名称、观察食材和外形、温和接受陌生食物、家园共育介绍一道家乡美食；可生成闽食小列车站点口令、美食猜猜乐线索、小小闽食播报员介绍词、泉州小厨房动作口令、区域活动步骤、家庭延续小任务和温和表扬语，不要只写进食问题处理。"
          : "幼习宝主题要围绕幼儿一日生活常规和进餐习惯，重点是喝水、洗手、如厕、整理、排队、文明进餐、好习惯红绿牌和习惯故事小剧场；可生成 AI 正向提醒口令、文明进餐操口令、红绿牌题目、听故事做任务问题、家长同步话术、表扬语和成效观察线索。",
          "如果输入包含幼儿互动记录、gameKey、选择记录或家庭反馈，请先提炼观察线索，再给出后续活动、鼓励语、家庭同步建议和一个家庭小任务。",
          "可识别的互动类型包括 readingCheckin、habitTrafficLight、mealManners、foodTrain、foodGuess、foodObserve、foodPreference、foodReporter、foodKitchen、mealTray、peerEncourage、habitJudge。habitJudge、mealTray、peerEncourage 只作为历史记录复习；当前闽食主线应转化为闽食小小播报员或泉州小厨房。",
          "禁止强迫孩子吃完、用“不挑食”压孩子、负面评价孩子、小学化营养知识灌输或复杂说教。",
          "输出要结构清晰，至少包含步骤、儿歌/口令、教师引导语和家园任务；闽食内容要贴合泉州本土文化和真实食谱。",
          "请严格返回 JSON，格式如下：",
          '{"title":"", "content":"", "tips":["", "", ""]}',
          "要求：如果是活动课程方案，content 必须按以下小标题分行输出：活动名称、适用年龄、活动时长、活动目标、准备材料、活动流程、儿歌/口令、教师引导语、教师提问、观察要点、家园延伸、注意事项。",
          "content 在 780 字以内；tips 恰好 3 条，每条不超过 18 字，必须是老师可执行提醒。",
        ].join("\n")
      : storyType === "pictureBook"
        ? [
            "你是“幼芽成长智伴”的幼习宝教育智能体，负责幼儿一日生活常规与闽食进餐改善的温和互动。",
            `当前主题是：${themeConfig.label}。`,
            "面向 3-6 岁儿童，遵循生活化、游戏化、正向支持和尊重个体差异的幼儿教育原则。",
            "请根据孩子想听的内容生成一段可以直接语音播放的中文绘本故事。",
            theme === "food"
              ? "故事要融入泉州本地美食探索，可轮换海蛎煎、面线糊、土笋冻、闽南肉粽/烧肉粽、润饼菜、石花膏、炸醋肉、崇武鱼卷、姜母鸭、芋头饼、牛肉羹、洪濑鸡爪、四果汤、咸饭；可出现闽食小列车、美食猜猜乐、美食宝箱、小小播报员和泉州小厨房；重点是认名字、找食材、听小故事、说颜色形状、播报介绍和参与制作小步骤。"
              : "故事要围绕一日生活常规和进餐习惯，可出现喝水、洗手、如厕表达、整理归位、排队等待、正确坐姿、轻声进餐、细嚼慢咽、按需取餐、珍惜粮食和餐后整理；阅读只作为习惯延伸，不要压过常规养成主线。",
            "故事结尾要自然引出一个听故事做任务问题，例如故事里做了什么好习惯、我也可以做哪一步、图书或物品放回哪里。",
            "语言要短句、温柔、有画面感，不批评、不吓唬、不小学化。",
            "请严格返回 JSON，格式如下：",
            '{"reply":"", "choices":["", "", ""], "progressSticker":""}',
            "要求：reply 是完整习惯短故事，160-240 字；choices 恰好 3 条，每条不超过 10 个字，并且像答案卡一样能被孩子点击；progressSticker 填“故事小耳朵”。",
          ].join("\n")
        : [
          "你是“幼芽成长智伴”的幼习宝教育智能体儿童互动伙伴。",
          `当前主题是：${themeConfig.label}。`,
          "面向 3-6 岁儿童，语言要温柔、简短、鼓励式、绘本感，绝不批评孩子。",
          "请先回应孩子的话，再给 3 个可以点击的后续选项。",
          theme === "food"
            ? "后续选项必须围绕泉州美食探索，例如坐闽食小列车、猜食材卡、选颜色、猜来自哪里、当闽食小小播报员、进泉州小厨房、给家人介绍名字、选择靠近一小步。不要总是重复看一看、闻一闻、尝一口。"
            : "后续选项必须围绕幼习宝一日生活常规，例如喝水、洗手、如厕提醒、排队等待、整理归位、正确坐姿、轻声进餐、细嚼慢咽、好习惯红绿牌或居家延续。",
          "儿童互动要形成“AI 口令或故事、孩子选择或动作、正向反馈、继续打卡”的节奏。",
          "禁止强迫孩子吃完、用“不挑食”压孩子、负面评价孩子或复杂说教。",
          "choices 要像孩子能直接点击的小任务，每条不超过 10 个字，不要写成成人视角。",
          "请严格返回 JSON，格式如下：",
          '{"reply":"", "choices":["", "", ""], "progressSticker":""}',
          "要求：reply 控制在 90 字以内；choices 恰好 3 条；progressSticker 是故事进度贴纸名，不作为真实成长勋章。",
        ].join("\n");

  const userPrompt =
    mode === "teacher"
      ? `当前主题：${themeConfig.label}。老师想生成的内容类型：${teacherTask}。补充说明：${userInput}`
      : storyType === "pictureBook"
        ? `孩子想听的绘本故事内容：${userInput}`
        : `孩子刚刚说：${userInput}`;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: mode === "teacher" ? 1200 : 900,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messages.slice(-6),
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || "聊天接口调用失败");
    }

    const rawContent = normalizeTextContent(data.choices?.[0]?.message?.content);
    const parsed = extractJsonObject(rawContent);

    if (mode === "teacher") {
      if (
        parsed &&
        typeof parsed.title === "string" &&
        typeof parsed.content === "string" &&
        Array.isArray(parsed.tips)
      ) {
        return NextResponse.json(
          withAiMeta({
            title: normalizePlainText(parsed.title, "教师工作台小卡片", 32),
            content: normalizeTeacherContent(
              parsed.content,
              buildTeacherFallback(teacherTask, userInput).content,
              820,
            ),
            tips: normalizeShortList(
              parsed.tips,
              buildTeacherFallback(teacherTask, userInput).tips,
              3,
              18,
            ),
          }),
        );
      }

      return NextResponse.json(
        withFallbackMeta(buildTeacherFallback(teacherTask, userInput), "invalid_ai_response"),
      );
    }

    if (
      parsed &&
      typeof parsed.reply === "string" &&
      Array.isArray(parsed.choices)
    ) {
      const badge = normalizeBadgeName(
        typeof parsed.progressSticker === "string" ? parsed.progressSticker : parsed.badge,
        "",
      );

      return NextResponse.json({
        ...withAiMeta({
          reply: normalizePlainText(
            parsed.reply,
            storyType === "pictureBook"
              ? buildPictureBookFallback(theme, userInput).reply
              : buildChildFallback(theme, userInput).reply,
            storyType === "pictureBook" ? 260 : 110,
          ),
          choices: normalizeChildChoices(parsed.choices, themeConfig.choices),
          badge: "",
          templateBadge: badge,
          badgeKind: badge ? "story_progress" : "none",
          awardBadge: false,
        }),
      });
    }

    return NextResponse.json(
      withFallbackMeta(
        storyType === "pictureBook"
          ? buildPictureBookFallback(theme, userInput)
          : buildChildFallback(theme, userInput),
        "invalid_ai_response",
      ),
    );
  } catch {
    const message =
      mode === "teacher"
        ? "内容生成有点不稳定，已先给出可用话术。"
        : "故事伙伴有点忙，已先接上可继续互动的故事。";

    return NextResponse.json(
      withFallbackMeta(
        mode === "teacher"
          ? buildTeacherFallback(teacherTask, userInput)
          : storyType === "pictureBook"
            ? buildPictureBookFallback(theme, userInput)
            : buildChildFallback(theme, userInput),
        "provider_failed",
        message,
      ),
    );
  }
}
