"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SectionDirectory, type SectionDirectoryItem } from "@/components/section-directory";
import { getAccountSyncDeviceInfo } from "@/lib/account-sync-client";
import { findChildIdentitySuggestions, formatChildLabel } from "@/lib/child-identity";
import {
  childRosterStorageKey,
  createEmptyGrowthArchive,
  growthArchiveStorageKey,
  mergeGrowthArchives,
  parseChildRoster,
  parseGrowthArchive,
  type ChildProfile,
  type GrowthArchive,
} from "@/lib/growth-archive";
import { parentHomeTaskCards } from "@/lib/site-data";
import {
  addParentFeedbackRecord,
  formatParentSyncTime,
  getParentFeedbackCategoryLabel,
  parentFeedbackStorageKey,
  parentSyncStorageKey,
  parseParentFeedbackRecords,
  parseParentSyncRecords,
  type ParentFeedbackCategory,
  type ParentFeedbackRecord,
  type ParentSyncRecord,
} from "@/lib/parent-sync";
import {
  parseTeacherPictureBooks,
  teacherPictureBooksStorageKey,
  type TeacherPictureBook,
} from "@/lib/teacher-published-content";
import {
  dailyMenuOverrideStorageKey,
  formatMenuDate,
  getEffectiveMenuForDate,
  getLocalDateKey,
  getWeekdayLabel,
  parseDailyMenuOverrides,
  parseWeeklyMenuEntries,
  weeklyMenuStorageKey,
  type WeeklyMenuEntry,
} from "@/lib/weekly-menu";
import { speakWithBrowserVoice, stopAllVoicePlayback } from "@/lib/voice-client";

type ParentPortalProps = {
  initialChildId?: string;
};

type ParentHomeTaskCard = (typeof parentHomeTaskCards)[number];
type ParentAccessState = {
  childId: string;
  consentAt: string;
  bindingCode?: string;
};
type FamilySyncResponse = {
  ok?: boolean;
  error?: string;
  child?: ChildProfile;
  payload?: Record<string, unknown>;
  updatedAt?: string;
};

const parentAccessStorageKey = "tongqu-growth-web-parent-access";
type ParentPanelKey =
  | "home"
  | "parent-suggestions"
  | "parent-reading"
  | "parent-home-task"
  | "parent-feedback"
  | "parent-growth";

const parentPanelLabels: Record<ParentPanelKey, string> = {
  home: "家长首页",
  "parent-suggestions": "今日建议",
  "parent-reading": "亲子阅读",
  "parent-home-task": "居家任务",
  "parent-feedback": "家庭反馈",
  "parent-growth": "成长记录",
};

function getParentPanelFromHref(href: string): ParentPanelKey {
  const panel = href.replace(/^#/, "") as ParentPanelKey;

  return panel in parentPanelLabels ? panel : "home";
}

const parentDirectoryItems: SectionDirectoryItem[] = [
  {
    label: "今日建议",
    description: "先看今天观察。",
    href: "#parent-suggestions",
    icon: "📝",
    tone: "bg-emerald-50 text-emerald-950",
  },
  {
    label: "亲子阅读",
    description: "读教师确认绘本。",
    href: "#parent-reading",
    icon: "📖",
    tone: "bg-violet-50 text-violet-950",
  },
  {
    label: "居家任务",
    description: "回家做一小步。",
    href: "#parent-home-task",
    icon: "🏠",
    tone: "bg-cyan-50 text-cyan-950",
  },
  {
    label: "家庭反馈",
    description: "写一句观察。",
    href: "#parent-feedback",
    icon: "💬",
    tone: "bg-rose-50 text-rose-950",
  },
  {
    label: "成长记录",
    description: "看个人小变化。",
    href: "#parent-growth",
    icon: "🌱",
    tone: "bg-teal-50 text-teal-950",
  },
];
const familyPlateActionSteps = [
  "愿意尝试一口",
  "今天吃完自己的饭菜",
  "尝试一种正在认识的食物",
  "餐后整理碗筷",
];

function formatRecordTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChildParentSyncs(records: ParentSyncRecord[], child: ChildProfile | null) {
  return records.filter((record) => (child ? record.childId === child.id : false));
}

function getChildParentFeedbacks(records: ParentFeedbackRecord[], child: ChildProfile | null) {
  return records.filter((record) => (child ? record.childId === child.id : false));
}

function dedupeParentHomeTaskCards(cards: ParentHomeTaskCard[]) {
  const seen = new Set<string>();

  return cards.filter((card) => {
    if (seen.has(card.title)) {
      return false;
    }

    seen.add(card.title);
    return true;
  });
}

function payloadText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const incomingIds = new Set(incoming.map((item) => item.id));

  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))];
}

