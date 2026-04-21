import { NextResponse } from "next/server";

export const maxDuration = 60;

type ImageRequest = {
  prompt?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ImageRequest;
  const prompt = body.prompt?.trim();

  const apiKey = process.env.VOLCENGINE_ARK_API_KEY;
  const baseUrl =
    process.env.VOLCENGINE_ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";
  const model =
    process.env.VOLCENGINE_ARK_IMAGE_MODEL ?? "doubao-seedream-3-0-t2i-250415";

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
        size: "1024x1024",
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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
