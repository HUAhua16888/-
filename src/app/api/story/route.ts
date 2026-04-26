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
const teacherInputMaxLength = 520;
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
  const wantsFood = /海蛎|紫菜|芥菜|食物|午餐|尝|吃|闽食|看一看|闻一闻/.test(userInput);
  const wantsQueue = /排队|队长|不挤|站好|慢慢走/.test(userInput);
  const wantsWash = /洗手|泡泡|小手|七步/.test(userInput);
  const wantsTidy = /整理|玩具|书|归位|送回家/.test(userInput);
  const reply =
    theme === "food" || wantsFood
      ? `🦪 海蛎小勇士听见啦：“${userInput}”。我们先看一看、闻一闻，再勇敢尝一小口，给自己一个尝试小鼓励。`
      : wantsWash
        ? `✨ 习惯小星来帮忙：“${userInput}”。我们先打湿小手，再搓出泡泡，最后把小手擦干净。`
        : wantsQueue
          ? `✨ 小队长准备好啦：“${userInput}”。我们一个跟着一个站好，慢慢走，不着急也不拥挤。`
          : wantsTidy
            ? `✨ 整理小能手出发：“${userInput}”。玩具回家，图书排队，桌面马上变清爽。`
            : `${currentTheme.emoji} ${currentTheme.label}收到啦。你刚才说的是“${userInput}”。我们先跟着故事走一步，再选一个小任务继续冒险吧。`;
  const choices =
    theme === "food" || wantsFood
      ? ["看一看颜色", "闻一闻香味", "勇敢尝一小口"]
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
  const wantsFood = theme === "food" || /海蛎|紫菜|芥菜|食物|午餐|闽食|泉州/.test(topic);
  const reply = wantsFood
    ? "绘本故事开始啦。海蛎小勇士带着小朋友来到泉州小厨房，先看见金黄的海蛎煎，又闻到紫菜汤的海味。小朋友说：“我先看一看，再闻一闻，准备好了尝一小口。”海蛎小勇士轻轻点头：“愿意靠近新食物，就是勇敢。”最后，大家把今天认识的食材画进成长小书里。"
    : "绘本故事开始啦。幼习宝小星在教室门口发现一串闪亮脚印，它邀请小朋友一起找好习惯。第一步，小手遇到清水和泡泡；第二步，玩具排队回到小篮子；第三步，小朋友慢慢喝水、轻轻说话。小星笑着说：“每做好一个小动作，身体和心情都会更舒服。”故事讲完啦，我们也试一个好习惯吧。";

  return {
    reply: topic ? reply.replace("绘本故事开始啦。", `《${topic}》开始啦。`) : reply,
    choices: wantsFood ? ["看食材", "闻香味", "尝一口"] : currentTheme.choices,
    badge: "",
    templateBadge: "绘本倾听贴纸",
    badgeKind: "story_progress",
  };
}

function buildTeacherFallback(task: string, userInput = "") {
  const target = `${task} ${userInput}`;
  const isActivity = /活动|课程|方案|流程|目标|材料|观察|延伸/.test(target);
  const isStory = /故事|绘本|角色|情境|讲/.test(target);
  const isFood = /餐|食|闽|海蛎|紫菜|挑食|尝/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const title = isActivity
    ? "幼儿活动课程方案"
    : isStory
      ? "幼儿互动故事"
      : isPraise
        ? "情绪支持活动"
        : isFood
          ? "闽南食育活动"
          : "幼儿故事活动";
  const content = isActivity
    ? "活动名称：小小成长任务。适用年龄：4-5岁。目标：愿意观察图片、说出做法，并尝试一个好行为。准备：情境图片、任务卡。流程：故事导入-看图讨论-幼儿操作-分享收束。提问：你看到了什么？怎样做更安全？观察：记录幼儿是否能说出原因并完成一个动作。家园延伸：回家继续练一个小步骤。"
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
          ? ["先看闻再品尝。", "允许只尝一小口。", "用闽食故事引入。"]
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
          "你需要生成简洁、温柔、正向、适合老师备课和课堂活动使用的中文内容。",
          "请严格返回 JSON，格式如下：",
          '{"title":"", "content":"", "tips":["", "", ""]}',
          "要求：如果是课堂活动方案，content 必须包含活动名称、年龄、目标、准备、流程、教师提问、观察要点、家园延伸；content 在 420 字以内；tips 恰好 3 条，每条不超过 18 字。",
        ].join("\n")
      : storyType === "pictureBook"
        ? [
            "你是“童趣成长乐园”的幼儿绘本故事伙伴。",
            `当前主题是：${themeConfig.label}。`,
            "面向 3-6 岁儿童，遵循生活化、游戏化、正向支持和尊重个体差异的幼儿教育原则。",
            "请根据孩子想听的内容生成一段可以直接语音播放的中文绘本故事。",
            theme === "food"
              ? "故事要融入泉州闽南食育元素，可出现海蛎煎、紫菜汤、芥菜饭、看一看、闻一闻、尝一小口。"
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
            ? "后续选项必须围绕闽食探索，例如看一看、闻一闻、尝一小口、认识海蛎或紫菜。"
            : "后续选项必须围绕习惯养成，例如洗手、排队、整理玩具、喝水或礼貌表达。",
          "choices 要像孩子能直接点击的小任务，每条不超过 10 个字，不要写成成人视角。",
          "请严格返回 JSON，格式如下：",
          '{"reply":"", "choices":["", "", ""], "progressSticker":""}',
          "要求：reply 控制在 90 字以内；choices 恰好 3 条；progressSticker 是故事进度贴纸名，不作为真实成长勋章。",
        ].join("\n");

  const userPrompt =
    mode === "teacher"
      ? `老师想生成的内容类型：${teacherTask}。补充说明：${userInput}`
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
        max_tokens: 900,
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
            content: normalizePlainText(
              parsed.content,
              buildTeacherFallback(teacherTask, userInput).content,
              420,
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
