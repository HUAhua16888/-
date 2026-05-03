"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  fetchPremiumSpeechAudio,
  registerVoiceAudio,
  speakWithBrowserVoice,
  stopAllVoicePlayback,
} from "@/lib/voice-client";

const premiumIntroEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";

function getIntroText(pathname: string) {
  if (pathname.startsWith("/teachers")) {
    return "老师好。这里可以看孩子今天玩了什么，也可以先修改确认 AI 小建议。";
  }

  if (pathname.startsWith("/adventure")) {
    return "小朋友好。我们先听一听，再看一看，慢慢玩一个小任务。";
  }

  if (pathname.startsWith("/parents")) {
    return "家长好。这里可以看老师确认的小建议，也可以和孩子一起听一听故事。";
  }

  if (pathname.startsWith("/children")) {
    return "小朋友好。先找到自己的小名牌，再去玩一个短短的小任务。";
  }

  return "欢迎来到闽食小当家。请选择儿童端、教师端或家长端。";
}

export function SiteSoundIntro() {
  const pathname = usePathname();
  const [, setStatus] = useState("准备声音介绍");
  const startedRef = useRef(false);
  const speechAbortRef = useRef<AbortController | null>(null);
  const releaseAudioRef = useRef<(() => void) | null>(null);

  function cleanupIntroSpeech() {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    releaseAudioRef.current?.();
    releaseAudioRef.current = null;
    stopAllVoicePlayback();
  }

  async function startIntro() {
    if (startedRef.current || typeof window === "undefined") {
      return;
    }

    startedRef.current = true;
    setStatus("正在播放声音介绍");

    const controller = new AbortController();
    speechAbortRef.current = controller;
    const introText = getIntroText(pathname);

    if (premiumIntroEnabled) {
      try {
        const audioBlob = await fetchPremiumSpeechAudio(introText, "child", controller.signal);

        if (!controller.signal.aborted) {
          const nextUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(nextUrl);

          audio.volume = 0.86;
          releaseAudioRef.current = registerVoiceAudio(audio, nextUrl);
          audio.onended = () => {
            releaseAudioRef.current?.();
            releaseAudioRef.current = null;
            setStatus("声音介绍已结束");
          };
          audio.onerror = () => {
            releaseAudioRef.current?.();
            releaseAudioRef.current = null;
            setStatus("声音介绍暂时没有播放");
          };
          await audio.play();
          return;
        }
      } catch {
        // The browser voice is only an emergency fallback; the global voice manager
        // still guarantees that a second voice cannot play over the premium voice.
      }
    }

    const browserPlayed = speakWithBrowserVoice(introText, "child", {
      onend: () => setStatus("声音介绍已结束"),
      onerror: () => setStatus("声音介绍暂时没有播放"),
    });

    if (!browserPlayed) {
      setStatus("声音不可用，可继续无声体验");
    }
  }

  const startIntroFromEffect = useEffectEvent(() => {
    void startIntro();
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startIntroFromEffect();
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => cleanupIntroSpeech, []);

  return null;
}
