import { NextResponse } from "next/server";

import { extractJsonObject, normalizeTextContent } from "@/lib/json";

export const maxDuration = 45;

const maxImageSizeBytes = 8 * 1024 * 1024;
const supportedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type ReviewCard = {
  label: string;
  value: number;
};

type ReviewResult = {
  ok: true;
  mode: "demo" | "ai";
  filename: string;
  sizeKb: number;
  message: string;
  summary: string;
  plateState: string;
  confidenceLabel: string;
  highlightTags: string[];
  scoreCards: ReviewCard[];
  guessedFoods: string[];
  stickers: string[];
  nextMission: string;
  tips: string[];
};

function buildDemoReview(filename: string, sizeKb: number): ReviewResult {
  const baseScore = Math.max(62, Math.min(94, 70 + (sizeKb % 18)));

  return {
    ok: true,
    mode: "demo",
    filename,
    sizeKb,
    message: "照片已经上传成功。当前先返回图文分析卡，后续接视觉模型后可升级成真实 AI 检测。",
    summary: "这张照片构图比较完整，适合继续做闽食光盘打卡和餐盘识别。",
    plateState: "餐盘主体清楚",
    confidenceLabel: "演示分析中",
    highlightTags: ["整盘入镜", "适合继续识别", "可补真实视觉模型"],
    scoreCards: [
      { label: "光盘观察分", value: baseScore },
      { label: "闽食识别分", value: Math.max(58, baseScore - 6) },
      { label: "勇敢尝试分", value: Math.min(96, baseScore + 4) },
    ],
    guessedFoods: ["海蛎煎候选", "紫菜蛋汤候选", "南瓜小块候选"],
    stickers: ["闽食小寻宝", "勇敢品尝章", "光盘观察员"],
    nextMission: "请孩子说一句：这是我今天最想介绍的闽食。",
    tips: [
      "建议拍整张餐盘，别只拍局部。",
      "餐盘边缘和食物都要在画面里。",
      "后续接视觉模型后可扩展成真实 AI 检测。",
    ],
  };
}

function clampScore(input: unknown, fallback: number) {
  if (typeof input !== "number" || Number.isNaN(input)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(input)));
}

function normalizeStringList(input: unknown, fallback: string[], limit: number) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const cleaned = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);

  return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeScoreCards(input: unknown, fallback: ReviewCard[]) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const cards = input
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const label =
        "label" in item && typeof item.label === "string" && item.label.trim()
          ? item.label.trim()
          : fallback[index]?.label ?? `观察分 ${index + 1}`;
      const value = clampScore("value" in item ? item.value : undefined, fallback[index]?.value ?? 72);

      return { label, value };
    })
    .filter((item): item is ReviewCard => Boolean(item))
    .slice(0, 3);

  if (cards.length === 3) {
    return cards;
  }

  return fallback;
}

function normalizeReviewPayload(
  parsed: Record<string, unknown> | null,
  fallback: ReviewResult,
): ReviewResult {
  if (!parsed) {
    return fallback;
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : fallback.summary;
  const nextMission =
    typeof parsed.nextMission === "string" && parsed.nextMission.trim()
      ? parsed.nextMission.trim()
      : fallback.nextMission;
  const plateState =
    typeof parsed.plateState === "string" && parsed.plateState.trim()
      ? parsed.plateState.trim()
      : fallback.plateState;
  const confidenceLabel =
    typeof parsed.confidenceLabel === "string" && parsed.confidenceLabel.trim()
      ? parsed.confidenceLabel.trim()
      : "AI 已分析";

  return {
    ...fallback,
    mode: "ai",
    message: "照片已经上传成功，当前结果来自 AI 视觉分析。",
    summary,
    nextMission,
    plateState,
    confidenceLabel,
    highlightTags: normalizeStringList(parsed.highlightTags, fallback.highlightTags, 3),
    scoreCards: normalizeScoreCards(parsed.scoreCards, fallback.scoreCards),
    guessedFoods: normalizeStringList(parsed.guessedFoods, fallback.guessedFoods, 3),
    stickers: normalizeStringList(parsed.stickers, fallback.stickers, 3),
    tips: normalizeStringList(parsed.tips, fallback.tips, 3),
  };
}

function getEndpointUrl(baseUrl: string, apiPath: string) {
  if (/^https?:\/\//i.test(apiPath)) {
    return apiPath;
  }

  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function extractVisionText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybePayload = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output?: Array<{
      content?: Array<{ text?: string; type?: string }>;
    }>;
    output_text?: string;
  };

  if (typeof maybePayload.output_text === "string" && maybePayload.output_text.trim()) {
    return maybePayload.output_text.trim();
  }

  if (Array.isArray(maybePayload.output)) {
    const joined = maybePayload.output
      .flatMap((item) =>
        Array.isArray(item.content)
          ? item.content.map((contentItem) =>
              contentItem && typeof contentItem.text === "string" ? contentItem.text : "",
            )
          : [],
      )
      .join("\n")
      .trim();

    if (joined) {
      return joined;
    }
  }

  return normalizeTextContent(maybePayload.choices?.[0]?.message?.content);
}

