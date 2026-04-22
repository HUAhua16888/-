import type { VoiceScene } from "@/lib/voice";

type TextToSpeechErrorResponse = {
  error?: string;
};

export async function fetchPremiumSpeechAudio(text: string, scene: VoiceScene) {
  const response = await fetch("/api/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, scene }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as TextToSpeechErrorResponse;
    throw new Error(data.error || "高质量播报暂时不可用");
  }

  return response.blob();
}

