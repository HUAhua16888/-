"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { findChildIdentitySuggestions, formatChildLabel } from "@/lib/child-identity";
import {
  childRosterStorageKey,
  parseChildRoster,
  selectedChildStorageKey,
  type ChildProfile,
} from "@/lib/growth-archive";
import { themes, type ThemeId } from "@/lib/site-data";

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

type ChildIdentityGatewayProps = {
  initialChildId?: string;
  initialTheme?: ThemeId;
};

export function ChildIdentityGateway({
  initialChildId,
  initialTheme = "habit",
}: ChildIdentityGatewayProps) {
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(initialChildId ?? "");
  const [voiceSuggestions, setVoiceSuggestions] = useState<ChildProfile[]>([]);
  const [status, setStatus] = useState("先找到自己的小名牌，再去玩今天的成长任务。");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const selectedChild = useMemo(
    () => childRoster.find((child) => child.id === selectedChildId) ?? null,
    [childRoster, selectedChildId],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const restoreHandle = window.setTimeout(() => {
      const roster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));
      const matchedInitial = roster.find((child) => child.id === initialChildId);
      const nextChild = matchedInitial ?? null;

      setChildRoster(roster);
      setSelectedChildId(nextChild?.id ?? "");
      setStatus(
        nextChild
          ? `${formatChildLabel(nextChild)} 的小名牌拿好啦，可以选择今天想去哪里玩。`
          : roster.length > 0
            ? "点一点自己的名字，也可以按按钮说出名字或号数。"
            : "还没有看到小朋友名单，请老师先放进花名册。",
      );
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [initialChildId]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedChild) {
      return;
    }

    window.localStorage.setItem(selectedChildStorageKey, selectedChild.id);
  }, [selectedChild]);

  function chooseChild(child: ChildProfile) {
    setSelectedChildId(child.id);
    setVoiceSuggestions([]);
    setStatus(`${formatChildLabel(child)} 的小名牌拿好啦，可以选择今天想去哪里玩。`);
  }

  function applyIdentityTranscript(transcript: string) {
    if (childRoster.length === 0) {
      setVoiceSuggestions([]);
      setStatus("还没有看到小朋友名单，请老师先放进花名册。");
      return;
    }

    const suggestions = findChildIdentitySuggestions(transcript, childRoster);
    setVoiceSuggestions(suggestions);

    if (suggestions.length === 0) {
      setStatus(`我听到“${transcript}”，还没找到小名牌。可以再说一次名字或号数。`);
      return;
    }

    if (suggestions.length === 1) {
      chooseChild(suggestions[0]);
      setStatus(`我听到“${transcript}”，找到 ${formatChildLabel(suggestions[0])} 的小名牌啦。`);
      return;
    }

    setStatus(`我听到“${transcript}”，找到几个像的小名牌，请点自己的名字。`);
  }

  function toggleVoiceInput() {
    if (typeof window === "undefined") {
      return;
    }

    const voiceWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognitionApi = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setStatus("当前浏览器不支持语音输入，建议用 Chrome 或 Edge 打开。");
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
        applyIdentityTranscript(transcript);
      }
    };
    recognition.onerror = () => {
      setStatus("刚才没有听清楚，可以再说一次名字或号数。");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatus("我在听啦，可以说“我是泡泡”或“1号”。");
  }

  function buildAdventureHref(themeId: ThemeId) {
    return selectedChild
      ? `/adventure?theme=${themeId}&child=${encodeURIComponent(selectedChild.id)}`
      : `/adventure?theme=${themeId}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="flex min-h-[calc(100vh-128px)] flex-col gap-6">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_28px_90px_rgba(49,93,104,0.16)] md:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-teal-700">游戏打卡前</p>
              <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
                找到我的小名牌
                <span className="block text-2xl text-slate-700 md:text-3xl">再去玩成长任务</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                点一下自己的名字，或者说出名字和号数。拿到小名牌后，今天玩的游戏会记在自己的成长小本本里。
              </p>
            </div>

            <div className="rounded-[2rem] bg-white/84 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">我的小名牌</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                    {selectedChild ? formatChildLabel(selectedChild) : "还没拿到"}
                  </h2>
                  <p className="mt-2 text-sm leading-7 font-semibold text-teal-700">{status}</p>
                </div>
                <button
                  onClick={toggleVoiceInput}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    isListening ? "bg-rose-100 text-rose-800" : "bg-slate-900 text-white"
                  }`}
                >
                  {isListening ? "我说完了" : "我来说"}
                </button>
              </div>

              {voiceSuggestions.length > 0 ? (
                <div className="mt-5 rounded-[1.5rem] bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">找到这些小名牌</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {voiceSuggestions.map((child) => (
                      <Link
                        key={child.id}
                        href={`/children/${encodeURIComponent(child.id)}`}
                        onClick={() => chooseChild(child)}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:-translate-y-0.5"
                      >
                        {formatChildLabel(child)}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {childRoster.length > 0 ? (
                  childRoster.map((child) => (
                    <Link
                      key={child.id}
                      href={`/children/${encodeURIComponent(child.id)}`}
                      onClick={() => chooseChild(child)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                        selectedChild?.id === child.id
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {formatChildLabel(child)}
                    </Link>
                  ))
                ) : (
                  <Link
                    href="/teachers"
                    className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                  >
                    请老师先放入小朋友名单
                  </Link>
                )}
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-dashed border-teal-200 bg-teal-50/70 px-4 py-3">
                <p className="text-xs font-semibold text-teal-800">小记录提示</p>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  选好小名牌后，游戏打卡的小脚印会记到自己的名字下面。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)] md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan-700">今天想去哪玩</p>
                <h2 className="mt-1 text-3xl font-semibold text-slate-900">
                  {selectedChild ? `${selectedChild.name} 可以选择` : "先拿小名牌"}
                </h2>
              </div>
              {selectedChild ? (
                <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
                  小名牌准备好
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {Object.values(themes).map((theme) => {
                const activeFromQuery = theme.id === initialTheme;

                return (
                  <Link
                    key={theme.id}
                    href={buildAdventureHref(theme.id)}
                    onClick={(event) => {
                      if (!selectedChild) {
                        event.preventDefault();
                        setStatus("先拿到自己的小名牌，再进入主题游戏。");
                        return;
                      }

                      window.localStorage.setItem(selectedChildStorageKey, selectedChild.id);
                    }}
                    className={`rounded-[2rem] p-5 shadow-sm transition hover:-translate-y-0.5 ${
                      selectedChild
                        ? "bg-[linear-gradient(180deg,#f8fffe_0%,#ffffff_100%)]"
                        : "cursor-not-allowed bg-slate-50 opacity-70"
                    } ${activeFromQuery ? "ring-2 ring-teal-200" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-4xl">{theme.emoji}</p>
                        <h3 className="mt-4 text-2xl font-semibold text-slate-900">{theme.label}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{theme.headline}</p>
                      </div>
                      <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        进入
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {theme.choices.map((choice) => (
                        <span
                          key={choice}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          {choice}
                        </span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

        </div>
      </section>
    </main>
  );
}
