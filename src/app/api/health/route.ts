import { NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "童趣成长乐园",
    now: new Date().toISOString(),
    env: {
      deepseekConfigured: Boolean(process.env.OPENAI_API_KEY),
      volcImageConfigured: Boolean(process.env.VOLCENGINE_ARK_API_KEY),
      siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      imageFeatureEnabled: process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === "true",
    },
  });
}
