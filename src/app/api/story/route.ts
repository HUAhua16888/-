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
  messages?: StoryMessage[];
  userInput?: string;
  teacherTask?: string;
};

const childInputMaxLength = 120;
const teacherInputMaxLength = 360;
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

function normalizeShortList(input: unknown, fallback: string[], limit: number) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const cleaned = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);

  return cleaned.length === limit ? cleaned : fallback;
}

function normalizeChildChoices(input: unknown, fallback: string[]) {
  return normalizeShortList(input, fallback, 3).map((item) => item.slice(0, 10));
}

function normalizeBadgeName(input: unknown, fallback: string) {
  if (typeof input !== "string") {
    return fallback;
  }

  return input.trim().slice(0, 10) || fallback;
}

function buildChildFallback(theme: ThemeId, userInput: string) {
  const currentTheme = themes[theme];
  const wantsFood = /海蛎|紫菜|芥菜|食物|午餐|尝|吃|闽食|看一看|闻一闻/.test(userInput);
  const wantsQueue = /排队|队长|不挤|站好|慢慢走/.test(userInput);
  const wantsWash = /洗手|泡泡|小手|七步/.test(userInput);
  const wantsTidy = /整理|玩具|书|归位|送回家/.test(userInput);
  const reply =
    theme === "food" || wantsFood
      ? `🦪 海蛎小勇士听见啦：“${userInput}”。我们先看一看、闻一闻，再勇敢尝一小口，给自己点亮闽食小勋章。`
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
    badge,
  };
}

function buildTeacherFallback(task: string, userInput = "") {
  const target = `${task} ${userInput}`;
  const isMorning = /晨间|入园|接待|早上/.test(target);
  const isFood = /餐|食|闽|海蛎|紫菜|挑食|尝/.test(target);
  const isHome = /家园|家长|共育|通知|同步/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const title = isHome
    ? "家园共育小短讯"
    : isPraise
      ? "情绪安抚鼓励语"
      : isFood
        ? "餐前食育小卡片"
        : isMorning
          ? "晨间接待小卡片"
          : "课堂引导小卡片";
  const content = isHome
    ? "亲爱的家长，今天我们和孩子一起练习了一个小小成长任务。请在家继续用温柔提醒和及时表扬陪伴孩子，看到一点进步就肯定他。"
    : isPraise
      ? "你有一点紧张也没关系，老师会陪着你。我们先做一件很小的事，愿意试一试就已经很勇敢啦。"
      : isFood
        ? "小朋友们，今天餐盘里藏着一个闽食小秘密。我们先用眼睛看一看颜色，再闻一闻香味，最后勇敢尝一小口。"
        : isMorning
          ? "早上好呀，欢迎你来到班级。我们先放好小书包，和老师打个招呼，再一起开始今天的小小成长任务。"
          : "小朋友们，我们先把小脚放稳，小眼睛看老师，小耳朵听一听。等一下完成任务后，每个人都能点亮自己的成长小星。";
  const tips = isHome
    ? ["说清今天练了什么。", "只给一个家庭小任务。", "结尾提醒多鼓励。"]
    : isPraise
      ? ["先接住情绪。", "不催促不比较。", "给孩子一个小台阶。"]
      : isFood
        ? ["先看闻再品尝。", "允许只尝一小口。", "用闽食故事引入。"]
        : isMorning
          ? ["先问候再提醒。", "动作拆成一步。", "给孩子稳定感。"]
          : ["口令短一点。", "先示范再邀请。", "完成后及时表扬。"];

  return {
    title,
    content,
    tips,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as StoryRequest;
  const mode = body.mode ?? "child";
  const theme = normalizeTheme(body.theme);
  const userInput = normalizePlainText(
    body.userInput,
    mode === "teacher" ? "请生成一段适合课堂或家园共育使用的内容。" : "陪我继续故事吧",
    mode === "teacher" ? teacherInputMaxLength : childInputMaxLength,
  );
  const teacherTask = normalizePlainText(body.teacherTask, "课堂引导语", teacherTaskMaxLength);
  const messages = normalizeMessages(body.messages);

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.OPENAI_MODEL ?? "deepseek-reasoner";

  if (!apiKey) {
    return NextResponse.json(
      mode === "teacher"
        ? buildTeacherFallback(teacherTask, userInput)
        : buildChildFallback(theme, userInput),
    );
  }

  const themeConfig = themes[theme];

  const systemPrompt =
    mode === "teacher"
      ? [
          "你是一名面向中国幼儿园老师和家长的教育助手。",
          "你需要生成简洁、温柔、正向、可直接拿去使用的中文内容。",
          "请严格返回 JSON，格式如下：",
          '{"title":"", "content":"", "tips":["", "", ""]}',
          "要求：content 在 120 字以内，tips 恰好 3 条，每条不超过 18 字。",
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
          '{"reply":"", "choices":["", "", ""], "badge":""}',
          "要求：reply 控制在 90 字以内；choices 恰好 3 条；badge 是一个很短的勋章名。",
        ].join("\n");

  const userPrompt =
    mode === "teacher"
      ? `老师想生成的内容类型：${teacherTask}。补充说明：${userInput}`
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
        return NextResponse.json({
          title: parsed.title.trim() || "老师辅助小卡片",
          content:
            parsed.content.trim() || buildTeacherFallback(teacherTask, userInput).content,
          tips: normalizeShortList(
            parsed.tips,
            buildTeacherFallback(teacherTask, userInput).tips,
            3,
          ),
        });
      }

      return NextResponse.json(buildTeacherFallback(teacherTask, userInput));
    }

    if (
      parsed &&
      typeof parsed.reply === "string" &&
      Array.isArray(parsed.choices) &&
      typeof parsed.badge === "string"
    ) {
      return NextResponse.json({
        reply: parsed.reply.trim() || buildChildFallback(theme, userInput).reply,
        choices: normalizeChildChoices(parsed.choices, themeConfig.choices),
        badge: normalizeBadgeName(parsed.badge, themeConfig.badgePool[0]),
      });
    }

    return NextResponse.json(buildChildFallback(theme, userInput));
  } catch (error) {
    const message = error instanceof Error ? error.message : "暂时连接不到模型服务";

    return NextResponse.json(
      mode === "teacher"
        ? {
            ...buildTeacherFallback(teacherTask, userInput),
            error: message,
          }
        : {
            ...buildChildFallback(theme, userInput),
            error: message,
          },
    );
  }
}
