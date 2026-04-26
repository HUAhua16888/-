"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { findChildIdentitySuggestions, formatChildLabel } from "@/lib/child-identity";
import {
  childRosterStorageKey,
  createEmptyGrowthArchive,
  getBadgeLevelSummary,
  growthArchiveStorageKey,
  parseChildRoster,
  parseGrowthArchive,
  selectedChildStorageKey,
  type BadgeRecord,
  type ChildProfile,
  type GrowthArchive,
  type MiniGameRecord,
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

type ParentPortalProps = {
  initialChildId?: string;
};

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

function getChildBadges(archive: GrowthArchive, child: ChildProfile | null) {
  return archive.badgeRecords.filter((record) =>
    child ? record.childId === child.id : false,
  );
}

function getUniqueBadgeCards(records: BadgeRecord[]) {
  const badgeMap = new Map<string, BadgeRecord>();

  for (const record of records) {
    const current = badgeMap.get(record.name);

    if (!current || new Date(record.earnedAt).getTime() > new Date(current.earnedAt).getTime()) {
      badgeMap.set(record.name, record);
    }
  }

  return Array.from(badgeMap.values()).sort(
    (left, right) => new Date(right.earnedAt).getTime() - new Date(left.earnedAt).getTime(),
  );
}

function getBadgeVisual(record: BadgeRecord) {
  const name = record.name;

  if (/洗手|清洁|泡泡|小手/.test(name)) {
    return {
      icon: "🫧",
      label: "清洁习惯",
      description: "能跟着步骤完成小手清洁。",
      tone: "bg-cyan-50 text-cyan-900",
      iconTone: "bg-cyan-100",
    };
  }

  if (/阅读|故事|小耳朵|书虫|图书/.test(name)) {
    return {
      icon: "📚",
      label: "阅读表达",
      description: "愿意听故事、说画面，并把图书放回原位。",
      tone: "bg-violet-50 text-violet-900",
      iconTone: "bg-violet-100",
    };
  }

  if (/安全|判断|交通|防火|如厕/.test(name)) {
    return {
      icon: "🛡️",
      label: "安全判断",
      description: "能看图说出正确做法。",
      tone: "bg-blue-50 text-blue-900",
      iconTone: "bg-blue-100",
    };
  }

  if (/排队|整理|习惯|路线|掌握|文明进餐|粮食|餐后/.test(name)) {
    return {
      icon: "🌟",
      label: "生活习惯",
      description: "能练习一日生活好习惯。",
      tone: "bg-emerald-50 text-emerald-900",
      iconTone: "bg-emerald-100",
    };
  }

  if (/饮食|闽食|餐|食|海蛎|紫菜|尝|观察/.test(name)) {
    return {
      icon: "🥣",
      label: "闽食探索",
      description: "愿意认识食材并尝试表达。",
      tone: "bg-amber-50 text-amber-900",
      iconTone: "bg-amber-100",
    };
  }

  return {
    icon: record.themeId === "food" ? "🥢" : "✨",
    label: record.themeId === "food" ? "食育成长" : "成长表现",
    description: "完成一次儿童互动任务。",
    tone: "bg-slate-50 text-slate-900",
    iconTone: "bg-white",
  };
}

function getMiniGameDisplayName(gameKey: MiniGameRecord["gameKey"]) {
  const labelMap: Record<MiniGameRecord["gameKey"], string> = {
    washSteps: "小手清洁任务",
    queue: "一日好习惯路线",
    habitJudge: "历史安全判断记录",
    readingCheckin: "阅读小书虫打卡",
    kindWords: "闽食三步练习",
    foodObserve: "泉州美食摊位寻宝",
    foodClue: "泉州美食线索寻宝",
    foodTrain: "闽食小列车",
    foodGuess: "美食猜猜乐",
    foodPreference: "美食认识观察卡",
    peerEncourage: "陪同伴认识新美食",
    mealTray: "午餐小餐盘",
    mealManners: "文明进餐操",
    habitTrafficLight: "好习惯红绿牌",
  };

  return labelMap[gameKey];
}

function buildMiniGameAnalysis(records: MiniGameRecord[]) {
  const habitCount = records.filter((record) => record.themeId === "habit").length;
  const foodCount = records.filter((record) => record.themeId === "food").length;
  const gameMap = new Map<
    MiniGameRecord["gameKey"],
    {
      gameKey: MiniGameRecord["gameKey"];
      themeId: MiniGameRecord["themeId"];
      count: number;
      latestAt: string;
      choices: Map<string, number>;
    }
  >();

  for (const record of records) {
    const current =
      gameMap.get(record.gameKey) ??
      {
        gameKey: record.gameKey,
        themeId: record.themeId,
        count: 0,
        latestAt: record.completedAt,
        choices: new Map<string, number>(),
      };

    current.count += 1;
    current.themeId = record.themeId;

    if (new Date(record.completedAt).getTime() > new Date(current.latestAt).getTime()) {
      current.latestAt = record.completedAt;
    }

    for (const item of record.pickedItems) {
      current.choices.set(item, (current.choices.get(item) ?? 0) + 1);
    }

    gameMap.set(record.gameKey, current);
  }

  const rows = Array.from(gameMap.values())
    .map((item) => ({
      gameKey: item.gameKey,
      themeId: item.themeId,
      name: getMiniGameDisplayName(item.gameKey),
      count: item.count,
      latestAt: item.latestAt,
      topChoices: Array.from(item.choices.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([label, count]) => `${label} ${count}次`),
    }))
    .sort((left, right) => right.count - left.count);

  const compareText =
    habitCount === foodCount
      ? "幼习宝和闽食成长岛参与比较均衡。"
      : habitCount > foodCount
        ? "幼习宝打卡更多，可继续补充泉州美食探索、找食材和说发现活动。"
        : "闽食成长岛打卡更多，可同步巩固洗手、整理、排队等生活习惯。";

  return {
    habitCount,
    foodCount,
    rows,
    compareText,
  };
}

function getChildMiniGames(archive: GrowthArchive, child: ChildProfile | null) {
  return archive.miniGameRecords.filter((record) =>
    child ? record.childId === child.id : false,
  );
}

function getChildFoodPreferences(archive: GrowthArchive, child: ChildProfile | null) {
  return archive.foodPreferenceRecords.filter((record) =>
    child ? record.childId === child.id : false,
  );
}

function getChildParentSyncs(records: ParentSyncRecord[], child: ChildProfile | null) {
  return records.filter((record) => (child ? record.childId === child.id : false));
}

function getChildParentFeedbacks(records: ParentFeedbackRecord[], child: ChildProfile | null) {
  return records.filter((record) => (child ? record.childId === child.id : false));
}

export function ParentPortal({ initialChildId }: ParentPortalProps) {
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(initialChildId ?? "");
  const [archive, setArchive] = useState<GrowthArchive>(() => createEmptyGrowthArchive());
  const [parentSyncRecords, setParentSyncRecords] = useState<ParentSyncRecord[]>([]);
  const [parentFeedbackRecords, setParentFeedbackRecords] = useState<ParentFeedbackRecord[]>([]);
  const [accountText, setAccountText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<ParentFeedbackCategory>("question");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("家长的疑惑、想法和在家观察会保存在这台设备上。");
  const [status, setStatus] = useState("请输入幼儿姓名或号数，查看对应成长记录。");
  const selectedChild = useMemo(
    () => childRoster.find((child) => child.id === selectedChildId) ?? null,
    [childRoster, selectedChildId],
  );
  const childBadges = useMemo(() => getChildBadges(archive, selectedChild), [archive, selectedChild]);
  const childMiniGames = useMemo(
    () => getChildMiniGames(archive, selectedChild),
    [archive, selectedChild],
  );
  const childFoodPreferences = useMemo(
    () => getChildFoodPreferences(archive, selectedChild),
    [archive, selectedChild],
  );
  const childParentSyncs = useMemo(
    () => getChildParentSyncs(parentSyncRecords, selectedChild),
    [parentSyncRecords, selectedChild],
  );
  const childParentFeedbacks = useMemo(
    () => getChildParentFeedbacks(parentFeedbackRecords, selectedChild),
    [parentFeedbackRecords, selectedChild],
  );
  const uniqueBadgeCards = useMemo(() => getUniqueBadgeCards(childBadges), [childBadges]);
  const uniqueBadgeCount = selectedChild ? uniqueBadgeCards.length : 0;
  const badgeLevel = useMemo(
    () => getBadgeLevelSummary(archive, selectedChild?.id),
    [archive, selectedChild],
  );
  const miniGameTotal = childMiniGames.length;
  const miniGameAnalysis = useMemo(() => buildMiniGameAnalysis(childMiniGames), [childMiniGames]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const restoreHandle = window.setTimeout(() => {
      const roster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));
      const routeChild = initialChildId ? decodeURIComponent(initialChildId) : "";
      const matched = routeChild ? roster.find((child) => child.id === routeChild) ?? null : null;

      setChildRoster(roster);
      setSelectedChildId(matched?.id ?? "");
      setArchive(parseGrowthArchive(window.localStorage.getItem(growthArchiveStorageKey)));
      setParentSyncRecords(parseParentSyncRecords(window.localStorage.getItem(parentSyncStorageKey)));
      setParentFeedbackRecords(
        parseParentFeedbackRecords(window.localStorage.getItem(parentFeedbackStorageKey)),
      );
      setStatus(
        matched
            ? `${formatChildLabel(matched)} 的成长记录已打开。`
            : roster.length > 0
              ? "请输入幼儿姓名或号数，查看对应成长记录。"
              : "还没有幼儿名单，请联系老师在教师辅助里添加花名册。",
      );
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [initialChildId]);

  function chooseChild(child: ChildProfile) {
    setSelectedChildId(child.id);
    setStatus(`${formatChildLabel(child)} 的成长记录已打开。`);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(selectedChildStorageKey, child.id);
    }
  }

  function loginByAccount() {
    const text = accountText.trim();

    if (!text) {
      setStatus("请先输入幼儿姓名或号数。");
      return;
    }

    const suggestions = findChildIdentitySuggestions(text, childRoster);

    if (suggestions.length === 0) {
      setStatus(`没有找到“${text}”对应的幼儿账号，请联系老师确认花名册。`);
      return;
    }

    chooseChild(suggestions[0]);
  }

  function submitParentFeedback() {
    if (!selectedChild) {
      setFeedbackStatus("请先登录幼儿账号，再提交给老师。");
      return;
    }

    const content = feedbackText.trim().slice(0, 320);

    if (!content) {
      setFeedbackStatus("请先写下家长的疑惑、想法或在家观察。");
      return;
    }

    const record: ParentFeedbackRecord = {
      id: `feedback-${Date.now()}-${selectedChild.id}`,
      childId: selectedChild.id,
      childName: selectedChild.name,
      category: feedbackCategory,
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
    setFeedbackText("");
    setFeedbackStatus("已保存到老师端反馈列表，老师查看后可以回复和给出家庭建议。");
  }

  if (!selectedChild) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
        <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff6dd_48%,#e6fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8">
          <p className="text-sm font-semibold text-amber-700">家长端</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            查看孩子成长记录
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            用幼儿姓名或号数进入。这里显示该幼儿在这台设备上的成长记录、老师建议和家长反馈。
          </p>

          <div className="mt-7 rounded-[1.5rem] bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">幼儿账号</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={accountText}
                onChange={(event) => setAccountText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    loginByAccount();
                  }
                }}
                placeholder="输入姓名或号数，如 小安 / 3号"
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white"
              />
              <button
                onClick={loginByAccount}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                登录查看
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 font-semibold text-amber-800">{status}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {childRoster.length > 0 ? (
                childRoster.map((child) => (
                  <Link
                    key={child.id}
                    href={`/parents/${encodeURIComponent(child.id)}`}
                    onClick={() => chooseChild(child)}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
                  >
                    {formatChildLabel(child)}
                  </Link>
                ))
              ) : (
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  暂无幼儿账号，请联系老师添加花名册
                </span>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff6dd_48%,#e6fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8">
          <p className="text-sm font-semibold text-amber-700">家长端</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            {selectedChild.name} 的成长记录
            <span className="block text-2xl text-slate-700 md:text-3xl">老师建议与家庭反馈</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            家长端只显示当前幼儿的信息。记录、反馈和回复保存在这台设备上，请定期与老师确认。
          </p>

          <div className="mt-7 rounded-[1.5rem] bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">幼儿账号</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={accountText}
                onChange={(event) => setAccountText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    loginByAccount();
                  }
                }}
                placeholder="输入姓名或号数，如 小安 / 3号"
                className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white"
              />
              <button
                onClick={loginByAccount}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                登录查看
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 font-semibold text-amber-800">{status}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {childRoster.length > 0 ? (
                childRoster.map((child) => (
                  <Link
                    key={child.id}
                    href={`/parents/${encodeURIComponent(child.id)}`}
                    onClick={() => chooseChild(child)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      selectedChild?.id === child.id
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatChildLabel(child)}
                  </Link>
                ))
              ) : (
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  暂无幼儿账号，请联系老师添加花名册
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan-700">家长版首页</p>
                <h2 className="mt-1 text-3xl font-semibold text-slate-900">
                  {selectedChild ? `${selectedChild.name} 的成长记录册` : "请选择幼儿账号"}
                </h2>
              </div>
              {selectedChild ? (
                <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
                  {formatChildLabel(selectedChild)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-cyan-50 p-4">
                <p className="text-xs font-semibold text-cyan-800">获得勋章</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{uniqueBadgeCount}</p>
              </div>
              <div className="rounded-[1.5rem] bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-800">游戏记录</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{miniGameTotal}</p>
              </div>
              <div className="rounded-[1.5rem] bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-800">老师同步</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{childParentSyncs.length}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.8rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_58%,#e6fbfa_100%)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-700">奖章升级</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-900">{badgeLevel.level}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{badgeLevel.description}</p>
                </div>
                <div className="rounded-[1.4rem] bg-white/85 px-5 py-4 text-center shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">距离下一等级</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {badgeLevel.remainingToNext > 0 ? `${badgeLevel.remainingToNext} 枚` : "已达成"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {badgeLevel.latestBadges.length > 0 ? (
                  badgeLevel.latestBadges.map((badge) => (
                    <span
                      key={`${badge.name}-${badge.earnedAt}`}
                      className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                    >
                      {badge.name}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm">
                    完成一个小任务，就会开始点亮奖章。
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-[1.8rem] bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">已获得勋章</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {uniqueBadgeCards.length > 0 ? (
                  uniqueBadgeCards.slice(0, 12).map((badge) => {
                    const visual = getBadgeVisual(badge);

                    return (
                    <article
                      key={`${badge.earnedAt}-${badge.name}`}
                      className={`flex items-center gap-3 rounded-[1.4rem] px-4 py-3 shadow-sm ${visual.tone}`}
                    >
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] text-3xl ${visual.iconTone}`}
                        aria-hidden="true"
                      >
                        {visual.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold opacity-75">{visual.label}</p>
                        <h3 className="mt-1 text-base font-semibold">{badge.name}</h3>
                        <p className="mt-1 text-xs leading-5 opacity-80">{visual.description}</p>
                      </div>
                    </article>
                    );
                  })
                ) : (
                  <span className="text-sm leading-7 text-slate-500">
                    暂无绑定到该幼儿账号的勋章记录。
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#f5fffe_0%,#ffffff_55%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">老师同步给家长</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">老师反馈与家庭建议</h2>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {childParentSyncs.length} 条
          </span>
        </div>

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
              老师还没有给该幼儿同步反馈与家庭建议。请等待老师端确认后同步。
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_54%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">居家延续任务</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">回家可以轻轻做</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              这些任务不要求一次全部完成。家长只选一个小步骤，记录孩子愿意认识、愿意靠近和愿意整理的过程。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            {parentHomeTaskCards.length} 类
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {parentHomeTaskCards.map((card) => (
            <article key={card.title} className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
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
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">游戏打卡汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">分析与对比情况</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              汇总当前幼儿在两个主题里的打卡次数、常见选择和最近完成时间，方便家长看见孩子在哪些方面练得更多。
            </p>
          </div>
          <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
            共 {miniGameTotal} 次
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[1.8rem] bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-700">主题对比</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[1.3rem] bg-cyan-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-cyan-900">幼习宝</span>
                  <span className="text-xl font-semibold text-slate-950">
                    {miniGameAnalysis.habitCount}
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-cyan-300"
                    style={{
                      width:
                        miniGameTotal > 0
                          ? `${Math.max(10, (miniGameAnalysis.habitCount / miniGameTotal) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
              <div className="rounded-[1.3rem] bg-amber-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-amber-900">闽食成长岛</span>
                  <span className="text-xl font-semibold text-slate-950">
                    {miniGameAnalysis.foodCount}
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-amber-300"
                    style={{
                      width:
                        miniGameTotal > 0
                          ? `${Math.max(10, (miniGameAnalysis.foodCount / miniGameTotal) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-4 rounded-[1.2rem] bg-white px-4 py-3 text-sm leading-7 text-slate-700">
              {miniGameTotal > 0
                ? miniGameAnalysis.compareText
                : "暂无打卡数据，完成儿童互动后这里会自动形成对比。"}
            </p>
          </div>

          <div className="rounded-[1.8rem] bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-700">项目汇总</p>
            <div className="mt-4 grid gap-3">
              {miniGameAnalysis.rows.length > 0 ? (
                miniGameAnalysis.rows.slice(0, 6).map((row) => (
                  <article key={row.gameKey} className="rounded-[1.3rem] bg-white px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {row.themeId === "habit" ? "幼习宝" : "闽食成长岛"} · 最近{" "}
                          {formatRecordTime(row.latestAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        {row.count} 次
                      </span>
                    </div>
                    {row.topChoices.length > 0 ? (
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        高频选择：{row.topChoices.join("、")}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="rounded-[1.3rem] bg-white px-4 py-5 text-sm leading-7 text-slate-500">
                  暂无绑定到该幼儿账号的游戏打卡记录。
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-700">家长反馈给老师</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">疑惑与想法</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              这里提交后会汇总给老师，方便老师结合幼儿互动记录继续跟进。
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
                  ["home-observation", "在家观察"],
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

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-cyan-700">小游戏记录</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">互动情况</h2>
          <div className="mt-5 grid gap-3">
            {childMiniGames.length > 0 ? (
              childMiniGames.slice(0, 8).map((record) => (
                <div
                  key={`${record.completedAt}-${record.gameKey}`}
                  className="rounded-[1.5rem] bg-slate-50 px-4 py-3"
                >
                  <p className="font-semibold text-slate-900">{record.badgeName}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {record.themeId === "habit" ? "幼习宝" : "闽食成长岛"} ·{" "}
                    {formatRecordTime(record.completedAt)}
                  </p>
                  {record.pickedItems.length > 0 ? (
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      记录：{record.pickedItems.join("、")}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                暂无绑定到该幼儿账号的小游戏记录。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-orange-700">闽食观察</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">美食认识记录</h2>
          <div className="mt-5 grid gap-3">
            {childFoodPreferences.length > 0 ? (
              childFoodPreferences.slice(0, 6).map((record) => (
                <div
                  key={`${record.recordedAt}-${record.foodLabel}`}
                  className="rounded-[1.5rem] bg-orange-50 px-4 py-3"
                >
                  <p className="font-semibold text-slate-900">{record.foodLabel}</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">
                    原因：{record.reasonLabel}。{record.gentleTryTip}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                暂无绑定到该幼儿账号的美食认识观察。
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
