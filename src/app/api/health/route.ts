import { NextResponse } from "next/server";

export const maxDuration = 10;

type CapabilityStatus = {
  label: string;
  ready: boolean;
  mode: "configured" | "demo" | "disabled";
  fallback: string;
  nextAction: string;
};

function capability(
  label: string,
  ready: boolean,
  liveFallback: string,
  missingFallback: string,
  nextAction: string,
): CapabilityStatus {
  return {
    label,
    ready,
    mode: ready ? "configured" : "demo",
    fallback: ready ? liveFallback : missingFallback,
    nextAction: ready ? "已配置；真实可用需以接口请求结果为准。" : nextAction,
  };
}

export async function GET(request: Request) {
  const internalToken = process.env.INTERNAL_HEALTH_TOKEN;
  const requestToken = request.headers.get("x-internal-health-token");
  const canShowInternal = Boolean(internalToken && requestToken === internalToken);

  const deepseekConfigured = Boolean(process.env.OPENAI_API_KEY);
  const imageFeatureEnabled =
    (process.env.ENABLE_IMAGE_GENERATION ?? process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION) ===
    "true";
  const volcImageConfigured = Boolean(process.env.VOLCENGINE_ARK_API_KEY);
  const volcSpeechConfigured = Boolean(
    process.env.VOLCENGINE_SPEECH_API_KEY ||
      (process.env.VOLCENGINE_SPEECH_APP_ID && process.env.VOLCENGINE_SPEECH_ACCESS_TOKEN),
  );
  const customVisualConfigured = Boolean(
    process.env.VISUAL_REVIEW_API_KEY &&
      process.env.VISUAL_REVIEW_BASE_URL &&
      process.env.VISUAL_REVIEW_MODEL,
  );
  const arkVisualConfigured = Boolean(
    process.env.VOLCENGINE_ARK_API_KEY && process.env.VOLCENGINE_ARK_VISION_MODEL,
  );
  const visualReviewConfigured = customVisualConfigured || arkVisualConfigured;
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const capabilities: Record<string, CapabilityStatus> = {
    storyChat: capability(
      "AI 故事和老师内容生成",
      deepseekConfigured,
      "使用配置的聊天模型生成内容。",
      "使用本地主题模板兜底。",
      "配置 OPENAI_API_KEY、OPENAI_BASE_URL 和 OPENAI_MODEL。",
    ),
    imageGeneration: {
      label: "章节插图生成",
      ready: imageFeatureEnabled && volcImageConfigured,
      mode: !imageFeatureEnabled ? "disabled" : volcImageConfigured ? "configured" : "demo",
      fallback: !imageFeatureEnabled
        ? "前端隐藏生成入口。"
        : volcImageConfigured
          ? "使用火山方舟文生图。"
          : "保留插图区提示，不调用外部出图。",
      nextAction: !imageFeatureEnabled
          ? "需要出图时打开 ENABLE_IMAGE_GENERATION。"
        : volcImageConfigured
          ? "已配置；真实可用需以接口请求结果为准。"
          : "配置 VOLCENGINE_ARK_API_KEY 和图片模型。",
    },
    mealPhotoReview: capability(
      "闽食餐盘观察",
      visualReviewConfigured,
      customVisualConfigured ? "使用自定义视觉模型。" : "使用火山方舟视觉模型。",
      "使用结构化 demo 分析卡。",
      "配置 VISUAL_REVIEW_* 或 VOLCENGINE_ARK_VISION_MODEL。",
    ),
    premiumTts: {
      label: "高质量语音播报",
      ready: premiumTtsEnabled && volcSpeechConfigured,
      mode: !premiumTtsEnabled ? "disabled" : volcSpeechConfigured ? "configured" : "demo",
      fallback: !premiumTtsEnabled
        ? "使用浏览器原生播报。"
        : volcSpeechConfigured
          ? "使用火山语音播报。"
          : "前端会回退到浏览器播报。",
      nextAction: !premiumTtsEnabled
          ? "需要高质量播报时打开 NEXT_PUBLIC_ENABLE_PREMIUM_TTS。"
        : volcSpeechConfigured
          ? "已配置；真实可用需以接口请求结果为准。"
          : "配置 VOLCENGINE_SPEECH_API_KEY，或同一应用下的 APP_ID 和 ACCESS_TOKEN。",
    },
  };
  const readyCount = Object.values(capabilities).filter((item) => item.ready).length;
  const publicMode =
    readyCount >= 3 ? "production-ready" : readyCount >= 1 ? "hybrid-demo" : "local-demo";

  if (!canShowInternal) {
    return NextResponse.json({
      ok: true,
      app: "幼芽成长智伴",
      now: new Date().toISOString(),
      status: publicMode === "local-demo" ? "basic" : "available",
    });
  }

  const recommendations = Object.entries(capabilities)
    .filter(([, item]) => !item.ready)
    .map(([key, item]) => ({
      key,
      label: item.label,
      mode: item.mode,
      nextAction: item.nextAction,
    }));

  return NextResponse.json({
    ok: true,
    app: "幼芽成长智伴",
    now: new Date().toISOString(),
    summary: {
      readyCapabilities: readyCount,
      totalCapabilities: Object.keys(capabilities).length,
      publicMode,
    },
    capabilities,
    recommendations,
    env: {
      deepseekConfigured,
      volcImageConfigured,
      volcSpeechConfigured,
      visualReviewConfigured,
      visualReviewSource: customVisualConfigured ? "custom" : arkVisualConfigured ? "ark" : "demo",
      siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      imageFeatureEnabled,
      premiumTtsEnabled,
    },
  });
}
