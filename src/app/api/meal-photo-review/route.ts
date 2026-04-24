import { NextResponse } from "next/server";

import { extractJsonObject, normalizeTextContent } from "@/lib/json";

export const maxDuration = 30;

function buildDemoReview(filename: string, sizeKb: number) {
  const baseScore = Math.max(62, Math.min(94, 70 + (sizeKb % 18)));

  return {
    ok: true,
    mode: "demo",
    filename,
    sizeKb,
    message: "照片已经上传成功。当前先返回图文分析卡，后续接视觉模型后可升级成真实 AI 检测。",
    summary: "这张照片构图比较完整，适合继续做闽食光盘打卡和餐盘识别。",
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

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请先上传一张餐盘照片。" }, { status: 400 });
  }

  const apiKey = process.env.VISUAL_REVIEW_API_KEY;
  const baseUrl = process.env.VISUAL_REVIEW_BASE_URL;
  const model = process.env.VISUAL_REVIEW_MODEL;
  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  const filename = file.name || "meal-photo.jpg";

  if (!apiKey || !baseUrl || !model) {
    return NextResponse.json(buildDemoReview(filename, sizeKb));
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
    const prompt = [
      "你是一名幼儿园食育与习惯养成辅助助手。",
      "请根据上传的餐盘或闽食照片，判断它是否适合作为“闽食光盘打卡”分析材料。",
      "如果你不确定具体食物名称，请用“某种闽食候选”或“某种餐食候选”，不要乱编。",
      "必须只返回 JSON，不要返回其他文字。",
      '格式：{"summary":"","scoreCards":[{"label":"","value":0},{"label":"","value":0},{"label":"","value":0}],"guessedFoods":["","",""],"stickers":["","",""],"nextMission":"","tips":["","",""]}',
      "要求：",
      "- summary 30 字以内",
      "- scoreCards 恰好 3 个，value 取 0-100 整数",
      "- guessedFoods 恰好 3 个",
      "- stickers 恰好 3 个，风格适合幼儿",
      "- nextMission 25 字以内",
      "- tips 恰好 3 条，适合老师或家长拍图指导",
    ].join("\n");

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });

    const payload = (await response.json()) as {
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
      throw new Error(payload.error?.message || "视觉分析失败");
    }

    const raw = normalizeTextContent(payload.choices?.[0]?.message?.content);
    const parsed = extractJsonObject(raw);

    if (
      parsed &&
      typeof parsed.summary === "string" &&
      typeof parsed.nextMission === "string" &&
      Array.isArray(parsed.scoreCards) &&
      Array.isArray(parsed.guessedFoods) &&
      Array.isArray(parsed.stickers) &&
      Array.isArray(parsed.tips)
    ) {
      return NextResponse.json({
        ok: true,
        mode: "ai",
        filename,
        sizeKb,
        message: "照片已经上传成功，当前结果来自 AI 视觉分析。",
        ...parsed,
      });
    }

    return NextResponse.json(buildDemoReview(filename, sizeKb));
  } catch {
    return NextResponse.json(buildDemoReview(filename, sizeKb));
  }
}
