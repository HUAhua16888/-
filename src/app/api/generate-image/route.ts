import { NextResponse } from "next/server";

export const maxDuration = 60;

type ImageRequest = {
  prompt?: string;
};

function normalizeImageError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("does not exist") ||
    lower.includes("do not have access") ||
    lower.includes("model")
  ) {
    return "图片生成功能暂时还没有配置好，请先体验聊天和小游戏。后面把火山图像模型开通后，这里就能正常出图。";
  }

  if (lower.includes("timeout")) {
    return "图片生成有点慢，刚才超时了，请稍后再试。";
  }

  return "图片接口暂时不可用，请稍后再试。";
}

export async function POST(request: Request) {
  const body = (await request.json()) as ImageRequest;
  const prompt = body.prompt?.trim();
  const imageEnabled = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === "true";

  const apiKey = process.env.VOLCENGINE_ARK_API_KEY;
  const baseUrl =
    process.env.VOLCENGINE_ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
  const model =
    process.env.VOLCENGINE_ARK_IMAGE_MODEL ?? "doubao-seedream-5-0-260128";
  const imageSize = process.env.VOLCENGINE_ARK_IMAGE_SIZE ?? "2K";

  if (!imageEnabled) {
    return NextResponse.json(
      { error: "当前对外稳定版已暂时关闭 AI 出图功能，避免影响聊天和小游戏体验。" },
      { status: 400 },
    );
  }

  if (!apiKey || !prompt) {
    return NextResponse.json(
      { error: "缺少文生图配置或提示词" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
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

    return NextResponse.json({ error: normalizeImageError(message) }, { status: 500 });
  }
}
