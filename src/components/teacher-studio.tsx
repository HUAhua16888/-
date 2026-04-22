"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import { teacherPitchCards, teacherTasks, themes, type ThemeId } from "@/lib/site-data";

type TeacherResponse = {
  title: string;
  content: string;
  tips: string[];
  error?: string;
};

export function TeacherStudio() {
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const premiumVoiceLabel = process.env.NEXT_PUBLIC_TTS_VOICE_LABEL ?? defaultPremiumVoiceLabel;
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [task, setTask] = useState(teacherTasks[0].label);
  const [scenario, setScenario] = useState(
    "今天午餐前，我想给 4-5 岁幼儿讲一个关于勇敢尝试新食物的小故事。",
  );
  const [result, setResult] = useState<TeacherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isPreviewSpeaking, setIsPreviewSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  function cleanupAudio() {
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

    setIsPreviewSpeaking(false);
  }

  useEffect(() => () => cleanupAudio(), []);

  async function generate() {
    if (!scenario.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "teacher",
          theme: themeId,
          userInput: scenario,
          teacherTask: task,
        }),
      });

      const data = (await response.json()) as TeacherResponse;
      setResult(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    const text = [result.title, result.content, ...(result.tips ?? [])].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("已复制，直接发到家长群或备课文档里就行。");
    } catch {
      setCopyStatus("这次没有复制成功，可以再试一次。");
    }
  }

  async function previewResultVoice() {
    const text = result?.content?.trim();

    if (!text) {
      return;
    }

    cleanupAudio();

    if (premiumTtsEnabled) {
      try {
        setVoiceStatus(`正在用 ${premiumVoiceLabel} 试播老师引导语...`);
        const blob = await fetchPremiumSpeechAudio(text, "teacher");
        const nextUrl = URL.createObjectURL(blob);
        const audio = new Audio(nextUrl);

        audioUrlRef.current = nextUrl;
        audioRef.current = audio;
        audio.onended = cleanupAudio;
        audio.onerror = cleanupAudio;
        setIsPreviewSpeaking(true);
        await audio.play();
        return;
      } catch (error) {
        setVoiceStatus(
          error instanceof Error && error.message
            ? error.message
            : "高质量播报暂时没接通，当前先用浏览器播报。",
        );
      }
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceStatus("当前浏览器不支持播报，可以在儿童端继续演示。");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.03;
    utterance.onstart = () => setIsPreviewSpeaking(true);
    utterance.onend = () => setIsPreviewSpeaking(false);
    utterance.onerror = () => setIsPreviewSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setVoiceStatus("当前正在用浏览器播报老师引导语。");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-8 shadow-[0_28px_90px_rgba(49,93,104,0.18)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            老师 / 家长辅助台
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
            一键生成
            <span className="mt-2 block text-2xl text-slate-700 md:text-3xl">
              课堂引导、食育故事和家园共育内容
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            这里和儿童端分开，方便老师在备课、餐前提醒、家园沟通时直接拿内容去用。生成出来的文案会尽量短、温柔、适合现场口头表达。
            {premiumTtsEnabled ? ` 当前已经预留 ${premiumVoiceLabel} 播报入口，适合比赛时直接试播老师引导语。` : ""}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  theme.id === themeId
                    ? "bg-slate-900 text-white"
                    : "bg-white/85 text-slate-700 hover:-translate-y-0.5"
                }`}
              >
                {theme.emoji} {theme.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {teacherPitchCards.map((item) => (
              <div key={item.title} className="rounded-[1.6rem] bg-white/75 p-4">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 max-w-xl">
            <AmbientMusicToggle scene="teacher" />
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-700">快速入口</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">常用生成任务</h2>
            </div>
            <Link
              href="/adventure"
              className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:-translate-y-0.5"
            >
              去儿童互动页
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {teacherTasks.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTask(item.label);
                  setScenario(item.starter);
                }}
                className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                <p className="font-semibold text-slate-800">{item.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">{item.starter}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-[linear-gradient(135deg,#effcfc_0%,#ffffff_100%)] p-4">
            <p className="text-sm font-semibold text-slate-500">演示时可以这样讲</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              儿童端负责“让孩子愿意参与”，老师端负责“让老师和家长拿到可直接使用的内容”，两端一起组成完整教育闭环。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">内容生成面板</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">输入你的场景</h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {teacherTasks.map((item) => (
              <button
                key={item.id}
                onClick={() => setTask(item.label)}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                  task === item.label
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:-translate-y-0.5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="mt-5 min-h-48 w-full rounded-[2rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
          />

          <button
            onClick={() => void generate()}
            className="mt-5 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "正在生成..." : "开始生成"}
          </button>

          <p className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
            小建议：比赛展示时，先点一个“常用生成任务”，再展示生成结果和复制动作，评审会更容易看懂老师端价值。
          </p>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#e6fbfa_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-teal-700">生成结果</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {result?.title ?? "还没有生成内容"}
          </h2>

          <div className="mt-5 rounded-[2rem] bg-white/80 p-5">
            <p className="text-sm leading-8 text-slate-700">
              {result?.content ?? "点击左侧按钮后，这里会出现可以直接拿去课堂、家长群或餐前使用的内容。"}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void generate()}
              className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? "重新生成中..." : "换一版结果"}
            </button>
            <button
              onClick={() => void copyResult()}
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
            >
              复制结果
            </button>
            <button
              onClick={() => void previewResultVoice()}
              className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
            >
              {isPreviewSpeaking ? "正在试播..." : "试播结果"}
            </button>
          </div>

          {copyStatus ? (
            <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
              {copyStatus}
            </p>
          ) : null}

          {voiceStatus ? (
            <p className="mt-4 rounded-2xl bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900">
              {voiceStatus}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {(result?.tips ?? ["建议控制在 1 分钟内说完。", "优先用鼓励式表达。", "结尾加一句家园同步。"]).map((tip) => (
              <div key={tip} className="rounded-[1.5rem] bg-white/70 px-4 py-3 text-sm text-slate-700">
                {tip}
              </div>
            ))}
          </div>

          {result?.error ? (
            <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
              接口提醒：{result.error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
