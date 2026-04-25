import { NextResponse } from "next/server";

import { extractJsonObject, normalizeTextContent } from "@/lib/json";

export const maxDuration = 45;

const maxImageSizeBytes = 8 * 1024 * 1024;
const maxMultipartSizeBytes = maxImageSizeBytes + 512 * 1024;
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
  fallbackUsed?: boolean;
  warning?: string;
  warningCode?: "vision_provider_failed" | "vision_response_invalid";
};

type VisualReviewRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerStyle: string;
  apiPath: string;
  source: "custom" | "ark";
};

function buildErrorResponse(
  error: string,
  errorCode: "invalid_form_data" | "missing_photo" | "unsupported_type" | "file_too_large",
  retryable: boolean,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      errorCode,
      retryable,
    },
    { status },
  );
}

function buildFallbackReview(
  fallback: ReviewResult,
  warningCode: "vision_provider_failed" | "vision_response_invalid",
  warning: string,
): ReviewResult {
  return {
    ...fallback,
    fallbackUsed: true,
    warning,
    warningCode,
    message: `${warning} ${fallback.message}`,
  };
}

function buildDemoReview(filename: string, sizeKb: number): ReviewResult {
  const baseScore = Math.max(62, Math.min(94, 70 + (sizeKb % 18)));

  return {
    ok: true,
    mode: "demo",
    filename,
    sizeKb,
    message: "照片已经上传成功，已经生成基础观察卡。",
    summary: "这张照片构图比较完整，适合继续做闽食光盘观察和餐盘介绍。",
    plateState: "餐盘主体清楚",
    confidenceLabel: "基础观察",
    highlightTags: ["整盘入镜", "适合观察", "可继续介绍"],
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
      "请以老师或家长现场观察为准。",
    ],
  };
}

function getVisualReviewRuntimeConfig(): VisualReviewRuntimeConfig | null {
  const customApiKey = process.env.VISUAL_REVIEW_API_KEY;
  const customBaseUrl = process.env.VISUAL_REVIEW_BASE_URL;
  const customModel = process.env.VISUAL_REVIEW_MODEL;

  if (customApiKey && customBaseUrl && customModel) {
    return {
      apiKey: customApiKey,
      baseUrl: customBaseUrl,
      model: customModel,
      providerStyle: process.env.VISUAL_REVIEW_PROVIDER_STYLE ?? "openai-chat",
      apiPath: process.env.VISUAL_REVIEW_API_PATH ?? "/chat/completions",
      source: "custom",
    };
  }

  const arkApiKey = process.env.VOLCENGINE_ARK_API_KEY;
  const arkBaseUrl = process.env.VOLCENGINE_ARK_BASE_URL;
  const arkVisionModel = process.env.VOLCENGINE_ARK_VISION_MODEL;

  if (arkApiKey && arkBaseUrl && arkVisionModel) {
    return {
      apiKey: arkApiKey,
      baseUrl: arkBaseUrl,
      model: arkVisionModel,
      providerStyle: "openai-chat",
      apiPath: "/chat/completions",
      source: "ark",
    };
  }

  return null;
}

function clampScore(input: unknown, fallback: number) {
  if (typeof input !== "number" || Number.isNaN(input)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(input)));
}

function normalizeShortText(input: unknown, fallback: string, maxLength: number) {
  if (typeof input !== "string") {
    return fallback;
  }

  const cleaned = input.replace(/\s+/g, " ").trim().slice(0, maxLength);

  return cleaned || fallback;
}

function normalizeStringList(input: unknown, fallback: string[], limit: number, maxLength = 18) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const cleaned = input
    .map((item) => normalizeShortText(item, "", maxLength))
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
          ? item.label.trim().slice(0, 10)
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

  const summary = normalizeShortText(parsed.summary, fallback.summary, 40);
  const nextMission = normalizeShortText(parsed.nextMission, fallback.nextMission, 30);
  const plateState = normalizeShortText(parsed.plateState, fallback.plateState, 14);
  const confidenceLabel = normalizeShortText(parsed.confidenceLabel, "已生成", 12);

  return {
    ...fallback,
    mode: "ai",
    message: "照片已经上传成功，已经生成餐盘观察卡。",
    summary,
    nextMission,
    plateState,
    confidenceLabel,
    highlightTags: normalizeStringList(parsed.highlightTags, fallback.highlightTags, 3, 8),
    scoreCards: normalizeScoreCards(parsed.scoreCards, fallback.scoreCards),
    guessedFoods: normalizeStringList(parsed.guessedFoods, fallback.guessedFoods, 3, 12),
    stickers: normalizeStringList(parsed.stickers, fallback.stickers, 3, 10),
    tips: normalizeStringList(parsed.tips, fallback.tips, 3, 24),
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
  let formData: FormData;
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > maxMultipartSizeBytes) {
    return buildErrorResponse("图片有点大，建议压到 8MB 以内再上传。", "file_too_large", false, 413);
  }

  try {
    formData = await request.formData();
  } catch {
    return buildErrorResponse("照片表单读取失败，请重新选择照片后上传。", "invalid_form_data", true, 400);
  }

  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return buildErrorResponse("请先上传一张餐盘照片。", "missing_photo", false, 400);
  }

  if (!supportedImageTypes.has(file.type)) {
    return buildErrorResponse("当前支持 JPG、PNG、WebP 或 HEIC 图片。", "unsupported_type", false, 400);
  }

  if (file.size > maxImageSizeBytes) {
    return buildErrorResponse("图片有点大，建议压到 8MB 以内再上传。", "file_too_large", false, 400);
  }

  const runtimeConfig = getVisualReviewRuntimeConfig();
  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  const filename = file.name || "meal-photo.jpg";
  const fallback = buildDemoReview(filename, sizeKb);

  if (!runtimeConfig) {
    return NextResponse.json(fallback);
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
    const prompt = buildPrompt();
    const endpoint = getEndpointUrl(runtimeConfig.baseUrl, runtimeConfig.apiPath);

    const requestBody =
      runtimeConfig.providerStyle === "openai-responses" || runtimeConfig.apiPath.includes("/responses")
        ? {
            model: runtimeConfig.model,
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
            model: runtimeConfig.model,
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
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || payload.message || "视觉分析失败");
    }

    const raw = extractVisionText(payload);
    const parsed = extractJsonObject(raw);

    if (!parsed) {
      return NextResponse.json(
        buildFallbackReview(
          fallback,
          "vision_response_invalid",
          "这张照片先生成基础观察卡，请结合现场情况判断。",
        ),
      );
    }

    const normalized = normalizeReviewPayload(parsed, fallback);

    return NextResponse.json({
      ...normalized,
      message:
        runtimeConfig.source === "ark"
          ? "照片已经上传成功，已经生成餐盘观察卡。"
          : normalized.message,
      confidenceLabel:
        runtimeConfig.source === "ark" && normalized.confidenceLabel === "AI 已分析"
          ? "已生成"
          : normalized.confidenceLabel,
    });
  } catch {
    return NextResponse.json(
      buildFallbackReview(
        fallback,
        "vision_provider_failed",
        "这张照片先生成基础观察卡，请结合现场情况判断。",
      ),
    );
  }
}
