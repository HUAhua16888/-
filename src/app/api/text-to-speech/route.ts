import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { defaultPremiumVoiceType, type VoiceScene } from "@/lib/voice";

export const maxDuration = 60;

type TextToSpeechRequest = {
  text?: string;
  scene?: VoiceScene;
};

type SseEvent = {
  event?: string;
  data?: string;
};

function normalizeSpeechError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("appid") || lower.includes("grant")) {
    return "高质量播报的应用信息还没完全校准好，当前先用浏览器播报。";
  }

  if (lower.includes("access") || lower.includes("token") || lower.includes("auth")) {
    return "高质量播报的鉴权信息暂时没接通，当前先用浏览器播报。";
  }

  if (lower.includes("resource")) {
    return "高质量播报的模型资源还没完全配置好，当前先用浏览器播报。";
  }

  if (lower.includes("timeout")) {
    return "高质量播报有点慢，刚才超时了，请稍后再试。";
  }

  return "高质量播报暂时不可用，当前先用浏览器播报。";
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

export async function POST(request: Request) {
  const body = (await request.json()) as TextToSpeechRequest;
  const text = body.text?.trim();
  const scene = body.scene ?? "child";

  const appId = process.env.VOLCENGINE_SPEECH_APP_ID;
  const accessToken = process.env.VOLCENGINE_SPEECH_ACCESS_TOKEN;
  const secretKey = process.env.VOLCENGINE_SPEECH_SECRET_KEY;
  const endpoint =
    process.env.VOLCENGINE_TTS_ENDPOINT ?? "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse";
  const resourceId = process.env.VOLCENGINE_TTS_RESOURCE_ID ?? "seed-tts-2.0";
  const voiceType = process.env.VOLCENGINE_TTS_VOICE_TYPE ?? defaultPremiumVoiceType;
  const audioFormat = process.env.VOLCENGINE_TTS_AUDIO_FORMAT ?? "mp3";
  const sampleRate = Number(process.env.VOLCENGINE_TTS_SAMPLE_RATE ?? "24000");

  if (!text) {
    return NextResponse.json({ error: "缺少要播报的文本内容" }, { status: 400 });
  }

  if (!appId || !accessToken || !secretKey) {
    return NextResponse.json(
      { error: "高质量播报还没有配置完成，当前先用浏览器播报。" },
      { status: 400 },
    );
  }

  const requestId = randomUUID();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-App-Key": secretKey,
        "X-Api-Access-Key": accessToken,
        "X-Api-Resource-Id": resourceId,
        "X-Api-Request-Id": requestId,
      },
      body: JSON.stringify({
        app: {
          appid: appId,
        },
        user: {
          uid: `tongqu-growth-web-${scene}`,
        },
        audio: {
          voice_type: voiceType,
          encoding: audioFormat,
          rate: sampleRate,
          speed_ratio: 1,
        },
        request: {
          reqid: requestId,
          operation: "query",
          text: text.slice(0, 280),
        },
      }),
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

    const audioBuffer = Buffer.from(audioChunks.join(""), "base64");
    const contentType = audioFormat === "wav" ? "audio/wav" : "audio/mpeg";

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "高质量播报暂时不可用";

    return NextResponse.json({ error: normalizeSpeechError(message) }, { status: 500 });
  }
}
