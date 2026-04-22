"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import {
  kindPhrases,
  queueOrder,
  storyMissionMap,
  themes,
  washSteps,
  type ThemeId,
} from "@/lib/site-data";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StoryApiResponse = {
  reply: string;
  choices: string[];
  badge: string;
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const initialWashOrder = ["抹上泡泡", "擦干小手", "打湿小手", "冲洗干净", "搓搓手心手背"];
const initialQueueOrder = ["第三位小朋友", "小队长举牌", "第二位小朋友", "第一位小朋友"];
const storyStateStorageKey = "tongqu-growth-web-story-state";

function ShuffleStepsGame() {
  const [shuffled, setShuffled] = useState(initialWashOrder);
  const [selected, setSelected] = useState<string[]>([]);
  const completed = selected.length === washSteps.length;

  function handlePick(step: string) {
    if (selected.includes(step) || completed) {
      return;
    }

    setSelected((current) => [...current, step]);
  }

  function resetGame() {
    setShuffled(initialWashOrder);
    setSelected([]);
  }

  const isCorrect = completed && selected.every((step, index) => step === washSteps[index]);

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-700">小游戏 1</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">洗手步骤排序</h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-200"
        >
          重新开始
        </button>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        按你心里的顺序点一遍，看看能不能拿到洗手闪亮章。
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {shuffled.map((step) => (
          <button
            key={step}
            onClick={() => handlePick(step)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selected.includes(step)
                ? "bg-slate-200 text-slate-400"
                : "bg-amber-100 text-amber-900 hover:-translate-y-0.5 hover:bg-amber-200"
            }`}
          >
            {step}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">你的顺序</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.length === 0 ? (
            <span className="text-sm text-slate-400">还没开始，点上面的步骤按钮。</span>
          ) : (
            selected.map((step, index) => (
              <span
                key={`${step}-${index}`}
                className="rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
              >
                {index + 1}. {step}
              </span>
            ))
          )}
        </div>
      </div>

      {completed ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
          }`}
        >
          {isCorrect ? "答对啦，你拿到了洗手闪亮章。" : "这次差一点点，重新试试会更棒。"}
        </p>
      ) : null}
    </div>
  );
}

