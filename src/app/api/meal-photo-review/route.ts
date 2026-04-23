import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请先上传一张餐盘照片。" }, { status: 400 });
  }

  const sizeKb = Math.max(1, Math.round(file.size / 1024));

  return NextResponse.json({
    ok: true,
    filename: file.name || "meal-photo.jpg",
    sizeKb,
    message:
      "照片已经上传成功。当前比赛版先完成拍图上传和预览，后续接视觉模型后，就能继续做光盘识别、剩饭判断和闽食名称识别。",
    tips: [
      "建议拍整张餐盘，别只拍局部。",
      "餐盘边缘和食物都要在画面里。",
      "后续接视觉模型后可扩展成真实 AI 检测。",
    ],
  });
}
