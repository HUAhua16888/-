"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MusicScene = "home" | "habit" | "food" | "teacher";

type AmbientMusicToggleProps = {
  scene: MusicScene;
  className?: string;
};

const musicStorageKey = "tongqu-growth-web-ambient-music";

const sceneConfig: Record<
  MusicScene,
  {
    label: string;
    description: string;
    notes: number[];
    bass: number;
  }
> = {
  home: {
    label: "星光轻音乐",
    description: "适合首页展示的明亮氛围音乐",
    notes: [523.25, 659.25, 783.99],
    bass: 261.63,
  },
  habit: {
    label: "习惯节奏",
    description: "适合洗手、排队、整理主题的轻快背景音",
    notes: [392, 523.25, 659.25],
    bass: 196,
  },
  food: {
    label: "海风食育乐",
    description: "适合闽食成长岛的柔和海洋风背景音",
    notes: [349.23, 440, 523.25],
    bass: 174.61,
  },
  teacher: {
    label: "备课安静音",
    description: "适合老师生成内容时的轻柔伴奏",
    notes: [293.66, 392, 493.88],
    bass: 146.83,
  },
};

function playTone(
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

export function AmbientMusicToggle({ scene, className = "" }: AmbientMusicToggleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState("点击开启背景音乐");
  const contextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const config = useMemo(() => sceneConfig[scene], [scene]);

  useEffect(() => {
    return () => {
      activeRef.current = false;

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }

      masterGainRef.current?.disconnect();
      contextRef.current?.close().catch(() => undefined);
    };
  }, []);

  async function startMusic() {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextApi = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextApi) {
      setStatus("当前浏览器不支持网页背景音乐");
      return;
    }

    if (!contextRef.current) {
      const context = new AudioContextApi();
      const masterGain = context.createGain();
      masterGain.gain.value = 0.05;
      masterGain.connect(context.destination);

      contextRef.current = context;
      masterGainRef.current = masterGain;
    }

    const context = contextRef.current;
    const masterGain = masterGainRef.current;

    if (!context || !masterGain) {
      setStatus("音乐初始化失败了");
      return;
    }

    await context.resume();
    activeRef.current = true;

    const playLoop = () => {
      if (!activeRef.current) {
        return;
      }

      const baseTime = context.currentTime + 0.02;

      config.notes.forEach((note, index) => {
        playTone(context, masterGain, note, baseTime + index * 0.36, 1.1, 0.035);
      });

      playTone(context, masterGain, config.bass, baseTime, 1.8, 0.02);
    };

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    playLoop();
    intervalRef.current = window.setInterval(playLoop, 2400);
    window.localStorage.setItem(musicStorageKey, "on");
    setIsPlaying(true);
    setStatus(`${config.label}播放中`);
  }

  function stopMusic() {
    activeRef.current = false;

    if (typeof window !== "undefined" && intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = null;
    window.localStorage.setItem(musicStorageKey, "off");
    setIsPlaying(false);
    setStatus("背景音乐已暂停");
  }

  return (
    <div className={`rounded-[1.6rem] bg-white/80 p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">背景音乐</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{config.label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{config.description}</p>
        </div>
        <button
          onClick={() => void (isPlaying ? stopMusic() : startMusic())}
          className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
            isPlaying ? "bg-rose-100 text-rose-800" : "bg-slate-900 text-white"
          }`}
        >
          {isPlaying ? "关闭音乐" : "开启音乐"}
        </button>
      </div>

      <p className="mt-3 text-sm font-semibold text-teal-700">{status}</p>
    </div>
  );
}
