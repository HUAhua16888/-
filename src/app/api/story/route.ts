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
  const wantsFood = /海蛎|面线|土笋冻|肉粽|润饼|石花|醋肉|鱼卷|食物|午餐|尝|吃|闽食|泉州|食材|摊位/.test(userInput);
  const wantsQueue = /排队|队长|不挤|站好|慢慢走/.test(userInput);
  const wantsWash = /洗手|泡泡|小手|七步/.test(userInput);
  const wantsTidy = /整理|玩具|书|归位|送回家/.test(userInput);
  const reply =
    theme === "food" || wantsFood
      ? `🦪 海蛎小勇士听见啦：“${userInput}”。我们去泉州美食小摊认名字、找食材、听小故事，再选一个愿意靠近的小步骤。`
      : wantsWash
        ? `✨ 习惯小星来帮忙：“${userInput}”。我们先打湿小手，再搓出泡泡，最后把小手擦干净。`
        : wantsQueue
          ? `✨ 小队长准备好啦：“${userInput}”。我们一个跟着一个站好，慢慢走，不着急也不拥挤。`
          : wantsTidy
            ? `✨ 整理小能手出发：“${userInput}”。玩具回家，图书排队，桌面马上变清爽。`
            : `${currentTheme.emoji} ${currentTheme.label}收到啦。你刚才说的是“${userInput}”。我们先跟着故事走一步，再选一个小任务继续冒险吧。`;
  const choices =
    theme === "food" || wantsFood
      ? ["逛美食摊", "找食材卡", "说我看到"]
      : wantsWash
        ? ["打湿小手", "搓出泡泡", "冲洗擦干"]
      : wantsQueue
          ? ["小队长举牌", "第一位站好", "慢慢向前走"]
          : wantsTidy
            ? ["玩具找篮子", "图书排排队", "桌面变清爽"]
            : currentTheme.choices;
  const badge =
    theme === "food" || wantsFood
      ? "勇敢尝鲜章"
      : wantsWash
        ? "洗手闪亮章"
        : wantsQueue
          ? "排队小队长"
          : wantsTidy
            ? "整理小能手"
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
  const currentTheme = themes[theme];
  const topic = userInput
    .replace(/^我想听/, "")
    .replace(/的故事$/, "")
    .trim();
  const wantsFood = theme === "food" || /海蛎|面线|土笋冻|肉粽|润饼|石花|醋肉|鱼卷|食物|午餐|闽食|泉州/.test(topic);
  const reply = wantsFood
    ? "绘本故事开始啦。海蛎小勇士带着小朋友来到泉州古城小吃摊，先看见金黄的海蛎煎，又发现细细软软的面线糊和卷着蔬菜的润饼菜。小朋友找到了鸡蛋、面线和胡萝卜，还听见摊主阿姨说：“认识名字和食材，就是靠近家乡味的第一步。”最后，大家把今天看到的颜色画进成长小书里。"
    : "绘本故事开始啦。幼习宝小星在教室门口发现一串闪亮脚印，它邀请小朋友一起找好习惯。第一步，小手遇到清水和泡泡；第二步，玩具排队回到小篮子；第三步，小朋友慢慢喝水、轻轻说话。小星笑着说：“每做好一个小动作，身体和心情都会更舒服。”故事讲完啦，我们也试一个好习惯吧。";

  return {
    reply: topic ? reply.replace("绘本故事开始啦。", `《${topic}》开始啦。`) : reply,
    choices: wantsFood ? ["看食材", "闻香味", "尝一口"] : currentTheme.choices,
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
    return "以模仿、感知、短句回应和动作游戏为主。";
  }

  if (ageGroup.includes("大班")) {
    return "加入合作、简单记录、规则意识和迁移表达。";
  }

  return "加入简单排序、比较和说出一点原因。";
}

