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

function buildChildFallback(theme: ThemeId, userInput: string) {
  const currentTheme = themes[theme];

  return {
    reply: `${currentTheme.emoji} ${currentTheme.label}收到啦。你刚才说的是“${userInput}”。我们先跟着故事走一步，再选一个小任务继续冒险吧。`,
    choices: currentTheme.choices,
    badge: currentTheme.badgePool[0],
  };
}

function buildTeacherFallback(task: string) {
  return {
    title: "老师辅助小卡片",
    content:
      task ||
      "请温柔地提醒孩子保持好习惯，并多使用鼓励和儿歌化表达，让孩子在轻松氛围中完成任务。",
    tips: [
      "一句话只传达一个任务。",
      "优先使用表扬和陪伴式语言。",
      "结尾补一句家园同步建议。",
    ],
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as StoryRequest;
  const mode = body.mode ?? "child";
  const theme = body.theme ?? "habit";
  const userInput = body.userInput?.trim() || "陪我继续故事吧";
  const messages = body.messages ?? [];

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.OPENAI_MODEL ?? "deepseek-reasoner";

  if (!apiKey) {
    return NextResponse.json(
      mode === "teacher"
        ? buildTeacherFallback(body.teacherTask ?? "")
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
          "请严格返回 JSON，格式如下：",
          '{"reply":"", "choices":["", "", ""], "badge":""}',
          "要求：reply 控制在 90 字以内；choices 恰好 3 条；badge 是一个很短的勋章名。",
        ].join("\n");

  const userPrompt =
    mode === "teacher"
      ? `老师想生成的内容类型：${body.teacherTask ?? "课堂引导语"}。补充说明：${userInput}`
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
          content: parsed.content.trim() || buildTeacherFallback(body.teacherTask ?? "").content,
          tips: normalizeShortList(
            parsed.tips,
            buildTeacherFallback(body.teacherTask ?? "").tips,
            3,
          ),
        });
      }

      return NextResponse.json(buildTeacherFallback(body.teacherTask ?? ""));
    }

    if (
      parsed &&
      typeof parsed.reply === "string" &&
      Array.isArray(parsed.choices) &&
      typeof parsed.badge === "string"
    ) {
      return NextResponse.json({
        reply: parsed.reply.trim() || buildChildFallback(theme, userInput).reply,
        choices: normalizeShortList(parsed.choices, themeConfig.choices, 3),
        badge: parsed.badge.trim() || themeConfig.badgePool[0],
      });
    }

    return NextResponse.json(buildChildFallback(theme, userInput));
  } catch (error) {
    const message = error instanceof Error ? error.message : "暂时连接不到模型服务";

    return NextResponse.json(
      mode === "teacher"
        ? {
            ...buildTeacherFallback(body.teacherTask ?? ""),
            error: message,
          }
        : {
            ...buildChildFallback(theme, userInput),
            error: message,
          },
    );
  }
}
