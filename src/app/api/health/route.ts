import { NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET() {
  const customVisualConfigured = Boolean(
    process.env.VISUAL_REVIEW_API_KEY &&
      process.env.VISUAL_REVIEW_BASE_URL &&
      process.env.VISUAL_REVIEW_MODEL,
  );
  const arkVisualConfigured = Boolean(
    process.env.VOLCENGINE_ARK_API_KEY &&
      process.env.VOLCENGINE_ARK_BASE_URL &&
      process.env.VOLCENGINE_ARK_VISION_MODEL,
  );

  return NextResponse.json({
    ok: true,
    app: "童趣成长乐园",
    now: new Date().toISOString(),
    env: {
      deepseekConfigured: Boolean(process.env.OPENAI_API_KEY),
      volcImageConfigured: Boolean(process.env.VOLCENGINE_ARK_API_KEY),
      volcSpeechConfigured: Boolean(
        process.env.VOLCENGINE_SPEECH_APP_ID &&
          process.env.VOLCENGINE_SPEECH_ACCESS_TOKEN &&
          process.env.VOLCENGINE_SPEECH_SECRET_KEY,
      ),
      visualReviewConfigured: customVisualConfigured || arkVisualConfigured,
      visualReviewSource: customVisualConfigured ? "custom" : arkVisualConfigured ? "ark" : "demo",
      siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      imageFeatureEnabled: process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === "true",
      premiumTtsEnabled: process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true",
    },
  });
}