export function ParentPortal({ initialChildId }: ParentPortalProps) {
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activeParentPanel, setActiveParentPanel] = useState<ParentPanelKey>("home");
  const [parentSyncRecords, setParentSyncRecords] = useState<ParentSyncRecord[]>([]);
  const [parentFeedbackRecords, setParentFeedbackRecords] = useState<ParentFeedbackRecord[]>([]);
  const [teacherPictureBooks, setTeacherPictureBooks] = useState<TeacherPictureBook[]>([]);
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(createEmptyGrowthArchive());
  const [todayMenuEntries, setTodayMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [accountText, setAccountText] = useState("");
  const [bindingCodeText, setBindingCodeText] = useState("");
  const [activeBindingCode, setActiveBindingCode] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<ParentFeedbackCategory>("question");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackPhoto, setFeedbackPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [feedbackPhotoStatus, setFeedbackPhotoStatus] =
    useState("可选放一张家庭观察照片。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。");
  const [feedbackStatus, setFeedbackStatus] =
    useState("班级试用模式：家长的疑惑、想法和在家观察会保存在这台设备上。");
  const [selectedHomeTaskTitle, setSelectedHomeTaskTitle] = useState(
    parentHomeTaskCards[0]?.title ?? "",
  );
  const [selectedHomeTaskStep, setSelectedHomeTaskStep] = useState(
    parentHomeTaskCards[0]?.tasks[0] ?? "",
  );
  const [homeTaskNote, setHomeTaskNote] = useState("");
  const [homeTaskStatus, setHomeTaskStatus] = useState(
    "先选一张居家任务卡，再选一个今天真的完成的小步骤。",
  );
  const [selectedReadingBookId, setSelectedReadingBookId] = useState("");
  const [parentReadingNote, setParentReadingNote] = useState("");
  const [parentReadingStatus, setParentReadingStatus] =
    useState("选择一本老师确认发布的绘本，亲子共读后可同步给老师。");
  const [parentReadingVoiceBookId, setParentReadingVoiceBookId] = useState("");
  const parentReadingVoiceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [plateActionStep, setPlateActionStep] = useState(familyPlateActionSteps[0]);
  const [plateActionNote, setPlateActionNote] = useState("");
  const [plateActionPhoto, setPlateActionPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [plateActionPhotoStatus, setPlateActionPhotoStatus] =
    useState("可选放一张餐后整理或尝试小步骤照片。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。");
  const [plateActionStatus, setPlateActionStatus] =
    useState("选择一个今天真实发生的小步骤，提交后老师端会看到家庭光盘行动反馈。");
  const [status, setStatus] = useState("请输入幼儿姓名或号数、家庭绑定码，并勾选同意后查看。");
  const selectedChild = useMemo(
    () => childRoster.find((child) => child.id === selectedChildId) ?? null,
    [childRoster, selectedChildId],
  );
  const childParentSyncs = useMemo(
    () => getChildParentSyncs(parentSyncRecords, selectedChild),
    [parentSyncRecords, selectedChild],
  );
  const aiHomeTaskCards = useMemo(() => {
    const cards: ParentHomeTaskCard[] = [];
    const latestSync = childParentSyncs[0];

    if (latestSync) {
      cards.push({
        title: "AI今日居家小任务",
        icon: latestSync.themeId === "food" ? "🥢" : "✨",
        tasks: [
          latestSync.homePractice,
          "回家可以轻轻做一步",
          "家长写一句观察",
          "完成后反馈老师",
        ],
      });
    }

    return dedupeParentHomeTaskCards([...cards, ...parentHomeTaskCards]).slice(0, 5);
  }, [childParentSyncs]);
  const selectedHomeTask = useMemo(
    () =>
      aiHomeTaskCards.find((card) => card.title === selectedHomeTaskTitle) ??
      aiHomeTaskCards[0] ??
      parentHomeTaskCards[0],
    [aiHomeTaskCards, selectedHomeTaskTitle],
  );
  const effectiveHomeTaskStep = useMemo(
    () =>
      selectedHomeTask?.tasks.includes(selectedHomeTaskStep)
        ? selectedHomeTaskStep
        : selectedHomeTask?.tasks[0] ?? "",
    [selectedHomeTask, selectedHomeTaskStep],
  );
  const childParentFeedbacks = useMemo(
    () => getChildParentFeedbacks(parentFeedbackRecords, selectedChild),
    [parentFeedbackRecords, selectedChild],
  );
  const childReadingBooks = useMemo(
    () => teacherPictureBooks.filter((book) => book.themeId === "habit").slice(0, 6),
    [teacherPictureBooks],
  );
  const selectedReadingBook = useMemo(
    () =>
      childReadingBooks.find((book) => book.id === selectedReadingBookId) ??
      childReadingBooks[0] ??
      null,
    [childReadingBooks, selectedReadingBookId],
  );
  const parentChangeLines = useMemo(
    () => {
      const syncedLines = childParentSyncs.slice(0, 5).map((record) =>
        [
          `${record.childName}：${record.summary}`,
          record.homePractice ? `回家可以轻轻做一步：${record.homePractice}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      const childGameLines = selectedChild
        ? growthArchive.miniGameRecords
            .filter((record) => record.childId === selectedChild.id)
            .slice(0, 5)
            .map((record) =>
              [
                `${record.childName ?? selectedChild.name}完成了${record.gameInstanceTitle ?? record.badgeName}`,
                record.childUtterance ? `说了：${record.childUtterance}` : "",
                record.foodLabel ? `认识：${record.foodLabel}` : "",
              ]
                .filter(Boolean)
                .join(" "),
            )
        : [];

      return [...childGameLines, ...syncedLines].slice(0, 6);
    },
    [childParentSyncs, growthArchive.miniGameRecords, selectedChild],
  );
  const todayMenuDateKey = getLocalDateKey();
  const parentTodayMenuText = useMemo(() => {
    if (todayMenuEntries.length === 0) {
      return "";
    }

    const dishText = todayMenuEntries.map((entry) => `${entry.mealType}：${entry.dishName}`).join("；");

    return `今天 ${formatMenuDate(todayMenuDateKey)} ${getWeekdayLabel(todayMenuDateKey)}，${dishText}`;
  }, [todayMenuDateKey, todayMenuEntries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readTodayMenuEntries = () =>
      getEffectiveMenuForDate(
        parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)),
        parseDailyMenuOverrides(window.localStorage.getItem(dailyMenuOverrideStorageKey)),
        getLocalDateKey(),
      );

    const restoreHandle = window.setTimeout(() => {
      const roster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));

      setChildRoster(roster);
      setSelectedChildId("");
      setParentSyncRecords(parseParentSyncRecords(window.localStorage.getItem(parentSyncStorageKey)));
      setParentFeedbackRecords(
        parseParentFeedbackRecords(window.localStorage.getItem(parentFeedbackStorageKey)),
      );
      setGrowthArchive(parseGrowthArchive(window.localStorage.getItem(growthArchiveStorageKey)));
      setTeacherPictureBooks(
        parseTeacherPictureBooks(window.localStorage.getItem(teacherPictureBooksStorageKey)),
      );
      setTodayMenuEntries(readTodayMenuEntries());
      window.localStorage.removeItem(parentAccessStorageKey);
      setStatus(
        roster.length > 0
          ? "为保护隐私，请输入幼儿姓名或号数、家庭绑定码，并勾选同意后查看。"
          : "还没有幼儿名单，请联系老师在教师工作台里添加花名册。",
      );
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [initialChildId]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      parentReadingVoiceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleParentSharedDataStorage(event: StorageEvent) {
      if (event.key === childRosterStorageKey) {
        const roster = parseChildRoster(event.newValue);
        setChildRoster(roster);
        setSelectedChildId((current) =>
          current && roster.some((child) => child.id === current) ? current : "",
        );

        if (roster.length === 0) {
          setStatus("老师端花名册已更新为空，请联系老师确认家庭绑定码。");
        }
      }

      if (event.key === parentSyncStorageKey) {
        setParentSyncRecords(parseParentSyncRecords(event.newValue));
      }

      if (event.key === parentFeedbackStorageKey) {
        setParentFeedbackRecords(parseParentFeedbackRecords(event.newValue));
      }

      if (event.key === growthArchiveStorageKey) {
        setGrowthArchive(parseGrowthArchive(event.newValue));
      }

      if (event.key === teacherPictureBooksStorageKey) {
        setTeacherPictureBooks(parseTeacherPictureBooks(event.newValue));
      }

      if (event.key === weeklyMenuStorageKey || event.key === dailyMenuOverrideStorageKey) {
        setTodayMenuEntries(
          getEffectiveMenuForDate(
            parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)),
            parseDailyMenuOverrides(window.localStorage.getItem(dailyMenuOverrideStorageKey)),
            getLocalDateKey(),
          ),
        );
      }
    }

    window.addEventListener("storage", handleParentSharedDataStorage);

    return () => window.removeEventListener("storage", handleParentSharedDataStorage);
  }, []);

  function applyFamilySyncPayload(payload: Record<string, unknown> = {}) {
    if (typeof window === "undefined") {
      return;
    }

    const syncedRoster = parseChildRoster(payloadText(payload.childRoster));
    const syncedParentSyncRecords = parseParentSyncRecords(payloadText(payload.parentSyncRecords));
    const syncedParentFeedbackRecords = parseParentFeedbackRecords(payloadText(payload.parentFeedbackRecords));
    const syncedBooks = parseTeacherPictureBooks(payloadText(payload.teacherPictureBooks));
    const growthRaw = payloadText(payload.growthArchive);
    const weeklyRaw = payloadText(payload.weeklyMenuEntries);
    const dailyRaw = payloadText(payload.dailyMenuOverrides);

    if (syncedRoster.length > 0) {
      setChildRoster((current) => {
        const nextRoster = mergeById(current, syncedRoster);
        window.localStorage.setItem(childRosterStorageKey, JSON.stringify(nextRoster));

        return nextRoster;
      });
    }

    if (syncedParentSyncRecords.length > 0) {
      setParentSyncRecords((current) => {
        const nextRecords = parseParentSyncRecords(
          JSON.stringify(mergeById(current, syncedParentSyncRecords)),
        );
        window.localStorage.setItem(parentSyncStorageKey, JSON.stringify(nextRecords));

        return nextRecords;
      });
    }

    if (syncedParentFeedbackRecords.length > 0) {
      setParentFeedbackRecords((current) => {
        const nextRecords = parseParentFeedbackRecords(
          JSON.stringify(mergeById(current, syncedParentFeedbackRecords)),
        );
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));

        return nextRecords;
      });
    }

    if (syncedBooks.length > 0) {
      setTeacherPictureBooks((current) => {
        const nextBooks = mergeById(current, syncedBooks);
        window.localStorage.setItem(teacherPictureBooksStorageKey, JSON.stringify(nextBooks));

        return nextBooks;
      });
    }

    if (growthRaw) {
      const nextArchive = mergeGrowthArchives(
        parseGrowthArchive(window.localStorage.getItem(growthArchiveStorageKey)),
        parseGrowthArchive(growthRaw),
      );

      window.localStorage.setItem(growthArchiveStorageKey, JSON.stringify(nextArchive));
      setGrowthArchive(nextArchive);
    }

    if (weeklyRaw || dailyRaw) {
      if (weeklyRaw) {
        window.localStorage.setItem(weeklyMenuStorageKey, weeklyRaw);
      }

      if (dailyRaw) {
        window.localStorage.setItem(dailyMenuOverrideStorageKey, dailyRaw);
      }

      setTodayMenuEntries(
        getEffectiveMenuForDate(
          parseWeeklyMenuEntries(weeklyRaw || window.localStorage.getItem(weeklyMenuStorageKey)),
          parseDailyMenuOverrides(dailyRaw || window.localStorage.getItem(dailyMenuOverrideStorageKey)),
          getLocalDateKey(),
        ),
      );
    }
  }

  async function pullFamilySyncFromAccount(childQuery: string, bindingCode: string, fallbackChild?: ChildProfile) {
    setStatus("正在通过家庭绑定码同步账号数据...");

    const response = await fetch("/api/family-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "pull",
        childQuery,
        childId: fallbackChild?.id,
        bindingCode,
        ...getAccountSyncDeviceInfo(),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as FamilySyncResponse;

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "家庭账号同步暂时不可用。");
    }

    const child = data.child ?? fallbackChild;

    if (!child) {
      throw new Error("家庭账号同步没有返回幼儿身份。");
    }

    applyFamilySyncPayload(data.payload ?? {});
    setActiveBindingCode(bindingCode);
    setBindingCodeText(bindingCode);
    authorizeChild(child, bindingCode);
    setStatus(`${formatChildLabel(child)} 的家庭延续页已打开，并已同步老师发布的家庭内容。`);
  }

  async function syncParentFeedbackRecord(
    record: ParentFeedbackRecord,
    setStatusMessage: (message: string) => void,
    successMessage: string,
  ) {
    const bindingCode =
      (activeBindingCode || bindingCodeText || selectedChild?.familyBindingCode || "").trim().toUpperCase();

    if (!selectedChild || !bindingCode) {
      setStatusMessage(`${successMessage}（当前没有家庭绑定码，已先保存在本机。）`);
      return;
    }

    try {
      const response = await fetch("/api/family-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "feedback",
          childId: selectedChild.id,
          childQuery: selectedChild.rosterNumber ? `${selectedChild.rosterNumber}号` : selectedChild.name,
          bindingCode,
          feedback: record,
          ...getAccountSyncDeviceInfo(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as FamilySyncResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "家庭反馈账号同步失败。");
      }

      applyFamilySyncPayload(data.payload ?? {});
      setStatusMessage(successMessage);
    } catch {
      setStatusMessage(`${successMessage}（本机已保存，账号同步稍后可重试。）`);
    }
  }

  function authorizeChild(child: ChildProfile, bindingCode?: string) {
    setSelectedChildId(child.id);
    setActiveParentPanel("home");
    setStatus(`${formatChildLabel(child)} 的家庭延续页已打开。`);
    setActiveBindingCode(bindingCode ?? child.familyBindingCode ?? "");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        parentAccessStorageKey,
        JSON.stringify({
          childId: child.id,
          consentAt: new Date().toISOString(),
          bindingCode: bindingCode ?? child.familyBindingCode,
        } satisfies ParentAccessState),
      );
    }
  }

  function logoutParentAccess() {
    setSelectedChildId("");
    setActiveParentPanel("home");
    setBindingCodeText("");
    setActiveBindingCode("");
    setPrivacyConsent(false);
    setStatus("已退出家庭延续页。再次查看时，请重新输入家庭绑定码。");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(parentAccessStorageKey);
    }
  }

  async function loginByAccount() {
    const text = accountText.trim();
    const code = bindingCodeText.trim().toUpperCase();

    if (!text) {
      setStatus("请先输入幼儿姓名或号数。");
      return;
    }

    if (!code) {
      setStatus("请同时输入老师提供的家庭绑定码。");
      return;
    }

    if (!privacyConsent) {
      setStatus("请先勾选同意本班家园共育反馈用途，再进入家庭延续页。");
      return;
    }

    try {
      await pullFamilySyncFromAccount(text, code);
      return;
    } catch {
      // If the class has not uploaded a cloud account yet, keep the original same-device flow.
    }

    const suggestions = findChildIdentitySuggestions(text, childRoster);

    if (suggestions.length === 0) {
      setStatus(`没有找到“${text}”对应的幼儿身份，请联系老师确认花名册。`);
      return;
    }

    if (suggestions.length > 1) {
      setStatus("找到多个可能的小名牌，请把姓名或号数说得更完整一点。");
      return;
    }

    const child = suggestions[0];
    const savedCode = child.familyBindingCode?.trim().toUpperCase();

    if (!savedCode) {
      setStatus("这个幼儿还没有家庭绑定码，请联系老师在教师工作台花名册里生成。");
      return;
    }

    if (code !== savedCode) {
      setStatus("家庭绑定码不正确，请核对老师发给家长的 6 位绑定码。");
      return;
    }

    authorizeChild(child, code);
  }

  function submitParentFeedback() {
    if (!selectedChild) {
      setFeedbackStatus("请先选择幼儿身份，再提交给老师。");
      return;
    }

    const content = feedbackText.trim().slice(0, 320);

    if (!content && !feedbackPhoto) {
      setFeedbackStatus("请先写一句观察，或上传一张家庭观察照片。");
      return;
    }

    const record: ParentFeedbackRecord = {
      id: `feedback-${Date.now()}-${selectedChild.id}`,
      childId: selectedChild.id,
      childName: selectedChild.name,
      category: feedbackCategory,
      content: content || "家长上传了一张家庭观察照片，请老师结合幼儿记录继续跟进。",
      createdAt: new Date().toISOString(),
      status: "new",
      ...(feedbackPhoto
        ? {
            attachmentName: feedbackPhoto.name,
            attachmentDataUrl: feedbackPhoto.dataUrl,
          }
        : {}),
    };

    setParentFeedbackRecords((current) => {
      const nextRecords = addParentFeedbackRecord(current, record);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
    setFeedbackText("");
    setFeedbackPhoto(null);
    setFeedbackPhotoStatus("可选放一张家庭观察照片。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。");
    setFeedbackStatus("已保存到教师工作台反馈列表，老师查看后可以回复和给出家庭建议。");
    void syncParentFeedbackRecord(
      record,
      setFeedbackStatus,
      "已同步到账号云端，老师拉取班级同步后可查看。",
    );
  }

  function submitParentReading() {
    if (!selectedChild || !selectedReadingBook) {
      setParentReadingStatus("请先选择一本老师确认发布的绘本。");
      return;
    }

    const note = parentReadingNote.trim().slice(0, 180);
    const record: ParentFeedbackRecord = {
      id: `parent-reading-${Date.now()}-${selectedChild.id}`,
      childId: selectedChild.id,
      childName: selectedChild.name,
      category: "home-observation",
      content: [
        `亲子阅读打卡：《${selectedReadingBook.title}》`,
        selectedReadingBook.question ? `阅读后问题：${selectedReadingBook.question}` : "",
        selectedReadingBook.habitTask ? `阅读后小任务：${selectedReadingBook.habitTask}` : "",
        note ? `家长观察：${note}` : "家长观察：已完成一次亲子共读。",
      ]
        .filter(Boolean)
        .join("。"),
      createdAt: new Date().toISOString(),
      status: "new",
    };

    setParentFeedbackRecords((current) => {
      const nextRecords = addParentFeedbackRecord(current, record);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
    setParentReadingNote("");
    setParentReadingStatus(`《${selectedReadingBook.title}》亲子阅读打卡已同步教师端。`);
    void syncParentFeedbackRecord(
      record,
      setParentReadingStatus,
      `《${selectedReadingBook.title}》亲子阅读打卡已同步账号云端。`,
    );
  }

  function buildParentReadingSpeech(book: TeacherPictureBook) {
    return [
      `我们一起听《${book.title}》。`,
      book.storyText,
      book.question ? `听完可以聊一聊：${book.question}` : "",
      book.habitTask ? `也可以轻轻做一小步：${book.habitTask}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function stopParentReadingVoice() {
    stopAllVoicePlayback();
    parentReadingVoiceRef.current = null;
    setParentReadingVoiceBookId("");
  }

  function toggleParentReadingVoice(book: TeacherPictureBook) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setParentReadingStatus("当前浏览器暂时不能播放语音，可以先亲子共读文字。");
      return;
    }

    if (parentReadingVoiceBookId === book.id) {
      stopParentReadingVoice();
      setParentReadingStatus(`已暂停《${book.title}》。`);
      return;
    }

    const played = speakWithBrowserVoice(buildParentReadingSpeech(book), "child", {
      onend: () => {
        parentReadingVoiceRef.current = null;
        setParentReadingVoiceBookId("");
        setParentReadingStatus(`《${book.title}》听完啦，可以完成亲子阅读打卡。`);
      },
      onerror: () => {
        parentReadingVoiceRef.current = null;
        setParentReadingVoiceBookId("");
        setParentReadingStatus("语音播放中断了，可以再点一次听一听。");
      },
    });

    if (!played) {
      setParentReadingStatus("当前浏览器暂时不能播放语音，可以先亲子共读文字。");
      return;
    }

    parentReadingVoiceRef.current = null;
    setParentReadingVoiceBookId(book.id);
    setParentReadingStatus(`正在听《${book.title}》。`);
  }

  function chooseFeedbackPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFeedbackPhotoStatus("请选择图片文件。");
      return;
    }

    if (file.size > 1_500_000) {
      setFeedbackPhotoStatus("图片有点大，请选择 1.5MB 以内的家庭观察照片。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";

      if (!dataUrl.startsWith("data:image/")) {
        setFeedbackPhotoStatus("照片读取失败，请重新选择。");
        return;
      }

      setFeedbackPhoto({ name: file.name, dataUrl });
      setFeedbackPhotoStatus("照片已添加，提交后老师端可以查看。");
    };
    reader.onerror = () => setFeedbackPhotoStatus("照片读取失败，请重新选择。");
    reader.readAsDataURL(file);
  }

  function chooseHomeTask(card: ParentHomeTaskCard) {
    setSelectedHomeTaskTitle(card.title);
    setSelectedHomeTaskStep(card.tasks[0] ?? "");
    setHomeTaskStatus(`已选择“${card.title}”，今天只记录一个真实小步骤就可以。`);
  }

  function submitHomeTask() {
    if (!selectedChild) {
      setHomeTaskStatus("请先选择幼儿身份，再提交居家任务。");
      return;
    }

    if (!selectedHomeTask || !effectiveHomeTaskStep) {
      setHomeTaskStatus("请先选择一张任务卡和一个小步骤。");
      return;
    }

    const note = homeTaskNote.trim().slice(0, 180);
    const content = [
      `完成居家延续任务：${selectedHomeTask.title}`,
      `小步骤：${effectiveHomeTaskStep}`,
      note ? `家长观察：${note}` : "家长观察：孩子已完成一个小步骤，后续继续观察。",
    ].join("。");

    const record: ParentFeedbackRecord = {
      id: `home-task-${Date.now()}-${selectedChild.id}`,
      childId: selectedChild.id,
      childName: selectedChild.name,
      category: "home-observation",
      content,
      createdAt: new Date().toISOString(),
      status: "new",
    };

    setParentFeedbackRecords((current) => {
      const nextRecords = addParentFeedbackRecord(current, record);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
    setHomeTaskNote("");
    setFeedbackCategory("home-observation");
    setFeedbackStatus("居家任务已同步到教师工作台反馈列表。");
    setHomeTaskStatus("已提交给老师。老师可以在工作台里看到这次居家延续记录。");
    void syncParentFeedbackRecord(
      record,
      setHomeTaskStatus,
      "居家任务已同步到账号云端，老师拉取班级同步后可查看。",
    );
  }

  function choosePlateActionPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setPlateActionPhotoStatus("请选择图片文件。");
      return;
    }

    if (file.size > 1_500_000) {
      setPlateActionPhotoStatus("图片有点大，请选择 1.5MB 以内的照片。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";

      if (!dataUrl.startsWith("data:image/")) {
        setPlateActionPhotoStatus("照片读取失败，请重新选择。");
        return;
      }

      setPlateActionPhoto({ name: file.name, dataUrl });
      setPlateActionPhotoStatus("照片已添加，提交后老师端可以查看。");
    };
    reader.onerror = () => setPlateActionPhotoStatus("照片读取失败，请重新选择。");
    reader.readAsDataURL(file);
  }

  function submitPlateAction() {
    if (!selectedChild) {
      setPlateActionStatus("请先完成家庭绑定，再提交家庭光盘行动。");
      return;
    }

    const note = plateActionNote.trim().slice(0, 180);
    const content = [
      `家庭光盘行动：${plateActionStep}`,
      note ? `家长观察：${note}` : "家长观察：孩子完成了一个进餐或餐后整理小步骤。",
    ].join("。");
    const record: ParentFeedbackRecord = {
      id: `plate-action-${Date.now()}-${selectedChild.id}`,
      childId: selectedChild.id,
      childName: selectedChild.name,
      category: "home-observation",
      content,
      createdAt: new Date().toISOString(),
      status: "new",
      ...(plateActionPhoto
        ? {
            attachmentName: plateActionPhoto.name,
            attachmentDataUrl: plateActionPhoto.dataUrl,
          }
        : {}),
    };

    setParentFeedbackRecords((current) => {
      const nextRecords = addParentFeedbackRecord(current, record);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
    setPlateActionNote("");
    setPlateActionPhoto(null);
    setPlateActionPhotoStatus("可选放一张餐后整理或尝试小步骤照片。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。");
    setFeedbackCategory("home-observation");
    setFeedbackStatus("家庭光盘行动已同步到教师工作台反馈列表。");
    setPlateActionStatus("已提交给老师。这里只记录个人成长小步骤，不做排名。");
    void syncParentFeedbackRecord(
      record,
      setPlateActionStatus,
      "家庭光盘行动已同步到账号云端，老师拉取班级同步后可查看。",
    );
  }

  function openParentDirectoryItem(item: SectionDirectoryItem) {
    setActiveParentPanel(getParentPanelFromHref(item.href));
  }

  if (!selectedChild) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <section className="mx-auto min-h-screen w-full max-w-4xl rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff6dd_48%,#e6fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8">
          <p className="text-sm font-semibold text-amber-700">班级试用模式</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            查看孩子成长记录
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            输入孩子姓名或号数和家庭绑定码，只查看自己孩子的老师建议与家庭任务。
          </p>

          <div id="parent-binding" className="mt-7 scroll-mt-24 rounded-[1.5rem] bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">家庭绑定</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={accountText}
                onChange={(event) => setAccountText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loginByAccount();
                  }
                }}
                placeholder="输入姓名或号数，如 小安 / 3号"
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white"
              />
              <input
                value={bindingCodeText}
                onChange={(event) => setBindingCodeText(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loginByAccount();
                  }
                }}
                placeholder="输入家庭绑定码，如 K7A3Q9"
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold tracking-[0.12em] text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white"
              />
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-[1.2rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
              <input
                checked={privacyConsent}
                onChange={(event) => setPrivacyConsent(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300"
                type="checkbox"
              />
              <span>我同意老师将孩子的成长记录用于本班家园共育反馈。</span>
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void loginByAccount()}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                进入家庭延续页
              </button>
              {childRoster.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  暂无幼儿身份，请联系老师添加花名册
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7 font-semibold text-amber-800">{status}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
      <section className="grid gap-6">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff6dd_48%,#e6fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8">
          <p className="text-sm font-semibold text-amber-700">班级试用模式</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            {selectedChild.name} 的家庭延续页
            <span className="block text-2xl text-slate-700 md:text-3xl">看老师建议，回家做一小步</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            先看老师今天观察到了什么，再完成一个小步骤并反馈一句观察。
          </p>
          <div className="mt-7 rounded-[1.5rem] bg-white/85 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-600">当前家庭绑定</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {formatChildLabel(selectedChild)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  家长端不显示班级汇总和其他幼儿姓名；照片/视频只在同意后用于本班反馈。
                </p>
                <p className="mt-2 max-w-2xl rounded-[1.1rem] bg-amber-50 px-3 py-2 text-xs leading-6 font-semibold text-amber-900">
                  当前为班级测试版，家长端跨设备账号同步仍在研究中。正式部署需接入统一账号、权限控制、加密数据库和数据删除机制。
                </p>
              </div>
              <button
                onClick={logoutParentAccess}
                className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
                type="button"
              >
                退出并重新绑定
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 font-semibold text-amber-800">{status}</p>
          </div>
        </div>

      </section>

      {activeParentPanel !== "home" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-white/82 px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            当前模板：{parentPanelLabels[activeParentPanel]}
          </p>
          <button
            onClick={() => setActiveParentPanel("home")}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            type="button"
          >
            返回家长首页
          </button>
        </div>
      ) : null}

      <section
        id="parent-suggestions"
        hidden={activeParentPanel !== "home" && activeParentPanel !== "parent-suggestions"}
        className="order-1 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f5fffe_0%,#ffffff_55%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">老师今天观察到什么</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">老师建议与家庭小步骤</h2>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {childParentSyncs.length} 条
          </span>
        </div>

        {parentTodayMenuText ? (
          <div className="mt-4 rounded-[1.5rem] bg-white/86 px-4 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-700">今日食谱参考</p>
                <p className="mt-1 text-sm leading-7 font-semibold text-slate-800">{parentTodayMenuText}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                {todayMenuEntries.some((entry) => "publishSource" in entry && entry.publishSource === "dailyOverride")
                  ? "含临时改餐"
                  : "每周食谱自动发布"}
              </span>
            </div>
            <p className="mt-3 rounded-[1rem] bg-emerald-50 px-3 py-2 text-xs leading-6 font-semibold text-emerald-900">
              今日食谱数据仅用于班级范围内食育观察和匿名化汇总，可为教师设计食育活动、家园任务和食堂后续菜谱安排提供参考，不作为自动配餐或医学判断依据。
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {childParentSyncs.length > 0 ? (
            childParentSyncs.map((record) => (
              <article key={record.id} className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-teal-700">{record.sourceLabel}</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">{record.title}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {formatParentSyncTime(record.syncedAt)}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">{record.summary}</p>
                <div className="mt-4 rounded-[1.3rem] bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-800">老师建议</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{record.strategy}</p>
                </div>
                <div className="mt-3 rounded-[1.3rem] bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900">回家可以这样做</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{record.homePractice}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-[1.8rem] bg-white/78 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-2">
              老师还没有给该幼儿同步反馈与家庭建议。请等待教师工作台确认后同步。
            </p>
          )}
        </div>
      </section>

      <section
        id="parent-reading"
        hidden={activeParentPanel !== "parent-reading"}
        className="order-3 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7f0ff_0%,#ffffff_54%,#eefdfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-violet-700">亲子阅读</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">教师确认发布的原创绘本</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              家长端只显示教师确认发布后的绘本，阅读打卡会回流教师端。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm">
            绘本 {childReadingBooks.length}
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-3">
            {childReadingBooks.length > 0 ? (
              childReadingBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => {
                    setSelectedReadingBookId(book.id);
                    setParentReadingStatus(`已选择《${book.title}》，共读后写一句观察即可打卡。`);
                  }}
                  className={`rounded-[1.5rem] px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
                    selectedReadingBook?.id === book.id
                      ? "bg-violet-100 ring-2 ring-violet-300"
                      : "bg-white/88 hover:bg-violet-50"
                  }`}
                  type="button"
                >
                  <p className="text-base font-semibold text-slate-900">{book.title}</p>
                  <p className="mt-2 text-xs font-semibold text-violet-800">
                    教师确认 · {formatParentSyncTime(book.publishedAt)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{book.storyText}</p>
                </button>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-white/78 px-4 py-5 text-sm leading-7 text-slate-600">
                老师还没有确认发布绘本。发布后这里会出现亲子共读入口。
              </p>
            )}
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            {selectedReadingBook ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-violet-700">当前绘本</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedReadingBook.title}</h3>
                  </div>
                  <button
                    onClick={() => toggleParentReadingVoice(selectedReadingBook)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      parentReadingVoiceBookId === selectedReadingBook.id
                        ? "bg-rose-100 text-rose-800"
                        : "bg-sky-100 text-sky-900"
                    }`}
                    type="button"
                  >
                    {parentReadingVoiceBookId === selectedReadingBook.id ? "正在听 · 停止" : "听一听"}
                  </button>
                </div>
                <p className="mt-3 max-h-40 overflow-y-auto rounded-[1.2rem] bg-violet-50 px-4 py-3 text-sm leading-7 text-slate-700">
                  {selectedReadingBook.storyText}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <p className="rounded-[1.1rem] bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                    问题：{selectedReadingBook.question}
                  </p>
                  <p className="rounded-[1.1rem] bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                    小任务：{selectedReadingBook.habitTask}
                  </p>
                </div>
                <textarea
                  value={parentReadingNote}
                  onChange={(event) => setParentReadingNote(event.target.value.slice(0, 180))}
                  placeholder="家长一句观察：孩子最喜欢哪一页？愿意做哪一个小动作？"
                  className="mt-4 min-h-24 w-full rounded-[1.3rem] border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-violet-900">{parentReadingStatus}</p>
                  <button
                    onClick={submitParentReading}
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    完成亲子阅读打卡
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-[1.4rem] bg-violet-50 px-4 py-5 text-sm leading-7 text-slate-600">
                选择一本绘本后，可以看到阅读后问题和小任务。
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        id="parent-home-task"
        hidden={activeParentPanel !== "parent-home-task"}
        className="order-4 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_54%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">AI 生成的居家小任务</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">今天回家接着轻轻做</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              优先根据老师确认后的同步建议生成。家长只选一个小步骤，记录孩子愿意认识、愿意靠近和愿意整理的过程。
            </p>
            <p className="mt-3 inline-flex rounded-full bg-white/85 px-4 py-2 text-xs font-semibold text-amber-900 shadow-sm">
              AI生成，教师确认后使用
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {aiHomeTaskCards.length} 类
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {aiHomeTaskCards.map((card) => {
            const isSelected = selectedHomeTask?.title === card.title;

            return (
            <button
              key={card.title}
              onClick={() => chooseHomeTask(card)}
              className={`rounded-[1.8rem] bg-white/88 p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${
                isSelected ? "ring-2 ring-amber-300" : ""
              }`}
              type="button"
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-amber-100 text-2xl">
                  {card.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {card.tasks.map((taskItem) => (
                  <span
                    key={taskItem}
                    className="rounded-full bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {taskItem}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold text-amber-700">
                {isSelected ? "正在记录这一项" : "点击选择"}
              </p>
            </button>
            );
          })}
        </div>
        {selectedHomeTask ? (
          <div className="mt-5 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-700">当前居家任务</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedHomeTask.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  今天只选一个小步骤。完成后写一句观察，教师工作台就能继续跟进。
                </p>
              </div>
              <button
                onClick={submitHomeTask}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                完成并反馈老师
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedHomeTask.tasks.map((taskItem) => (
                <button
                  key={taskItem}
                  onClick={() => {
                    setSelectedHomeTaskStep(taskItem);
                    setHomeTaskStatus(`已选择小步骤：“${taskItem}”。`);
                  }}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    effectiveHomeTaskStep === taskItem
                      ? "bg-amber-400 text-slate-950"
                      : "bg-slate-50 text-slate-700"
                  }`}
                  type="button"
                >
                  {taskItem}
                </button>
              ))}
            </div>

            <textarea
              value={homeTaskNote}
              onChange={(event) => setHomeTaskNote(event.target.value)}
              maxLength={180}
              placeholder="可以写一句：孩子今天愿意闻一闻香菇，或者听完故事能说出一个角色。"
              className="mt-4 min-h-24 w-full rounded-[1.3rem] border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-amber-300 focus:bg-white"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="rounded-[1.1rem] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {homeTaskStatus}
              </p>
              <span className="text-xs font-semibold text-slate-500">
                还可输入 {180 - homeTaskNote.length} 字
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <section
        hidden={activeParentPanel !== "parent-home-task"}
        className="order-5 rounded-[2.5rem] bg-[linear-gradient(135deg,#fff9ed_0%,#ffffff_54%,#f0fdf4_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">家庭光盘行动</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">只记录孩子的一小步</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              不是排行，也不是要求一次吃完。家长选择今天真实发生的一步，写一句观察，老师端会收到这条居家任务反馈。
            </p>
          </div>
          <button
            onClick={submitPlateAction}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            type="button"
          >
            提交光盘行动
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">选择今天完成的小步骤</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {familyPlateActionSteps.map((step) => (
                <button
                  key={step}
                  onClick={() => {
                    setPlateActionStep(step);
                    setPlateActionStatus(`已选择“${step}”，再写一句观察就可以提交。`);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    plateActionStep === step
                      ? "bg-emerald-500 text-white"
                      : "bg-emerald-50 text-emerald-900"
                  }`}
                  type="button"
                >
                  {step}
                </button>
              ))}
            </div>
            <textarea
              value={plateActionNote}
              onChange={(event) => setPlateActionNote(event.target.value)}
              maxLength={180}
              placeholder="家长一句观察：孩子今天愿意尝试一口青菜，餐后也帮忙把碗放好。"
              className="mt-4 min-h-24 w-full rounded-[1.3rem] border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-emerald-300 focus:bg-white"
            />
            <p className="mt-3 rounded-[1.2rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              {plateActionStatus}
            </p>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">可选照片</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{plateActionPhotoStatus}</p>
              </div>
              <label className="cursor-pointer rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:-translate-y-0.5">
                选择照片
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={choosePlateActionPhoto}
                  type="file"
                />
              </label>
            </div>
            {plateActionPhoto ? (
              <div className="mt-4 flex items-center gap-3">
                <div
                  aria-label="家庭光盘行动照片预览"
                  className="h-24 w-24 rounded-[1rem] bg-cover bg-center shadow-sm"
                  role="img"
                  style={{ backgroundImage: `url(${plateActionPhoto.dataUrl})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{plateActionPhoto.name}</p>
                  <button
                    className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                    onClick={() => {
                      setPlateActionPhoto(null);
                      setPlateActionPhotoStatus("可选放一张餐后整理或尝试小步骤照片。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。");
                    }}
                    type="button"
                  >
                    移除照片
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-[1.2rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                照片不是必须。平台当前只保留本机图片预览，不默认上传云端。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        id="parent-growth"
        hidden={activeParentPanel !== "home" && activeParentPanel !== "parent-growth"}
        className="order-2 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fff9_0%,#ffffff_52%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">最近变化记录</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">看见孩子的一小步</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              这里不是给孩子打分，只记录从愿意听、愿意选择，到能说出做法或靠近新食物的一点变化。
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
            {parentChangeLines.length || 0} 条
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {parentChangeLines.length > 0 ? (
            parentChangeLines.map((line) => (
              <p
                key={line}
                className="rounded-[1.4rem] bg-white/88 px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"
              >
                {line}
              </p>
            ))
          ) : (
            <p className="rounded-[1.4rem] bg-white/88 px-4 py-5 text-sm leading-7 text-slate-600 md:col-span-2">
              暂无变化记录。孩子完成儿童互动，或老师同步家庭任务后，这里会逐步出现变化线索。
            </p>
          )}
        </div>
      </section>

      <section
        id="parent-feedback"
        hidden={activeParentPanel !== "parent-feedback"}
        className="order-6 scroll-mt-24 rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-700">反馈给老师</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">提交一句家庭观察</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              这里提交后会汇总到教师工作台，老师可以结合幼儿互动记录继续跟进。
            </p>
            <p className="mt-3 max-w-2xl rounded-[1.1rem] bg-amber-50 px-4 py-3 text-xs leading-6 font-semibold text-amber-900">
              当前为班级测试版，家长端跨设备账号同步仍在研究中。正式部署需接入统一账号、权限控制、加密数据库和数据删除机制。
            </p>
          </div>
          <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
            已提交 {childParentFeedbacks.length} 条
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.8rem] bg-slate-50 p-5">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["question", "我有疑惑"],
                  ["idea", "我有想法"],
                  ["home-observation", "在家观察 / 居家任务反馈"],
                ] as Array<[ParentFeedbackCategory, string]>
              ).map(([category, label]) => (
                <button
                  key={category}
                  onClick={() => setFeedbackCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    feedbackCategory === category
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 shadow-sm"
                  }`}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              maxLength={320}
              placeholder="例如：孩子回家提到一种还在认识的美食，想知道可以怎么陪他找食材、说发现。"
              className="mt-4 min-h-32 w-full rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-rose-300"
            />
            <div className="mt-3 rounded-[1.2rem] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">家庭观察照片</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{feedbackPhotoStatus}</p>
                </div>
                <label className="cursor-pointer rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 transition hover:-translate-y-0.5">
                  选择照片
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={chooseFeedbackPhoto}
                    type="file"
                  />
                </label>
              </div>
              {feedbackPhoto ? (
                <div className="mt-3 flex items-center gap-3">
                  <div
                    aria-label="家庭观察照片预览"
                    className="h-20 w-20 rounded-[1rem] bg-cover bg-center"
                    role="img"
                    style={{ backgroundImage: `url(${feedbackPhoto.dataUrl})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {feedbackPhoto.name}
                    </p>
                    <button
                      className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                    onClick={() => {
                      setFeedbackPhoto(null);
                      setFeedbackPhotoStatus("可选放一张家庭观察照片。不上传幼儿正脸，不上传手机号、住址等敏感信息；建议使用昵称或编号。");
                    }}
                      type="button"
                    >
                      移除照片
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">
                还可输入 {320 - feedbackText.length} 字
              </span>
              <button
                onClick={submitParentFeedback}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                提交给老师
              </button>
            </div>
            <p className="mt-3 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold text-rose-800">
              {feedbackStatus}
            </p>
          </div>

          <div className="grid gap-3">
            {childParentFeedbacks.length > 0 ? (
              childParentFeedbacks.slice(0, 6).map((record) => (
                <article key={record.id} className="rounded-[1.5rem] bg-rose-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {getParentFeedbackCategoryLabel(record.category)}
                    </p>
                    <span className="text-xs font-semibold text-slate-500">
                      {formatRecordTime(record.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{record.content}</p>
                  {record.attachmentDataUrl ? (
                    <div
                      aria-label={record.attachmentName ?? "家庭观察照片"}
                      className="mt-3 h-24 w-24 rounded-[1rem] bg-cover bg-center shadow-sm"
                      role="img"
                      style={{ backgroundImage: `url(${record.attachmentDataUrl})` }}
                    />
                  ) : null}
                  {record.teacherReply || record.teacherGuidance ? (
                    <div className="mt-3 rounded-[1.2rem] bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold text-teal-700">
                        老师回复 · {formatRecordTime(record.teacherRepliedAt ?? record.createdAt)}
                      </p>
                      {record.teacherReply ? (
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {record.teacherReply}
                        </p>
                      ) : null}
                      {record.teacherGuidance ? (
                        <p className="mt-2 rounded-[1rem] bg-cyan-50 px-3 py-2 text-sm leading-7 text-slate-700">
                          育儿指导：{record.teacherGuidance}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-[1.2rem] bg-white/70 px-4 py-3 text-xs font-semibold text-slate-500">
                      老师还没有回复，稍后可回来查看。
                    </p>
                  )}
                </article>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-slate-50 px-4 py-6 text-sm leading-7 text-slate-500">
                还没有提交反馈。家长可以把疑惑、想法或在家观察写在这里。
              </p>
            )}
          </div>
        </div>
      </section>

        </div>
        <aside className="order-first lg:order-last lg:sticky lg:top-6 lg:w-[300px]">
          <SectionDirectory
            eyebrow="家长端目录"
            title="只看当前孩子"
            items={parentDirectoryItems}
            variant="sidebar"
            activeHref={activeParentPanel === "home" ? "#parent-suggestions" : `#${activeParentPanel}`}
            onItemClick={openParentDirectoryItem}
          />
        </aside>
      </div>
    </main>
  );
}
