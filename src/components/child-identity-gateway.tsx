"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { findChildIdentitySuggestions, formatChildLabel } from "@/lib/child-identity";
import { getAccountSyncDeviceInfo } from "@/lib/account-sync-client";
import { gameContentConfigStorageKey } from "@/lib/game-content-config";
import {
  childRosterStorageKey,
  growthArchiveStorageKey,
  parseChildRoster,
  selectedChildStorageKey,
  type ChildProfile,
} from "@/lib/growth-archive";
import { themes, type ThemeId } from "@/lib/site-data";
import { habitTemplatesStorageKey, teacherPictureBooksStorageKey } from "@/lib/teacher-published-content";
import { dailyMenuOverrideStorageKey, weeklyMenuStorageKey } from "@/lib/weekly-menu";

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
  const [identityInput, setIdentityInput] = useState("");
  const [status, setStatus] = useState("先找到自己的小名牌，再去玩今天的成长任务。");
  const [isListening, setIsListening] = useState(false);
  const [syncAccount, setSyncAccount] = useState("");
  const [syncPasscode, setSyncPasscode] = useState("");
  const [isSyncingAccount, setIsSyncingAccount] = useState(false);
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
            ? "可以说出或输入自己的名字、号数，我来帮你找小名牌。"
            : "请老师先在教师端添加幼儿姓名和号数。",
      );
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [initialChildId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!selectedChild) {
      window.localStorage.removeItem(selectedChildStorageKey);
      return;
    }

    window.localStorage.setItem(selectedChildStorageKey, selectedChild.id);
  }, [selectedChild]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleRosterStorage(event: StorageEvent) {
      if (event.key !== childRosterStorageKey) {
        return;
      }

      const nextRoster = parseChildRoster(event.newValue);
      setChildRoster(nextRoster);
      setSelectedChildId((current) =>
        current && nextRoster.some((child) => child.id === current) ? current : "",
      );
      setVoiceSuggestions([]);
      setStatus(
        nextRoster.length > 0
          ? "老师更新了花名册，可以输入或说出自己的名字、号数来找小名牌。"
          : "请老师先在教师端添加幼儿姓名和号数。",
      );
    }

    window.addEventListener("storage", handleRosterStorage);

    return () => window.removeEventListener("storage", handleRosterStorage);
  }, []);

  function chooseChild(child: ChildProfile) {
    setSelectedChildId(child.id);
    setVoiceSuggestions([]);
    setStatus(`${formatChildLabel(child)} 的小名牌拿好啦，可以选择今天想去哪里玩。`);
  }

  function applyIdentityTranscript(transcript: string) {
    setIdentityInput(transcript);

    if (childRoster.length === 0) {
      setVoiceSuggestions([]);
      setStatus("请老师先在教师端添加幼儿姓名和号数。");
      return;
    }

    const suggestions = findChildIdentitySuggestions(transcript, childRoster);
    setVoiceSuggestions(suggestions);

    if (suggestions.length === 0) {
      setStatus(`我识别到“${transcript}”，还没找到小名牌。可以改一下输入框，或再说一次名字/号数。`);
      return;
    }

    if (suggestions.length === 1) {
      chooseChild(suggestions[0]);
      setStatus(`我识别到“${transcript}”，找到 ${formatChildLabel(suggestions[0])} 的小名牌啦。`);
      return;
    }

    setStatus(`我识别到“${transcript}”，找到几个像的小名牌，请点自己的名字，或继续修改输入框。`);
  }

  function applyTypedIdentity() {
    const value = identityInput.trim();

    if (!value) {
      setStatus("可以输入名字或号数，也可以点“点我说名字或号数”。");
      return;
    }

    applyIdentityTranscript(value);
  }

  function applyAccountSyncPayload(payload: Record<string, unknown>) {
    if (typeof window === "undefined") {
      return;
    }

    const stringKeys: Array<[keyof typeof payload, string]> = [
      ["growthArchive", growthArchiveStorageKey],
      ["weeklyMenuEntries", weeklyMenuStorageKey],
      ["dailyMenuOverrides", dailyMenuOverrideStorageKey],
      ["teacherPictureBooks", teacherPictureBooksStorageKey],
      ["habitTemplates", habitTemplatesStorageKey],
      ["gameContentConfigs", gameContentConfigStorageKey],
    ];

    for (const [payloadKey, storageKey] of stringKeys) {
      const value = payload[payloadKey];

      if (typeof value === "string" && value.trim()) {
        window.localStorage.setItem(storageKey, value);
      }
    }

    if (typeof payload.childRoster === "string") {
      const nextRoster = parseChildRoster(payload.childRoster);

      window.localStorage.setItem(childRosterStorageKey, payload.childRoster);
      setChildRoster(nextRoster);
      setSelectedChildId((current) =>
        current && nextRoster.some((child) => child.id === current) ? current : "",
      );
      setVoiceSuggestions([]);
    }
  }

  async function pullChildAccountSync() {
    const account = syncAccount.trim();
    const passcode = syncPasscode.trim();

    if (!account || !passcode) {
      setStatus("请输入班级账号和口令，再带回小名牌和小脚印。");
      return;
    }

    setIsSyncingAccount(true);
    setStatus("正在带回班级小名牌，小脚印会跟着同一个名字走。");

    try {
      const response = await fetch("/api/account-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "pull",
          account,
          passcode,
          role: "child",
          ...getAccountSyncDeviceInfo(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        updatedAt?: string;
        payload?: Record<string, unknown>;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "账号同步暂时不可用。");
      }

      applyAccountSyncPayload(data.payload ?? {});
      setStatus(`小名牌同步好啦：${data.updatedAt ?? "刚刚"}。换设备也能接着玩。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "账号同步失败，可以稍后再试。");
    } finally {
      setIsSyncingAccount(false);
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
    const SpeechRecognitionApi = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      setStatus("这个浏览器暂时不能听声音，可以在下面输入名字或号数。");
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
    setStatus("我在听啦，可以说：我是小何 / 3号。");
  }

  function buildAdventureHref(themeId: ThemeId) {
    return selectedChild
      ? `/adventure?theme=${themeId}&child=${encodeURIComponent(selectedChild.id)}`
      : `/adventure?theme=${themeId}`;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <section className="flex min-h-screen min-w-0 flex-col gap-6">
        <div
          id="child-nameplate"
          className="scroll-mt-24 rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-teal-700">开始玩之前</p>
              <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
                找到我的小名牌
                <span className="block text-2xl text-slate-700 md:text-3xl">再去玩今天的小任务</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                点一下自己的名字，或者说出名字和号数。拿到小名牌后，今天玩的游戏会记在自己的成长小本本里。
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/84 p-5 shadow-sm">
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
                  className={`rounded-[1.4rem] px-6 py-4 text-base font-semibold shadow-lg transition hover:-translate-y-0.5 md:text-lg ${
                    isListening ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-900"
                  }`}
                  type="button"
                >
                  {isListening ? "正在听，点我停止" : "🎙 点我说名字或号数"}
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold text-teal-700">可以说：我是小何 / 3号</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                语音识别到的内容会自动填进输入框，也可以直接手动输入姓名、号数或“3号 小何”。
              </p>

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

              <div className="mt-5">
                {childRoster.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      value={identityInput}
                      onChange={(event) => setIdentityInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          applyTypedIdentity();
                        }
                      }}
                      placeholder="输入名字或号数，如 小何 / 3号"
                      className="rounded-[1.2rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                    />
                    <button
                      onClick={applyTypedIdentity}
                      className="rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                      type="button"
                    >
                      找小名牌
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[1.2rem] bg-cyan-50 px-4 py-3">
                    <p className="text-sm font-semibold text-cyan-900">
                      请老师先在教师端添加幼儿姓名和号数。
                    </p>
                    <Link
                      href="/teachers"
                      className="mt-3 inline-flex rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                    >
                      去教师端添加
                    </Link>
                  </div>
                )}
              </div>

              {selectedChild ? (
                <div className="mt-4 inline-flex rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white">
                  {formatChildLabel(selectedChild)}
                </div>
              ) : null}

              <details className="mt-5 rounded-[1.4rem] bg-white/86 px-4 py-3 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  换设备同步小名牌
                </summary>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  输入老师给的班级账号和口令，可带回小名牌、小脚印、食谱和老师放好的内容。
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={syncAccount}
                    onChange={(event) => setSyncAccount(event.target.value.slice(0, 40))}
                    placeholder="班级账号"
                    className="rounded-[1rem] border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-400"
                  />
                  <input
                    value={syncPasscode}
                    onChange={(event) => setSyncPasscode(event.target.value.slice(0, 80))}
                    placeholder="同步口令"
                    type="password"
                    className="rounded-[1rem] border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-400"
                  />
                  <button
                    onClick={() => void pullChildAccountSync()}
                    disabled={isSyncingAccount}
                    className="rounded-full bg-orange-300 px-4 py-2 text-sm font-semibold text-orange-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                  >
                    {isSyncingAccount ? "同步中" : "同步"}
                  </button>
                </div>
                <p className="mt-2 text-xs font-semibold text-teal-700">
                  同一个小名牌不绑死一台设备，换浏览器也能继续看到自己的任务和贴纸。
                </p>
              </details>

              <div className="mt-5 rounded-[1.4rem] border border-dashed border-teal-200 bg-teal-50/70 px-4 py-3">
                <p className="text-xs font-semibold text-teal-800">小脚印提示</p>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  选好小名牌后，游戏打卡的小脚印会记到自己的名字下面。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <section
            id="child-themes"
            className="scroll-mt-24 rounded-[2rem] bg-white/90 p-6 shadow-[0_20px_60px_rgba(35,88,95,0.1)] md:p-8"
          >
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
                    onClick={() => {
                      if (!selectedChild) {
                        setStatus("可以先试玩主题游戏；拿到小名牌后，小脚印会留在自己的名字下面。");
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
                      <span className="rounded-full bg-orange-300 px-4 py-2 text-sm font-semibold text-orange-950">
                        进入{theme.label}
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