function buildTeacherFallback(task: string, userInput = "") {
  const target = `${task} ${userInput}`;
  const isActivity = /活动|课程|方案|流程|目标|材料|观察|延伸/.test(target);
  const isStory = /故事|绘本|角色|情境|讲/.test(target);
  const isFood = /餐|食|闽|海蛎|紫菜|挑食|尝/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const ageGroup = resolveTeacherAgeGroup(target);
  const ageFocus = buildTeacherAgeFocus(ageGroup);
  const activityName = isFood ? "家乡美食小发现" : "小手泡泡按顺序";
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
        "活动时长：15-20 分钟",
        "活动目标：1. 愿意观察图片或实物，说出一个发现。2. 能用动作或短句完成一个小任务。3. 在生活中尝试迁移一步做法。",
        "准备材料：情境图片、实物或模型、小任务卡、贴纸。",
        "活动流程：导入 2 分钟，用角色或图片引出问题；感知/操作 6 分钟，让幼儿看、摸、摆或模仿；互动表达 5 分钟，请幼儿说一句发现或演示一个动作；生活迁移 3 分钟，说说今天在哪里能用到；收束 2 分钟，用贴纸肯定具体行为。",
        "教师提问：你看到了什么？下一步可以怎么做？你愿意试哪一小步？",
        "观察要点：是否能参与操作；是否能说出一个可观察发现；是否愿意尝试或模仿目标动作。",
        "家园延伸：回家和家长完成一个很小的同主题任务，并说一句“我今天发现了……”。",
        `注意事项：${ageFocus} 不考试、不背诵、不要求全部幼儿同一速度完成。`,
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
    mode === "teacher" ? "请生成适合幼儿园老师使用的故事或活动课程方案。" : "陪我继续故事吧",
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
          "你是一名面向中国幼儿园老师的备课助手。",
          "你需要生成简洁、温暖、正向、适合 3-6 岁幼儿园真实活动使用的中文内容。",
          "必须符合 3-6 岁幼儿认知特点，多用游戏、故事、图片、动作、操作材料和生活情境。",
          "少讲大道理，少抽象概念，不进行知识灌输。",
          "不要使用考试、背诵、书面作业、小学课堂化表达。",
          "活动目标必须写成幼儿可观察行为，例如能说出、能指出、愿意模仿、愿意尝试。",
          "每个活动环节不宜过长，教师提问要短、具体、幼儿能回答。",
          "活动流程必须包含：导入、感知/操作、互动表达、生活迁移、收束。",
          "按年龄差异处理：小班以模仿、感知、短句回应、动作游戏为主；中班加入简单排序、比较、表达原因；大班加入合作、简单记录、规则意识和迁移表达。",
          theme === "food"
            ? "闽食主题要围绕泉州本地食育：认识名称、观察食材和外形、温和接受陌生食物、家园共育介绍一道家乡美食，不要只写挑食干预。"
            : "幼习宝主题要围绕生活习惯和安全经验，帮助幼儿在一日生活中迁移一个小行为。",
          "请严格返回 JSON，格式如下：",
          '{"title":"", "content":"", "tips":["", "", ""]}',
          "要求：如果是活动课程方案，content 必须按以下小标题分行输出：活动名称、适用年龄、活动时长、活动目标、准备材料、活动流程、教师提问、观察要点、家园延伸、注意事项。",
          "content 在 780 字以内；tips 恰好 3 条，每条不超过 18 字，必须是老师可执行提醒。",
        ].join("\n")
      : storyType === "pictureBook"
        ? [
            "你是“童趣成长乐园”的幼儿绘本故事伙伴。",
            `当前主题是：${themeConfig.label}。`,
            "面向 3-6 岁儿童，遵循生活化、游戏化、正向支持和尊重个体差异的幼儿教育原则。",
            "请根据孩子想听的内容生成一段可以直接语音播放的中文绘本故事。",
            theme === "food"
              ? "故事要融入泉州本地美食探索，可轮换海蛎煎、面线糊、土笋冻、闽南肉粽、润饼菜、石花膏、炸醋肉、崇武鱼卷；重点是认名字、找食材、听小故事、说颜色形状和选择靠近一小步。"
              : "故事要围绕幼儿生活习惯或安全经验，可出现洗手、喝水、整理、排队、如厕、交通或防火安全。",
            "语言要短句、温柔、有画面感，不批评、不吓唬、不小学化。",
            "请严格返回 JSON，格式如下：",
            '{"reply":"", "choices":["", "", ""], "progressSticker":""}',
            "要求：reply 是完整绘本故事，160-240 字；choices 恰好 3 条，每条不超过 10 个字；progressSticker 填“绘本倾听贴纸”。",
          ].join("\n")
        : [
          "你是“童趣成长乐园”的儿童互动故事伙伴。",
          `当前主题是：${themeConfig.label}。`,
          "面向 3-6 岁儿童，语言要温柔、简短、鼓励式、绘本感，绝不批评孩子。",
          "请先回应孩子的话，再给 3 个可以点击的后续选项。",
          theme === "food"
            ? "后续选项必须围绕泉州美食探索，例如逛摊位、找食材卡、选颜色、猜来自哪里、给家人介绍名字、选择靠近一小步。不要总是重复看一看、闻一闻、尝一口。"
            : "后续选项必须围绕习惯养成，例如洗手、排队、整理玩具、喝水或礼貌表达。",
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
            title: normalizePlainText(parsed.title, "老师辅助小卡片", 32),
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
