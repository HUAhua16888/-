import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { defaultPremiumVoiceType, premiumVoiceTuningByScene, type VoiceScene } from "@/lib/voice";

export const maxDuration = 60;

type TextToSpeechRequest = {
  text?: string;
  scene?: VoiceScene;
};

type SseEvent = {
  event?: string;
  data?: string;
};

type SpeechRequestOptions = {
  endpoint: string;
  headers: Record<string, string>;
  body: unknown;
};

function normalizeSpeechError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("appid") || lower.includes("grant")) {
    return "高质量播报暂时不可用，前端会尝试浏览器播报。";
  }

  if (lower.includes("access") || lower.includes("token") || lower.includes("auth")) {
    return "高质量播报暂时不可用，前端会尝试浏览器播报。";
  }

  if (lower.includes("resource")) {
    return "高质量播报暂时不可用，前端会尝试浏览器播报。";
  }

  if (lower.includes("timeout")) {
    return "高质量播报有点慢，刚才超时了，请稍后再试。";
  }

  return "高质量播报暂时不可用，前端会尝试浏览器播报。";
}

function parseSseEvents(source: string) {
  return source
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const entry: SseEvent = {};

      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          entry.event = line.slice(6).trim();
        }

        if (line.startsWith("data:")) {
          entry.data = entry.data ? `${entry.data}\n${line.slice(5).trim()}` : line.slice(5).trim();
        }
      }

      return entry;
    });
}

function looksLikeBase64(value: string) {
  const clean = value.replace(/\s+/g, "");
  return clean.length > 128 && /^[A-Za-z0-9+/=]+$/.test(clean);
}

function extractAudioChunk(value: unknown): string | null {
  if (typeof value === "string") {
    return looksLikeBase64(value) ? value.replace(/\s+/g, "") : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    const nested = extractAudioChunk(entry);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeSampleRate(value: string | undefined) {
  const parsed = Number(value ?? "24000");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24000;
}

async function fetchSpeechChunks({ endpoint, headers, body }: SpeechRequestOptions) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const source = await response.text();
  const events = parseSseEvents(source);
  const audioChunks: string[] = [];
  let lastError = "";

  for (const event of events) {
    if (!event.data) {
      continue;
    }

    try {
      const payload = JSON.parse(event.data) as Record<string, unknown>;

      if (typeof payload.message === "string" && typeof payload.code === "number" && payload.code !== 0) {
        lastError = payload.message;
      }

      const audioChunk = extractAudioChunk(payload);
      if (audioChunk) {
        audioChunks.push(audioChunk);
      }
    } catch {
      lastError = lastError || "高质量播报返回内容暂时无法解析";
    }
  }

  if (!response.ok) {
    throw new Error(lastError || "高质量播报接口调用失败");
  }

  if (audioChunks.length === 0) {
    throw new Error(lastError || "高质量播报暂时没有返回音频");
  }

  return audioChunks;
}

export async function POST(request: Request) {
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  let body: TextToSpeechRequest = {};

  try {
    const parsed = (await request.json()) as unknown;
    body = parsed && typeof parsed === "object" ? (parsed as TextToSpeechRequest) : {};
  } catch {
    body = {};
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const scene = body.scene === "teacher" ? "teacher" : "child";

  const appId = process.env.VOLCENGINE_SPEECH_APP_ID;
  const accessToken = process.env.VOLCENGINE_SPEECH_ACCESS_TOKEN;
  const apiKey = process.env.VOLCENGINE_SPEECH_API_KEY;
  const secretKey = process.env.VOLCENGINE_SPEECH_SECRET_KEY;
  const endpoint =
    process.env.VOLCENGINE_TTS_ENDPOINT ?? "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse";
  const resourceId = process.env.VOLCENGINE_TTS_RESOURCE_ID ?? "seed-tts-2.0";
  const voiceType = process.env.VOLCENGINE_TTS_VOICE_TYPE ?? defaultPremiumVoiceType;
  const audioFormat = process.env.VOLCENGINE_TTS_AUDIO_FORMAT ?? "mp3";
  const sampleRate = normalizeSampleRate(process.env.VOLCENGINE_TTS_SAMPLE_RATE);
  const voiceTuning = premiumVoiceTuningByScene[scene];

  if (!text) {
    return NextResponse.json({ error: "缺少要播报的文本内容" }, { status: 400 });
  }

  if (!premiumTtsEnabled) {
    return NextResponse.json(
      { error: "高质量播报开关未开启，前端会尝试浏览器播报。" },
      { status: 400 },
    );
  }

  if (!apiKey && (!appId || !accessToken)) {
    return NextResponse.json(
      { error: "高质量播报暂时不可用，前端会尝试浏览器播报。" },
      { status: 400 },
    );
  }

  const requestId = randomUUID();

  try {
    const textForSpeech = text.slice(0, 280);
    const commonHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Resource-Id": resourceId,
      "X-Api-Request-Id": requestId,
    };
    const v3Headers = apiKey
      ? {
          ...commonHeaders,
          "X-Api-Key": apiKey,
        }
      : {
          ...commonHeaders,
          "X-Api-App-Id": appId as string,
          "X-Api-App-Key": appId as string,
          "X-Api-Access-Key": accessToken as string,
        };
    const v3Body = {
      user: {
        uid: `youxi-bao-education-agent-${scene}`,
      },
      req_params: {
        text: textForSpeech,
        speaker: voiceType,
        audio_params: {
          format: audioFormat,
          sample_rate: sampleRate,
          speech_rate: voiceTuning.speechRate,
          loudness_rate: voiceTuning.loudnessRate,
        },
      },
    };
    const legacyBody = {
      app: {
        appid: appId,
      },
      user: {
        uid: `youxi-bao-education-agent-${scene}`,
      },
      audio: {
        voice_type: voiceType,
        encoding: audioFormat,
        rate: sampleRate,
        speed_ratio: voiceTuning.speedRatio,
      },
      request: {
        reqid: requestId,
        operation: "query",
        text: textForSpeech,
      },
    };

    let audioChunks: string[];

    try {
      audioChunks = await fetchSpeechChunks({
        endpoint,
        headers: v3Headers,
        body: v3Body,
      });
    } catch (primaryError) {
      if (!secretKey || !accessToken) {
        throw primaryError;
      }

      audioChunks = await fetchSpeechChunks({
        endpoint,
        headers: {
          ...commonHeaders,
          "X-Api-App-Id": appId as string,
          "X-Api-App-Key": appId as string,
          "X-Api-Access-Key": accessToken,
        },
        body: legacyBody,
      });
    }

    const audioBuffer = Buffer.from(audioChunks.join(""), "base64");
    const contentType = audioFormat === "wav" ? "audio/wav" : "audio/mpeg";

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-TTS-Voice-Type": voiceType,
        "X-TTS-Resource-Id": resourceId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "高质量播报暂时不可用";

    return NextResponse.json({ error: normalizeSpeechError(message) }, { status: 500 });
  }
}
