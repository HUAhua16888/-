import { NextResponse } from "next/server";

import { resolveSafeFoodImage } from "@/lib/food-image-catalog";

export const maxDuration = 60;

type ImageRequest = {
  prompt?: string;
};

const imagePromptMaxLength = 1200;

function normalizeImageError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("does not exist") ||
    lower.includes("do not have access") ||
    lower.includes("model")
  ) {
    return "图片生成功能暂时不可用，请先体验 AI 正向提醒、语音和成长任务。";
  }

  if (lower.includes("timeout")) {
    return "图片生成有点慢，刚才超时了，请稍后再试。";
  }

  return "图片接口暂时不可用，请稍后再试。";
}

function buildFallbackImage(prompt: string, message: string) {
  const image = resolveSafeFoodImage(prompt, { scene: "menuObservationImage" });

  return {
    imageUrl: image.url,
    source: image.sourceType,
    sourceLabel: image.sourceLabel,
    fallbackUsed: true,
    teacherConfirmed: true,
    error: message,
  };
}

export async function POST(request: Request) {
  let body: ImageRequest = {};

  try {
    const parsed = (await request.json()) as unknown;
    body = parsed && typeof parsed === "object" ? (parsed as ImageRequest) : {};
  } catch {
    body = {};
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, imagePromptMaxLength) : "";
  const imageEnabled =
    (process.env.ENABLE_IMAGE_GENERATION ?? process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION) ===
    "true";

  const apiKey = process.env.VOLCENGINE_ARK_API_KEY;
  const baseUrl =
    process.env.VOLCENGINE_ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
  const model =
    process.env.VOLCENGINE_ARK_IMAGE_MODEL ?? "doubao-seedream-5-0-260128";
  const imageSize = process.env.VOLCENGINE_ARK_IMAGE_SIZE ?? "2K";
  const providerTimeoutMs = Number(process.env.IMAGE_GENERATION_TIMEOUT_MS ?? "12000");

  if (!prompt) {
    return NextResponse.json(
      { error: "图片生成功能暂时不可用，请稍后再试。" },
      { status: 400 },
    );
  }

  if (!imageEnabled) {
    return NextResponse.json(
      buildFallbackImage(prompt, "AI 出图功能当前先关闭，已先使用老师确认的本地材料图。"),
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      buildFallbackImage(prompt, "图片生成功能暂时不可用，已先使用老师确认的本地材料图。"),
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(providerTimeoutMs) ? providerTimeoutMs : 12000);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        sequential_image_generation: "disabled",
        response_format: "url",
        size: imageSize,
        stream: false,
        watermark: true,
      }),
    });

    const data = (await response.json()) as {
      data?: Array<{
        url?: string;
        b64_json?: string;
      }>;
      error?: {
        message?: string;
      };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || "图片生成失败");
    }

    const image = data.data?.[0];

    if (image?.url) {
      return NextResponse.json({ imageUrl: image.url });
    }

    if (image?.b64_json) {
      return NextResponse.json({
        imageUrl: `data:image/png;base64,${image.b64_json}`,
      });
    }

    throw new Error("图片接口返回内容为空");
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片接口暂时不可用";
    const normalizedMessage =
      error instanceof Error && error.name === "AbortError"
        ? "图片生成有点慢，已先使用老师确认的本地材料图。"
        : normalizeImageError(message);

    return NextResponse.json(buildFallbackImage(prompt, normalizedMessage));
  } finally {
    clearTimeout(timeout);
  }
}
