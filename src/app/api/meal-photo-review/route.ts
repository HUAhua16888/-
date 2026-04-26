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
  value: string;
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
  source?: "ai-vision" | "demo-template";
  awardBadge?: boolean;
  badgeKind?: "verified_meal_review" | "experience_sticker";
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
  return {
    ok: true,
    mode: "demo",
    filename,
    sizeKb,
    fallbackUsed: true,
    source: "demo-template",
    awardBadge: false,
    badgeKind: "experience_sticker",
    message: "照片已经上传成功，当前先返回基础观察卡，不包含真实识图结论。",
    summary: "已收到照片，可练习拍清餐盘和说出观察。",
    plateState: "待现场确认",
    confidenceLabel: "基础模板",
    highlightTags: ["上传成功", "练习观察", "现场确认"],
    scoreCards: [
      { label: "画面范围", value: "看整盘是否入镜" },
      { label: "食物名称", value: "请现场确认" },
      { label: "孩子表达", value: "可说一小句" },
    ],
    guessedFoods: ["餐盘主体待确认", "食物名称待确认", "现场观察为准"],
    stickers: ["拍照练习卡", "观察小贴纸", "表达小鼓励"],
    nextMission: "请孩子说一句：我看到了什么。",
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
  const arkBaseUrl =
    process.env.VOLCENGINE_ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
  const arkVisionModel = process.env.VOLCENGINE_ARK_VISION_MODEL;

  if (arkApiKey && arkBaseUrl && arkVisionModel) {
    return {
      apiKey: arkApiKey,
      baseUrl: arkBaseUrl,
      model: arkVisionModel,
      providerStyle: "openai-responses",
      apiPath: "/responses",
      source: "ark",
    };
  }

  return null;
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

function normalizeObservationValue(input: unknown, fallback: string) {
  if (typeof input === "number" && !Number.isNaN(input)) {
    if (input >= 80) {
      return "较清楚";
    }

    if (input >= 50) {
      return "可参考";
    }

    return "需确认";
  }

  const cleaned = normalizeShortText(input, fallback, 12);

  return isScoreLikeText(cleaned) ? fallback : cleaned;
}

function isScoreLikeText(value: string) {
  const cleaned = value.trim();

  return (
    /^\d+$/.test(cleaned) ||
    /\d+\s*(分|%|％|\/\s*\d+)/.test(cleaned) ||
    /[A-D][+-]?/.test(cleaned) ||
    /星级|等级/.test(cleaned)
  );
}

function hasNonEmptyText(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function hasStringList(input: unknown, minimumLength: number) {
  return (
    Array.isArray(input) &&
    input.filter((item) => typeof item === "string" && item.trim().length > 0).length >= minimumLength
  );
}

function hasValidScoreCards(input: unknown) {
  if (!Array.isArray(input) || input.length < 3) {
    return false;
  }

  return input.slice(0, 3).every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const record = item as Record<string, unknown>;
    const value = record.value;

    return hasNonEmptyText(record.label) && hasNonEmptyText(value) && !isScoreLikeText(value.trim());
  });
}

function isValidVisionPayload(parsed: Record<string, unknown>) {
  return (
    hasNonEmptyText(parsed.summary) &&
    hasNonEmptyText(parsed.plateState) &&
    hasNonEmptyText(parsed.confidenceLabel) &&
    hasStringList(parsed.highlightTags, 3) &&
    hasValidScoreCards(parsed.scoreCards) &&
    hasStringList(parsed.guessedFoods, 3) &&
    hasStringList(parsed.stickers, 3) &&
    hasNonEmptyText(parsed.nextMission) &&
    hasStringList(parsed.tips, 3)
  );
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
          : fallback[index]?.label ?? `观察项 ${index + 1}`;
      const value = normalizeObservationValue(
        "value" in item ? item.value : undefined,
        fallback[index]?.value ?? "需确认",
      );

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
): ReviewResult | null {
  if (!parsed || !isValidVisionPayload(parsed)) {
    return null;
  }

  const summary = normalizeShortText(parsed.summary, fallback.summary, 40);
  const nextMission = normalizeShortText(parsed.nextMission, fallback.nextMission, 30);
  const plateState = normalizeShortText(parsed.plateState, fallback.plateState, 14);
  const confidenceLabel = normalizeShortText(parsed.confidenceLabel, "已生成", 12);

  return {
    ...fallback,
    mode: "ai",
    fallbackUsed: false,
    source: "ai-vision",
    awardBadge: true,
    badgeKind: "verified_meal_review",
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
    "请根据上传的餐盘或闽食照片，判断它是否适合作为“闽食餐盘观察”材料。",
    "如果你不确定具体食物名称，请用“某种闽食候选”或“某种餐食候选”，不要乱编。",
    "不要解释、不要推理过程。必须只返回 JSON，不要返回其他文字。",
    '格式：{"summary":"","plateState":"","confidenceLabel":"","highlightTags":["","",""],"scoreCards":[{"label":"","value":""},{"label":"","value":""},{"label":"","value":""}],"guessedFoods":["","",""],"stickers":["","",""],"nextMission":"","tips":["","",""]}',
    "要求：",
    "- summary 30 字以内",
    "- plateState 12 字以内",
    "- confidenceLabel 12 字以内",
    "- highlightTags 恰好 3 个，适合做图卡标签",
    "- scoreCards 恰好 3 个，value 必须是描述性观察短语，不要给 0-100 分数或百分制评价",
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
                role: "user",
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
            max_output_tokens: 1800,
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
          "视觉结果不稳定，先返回基础观察卡。",
        ),
      );
    }

    const normalized = normalizeReviewPayload(parsed, fallback);

    if (!normalized) {
      return NextResponse.json(
        buildFallbackReview(
          fallback,
          "vision_response_invalid",
          "视觉结果不完整，先返回基础观察卡。",
        ),
      );
    }

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
        "视觉分析暂不可用，先返回基础观察卡。",
      ),
    );
  }
}
