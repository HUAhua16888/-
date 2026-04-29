"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchPremiumSpeechAudio } from "@/lib/voice-client";

const introMusicNotes = [392, 523.25, 659.25];
const introBass = 196;
const premiumIntroEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";

function getIntroText(pathname: string) {
  if (pathname.startsWith("/teachers")) {
    return "欢迎来到幼芽成长智伴，幼习宝一日生活习惯养成和闽食成长岛食育改善协同教育智能体。这里是教师工作台，老师可以查看 AI 成长记录，生成跟进建议，并同步家庭任务。";
  }

  if (pathname.startsWith("/adventure")) {
    return "欢迎来到幼芽成长智伴。今天跟着幼习宝练洗手、喝水、如厕、整理、排队和文明进餐，也可以到闽食成长岛温和认识食材。";
  }

  if (pathname.startsWith("/parents")) {
    return "欢迎来到幼芽成长智伴。这里是家庭延续，可以查看老师今天的观察，回家做一个小步骤，再提交家庭观察。";
  }

  if (pathname.startsWith("/children")) {
    return "欢迎来到幼芽成长智伴。这里是儿童互动，先找到自己的小名牌，再进入幼习宝一日生活习惯或闽食成长岛任务。";
  }

  return "欢迎来到幼芽成长智伴，幼习宝一日生活习惯养成和闽食成长岛食育改善协同教育智能体。请选择儿童互动、教师工作台或家庭延续。";
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextApi =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return AudioContextApi ? new AudioContextApi() : null;
}

function playIntroTone(
  context: AudioContext,
  masterGain: GainNode,
  frequency: number,
  startAt: number,
  duration: number,
  gainValue: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
}

function pickMandarinVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return (
    window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("zh")) ?? null
  );
}

function speakIntroWithBrowser(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickMandarinVoice();

  utterance.lang = "zh-CN";
  utterance.rate = 0.92;
  utterance.pitch = 1.05;

  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

export function SiteSoundIntro() {
  const pathname = usePathname();
  const [needsGesture, setNeedsGesture] = useState(true);
  const [status, setStatus] = useState("开启声音介绍");
  const startedRef = useRef(false);
  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);

  function cleanupIntroSpeech() {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function stopIntroMusic() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const context = contextRef.current;
    const masterGain = masterGainRef.current;

    if (context && masterGain) {
      masterGain.gain.cancelScheduledValues(context.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, context.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
    }

    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
    }

    fadeTimerRef.current = window.setTimeout(() => {
      contextRef.current?.close().catch(() => undefined);
      contextRef.current = null;
      masterGainRef.current = null;
    }, 900);
  }

  async function startIntro(kind: "auto" | "gesture") {
    if (startedRef.current || typeof window === "undefined") {
      return;
    }

    const context = contextRef.current ?? getAudioContext();

    if (!context) {
      setStatus("声音不可用，可继续无声体验");
      setNeedsGesture(true);
      return;
    }

    if (!contextRef.current) {
      const masterGain = context.createGain();
      masterGain.gain.value = 0.045;
      masterGain.connect(context.destination);
      contextRef.current = context;
      masterGainRef.current = masterGain;
    }

    try {
      await context.resume();
    } catch {
      startedRef.current = false;
      setStatus("声音未开启，可继续无声体验");
      setNeedsGesture(true);
      return;
    }

    if (context.state !== "running") {
      startedRef.current = false;
      setStatus("声音未开启，可继续无声体验");
      setNeedsGesture(true);
      return;
    }

    const masterGain = masterGainRef.current;

    if (!masterGain) {
      setStatus("声音初始化失败");
      return;
    }

    startedRef.current = true;
    setNeedsGesture(false);
    setStatus(kind === "auto" ? "入场声音播放中" : "已开启入场声音");

    const playLoop = () => {
      const baseTime = context.currentTime + 0.02;

      introMusicNotes.forEach((note, index) => {
        playIntroTone(context, masterGain, note, baseTime + index * 0.36, 1.15, 0.032);
      });
      playIntroTone(context, masterGain, introBass, baseTime, 1.8, 0.018);
    };

    playLoop();
    intervalRef.current = window.setInterval(playLoop, 2400);
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const introText = getIntroText(pathname);
    let speechPlayed = false;

    if (premiumIntroEnabled) {
      try {
        const audioBlob = await fetchPremiumSpeechAudio(introText, "child", controller.signal);

        if (!controller.signal.aborted) {
          const nextUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(nextUrl);

          audio.volume = 0.92;
          audioUrlRef.current = nextUrl;
          audioRef.current = audio;
          await audio.play();
          speechPlayed = true;
        }
      } catch {
        speechPlayed = speakIntroWithBrowser(introText);
      }
    } else {
      speechPlayed = speakIntroWithBrowser(introText);
    }

    if (!speechPlayed) {
      setStatus("语音介绍没有播放，背景音乐已开启。");
    }

    fadeTimerRef.current = window.setTimeout(() => {
      setStatus("入场声音已播放");
      cleanupIntroSpeech();
      stopIntroMusic();
    }, 12000);
  }

  const startIntroFromEffect = useEffectEvent((kind: "auto" | "gesture") => {
    void startIntro(kind);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startIntroFromEffect("auto");
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
    // The browser may block autoplay; the visible button remains as the fallback.
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }
      cleanupIntroSpeech();
      stopIntroMusic();
    };
  }, []);

  if (!needsGesture) {
    return null;
  }

  return (
    <button
      onClick={() => void startIntro("gesture")}
      className="fixed right-4 bottom-24 z-[60] rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(35,88,95,0.26)] transition hover:-translate-y-0.5 md:bottom-6"
    >
      {status}
    </button>
  );
}
