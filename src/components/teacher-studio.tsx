"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  teacherPitchCards,
  teacherTasks,
  teacherWorkflowCards,
  themes,
  type ThemeId,
} from "@/lib/site-data";

type TeacherResponse = {
  title: string;
  content: string;
  tips: string[];
  error?: string;
};

type SavedTeacherResult = TeacherResponse & {
  id: string;
  themeId: ThemeId;
  task: string;
  scenario: string;
  savedAt: string;
  pinned?: boolean;
};

type TeacherHistoryFilter = "all" | "theme" | "task";

const teacherScenarioMaxLength = 360;
const teacherHistoryLimit = 6;

function sortTeacherHistory(history: SavedTeacherResult[]) {
  return [...history].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime();
  });
}

function limitTeacherHistory(history: SavedTeacherResult[]) {
  return sortTeacherHistory(history).slice(0, teacherHistoryLimit);
}

function buildMiniGameExtensionScenario(themeId: ThemeId) {
  return themeId === "food"
    ? "孩子刚在儿童端完成了均衡餐盘或闽食探索小游戏，请生成一段老师可延伸的餐前引导和家长同步话术。"
    : "孩子刚在儿童端完成了洗手、排队或礼貌表达小游戏，请生成一段老师可延伸的课堂提醒和家长同步话术。";
}

const internalNoteGroups = [
  {
    title: "使用顺序",
    items: [
      "儿童端：先选主题，再聊天或点快捷任务。",
      "完成小游戏或拍图后，再回到老师页生成家园同步话术。",
      "需要检查接口配置时，只从老师页进入能力状态。",
    ],
  },
  {
    title: "内容边界",
    items: [
      "前台不放项目介绍、展示路线、技术背书和部署说明。",
      "儿童页只保留故事、语音、插图、小游戏、拍图和记录册。",
      "首页只作为入口，不承担说明文档功能。",
    ],
  },
  {
    title: "维护备注",
    items: [
      "接口密钥只放服务端环境变量，不写进前台页面。",
      "成长记录、老师草稿和生成历史都保存在当前设备。",
      "临时登录、截图、网络调试文件不要放进项目目录。",
    ],
  },
];