function buildPrompt() {
  return [
    "你是一名幼儿园食育与习惯养成辅助助手。",
    "请根据上传的餐盘或闽食照片，判断它是否适合作为“闽食光盘打卡”分析材料。",
    "如果你不确定具体食物名称，请用“某种闽食候选”或“某种餐食候选”，不要乱编。",
    "必须只返回 JSON，不要返回其他文字。",
    '格式：{"summary":"","plateState":"","confidenceLabel":"","highlightTags":["","",""],"scoreCards":[{"label":"","value":0},{"label":"","value":0},{"label":"","value":0}],"guessedFoods":["","",""],"stickers":["","",""],"nextMission":"","tips":["","",""]}',
    "要求：",
    "- summary 30 字以内",
    "- plateState 12 字以内",
    "- confidenceLabel 12 字以内",
    "- highlightTags 恰好 3 个，适合做图卡标签",
    "- scoreCards 恰好 3 个，value 取 0-100 整数",
    "- guessedFoods 恰好 3 个",
    "- stickers 恰好 3 个，风格适合幼儿",
    "- nextMission 25 字以内",
    "- tips 恰好 3 条，适合老师或家长拍图指导",
  ].join("\n");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请先上传一张餐盘照片。" }, { status: 400 });
  }

  if (!supportedImageTypes.has(file.type)) {
    return NextResponse.json(
      { error: "当前支持 JPG、PNG、WebP 或 HEIC 图片。" },
      { status: 400 },
    );
  }

  if (file.size > maxImageSizeBytes) {
    return NextResponse.json(
      { error: "图片有点大，建议压到 8MB 以内再上传。" },
      { status: 400 },
    );
  }

  const apiKey = process.env.VISUAL_REVIEW_API_KEY;
  const baseUrl = process.env.VISUAL_REVIEW_BASE_URL;
  const model = process.env.VISUAL_REVIEW_MODEL;
  const providerStyle = process.env.VISUAL_REVIEW_PROVIDER_STYLE ?? "openai-chat";
  const apiPath = process.env.VISUAL_REVIEW_API_PATH ?? "/chat/completions";
  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  const filename = file.name || "meal-photo.jpg";
  const fallback = buildDemoReview(filename, sizeKb);

  if (!apiKey || !baseUrl || !model) {
    return NextResponse.json(fallback);
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
    const prompt = buildPrompt();
    const endpoint = getEndpointUrl(baseUrl, apiPath);

    const requestBody =
      providerStyle === "openai-responses" || apiPath.includes("/responses")
        ? {
            model,
            input: [
              {
                role: "system",
                content: [{ type: "input_text", text: prompt }],
              },
              {
                role: "user",
                content: [
                  { type: "input_text", text: "请分析这张孩子上传的餐盘或闽食照片。" },
                  { type: "input_image", image_url: dataUrl },
                ],
              },
            ],
            max_output_tokens: 900,
          }
        : {
            model,
            temperature: 0.2,
            max_tokens: 900,
            messages: [
              {
                role: "system",
                content: prompt,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "请分析这张孩子上传的餐盘或闽食照片。",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: dataUrl,
                    },
                  },
                ],
              },
            ],
          };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || payload.message || "视觉分析失败");
    }

    const raw = extractVisionText(payload);
    const parsed = extractJsonObject(raw);
    return NextResponse.json(normalizeReviewPayload(parsed, fallback));
  } catch {
    return NextResponse.json(fallback);
  }
}