function QueueGame() {
  const [currentOrder, setCurrentOrder] = useState(initialQueueOrder);
  const correct = currentOrder.every((item, index) => item === queueOrder[index]);

  function moveLeft(index: number) {
    if (index === 0) {
      return;
    }

    setCurrentOrder((items) => {
      const next = [...items];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <p className="text-sm font-semibold text-cyan-700">小游戏 2</p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">排队不拥挤</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        点击“往前站一点”，帮小朋友从前到后排好队。
      </p>

      <div className="mt-5 space-y-3">
        {currentOrder.map((item, index) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-[1.5rem] bg-sky-50 px-4 py-3"
          >
            <span className="font-semibold text-slate-800">
              {index + 1}. {item}
            </span>
            <button
              onClick={() => moveLeft(index)}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:-translate-y-0.5"
            >
              往前站一点
            </button>
          </div>
        ))}
      </div>

      {correct ? (
        <p className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
          排得真整齐，你已经是排队小队长啦。
        </p>
      ) : null}
    </div>
  );
}

function KindWordsGame() {
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);

  function handlePick(index: number, positive: boolean) {
    if (picked.includes(index)) {
      return;
    }

    setPicked((current) => [...current, index]);
    if (positive) {
      setScore((current) => current + 1);
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <p className="text-sm font-semibold text-rose-700">小游戏 3</p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">勇敢尝一口</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        选出你觉得最温柔、最会鼓励人的话。
      </p>

      <div className="mt-5 grid gap-3">
        {kindPhrases.map((phrase, index) => {
          const chosen = picked.includes(index);

          return (
            <button
              key={phrase.text}
              onClick={() => handlePick(index, phrase.isPositive)}
              className={`rounded-[1.5rem] px-4 py-4 text-left text-sm font-semibold transition ${
                chosen
                  ? phrase.isPositive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-700"
                  : "bg-orange-50 text-slate-700 hover:-translate-y-0.5 hover:bg-orange-100"
              }`}
            >
              {phrase.text}
            </button>
          );
        })}
      </div>

      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        当前友好分：{score} / 2
      </p>
    </div>
  );
}

export function StoryExperience() {
  const imageFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === "true";
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: themes.habit.starter,
    },
  ]);
  const [quickChoices, setQuickChoices] = useState(themes.habit.choices);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isPainting, setIsPainting] = useState(false);
  const [status, setStatus] = useState("准备出发啦。");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const activeTheme = themes[themeId];
  const activeMissions = storyMissionMap[themeId];
  const lastAssistantMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant")?.content ?? "",
    [messages],
  );

  const speakReply = useEffectEvent((text: string) => {
    if (!autoSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });

  useEffect(() => {
    if (lastAssistantMessage) {
      speakReply(lastAssistantMessage);
    }
  }, [lastAssistantMessage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedState = window.localStorage.getItem(storyStateStorageKey);

    if (!savedState) {
      return;
    }

    try {
      const parsed = JSON.parse(savedState) as {
        themeId?: ThemeId;
        messages?: ChatMessage[];
        quickChoices?: string[];
        imageUrl?: string;
        status?: string;
        badges?: string[];
      };

      const restoreHandle = window.setTimeout(() => {
        if (parsed.themeId && themes[parsed.themeId]) {
          setThemeId(parsed.themeId);
        }

        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }

        if (Array.isArray(parsed.quickChoices) && parsed.quickChoices.length > 0) {
          setQuickChoices(parsed.quickChoices);
        }

        if (typeof parsed.imageUrl === "string") {
          setImageUrl(parsed.imageUrl);
        }

        if (typeof parsed.status === "string" && parsed.status.trim()) {
          setStatus(parsed.status);
        }

        if (Array.isArray(parsed.badges)) {
          setBadges(parsed.badges);
        }
      }, 0);

      return () => window.clearTimeout(restoreHandle);
    } catch {
      window.localStorage.removeItem(storyStateStorageKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      themeId,
      messages,
      quickChoices,
      imageUrl,
      status,
      badges,
    };

    window.localStorage.setItem(storyStateStorageKey, JSON.stringify(payload));
  }, [badges, imageUrl, messages, quickChoices, status, themeId]);

  function switchTheme(nextTheme: ThemeId) {
    setThemeId(nextTheme);
    setMessages([
      {
        role: "assistant",
        content: themes[nextTheme].starter,
      },
    ]);
    setQuickChoices(themes[nextTheme].choices);
    setImageUrl("");
    setStatus(`${themes[nextTheme].label}准备好了。`);
  }

  function resetStoryProgress() {
    setThemeId("habit");
    setMessages([
      {
        role: "assistant",
        content: themes.habit.starter,
      },
    ]);
    setQuickChoices(themes.habit.choices);
    setInput("");
    setImageUrl("");
    setStatus("准备出发啦。");
    setBadges([]);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storyStateStorageKey);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  async function sendMessage(messageText: string) {
    const cleanText = messageText.trim();

    if (!cleanText || isLoading) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: cleanText }]);
    setInput("");
    setIsLoading(true);
    setStatus("AI 小伙伴正在编故事...");

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "child",
          theme: themeId,
          userInput: cleanText,
          messages,
        }),
      });

      const data = (await response.json()) as StoryApiResponse;

      startTransition(() => {
        setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
        setQuickChoices(
          Array.isArray(data.choices) && data.choices.length > 0 ? data.choices : activeTheme.choices,
        );
        setBadges((current) => {
          if (!data.badge || current.includes(data.badge)) {
            return current;
          }

          return [...current, data.badge];
        });
      });

      setStatus(data.error ? `模型回复成功，但有提醒：${data.error}` : "新的故事节点已经解锁。");
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "我刚刚被海风吹乱了故事书，我们再试一次，好吗？",
        },
      ]);
      setStatus("刚才连接有点不稳，可以再点一次。");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateImage() {
    if (isPainting) {
      return;
    }

    setIsPainting(true);
    setStatus("正在画本章插图...");

    try {
      const prompt = `${activeTheme.imagePrompt} 当前剧情：${lastAssistantMessage || activeTheme.starter}`;
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      const data = (await response.json()) as { imageUrl?: string; error?: string };

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "图片生成失败");
      }

      setImageUrl(data.imageUrl);
      setStatus("绘本插图生成好了。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "图片暂时画不出来，稍后再试。");
    } finally {
      setIsPainting(false);
    }
  }

  function toggleVoiceInput() {
    if (typeof window === "undefined") {
      return;
    }

    const voiceWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    const SpeechRecognitionApi =
      voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setStatus("当前浏览器不支持语音输入，建议用 Chrome 或 Edge。");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        setInput(transcript);
        setStatus("已经帮你听写好了，可以直接发送。");
      }
    };

    recognition.onerror = () => {
      setStatus("刚才没有听清楚，你可以再说一次。");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatus("正在听你说话...");
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#fff6d6_0%,#ffffff_48%,#dff8f7_100%)] p-8 shadow-[0_28px_90px_rgba(49,93,104,0.18)]">
          <div className="flex flex-wrap items-center gap-3">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => switchTheme(theme.id)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  theme.id === themeId
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-white/80 text-slate-700 hover:-translate-y-0.5"
                }`}
              >
                {theme.emoji} {theme.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
                成长探险岛
              </p>
              <h1 className="mt-4 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
                {activeTheme.label}
                <span className="mt-2 block text-2xl text-slate-700 md:text-3xl">
                  {activeTheme.headline}
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                {activeTheme.subtitle} 这一版已经支持 AI 对话、浏览器语音输入、语音播报和 3 个轻量小游戏。
                {imageFeatureEnabled ? " 图片生成功能已开启。" : " 为了保证对外稳定体验，图片生成功能当前先关闭。"}
              </p>
            </div>

            <div className="w-full max-w-xs rounded-[2rem] bg-white/85 p-5 shadow-[0_16px_50px_rgba(43,104,98,0.12)]">
              <p className="text-sm font-semibold text-slate-500">今日成长状态</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{status}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {badges.length === 0 ? (
                  <span className="rounded-full bg-amber-100 px-3 py-2 text-sm text-amber-800">
                    第一枚勋章还在路上
                  </span>
                ) : (
                  badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
                    >
                      {badge}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {imageFeatureEnabled ? (
                  <button
                    onClick={generateImage}
                    className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    {isPainting ? "插图生成中..." : "生成本章插图"}
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                    稳定版暂不出图
                  </span>
                )}
                <button
                  onClick={() => setAutoSpeak((current) => !current)}
                  className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
                >
                  {autoSpeak ? "关闭播报" : "开启播报"}
                </button>
                <button
                  onClick={resetStoryProgress}
                  className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
                >
                  重新开始本轮
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-700">绘本插图区</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">故事画面</h2>
            </div>
            <Link
              href="/teachers"
              className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:-translate-y-0.5"
            >
              老师辅助页
            </Link>
          </div>
          <div className="mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#e6fbfa_0%,#fff7dc_100%)] p-4">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="AI 生成的故事插图"
                className="h-[320px] w-full rounded-[1.5rem] object-cover"
              />
            ) : (
              <div className="flex h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-teal-200 bg-white/70 text-center">
                {imageFeatureEnabled ? (
                  <>
                    <p className="text-lg font-semibold text-slate-700">点击“生成本章插图”</p>
                    <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                      我会使用火山方舟文生图接口，给当前故事章节画一张绘本风插图。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-slate-700">当前为对外稳定版</p>
                    <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                      为了避免图片接口波动影响孩子体验，公开版本先关闭 AI 出图，保留聊天、语音和小游戏主流程。
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">AI 对话故事</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">聊天冒险台</h2>
            </div>
            <button
              onClick={toggleVoiceInput}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                isListening
                  ? "bg-rose-500 text-white"
                  : "bg-amber-100 text-amber-900 hover:-translate-y-0.5"
              }`}
            >
              {isListening ? "停止听写" : "按我开始语音"}
            </button>
          </div>

          <div className="mt-5 max-h-[420px] space-y-4 overflow-y-auto pr-2">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-[2rem] px-5 py-4 text-sm leading-7 shadow-sm md:text-base ${
                    message.role === "assistant"
                      ? "bg-teal-50 text-slate-800"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading ? (
              <div className="flex justify-start">
                <div className="rounded-[2rem] bg-teal-50 px-5 py-4 text-sm text-slate-500">
                  AI 小伙伴正在想下一段故事...
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {quickChoices.map((choice) => (
              <button
                key={choice}
                onClick={() => void sendMessage(choice)}
                className="rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-200"
              >
                {choice}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void sendMessage(input);
                }
              }}
              placeholder="可以输入：我想听海蛎小勇士的故事"
              className="h-14 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <button
              onClick={() => void sendMessage(input)}
              className="h-14 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
            >
              发送故事请求
            </button>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#fff7dc_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-rose-700">玩法说明</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">怎么和网站互动</h2>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
            <li>1. 先选一个故事主题线，再发一句话给 AI。</li>
            <li>2. 可以直接点快捷选项，也可以自己输入内容。</li>
            <li>3. 想让孩子开口说话时，点击语音按钮开始听写。</li>
            <li>
              4. {imageFeatureEnabled ? "到一个新章节后，点击右上角按钮生成绘本插图。" : "当前公开稳定版先关闭 AI 出图，避免接口波动影响使用。"}
            </li>
            <li>5. 底部还有 3 个小游戏，可以一起配合课堂或家里练习。</li>
          </ul>

          <div className="mt-6 rounded-[1.8rem] bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-500">本轮成长任务</p>
            <div className="mt-3 space-y-2">
              {activeMissions.map((mission) => (
                <div
                  key={mission}
                  className="rounded-[1.2rem] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  {mission}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ShuffleStepsGame />
        <QueueGame />
        <KindWordsGame />
      </section>
    </div>
  );
}
