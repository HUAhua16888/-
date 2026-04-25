"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const introMusicNotes = [392, 523.25, 659.25];
const introBass = 196;

function getIntroText(pathname: string) {
  if (pathname.startsWith("/teachers")) {
    return "欢迎来到老师辅助页。这里可以生成晨间接待、餐前提醒、情绪安抚和家长同步话术。";
  }

  if (pathname.startsWith("/adventure")) {
    return "欢迎来到儿童互动故事。今天我们一起完成好习惯任务，听故事，玩小游戏，点亮成长勋章。";
  }

  return "欢迎来到童趣成长乐园。先选今日主题，完成一个小任务，再进入儿童互动故事。";
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

function speakIntro(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.92;
  utterance.pitch = 1.03;
  utterance.volume = 0.86;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  return true;
}

export function SiteSoundIntro() {
  const pathname = usePathname();
  const [needsGesture, setNeedsGesture] = useState(false);
  const [status, setStatus] = useState("声音准备中");
  const startedRef = useRef(false);
  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

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
      setStatus("当前浏览器不支持网页声音");
      setNeedsGesture(false);
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
      setStatus("点一下开启声音");
      setNeedsGesture(true);
      return;
    }

    if (context.state !== "running") {
      startedRef.current = false;
      setStatus("点一下开启声音");
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
    speakIntro(getIntroText(pathname));
    fadeTimerRef.current = window.setTimeout(() => {
      setStatus("入场声音已播放");
      stopIntroMusic();
    }, 12000);
  }

  useEffect(() => {
    const autoTimer = window.setTimeout(() => {
      void startIntro("auto");
    }, 300);

    const startFromGesture = () => {
      void startIntro("gesture");
    };

    window.addEventListener("pointerdown", startFromGesture, { once: true });
    window.addEventListener("keydown", startFromGesture, { once: true });

    return () => {
      window.clearTimeout(autoTimer);
      window.removeEventListener("pointerdown", startFromGesture);
      window.removeEventListener("keydown", startFromGesture);
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }
      stopIntroMusic();
    };
    // The intro is intentionally one-shot per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