export function TeacherStudio() {
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const showInternalNotes = process.env.NEXT_PUBLIC_SHOW_INTERNAL_NOTES === "true";
  const premiumVoiceLabel = process.env.NEXT_PUBLIC_TTS_VOICE_LABEL ?? defaultPremiumVoiceLabel;
  const draftStorageKey = "tongqu-growth-web-teacher-draft";
  const historyStorageKey = "tongqu-growth-web-teacher-history";
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [task, setTask] = useState(teacherTasks[0].label);
  const [scenario, setScenario] = useState(
    "今天午餐前，我想给 4-5 岁幼儿讲一个关于勇敢尝试新食物的小故事。",
  );
  const [result, setResult] = useState<TeacherResponse | null>(null);
  const [savedResults, setSavedResults] = useState<SavedTeacherResult[]>([]);
  const [historyFilter, setHistoryFilter] = useState<TeacherHistoryFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isPreviewSpeaking, setIsPreviewSpeaking] = useState(false);
  const [draftStatus, setDraftStatus] = useState("当前内容会自动保存在这台设备上。");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const historyReadFailedRef = useRef(false);
  const teacherScenarioRemaining = teacherScenarioMaxLength - scenario.length;
  const pinnedSavedResultCount = savedResults.filter((item) => item.pinned).length;
  const filteredSavedResults = useMemo(() => {
    if (historyFilter === "theme") {
      return savedResults.filter((item) => item.themeId === themeId);
    }

    if (historyFilter === "task") {
      return savedResults.filter((item) => item.task === task);
    }

    return savedResults;
  }, [historyFilter, savedResults, task, themeId]);
  const resultQualityChecks = useMemo(() => {
    const content = result?.content?.trim() ?? "";
    const tips = result?.tips ?? [];
    const taskContext = `${task} ${scenario}`;
    const taskSpecificCheck = (() => {
      if (/晨间|入园|接待/.test(taskContext)) {
        return {
          label: "贴合晨间接待",
          ok: /入园|早上|打招呼|书包|小任务|老师/.test(content),
        };
      }

      if (/餐前|午餐|食|尝|闻/.test(taskContext)) {
        return {
          label: "贴合餐前提醒",
          ok: /看一看|闻一闻|尝|洗手|等待|餐|食物/.test(content),
        };
      }

      if (/情绪|安抚|紧张|想家|哭/.test(taskContext)) {
        return {
          label: "先接住情绪",
          ok: /紧张|想家|没关系|慢慢|陪|抱|小台阶|情绪/.test(content),
        };
      }

      return {
        label: "包含家园延续",
        ok: /家长|回家|家里|今天在园|同步|可以问/.test(content),
      };
    })();

    return [
      {
        label: "内容已生成",
        ok: content.length > 0,
      },
      {
        label: "课堂口播不冗长",
        ok: content.length > 0 && content.length <= 180,
      },
      {
        label: "语气正向温柔",
        ok: /鼓励|一起|慢慢|勇敢|可以|愿意|谢谢|喜欢|尝试/.test(content),
      },
      {
        label: "带有可执行建议",
        ok: tips.length > 0 || /今天|下次|回家|家长|老师|孩子/.test(content),
      },
      taskSpecificCheck,
    ];
  }, [result, scenario, task]);
  const parentShareLine = useMemo(() => {
    if (!result) {
      return "";
    }

    const themeLabel = themeId === "habit" ? "好习惯练习" : "闽食探索";
    const taskContext = `${task} ${scenario}`;

    if (/晨间|入园|接待/.test(taskContext)) {
      return `家长您好，今天我们围绕${themeLabel}帮助孩子完成入园过渡。回家后可以轻轻问一句：“今天早上你是怎么和老师打招呼的？”`;
    }

    if (/餐前|午餐|食|尝|闻/.test(taskContext)) {
      return `家长您好，今天我们围绕${themeLabel}做了餐前观察。回家后可以接一句：“你愿意看一看、闻一闻，已经是很勇敢的尝试。”`;
    }

    if (/情绪|安抚|紧张|想家|哭/.test(taskContext)) {
      return `家长您好，今天我们先接住孩子的情绪，再陪他完成一个小任务。回家后可以说：“有一点紧张也没关系，你愿意慢慢试就很好。”`;
    }

    return `家长您好，今天我们围绕${themeLabel}和孩子做了一次小互动。回家后可以用一句鼓励的话接住孩子：“你愿意试一试，就已经很棒啦。”`;
  }, [result, scenario, task, themeId]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftStorageKey);

        if (raw) {
          const parsed = JSON.parse(raw) as {
            themeId?: ThemeId;
            task?: string;
            scenario?: string;
          };

          if (parsed.themeId && themes[parsed.themeId]) {
            setThemeId(parsed.themeId);
          }

          if (parsed.task) {
            setTask(parsed.task);
          }

          if (parsed.scenario) {
            setScenario(parsed.scenario);
            setDraftStatus("已恢复这台设备上次留下的老师端草稿。");
          }
        }
      } catch {
        setDraftStatus("草稿读取失败了，当前先用默认内容。");
      }

      try {
        const historyRaw = window.localStorage.getItem(historyStorageKey);
        if (historyRaw) {
          const history = JSON.parse(historyRaw) as SavedTeacherResult[];
          if (Array.isArray(history)) {
            setSavedResults(
              limitTeacherHistory(
                history
                  .filter(
                    (item): item is SavedTeacherResult =>
                      Boolean(
                        item &&
                          typeof item.id === "string" &&
                          typeof item.title === "string" &&
                          typeof item.content === "string" &&
                          Array.isArray(item.tips) &&
                          typeof item.themeId === "string" &&
                          themes[item.themeId as ThemeId] &&
                          typeof item.task === "string" &&
                          typeof item.scenario === "string" &&
                          typeof item.savedAt === "string",
                      ),
                  )
                  .map((item) => ({
                    ...item,
                    pinned: item.pinned === true,
                  })),
              ),
            );
            historyReadFailedRef.current = false;
          }
        }
      } catch {
        historyReadFailedRef.current = true;
        setDraftStatus("历史读取失败了，不影响当前草稿继续使用。");
      } finally {
        const searchParams = new URLSearchParams(window.location.search);
        const linkedTheme = searchParams.get("theme");
        const linkedFrom = searchParams.get("from");

        if (linkedFrom === "mini-game" && (linkedTheme === "habit" || linkedTheme === "food")) {
          const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];

          setThemeId(linkedTheme);
          setTask(homeTask.label);
          setScenario(buildMiniGameExtensionScenario(linkedTheme));
          setDraftStatus("已接上儿童端小游戏记录，可以直接生成家园共育延伸话术。");
        }

        setDraftHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        themeId,
        task,
        scenario,
      }),
    );
  }, [draftHydrated, draftStorageKey, scenario, task, themeId]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    if (historyReadFailedRef.current && savedResults.length === 0) {
      return;
    }

    window.localStorage.setItem(historyStorageKey, JSON.stringify(limitTeacherHistory(savedResults)));
  }, [draftHydrated, historyStorageKey, savedResults]);

  async function generate() {
    const cleanScenario = scenario.trim();

    if (!cleanScenario) {
      setDraftStatus("先输入一个课堂或家园共育场景，再开始生成。");
      return;
    }

    if (cleanScenario.length > teacherScenarioMaxLength) {
      setDraftStatus(`场景描述太长了，请控制在 ${teacherScenarioMaxLength} 个字以内。`);
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
      const savedAt = new Date().toISOString();
      const nextId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setResult(data);
      historyReadFailedRef.current = false;
      setSavedResults((current) => {
        const nextHistory = limitTeacherHistory([
          {
            ...data,
            id: nextId,
            themeId,
            task,
            scenario,
            savedAt,
            pinned: false,
          },
          ...current,
        ]);
        const resultSaved = nextHistory.some((item) => item.id === nextId);

        setDraftStatus(
          resultSaved
            ? "已生成并保存到本机历史，之后可以继续套用。"
            : "生成结果已显示。当前历史固定收藏已满，这次结果不会自动挤掉固定内容。",
        );

        return nextHistory;
      });
      setCopyStatus("");
      setVoiceStatus("");
    } catch {
      setDraftStatus("生成暂时失败了，可以稍后重试；已生成的历史不会被清空。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    const text = [result.title, result.content, parentShareLine, ...(result.tips ?? [])]
      .filter(Boolean)
      .join("\n");

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
            : "高质量播报暂时不可用，当前先用浏览器播报。",
        );
      }
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceStatus("当前浏览器不支持播报，可以先继续使用儿童互动页。");
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

  function resetTeacherDraft(statusMessage = "已经恢复到默认内容，可以重新开始输入。") {
    setThemeId("habit");
    setTask(teacherTasks[0].label);
    setScenario("今天午餐前，我想给 4-5 岁幼儿讲一个关于勇敢尝试新食物的小故事。");
    setResult(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(statusMessage);
  }

  function clearTeacherDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }

    resetTeacherDraft("这台设备上的老师端草稿已经清空。");
  }

  function reuseSavedResult(item: SavedTeacherResult) {
    setThemeId(item.themeId);
    setTask(item.task);
    setScenario(item.scenario);
    setResult({
      title: item.title,
      content: item.content,
      tips: item.tips,
      error: item.error,
    });
    setDraftStatus("已套用一条历史生成结果，可以继续修改或换一版。");
  }

  function clearTeacherHistory() {
    historyReadFailedRef.current = false;
    setSavedResults([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(historyStorageKey);
    }
    setDraftStatus("这台设备上的老师端生成历史已经清空。");
  }

  function deleteSavedResult(id: string) {
    historyReadFailedRef.current = false;
    setSavedResults((current) => current.filter((item) => item.id !== id));
    setDraftStatus("已删除这条历史生成结果，其他历史仍然保留。");
  }

  function toggleSavedResultPin(id: string) {
    historyReadFailedRef.current = false;
    setSavedResults((current) =>
      limitTeacherHistory(
        current.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)),
      ),
    );
    setDraftStatus("已更新这条历史的固定状态，固定内容会优先保留。");
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
              晨间接待、餐前提醒、情绪安抚和家长同步
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            这里和儿童端分开，方便老师在入园、餐前、情绪过渡和家园沟通时直接拿内容去用。生成出来的文案会尽量短、温柔、适合课堂和家长沟通直接使用。
            {premiumTtsEnabled ? ` 当前已经预留 ${premiumVoiceLabel} 播报入口，适合直接试播老师引导语。` : ""}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => {
                  setThemeId(theme.id);
                  setDraftStatus("主题切换后会自动保存到这台设备。");
                }}
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
                  setDraftStatus("已切换到新的老师任务模板，会自动保存到这台设备。");
                }}
                className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                <p className="font-semibold text-slate-800">{item.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">{item.starter}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[1.8rem] bg-[linear-gradient(135deg,#effcfc_0%,#ffffff_100%)] p-4">
            <p className="text-sm font-semibold text-slate-500">这一页适合什么时候打开</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              儿童端负责“让孩子愿意参与”，老师端负责“让老师和家长拿到可直接使用的内容”，两端一起组成完整教育闭环。
            </p>
          </div>
        </div>
      </section>

      {showInternalNotes ? (
        <details className="rounded-[2.2rem] bg-slate-900 p-6 text-white shadow-[0_24px_80px_rgba(35,88,95,0.16)]">
          <summary className="cursor-pointer text-xl font-semibold">内部备注</summary>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {internalNoteGroups.map((group) => (
              <div key={group.title} className="rounded-[1.6rem] bg-white/10 p-4">
                <p className="text-sm font-semibold text-white/70">{group.title}</p>
                <div className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <p
                      key={item}
                      className="rounded-[1.1rem] bg-white/10 px-3 py-2 text-sm leading-6"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/adventure"
              className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              打开儿童端
            </Link>
          </div>
        </details>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_56%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-700">老师一天怎么用</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">四张场景卡就够了</h2>
            </div>
            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              短、快、直接能拿走
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {teacherWorkflowCards.map((item) => (
              <div
                key={item.title}
                className="story-card rounded-[1.8rem] bg-white/88 p-5 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-amber-100 text-2xl">
                  {item.icon}
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-cyan-700">老师端能带走什么</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">不是只生成一句话</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[1.8rem] bg-cyan-50 p-4">
              <p className="text-lg font-semibold text-slate-900">课堂可说</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                生成结果会尽量短一点，老师在教室里直接念出来也不会太长。
              </p>
            </div>
            <div className="rounded-[1.8rem] bg-amber-50 p-4">
              <p className="text-lg font-semibold text-slate-900">家长可转发</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                复制以后就能放进家长群、班级通知或成长记录里。
              </p>
            </div>
            <div className="rounded-[1.8rem] bg-emerald-50 p-4">
              <p className="text-lg font-semibold text-slate-900">还能试播</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                语音播报能提前帮老师听一遍语气，决定要不要再润色一下。
              </p>
            </div>
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
                onClick={() => {
                  setTask(item.label);
                  setDraftStatus("任务类型已切换，会自动保存到这台设备。");
                }}
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
            onChange={(event) => {
              setScenario(event.target.value);
              setDraftStatus("输入内容会自动保存到这台设备。");
            }}
            maxLength={teacherScenarioMaxLength}
            className="mt-5 min-h-48 w-full rounded-[2rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>建议写清年龄、场景和目标，生成结果会更适合直接使用。</span>
            <span className={teacherScenarioRemaining < 40 ? "text-amber-700" : "text-slate-500"}>
              还可输入 {teacherScenarioRemaining} 字
            </span>
          </div>

          <button
            onClick={() => void generate()}
            className="mt-5 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={isLoading || !scenario.trim()}
          >
            {isLoading ? "正在生成..." : "开始生成"}
          </button>

          <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4">
            <p className="text-sm leading-7 text-slate-600">
              小建议：先点一个“常用生成任务”，再看生成结果、复制动作和试播按钮，老师端价值会更直观。
            </p>
            <p className="mt-3 text-sm font-semibold text-teal-700">{draftStatus}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => resetTeacherDraft()}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
              >
                恢复默认内容
              </button>
              <button
                onClick={clearTeacherDraft}
                className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
              >
                清空这台设备草稿
              </button>
            </div>
          </div>
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

          {parentShareLine ? (
            <div className="mt-5 rounded-[1.8rem] bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">家长沟通可用句</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{parentShareLine}</p>
            </div>
          ) : null}

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

          <div className="mt-5 rounded-[1.8rem] bg-white/75 p-4">
            <p className="text-sm font-semibold text-slate-700">可用性检查</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {resultQualityChecks.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-[1.2rem] px-3 py-3 text-sm font-semibold ${
                    item.ok ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.ok ? "已满足" : "待生成"} · {item.label}
                </div>
              ))}
            </div>
          </div>

          {result?.error ? (
            <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
              生成提醒：{result.error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">生成历史</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              固定收藏优先，保留 6 条可复用内容
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { id: "all", label: "全部" },
              { id: "theme", label: "当前主题" },
              { id: "task", label: "当前任务" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setHistoryFilter(item.id as TeacherHistoryFilter)}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  historyFilter === item.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={clearTeacherHistory}
              className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={savedResults.length === 0}
            >
              清空历史
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-500">
          当前显示 {filteredSavedResults.length} 条，全部历史 {savedResults.length} 条，已固定{" "}
          {pinnedSavedResultCount} 条。
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {filteredSavedResults.length > 0 ? (
            filteredSavedResults.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.8rem] bg-[linear-gradient(180deg,#f8fffe_0%,#ffffff_100%)] p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-900">
                      {item.themeId === "habit" ? "习惯" : "闽食"}
                    </span>
                    {item.pinned ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                        已固定
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{item.task}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-600">{item.content}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => reuseSavedResult(item)}
                    className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    套用这条
                  </button>
                  <button
                    onClick={() => toggleSavedResultPin(item.id)}
                    className="rounded-full bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
                  >
                    {item.pinned ? "取消固定" : "固定收藏"}
                  </button>
                  <button
                    onClick={() => deleteSavedResult(item.id)}
                    className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
                  >
                    删除这条
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.8rem] bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              {savedResults.length > 0
                ? "当前筛选下没有匹配内容，可以切回“全部”查看历史。"
                : "还没有生成历史。生成晨间接待、餐前提醒、情绪安抚或家长同步内容后，会自动保存在这里，方便下一次继续使用。"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
