"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { SectionDirectory, type SectionDirectoryItem } from "@/components/section-directory";
import { getAccountSyncDeviceInfo } from "@/lib/account-sync-client";
import { formatChildLabel } from "@/lib/child-identity";
import { buildFoodNutritionIntro } from "@/lib/food-nutrition";
import { gameContentConfigStorageKey } from "@/lib/game-content-config";
import {
  childRosterStorageKey,
  createEmptyGrowthArchive,
  growthArchiveStorageKey,
  parseChildRoster,
  parseGrowthArchive,
  selectedChildStorageKey,
  type ChildProfile,
  type FoodPreferenceRecord,
  type GrowthArchive,
  type MiniGameRecord,
} from "@/lib/growth-archive";
import {
  buildParentSyncFromFoodPreference,
  buildParentSyncFromMiniGame,
  formatParentSyncTime,
  getFoodPreferenceFollowUp,
  getMiniGameFollowUp,
  getParentFeedbackCategoryLabel,
  parentFeedbackStorageKey,
  parentSyncStorageKey,
  parseParentFeedbackRecords,
  parseParentSyncRecords,
  type ParentFeedbackRecord,
  type ParentSyncRecord,
} from "@/lib/parent-sync";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  buildHabitTemplateFromFocus,
  buildTeacherPictureBook,
  habitTemplatesStorageKey,
  parseHabitTemplates,
  parseTeacherPictureBooks,
  teacherPictureBooksStorageKey,
  type HabitCheckinTemplate,
  type TeacherPictureBook,
} from "@/lib/teacher-published-content";
import {
  dailyMenuOverrideStorageKey,
  formatMenuDate,
  getEffectiveMenuForDate,
  getLocalDateKey,
  getWeekdayLabel,
  mealTypeOptions,
  parseDailyMenuOverrides,
  parseWeeklyMenuEntries,
  serializeDailyMenuOverrides,
  serializeWeeklyMenuEntries,
  splitMenuText,
  weeklyMenuStorageKey,
  type DailyMenuOverrideEntry,
  type MealType,
  type MenuMediaSource,
  type MenuObservationImage,
  type WeeklyMenuEntry,
} from "@/lib/weekly-menu";
import {
  teacherTasks,
  themes,
  type ThemeId,
} from "@/lib/site-data";

type TeacherResponse = {
  title: string;
  content: string;
  tips: string[];
  error?: string;
  fallbackUsed?: boolean;
  needsReview?: boolean;
};

type SavedTeacherResult = TeacherResponse & {
  id: string;
  themeId: ThemeId;
  task: string;
  scenario: string;
  savedAt: string;
  pinned?: boolean;
};

type MenuMediaDraft = {
  videoName: string;
  videoUrl: string;
  candidates: MenuObservationImage[];
  selectedIds: string[];
  coverId: string;
  confirmedImages: MenuObservationImage[];
  confirmedCoverUrl: string;
  confirmedAt: string;
  status: string;
};

const teacherScenarioMaxLength = 680;
const teacherHistoryLimit = 6;
const teacherAccountStorageKey = "tongqu-growth-web-teacher-account";
const teacherPasscodeStorageKey = "tongqu-growth-web-teacher-passcode";
const teacherSessionStorageKey = "tongqu-growth-web-teacher-session";
const teacherSharedSessionStorageKey = "tongqu-growth-web-teacher-shared-session";
const menuMediaByDateMealStorageKey = "tongqu-growth-web-menu-media-by-date-meal";
const trialTeacherAccount = "班级试用教师";
const trialTeacherPasscode = "1234";
const menuFocusIngredientSuggestions = ["香菇", "小葱", "蒜", "青菜", "芥菜", "海蛎", "紫菜", "蛏子"];
const classroomPlanRequirement =
  "请依据《3-6岁儿童学习与发展指南》和《幼儿园教育指导纲要》生成一节幼儿园活动方案，语言童趣温柔、正向不贴标签，结构包含活动名称、适用年龄、活动时长、活动目标、准备材料、活动流程、儿歌/口令、教师引导语、观察要点、家园延伸和注意事项。";
const teacherAgeOptions = [
  {
    label: "小班3-4岁",
    focus: "参考《指南》和《纲要》，集中活动建议 10-15 分钟，以模仿、感知、短句回应和动作游戏为主。",
  },
  {
    label: "中班4-5岁",
    focus: "参考《指南》和《纲要》，集中活动建议 15-20 分钟，加入观察、表达、简单排序、比较和初步合作。",
  },
  {
    label: "大班5-6岁",
    focus: "参考《指南》和《纲要》，集中活动建议 20-30 分钟，加入讨论、简单记录、分享、规则意识和迁移表达。",
  },
] as const;
const defaultTeacherAgeGroup = teacherAgeOptions[1].label;
const defaultTeacherTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
type TeacherTaskItem = (typeof teacherTasks)[number];

type ParentFeedbackDraft = {
  reply: string;
  guidance: string;
};

const menuMealTypeKeyMap: Record<MealType, string> = {
  早餐: "breakfast",
  午餐: "lunch",
  点心: "snack",
  晚餐: "dinner",
};

function normalizeMenuMediaDishKey(dishName: string) {
  return (dishName.trim() || "unknown-dish").replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]+/g, "-").slice(0, 28);
}

function createLegacyMenuDateMealKey(date: string, mealType: MealType) {
  return `${date || getLocalDateKey()}_${menuMealTypeKeyMap[mealType] ?? mealType}`;
}

function createMenuDateMealKey(date: string, mealType: MealType, dishName = "") {
  return `${createLegacyMenuDateMealKey(date, mealType)}_${normalizeMenuMediaDishKey(dishName)}`;
}

function createEmptyMenuMediaDraft(status = "还没有观察图片，可以上传视频、上传图片，或让 AI 补一张图。"): MenuMediaDraft {
  return {
    videoName: "",
    videoUrl: "",
    candidates: [],
    selectedIds: [],
    coverId: "",
    confirmedImages: [],
    confirmedCoverUrl: "",
    confirmedAt: "",
    status,
  };
}

const emptyMenuMediaDraft: MenuMediaDraft = createEmptyMenuMediaDraft();

function createMenuMediaId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildMenuMediaPrompt(dishName: string, ingredients: string[]) {
  const dish = dishName.trim() || "今日食谱";
  const ingredientText = ingredients.length > 0 ? ingredients.join("、") : "今日主要食材";

  return [
    "幼儿园食育材料图",
    `具体菜品：${dish}`,
    `具体食材：${ingredientText}`,
    "可识别食材，干净背景，绘本风但食材真实清楚",
    "不出现幼儿正脸，不加文字水印，适合3-6岁幼儿观察",
  ].join("，");
}

function buildConfirmedMenuMediaFields(draft: MenuMediaDraft) {
  const confirmedImages = draft.confirmedImages
    .filter((image) => image.teacherConfirmed)
    .slice(0, 6);
  const coverImageUrl = draft.confirmedCoverUrl || confirmedImages[0]?.url || "";
  const coverSource = confirmedImages.find((image) => image.url === coverImageUrl)?.mediaSource;

  return {
    videoUrl: draft.videoUrl && !draft.videoUrl.startsWith("blob:") ? draft.videoUrl : undefined,
    coverImageUrl: coverImageUrl || undefined,
    observationImages: confirmedImages,
    mediaSource: coverSource,
    teacherConfirmed: confirmedImages.length > 0,
  };
}

function getMenuMediaSourceText(source?: MenuMediaSource) {
  if (source === "video_frame") {
    return "今天视频里的图";
  }

  if (source === "teacher_uploaded") {
    return "教师确认图片";
  }

  if (source === "ai_generated") {
    return "AI生成，教师确认后使用";
  }

  return "观察图片";
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("视频定位失败，请换一个清晰视频或上传观察图片。"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = time;
  });
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }

    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("视频读取失败，请确认文件可以正常播放。"));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadedmetadata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

async function extractMenuObservationFrames(
  file: File,
  dishName: string,
  ingredients: string[],
) {
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.load();
  await waitForVideoMetadata(video);

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const ratios = [0.18, 0.34, 0.5, 0.66, 0.82, 0.94];
  const canvas = document.createElement("canvas");
  const width = Math.min(720, video.videoWidth || 720);
  const height = Math.max(1, Math.round(width * ((video.videoHeight || 405) / (video.videoWidth || 720))));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器不能抽取视频帧，请手动上传观察图片。");
  }

  const createdAt = new Date().toISOString();
  const labelBase = dishName.trim() || "今日食谱视频帧";
  const ingredientText = ingredients.length > 0 ? ` · ${ingredients.slice(0, 3).join("、")}` : "";
  const frames: MenuObservationImage[] = [];

  for (const [index, ratio] of ratios.entries()) {
    const targetTime = Math.min(Math.max(0, duration * ratio), Math.max(0, duration - 0.08));
    await seekVideo(video, targetTime);
    context.drawImage(video, 0, 0, width, height);
    frames.push({
      id: createMenuMediaId(`video-frame-${index + 1}`),
      url: canvas.toDataURL("image/jpeg", 0.82),
      label: `${labelBase}观察图 ${index + 1}${ingredientText}`,
      mediaSource: "video_frame",
      sourceType: "video_frame",
      teacherConfirmed: false,
      createdAt,
      sourceVideoName: file.name,
    });
  }

  return { videoUrl, frames };
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("图片读取失败，请重新选择。"));
    };
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.readAsDataURL(file);
  });
}

type MenuMediaDraftPanelProps = {
  title: string;
  description: string;
  draft: MenuMediaDraft;
  date: string;
  mealType: MealType;
  dishName: string;
  ingredientsText: string;
  isAiGenerating: boolean;
  onVideoUpload: (file?: File) => void;
  onManualImageUpload: (file?: File) => void;
  onGenerateAiImage: () => void;
  onRegenerateAiImage: (imageId: string) => void;
  onUpdateAiPrompt: (imageId: string, prompt: string) => void;
  onUseImage: (imageId: string) => void;
  onDeleteImage: (imageId: string) => void;
  onToggleImage: (imageId: string) => void;
  onSetCover: (imageId: string) => void;
  onConfirm: () => void;
  onClear: () => void;
};

function MenuMediaDraftPanel({
  title,
  description,
  draft,
  date,
  mealType,
  dishName,
  ingredientsText,
  isAiGenerating,
  onVideoUpload,
  onManualImageUpload,
  onGenerateAiImage,
  onRegenerateAiImage,
  onUpdateAiPrompt,
  onUseImage,
  onDeleteImage,
  onToggleImage,
  onSetCover,
  onConfirm,
  onClear,
}: MenuMediaDraftPanelProps) {
  const selectedCount = draft.selectedIds.length;
  const confirmedCount = draft.confirmedImages.length;
  const hasCandidates = draft.candidates.length > 0;
  const handleUnifiedMediaUpload = (file?: File) => {
    if (!file) {
      return;
    }

    if (file.type.startsWith("video/")) {
      onVideoUpload(file);
      return;
    }

    onManualImageUpload(file);
  };

  return (
    <div className="mt-4 rounded-[1.5rem] bg-cyan-50/80 p-4" data-menu-media-panel="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-900">{title}</p>
          <p className="mt-1 text-xs leading-6 text-cyan-800">{description}</p>
          <p className="mt-1 text-xs font-semibold text-cyan-900">
            当前餐次：{formatMenuDate(date)} · {getWeekdayLabel(date)} · {mealType}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900 shadow-sm">
          教师确认后发布
        </span>
      </div>
      <div className="mt-3 rounded-[1.25rem] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
            今日观察图片 / 视频
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              一个入口上传图片或视频；视频会自动抽取 3-6 张观察图。
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => handleUnifiedMediaUpload(event.target.files?.[0])}
              className="mt-2 w-full text-xs text-slate-600"
            />
          </label>
          <button
            onClick={onGenerateAiImage}
            disabled={isAiGenerating}
            className="rounded-full bg-cyan-100 px-4 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5 disabled:opacity-60"
            type="button"
            title="没有真实图片时再使用，需教师确认。"
          >
            {isAiGenerating ? "AI补图中..." : "没有真实图时用 AI 补一张"}
          </button>
        </div>
        <p className="mt-3 rounded-[1rem] bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-900">
          AI 补图只作备用，必须标记“AI生成，教师确认后使用”。
        </p>
      </div>
      <p className="mt-3 rounded-[1rem] bg-white/85 px-3 py-2 text-xs leading-6 font-semibold text-cyan-900">
        {hasCandidates ? draft.status : "还没有观察图片，可以上传视频、上传图片，或让 AI 补一张图。"}
      </p>
      <p className="mt-2 rounded-[1rem] bg-white/70 px-3 py-2 text-[11px] leading-5 text-cyan-800">
        抽帧图片会先保存为本地预览；接入统一存储后再保存正式视频和图片地址。
      </p>
      {draft.videoName ? (
        <p className="mt-2 text-xs font-semibold text-slate-500">
          当前视频：{draft.videoName}；菜品：{dishName || "未填写"}；食材：{ingredientsText || "未填写"}
        </p>
      ) : null}
      {hasCandidates ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {draft.candidates.map((image) => {
            const selected = draft.selectedIds.includes(image.id);
            const cover = draft.coverId === image.id;
            const isAiImage = image.mediaSource === "ai_generated";
            const aiPromptValue =
              image.aiPrompt ||
              buildMenuMediaPrompt(
                dishName,
                ingredientsText
                  .split(/[、,，]/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              );

            return (
              <article
                key={image.id}
                className={`overflow-hidden rounded-[1.2rem] bg-white shadow-sm ring-2 ${
                  cover ? "ring-cyan-500" : selected ? "ring-emerald-300" : "ring-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.label} className="h-32 w-full object-cover" />
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-semibold text-slate-800">{image.label}</p>
                  {isAiImage ? (
                    <p className="mt-1 text-xs font-semibold text-amber-900">
                      {dishName || "今日食谱"} · {mealType}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => onToggleImage(image.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        selected ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                      type="button"
                    >
                      {selected ? "已选观察图" : "选为观察图"}
                    </button>
                    <button
                      onClick={() => onSetCover(image.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        cover ? "bg-cyan-700 text-white" : "bg-cyan-50 text-cyan-900"
                      }`}
                      type="button"
                    >
                      {cover ? "主图" : "设为主图"}
                    </button>
                  </div>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                      isAiImage ? "bg-amber-100 text-amber-900" : "bg-cyan-50 text-cyan-900"
                    }`}
                  >
                    {isAiImage ? "AI生成，教师确认后使用" : image.mediaSource === "video_frame" ? "今天视频里的图" : "教师确认图片"}
                  </span>
                  {isAiImage ? (
                    <div className="mt-3 rounded-[1rem] bg-amber-50 p-3">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-amber-900">当前生成描述</span>
                        <span className="mt-1 block text-xs font-semibold text-slate-800">修改图片描述</span>
                        <textarea
                          value={aiPromptValue}
                          onChange={(event) => onUpdateAiPrompt(image.id, event.target.value.slice(0, 260))}
                          className="mt-2 min-h-24 w-full rounded-[0.9rem] border border-amber-100 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-amber-300"
                          placeholder="请画一份真实幼儿园午餐，包含炒米粉、鸽子汤，颜色自然，餐盘干净。"
                        />
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => onRegenerateAiImage(image.id)}
                          className="rounded-full bg-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:-translate-y-0.5"
                          type="button"
                        >
                          重新生成
                        </button>
                        <button
                          onClick={() => onUseImage(image.id)}
                          className="rounded-full bg-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:-translate-y-0.5"
                          type="button"
                        >
                          使用这张
                        </button>
                        <button
                          onClick={() => onDeleteImage(image.id)}
                          className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:-translate-y-0.5"
                          type="button"
                        >
                          删除这张
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0}
          className="rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
        >
          确认观察图片发布
        </button>
        <button
          onClick={onClear}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
          type="button"
        >
          清空当前餐次素材
        </button>
        <span className="text-xs font-semibold text-slate-500">
          已选 {selectedCount} 张；已确认 {confirmedCount} 张。确认后儿童端才可见。
        </span>
      </div>
    </div>
  );
}

type TeacherAuthSnapshot = {
  account: string;
  passcode: string;
  sessionAccount: string;
  hasCompleteAccount: boolean;
  hasPartialAccount: boolean;
};

function readTeacherSharedSessionAccount(rawValue: string | null) {
  if (!rawValue) {
    return "";
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (typeof parsed === "string") {
      return parsed.trim();
    }

    if (parsed && typeof parsed === "object" && typeof (parsed as { account?: unknown }).account === "string") {
      return (parsed as { account: string }).account.trim();
    }
  } catch {
    return rawValue.trim();
  }

  return rawValue.trim();
}

function readTeacherAuthSnapshot(): TeacherAuthSnapshot {
  const account = (window.localStorage.getItem(teacherAccountStorageKey) ?? "").trim();
  const passcode = (window.localStorage.getItem(teacherPasscodeStorageKey) ?? "").trim();
  const tabSession = (window.sessionStorage.getItem(teacherSessionStorageKey) ?? "").trim();
  const sharedSession = readTeacherSharedSessionAccount(
    window.localStorage.getItem(teacherSharedSessionStorageKey),
  );
  const sessionAccount = sharedSession || tabSession;

  return {
    account,
    passcode,
    sessionAccount,
    hasCompleteAccount: Boolean(account && passcode),
    hasPartialAccount: Boolean((account && !passcode) || (!account && passcode)),
  };
}

function persistTeacherSession(account: string) {
  window.sessionStorage.setItem(teacherSessionStorageKey, account);
  window.localStorage.setItem(
    teacherSharedSessionStorageKey,
    JSON.stringify({
      account,
      authenticatedAt: new Date().toISOString(),
    }),
  );
}

function clearTeacherSession() {
  window.sessionStorage.removeItem(teacherSessionStorageKey);
  window.localStorage.removeItem(teacherSharedSessionStorageKey);
}

function buildWeeklyMenuNutritionPreview(entry: Pick<WeeklyMenuEntry, "dishName" | "ingredients" | "focusIngredients">) {
  const nutritionBase =
    entry.focusIngredients.length > 0 ? entry.focusIngredients : entry.ingredients;
  const nutritionText = buildFoodNutritionIntro(entry.dishName, nutritionBase);
  const optionText = Array.from(new Set([entry.dishName, ...entry.focusIngredients, ...entry.ingredients]))
    .filter(Boolean)
    .slice(0, 6)
    .join("、");

  return `${nutritionText}观察卡会优先出现：${optionText || entry.dishName}。`;
}

const aiDraftReviewNotice = "AI生成建议，需教师修改确认后使用";
const aiConfirmedUseNotice = "AI生成，教师确认后使用";
const aiReviewRecordsStorageKey = "tongqu-growth-web-ai-content-review";
const aiReviewContentTypes = ["闽食介绍", "儿歌", "故事", "家园任务", "成长评语"] as const;
const aiReviewStatusOptions = ["待审核", "已通过", "需修改"] as const;

type AiReviewContentType = (typeof aiReviewContentTypes)[number];
type AiReviewStatus = (typeof aiReviewStatusOptions)[number];

type AiReviewRecord = {
  id: string;
  contentType: AiReviewContentType;
  aiContent: string;
  status: AiReviewStatus;
  teacherNote: string;
  updatedAt: string;
};

function parseAiReviewRecords(raw: string | null): AiReviewRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is AiReviewRecord => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const record = item as Partial<AiReviewRecord>;

        return (
          typeof record.id === "string" &&
          aiReviewContentTypes.includes(record.contentType as AiReviewContentType) &&
          typeof record.aiContent === "string" &&
          aiReviewStatusOptions.includes(record.status as AiReviewStatus) &&
          typeof record.teacherNote === "string" &&
          typeof record.updatedAt === "string"
        );
      })
      .slice(0, 30);
  } catch {
    return [];
  }
}

const teacherDirectoryItems: SectionDirectoryItem[] = [
  {
    label: "AI 数据",
    description: "今日概览和建议。",
    href: "#teacher-ai-summary",
    icon: "📊",
    tone: "bg-teal-50 text-teal-950",
  },
  {
    label: "AI建议",
    description: "修改确认后使用。",
    href: "#teacher-ai-generate",
    icon: "🪄",
    tone: "bg-amber-50 text-amber-950",
  },
  {
    label: "AI审核",
    description: "内容先审再用。",
    href: "#teacher-ai-review",
    icon: "✅",
    tone: "bg-lime-50 text-lime-950",
  },
  {
    label: "重点幼儿",
    description: "一个幼儿一个窗口。",
    href: "#teacher-child-windows",
    icon: "🧒",
    tone: "bg-cyan-50 text-cyan-950",
  },
  {
    label: "今日食谱",
    description: "按日期自动生效。",
    href: "#teacher-weekly-menu",
    icon: "🍱",
    tone: "bg-amber-50 text-amber-950",
  },
  {
    label: "幼儿想法",
    description: "表达汇总和发布。",
    href: "#teacher-published-content",
    icon: "🗣️",
    tone: "bg-violet-50 text-violet-950",
  },
  {
    label: "家长反馈",
    description: "回复和同步。",
    href: "#teacher-parent-feedback",
    icon: "💬",
    tone: "bg-rose-50 text-rose-950",
  },
  {
    label: "基础设置",
    description: "花名册和同步。",
    href: "#teacher-settings",
    icon: "⚙",
    tone: "bg-slate-50 text-slate-800",
  },
  {
    label: "数据导出",
    description: "Excel / CSV / JSON。",
    href: "#teacher-data-export",
    icon: "📤",
    tone: "bg-indigo-50 text-indigo-950",
  },
];

type TeacherPanelKey =
  | "home"
  | "teacher-ai-generate"
  | "teacher-ai-review"
  | "teacher-child-windows"
  | "teacher-weekly-menu"
  | "teacher-published-content"
  | "teacher-parent-feedback"
  | "teacher-settings"
  | "teacher-data-export";

const teacherPanelLabels: Record<TeacherPanelKey, string> = {
  home: "AI观察数据",
  "teacher-ai-generate": "AI建议修改与确认",
  "teacher-ai-review": "AI内容审核",
  "teacher-child-windows": "重点幼儿",
  "teacher-weekly-menu": "今日食谱",
  "teacher-published-content": "幼儿想法汇总",
  "teacher-parent-feedback": "家长反馈",
  "teacher-settings": "基础设置",
  "teacher-data-export": "数据导出",
};

function getTeacherPanelFromHref(href: string): TeacherPanelKey {
  const panel = href.replace(/^#/, "") as TeacherPanelKey;

  return panel in teacherPanelLabels ? panel : "home";
}

function generateFamilyBindingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function isActivityPlanTask(task: string) {
  return /活动课程方案|课堂活动方案|课堂活动/.test(task);
}

function resolveTeacherAgeGroup(text: string) {
  if (/小班|3\s*-\s*4|3-4|3 至 4|3到4/.test(text)) {
    return teacherAgeOptions[0].label;
  }

  if (/大班|5\s*-\s*6|5-6|5 至 6|5到6/.test(text)) {
    return teacherAgeOptions[2].label;
  }

  return defaultTeacherAgeGroup;
}

function getTeacherAgeFocus(ageGroup: string) {
  return teacherAgeOptions.find((item) => item.label === ageGroup)?.focus ?? teacherAgeOptions[1].focus;
}

function getTeacherActivityDuration(ageGroup: string) {
  if (ageGroup.includes("小班")) {
    return "10-15 分钟";
  }

  if (ageGroup.includes("大班")) {
    return "20-30 分钟";
  }

  return "15-20 分钟";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTeacherPayload(payload: unknown): TeacherResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  const tips = Array.isArray(payload.tips)
    ? payload.tips
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const error = typeof payload.error === "string" ? payload.error.trim() : "";

  if (!title || !content || tips.length === 0) {
    return null;
  }

  return {
    title,
    content,
    tips,
    ...(error ? { error } : {}),
  };
}

function polishTeacherVisibleText(text: string, maxLength = 220) {
  const typoFixed = text
    .replace(/幼儿端模板/g, "幼儿活动")
    .replace(/生成草稿/g, "整理建议")
    .replace(/数据分析/g, "观察整理")
    .replace(/挑食严重/g, "还在认识这种食物")
    .replace(/表现差|落后/g, "还需要温和支持")
    .replace(/错误多/g, "可以再试一小步")
    .replace(/\s+/g, " ")
    .replace(/([。！？])\1+/g, "$1")
    .replace(/[,，]\s*/g, "，")
    .trim();

  if (typoFixed.length <= maxLength) {
    return typoFixed;
  }

  const shortSentences = typoFixed
    .split(/(?<=[。！？!?])/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result: string[] = [];
  let totalLength = 0;

  for (const sentence of shortSentences) {
    if (totalLength + sentence.length > maxLength) {
      break;
    }

    result.push(sentence);
    totalLength += sentence.length;
  }

  return result.join("") || `${typoFixed.slice(0, maxLength - 1)}。`;
}

function reviewTeacherResponseDraft(payload: TeacherResponse): TeacherResponse {
  return {
    ...payload,
    title: polishTeacherVisibleText(payload.title, 36),
    content: polishTeacherVisibleText(payload.content, 220),
    tips: payload.tips.map((tip) => polishTeacherVisibleText(tip, 72)).slice(0, 3),
    needsReview: payload.needsReview,
  };
}

function buildTeacherClientFallback(task: string, userInput = ""): TeacherResponse {
  const target = `${task} ${userInput}`;
  const isActivity = /活动|课程|方案|流程|目标|材料|观察|延伸/.test(target);
  const isStory = /故事|绘本|角色|情境|讲/.test(target);
  const isFood = /餐|食|闽|海蛎|紫菜|尝|播报|厨房|小厨师/.test(target);
  const isPraise = /鼓励|表扬|挑食|不愿意|情绪|安抚|紧张/.test(target);
  const ageGroup = resolveTeacherAgeGroup(target);
  const ageFocus = getTeacherAgeFocus(ageGroup);
  const activityDuration = getTeacherActivityDuration(ageGroup);
  const activityName = isFood ? "泉州美食探索小列车" : "文明进餐好习惯操";
  const title = isActivity
    ? "幼儿活动课程方案"
    : isStory
      ? "幼儿互动引导"
      : isPraise
        ? "情绪支持活动"
        : isFood
          ? "闽南食育活动"
          : "幼儿故事活动";
  const content = isActivity
    ? [
        `活动名称：${activityName}`,
        `适用年龄：${ageGroup}`,
        `活动时长：${activityDuration}`,
        "设计依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》，以可观察行为、游戏化操作和生活迁移为主。",
        isFood
          ? `活动目标：1. 能说出一种泉州美食名称。2. 能从图片或实物中找到一种食材。3. 愿意用短句介绍一个发现或选择靠近一小步。`
          : `活动目标：1. 能模仿一个进餐好习惯动作。2. 能判断一种行为是好习惯还是需要调整。3. 愿意把一个小步骤带到午餐或家庭生活里。`,
        isFood
          ? `准备材料：泉州美食站点图、食材卡、美食宝箱、贴纸。`
          : `准备材料：红绿牌、进餐动作图卡、碗筷模型、贴纸。`,
        isFood
          ? `活动流程：导入 2 分钟，用闽食小列车口令进站；感知/操作 6 分钟，幼儿看图找美食和食材卡；互动表达 5 分钟，请幼儿做小小美食播报员；生活迁移 3 分钟，选择回家介绍的一种美食；收束 2 分钟，用贴纸肯定具体发现。`
          : `活动流程：导入 2 分钟，用文明进餐操口令热身；感知/操作 6 分钟，幼儿模仿扶碗、坐稳、细嚼慢咽、整理动作；互动表达 5 分钟，用红绿牌判断行为；生活迁移 3 分钟，说说午餐或家里可以做哪一步；收束 2 分钟，肯定一个具体好习惯。`,
        isFood
          ? "儿歌/口令：闽食小列车，慢慢进小站，先看食材卡，再说小发现。"
          : "儿歌/口令：小本领，练一练，一步一步我能行。",
        isFood
          ? "教师引导语：我们先认识名字和食材，愿意靠近一点点就值得记录。"
          : "教师引导语：老师看到你正在练一个小步骤，先做一小步也很棒。",
        `教师提问：你看到了什么？下一步可以怎么做？你愿意试哪一小步？`,
        `观察要点：是否能参与操作；是否能说出一个可观察发现；是否愿意尝试或模仿目标动作。`,
        isFood
          ? `家园延伸：回家完成睡前美食小回顾，说一种今天认识的美食、一个颜色或食材，以及明天愿意靠近哪一小步。`
          : `家园延伸：回家做家庭美食小管家，饭前洗手、摆碗筷、按需取餐，餐后整理一个小地方。`,
        `注意事项：${ageFocus} 活动目标写成可观察行为，不考试、不背诵、不要求全部幼儿同一速度完成。`,
      ].join("\n")
    : isStory
      ? "有一颗小星星来到教室，它想请小朋友帮忙完成一个小任务：先看一看图片，再说一说自己的发现，最后一起试一试。"
      : isPraise
        ? "活动先接住孩子的情绪，再用角色邀请孩子完成一个很小的动作。教师只给一步提示，完成后说出具体进步。"
        : isFood
          ? "活动从闽南食物图片导入，请幼儿看颜色、闻味道、说食材，再选择愿意尝试的一小步。"
          : "请老师先讲一个短故事，再出示图片提问，最后让幼儿用动作或语言完成一个小任务。";
  const tips = isActivity
    ? ["目标只写一两条。", "流程保留操作环节。", "观察点要能记录。"]
    : isStory
      ? ["角色要贴近幼儿。", "问题不要太难。", "结尾带一个任务。"]
      : isPraise
        ? ["先接住情绪。", "不催促不比较。", "给孩子一个台阶。"]
        : isFood
          ? ["先认名字食材。", "允许只靠近一步。", "用泉州故事引入。"]
          : ["语言短一点。", "先示范再邀请。", "完成后及时表扬。"];

  return {
    title,
    content,
    tips,
  };
}

function isTeacherFallbackPayload(payload: TeacherResponse, task: string, scenario: string) {
  const fallback = buildTeacherClientFallback(task, scenario);

  return (
    payload.title === fallback.title &&
    payload.content === fallback.content &&
    payload.tips.length === fallback.tips.length &&
    payload.tips.every((tip, index) => tip === fallback.tips[index])
  );
}

function buildTeacherCopyText(
  result: TeacherResponse,
  extensionLine: string,
  task: string,
  scenario: string,
  themeId: ThemeId,
) {
  return [
    "【闽食小当家｜幼习宝·闽食成长岛教育智能体教师工作台生成】",
    `主题：${themeId === "habit" ? "好习惯练习" : "闽食探索"}`,
    `任务：${task}`,
    `场景：${scenario.trim()}`,
    "【确认】AI生成，需教师确认后再使用",
    "",
    `【标题】${result.title}`,
    `【生成内容】${result.content}`,
    extensionLine ? `【活动延伸】${extensionLine}` : "",
    result.tips.length > 0 ? `【使用建议】\n${result.tips.map((tip, index) => `${index + 1}. ${tip}`).join("\n")}` : "",
    result.fallbackUsed
      ? "【提醒】当前是备用内容，请教师确认后再使用。"
      : "【提醒】AI生成，需教师确认后再使用。",
  ]
    .filter(Boolean)
    .join("\n");
}

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

function buildMiniGameExtensionScenario(themeId: ThemeId, ageGroup: string = defaultTeacherAgeGroup) {
  const duration = getTeacherActivityDuration(ageGroup);

  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：${duration}。活动主题：泉州闽食探索。幼儿已有经验：刚在儿童端完成了闽食小列车、摊位寻宝、美食观察卡或泉州小厨房任务。希望目标：能说出一种泉州美食名称，观察食材或外形，并选择一个愿意靠近的小步骤。${classroomPlanRequirement}`
    : `年龄段：${ageGroup}。活动时长：${duration}。活动主题：幼习宝一日生活常规提醒。幼儿已有经验：刚在儿童端完成了洗手、喝水、如厕、整理、排队、文明进餐或红绿牌任务。希望目标：能用动作、图卡或短句完成一个生活常规或进餐习惯任务，并在生活环节尝试迁移。${classroomPlanRequirement}`;
}

function buildHomePlanScenario(themeId: ThemeId, ageGroup: string = defaultTeacherAgeGroup) {
  const duration = getTeacherActivityDuration(ageGroup);

  return themeId === "food"
    ? `年龄段：${ageGroup}。活动时长：${duration}。主题：泉州美食探索。幼儿已有经验：认识少量家乡食物，但对食材、颜色和味道表达还不充分。希望目标：能说出一种泉州美食名称，找一找食材或外形特征，选择一个愿意靠近的小步骤。`
    : `年龄段：${ageGroup}。活动时长：${duration}。主题：幼习宝一日生活常规提醒。幼儿已有经验：知道饭前要洗手，但喝水、如厕表达、整理、排队和文明进餐仍需要反复提醒。希望目标：能完成一个可观察的生活常规或进餐习惯小任务，并在班级或家庭生活里尝试迁移。`;
}

function buildPreferenceInterventionScenario(record: FoodPreferenceRecord, ageGroup: string = defaultTeacherAgeGroup) {
  const followUp = getFoodPreferenceFollowUp(record);

  return `年龄段：${ageGroup}。活动时长：15-20 分钟。${followUp.activityScenario}${classroomPlanRequirement}要求不贴标签，围绕看见名字、观察食材、说出发现和选择愿意靠近的一小步设计食育课堂。`;
}

function buildTeacherTaskScenario(item: TeacherTaskItem, themeId: ThemeId, ageGroup: string) {
  return item.id === "home" ? buildHomePlanScenario(themeId, ageGroup) : item.starter;
}

function getThemeForTeacherTask(item: TeacherTaskItem, currentThemeId: ThemeId): ThemeId {
  if (item.id === "food-follow") {
    return "food";
  }

  if (item.id === "home" || item.id === "child-expression" || item.id === "parent-reading") {
    return "habit";
  }

  return currentThemeId;
}

function buildTeacherRequestInput(task: string, scenario: string, ageGroup: string, themeId: ThemeId) {
  const themeLabel = themeId === "food" ? "闽食成长岛" : "幼习宝";
  const ageFocus = getTeacherAgeFocus(ageGroup);
  const duration = getTeacherActivityDuration(ageGroup);

  return isActivityPlanTask(task)
    ? [
        `年龄段：${ageGroup}`,
        `主题来源：${themeLabel}`,
        "设计依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》",
        `活动时长建议：${duration}`,
        `年龄特点：${ageFocus}`,
        scenario.trim(),
        "请按幼儿园活动方案结构输出，目标写成可观察行为，环节短、游戏化、可操作，避免小学化讲授。",
      ].join("\n")
    : [
        `年龄段参考：${ageGroup}`,
        `主题来源：${themeLabel}`,
        "依据：《3-6岁儿童学习与发展指南》《幼儿园教育指导纲要》",
        `年龄特点：${ageFocus}`,
        scenario.trim(),
      ].join("\n");
}

function hasThemeMiniGameRecord(rawArchive: string | null, themeId: ThemeId) {
  const archive = parseGrowthArchive(rawArchive);

  return themeId === "food"
    ? archive.miniGameProgress.foodObserve > 0 ||
        archive.miniGameProgress.foodClue > 0 ||
        archive.miniGameProgress.kindWords > 0 ||
        archive.miniGameProgress.foodTrain > 0 ||
        archive.miniGameProgress.foodGuess > 0 ||
        archive.miniGameProgress.foodPreference > 0 ||
        archive.miniGameProgress.foodReporter > 0 ||
        archive.miniGameProgress.foodKitchen > 0 ||
        archive.miniGameProgress.peerEncourage > 0 ||
        archive.miniGameProgress.mealTray > 0
    : archive.miniGameProgress.washSteps > 0 ||
        archive.miniGameProgress.queue > 0 ||
        archive.miniGameProgress.habitJudge > 0 ||
        archive.miniGameProgress.readingCheckin > 0 ||
        archive.miniGameProgress.mealManners > 0 ||
        archive.miniGameProgress.habitTrafficLight > 0;
}

function parseRosterImportText(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/,|\t|，/).map((item) => item.trim()));

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0];
  const hasHeader = header.some((item) => /班级|号数|姓名|class|number|name/i.test(item));
  const classIndex = hasHeader ? header.findIndex((item) => /班级|class/i.test(item)) : -1;
  const numberIndex = hasHeader ? header.findIndex((item) => /号数|序号|number|no\.?|学号/i.test(item)) : -1;
  const nameIndex = hasHeader ? header.findIndex((item) => /姓名|幼儿|name/i.test(item)) : -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((parts) => {
      if (hasHeader) {
        const className = classIndex >= 0 ? parts[classIndex] ?? "" : "";
        const rosterNumber = numberIndex >= 0 ? parts[numberIndex] ?? "" : "";
        const name = nameIndex >= 0 ? parts[nameIndex] ?? "" : "";

        return {
          className: className.trim().slice(0, 16),
          name: name.trim().slice(0, 12),
          rosterNumber: rosterNumber.replace(/[^\d]/g, "").slice(0, 3),
        };
      }

      const [first = "", second = "", third = ""] = parts;
      const hasThreeColumns = Boolean(third);
      const className = hasThreeColumns ? first : "";
      const numberFirst = first.replace(/[^\d]/g, "");
      const numberSecond = second.replace(/[^\d]/g, "");
      const rosterNumber = hasThreeColumns ? second.replace(/[^\d]/g, "") : numberFirst || numberSecond;
      const name = hasThreeColumns ? third : numberFirst ? second : first;

      return {
        className: className.trim().slice(0, 16),
        name: name.trim().slice(0, 12),
        rosterNumber: rosterNumber.slice(0, 3),
      };
    })
    .filter((item) => item.name && item.rosterNumber);
}

function buildMiniGameInterventionScenario(record: MiniGameRecord) {
  const childName = record.childName ?? "这位幼儿";
  const followUp = getMiniGameFollowUp(record);

  return `${childName}的互动记录：${followUp.observation}${followUp.activityScenario}${classroomPlanRequirement}家庭延伸建议可参考：${followUp.homeTask}`;
}

function formatTeacherPickedItems(items: string[]) {
  return items.filter(Boolean).slice(0, 4).join("、") || "已完成互动任务";
}

function getMiniGameInsightKey(record: MiniGameRecord) {
  return `${record.completedAt}-${record.gameKey}-${record.childId ?? record.childName ?? "anon"}`;
}

function getFoodPreferenceInsightKey(record: FoodPreferenceRecord) {
  return `${record.recordedAt}-${record.foodLabel}-${record.childId ?? record.childName ?? "anon"}`;
}

function getFoodAcceptanceStageText(text: string) {
  if (/尝|吃|一点/.test(text)) {
    return "愿意尝一点";
  }

  if (/闻|香|味/.test(text)) {
    return "愿意闻一闻";
  }

  if (/说|名字|介绍|播报/.test(text)) {
    return "能说出名字";
  }

  if (/看|观察|图片|颜色|形状/.test(text)) {
    return "愿意看一看";
  }

  return "正在认识";
}

function buildMiniGameEffectChangeLine(record: MiniGameRecord) {
  const childName = record.childName ?? "未选择身份";
  const pickedText = formatTeacherPickedItems(record.pickedItems);

  if (record.gameKey === "readingCheckin") {
    return `${childName}：习惯故事从愿意听，到能选择答案并完成“${record.habitTask ?? "一个生活小任务"}”。`;
  }

  if (record.gameKey === "washSteps") {
    return `${childName}：洗手常规从需要提醒，到能按顺序完成一个清洁步骤。`;
  }

  if (record.gameKey === "queue") {
    return `${childName}：一日常规从愿意听提示，到能选择喝水、如厕、排队或整理的合适做法。`;
  }

  if (record.gameKey === "mealManners") {
    return `${childName}：进餐操从需要听口令，到能主动练习扶好碗、坐稳和餐后整理。`;
  }

  if (record.gameKey === "habitTrafficLight") {
    return `${childName}：好习惯判断从愿意选择，到能尝试说出正确做法。`;
  }

  if (record.gameKey === "foodPreference") {
    return `${childName}：美食认识从正在观察，到${getFoodAcceptanceStageText(pickedText)}。`;
  }

  if (record.themeId === "food") {
    return `${childName}：闽食探索从认识名字，到能找食材或说一个发现。`;
  }

  return `${childName}：成长任务从愿意参与，到能完成一个可观察的小步骤。`;
}

function buildFoodPreferenceEffectChangeLine(record: FoodPreferenceRecord) {
  const childName = record.childName ?? "未选择身份";
  const stage = getFoodAcceptanceStageText(`${record.foodLabel}、${record.reasonLabel}、${record.gentleTryTip}`);

  return `${childName}：${record.foodLabel} 从正在认识，到${stage}。`;
}

export function TeacherStudio() {
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const premiumVoiceLabel = process.env.NEXT_PUBLIC_TTS_VOICE_LABEL ?? defaultPremiumVoiceLabel;
  const draftStorageKey = "tongqu-growth-web-teacher-draft";
  const historyStorageKey = "tongqu-growth-web-teacher-history";
  const [teacherAuthHydrated, setTeacherAuthHydrated] = useState(false);
  const [teacherAuthenticated, setTeacherAuthenticated] = useState(false);
  const [teacherHasAccount, setTeacherHasAccount] = useState(false);
  const [teacherAccountInput, setTeacherAccountInput] = useState("");
  const [teacherPasscodeInput, setTeacherPasscodeInput] = useState("");
  const [teacherSetupAccount, setTeacherSetupAccount] = useState("");
  const [teacherSetupPasscode, setTeacherSetupPasscode] = useState("");
  const [teacherAuthStatus, setTeacherAuthStatus] =
    useState("班级试用模式：请先确认本机班级试用账号，再进入教师工作台。");
  const [activeTeacherPanel, setActiveTeacherPanel] = useState<TeacherPanelKey>("home");
  const [aiReviewRecords, setAiReviewRecords] = useState<AiReviewRecord[]>([]);
  const [aiReviewContentType, setAiReviewContentType] = useState<AiReviewContentType>("闽食介绍");
  const [aiReviewContent, setAiReviewContent] = useState("");
  const [aiReviewStatus, setAiReviewStatus] = useState<AiReviewStatus>("待审核");
  const [aiReviewTeacherNote, setAiReviewTeacherNote] = useState("");
  const [aiReviewMessage, setAiReviewMessage] =
    useState("当前为演示版本，正式部署需接入后端账号系统和加密数据库。");
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [teacherAgeGroup, setTeacherAgeGroup] = useState<string>(defaultTeacherAgeGroup);
  const [task, setTask] = useState(defaultTeacherTask.label);
  const [scenario, setScenario] = useState(buildHomePlanScenario("habit", defaultTeacherAgeGroup));
  const [result, setResult] = useState<TeacherResponse | null>(null);
  const [latestAiDraftSnapshot, setLatestAiDraftSnapshot] = useState<TeacherResponse | null>(null);
  const [teacherResultConfirmedAt, setTeacherResultConfirmedAt] = useState("");
  const [savedResults, setSavedResults] = useState<SavedTeacherResult[]>([]);
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(() => createEmptyGrowthArchive());
  const [childRoster, setChildRoster] = useState<ChildProfile[]>([]);
  const [newChildClassName, setNewChildClassName] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildNumber, setNewChildNumber] = useState("");
  const [rosterStatus, setRosterStatus] = useState("添加姓名和号数后，幼儿可以用小名牌进入对应互动任务。");
  const [selectedChildSummaryId, setSelectedChildSummaryId] = useState("");
  const todayMenuDateKey = getLocalDateKey();
  const [weeklyMenuEntries, setWeeklyMenuEntries] = useState<WeeklyMenuEntry[]>([]);
  const [dailyMenuOverrides, setDailyMenuOverrides] = useState<DailyMenuOverrideEntry[]>([]);
  const [menuDate, setMenuDate] = useState(todayMenuDateKey);
  const [menuMealType, setMenuMealType] = useState<MealType>("午餐");
  const [menuDishName, setMenuDishName] = useState("");
  const [menuIngredients, setMenuIngredients] = useState("");
  const [menuFocusIngredients, setMenuFocusIngredients] = useState("");
  const [menuStatus, setMenuStatus] = useState("录入本周食谱后，系统会按日期自动进入儿童端；当天食谱会立即可见。");
  const [overrideMealType, setOverrideMealType] = useState<MealType>("午餐");
  const [overrideDate, setOverrideDate] = useState(todayMenuDateKey);
  const [overrideDishName, setOverrideDishName] = useState("");
  const [overrideIngredients, setOverrideIngredients] = useState("");
  const [overrideFocusIngredients, setOverrideFocusIngredients] = useState("");
  const [menuMediaActiveDate, setMenuMediaActiveDate] = useState(todayMenuDateKey);
  const [menuMediaActiveMealType, setMenuMediaActiveMealType] = useState<MealType>("午餐");
  const [menuMediaByDateMeal, setMenuMediaByDateMeal] = useState<Record<string, MenuMediaDraft>>({});
  const [isMenuMediaAiImageLoading, setIsMenuMediaAiImageLoading] = useState(false);
  const [overrideStatus, setOverrideStatus] =
    useState("如遇采购、天气或活动变化，可只调整今天某一餐，不影响本周原始食谱。");
  const [parentSyncRecords, setParentSyncRecords] = useState<ParentSyncRecord[]>([]);
  const [pendingParentSyncRecord, setPendingParentSyncRecord] = useState<ParentSyncRecord | null>(null);
  const [parentFeedbackRecords, setParentFeedbackRecords] = useState<ParentFeedbackRecord[]>([]);
  const [selectedParentFeedbackId, setSelectedParentFeedbackId] = useState("");
  const [parentFeedbackDrafts, setParentFeedbackDrafts] = useState<Record<string, ParentFeedbackDraft>>({});
  const [parentFeedbackAiLoadingId, setParentFeedbackAiLoadingId] = useState("");
  const [parentSyncStatus, setParentSyncStatus] =
    useState("请选择一条家长反馈，给出老师回复和可执行的家庭育儿指导。");
  const [teacherPictureBooks, setTeacherPictureBooks] = useState<TeacherPictureBook[]>([]);
  const [habitTemplates, setHabitTemplates] = useState<HabitCheckinTemplate[]>([]);
  const [pictureBookThemeId, setPictureBookThemeId] = useState<ThemeId>("habit");
  const [pictureBookTitle, setPictureBookTitle] = useState("");
  const [pictureBookText, setPictureBookText] = useState("");
  const [pictureBookImagePrompts, setPictureBookImagePrompts] = useState("");
  const [pictureBookQuestion, setPictureBookQuestion] = useState("");
  const [pictureBookTask, setPictureBookTask] = useState("");
  const [pictureBookAgeGroup, setPictureBookAgeGroup] = useState<string>(defaultTeacherAgeGroup);
  const [pictureBookType, setPictureBookType] = useState("生活习惯绘本");
  const [pictureBookStatus, setPictureBookStatus] =
    useState("教师可以把生成结果或自写内容发布成幼儿区域自主选听绘本。");
  const [habitTemplateFocus, setHabitTemplateFocus] = useState("");
  const [habitTemplateChildPrompt, setHabitTemplateChildPrompt] = useState("");
  const [habitTemplateStatus, setHabitTemplateStatus] =
    useState("输入当前想加强的习惯，AI 会整理成幼儿可语音或文字回应的教师发布小任务。");
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState("账号同步已接入本地服务：上传后，教师换设备、家长用绑定码都沿同一班级账号同步。");
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isPreviewSpeaking, setIsPreviewSpeaking] = useState(false);
  const [draftStatus, setDraftStatus] = useState("当前内容会自动保存在这台设备上。");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const historyReadFailedRef = useRef(false);
  const generationSectionRef = useRef<HTMLElement | null>(null);
  const teacherScenarioRemaining = teacherScenarioMaxLength - scenario.length;
  const isActivityPlanSelected = isActivityPlanTask(task);
  const filteredSavedResults = savedResults;
  const miniGameSummaryStats = useMemo(() => {
    const records = growthArchive.miniGameRecords;
    const childKeys = new Set(
      records
        .map((record) => record.childId ?? record.childName ?? "")
        .filter(Boolean),
    );

    return {
      total: records.length,
      habit: records.filter((record) => record.themeId === "habit").length,
      food: records.filter((record) => record.themeId === "food").length,
      childCount: childKeys.size,
      foodPreference: records.filter((record) => record.gameKey === "foodPreference").length,
    };
  }, [growthArchive.miniGameRecords]);
  const latestParentFeedbackRecords = useMemo(
    () => parentFeedbackRecords.slice(0, 10),
    [parentFeedbackRecords],
  );
  const newParentFeedbackCount = parentFeedbackRecords.filter((record) => record.status === "new").length;
  const repliedParentFeedbackCount = parentFeedbackRecords.filter(
    (record) => record.teacherReply || record.teacherGuidance,
  ).length;
  const classOverview = useMemo(() => {
    const todayKey = new Date().toDateString();
    const isToday = (value: string) => {
      const date = new Date(value);

      return !Number.isNaN(date.getTime()) && date.toDateString() === todayKey;
    };
    const todayMiniGameRecords = growthArchive.miniGameRecords.filter((record) =>
      isToday(record.completedAt),
    );
    const todayBadgeRecords = growthArchive.badgeRecords.filter((record) =>
      isToday(record.earnedAt),
    );
    const todayFoodPreferenceRecords = growthArchive.foodPreferenceRecords.filter((record) =>
      isToday(record.recordedAt),
    );
    const todayParentFeedbackRecords = parentFeedbackRecords.filter((record) =>
      isToday(record.createdAt),
    );
    const todayHabitRecords = todayMiniGameRecords.filter((record) => record.themeId === "habit");
    const todayReadingRecords = todayMiniGameRecords.filter(
      (record) => record.gameKey === "readingCheckin",
    );
    const todayFoodRecords = todayMiniGameRecords.filter(
      (record) => record.themeId === "food" || record.gameKey === "foodPreference",
    );
    const participatedChildren = new Set(
      todayMiniGameRecords
        .map((record) => record.childId ?? record.childName ?? "")
        .filter(Boolean),
    );
    const unboundRecords = growthArchive.miniGameRecords.filter(
      (record) => !record.childId && !record.childName,
    ).length;
    const followUpRecords = growthArchive.miniGameRecords.filter((record) => {
      const followUp = getMiniGameFollowUp(record);

      return followUp.focus || !record.childId || !record.childName;
    }).length;
    const focusCount =
      growthArchive.foodPreferenceRecords.length +
      followUpRecords +
      parentFeedbackRecords.filter((record) => record.status === "new").length;

    return {
      rosterCount: childRoster.length,
      participatedCount: participatedChildren.size,
      interactionCount: todayMiniGameRecords.length,
      habitCheckinCount: todayHabitRecords.length,
      readingCheckinCount: todayReadingRecords.length,
      foodObservationCount: todayFoodPreferenceRecords.length || todayFoodRecords.length,
      parentFeedbackTodayCount: todayParentFeedbackRecords.length,
      badgeCount: todayBadgeRecords.length,
      newFeedbackCount: parentFeedbackRecords.filter((record) => record.status === "new").length,
      focusCount,
      unboundRecords,
    };
  }, [
    childRoster.length,
    growthArchive.badgeRecords,
    growthArchive.foodPreferenceRecords,
    growthArchive.miniGameRecords,
    parentFeedbackRecords,
  ]);
  const recommendedNextSteps = useMemo(() => {
    const records = growthArchive.miniGameRecords;
    const hasReading = records.some((record) => record.gameKey === "readingCheckin");
    const hasRoutine = records.some(
      (record) =>
        record.gameKey === "washSteps" ||
        record.gameKey === "queue" ||
        record.gameKey === "mealManners" ||
        record.gameKey === "habitTrafficLight",
    );
    const hasFood = records.some(
      (record) =>
        record.themeId === "food" ||
        record.gameKey === "foodTrain" ||
        record.gameKey === "foodGuess" ||
        record.gameKey === "foodObserve",
    );

    if (newParentFeedbackCount > 0) {
      return ["先回复家长反馈", "再同步一个家庭小任务"];
    }

    if (hasReading) {
      return ["生成习惯故事跟进", "同步一个家庭小习惯任务"];
    }

    if (hasRoutine) {
      return ["生成一日常规口令", "同步饭前洗手、喝水或整理"];
    }

    if (hasFood) {
      return ["生成泉州美食探索活动", "同步家庭找一种泉州美食"];
    }

    return ["从常规提醒生成一节课", "引导幼儿先完成一个生活任务"];
  }, [growthArchive.miniGameRecords, newParentFeedbackCount]);
  const aiDailyObservationCards = useMemo(() => {
    const habitRecords = growthArchive.miniGameRecords.filter((record) => record.themeId === "habit");
    const foodRecords = growthArchive.miniGameRecords.filter((record) => record.themeId === "food");
    const latestHabit = habitRecords[0] ? getMiniGameFollowUp(habitRecords[0]) : null;
    const latestFood = foodRecords[0] ? getMiniGameFollowUp(foodRecords[0]) : null;
    const latestFoodPreference = growthArchive.foodPreferenceRecords[0]
      ? getFoodPreferenceFollowUp(growthArchive.foodPreferenceRecords[0])
      : null;

    return [
      {
        label: "今日参与情况",
        value:
          classOverview.participatedCount > 0
            ? `${classOverview.participatedCount} 名幼儿参与，完成 ${classOverview.interactionCount} 次任务`
            : "今天还没有新的儿童端任务记录",
      },
      {
        label: "一日常规表现",
        value: latestHabit?.observation ?? "暂无常规互动记录，可先安排洗手、喝水、如厕、整理、排队或文明进餐提醒。",
      },
      {
        label: "闽食探索表现",
        value:
          latestFoodPreference?.observation ??
          latestFood?.observation ??
          "暂无闽食探索记录，可先从小列车或摊位寻宝开始。",
      },
      {
        label: "需要老师关注",
        value:
          classOverview.focusCount > 0
            ? `${classOverview.focusCount} 条线索需要跟进，优先看喝水洗手、排队整理、文明进餐、美食认识和家长新反馈。`
            : "暂无明显需要关注的线索，可继续观察孩子下一次选择。",
      },
      {
        label: "今日建议动作",
        value: recommendedNextSteps.join("；"),
      },
    ];
  }, [
    classOverview.focusCount,
    classOverview.interactionCount,
    classOverview.participatedCount,
    growthArchive.foodPreferenceRecords,
    growthArchive.miniGameRecords,
    recommendedNextSteps,
  ]);
  const aiFocusInsightRows = useMemo(() => {
    const gameRows = growthArchive.miniGameRecords.slice(0, 4).map((record) => {
      const followUp = getMiniGameFollowUp(record);

      return {
        id: `game-${getMiniGameInsightKey(record)}`,
        kind: "game" as const,
        recordKey: getMiniGameInsightKey(record),
        childName: record.childName ?? "未选择身份",
        title: followUp.displayName,
        meaning: `${followUp.observation} 记录：${formatTeacherPickedItems(record.pickedItems)}。`,
        nextAction: followUp.homeTask,
      };
    });
    const foodRows = growthArchive.foodPreferenceRecords.slice(0, 3).map((record) => {
      const followUp = getFoodPreferenceFollowUp(record);

      return {
        id: `food-${getFoodPreferenceInsightKey(record)}`,
        kind: "food" as const,
        recordKey: getFoodPreferenceInsightKey(record),
        childName: record.childName ?? "未选择身份",
        title: followUp.displayName,
        meaning: followUp.observation,
        nextAction: followUp.homeTask,
      };
    });

    return [...foodRows, ...gameRows].slice(0, 6);
  }, [growthArchive.foodPreferenceRecords, growthArchive.miniGameRecords]);
  const teacherAiSummaryStats = useMemo(() => {
    const focusChildNames = Array.from(
      new Set(
        aiFocusInsightRows
          .map((row) => row.childName)
          .filter((name) => name && name !== "未选择身份"),
      ),
    );
    const aiObservationSummary =
      classOverview.interactionCount > 0
        ? `${classOverview.participatedCount} 名幼儿有互动，AI 已整理常规、阅读和食物线索。`
        : "等待儿童端产生今日互动后，AI 会汇总观察摘要。";

    return [
      {
        label: "AI 今日观察摘要",
        value: aiObservationSummary,
        hint: aiConfirmedUseNotice,
      },
      {
        label: "今日互动人数",
        value: classOverview.participatedCount,
        hint: `${classOverview.interactionCount} 次今日互动`,
      },
      {
        label: "习惯打卡次数",
        value: classOverview.habitCheckinCount,
        hint: "洗手、喝水、排队、整理等",
      },
      {
        label: "阅读打卡次数",
        value: classOverview.readingCheckinCount,
        hint: "故事、教师绘本和对老师说",
      },
      {
        label: "食物观察次数",
        value: classOverview.foodObservationCount,
        hint: "今日食谱与靠近小步",
      },
      {
        label: "家长反馈次数",
        value: classOverview.parentFeedbackTodayCount,
        hint: newParentFeedbackCount > 0 ? `${newParentFeedbackCount} 条待回复` : "今日无待回复",
      },
      {
        label: "重点跟进幼儿",
        value: focusChildNames.length,
        hint: focusChildNames.slice(0, 3).join("、") || "暂无重点名单",
      },
      {
        label: "AI建议摘要",
        value: recommendedNextSteps.length,
        hint: recommendedNextSteps.join(" / "),
      },
    ];
  }, [
    aiFocusInsightRows,
    classOverview.foodObservationCount,
    classOverview.habitCheckinCount,
    classOverview.interactionCount,
    classOverview.parentFeedbackTodayCount,
    classOverview.participatedCount,
    classOverview.readingCheckinCount,
    newParentFeedbackCount,
    recommendedNextSteps,
  ]);
  const teacherDataOverview = useMemo(() => {
    const today = new Date();
    const dayKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));

      return {
        key: date.toDateString(),
        label: `${date.getMonth() + 1}/${date.getDate()}`,
      };
    });
    const isSameDay = (value: string, key: string) => {
      const date = new Date(value);

      return !Number.isNaN(date.getTime()) && date.toDateString() === key;
    };
    const weeklyTrend = dayKeys.map((day) => {
      const miniCount = growthArchive.miniGameRecords.filter((record) =>
        isSameDay(record.completedAt, day.key),
      ).length;
      const foodCount = growthArchive.foodPreferenceRecords.filter((record) =>
        isSameDay(record.recordedAt, day.key),
      ).length;
      const feedbackCount = parentFeedbackRecords.filter((record) =>
        isSameDay(record.createdAt, day.key),
      ).length;

      return {
        ...day,
        value: miniCount + foodCount + feedbackCount,
      };
    });
    const maxWeeklyValue = Math.max(1, ...weeklyTrend.map((item) => item.value));
    const childRows = childRoster
      .map((child) => {
        const miniCount = growthArchive.miniGameRecords.filter(
          (record) => record.childId === child.id || record.childName === child.name,
        ).length;
        const foodCount = growthArchive.foodPreferenceRecords.filter(
          (record) => record.childId === child.id || record.childName === child.name,
        ).length;
        const feedbackCount = parentFeedbackRecords.filter(
          (record) => record.childId === child.id || record.childName === child.name,
        ).length;

        return {
          id: child.id,
          name: formatChildLabel(child),
          value: miniCount + foodCount + feedbackCount,
        };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);
    const typeRows = [
      {
        label: "习惯打卡",
        value: growthArchive.miniGameRecords.filter((record) => record.themeId === "habit").length,
        tone: "bg-teal-500",
      },
      {
        label: "阅读打卡",
        value: growthArchive.miniGameRecords.filter((record) => record.gameKey === "readingCheckin").length,
        tone: "bg-violet-500",
      },
      {
        label: "食物观察",
        value: growthArchive.foodPreferenceRecords.length,
        tone: "bg-amber-500",
      },
      {
        label: "小厨房播报",
        value: growthArchive.miniGameRecords.filter(
          (record) => record.gameKey === "foodKitchen" || record.gameKey === "foodTrain",
        ).length,
        tone: "bg-orange-500",
      },
      {
        label: "家庭反馈",
        value: parentFeedbackRecords.length,
        tone: "bg-rose-500",
      },
    ];
    const maxTypeValue = Math.max(1, ...typeRows.map((item) => item.value));
    const sourceText = [
      ...growthArchive.miniGameRecords.flatMap((record) => [
        record.childUtterance ?? "",
        record.answerContent ?? "",
        ...record.pickedItems,
      ]),
      ...growthArchive.foodPreferenceRecords.flatMap((record) => [
        record.foodLabel,
        record.reasonLabel,
        record.approachStep ?? "",
      ]),
      ...parentFeedbackRecords.flatMap((record) => [record.content, record.teacherReply ?? ""]),
    ].join(" ");
    const keywordCandidates = [
      "洗手",
      "喝水",
      "排队",
      "整理",
      "如厕",
      "故事",
      "绘本",
      "喜欢",
      "不敢",
      "看一看",
      "闻一闻",
      "食材",
      "小厨房",
    ];
    const keywordRows = keywordCandidates
      .map((keyword) => ({
        label: keyword,
        value: sourceText.split(keyword).length - 1,
      }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);

    return {
      weeklyTrend,
      maxWeeklyValue,
      childRows,
      typeRows,
      maxTypeValue,
      keywordRows,
    };
  }, [
    childRoster,
    growthArchive.foodPreferenceRecords,
    growthArchive.miniGameRecords,
    parentFeedbackRecords,
  ]);
  const childExpressionSummary = useMemo(() => {
    const expressionRecords = growthArchive.miniGameRecords.filter(
      (record) =>
        record.source === "child-to-teacher" ||
        record.badgeName.includes("表达") ||
        Boolean(record.childUtterance),
    );
    const childNames = Array.from(
      new Set(
        expressionRecords
          .map((record) => record.childName ?? "")
          .filter(Boolean),
      ),
    );
    const keywordSource = expressionRecords
      .flatMap((record) => [record.childUtterance ?? "", record.answerContent ?? "", ...record.pickedItems])
      .join(" ");
    const keywords = [
      "老师",
      "帮忙",
      "想玩",
      "害怕",
      "喜欢",
      "不敢",
      "洗手",
      "喝水",
      "排队",
      "整理",
      "食物",
      "故事",
    ]
      .map((keyword) => ({
        label: keyword,
        value: keywordSource.split(keyword).length - 1,
      }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
    const latest = expressionRecords.slice(0, 4).map((record) => {
      const childName = record.childName ?? "未选择身份";
      const content =
        record.childUtterance ||
        record.pickedItems.find((item) => item.startsWith("回应:"))?.replace("回应:", "") ||
        record.answerContent ||
        "完成了一次表达打卡";

      return `${childName}：${content}`;
    });

    return {
      total: expressionRecords.length,
      childCount: childNames.length,
      keywords,
      latest,
      focusChildren: childNames.slice(0, 5),
      summary:
        expressionRecords.length > 0
          ? `AI已整理 ${expressionRecords.length} 次幼儿表达，教师可重点关注需要帮助、害怕、不敢和反复提到的生活环节。`
          : "儿童端完成“对老师说”后，这里会汇总表达次数、关键词和需要关注的幼儿。",
    };
  }, [growthArchive.miniGameRecords]);
  const foodObservationSummaryRows = useMemo(() => {
    type FoodSummaryDraft = {
      foodLabel: string;
      records: FoodPreferenceRecord[];
      reasonCounter: Map<string, number>;
      childNames: Set<string>;
      approachCounter: Map<string, number>;
    };
    const summaryMap = new Map<string, FoodSummaryDraft>();

    for (const record of growthArchive.foodPreferenceRecords) {
      const foodLabel = record.foodLabel.trim() || "未命名食物";
      const current =
        summaryMap.get(foodLabel) ??
        {
          foodLabel,
          records: [],
          reasonCounter: new Map<string, number>(),
          childNames: new Set<string>(),
          approachCounter: new Map<string, number>(),
        };

      current.records.push(record);
      current.reasonCounter.set(record.reasonLabel, (current.reasonCounter.get(record.reasonLabel) ?? 0) + 1);

      if (record.childName || record.childId) {
        current.childNames.add(record.childName ?? record.childId ?? "未选择身份");
      }

      if (record.approachStep) {
        current.approachCounter.set(record.approachStep, (current.approachCounter.get(record.approachStep) ?? 0) + 1);
      }

      summaryMap.set(foodLabel, current);
    }

    const pickTop = (counter: Map<string, number>) =>
      Array.from(counter.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";

    return Array.from(summaryMap.values())
      .map((item) => {
        const records = [...item.records].sort(
          (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
        );
        const latestRecord = records[0];
        const topReason = pickTop(item.reasonCounter) || latestRecord.reasonLabel;
        const recommendedStep =
          pickTop(item.approachCounter) ||
          (/气味|味道|冲|重/.test(topReason)
            ? "闻一闻"
            : /口感|太滑|太硬/.test(topReason)
              ? "碰一碰"
              : "看一看");

        return {
          foodLabel: item.foodLabel,
          count: records.length,
          topReason,
          childCount: item.childNames.size,
          childNames: Array.from(item.childNames).slice(0, 6),
          latestRecord,
          recommendedStep,
        };
      })
      .sort((left, right) => right.count - left.count || new Date(right.latestRecord.recordedAt).getTime() - new Date(left.latestRecord.recordedAt).getTime())
      .slice(0, 6);
  }, [growthArchive.foodPreferenceRecords]);
  const todayPublishedMenuEntries = useMemo(
    () => getEffectiveMenuForDate(weeklyMenuEntries, dailyMenuOverrides, overrideDate || todayMenuDateKey),
    [dailyMenuOverrides, overrideDate, todayMenuDateKey, weeklyMenuEntries],
  );
  const todayOverrideEntries = useMemo(
    () => dailyMenuOverrides.filter((entry) => entry.date === (overrideDate || todayMenuDateKey)),
    [dailyMenuOverrides, overrideDate, todayMenuDateKey],
  );
  const activeMenuMediaDraft = getMenuMediaDraftFor(menuMediaActiveDate, menuMediaActiveMealType);
  const activeMenuMediaValues = getMenuMediaValues(menuMediaActiveDate, menuMediaActiveMealType);
  const menuNutritionPreview = useMemo(() => {
    const dishName = menuDishName.trim();
    const ingredients = splitMenuText(menuIngredients);

    if (!dishName || ingredients.length === 0) {
      return "";
    }

    const focusIngredients = splitMenuText(menuFocusIngredients);

    return buildWeeklyMenuNutritionPreview({
      dishName,
      ingredients,
      focusIngredients: focusIngredients.length > 0 ? focusIngredients : ingredients.slice(0, 2),
    });
  }, [menuDishName, menuFocusIngredients, menuIngredients]);
  const todayMenuObservationRows = useMemo(() => {
    const todayMenuLabels = new Set(
      todayPublishedMenuEntries.flatMap((entry) => [
        entry.dishName,
        ...entry.ingredients,
        ...entry.focusIngredients,
      ]),
    );
    type MenuSummaryDraft = {
      dishName: string;
      records: FoodPreferenceRecord[];
      ingredients: Map<string, number>;
      reasons: Map<string, number>;
      steps: Map<string, number>;
      childIds: Set<string>;
    };
    const summaryMap = new Map<string, MenuSummaryDraft>();
    const pickTop = (counter: Map<string, number>) =>
      Array.from(counter.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";

    for (const record of growthArchive.foodPreferenceRecords) {
      const recordDate = record.menuDate ?? getLocalDateKey(new Date(record.recordedAt));
      const relatedToMenu =
        recordDate === todayMenuDateKey &&
        (Boolean(record.dishName) ||
          todayMenuLabels.has(record.foodLabel) ||
          (record.ingredientName ? todayMenuLabels.has(record.ingredientName) : false));

      if (!relatedToMenu) {
        continue;
      }

      const dishName = record.dishName?.trim() || record.foodLabel.trim() || "今日食谱";
      const current =
        summaryMap.get(dishName) ??
        {
          dishName,
          records: [],
          ingredients: new Map<string, number>(),
          reasons: new Map<string, number>(),
          steps: new Map<string, number>(),
          childIds: new Set<string>(),
        };
      const ingredient = record.ingredientName?.trim() || record.foodLabel.trim();

      current.records.push(record);
      current.ingredients.set(ingredient, (current.ingredients.get(ingredient) ?? 0) + 1);
      current.reasons.set(record.reasonLabel, (current.reasons.get(record.reasonLabel) ?? 0) + 1);

      if (record.approachStep) {
        current.steps.set(record.approachStep, (current.steps.get(record.approachStep) ?? 0) + 1);
      }

      if (record.childId || record.childName) {
        current.childIds.add(record.childId ?? record.childName ?? "未选择身份");
      }

      summaryMap.set(dishName, current);
    }

    return Array.from(summaryMap.values())
      .map((item) => {
        const sortedRecords = [...item.records].sort(
          (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
        );
        const topReason = pickTop(item.reasons) || "正在认识";
        const recommendedStep =
          pickTop(item.steps) ||
          (/气味|味道|冲|重/.test(topReason)
            ? "闻一闻"
            : /口感|太滑|太硬/.test(topReason)
              ? "碰一碰"
              : "看一看");

        return {
          dishName: item.dishName,
          count: item.records.length,
          topIngredient: pickTop(item.ingredients) || item.dishName,
          topReason,
          topStep: pickTop(item.steps) || recommendedStep,
          childCount: item.childIds.size,
          latestRecord: sortedRecords[0],
          recommendedStep,
        };
      })
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [growthArchive.foodPreferenceRecords, todayMenuDateKey, todayPublishedMenuEntries]);
  const childRecordSummaryRows = useMemo(() => {
    return childRoster.map((child) => {
      const miniRecords = growthArchive.miniGameRecords.filter(
        (record) => record.childId === child.id || record.childName === child.name,
      );
      const foodRecords = growthArchive.foodPreferenceRecords.filter(
        (record) => record.childId === child.id || record.childName === child.name,
      );
      const feedbackRecords = parentFeedbackRecords.filter((record) => record.childId === child.id);
      const badgeRecords = growthArchive.badgeRecords.filter(
        (record) => record.childId === child.id || record.childName === child.name,
      );
      const latestFoodRecord = [...foodRecords].sort(
        (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
      )[0];
      const latestMiniRecord = [...miniRecords].sort(
        (left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
      )[0];
      const latestFoodTime = latestFoodRecord ? new Date(latestFoodRecord.recordedAt).getTime() : 0;
      const latestMiniTime = latestMiniRecord ? new Date(latestMiniRecord.completedAt).getTime() : 0;
      const latestObservation =
        latestFoodTime >= latestMiniTime && latestFoodRecord
          ? getFoodPreferenceFollowUp(latestFoodRecord).observation
          : latestMiniRecord
            ? getMiniGameFollowUp(latestMiniRecord).observation
            : "还没有互动记录，可先从幼习宝一日常规任务开始。";
      const detailLines = [
        ...foodRecords.slice(0, 3).map((record) => {
          const followUp = getFoodPreferenceFollowUp(record);

          return `${formatParentSyncTime(record.recordedAt)} · ${followUp.displayName}：${followUp.observation}`;
        }),
        ...miniRecords.slice(0, 3).map((record) => {
          const followUp = getMiniGameFollowUp(record);

          return `${formatParentSyncTime(record.completedAt)} · ${followUp.displayName}：${formatTeacherPickedItems(record.pickedItems)}`;
        }),
        ...feedbackRecords.slice(0, 2).map(
          (record) => `${formatParentSyncTime(record.createdAt)} · 家庭反馈：${record.content}`,
        ),
      ].slice(0, 6);

      return {
        child,
        miniCount: miniRecords.length,
        foodCount: foodRecords.length,
        feedbackCount: feedbackRecords.length,
        badgeCount: badgeRecords.length,
        latestObservation,
        detailLines,
      };
    });
  }, [
    childRoster,
    growthArchive.badgeRecords,
    growthArchive.foodPreferenceRecords,
    growthArchive.miniGameRecords,
    parentFeedbackRecords,
  ]);
  const familyPlateActionSummary = useMemo(() => {
    const records = parentFeedbackRecords.filter((record) => record.content.includes("家庭光盘行动"));
    const childIds = new Set(records.map((record) => record.childId).filter(Boolean));

    return {
      count: records.length,
      childCount: childIds.size,
      latest: records[0] ?? null,
    };
  }, [parentFeedbackRecords]);
  const effectEvidenceStats = useMemo(() => {
    const routineGameKeys = new Set([
      "washSteps",
      "queue",
      "readingCheckin",
      "habitTrafficLight",
      "mealManners",
    ]);
    const routineTaskCount = growthArchive.miniGameRecords.filter(
      (record) => record.themeId === "habit" || routineGameKeys.has(record.gameKey),
    ).length;
    const foodApproachCount = growthArchive.foodPreferenceRecords.length;
    const familyFeedbackCount = parentFeedbackRecords.length;

    return [
      {
        label: "一日常规任务完成次数",
        value: routineTaskCount,
        hint: "洗手、喝水、如厕、整理、排队、文明进餐等互动记录",
      },
      {
        label: "食物观察/靠近小步次数",
        value: foodApproachCount,
        hint: "正在认识的食物、原因和靠近小步记录",
      },
      {
        label: "家庭反馈/家庭打卡次数",
        value: familyFeedbackCount,
        hint: "家长提交的居家观察、家庭光盘行动和延续任务",
      },
    ];
  }, [growthArchive.foodPreferenceRecords.length, growthArchive.miniGameRecords, parentFeedbackRecords.length]);
  const effectChangeRecords = useMemo(() => {
    const foodLines = growthArchive.foodPreferenceRecords
      .slice(0, 3)
      .map(buildFoodPreferenceEffectChangeLine);
    const gameLines = growthArchive.miniGameRecords
      .slice(0, 5)
      .map(buildMiniGameEffectChangeLine);
    const uniqueLines = Array.from(new Set([...foodLines, ...gameLines])).slice(0, 6);

    return uniqueLines.length > 0
      ? uniqueLines
      : [
          "暂无变化记录。孩子完成儿童端互动后，这里会自动整理从愿意听、愿意选择到能说出做法的变化。",
        ];
  }, [growthArchive.foodPreferenceRecords, growthArchive.miniGameRecords]);
  const selectedParentFeedback = useMemo(
    () =>
      parentFeedbackRecords.find((record) => record.id === selectedParentFeedbackId) ??
      latestParentFeedbackRecords[0] ??
      null,
    [latestParentFeedbackRecords, parentFeedbackRecords, selectedParentFeedbackId],
  );
  const resultQualityChecks = useMemo(() => {
    const content = result?.content?.trim() ?? "";
    const tips = result?.tips ?? [];
    const taskContext = `${task} ${scenario}`;
    const taskSpecificCheck = (() => {
      if (/故事|绘本|角色/.test(taskContext)) {
        return {
          label: "贴合故事生成",
          ok: /故事|角色|小朋友|看一看|说一说|试一试|问题/.test(content),
        };
      }

      if (/活动|课程|方案|流程|目标/.test(taskContext)) {
        return {
          label: "包含活动结构",
          ok: /活动|目标|流程|材料|观察|导入|提问/.test(content),
        };
      }

      if (/餐|食|闽|尝|闻/.test(taskContext)) {
        return {
          label: "贴合食育内容",
          ok: /看一看|闻一闻|尝|餐|食物|食材|闽|营养/.test(content),
        };
      }

      return {
        label: "适合老师使用",
        ok: /老师|幼儿|活动|故事|提问|观察|任务/.test(content),
      };
    })();

    return [
      {
        label: "内容已生成",
        ok: content.length > 0,
      },
      {
        label: "内容不冗长",
        ok: content.length > 0 && content.length <= 220,
      },
      {
        label: "无比较惩罚",
        ok: content.length > 0 && !/不然|不能|必须|别人|批评|惩罚|快点|不乖/.test(content),
      },
      {
        label: "有清楚互动",
        ok:
          /一步|先|再|小任务|试一试|看一看|闻一闻|提问|观察|操作/.test(content) ||
          tips.some((tip) => /一步|先|再|小任务|试一试|看一看|闻一闻|提问|观察|操作/.test(tip)),
      },
      {
        label: "适合4-5岁",
        ok: content.length > 0 && !/考核|评估|指标|达标|训练强度|必须完成/.test(content),
      },
      taskSpecificCheck,
    ];
  }, [result, scenario, task]);
  const parentShareLine = useMemo(() => {
    if (!result) {
      return "";
    }

    const taskContext = `${task} ${scenario}`;

    if (/故事|绘本|角色/.test(taskContext)) {
      return "讲完故事后，可以请幼儿选一个角色动作，再说一句自己的发现。";
    }

    if (/活动|课程|方案|流程|目标/.test(taskContext)) {
      return "活动后建议保留一张观察记录：幼儿是否愿意表达、是否能完成一个关键动作。";
    }

    if (/餐|食|闽|尝|闻/.test(taskContext)) {
      return "食育活动后可以让幼儿画出一种食材，或说出“我看到了什么、闻到了什么”。";
    }

    return "可以把生成内容拆成导入、操作、分享三个环节，方便老师按班级情况调整。";
  }, [result, scenario, task]);

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
      const authSnapshot = readTeacherAuthSnapshot();

      if (authSnapshot.hasPartialAccount) {
        window.localStorage.removeItem(teacherAccountStorageKey);
        window.localStorage.removeItem(teacherPasscodeStorageKey);
        clearTeacherSession();
        setTeacherHasAccount(false);
        setTeacherAccountInput("");
        setTeacherAuthenticated(false);
        setTeacherAuthStatus("检测到本机教师账号不完整，已自动清除。请重新创建，或使用班级试用快速进入。");
        setTeacherAuthHydrated(true);
        return;
      }

      if (!authSnapshot.hasCompleteAccount || (authSnapshot.sessionAccount && authSnapshot.sessionAccount !== authSnapshot.account)) {
        clearTeacherSession();
      } else if (authSnapshot.sessionAccount === authSnapshot.account) {
        window.sessionStorage.setItem(teacherSessionStorageKey, authSnapshot.account);
      }

      setTeacherHasAccount(authSnapshot.hasCompleteAccount);
      setTeacherAccountInput(authSnapshot.account);
      setTeacherAuthenticated(
        Boolean(authSnapshot.hasCompleteAccount && authSnapshot.sessionAccount === authSnapshot.account),
      );
      setTeacherAuthStatus(
        authSnapshot.hasCompleteAccount
          ? "班级试用模式：请输入本机班级试用账号口令，验证后进入教师工作台。"
          : "班级试用模式：首次使用请先创建本机班级试用账号和口令。",
      );
      setTeacherAuthHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let syncTimer = 0;
    const watchedKeys = new Set([
      teacherAccountStorageKey,
      teacherPasscodeStorageKey,
      teacherSharedSessionStorageKey,
    ]);

    function applyTeacherAuthSnapshotFromStorage() {
      const authSnapshot = readTeacherAuthSnapshot();

      if (authSnapshot.hasPartialAccount) {
        setTeacherHasAccount(false);
        setTeacherAuthenticated(false);
        setTeacherAccountInput("");
        setTeacherPasscodeInput("");
        setTeacherAuthStatus("检测到教师账号正在同步，请稍等后重新进入；若仍异常，可重置本机教师账号。");
        return;
      }

      if (!authSnapshot.hasCompleteAccount) {
        window.sessionStorage.removeItem(teacherSessionStorageKey);
        setTeacherHasAccount(false);
        setTeacherAuthenticated(false);
        setTeacherAccountInput("");
        setTeacherPasscodeInput("");
        setTeacherAuthStatus("另一教师端已重置本机教师账号，请重新创建或使用班级试用快速进入。");
        return;
      }

      setTeacherHasAccount(true);
      setTeacherAccountInput(authSnapshot.account);

      if (authSnapshot.sessionAccount === authSnapshot.account) {
        window.sessionStorage.setItem(teacherSessionStorageKey, authSnapshot.account);
        setTeacherAuthenticated(true);
        setTeacherPasscodeInput("");
        setTeacherAuthStatus("教师账号状态已同步：本标签页已进入教师工作台。");
        return;
      }

      window.sessionStorage.removeItem(teacherSessionStorageKey);
      setTeacherAuthenticated(false);
      setTeacherPasscodeInput("");
      setTeacherAuthStatus("另一教师端已退出教师工作台，请重新输入口令后进入。");
    }

    function handleTeacherAuthStorage(event: StorageEvent) {
      if (!event.key || !watchedKeys.has(event.key)) {
        return;
      }

      if (event.key === teacherSharedSessionStorageKey && event.newValue === null) {
        window.sessionStorage.removeItem(teacherSessionStorageKey);
      }

      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(applyTeacherAuthSnapshotFromStorage, 80);
    }

    window.addEventListener("storage", handleTeacherAuthStorage);

    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener("storage", handleTeacherAuthStorage);
    };
  }, []);

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
            ageGroup?: string;
          };

          if (parsed.themeId && themes[parsed.themeId]) {
            setThemeId(parsed.themeId);
          }

          if (parsed.task) {
            setTask(parsed.task);
          }

          setTeacherAgeGroup(
            parsed.ageGroup && teacherAgeOptions.some((item) => item.label === parsed.ageGroup)
              ? parsed.ageGroup
              : defaultTeacherAgeGroup,
          );

          if (parsed.scenario) {
            setScenario(parsed.scenario);
            setDraftStatus("已恢复这台设备上次留下的教师工作台草稿。");
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
        const rawGrowthArchive = window.localStorage.getItem(growthArchiveStorageKey);
        setGrowthArchive(parseGrowthArchive(rawGrowthArchive));
        const savedRoster = parseChildRoster(window.localStorage.getItem(childRosterStorageKey));
        setChildRoster(savedRoster);
        setParentSyncRecords(parseParentSyncRecords(window.localStorage.getItem(parentSyncStorageKey)));
        setParentFeedbackRecords(
          parseParentFeedbackRecords(window.localStorage.getItem(parentFeedbackStorageKey)),
        );
        setWeeklyMenuEntries(parseWeeklyMenuEntries(window.localStorage.getItem(weeklyMenuStorageKey)));
        setDailyMenuOverrides(
          parseDailyMenuOverrides(window.localStorage.getItem(dailyMenuOverrideStorageKey)),
        );
        try {
          const rawMenuMedia = window.localStorage.getItem(menuMediaByDateMealStorageKey);
          const parsedMenuMedia = rawMenuMedia ? (JSON.parse(rawMenuMedia) as unknown) : {};

          setMenuMediaByDateMeal(
            parsedMenuMedia && typeof parsedMenuMedia === "object" && !Array.isArray(parsedMenuMedia)
              ? (parsedMenuMedia as Record<string, MenuMediaDraft>)
              : {},
          );
        } catch {
          setMenuMediaByDateMeal({});
        }
        setTeacherPictureBooks(
          parseTeacherPictureBooks(window.localStorage.getItem(teacherPictureBooksStorageKey)),
        );
        setHabitTemplates(parseHabitTemplates(window.localStorage.getItem(habitTemplatesStorageKey)));
        setAiReviewRecords(parseAiReviewRecords(window.localStorage.getItem(aiReviewRecordsStorageKey)));
        setRosterStatus(
          savedRoster.length > 0
            ? `已读取 ${savedRoster.length} 位幼儿，首页可以按姓名或号数识别身份。`
            : "还没有班级花名册。请先添加姓名和号数，儿童端记录才会对应到幼儿。",
        );

        const searchParams = new URLSearchParams(window.location.search);
        const linkedTheme = searchParams.get("theme");
        const linkedFrom = searchParams.get("from");

        if (linkedFrom === "mini-game" && (linkedTheme === "habit" || linkedTheme === "food")) {
          const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
          const hasMiniGameRecord = hasThemeMiniGameRecord(
            rawGrowthArchive,
            linkedTheme,
          );

          setThemeId(linkedTheme);
          setTask(homeTask.label);
          setScenario(
            hasMiniGameRecord
              ? buildMiniGameExtensionScenario(linkedTheme, defaultTeacherAgeGroup)
              : buildHomePlanScenario(linkedTheme, defaultTeacherAgeGroup),
          );
          setDraftStatus(
            hasMiniGameRecord
            ? "已接上儿童端互动记录，可以直接生成一节课堂跟进方案。"
              : "还没有读到儿童端互动记录，已切换为普通活动课程方案草稿。",
          );
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
        ageGroup: teacherAgeGroup,
        task,
        scenario,
      }),
    );
  }, [draftHydrated, draftStorageKey, scenario, task, teacherAgeGroup, themeId]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(aiReviewRecordsStorageKey, JSON.stringify(aiReviewRecords.slice(0, 30)));
  }, [aiReviewRecords, draftHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    if (historyReadFailedRef.current && savedResults.length === 0) {
      return;
    }

    window.localStorage.setItem(historyStorageKey, JSON.stringify(limitTeacherHistory(savedResults)));
  }, [draftHydrated, historyStorageKey, savedResults]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    const nextRoster = JSON.stringify(childRoster);

    if (window.localStorage.getItem(childRosterStorageKey) !== nextRoster) {
      window.localStorage.setItem(childRosterStorageKey, nextRoster);
    }
  }, [childRoster, draftHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(teacherPictureBooksStorageKey, JSON.stringify(teacherPictureBooks));
  }, [draftHydrated, teacherPictureBooks]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftHydrated) {
      return;
    }

    window.localStorage.setItem(habitTemplatesStorageKey, JSON.stringify(habitTemplates));
  }, [draftHydrated, habitTemplates]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleSharedClassDataStorage(event: StorageEvent) {
      if (event.key === growthArchiveStorageKey) {
        setGrowthArchive(parseGrowthArchive(event.newValue));
      }

      if (event.key === childRosterStorageKey) {
        const nextRoster = parseChildRoster(event.newValue);
        setChildRoster(nextRoster);
        setSelectedChildSummaryId((current) =>
          current && nextRoster.some((child) => child.id === current) ? current : "",
        );
        setRosterStatus(
          nextRoster.length > 0
            ? `已同步 ${nextRoster.length} 位幼儿，儿童端可以按姓名或号数识别身份。`
            : "花名册已同步为空。请先添加姓名和号数，儿童端记录才会对应到幼儿。",
        );
      }

      if (event.key === parentSyncStorageKey) {
        setParentSyncRecords(parseParentSyncRecords(event.newValue));
      }

      if (event.key === parentFeedbackStorageKey) {
        setParentFeedbackRecords(parseParentFeedbackRecords(event.newValue));
      }

      if (event.key === weeklyMenuStorageKey) {
        setWeeklyMenuEntries(parseWeeklyMenuEntries(event.newValue));
        setMenuStatus("已同步其他教师端更新的本周食谱。");
      }

      if (event.key === dailyMenuOverrideStorageKey) {
        setDailyMenuOverrides(parseDailyMenuOverrides(event.newValue));
        setOverrideStatus("已同步今日临时改餐。");
      }

      if (event.key === menuMediaByDateMealStorageKey) {
        try {
          const parsedMenuMedia = event.newValue ? (JSON.parse(event.newValue) as unknown) : {};

          setMenuMediaByDateMeal(
            parsedMenuMedia && typeof parsedMenuMedia === "object" && !Array.isArray(parsedMenuMedia)
              ? (parsedMenuMedia as Record<string, MenuMediaDraft>)
              : {},
          );
        } catch {
          setMenuMediaByDateMeal({});
        }
      }

      if (event.key === teacherPictureBooksStorageKey) {
        setTeacherPictureBooks(parseTeacherPictureBooks(event.newValue));
        setPictureBookStatus("已同步其他教师端发布的绘本。");
      }

      if (event.key === habitTemplatesStorageKey) {
        setHabitTemplates(parseHabitTemplates(event.newValue));
        setHabitTemplateStatus("已同步其他教师端创建的教师发布小任务。");
      }
    }

    window.addEventListener("storage", handleSharedClassDataStorage);

    return () => window.removeEventListener("storage", handleSharedClassDataStorage);
  }, []);

  function scrollToGenerationSection() {
    setActiveTeacherPanel("teacher-ai-generate");
  }

  function openTeacherDirectoryItem(item: SectionDirectoryItem) {
    setActiveTeacherPanel(getTeacherPanelFromHref(item.href));
  }

  function saveAiReviewRecord() {
    const content = aiReviewContent.trim();
    const note = aiReviewTeacherNote.trim();

    if (!content) {
      setAiReviewMessage("请先粘贴或输入一段 AI 生成内容，再由教师审核。");
      return;
    }

    const nextRecord: AiReviewRecord = {
      id: `ai-review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      contentType: aiReviewContentType,
      aiContent: content,
      status: aiReviewStatus,
      teacherNote: note,
      updatedAt: new Date().toISOString(),
    };

    setAiReviewRecords((current) => [nextRecord, ...current].slice(0, 30));
    setAiReviewContent("");
    setAiReviewTeacherNote("");
    setAiReviewStatus("待审核");
    setAiReviewMessage("已保存到本地审核记录；正式部署需接入后端账号系统和加密数据库。");
  }

  function reuseAiReviewRecord(record: AiReviewRecord) {
    setAiReviewContentType(record.contentType);
    setAiReviewContent(record.aiContent);
    setAiReviewStatus(record.status);
    setAiReviewTeacherNote(record.teacherNote);
    setAiReviewMessage("已取回这条审核内容，可以继续修改后再次保存。");
  }

  function removeAiReviewRecord(recordId: string) {
    setAiReviewRecords((current) => current.filter((record) => record.id !== recordId));
    setAiReviewMessage("已删除这条本地审核记录。");
  }

  function bringIntoGenerationArea(options: {
    nextThemeId: ThemeId;
    nextTask: string;
    nextScenario: string;
    statusMessage: string;
    nextResult?: TeacherResponse | null;
    pendingParentSyncRecord?: ParentSyncRecord | null;
  }) {
    setThemeId(options.nextThemeId);
    setTask(options.nextTask);
    setScenario(options.nextScenario);
    setResult(options.nextResult ?? null);
    setLatestAiDraftSnapshot(options.nextResult ?? null);
    setTeacherResultConfirmedAt("");
    setPendingParentSyncRecord(options.pendingParentSyncRecord ?? null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(options.statusMessage);
    scrollToGenerationSection();
  }

  function selectTeacherAge(nextAgeGroup: string) {
    setTeacherAgeGroup(nextAgeGroup);

    if (isActivityPlanSelected) {
      setScenario(buildHomePlanScenario(themeId, nextAgeGroup));
    }

    setDraftStatus("年龄段已更新，生成时会按对应年龄特点调整活动。");
  }

  function selectTeacherTask(item: TeacherTaskItem, statusMessage = "已切换到新的老师任务模板，会自动保存到这台设备。") {
    const nextThemeId = getThemeForTeacherTask(item, themeId);

    setThemeId(nextThemeId);
    setTask(item.label);
    setScenario(buildTeacherTaskScenario(item, nextThemeId, teacherAgeGroup));
    setPendingParentSyncRecord(null);
    setDraftStatus(statusMessage);
  }

  async function generate(
    overrides: Partial<{
      scenario: string;
      task: string;
      themeId: ThemeId;
      ageGroup: string;
    }> = {},
  ) {
    const requestScenario = overrides.scenario ?? scenario;
    const requestTask = overrides.task ?? task;
    const requestThemeId = overrides.themeId ?? themeId;
    const requestAgeGroup = overrides.ageGroup ?? teacherAgeGroup;
    const cleanScenario = requestScenario.trim();

    if (!cleanScenario) {
      setDraftStatus("先输入跟进建议、课堂活动、家园同步话术或鼓励语需求，再点击“AI生成建议”。");
      return;
    }

    if (cleanScenario.length > teacherScenarioMaxLength) {
      setDraftStatus(`场景描述太长了，请控制在 ${teacherScenarioMaxLength} 个字以内。`);
      return;
    }

    setIsLoading(true);
    try {
      const requestInput = buildTeacherRequestInput(
        requestTask,
        cleanScenario,
        requestAgeGroup,
        requestThemeId,
      );
      const controller = new AbortController();
      const timeoutHandle = window.setTimeout(() => controller.abort(), 8_000);
      let response: Response;

      try {
        response = await fetch("/api/story", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            mode: "teacher",
            theme: requestThemeId,
            userInput: requestInput,
            teacherTask: requestTask,
          }),
        });
      } finally {
        window.clearTimeout(timeoutHandle);
      }

      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "生成接口暂时不可用。";
        const fallbackResult: TeacherResponse = {
          ...buildTeacherClientFallback(requestTask, requestInput),
          error: errorMessage,
          fallbackUsed: true,
          needsReview: true,
        };
        setResult(fallbackResult);
        setLatestAiDraftSnapshot(fallbackResult);
        setTeacherResultConfirmedAt("");
        setDraftStatus("这次生成接口未正常返回，已显示备用草稿，但不会保存到历史。");
        setCopyStatus("");
        setVoiceStatus("");
        return;
      }

      const normalized = normalizeTeacherPayload(payload);

      if (!normalized) {
        const fallbackResult: TeacherResponse = {
          ...buildTeacherClientFallback(requestTask, requestInput),
          error: "返回结构不完整，已切换为备用内容。",
          fallbackUsed: true,
          needsReview: true,
        };
        setResult(fallbackResult);
        setLatestAiDraftSnapshot(fallbackResult);
        setTeacherResultConfirmedAt("");
        setDraftStatus("这次返回结构没有通过检查，已显示备用草稿，但不会保存到历史。");
        setCopyStatus("");
        setVoiceStatus("");
        return;
      }

      const fallbackUsed =
        Boolean(normalized.error) || isTeacherFallbackPayload(normalized, requestTask, requestInput);
      const data: TeacherResponse = {
        ...normalized,
        fallbackUsed,
        needsReview: true,
      };
      const savedAt = new Date().toISOString();
      const nextId = `${savedAt}-${requestThemeId}-${requestTask}`;
      setResult(data);
      setLatestAiDraftSnapshot(data);
      setTeacherResultConfirmedAt("");
      setCopyStatus("");
      setVoiceStatus("");

      if (fallbackUsed) {
        setDraftStatus(
          normalized.error
            ? "这次生成使用了备用草稿，需教师修改确认后使用，但不会保存到历史。"
            : "检测到当前是本地备用草稿，需教师修改确认后使用，但不会保存到历史。",
        );
        return;
      }

      historyReadFailedRef.current = false;
      setSavedResults((current) => {
        const nextHistory = limitTeacherHistory([
          {
            ...data,
            id: nextId,
            themeId: requestThemeId,
            task: requestTask,
            scenario: requestScenario,
            savedAt,
            pinned: false,
          },
          ...current,
        ]);
        const resultSaved = nextHistory.some((item) => item.id === nextId);

        setDraftStatus(
          resultSaved
            ? "AI生成建议已保存到本机历史，需教师修改确认后使用。"
            : "AI生成建议已显示。当前历史固定收藏已满，这次结果不会自动挤掉固定内容。",
        );

        return nextHistory;
      });
    } catch {
      const fallbackResult: TeacherResponse = {
        ...buildTeacherClientFallback(
          requestTask,
          buildTeacherRequestInput(requestTask, cleanScenario, requestAgeGroup, requestThemeId),
        ),
        error: "生成暂时失败，已切换为备用内容。",
        fallbackUsed: true,
        needsReview: true,
      };
      setResult(fallbackResult);
      setLatestAiDraftSnapshot(fallbackResult);
      setTeacherResultConfirmedAt("");
      setDraftStatus("生成暂时失败了，已显示备用草稿；这次结果不会保存到历史。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!result) {
      return;
    }

    const text = buildTeacherCopyText(result, parentShareLine, task, scenario, themeId);

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("已按标题、生成内容、活动延伸和使用建议分段复制。");
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
    setTeacherAgeGroup(defaultTeacherAgeGroup);
    setTask(defaultTeacherTask.label);
    setScenario(buildHomePlanScenario("habit", defaultTeacherAgeGroup));
    setResult(null);
    setLatestAiDraftSnapshot(null);
    setTeacherResultConfirmedAt("");
    setPendingParentSyncRecord(null);
    setCopyStatus("");
    setVoiceStatus("");
    setDraftStatus(statusMessage);
  }

  function clearTeacherDraft() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认清空这台设备上的教师工作台草稿吗？当前输入会恢复为默认内容。")
    ) {
      setDraftStatus("已取消清空草稿，当前内容继续保留。");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }

    resetTeacherDraft("这台设备上的教师工作台草稿已经清空。");
  }

  function reuseSavedResult(item: SavedTeacherResult) {
    setThemeId(item.themeId);
    setTask(item.task);
    setTeacherAgeGroup(resolveTeacherAgeGroup(item.scenario));
    setScenario(item.scenario);
    const reusedResult: TeacherResponse = {
      title: item.title,
      content: item.content,
      tips: item.tips,
      error: item.error,
      fallbackUsed: item.fallbackUsed,
      needsReview: true,
    };

    setResult(reusedResult);
    setLatestAiDraftSnapshot(reusedResult);
    setTeacherResultConfirmedAt("");
    setPendingParentSyncRecord(null);
    setDraftStatus("已套用一条历史生成结果，可以继续修改或换一版。");
  }

  function saveParentSyncRecord(record: ParentSyncRecord) {
    setParentSyncRecords((current) => {
      const nextRecords = [record, ...current.filter((item) => item.id !== record.id)].slice(0, 24);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentSyncStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
  }

  function buildParentSyncDraftResult(record: ParentSyncRecord): TeacherResponse {
    return {
      title: record.title,
      content: `${record.summary}\n\n家庭小任务：${record.homePractice}`,
      tips: ["教师先改称呼和细节。", "确认不贴标签。", "确认后再同步家长端。"],
      needsReview: true,
    };
  }

  function confirmPendingParentSync() {
    if (!pendingParentSyncRecord || !result) {
      setParentSyncStatus("请先从幼儿记录生成家园同步草稿，再确认同步家长。");
      return;
    }

    const editedTitle = result.title.trim() || pendingParentSyncRecord.title;
    const editedContent = result.content.trim() || pendingParentSyncRecord.summary;
    const nextRecord: ParentSyncRecord = {
      ...pendingParentSyncRecord,
      title: editedTitle,
      summary: editedContent,
      strategy: result.tips?.[0] ?? pendingParentSyncRecord.strategy,
      syncedAt: new Date().toISOString(),
    };

    saveParentSyncRecord(nextRecord);
    setResult((current) => (current ? { ...current, needsReview: false } : current));
    setTeacherResultConfirmedAt(new Date().toISOString());
    setPendingParentSyncRecord(null);
    setParentSyncStatus(`${nextRecord.childName} 的家园同步内容已由教师确认并同步家长端。`);
    setCopyStatus("确认并同步家长完成。");
  }

  function syncMiniGameRecordToParent(record: MiniGameRecord) {
    const parentRecord = buildParentSyncFromMiniGame(record);

    if (!parentRecord) {
      setParentSyncStatus("这条互动记录没有绑定幼儿身份，无法同步到家庭延续。请先让幼儿选择姓名或号数。");
      return;
    }

    const parentTask = teacherTasks.find((item) => item.id === "parent-sync") ?? teacherTasks[0];
    bringIntoGenerationArea({
      nextThemeId: record.themeId,
      nextTask: parentTask.label,
      nextScenario: `请生成一段家园同步话术，老师确认后再发给家长。\n孩子：${parentRecord.childName}\n今日表现：${parentRecord.summary}\n家庭小任务：${parentRecord.homePractice}`,
      statusMessage: "已生成家园同步草稿，教师修改确认后才能同步家长端。",
      nextResult: buildParentSyncDraftResult(parentRecord),
      pendingParentSyncRecord: parentRecord,
    });
  }

  function syncFoodPreferenceRecordToParent(record: FoodPreferenceRecord) {
    const parentRecord = buildParentSyncFromFoodPreference(record);

    if (!parentRecord) {
      setParentSyncStatus("这条美食认识记录没有绑定幼儿身份，无法同步到家庭延续。请先让幼儿选择姓名或号数。");
      return;
    }

    const parentTask = teacherTasks.find((item) => item.id === "parent-sync") ?? teacherTasks[0];
    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: parentTask.label,
      nextScenario: `请生成一段闽食进餐观察的家园同步话术，老师确认后再发给家长。\n孩子：${parentRecord.childName}\n今日表现：${parentRecord.summary}\n家庭小任务：${parentRecord.homePractice}`,
      statusMessage: "已生成闽食家园同步草稿，教师修改确认后才能同步家长端。",
      nextResult: buildParentSyncDraftResult(parentRecord),
      pendingParentSyncRecord: parentRecord,
    });
  }

  function getMiniGameRecordByInsightKey(recordKey: string) {
    return growthArchive.miniGameRecords.find(
      (record) => getMiniGameInsightKey(record) === recordKey,
    );
  }

  function getFoodPreferenceRecordByInsightKey(recordKey: string) {
    return growthArchive.foodPreferenceRecords.find(
      (record) => getFoodPreferenceInsightKey(record) === recordKey,
    );
  }

  function generateAiFocusPlan(kind: "game" | "food", recordKey: string) {
    if (kind === "game") {
      const record = getMiniGameRecordByInsightKey(recordKey);

      if (record) {
        generateMiniGamePlan(record);
      }

      return;
    }

    const record = getFoodPreferenceRecordByInsightKey(recordKey);

    if (record) {
      generateFoodPreferencePlan(record);
    }
  }

  function generateAiFocusEncouragement(kind: "game" | "food", recordKey: string) {
    if (kind === "game") {
      const record = getMiniGameRecordByInsightKey(recordKey);

      if (record) {
        generateMiniGameEncouragement(record);
      }

      return;
    }

    const record = getFoodPreferenceRecordByInsightKey(recordKey);

    if (record) {
      generateFoodPreferenceEncouragement(record);
    }
  }

  function bringFoodSummaryToGeneration(
    row: (typeof foodObservationSummaryRows)[number],
    mode: "food-follow" | "activity" | "parent-sync",
  ) {
    const taskItem = teacherTasks.find((item) => item.id === mode) ?? teacherTasks[0];
    const childNames = row.childNames.length > 0 ? row.childNames.join("、") : "未选择身份";
    const scenarioByMode: Record<"food-follow" | "activity" | "parent-sync", string> = {
      "food-follow": `班级食物观察汇总：${row.foodLabel}出现 ${row.count} 条记录，主要原因是“${row.topReason}”，涉及幼儿：${childNames}。推荐靠近小步：${row.recommendedStep}。请生成温和食育跟进建议，不贴挑食标签，包含教师口令、区域活动和观察点。`,
      activity: `请基于班级食物观察生成一节幼儿园课堂活动方案。食物：${row.foodLabel}；高频原因：${row.topReason}；涉及幼儿：${childNames}；推荐靠近小步：${row.recommendedStep}。要求包含导入、感知/操作、互动表达、生活迁移、家园延伸。`,
      "parent-sync": `请生成家园同步话术。班级里有幼儿正在认识“${row.foodLabel}”，常见原因是“${row.topReason}”，建议回家轻轻做一步：${row.recommendedStep}。话术要温和、具体，不直接写孩子不喜欢。`,
    };

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: taskItem.label,
      nextScenario: scenarioByMode[mode],
      statusMessage: `已把“${row.foodLabel}”班级食物观察汇总带入跟进生成区。`,
    });
  }

  function updateWeeklyMenuEntries(updater: (records: WeeklyMenuEntry[]) => WeeklyMenuEntry[]) {
    setWeeklyMenuEntries((current) => {
      const nextRecords = updater(current).slice(0, 80);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(weeklyMenuStorageKey, serializeWeeklyMenuEntries(nextRecords));
      }

      return nextRecords;
    });
  }

  function updateDailyMenuOverrides(updater: (records: DailyMenuOverrideEntry[]) => DailyMenuOverrideEntry[]) {
    setDailyMenuOverrides((current) => {
      const nextRecords = updater(current).slice(0, 40);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(dailyMenuOverrideStorageKey, serializeDailyMenuOverrides(nextRecords));
      }

      return nextRecords;
    });
  }

  function setMenuMediaActiveTarget(date: string, mealType: MealType) {
    setMenuMediaActiveDate(date || todayMenuDateKey);
    setMenuMediaActiveMealType(mealType);
  }

  function getExistingMenuMediaEntry(date: string, mealType: MealType) {
    return getEffectiveMenuForDate(weeklyMenuEntries, dailyMenuOverrides, date).find(
      (entry) => entry.mealType === mealType,
    );
  }

  function buildMenuMediaDraftFromEntry(entry?: WeeklyMenuEntry | DailyMenuOverrideEntry): MenuMediaDraft {
    if (!entry?.observationImages?.length) {
      return { ...emptyMenuMediaDraft };
    }

    const candidates = entry.observationImages.slice(0, 12);
    const confirmedImages = candidates.filter((image) => image.teacherConfirmed).slice(0, 6);
    const selectedIds = (confirmedImages.length > 0 ? confirmedImages : candidates).map((image) => image.id).slice(0, 6);
    const coverId =
      candidates.find((image) => image.url === entry.coverImageUrl)?.id ??
      selectedIds[0] ??
      "";

    return {
      videoName: "",
      videoUrl: entry.videoUrl ?? "",
      candidates,
      selectedIds,
      coverId,
      confirmedImages,
      confirmedCoverUrl: entry.coverImageUrl ?? confirmedImages[0]?.url ?? "",
      confirmedAt: entry.publishedAt ?? entry.createdAt,
      status:
        confirmedImages.length > 0
          ? "已确认，儿童端可以看见这些观察图。"
          : "已有候选观察图，请教师选择主图和观察图后确认。",
    };
  }

  function getMenuMediaDraftFor(date: string, mealType: MealType) {
    const { dishName } = getMenuMediaValues(date, mealType);
    const key = createMenuDateMealKey(date, mealType, dishName);
    const legacyKey = createLegacyMenuDateMealKey(date, mealType);
    return (
      menuMediaByDateMeal[key] ??
      menuMediaByDateMeal[legacyKey] ??
      buildMenuMediaDraftFromEntry(getExistingMenuMediaEntry(date, mealType))
    );
  }

  function persistMenuMediaByDateMeal(nextRecords: Record<string, MenuMediaDraft>) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(menuMediaByDateMealStorageKey, JSON.stringify(nextRecords));
    }
  }

  function updateMenuMediaDraftFor(
    date: string,
    mealType: MealType,
    updater: (draft: MenuMediaDraft) => MenuMediaDraft,
  ) {
    const { dishName } = getMenuMediaValues(date, mealType);
    const key = createMenuDateMealKey(date, mealType, dishName);

    setMenuMediaByDateMeal((current) => {
      const currentDraft = current[key] ?? buildMenuMediaDraftFromEntry(getExistingMenuMediaEntry(date, mealType));
      const nextDraft = updater(currentDraft);
      const nextRecords = {
        ...current,
        [key]: nextDraft,
      };

      persistMenuMediaByDateMeal(nextRecords);
      return nextRecords;
    });
  }

  function setMenuMediaStatus(message: string, date = menuMediaActiveDate, mealType = menuMediaActiveMealType) {
    updateMenuMediaDraftFor(date, mealType, (draft) => ({
      ...draft,
      status: message,
    }));
  }

  function getMenuMediaValues(date: string, mealType: MealType) {
    const matchesOverride = date === (overrideDate || todayMenuDateKey) && mealType === overrideMealType;
    const matchesWeekly = date === menuDate && mealType === menuMealType;

    if (matchesOverride && (overrideDishName.trim() || overrideIngredients.trim())) {
      return {
        dishName: overrideDishName.trim().slice(0, 24),
        ingredients: splitMenuText(overrideIngredients),
      };
    }

    if (matchesWeekly && (menuDishName.trim() || menuIngredients.trim())) {
      return {
        dishName: menuDishName.trim().slice(0, 24),
        ingredients: splitMenuText(menuIngredients),
      };
    }

    const existingEntry = getExistingMenuMediaEntry(date, mealType);

    return {
      dishName: existingEntry?.dishName.trim().slice(0, 24) ?? "",
      ingredients: existingEntry?.ingredients ?? [],
    };
  }

  function clearMenuMediaDraft() {
    const { dishName } = getMenuMediaValues(menuMediaActiveDate, menuMediaActiveMealType);
    const key = createMenuDateMealKey(menuMediaActiveDate, menuMediaActiveMealType, dishName);
    const matchesCurrentMediaTarget = (entry: WeeklyMenuEntry | DailyMenuOverrideEntry) =>
      entry.date === menuMediaActiveDate &&
      entry.mealType === menuMediaActiveMealType &&
      (!dishName || entry.dishName === dishName);

    setMenuMediaByDateMeal((current) => {
      const nextRecords = {
        ...current,
        [key]: createEmptyMenuMediaDraft("已清空当前日期和餐次的观察素材。"),
      };
      persistMenuMediaByDateMeal(nextRecords);
      return nextRecords;
    });
    updateWeeklyMenuEntries((current) =>
      current.map((entry) =>
        matchesCurrentMediaTarget(entry)
          ? {
              ...entry,
              videoUrl: undefined,
              coverImageUrl: undefined,
              observationImages: [],
              mediaSource: undefined,
              teacherConfirmed: false,
            }
          : entry,
      ),
    );
    updateDailyMenuOverrides((current) =>
      current.map((entry) =>
        matchesCurrentMediaTarget(entry)
          ? {
              ...entry,
              videoUrl: undefined,
              coverImageUrl: undefined,
              observationImages: [],
              mediaSource: undefined,
              teacherConfirmed: false,
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
  }

  async function handleMenuVideoUpload(file?: File) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("video/")) {
      setMenuMediaStatus("请选择今日食谱或闽食播报视频文件。");
      return;
    }

    const date = menuMediaActiveDate;
    const mealType = menuMediaActiveMealType;
    const { dishName, ingredients } = getMenuMediaValues(date, mealType);

    updateMenuMediaDraftFor(date, mealType, (draft) => ({
      ...draft,
      status: "正在从视频中抽取观察图片，请稍等。",
    }));

    try {
      const { videoUrl, frames } = await extractMenuObservationFrames(file, dishName, ingredients);

      if (frames.length === 0) {
        updateMenuMediaDraftFor(date, mealType, (draft) => ({
          ...draft,
          videoName: file.name,
          videoUrl,
          status: "暂未抽到清晰图片，可上传观察图片或使用 AI 补图备用。",
        }));
        return;
      }

      updateMenuMediaDraftFor(date, mealType, (draft) => {
        const candidates = [...frames, ...draft.candidates].slice(0, 12);
        const selectedIds = Array.from(new Set([...frames.map((image) => image.id), ...draft.selectedIds])).slice(0, 6);

        return {
          ...draft,
          videoName: file.name,
          videoUrl,
          candidates,
          selectedIds,
          coverId: draft.coverId || frames[0]?.id || "",
          confirmedImages: [],
          confirmedCoverUrl: "",
          confirmedAt: "",
          status: `已从今天视频里抽取 ${frames.length} 张候选图，请选择主图和观察图后确认发布。`,
        };
      });
    } catch (error) {
      updateMenuMediaDraftFor(date, mealType, (draft) => ({
        ...draft,
        videoName: file.name,
        status: error instanceof Error ? error.message : "视频抽帧失败，可上传观察图片或使用 AI 补图备用。",
      }));
    }
  }

  async function handleMenuManualImageUpload(file?: File) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMenuMediaStatus("请选择菜品或食材图片文件。");
      return;
    }

    const date = menuMediaActiveDate;
    const mealType = menuMediaActiveMealType;
    const { dishName } = getMenuMediaValues(date, mealType);

    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      const image: MenuObservationImage = {
        id: createMenuMediaId("teacher-image"),
        url: imageUrl,
        label: `${dishName || "今日食谱"}教师确认观察图`,
        mediaSource: "teacher_uploaded",
        sourceType: "teacher_uploaded",
        teacherConfirmed: false,
        createdAt: new Date().toISOString(),
      };

      updateMenuMediaDraftFor(date, mealType, (draft) => ({
        ...draft,
        candidates: [image, ...draft.candidates].slice(0, 12),
        selectedIds: Array.from(new Set([image.id, ...draft.selectedIds])).slice(0, 6),
        coverId: draft.coverId || image.id,
        confirmedImages: [],
        confirmedCoverUrl: "",
        confirmedAt: "",
        status: "已加入教师确认图片，请确认后再发布到儿童端。",
      }));
    } catch (error) {
      setMenuMediaStatus(error instanceof Error ? error.message : "图片读取失败，请重新选择。", date, mealType);
    }
  }

  async function requestMenuAiObservationImage(prompt: string) {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        size: "1024x1024",
      }),
    });
    const data = (await response.json()) as { imageUrl?: string; url?: string; error?: string };
    const imageUrl = data.imageUrl || data.url;

    if (!response.ok || !imageUrl) {
      throw new Error(data.error || "AI 补图失败，请上传观察图片。");
    }

    return imageUrl;
  }

  async function generateMenuAiObservationImage() {
    const date = menuMediaActiveDate;
    const mealType = menuMediaActiveMealType;
    const currentDraft = getMenuMediaDraftFor(date, mealType);
    const hasRealImage = currentDraft.candidates.some((image) => image.mediaSource !== "ai_generated");

    if (hasRealImage) {
      setMenuMediaStatus("已有今天视频里的图或教师确认图片，AI 补图只在没有真实图片时使用。", date, mealType);
      return;
    }

    const { dishName, ingredients } = getMenuMediaValues(date, mealType);

    if (!dishName) {
      setMenuMediaStatus("请先填写菜品名称，再使用 AI 补图。", date, mealType);
      return;
    }

    const prompt = buildMenuMediaPrompt(dishName, ingredients);

    setIsMenuMediaAiImageLoading(true);
    updateMenuMediaDraftFor(date, mealType, (draft) => ({
      ...draft,
      status: "AI 正在补一张备用观察图；生成后仍需教师确认。",
    }));

    try {
      const imageUrl = await requestMenuAiObservationImage(prompt);

      const image: MenuObservationImage = {
        id: createMenuMediaId("ai-menu-image"),
        url: imageUrl,
        label: `AI补图：${dishName}`,
        mediaSource: "ai_generated",
        sourceType: "ai_generated_teacher_confirmed",
        teacherConfirmed: false,
        createdAt: new Date().toISOString(),
        aiPrompt: prompt,
      };

      updateMenuMediaDraftFor(date, mealType, (draft) => ({
        ...draft,
        candidates: [image, ...draft.candidates].slice(0, 12),
        selectedIds: Array.from(new Set([image.id, ...draft.selectedIds])).slice(0, 6),
        coverId: draft.coverId || image.id,
        confirmedImages: [],
        confirmedCoverUrl: "",
        confirmedAt: "",
        status: "AI 补图已生成，必须标记“AI生成，教师确认后使用”，确认后才会发布。",
      }));
    } catch (error) {
      updateMenuMediaDraftFor(date, mealType, (draft) => ({
        ...draft,
        status: error instanceof Error ? error.message : "AI 补图失败，请上传观察图片。",
      }));
    } finally {
      setIsMenuMediaAiImageLoading(false);
    }
  }

  function updateMenuAiImagePrompt(imageId: string, prompt: string) {
    updateMenuMediaDraftFor(menuMediaActiveDate, menuMediaActiveMealType, (draft) => ({
      ...draft,
      candidates: draft.candidates.map((image) =>
        image.id === imageId
          ? {
              ...image,
              aiPrompt: prompt,
              teacherConfirmed: false,
            }
          : image,
      ),
      confirmedImages: [],
      confirmedCoverUrl: "",
      confirmedAt: "",
      status: "图片描述已修改，可在这张图下方重新生成；确认前儿童端看不到。",
    }));
  }

  async function regenerateMenuAiObservationImage(imageId: string) {
    const date = menuMediaActiveDate;
    const mealType = menuMediaActiveMealType;
    const draft = getMenuMediaDraftFor(date, mealType);
    const { dishName, ingredients } = getMenuMediaValues(date, mealType);
    const targetImage = draft.candidates.find((image) => image.id === imageId);

    if (!targetImage || targetImage.mediaSource !== "ai_generated") {
      setMenuMediaStatus("请选择一张 AI 补图后再重新生成。", date, mealType);
      return;
    }

    const prompt = targetImage.aiPrompt || buildMenuMediaPrompt(dishName, ingredients);

    if (!prompt.trim()) {
      setMenuMediaStatus("请先写清图片描述，再重新生成。", date, mealType);
      return;
    }

    setIsMenuMediaAiImageLoading(true);
    updateMenuMediaDraftFor(date, mealType, (current) => ({
      ...current,
      status: "正在按修改后的图片描述重新生成；确认前儿童端看不到。",
    }));

    try {
      const imageUrl = await requestMenuAiObservationImage(prompt);

      updateMenuMediaDraftFor(date, mealType, (current) => ({
        ...current,
        candidates: current.candidates.map((image) =>
          image.id === imageId
            ? {
                ...image,
                url: imageUrl,
                label: `AI补图：${dishName || "今日食谱"}`,
                aiPrompt: prompt,
                teacherConfirmed: false,
                createdAt: new Date().toISOString(),
              }
            : image,
        ),
        selectedIds: Array.from(new Set([imageId, ...current.selectedIds])).slice(0, 6),
        coverId: imageId,
        confirmedImages: [],
        confirmedCoverUrl: "",
        confirmedAt: "",
        status: "已按新描述重新生成，请点击“使用这张”并确认观察图片发布。",
      }));
    } catch (error) {
      setMenuMediaStatus(error instanceof Error ? error.message : "AI 补图失败，请上传观察图片。", date, mealType);
    } finally {
      setIsMenuMediaAiImageLoading(false);
    }
  }

  function useMenuObservationImage(imageId: string) {
    updateMenuMediaDraftFor(menuMediaActiveDate, menuMediaActiveMealType, (draft) => ({
      ...draft,
      selectedIds: [imageId],
      coverId: imageId,
      confirmedImages: [],
      confirmedCoverUrl: "",
      confirmedAt: "",
      status: "已选择这张观察图。还需要点击“确认观察图片发布”，儿童端才可见。",
    }));
  }

  function deleteMenuObservationImage(imageId: string) {
    updateMenuMediaDraftFor(menuMediaActiveDate, menuMediaActiveMealType, (draft) => {
      const candidates = draft.candidates.filter((image) => image.id !== imageId);
      const selectedIds = draft.selectedIds.filter((id) => id !== imageId);
      const coverId = draft.coverId === imageId ? selectedIds[0] ?? "" : draft.coverId;

      return {
        ...draft,
        candidates,
        selectedIds,
        coverId,
        confirmedImages: [],
        confirmedCoverUrl: "",
        confirmedAt: "",
        status: candidates.length > 0 ? "已删除这张候选图，请重新确认观察图片。" : "还没有观察图片，可以上传视频、上传图片，或让 AI 补一张图。",
      };
    });
  }

  function toggleMenuObservationImage(imageId: string) {
    updateMenuMediaDraftFor(menuMediaActiveDate, menuMediaActiveMealType, (draft) => {
      const selectedIds = draft.selectedIds.includes(imageId)
        ? draft.selectedIds.filter((id) => id !== imageId)
        : [...draft.selectedIds, imageId].slice(0, 6);
      const coverId = selectedIds.includes(draft.coverId) ? draft.coverId : selectedIds[0] ?? "";

      return {
        ...draft,
        selectedIds,
        coverId,
        confirmedImages: [],
        confirmedCoverUrl: "",
        confirmedAt: "",
        status: selectedIds.length > 0 ? "已更新候选观察图，请确认后发布。" : "请至少选择一张观察图。",
      };
    });
  }

  function setMenuCoverImage(imageId: string) {
    updateMenuMediaDraftFor(menuMediaActiveDate, menuMediaActiveMealType, (draft) => ({
      ...draft,
      coverId: imageId,
      selectedIds: draft.selectedIds.includes(imageId) ? draft.selectedIds : [imageId, ...draft.selectedIds].slice(0, 6),
      confirmedImages: [],
      confirmedCoverUrl: "",
      confirmedAt: "",
      status: "已设置今日食谱主图，请确认后发布。",
    }));
  }

  function confirmMenuObservationImages() {
    const date = menuMediaActiveDate;
    const mealType = menuMediaActiveMealType;
    const { dishName } = getMenuMediaValues(date, mealType);
    const draft = getMenuMediaDraftFor(date, mealType);
    const selectedImages = draft.candidates
      .filter((image) => draft.selectedIds.includes(image.id))
      .slice(0, 6)
      .map((image) => ({ ...image, teacherConfirmed: true }));

    if (selectedImages.length === 0) {
      setMenuMediaStatus("请先选择至少一张观察图。", date, mealType);
      return;
    }

    const coverImage = selectedImages.find((image) => image.id === draft.coverId) ?? selectedImages[0];
    const confirmedAt = new Date().toISOString();

    updateMenuMediaDraftFor(date, mealType, (current) => ({
      ...current,
      confirmedImages: selectedImages,
      confirmedCoverUrl: coverImage.url,
      confirmedAt,
      status: "已确认，儿童端可以看见这些观察图。",
    }));
    const mediaFields = buildConfirmedMenuMediaFields({
      ...draft,
      confirmedImages: selectedImages,
      confirmedCoverUrl: coverImage.url,
      confirmedAt,
    });
    const matchesCurrentMediaTarget = (entry: WeeklyMenuEntry | DailyMenuOverrideEntry) =>
      entry.date === date && entry.mealType === mealType && (!dishName || entry.dishName === dishName);
    updateWeeklyMenuEntries((current) =>
      current.map((entry) => (matchesCurrentMediaTarget(entry) ? { ...entry, ...mediaFields } : entry)),
    );
    updateDailyMenuOverrides((current) =>
      current.map((entry) =>
        matchesCurrentMediaTarget(entry)
          ? { ...entry, ...mediaFields, updatedAt: confirmedAt }
          : entry,
      ),
    );
  }

  function saveWeeklyMenuEntry() {
    const dishName = menuDishName.trim().slice(0, 24);
    const ingredients = splitMenuText(menuIngredients);
    const focusIngredients = splitMenuText(menuFocusIngredients);

    if (!menuDate) {
      setMenuStatus("请先选择日期。");
      return;
    }

    if (!dishName) {
      setMenuStatus("请填写菜品名称。");
      return;
    }

    if (ingredients.length === 0) {
      setMenuStatus("请至少填写一种主要食材。");
      return;
    }

    const menuMediaDraftForEntry = getMenuMediaDraftFor(menuDate, menuMealType);
    const menuMedia = buildConfirmedMenuMediaFields(menuMediaDraftForEntry);

    if (menuMediaDraftForEntry.candidates.length > 0 && !menuMedia.teacherConfirmed) {
      setMenuStatus("已生成候选观察图，请先点击“确认观察图片发布”；未确认图片不会进入儿童端。");
      return;
    }

    const nextEntry: WeeklyMenuEntry = {
      id: `menu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: menuDate,
      mealType: menuMealType,
      dishName,
      ingredients,
      focusIngredients: focusIngredients.length > 0 ? focusIngredients : ingredients.slice(0, 2),
      createdAt: new Date().toISOString(),
      ...menuMedia,
    };

    updateWeeklyMenuEntries((current) => [nextEntry, ...current]);
    setMenuDishName("");
    setMenuIngredients("");
    setMenuFocusIngredients("");
    setMenuStatus(
      `${menuDate} ${menuMealType}「${dishName}」已保存；到对应日期会自动进入儿童端今日播报，并优先成为观察卡选项。${
        menuMedia.teacherConfirmed ? "已附带教师确认的观察图片。" : ""
      }`,
    );
  }

  function publishTodayMenuToChildren() {
    const menuPreviewDate = overrideDate || todayMenuDateKey;
    const todayEntries = getEffectiveMenuForDate(weeklyMenuEntries, dailyMenuOverrides, menuPreviewDate);

    if (todayEntries.length === 0) {
      setMenuStatus("这个日期还没有录入食谱，请先保存对应日期的早餐、午餐或点心。");
      return;
    }

    setMenuStatus(`${formatMenuDate(menuPreviewDate)} ${getWeekdayLabel(menuPreviewDate)} ${todayEntries.length} 条食谱已生效；临时改餐会优先覆盖同餐次。`);
  }

  function removeWeeklyMenuEntry(entryId: string) {
    updateWeeklyMenuEntries((current) => current.filter((entry) => entry.id !== entryId));
    setMenuStatus("已从本周食谱中移除这条记录。");
  }

  function loadDailyOverrideDraft(nextDate: string, nextMealType: MealType) {
    const existing = dailyMenuOverrides.find(
      (entry) => entry.date === nextDate && entry.mealType === nextMealType,
    );

    setOverrideDishName(existing?.dishName ?? "");
    setOverrideIngredients(existing?.ingredients.join("、") ?? "");
    setOverrideFocusIngredients(existing?.focusIngredients.join("、") ?? "");
    setMenuMediaActiveTarget(nextDate, nextMealType);
    setOverrideStatus(
      existing
        ? `已载入 ${formatMenuDate(nextDate)} ${getWeekdayLabel(nextDate)} ${nextMealType} 的临时改餐，可修改后重新保存。`
        : `${formatMenuDate(nextDate)} ${getWeekdayLabel(nextDate)} ${nextMealType} 暂无临时改餐，可直接填写。`,
    );
  }

  function saveDailyMenuOverride() {
    const dishName = overrideDishName.trim().slice(0, 24);
    const ingredients = splitMenuText(overrideIngredients);
    const focusIngredients = splitMenuText(overrideFocusIngredients);

    if (!dishName) {
      setOverrideStatus("请填写临时改餐菜品。");
      return;
    }

    if (ingredients.length === 0) {
      setOverrideStatus("请至少填写一种临时改餐食材。");
      return;
    }

    const targetDate = overrideDate || todayMenuDateKey;
    const overrideMediaDraftForEntry = getMenuMediaDraftFor(targetDate, overrideMealType);
    const overrideMedia = buildConfirmedMenuMediaFields(overrideMediaDraftForEntry);

    if (overrideMediaDraftForEntry.candidates.length > 0 && !overrideMedia.teacherConfirmed) {
      setOverrideStatus("已生成临时改餐候选观察图，请先点击“确认观察图片发布”。");
      return;
    }

    const now = new Date().toISOString();
    const overrideEntry: DailyMenuOverrideEntry = {
      id: `daily-override-${targetDate}-${overrideMealType}`,
      overrideId: `daily-override-${targetDate}-${overrideMealType}`,
      date: targetDate,
      mealType: overrideMealType,
      dishName,
      ingredients,
      focusIngredients: focusIngredients.length > 0 ? focusIngredients : ingredients.slice(0, 2),
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      source: "dailyOverride",
      ...overrideMedia,
    };

    updateDailyMenuOverrides((current) => [
      overrideEntry,
      ...current.filter((entry) => !(entry.date === targetDate && entry.mealType === overrideMealType)),
    ]);
    setOverrideStatus(
      `已临时更改 ${formatMenuDate(targetDate)} ${getWeekdayLabel(targetDate)} ${overrideMealType} 为「${dishName}」。儿童端到对应日期会优先显示“临时改餐”。${
        overrideMedia.teacherConfirmed ? "已附带教师确认的观察图片。" : ""
      }`,
    );
  }

  function removeDailyMenuOverride(overrideId: string) {
    const removed = dailyMenuOverrides.find((entry) => entry.overrideId === overrideId);
    updateDailyMenuOverrides((current) => current.filter((entry) => entry.overrideId !== overrideId));

    if (removed && removed.date === overrideDate && removed.mealType === overrideMealType) {
      setOverrideDishName("");
      setOverrideIngredients("");
      setOverrideFocusIngredients("");
    }

    setOverrideStatus(
      removed
        ? `已删除 ${formatMenuDate(removed.date)} ${getWeekdayLabel(removed.date)} ${removed.mealType} 的临时改餐，只恢复这一餐的本周食谱。`
        : "已删除临时改餐，只恢复对应日期餐次的本周食谱。",
    );
  }

  async function fillPictureBookFromResult() {
    const draftTitle = (pictureBookTitle.trim() || result?.title || "好习惯原创绘本").slice(0, 36);
    const teacherIdea = pictureBookText.trim();

    if (!draftTitle.trim()) {
      setPictureBookStatus("请先输入原创绘本名或大概内容，再生成故事建议。");
      return;
    }

    setPictureBookStatus("AI正在整理原创绘本故事，请稍等。");

    let draftStory = result?.content?.trim() || "";

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "teacher",
          theme: "habit",
          teacherTask: "故事/绘本引导",
          userInput: [
            `绘本名：${draftTitle}`,
            `年龄阶段：${pictureBookAgeGroup}`,
            `绘本类型：${pictureBookType}`,
            teacherIdea ? `绘本大概内容：${teacherIdea}` : "请生成适合区域阅读和自主选听的原创幼儿绘本。",
            "要求：2-4页，温暖短句，有封面/每页图片提示词，阅读后只做阅读打卡，不做闯关问答。",
          ].join("\n"),
        }),
      });
      const data = (await response.json()) as Partial<TeacherResponse>;

      draftStory = data.content?.trim() || draftStory;
    } catch {
      draftStory = "";
    }

    if (!draftStory) {
      draftStory = [
        `《${draftTitle}》`,
        `第1页：区域时间到了，小朋友在图书角找到一本关于${draftTitle}的小书。`,
        "第2页：书里的小伙伴慢慢看、轻轻听，也愿意说一句自己的发现。",
        "第3页：老师坐在旁边陪伴大家，等每个孩子用自己的速度翻完故事。",
        "第4页：故事读完啦，孩子把喜欢的一页放进心里，也点亮一枚阅读小贴纸。",
      ].join("\n");
    }

    setPictureBookThemeId("habit");
    setPictureBookTitle(draftTitle);
    setPictureBookText(draftStory);
    setPictureBookImagePrompts(
      [
        `${draftTitle}封面：原创幼儿园绘本封面，温暖明亮，适合${pictureBookAgeGroup}幼儿，避免真实幼儿正脸`,
        `${draftTitle}第一页：${pictureBookType}主题，孩子在图书角看绘本，干净背景，绘本风，动作清楚`,
        `${draftTitle}第二页：故事角色进行一个生活小动作，画面温柔，适合幼儿理解`,
        `${draftTitle}第三页：老师陪伴孩子听完故事并完成阅读打卡，温馨不说教`,
      ].join("\n"),
    );
    setPictureBookQuestion("听完后，你最喜欢哪一页？");
    setPictureBookTask("今天读完啦，完成阅读打卡。");
    setPictureBookStatus("AI生成建议已填入，需教师修改确认后发布到儿童端。");
  }

  function publishTeacherPictureBook() {
    const book = buildTeacherPictureBook(
      "habit",
      pictureBookTitle,
      pictureBookText,
      pictureBookImagePrompts
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
      pictureBookQuestion,
      undefined,
      pictureBookTask,
    );

    if (book.storyText === "老师还没有填写故事正文。") {
      setPictureBookStatus("请先填写绘本正文，或从生成结果带入。");
      return;
    }

    setTeacherPictureBooks((current) => [book, ...current.filter((item) => item.id !== book.id)].slice(0, 24));
    setPictureBookTitle("");
    setPictureBookText("");
    setPictureBookImagePrompts("");
    setPictureBookQuestion("");
    setPictureBookTask("");
    setPictureBookStatus(`教师已确认并发布《${book.title}》到儿童端，幼儿可自主选听并完成阅读打卡。`);
  }

  function removeTeacherPictureBook(bookId: string) {
    setTeacherPictureBooks((current) => current.filter((item) => item.id !== bookId));
    setPictureBookStatus("已移除这本教师发布绘本。");
  }

  function createHabitTemplate() {
    const template = buildHabitTemplateFromFocus(habitTemplateFocus, habitTemplateChildPrompt);

    setHabitTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)].slice(0, 24));
    setHabitTemplateFocus("");
    setHabitTemplateChildPrompt("");
    setHabitTemplateStatus(`教师已确认并发布「${template.title}」，儿童端可语音或文字对老师说并打卡。`);
  }

  function removeHabitTemplate(templateId: string) {
    setHabitTemplates((current) => current.filter((item) => item.id !== templateId));
    setHabitTemplateStatus("已移除这个教师发布小任务。");
  }

  function buildClassCloudPayload() {
    const gameContentConfigs =
      typeof window !== "undefined" ? window.localStorage.getItem(gameContentConfigStorageKey) ?? "" : "";

    return {
      childRoster: JSON.stringify(childRoster),
      growthArchive: JSON.stringify(growthArchive),
      weeklyMenuEntries: serializeWeeklyMenuEntries(weeklyMenuEntries),
      dailyMenuOverrides: serializeDailyMenuOverrides(dailyMenuOverrides),
      parentSyncRecords: JSON.stringify(parentSyncRecords),
      parentFeedbackRecords: JSON.stringify(parentFeedbackRecords),
      gameContentConfigs,
      teacherPictureBooks: JSON.stringify(teacherPictureBooks),
      habitTemplates: JSON.stringify(habitTemplates),
      savedResults: JSON.stringify(limitTeacherHistory(savedResults)),
    };
  }

  function applyClassCloudPayload(payload: Record<string, unknown>) {
    if (typeof window === "undefined") {
      return;
    }

    const readText = (key: string) => typeof payload[key] === "string" ? payload[key] : "";
    const rosterRaw = readText("childRoster");
    const archiveRaw = readText("growthArchive");
    const weeklyMenuRaw = readText("weeklyMenuEntries");
    const dailyMenuOverrideRaw = readText("dailyMenuOverrides");
    const parentSyncRaw = readText("parentSyncRecords");
    const parentFeedbackRaw = readText("parentFeedbackRecords");
    const gameContentRaw = readText("gameContentConfigs");
    const pictureBooksRaw = readText("teacherPictureBooks");
    const habitTemplatesRaw = readText("habitTemplates");
    const savedResultsRaw = readText("savedResults");

    if (rosterRaw) {
      window.localStorage.setItem(childRosterStorageKey, rosterRaw);
      setChildRoster(parseChildRoster(rosterRaw));
    }

    if (archiveRaw) {
      window.localStorage.setItem(growthArchiveStorageKey, archiveRaw);
      setGrowthArchive(parseGrowthArchive(archiveRaw));
    }

    if (weeklyMenuRaw) {
      window.localStorage.setItem(weeklyMenuStorageKey, weeklyMenuRaw);
      setWeeklyMenuEntries(parseWeeklyMenuEntries(weeklyMenuRaw));
    }

    if (dailyMenuOverrideRaw) {
      window.localStorage.setItem(dailyMenuOverrideStorageKey, dailyMenuOverrideRaw);
      setDailyMenuOverrides(parseDailyMenuOverrides(dailyMenuOverrideRaw));
    }

    if (parentSyncRaw) {
      window.localStorage.setItem(parentSyncStorageKey, parentSyncRaw);
      setParentSyncRecords(parseParentSyncRecords(parentSyncRaw));
    }

    if (parentFeedbackRaw) {
      window.localStorage.setItem(parentFeedbackStorageKey, parentFeedbackRaw);
      setParentFeedbackRecords(parseParentFeedbackRecords(parentFeedbackRaw));
    }

    if (gameContentRaw) {
      window.localStorage.setItem(gameContentConfigStorageKey, gameContentRaw);
    }

    if (pictureBooksRaw) {
      window.localStorage.setItem(teacherPictureBooksStorageKey, pictureBooksRaw);
      setTeacherPictureBooks(parseTeacherPictureBooks(pictureBooksRaw));
    }

    if (habitTemplatesRaw) {
      window.localStorage.setItem(habitTemplatesStorageKey, habitTemplatesRaw);
      setHabitTemplates(parseHabitTemplates(habitTemplatesRaw));
    }

    if (savedResultsRaw) {
      try {
        const parsed = JSON.parse(savedResultsRaw) as unknown;
        const nextHistory = Array.isArray(parsed)
          ? limitTeacherHistory(
              parsed.filter(
                (item): item is SavedTeacherResult =>
                  Boolean(
                    item &&
                      typeof item === "object" &&
                      typeof (item as SavedTeacherResult).id === "string" &&
                      typeof (item as SavedTeacherResult).title === "string" &&
                      typeof (item as SavedTeacherResult).content === "string" &&
                      Array.isArray((item as SavedTeacherResult).tips),
                  ),
              ),
            )
          : [];
        window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
        setSavedResults(nextHistory);
      } catch {
        setCloudSyncStatus("账号同步已拉取主要班级数据，但历史生成记录解析失败，已跳过。");
      }
    }
  }

  async function syncClassCloud(action: "push" | "pull") {
    const authSnapshot = readTeacherAuthSnapshot();

    if (!authSnapshot.hasCompleteAccount) {
      setCloudSyncStatus("请先创建本机教师账号，再进行账号同步。");
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncStatus(action === "push" ? "正在上传班级账号数据..." : "正在拉取班级账号数据...");

    try {
      const response = await fetch("/api/class-cloud-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          account: authSnapshot.account,
          passcode: authSnapshot.passcode,
          ...getAccountSyncDeviceInfo(),
          ...(action === "push" ? { payload: buildClassCloudPayload() } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        updatedAt?: string;
        payload?: Record<string, unknown>;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "账号同步接口暂时不可用。");
      }

      if (action === "pull") {
        applyClassCloudPayload(data.payload ?? {});
        setCloudSyncStatus(`已从班级账号同步拉取数据：${data.updatedAt ?? "刚刚"}。`);
        return;
      }

      setCloudSyncStatus(`已上传班级账号数据：${data.updatedAt ?? "刚刚"}。教师换设备可拉取，家长绑定码也会读取对应幼儿内容。`);
    } catch (error) {
      setCloudSyncStatus(error instanceof Error ? error.message : "账号同步失败，请稍后再试。");
    } finally {
      setIsCloudSyncing(false);
    }
  }

  function bringDailyMenuSummaryToGeneration(
    row: (typeof todayMenuObservationRows)[number],
    mode: "tomorrow" | "activity" | "canteen",
  ) {
    const taskItem =
      teacherTasks.find((item) =>
        mode === "activity" ? item.id === "activity" : item.id === "food-follow",
      ) ?? teacherTasks[0];
    const scenarioByMode: Record<"tomorrow" | "activity" | "canteen", string> = {
      tomorrow: `今日食谱观察：${row.dishName}被记录 ${row.count} 次，重点食材是“${row.topIngredient}”，高频原因是“${row.topReason}”，孩子常选择“${row.topStep}”。请生成明日进餐引导，语言温和，包含餐前口令、观察提示和一个可执行靠近小步。`,
      activity: `请基于今日食谱观察生成一节课堂食育活动。菜品：${row.dishName}；重点食材：${row.topIngredient}；高频原因：${row.topReason}；涉及幼儿数：${row.childCount}；推荐靠近小步：${row.recommendedStep}。要求包含导入、感知/操作、互动表达、生活迁移和家园延伸。`,
      canteen: `请生成给食堂的班级聚合参考建议，不展示幼儿姓名，不写“孩子不吃某菜”。观察：本周部分幼儿对${row.topIngredient}仍处于认识阶段，常见原因是“${row.topReason}”，靠近小步多为“${row.topStep}”。建议包含切小、搭配熟悉食材、先做看闻观察等温和做法。`,
    };

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: taskItem.label,
      nextScenario: scenarioByMode[mode],
      statusMessage: `已把今日食谱「${row.dishName}」观察汇总带入跟进生成区。`,
    });
  }

  function syncAiFocusToParent(kind: "game" | "food", recordKey: string) {
    if (kind === "game") {
      const record = getMiniGameRecordByInsightKey(recordKey);

      if (record) {
        syncMiniGameRecordToParent(record);
      }

      return;
    }

    const record = getFoodPreferenceRecordByInsightKey(recordKey);

    if (record) {
      syncFoodPreferenceRecordToParent(record);
    }
  }

  function updateParentFeedbackRecords(
    updater: (records: ParentFeedbackRecord[]) => ParentFeedbackRecord[],
  ) {
    setParentFeedbackRecords((current) => {
      const nextRecords = updater(current);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(parentFeedbackStorageKey, JSON.stringify(nextRecords));
      }

      return nextRecords;
    });
  }

  function markParentFeedbackRead(id: string) {
    updateParentFeedbackRecords((current) =>
      current.map((record) =>
        record.id === id ? { ...record, status: "read" as const } : record,
      ),
    );
    setParentSyncStatus("已把这条家长反馈标记为已读。");
  }

  function getParentFeedbackDraft(record: ParentFeedbackRecord): ParentFeedbackDraft {
    const draft = parentFeedbackDrafts[record.id];

    return {
      reply: draft?.reply ?? record.teacherReply ?? "",
      guidance: draft?.guidance ?? record.teacherGuidance ?? "",
    };
  }

  function updateParentFeedbackDraft(
    id: string,
    field: keyof ParentFeedbackDraft,
    value: string,
  ) {
    setParentFeedbackDrafts((current) => ({
      ...current,
      [id]: {
        reply: current[id]?.reply ?? "",
        guidance: current[id]?.guidance ?? "",
        [field]: value.slice(0, 360),
      },
    }));
  }

  function buildParentFeedbackResponseFallback(record: ParentFeedbackRecord): ParentFeedbackDraft {
    const content = record.content;
    const isFood = /吃|餐|饭|食|慢|海蛎|紫菜|芥菜|味道|营养|闽食|泉州|播报|厨房/.test(content);
    const isEmotion = /哭|怕|不愿|紧张|生气|害怕|焦虑|抗拒/.test(content);
    const isHabit = /洗手|排队|如厕|整理|安全|玩具|喝水/.test(content);

    if (isFood) {
      return {
        reply: `${record.childName}家长您好，收到您的反馈。孩子进食慢或暂时不想尝试时，我们会先观察原因，不给孩子贴标签，再用认名字、找食材、说发现和靠近一小步的方式慢慢陪伴。`,
        guidance: "家庭配合建议：先固定安静进餐位置，少催促；保留孩子熟悉的一种食物，再加入一小口目标食物；饭后只记录一次具体进步，例如愿意闻一闻或尝一口。",
      };
    }

    if (isEmotion) {
      return {
        reply: `${record.childName}家长您好，您的担心我们看到了。孩子出现情绪或抗拒时，我们会先接住感受，再给一个很小、能完成的步骤，帮助孩子重新获得安全感。`,
        guidance: "家庭配合建议：先说出孩子感受，再给两个可选动作；避免比较和催促；每天固定一个成功小任务，完成后表扬具体行为。",
      };
    }

    if (isHabit) {
      return {
        reply: `${record.childName}家长您好，感谢您把在家情况告诉我们。我们会结合在园观察，用图片、短口令和示范动作帮助孩子巩固这个生活习惯。`,
        guidance: "家庭配合建议：家里和幼儿园使用同一句提醒；一次只练一个步骤；孩子做对时说清楚“你刚才哪里做对了”。",
      };
    }

    return {
      reply: `${record.childName}家长您好，收到您的反馈。我们会继续结合孩子在园互动记录观察，不急着下结论，先从一个小目标开始支持孩子。`,
      guidance: "家庭配合建议：请先记录孩子出现这个情况的时间、场景和前后原因；在家只推进一个可完成的小任务，第二天再和老师同步变化。",
    };
  }

  async function generateParentFeedbackResponse(record: ParentFeedbackRecord) {
    setParentFeedbackAiLoadingId(record.id);
    setParentSyncStatus("正在根据这条家长反馈生成老师回复和育儿指导草稿...");

    const fallback = buildParentFeedbackResponseFallback(record);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "teacher",
          theme: /吃|餐|饭|食|海蛎|紫菜|芥菜|闽/.test(record.content) ? "food" : "habit",
          teacherTask: "家长反馈回复与育儿指导",
          userInput: [
            `幼儿：${record.childName}`,
            `反馈类型：${getParentFeedbackCategoryLabel(record.category)}`,
            `家长反馈：${record.content}`,
            "请生成老师回复家长的话和家庭育儿指导，语气温和，不夸大，不承诺效果。",
          ].join("。"),
        }),
      });
      const payload = normalizeTeacherPayload(await response.json());
      const nextDraft = {
        reply: (payload?.content ?? fallback.reply).slice(0, 360),
        guidance: (payload?.tips?.join("；") ?? fallback.guidance).slice(0, 360),
      };

      setParentFeedbackDrafts((current) => ({
        ...current,
        [record.id]: nextDraft,
      }));
      setParentSyncStatus(aiDraftReviewNotice);
    } catch {
      setParentFeedbackDrafts((current) => ({
        ...current,
        [record.id]: fallback,
      }));
      setParentSyncStatus("AI 生成暂时不可用，已先填入本地育儿指导草稿，需教师确认后保存。");
    } finally {
      setParentFeedbackAiLoadingId("");
    }
  }

  function saveParentFeedbackResponse(record: ParentFeedbackRecord) {
    const draft = getParentFeedbackDraft(record);
    const reply = draft.reply.trim();
    const guidance = draft.guidance.trim();

    if (!reply && !guidance) {
      setParentSyncStatus("请先填写老师回复或育儿指导，再确认并同步家长。");
      return;
    }

    updateParentFeedbackRecords((current) =>
      current.map((item) =>
        item.id === record.id
          ? {
              ...item,
              status: "read" as const,
              teacherReply: reply || item.teacherReply,
              teacherGuidance: guidance || item.teacherGuidance,
              teacherRepliedAt: new Date().toISOString(),
              teacherReplySource: "manual" as const,
            }
          : item,
      ),
    );
    setParentSyncStatus(`${record.childName} 的家长反馈已由教师确认并同步家庭延续。`);
  }

  function addChildToRoster() {
    const className = newChildClassName.trim().slice(0, 16);
    const name = newChildName.trim().slice(0, 12);
    const rosterNumber = newChildNumber.trim().replace(/[^\d]/g, "").slice(0, 3);

    if (!name) {
      setRosterStatus("请先输入幼儿姓名。");
      return;
    }

    if (!rosterNumber) {
      setRosterStatus("请给幼儿填写号数，孩子说“几号”时才能匹配。");
      return;
    }

    if (childRoster.some((child) => child.name === name || child.rosterNumber === rosterNumber)) {
      setRosterStatus("这个姓名或号数已经在花名册里，请检查后再添加。");
      return;
    }

    const nextChild: ChildProfile = {
      id: `child-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      className,
      rosterNumber,
      familyBindingCode: generateFamilyBindingCode(),
      createdAt: new Date().toISOString(),
    };

    setChildRoster((current) => [...current, nextChild].slice(0, 60));
    setNewChildClassName("");
    setNewChildName("");
    setNewChildNumber("");
    setRosterStatus(
      `${className ? `${className} · ` : ""}${rosterNumber}号 ${name} 已添加，并已生成家庭绑定码。儿童端可以说姓名或号数选择身份。`,
    );
  }

  function removeChildFromRoster(childId: string) {
    const child = childRoster.find((item) => item.id === childId);

    setChildRoster((current) => current.filter((item) => item.id !== childId));

    if (typeof window !== "undefined" && window.localStorage.getItem(selectedChildStorageKey) === childId) {
      window.localStorage.removeItem(selectedChildStorageKey);
    }

    setRosterStatus(child ? `已移除 ${child.name}。历史互动记录仍保留，不会被删除。` : "已更新花名册。");
  }

  function resetChildFamilyBindingCode(childId: string) {
    const nextCode = generateFamilyBindingCode();
    const child = childRoster.find((item) => item.id === childId);

    setChildRoster((current) =>
      current.map((item) =>
        item.id === childId
          ? {
              ...item,
              familyBindingCode: nextCode,
            }
          : item,
      ),
    );
    setRosterStatus(
      child
        ? `${formatChildLabel(child)} 的家庭绑定码已更新为 ${nextCode}，旧绑定码已失效。`
        : `家庭绑定码已更新为 ${nextCode}。`,
    );
  }

  async function copyFamilyBindingCode(child: ChildProfile) {
    const code = child.familyBindingCode?.trim().toUpperCase();

    if (!code) {
      setRosterStatus(`请先为 ${formatChildLabel(child)} 生成家庭绑定码。`);
      return;
    }

    const text = `${formatChildLabel(child)} 的家庭绑定码：${code}。请家长进入家庭延续页，输入幼儿姓名或号数，并输入家庭绑定码后查看老师同步建议。`;

    try {
      await navigator.clipboard.writeText(text);
      setRosterStatus(`已复制 ${formatChildLabel(child)} 的家庭绑定码给家长。`);
    } catch {
      setRosterStatus(`浏览器未允许自动复制，请手动复制：${text}`);
    }
  }

  function mergeRosterItems(items: Array<{ className?: string; name: string; rosterNumber: string }>) {
    if (items.length === 0) {
      setRosterStatus("没有识别到有效名单。请使用“班级,号数,姓名”的格式。");
      return;
    }

    let addedCount = 0;
    setChildRoster((current) => {
      const next = [...current];

      for (const item of items) {
        const duplicated = next.some(
          (child) => child.name === item.name || child.rosterNumber === item.rosterNumber,
        );

        if (duplicated) {
          continue;
        }

        next.push({
          id: `child-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${addedCount}`,
          className: item.className,
          name: item.name,
          rosterNumber: item.rosterNumber,
          familyBindingCode: generateFamilyBindingCode(),
          createdAt: new Date().toISOString(),
        });
        addedCount += 1;
      }

      return next.slice(0, 60);
    });
    setRosterStatus(`已导入 ${addedCount} 位幼儿并生成家庭绑定码；重复姓名或号数已自动跳过。`);
  }

  function downloadRosterTemplate() {
    const template = "班级,号数,姓名\n中一班,1,小安\n中一班,2,小宇\n中一班,3,小禾\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "幼习宝班级花名册模板.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setRosterStatus("已生成花名册模板，老师可以按“班级,号数,姓名”补充后再导入。");
  }

  function recordMatchesChild(record: { childId?: string; childName?: string }, child: ChildProfile) {
    return record.childId === child.id || record.childName === child.name;
  }

  function getLatestTime(values: string[]) {
    const latest = values
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((left, right) => right - left)[0];

    return typeof latest === "number" ? new Date(latest).toISOString() : "";
  }

  function escapeCsvCell(value: unknown) {
    const text = Array.isArray(value) ? value.join("、") : String(value ?? "");

    return `"${text.replace(/"/g, '""')}"`;
  }

  function escapeXmlCell(value: unknown) {
    const text = Array.isArray(value) ? value.join("、") : String(value ?? "");

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function downloadTextFile(fileName: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function buildTeacherExportPayload() {
    const exportTime = new Date().toISOString();
    const habitTaskRecords = growthArchive.miniGameRecords.filter(
      (record) => record.themeId === "habit" && record.gameKey !== "readingCheckin",
    );
    const readingRecords = growthArchive.miniGameRecords.filter(
      (record) => record.gameKey === "readingCheckin",
    );
    const foodMiniGameRecords = growthArchive.miniGameRecords.filter(
      (record) => record.themeId === "food" || record.gameKey === "foodPreference",
    );
    const kitchenRecords = growthArchive.miniGameRecords.filter(
      (record) => record.gameKey === "foodKitchen" || record.gameKey === "foodTrain",
    );
    const childExpressionRecords = growthArchive.miniGameRecords.filter(
      (record) => record.source === "child-to-teacher" || Boolean(record.childUtterance),
    );
    const childSummaries = childRoster.map((child) => {
      const miniRecords = growthArchive.miniGameRecords.filter((record) =>
        recordMatchesChild(record, child),
      );
      const foodRecords = growthArchive.foodPreferenceRecords.filter((record) =>
        recordMatchesChild(record, child),
      );
      const feedbackRecords = parentFeedbackRecords.filter((record) =>
        recordMatchesChild(record, child),
      );
      const childHabitRecords = habitTaskRecords.filter((record) => recordMatchesChild(record, child));
      const childReadingRecords = readingRecords.filter((record) => recordMatchesChild(record, child));
      const childKitchenRecords = kitchenRecords.filter((record) => recordMatchesChild(record, child));
      const childExpressionCount = childExpressionRecords.filter((record) =>
        recordMatchesChild(record, child),
      ).length;
      const latestInteractionTime = getLatestTime([
        ...miniRecords.map((record) => record.completedAt),
        ...foodRecords.map((record) => record.recordedAt),
        ...feedbackRecords.map((record) => record.createdAt),
      ]);

      return {
        childId: child.id,
        name: child.name,
        rosterNumber: child.rosterNumber ?? "",
        className: child.className ?? "",
        totalInteractions: miniRecords.length + foodRecords.length + feedbackRecords.length,
        habitTaskCount: childHabitRecords.length,
        readingCheckinCount: childReadingRecords.length,
        foodObservationCount: foodRecords.length,
        kitchenBroadcastCount: childKitchenRecords.length,
        childExpressionCount,
        parentFeedbackCount: feedbackRecords.length,
        latestInteractionTime,
      };
    });
    const aiAnalysisSuggestions = [
      ...teacherAiSummaryStats.map((item) => ({
        type: "AI数据面板",
        title: item.label,
        content: `${item.value}${item.hint ? `｜${item.hint}` : ""}`,
        source: aiConfirmedUseNotice,
      })),
      ...aiDailyObservationCards.map((item) => ({
        type: "AI观察建议",
        title: item.label,
        content: item.value,
        source: "教师端AI观察数据",
      })),
      ...aiFocusInsightRows.map((item) => ({
        type: "重点跟进建议",
        title: item.title,
        content: `${item.childName}｜${item.meaning}｜下一步：${item.nextAction}`,
        source: "儿童端数据回流教师端",
      })),
    ];
    const teacherConfirmedContents = [
      result
        ? {
            type: "AI生成区当前内容",
            title: result.title,
            content: result.content,
            confirmedAt: teacherResultConfirmedAt,
            status: teacherResultConfirmedAt ? "教师已确认" : "待教师确认",
            source: aiConfirmedUseNotice,
          }
        : null,
      ...parentSyncRecords
        .filter((record) => Boolean(record.syncedAt))
        .map((record) => ({
          type: "家园同步",
          title: record.title,
          content: record.summary,
          confirmedAt: record.syncedAt ?? "",
          status: "教师已确认并同步家长",
          source: "教师确认内容",
        })),
      ...teacherPictureBooks.map((book) => ({
        type: "教师绘本",
        title: book.title,
        content: [
          book.storyText,
          `图片提示词：${book.pageImagePrompts.join("；")}`,
          `阅读后问题：${book.question}`,
          `阅读后小任务：${book.habitTask}`,
        ].join("\n"),
        confirmedAt: book.publishedAt,
        status: "教师已确认并发布到儿童端",
        source: aiConfirmedUseNotice,
      })),
      ...habitTemplates.map((template) => ({
        type: "老师发布小任务",
        title: template.title,
        content: [
          `习惯重点：${template.habitFocus}`,
          `幼儿提示：${template.childPrompt}`,
          `教师观察：${template.teacherPrompt}`,
          `任务故事：${template.storyText}`,
          `小任务：${template.habitTask}`,
        ].join("\n"),
        confirmedAt: template.publishedAt,
        status: "教师已确认并发布到儿童端",
        source: aiConfirmedUseNotice,
      })),
    ].filter((item): item is {
      type: string;
      title: string;
      content: string;
      confirmedAt: string;
      status: string;
      source: string;
    } => Boolean(item));

    return {
      overview: {
        exportTime,
        childCount: childRoster.length,
        todayInteractionChildren: classOverview.participatedCount,
        todayHabitCheckins: classOverview.habitCheckinCount,
        todayReadingCheckins: classOverview.readingCheckinCount,
        todayFoodObservations: classOverview.foodObservationCount,
        parentFeedbackCount: classOverview.parentFeedbackTodayCount,
      },
      childSummaries,
      habitTaskRecords,
      readingRecords,
      foodObservationRecords: growthArchive.foodPreferenceRecords,
      foodMiniGameRecords,
      gameActivityRecords: growthArchive.miniGameRecords,
      childExpressionRecords,
      parentFeedbackRecords,
      aiAnalysisSuggestions,
      teacherConfirmedContents,
      note: "导出数据仅用于教师教研、班级跟进和家园沟通，请妥善保管。",
    };
  }

  function buildTeacherExportTables(payload = buildTeacherExportPayload()) {
    return [
      {
        sheetName: "班级概览",
        headers: [
          "导出时间",
          "幼儿人数",
          "今日互动人数",
          "今日习惯打卡次数",
          "今日阅读打卡次数",
          "今日食物观察次数",
          "家长反馈次数",
          "导出提示",
        ],
        rows: [
          [
            payload.overview.exportTime,
            payload.overview.childCount,
            payload.overview.todayInteractionChildren,
            payload.overview.todayHabitCheckins,
            payload.overview.todayReadingCheckins,
            payload.overview.todayFoodObservations,
            payload.overview.parentFeedbackCount,
            payload.note,
          ],
        ],
      },
      {
        sheetName: "幼儿个人汇总",
        headers: [
          "childId",
          "姓名",
          "号数",
          "班级",
          "总互动次数",
          "习惯任务次数",
          "阅读打卡次数",
          "食物观察次数",
          "小厨房播报次数",
          "对老师说次数",
          "家长反馈次数",
          "最近一次互动时间",
        ],
        rows: payload.childSummaries.map((child) => [
          child.childId,
          child.name,
          child.rosterNumber,
          child.className,
          child.totalInteractions,
          child.habitTaskCount,
          child.readingCheckinCount,
          child.foodObservationCount,
          child.kitchenBroadcastCount,
          child.childExpressionCount,
          child.parentFeedbackCount,
          child.latestInteractionTime,
        ]),
      },
      {
        sheetName: "游戏活动明细",
        headers: [
          "eventId",
          "classId",
          "childId",
          "姓名",
          "createdAt",
          "完成时间",
          "templateType",
          "activityId",
          "action",
          "模板",
          "活动类型",
          "结果",
          "尝试次数",
          "关卡/任务",
          "习惯类型",
          "故事/绘本",
          "食物/菜品",
          "靠近小步",
          "食谱日期",
          "餐次",
          "步骤顺序",
          "幼儿表达",
          "教师已读",
          "同步状态",
          "deviceId",
          "sessionId",
        ],
        rows: payload.gameActivityRecords.map((record) => [
          record.eventId ?? "",
          record.classId ?? "",
          record.childId ?? "",
          record.childName ?? "",
          record.createdAt ?? record.completedAt,
          record.completedAt,
          record.templateType ?? record.activityType ?? record.gameKey,
          record.activityId ?? record.gameInstanceId ?? record.levelId ?? record.taskId ?? record.gameKey,
          record.action ?? record.pickedItems.join("、"),
          record.gameInstanceTitle ?? record.gameKey,
          record.activityType ?? record.source ?? "",
          record.result ?? record.status ?? "",
          record.attempts ?? "",
          record.levelId ?? record.taskId ?? record.gameInstanceId ?? "",
          record.habitType ?? record.habitTask ?? "",
          record.storyTopic ?? record.storyId ?? "",
          record.foodLabel ?? record.foodId ?? record.dishId ?? "",
          record.approachStep ?? record.acceptedLevel ?? "",
          record.menuDate ?? "",
          record.mealType ?? "",
          record.stepOrder ?? [],
          record.childUtterance ?? record.answerContent ?? record.voiceText ?? "",
          record.teacherRead === undefined ? "" : record.teacherRead ? "是" : "否",
          record.syncStatus ?? "",
          record.deviceId ?? "",
          record.sessionId ?? "",
        ]),
      },
      {
        sheetName: "习惯任务",
        headers: ["完成时间", "childId", "姓名", "任务", "小章", "选择/回答", "来源"],
        rows: payload.habitTaskRecords.map((record) => [
          record.completedAt,
          record.childId ?? "",
          record.childName ?? "",
          record.gameKey,
          record.badgeName,
          record.pickedItems,
          record.source ?? "",
        ]),
      },
      {
        sheetName: "阅读打卡",
        headers: ["完成时间", "childId", "姓名", "绘本/故事", "回答", "小任务", "小章"],
        rows: payload.readingRecords.map((record) => [
          record.completedAt,
          record.childId ?? "",
          record.childName ?? "",
          record.storyTopic ?? "",
          record.answerContent ?? record.pickedItems.join("、"),
          record.habitTask ?? "",
          record.badgeName,
        ]),
      },
      {
        sheetName: "闽食观察",
        headers: ["记录时间", "childId", "姓名", "菜品", "食材", "原因", "靠近小步", "策略"],
        rows: payload.foodObservationRecords.map((record) => [
          record.recordedAt,
          record.childId ?? "",
          record.childName ?? "",
          record.dishName ?? record.foodLabel,
          record.ingredientName ?? record.foodLabel,
          record.reasonLabel,
          record.approachStep ?? "",
          record.strategy,
        ]),
      },
      {
        sheetName: "幼儿对老师说",
        headers: ["完成时间", "childId", "姓名", "幼儿表达", "选择/回答", "小章"],
        rows: payload.childExpressionRecords.map((record) => [
          record.completedAt,
          record.childId ?? "",
          record.childName ?? "",
          record.childUtterance ?? "",
          record.answerContent ?? record.pickedItems.join("、"),
          record.badgeName,
        ]),
      },
      {
        sheetName: "家长反馈",
        headers: ["反馈时间", "childId", "姓名", "类别", "内容", "状态", "老师回复"],
        rows: payload.parentFeedbackRecords.map((record) => [
          record.createdAt,
          record.childId,
          record.childName,
          getParentFeedbackCategoryLabel(record.category),
          record.content,
          record.status,
          record.teacherReply ?? record.teacherGuidance ?? "",
        ]),
      },
      {
        sheetName: "AI分析建议",
        headers: ["类型", "标题", "内容", "来源"],
        rows: payload.aiAnalysisSuggestions.map((item) => [
          item.type,
          item.title,
          item.content,
          item.source,
        ]),
      },
      {
        sheetName: "教师确认内容",
        headers: ["类型", "标题", "内容", "教师确认时间", "状态", "AI标记/来源"],
        rows: payload.teacherConfirmedContents.map((item) => [
          item.type,
          item.title,
          item.content,
          item.confirmedAt,
          item.status,
          item.source,
        ]),
      },
    ];
  }

  function buildTeacherExportExcelXml() {
    const worksheets = buildTeacherExportTables().map((table) => {
      const rows = [table.headers, ...table.rows];
      const xmlRows = rows
        .map(
          (row) =>
            `<Row>${row
              .map((cell) => `<Cell><Data ss:Type="String">${escapeXmlCell(cell)}</Data></Cell>`)
              .join("")}</Row>`,
        )
        .join("");

      return `<Worksheet ss:Name="${escapeXmlCell(table.sheetName).slice(0, 31)}"><Table>${xmlRows}</Table></Worksheet>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets.join("")}
</Workbook>`;
  }

  function buildTeacherExportCsv() {
    const payload = buildTeacherExportPayload();
    const rows: unknown[][] = [];
    const pushSection = (title: string, headers: string[], sectionRows: unknown[][]) => {
      rows.push([title]);
      rows.push(headers);
      rows.push(...sectionRows);
      rows.push([]);
    };

    rows.push(["导出提示", payload.note]);
    rows.push([]);
    pushSection(
      "班级概览",
      ["导出时间", "幼儿人数", "今日互动人数", "今日习惯打卡次数", "今日阅读打卡次数", "今日食物观察次数", "家长反馈次数"],
      [[
        payload.overview.exportTime,
        payload.overview.childCount,
        payload.overview.todayInteractionChildren,
        payload.overview.todayHabitCheckins,
        payload.overview.todayReadingCheckins,
        payload.overview.todayFoodObservations,
        payload.overview.parentFeedbackCount,
      ]],
    );
    pushSection(
      "幼儿个人汇总",
      [
        "childId",
        "姓名",
        "号数",
        "班级",
        "总互动次数",
        "习惯任务次数",
        "阅读打卡次数",
        "食物观察次数",
        "小厨房播报次数",
        "对老师说次数",
        "家长反馈次数",
        "最近一次互动时间",
      ],
      payload.childSummaries.map((child) => [
        child.childId,
        child.name,
        child.rosterNumber,
        child.className,
        child.totalInteractions,
        child.habitTaskCount,
        child.readingCheckinCount,
        child.foodObservationCount,
        child.kitchenBroadcastCount,
        child.childExpressionCount,
        child.parentFeedbackCount,
        child.latestInteractionTime,
      ]),
    );
    pushSection(
      "游戏活动明细",
      [
        "eventId",
        "classId",
        "childId",
        "姓名",
        "完成时间",
        "模板",
        "活动类型",
        "结果",
        "尝试次数",
        "关卡/任务",
        "习惯类型",
        "故事/绘本",
        "食物/菜品",
        "靠近小步",
        "食谱日期",
        "餐次",
        "步骤顺序",
        "幼儿表达",
        "教师已读",
        "同步状态",
        "deviceId",
        "sessionId",
      ],
      payload.gameActivityRecords.map((record) => [
        record.eventId ?? "",
        record.classId ?? "",
        record.childId ?? "",
        record.childName ?? "",
        record.completedAt,
        record.gameInstanceTitle ?? record.gameKey,
        record.activityType ?? record.source ?? "",
        record.result ?? record.status ?? "",
        record.attempts ?? "",
        record.levelId ?? record.taskId ?? record.gameInstanceId ?? "",
        record.habitType ?? record.habitTask ?? "",
        record.storyTopic ?? record.storyId ?? "",
        record.foodLabel ?? record.foodId ?? record.dishId ?? "",
        record.approachStep ?? record.acceptedLevel ?? "",
        record.menuDate ?? "",
        record.mealType ?? "",
        record.stepOrder ?? [],
        record.childUtterance ?? record.answerContent ?? record.voiceText ?? "",
        record.teacherRead === undefined ? "" : record.teacherRead ? "是" : "否",
        record.syncStatus ?? "",
        record.deviceId ?? "",
        record.sessionId ?? "",
      ]),
    );
    pushSection(
      "习惯任务数据",
      ["完成时间", "childId", "姓名", "任务", "小章", "选择/回答", "来源"],
      payload.habitTaskRecords.map((record) => [
        record.completedAt,
        record.childId ?? "",
        record.childName ?? "",
        record.gameKey,
        record.badgeName,
        record.pickedItems,
        record.source ?? "",
      ]),
    );
    pushSection(
      "阅读打卡数据",
      ["完成时间", "childId", "姓名", "绘本/故事", "回答", "小任务", "小章"],
      payload.readingRecords.map((record) => [
        record.completedAt,
        record.childId ?? "",
        record.childName ?? "",
        record.storyTopic ?? "",
        record.answerContent ?? record.pickedItems.join("、"),
        record.habitTask ?? "",
        record.badgeName,
      ]),
    );
    pushSection(
      "闽食观察数据",
      ["记录时间", "childId", "姓名", "菜品", "食材", "原因", "靠近小步", "策略"],
      payload.foodObservationRecords.map((record) => [
        record.recordedAt,
        record.childId ?? "",
        record.childName ?? "",
        record.dishName ?? record.foodLabel,
        record.ingredientName ?? record.foodLabel,
        record.reasonLabel,
        record.approachStep ?? "",
        record.strategy,
      ]),
    );
    pushSection(
      "幼儿对老师说数据",
      ["完成时间", "childId", "姓名", "幼儿表达", "选择/回答", "小章"],
      payload.childExpressionRecords.map((record) => [
        record.completedAt,
        record.childId ?? "",
        record.childName ?? "",
        record.childUtterance ?? "",
        record.answerContent ?? record.pickedItems.join("、"),
        record.badgeName,
      ]),
    );
    pushSection(
      "家长反馈数据",
      ["反馈时间", "childId", "姓名", "类别", "内容", "状态", "老师回复"],
      payload.parentFeedbackRecords.map((record) => [
        record.createdAt,
        record.childId,
        record.childName,
        getParentFeedbackCategoryLabel(record.category),
        record.content,
        record.status,
        record.teacherReply ?? record.teacherGuidance ?? "",
      ]),
    );
    pushSection(
      "AI分析建议",
      ["类型", "标题", "内容", "来源"],
      payload.aiAnalysisSuggestions.map((item) => [
        item.type,
        item.title,
        item.content,
        item.source,
      ]),
    );
    pushSection(
      "教师确认内容",
      ["类型", "标题", "内容", "教师确认时间", "状态", "AI标记/来源"],
      payload.teacherConfirmedContents.map((item) => [
        item.type,
        item.title,
        item.content,
        item.confirmedAt,
        item.status,
        item.source,
      ]),
    );

    return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  }

  function exportTeacherDataSummary(format: "csv" | "json" | "xls") {
    const dateKey = getLocalDateKey();
    const baseName = `闽食小当家_班级数据汇总_${dateKey}`;

    if (format === "json") {
      downloadTextFile(
        `${baseName}.json`,
        JSON.stringify(buildTeacherExportPayload(), null, 2),
        "application/json;charset=utf-8",
      );
      setDraftStatus("JSON 数据汇总已导出。导出数据请仅用于教师教研、班级跟进和家园沟通。");
      return;
    }

    if (format === "xls") {
      downloadTextFile(
        `${baseName}.xls`,
        `\uFEFF${buildTeacherExportExcelXml()}`,
        "application/vnd.ms-excel;charset=utf-8",
      );
      setDraftStatus("Excel 可打开的 .xls 数据汇总已导出。导出数据请妥善保管。");
      return;
    }

    downloadTextFile(`${baseName}.csv`, `\uFEFF${buildTeacherExportCsv()}`, "text/csv;charset=utf-8");
    setDraftStatus("CSV 数据汇总已导出。导出数据请妥善保管。");
  }

  function confirmTeacherResultDraft() {
    if (!result) {
      setCopyStatus("请先点击“AI生成建议”，再由教师修改确认。");
      return;
    }

    const confirmedAt = new Date().toISOString();
    const reviewedResult = reviewTeacherResponseDraft({
      ...result,
      needsReview: false,
    });

    setResult(reviewedResult);
    setTeacherResultConfirmedAt(confirmedAt);
    setCopyStatus("已完成错别字、标点、儿童语气和篇幅审校；教师已确认，可复制、试播、同步或导出 Word。");
  }

  function stashTeacherResultDraft() {
    if (!result) {
      setCopyStatus("请先生成一条 AI 草稿，再暂存。");
      return;
    }

    const savedAt = new Date().toISOString();
    const nextId = `${savedAt}-${themeId}-${task}-manual`;

    setSavedResults((current) =>
      limitTeacherHistory([
        {
          ...result,
          id: nextId,
          themeId,
          task,
          scenario,
          savedAt,
          pinned: false,
          needsReview: true,
        },
        ...current,
      ]),
    );
    setDraftStatus("当前 AI 草稿已暂存到生成历史，仍需教师修改确认后使用。");
    setCopyStatus("已暂存当前草稿。");
  }

  function deleteTeacherResultDraft() {
    if (!result) {
      setCopyStatus("当前没有可删除的 AI 草稿。");
      return;
    }

    setResult(null);
    setLatestAiDraftSnapshot(null);
    setTeacherResultConfirmedAt("");
    setCopyStatus("已删除当前 AI 草稿，儿童端和家长端不会看到未确认内容。");
    setVoiceStatus("");
  }

  function formatWordParagraphs(value: string) {
    return escapeXmlCell(value)
      .split(/\r?\n/)
      .map((line) => `<p>${line || "&nbsp;"}</p>`)
      .join("");
  }

  function buildTeacherAiWordHtml() {
    const editedResult = result;
    const draftSnapshot = latestAiDraftSnapshot ?? result;
    const title = editedResult?.title?.trim() || draftSnapshot?.title?.trim() || "AI生成内容";
    const confirmedText = teacherResultConfirmedAt || "尚未确认";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeXmlCell(title)}</title>
  <style>
    body { font-family: "Microsoft YaHei", sans-serif; line-height: 1.7; color: #111827; }
    h1 { font-size: 24px; }
    h2 { margin-top: 24px; font-size: 18px; }
    .meta { background: #f8fafc; padding: 12px; border-radius: 8px; }
    .notice { color: #0f766e; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeXmlCell(title)}</h1>
  <div class="meta">
    <p>年龄阶段：${escapeXmlCell(teacherAgeGroup)}</p>
    <p>类型：${escapeXmlCell(task)}</p>
    <p>教师确认时间：${escapeXmlCell(confirmedText)}</p>
    <p class="notice">${escapeXmlCell(aiConfirmedUseNotice)}</p>
  </div>
  <h2>AI生成建议</h2>
  ${formatWordParagraphs(draftSnapshot?.content ?? "暂无草稿")}
  <h2>教师修改后内容</h2>
  ${formatWordParagraphs(editedResult?.content ?? "暂无修改内容")}
  <h2>使用建议</h2>
  ${formatWordParagraphs((editedResult?.tips ?? draftSnapshot?.tips ?? []).join("\n") || "教师按班级现场情况确认后使用。")}
</body>
</html>`;
  }

  function exportTeacherAiWord() {
    if (!result) {
      setCopyStatus("请先生成或选择一条 AI 草稿，再导出 Word。");
      return;
    }

    const dateKey = getLocalDateKey();

      downloadTextFile(
        `闽食小当家_AI生成内容_${dateKey}.doc`,
      `\uFEFF${buildTeacherAiWordHtml()}`,
      "application/msword;charset=utf-8",
    );
    setCopyStatus("Word 可打开的 .doc 生成内容已导出，使用前仍需教师确认。");
  }

  function importRosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      mergeRosterItems(parseRosterImportText(text));
    };
    reader.onerror = () => {
      setRosterStatus("花名册文件读取失败，请换成 CSV 或 TXT 后再试。");
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  function generateMiniGamePlan(record: MiniGameRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "home") ?? teacherTasks[0];
    const nextScenario = buildMiniGameInterventionScenario(record);

    bringIntoGenerationArea({
      nextThemeId: record.themeId,
      nextTask: homeTask.label,
      nextScenario,
      statusMessage: "已把这条幼儿互动记录带入跟进生成区，请确认后点击“AI生成建议”。",
    });
  }

  function generateMiniGameEncouragement(record: MiniGameRecord) {
    const followUp = getMiniGameFollowUp(record);
    const encourageTask =
      teacherTasks.find((item) => item.id === "encouragement") ?? teacherTasks[0];

    bringIntoGenerationArea({
      nextThemeId: record.themeId,
      nextTask: encourageTask.label,
      nextScenario: `幼儿互动记录：${record.childName ?? "孩子"}完成“${followUp.displayName}”。记录内容：${formatTeacherPickedItems(record.pickedItems)}。请生成一句具体、温和、不比较的鼓励语，并给出下一小步。`,
      statusMessage: "已带入鼓励语建议，可以直接修改或点击“AI生成建议”。",
      nextResult: {
      title: `${record.childName ?? "孩子"}的鼓励语`,
      content: followUp.encouragement,
      tips: ["说具体行为。", "不比较不催促。", "鼓励下一小步。"],
      needsReview: true,
      },
    });
  }

  function generateFoodPreferencePlan(record: FoodPreferenceRecord) {
    const homeTask = teacherTasks.find((item) => item.id === "food-follow") ?? teacherTasks[0];
    const nextScenario = buildPreferenceInterventionScenario(record, teacherAgeGroup);

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: homeTask.label,
      nextScenario,
      statusMessage: "已把美食认识观察带入跟进生成区，请确认后点击“AI生成建议”。",
    });
  }

  function generateFoodPreferenceEncouragement(record: FoodPreferenceRecord) {
    const followUp = getFoodPreferenceFollowUp(record);
    const encourageTask =
      teacherTasks.find((item) => item.id === "encouragement") ?? teacherTasks[0];

    bringIntoGenerationArea({
      nextThemeId: "food",
      nextTask: encourageTask.label,
      nextScenario: `美食认识观察：${record.childName ?? "孩子"}正在认识“${record.foodLabel}”，原因是“${record.reasonLabel}”，靠近小步是“${record.approachStep ?? "看一看"}”。请生成一句温和鼓励语。`,
      statusMessage: "已带入美食鼓励语建议，可以继续修改或点击“AI生成建议”。",
      nextResult: {
      title: `${record.childName ?? "孩子"}的美食鼓励语`,
      content: followUp.encouragement,
      tips: ["先接纳感受。", "只推进一小步。", "不贴饮食标签。"],
      needsReview: true,
      },
    });
  }

  function createTeacherAccount() {
    const account = teacherSetupAccount.trim();
    const passcode = teacherSetupPasscode.trim();

    if (account.length < 2 || passcode.length < 4) {
      setTeacherAuthStatus("本机班级试用账号至少 2 个字，口令至少 4 位。");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherAccountStorageKey, account);
      window.localStorage.setItem(teacherPasscodeStorageKey, passcode);
      persistTeacherSession(account);
    }

    setTeacherHasAccount(true);
    setTeacherAuthenticated(true);
    setTeacherAccountInput(account);
    setTeacherPasscodeInput("");
    setTeacherSetupPasscode("");
    setTeacherAuthStatus("本机班级试用账号已创建，本次已进入教师工作台。");
  }

  function loginTeacherAccount() {
    const account = teacherAccountInput.trim();
    const passcode = teacherPasscodeInput.trim();

    if (typeof window === "undefined") {
      return;
    }

    const savedAccount = (window.localStorage.getItem(teacherAccountStorageKey) ?? "").trim();
    const savedPasscode = (window.localStorage.getItem(teacherPasscodeStorageKey) ?? "").trim();

    if (account === savedAccount && passcode === savedPasscode) {
      persistTeacherSession(account);
      setTeacherAuthenticated(true);
      setTeacherPasscodeInput("");
      setTeacherAuthStatus("本机班级试用身份已确认，可以查看互动汇总和生成方案。");
      return;
    }

    setTeacherAuthStatus("账号或口令不正确。可以重新输入，或点击重置本机教师账号。");
  }

  function quickEnterTeacherTrialAccount() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherAccountStorageKey, trialTeacherAccount);
      window.localStorage.setItem(teacherPasscodeStorageKey, trialTeacherPasscode);
      persistTeacherSession(trialTeacherAccount);
    }

    setTeacherHasAccount(true);
    setTeacherAuthenticated(true);
    setTeacherAccountInput(trialTeacherAccount);
    setTeacherPasscodeInput("");
    setTeacherSetupAccount("");
    setTeacherSetupPasscode("");
    setTeacherAuthStatus("已用班级试用快速进入教师工作台。正式上线需使用园所账号系统。");
  }

  function logoutTeacherAccount() {
    if (typeof window !== "undefined") {
      clearTeacherSession();
    }

    cleanupAudio();
    setTeacherAuthenticated(false);
    setTeacherPasscodeInput("");
    setTeacherAuthStatus("已退出教师工作台，请重新登录后再查看。");
  }

  function resetTeacherAccountSetup() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确认重置本机教师账号吗？这只会清除这台设备上的教师登录口令，不会删除幼儿记录、家长反馈或生成内容。")
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(teacherAccountStorageKey);
      window.localStorage.removeItem(teacherPasscodeStorageKey);
      clearTeacherSession();
    }

    setTeacherHasAccount(false);
    setTeacherAuthenticated(false);
    setTeacherAccountInput("");
    setTeacherPasscodeInput("");
    setTeacherSetupAccount("");
    setTeacherSetupPasscode("");
    setTeacherAuthStatus("旧的本机教师账号已清除。请重新设置教师账号和至少 4 位口令。");
  }

  if (!teacherAuthHydrated || !teacherAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
        <section className="w-full rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-10">
          <p className="text-sm font-semibold text-teal-700">老师身份确认</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
            {teacherHasAccount ? "登录本机班级试用账号" : "创建本机班级试用账号"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            当前为班级试用模式。本机班级试用账号仅用于保护这台设备上的班级数据，老师可查看幼儿互动记录、家长反馈和课程生成内容。
            该口令仅用于本机试用，不用于正式上线；正式上线需后端账号、HTTPS 与加密存储。
            如果这台设备已经保存过旧账号，请使用下方“重置本机教师账号”，只会重设登录口令，不会删除幼儿记录。
          </p>

          <div className="mt-8 grid gap-4 rounded-[1.5rem] bg-white/86 p-5 shadow-sm md:grid-cols-2">
            {teacherHasAccount ? (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  本机班级试用账号
                  <input
                    value={teacherAccountInput}
                    onChange={(event) => setTeacherAccountInput(event.target.value)}
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="请输入本机班级试用账号"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  登录口令
                  <input
                    value={teacherPasscodeInput}
                    onChange={(event) => setTeacherPasscodeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        loginTeacherAccount();
                      }
                    }}
                    type="password"
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="请输入口令"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  设置本机班级试用账号
                  <input
                    value={teacherSetupAccount}
                    onChange={(event) => setTeacherSetupAccount(event.target.value)}
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="例如：中一班老师"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  设置登录口令
                  <input
                    value={teacherSetupPasscode}
                    onChange={(event) => setTeacherSetupPasscode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        createTeacherAccount();
                      }
                    }}
                    type="password"
                    className="mt-2 w-full rounded-[1.2rem] border border-slate-100 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-teal-300"
                    placeholder="至少 4 位"
                  />
                </label>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={teacherHasAccount ? loginTeacherAccount : createTeacherAccount}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              type="button"
            >
              {teacherHasAccount ? "进入教师工作台" : "创建并进入"}
            </button>
            <button
              onClick={quickEnterTeacherTrialAccount}
              className="rounded-full bg-teal-100 px-5 py-3 text-sm font-semibold text-teal-900 ring-1 ring-teal-200 transition hover:-translate-y-0.5 hover:bg-teal-200"
              type="button"
            >
              班级试用快速进入
            </button>
            <button
              onClick={resetTeacherAccountSetup}
              className="rounded-full bg-rose-100 px-5 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 transition hover:-translate-y-0.5 hover:bg-rose-200"
              type="button"
            >
              重置本机教师账号
            </button>
            <p className="text-sm font-semibold text-teal-700">{teacherAuthStatus}</p>
          </div>
          <p className="mt-3 rounded-[1.2rem] bg-teal-50 px-4 py-3 text-sm leading-7 text-teal-950">
            班级试用快速进入仅用于本机演示和班级试用，正式上线需使用园所账号系统。
          </p>
          {teacherHasAccount ? (
            <div className="mt-4 rounded-[1.3rem] bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
              如果无法进入，通常是旧本机口令还保存在浏览器里。点击“重置本机教师账号”后，可立即设置新的本机班级试用账号；幼儿记录、家长反馈和生成内容都会保留。
            </div>
          ) : (
            <div className="mt-4 rounded-[1.3rem] bg-teal-50 px-4 py-3 text-sm leading-7 text-teal-950">
              首次使用请设置一个便于本班老师记住的本机班级试用账号，账号至少 2 个字，口令至少 4 位。
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
      {activeTeacherPanel !== "home" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-white/82 px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            当前模板：{teacherPanelLabels[activeTeacherPanel]}
          </p>
          <button
            onClick={() => setActiveTeacherPanel("home")}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            type="button"
          >
            返回教师首页
          </button>
        </div>
      ) : null}
      <section
        id="teacher-ai-summary"
        hidden={activeTeacherPanel !== "home"}
        className="scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-6 shadow-[0_22px_70px_rgba(49,93,104,0.14)] md:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              闽食小当家 · 教师工作台
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold text-slate-900 md:text-5xl">
              AI观察数据
              <span className="block text-2xl text-slate-700 md:text-3xl">再生成跟进并同步家长</span>
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              闽食小当家——幼习宝·闽食成长岛教育智能体：先看今日互动、常规、食物观察、家长反馈和重点幼儿，再进入对应工作区。
              {premiumTtsEnabled ? ` ${premiumVoiceLabel} 可用于试播老师引导语和活动口令。` : ""}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-white/82 px-4 py-2 text-sm font-semibold text-teal-900 shadow-sm">
              {aiDraftReviewNotice} · {aiConfirmedUseNotice}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTeacherPanel("teacher-data-export")}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
              type="button"
            >
              导出数据汇总
            </button>
            <button
              onClick={logoutTeacherAccount}
              className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
              type="button"
            >
              退出班级试用账号
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teacherAiSummaryStats.map((item, index) => (
            <div
              key={item.label}
              className={`rounded-[1.4rem] px-4 py-4 shadow-sm ${
                index === 0
                  ? "bg-white"
                  : index === 1
                    ? "bg-teal-50"
                    : index === 2
                      ? "bg-amber-50"
                      : index === 3
                        ? "bg-rose-50"
                        : index === 4
                          ? "bg-orange-50"
                          : "bg-cyan-50"
              }`}
            >
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p
                className={`mt-2 font-semibold text-slate-950 ${
                  typeof item.value === "string" && item.value.length > 10
                    ? "text-sm leading-6"
                    : "text-3xl"
                }`}
              >
                {item.value}
              </p>
              <p className="mt-2 text-xs leading-5 font-semibold text-slate-600">{item.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">本周趋势</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">儿童端打卡、食物观察和家长反馈合并统计。</p>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
                数据汇总
              </span>
            </div>
            <div className="mt-4 flex items-end gap-2">
              {teacherDataOverview.weeklyTrend.map((item) => (
                <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end rounded-[0.9rem] bg-slate-50 px-2 py-2">
                    <span
                      className="block w-full rounded-[0.7rem] bg-teal-500"
                      style={{
                        height: `${Math.max(8, (item.value / teacherDataOverview.maxWeeklyValue) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{item.label}</span>
                  <span className="text-xs font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">类型占比</p>
            <div className="mt-3 space-y-3">
              {teacherDataOverview.typeRows.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-900">{item.value}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <span
                      className={`block h-2 rounded-full ${item.tone}`}
                      style={{
                        width: `${Math.max(4, (item.value / teacherDataOverview.maxTypeValue) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">每位幼儿次数</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {teacherDataOverview.childRows.length > 0 ? (
                teacherDataOverview.childRows.map((child) => (
                  <div key={child.id} className="rounded-[1rem] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-600">{child.name}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950">{child.value}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-[1rem] bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-500">
                  添加花名册并完成儿童端打卡后显示每位幼儿次数。
                </p>
              )}
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">幼儿表达关键词</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {teacherDataOverview.keywordRows.length > 0 ? (
                teacherDataOverview.keywordRows.map((keyword) => (
                  <span
                    key={keyword.label}
                    className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900"
                  >
                    {keyword.label} · {keyword.value}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  等待幼儿语音、文字或选择记录
                </span>
              )}
            </div>
          </div>
        </div>

        <details className="mt-5 rounded-[1.4rem] bg-white/78 px-4 py-4 text-sm leading-7 text-slate-700">
          <summary className="cursor-pointer list-none font-semibold text-slate-900">
            查看证据链说明
          </summary>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mt-3 font-semibold text-slate-900">教育智能体证据链</p>
              <p className="mt-1 text-slate-600">
                把 AI 正向提醒、幼儿互动记录、教师跟进、家庭延续和反馈沉淀连起来，展示常规改善证据。
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
              班级试用可追踪
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {[
              { label: "儿童互动", value: miniGameSummaryStats.total, hint: "累计任务" },
              { label: "重点线索", value: classOverview.focusCount, hint: "待跟进" },
              { label: "家园同步", value: parentSyncRecords.length, hint: "已发送" },
              { label: "家庭反馈", value: parentFeedbackRecords.length, hint: "家长回流" },
              { label: "奖章沉淀", value: growthArchive.badgeRecords.length, hint: "成长表现" },
            ].map((item, index) => (
              <div key={item.label} className="rounded-[1.2rem] bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  {index + 1}. {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{item.hint}</p>
              </div>
            ))}
          </div>
        </details>

        <div className="mt-5 grid gap-3">
          <div className="rounded-[1.4rem] bg-white/78 px-4 py-3 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">推荐下一步</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendedNextSteps.map((step) => (
                <span
                  key={step}
                  className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"
                >
                  {step}
                </span>
              ))}
            </div>
            <p className="mt-2">优先处理待回复家长反馈、食物观察和未绑定小名牌记录。</p>
            {classOverview.unboundRecords > 0
              ? ` 当前有 ${classOverview.unboundRecords} 条未绑定记录，请先引导幼儿选择小名牌。`
              : ""}
          </div>
        </div>
      </section>

      <section
        hidden={activeTeacherPanel !== "teacher-child-windows"}
        className="order-1 rounded-[2.5rem] bg-[linear-gradient(135deg,#f6fffb_0%,#ffffff_52%,#fff8df_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">AI重点观察与问题汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">看常规、闽食和家园反馈线索</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              AI 辅助分析与生成，教师负责审核、修改、确认和应用。
            </p>
          </div>
          <span className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            AI 分析 {aiDailyObservationCards.length} 项
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "一日常规",
              cards: aiDailyObservationCards.filter((card) =>
                ["今日参与情况", "一日常规表现", "今日建议动作"].includes(card.label),
              ),
            },
            {
              title: "闽食观察",
              cards: aiDailyObservationCards.filter((card) =>
                ["闽食探索表现", "需要老师关注"].includes(card.label),
              ),
            },
            {
              title: "家园反馈",
              cards: [
                {
                  label: "家长反馈",
                  value:
                    newParentFeedbackCount > 0
                      ? `${newParentFeedbackCount} 条家长反馈待回复，可先生成家园同步话术。`
                      : "暂无新的家长反馈，已同步建议可继续观察家庭回流。",
                },
              ],
            },
          ].map((group) => (
            <article key={group.title} className="rounded-[1.8rem] bg-white/88 p-4 shadow-sm">
              <p className="text-sm font-semibold text-teal-700">{group.title}</p>
              <div className="mt-3 space-y-3">
                {group.cards.map((card) => (
                  <div key={card.label} className="rounded-[1.2rem] bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                    <p className="mt-1 text-sm leading-7 text-slate-700">{card.value}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div id="teacher-child-windows" className="mt-6 scroll-mt-24 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cyan-700">重点记录操作</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">生成跟进、同步家长或鼓励语</h3>
            </div>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              {aiFocusInsightRows.length} 条
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {aiFocusInsightRows.length > 0 ? (
              aiFocusInsightRows.map((row) => (
                <article key={row.id} className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.childName} · {row.title}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-700">{row.meaning}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                      AI 线索
                    </span>
                  </div>
                  <p className="mt-3 rounded-[1.1rem] bg-emerald-50 px-3 py-2 text-sm leading-7 text-emerald-900">
                    下一步：{row.nextAction}
                  </p>
                  <details className="mt-3 rounded-[1.1rem] bg-white px-3 py-2 shadow-sm">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-900">
                      处理 AI 建议
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => generateAiFocusPlan(row.kind, row.recordKey)}
                        className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                        type="button"
                      >
                        跟进建议
                      </button>
                      <button
                        onClick={() => syncAiFocusToParent(row.kind, row.recordKey)}
                        className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                        type="button"
                      >
                        家园话术
                      </button>
                      <button
                        onClick={() => generateAiFocusEncouragement(row.kind, row.recordKey)}
                        className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                        type="button"
                      >
                        鼓励语
                      </button>
                    </div>
                  </details>
                </article>
              ))
            ) : (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600 lg:col-span-2">
                暂无重点线索。幼儿完成一次儿童端互动后，这里会自动给出教育含义和下一步跟进。
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">按幼儿查看近期记录</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">一个幼儿一个窗口</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                先看每位幼儿的次数、食物观察、家庭反馈和最新 AI 观察，再点开查看细节，不把全部记录铺满页面。
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800">
              {childRecordSummaryRows.length} 位
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {childRecordSummaryRows.length > 0 ? (
              childRecordSummaryRows.map((row) => {
                const expanded = selectedChildSummaryId === row.child.id;
                const trendMax = Math.max(row.miniCount, row.foodCount, row.feedbackCount, row.badgeCount, 1);
                const trendItems = [
                  { label: "常规互动", value: row.miniCount, tone: "bg-teal-500" },
                  { label: "食物观察", value: row.foodCount, tone: "bg-amber-500" },
                  { label: "家庭反馈", value: row.feedbackCount, tone: "bg-rose-500" },
                  { label: "奖章变化", value: row.badgeCount, tone: "bg-cyan-500" },
                ];

                return (
                  <article key={row.child.id} className="rounded-[1.4rem] bg-slate-50 px-4 py-4">
                    <button
                      onClick={() => setSelectedChildSummaryId(expanded ? "" : row.child.id)}
                      className="w-full text-left"
                      type="button"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {row.child.className ? `${row.child.className} · ` : ""}
                            {formatChildLabel(row.child)}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">{row.latestObservation}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                          {expanded ? "收起" : "展开"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        {trendItems.map((item) => (
                          <div key={item.label} className="rounded-[1rem] bg-white px-3 py-2">
                            <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                            <p className="mt-1 text-lg font-semibold text-slate-950">{item.value}</p>
                            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${item.tone}`}
                                style={{ width: `${Math.max(8, (item.value / trendMax) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>
                    {expanded ? (
                      <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3">
                        {row.detailLines.length > 0 ? (
                          <div className="grid gap-2">
                            {row.detailLines.map((line, index) => (
                              <p key={`${row.child.id}-detail-${index}-${line}`} className="text-sm leading-7 text-slate-700">
                                {line}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm leading-7 text-slate-600">
                            暂无详细记录。孩子完成一次互动或家庭反馈后，这里会出现跟进线索。
                          </p>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600 lg:col-span-2">
                还没有花名册。请在底部基础设置导入或添加幼儿后，再查看个人窗口。
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        id="teacher-weekly-menu"
        hidden={activeTeacherPanel !== "teacher-weekly-menu"}
        className="order-2 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#fff7ed_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">闽食每日探味</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">每周食谱发布</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              提前录入本周食谱，系统按日期自动进入儿童端。
            </p>
          </div>
          <button
            onClick={publishTodayMenuToChildren}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            type="button"
          >
            检查今日自动播报
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div
            className="rounded-[1.8rem] border border-cyan-100 bg-white/90 p-5 shadow-sm"
            onFocusCapture={() => setMenuMediaActiveTarget(menuDate, menuMealType)}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-700">本周食谱录入</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">提前保存日期和餐次</h3>
              </div>
              <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900">
                左侧填写 · 右侧预览
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                日期
                <input
                  value={menuDate}
                  onChange={(event) => {
                    const nextDate = event.target.value || todayMenuDateKey;
                    setMenuDate(nextDate);
                    setMenuMediaActiveTarget(nextDate, menuMealType);
                  }}
                  className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
                  type="date"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                餐次
                <select
                  value={menuMealType}
                  onChange={(event) => {
                    const nextMealType = event.target.value as MealType;
                    setMenuMealType(nextMealType);
                    setMenuMediaActiveTarget(menuDate, nextMealType);
                  }}
                  className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
                >
                  {mealTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              菜品名称
              <input
                value={menuDishName}
                onChange={(event) => setMenuDishName(event.target.value)}
                placeholder="如 香菇青菜、紫菜蛋汤、面线糊"
                className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              主要食材
              <input
                value={menuIngredients}
                onChange={(event) => setMenuIngredients(event.target.value)}
                placeholder="用顿号或逗号分隔，如 香菇、青菜、鸡蛋"
                className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              重点观察食材（优先进入观察卡）
              <input
                value={menuFocusIngredients}
                onChange={(event) => setMenuFocusIngredients(event.target.value)}
                placeholder="如 香菇、小葱、蒜"
                className="mt-2 w-full rounded-[1.1rem] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {menuFocusIngredientSuggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    const current = splitMenuText(menuFocusIngredients);
                    setMenuFocusIngredients(
                      current.includes(item) ? current.join("、") : [...current, item].join("、"),
                    );
                  }}
                  className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-200"
                  type="button"
                >
                  + {item}
                </button>
              ))}
            </div>
            {menuNutritionPreview ? (
              <p className="mt-4 rounded-[1.2rem] bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">
                {menuNutritionPreview}
              </p>
            ) : (
              <p className="mt-4 rounded-[1.2rem] bg-cyan-50 px-4 py-3 text-sm leading-7 text-cyan-900">
                填好菜名和主要食材后，这里会预览儿童端听到的营养提示。
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={saveWeeklyMenuEntry}
                className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                保存到本周食谱
              </button>
              <p className="text-sm font-semibold text-cyan-900">{menuStatus}</p>
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-rose-700">今日临时调整</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">只覆盖所选日期和餐次</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  日期：{formatMenuDate(overrideDate || todayMenuDateKey)} · {getWeekdayLabel(overrideDate || todayMenuDateKey)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
                  {todayPublishedMenuEntries.length} 条
                </span>
                {todayOverrideEntries.length > 0 ? (
                  <span className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
                    临时改餐 {todayOverrideEntries.length}
                  </span>
                ) : null}
              </div>
            </div>
            <div
              className="mt-4 rounded-[1.4rem] bg-rose-50 px-4 py-4"
              onFocusCapture={(event) => {
                if (event.target instanceof HTMLElement && event.target.closest("[data-menu-media-panel='true']")) {
                  return;
                }

                setMenuMediaActiveTarget(overrideDate || todayMenuDateKey, overrideMealType);
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-rose-800">填写临时改餐</p>
                  <p className="mt-1 text-xs leading-6 text-rose-700">
                    临时更改只覆盖所选日期和餐次，不影响本周原始食谱。
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 shadow-sm">
                  按日期餐次和菜名保存
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">
                  日期
                  <input
                    value={overrideDate}
                    onChange={(event) => {
                      const nextDate = event.target.value || todayMenuDateKey;
                      setOverrideDate(nextDate);
                      loadDailyOverrideDraft(nextDate, overrideMealType);
                    }}
                    className="mt-2 w-full rounded-[1.1rem] border border-rose-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-300"
                    type="date"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  餐次
                  <select
                    value={overrideMealType}
                    onChange={(event) => {
                      const nextMealType = event.target.value as MealType;
                      setOverrideMealType(nextMealType);
                      loadDailyOverrideDraft(overrideDate || todayMenuDateKey, nextMealType);
                    }}
                    className="mt-2 w-full rounded-[1.1rem] border border-rose-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-300"
                  >
                    {mealTypeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  临时菜品
                  <input
                    value={overrideDishName}
                    onChange={(event) => setOverrideDishName(event.target.value)}
                    placeholder="如 番茄鸡蛋面"
                    className="mt-2 w-full rounded-[1.1rem] border border-rose-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-300"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  临时食材
                  <input
                    value={overrideIngredients}
                    onChange={(event) => setOverrideIngredients(event.target.value)}
                    placeholder="如 番茄、鸡蛋、面条"
                    className="mt-2 w-full rounded-[1.1rem] border border-rose-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-300"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  重点观察食材
                  <input
                    value={overrideFocusIngredients}
                    onChange={(event) => setOverrideFocusIngredients(event.target.value)}
                    placeholder="如 番茄、鸡蛋"
                    className="mt-2 w-full rounded-[1.1rem] border border-rose-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-rose-300"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={saveDailyMenuOverride}
                  className="rounded-full bg-rose-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  type="button"
                >
                  保存临时改餐
                </button>
                <p className="text-sm font-semibold text-rose-800">{overrideStatus}</p>
              </div>
            </div>
            <MenuMediaDraftPanel
              title="今日观察素材"
              description="图片和视频共用一个入口；AI补图在这里作为备用，教师确认前儿童端不可见。"
              draft={activeMenuMediaDraft}
              date={menuMediaActiveDate}
              mealType={menuMediaActiveMealType}
              dishName={activeMenuMediaValues.dishName}
              ingredientsText={activeMenuMediaValues.ingredients.join("、")}
              isAiGenerating={isMenuMediaAiImageLoading}
              onVideoUpload={(file) => void handleMenuVideoUpload(file)}
              onManualImageUpload={(file) => void handleMenuManualImageUpload(file)}
              onGenerateAiImage={() => void generateMenuAiObservationImage()}
              onRegenerateAiImage={(imageId) => void regenerateMenuAiObservationImage(imageId)}
              onUpdateAiPrompt={updateMenuAiImagePrompt}
              onUseImage={useMenuObservationImage}
              onDeleteImage={deleteMenuObservationImage}
              onToggleImage={toggleMenuObservationImage}
              onSetCover={setMenuCoverImage}
              onConfirm={confirmMenuObservationImages}
              onClear={clearMenuMediaDraft}
            />
            <div className="mt-4 grid gap-3">
              {todayPublishedMenuEntries.length > 0 ? (
                todayPublishedMenuEntries
                  .map((entry) => (
                    <article key={entry.id} className="rounded-[1.4rem] bg-cyan-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">
                            日期：{formatMenuDate(entry.date)} · {getWeekdayLabel(entry.date)} · 餐次：{entry.mealType}
                          </p>
                          <p className="font-semibold text-slate-900">
                            {entry.mealType} · {entry.dishName}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-slate-700">
                            食材：{entry.ingredients.join("、")}；重点观察：{entry.focusIngredients.join("、")}
                          </p>
                          <p className="mt-2 rounded-[1rem] bg-white/85 px-3 py-2 text-sm leading-7 text-cyan-900">
                            {buildWeeklyMenuNutritionPreview(entry)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                            entry.publishSource === "dailyOverride"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {entry.sourceLabel}
                        </span>
                      </div>
                      {entry.coverImageUrl ? (
                        <div className="mt-3 rounded-[1.2rem] bg-white/80 p-3">
                          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={entry.coverImageUrl}
                              alt={`${entry.dishName}观察主图`}
                              className="h-28 w-full rounded-[1rem] object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">已确认观察图片</p>
                              <p className="mt-1 text-xs leading-6 text-slate-600">
                                来源：{getMenuMediaSourceText(entry.mediaSource)}；观察图组：
                                {entry.observationImages?.length ?? 0} 张。
                              </p>
                              {entry.mediaSource === "ai_generated" ? (
                                <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                                  AI生成，教师确认后使用
                                </span>
                              ) : (
                                <span className="mt-2 inline-flex rounded-full bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-900">
                                  真实观察图，教师已确认
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {entry.publishSource === "dailyOverride" ? (
                        <button
                          onClick={() => removeDailyMenuOverride(entry.id)}
                          className="mt-3 rounded-full bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                          type="button"
                        >
                          删除临时改餐，恢复本周食谱
                        </button>
                      ) : (
                        <button
                          onClick={() => removeWeeklyMenuEntry(entry.id)}
                          className="mt-3 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-rose-50 hover:text-rose-800"
                          type="button"
                        >
                          移除本周食谱
                        </button>
                      )}
                    </article>
                  ))
              ) : (
                <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                  今天还没有食谱。可先在左侧录入今天或本周对应日期的菜品，系统会按日期自动进入儿童端。
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        hidden={activeTeacherPanel !== "teacher-weekly-menu"}
        className="order-2 rounded-[2.5rem] bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_56%,#ecfeff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-700">每日食谱观察汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">今日菜品与食材接受度</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              按今日自动发布食谱聚合儿童端观察记录，只用于温和食育跟进和班级聚合建议。
            </p>
          </div>
          <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-900">
            {todayMenuObservationRows.length} 类观察
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {todayMenuObservationRows.length > 0 ? (
            todayMenuObservationRows.map((row) => (
              <article key={row.dishName} className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-orange-700">今日菜品</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">{row.dishName}</h3>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-900">
                    {row.count} 条观察
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <p>重点食材：<span className="font-semibold text-slate-900">{row.topIngredient}</span></p>
                  <p>高频原因：<span className="font-semibold text-slate-900">{row.topReason}</span></p>
                  <p>靠近小步：{row.topStep}</p>
                  <p>涉及幼儿数：{row.childCount} 名</p>
                  <p className="rounded-[1.2rem] bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">
                    推荐：{row.recommendedStep}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => bringDailyMenuSummaryToGeneration(row, "tomorrow")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    处理 AI 建议
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-[1.8rem] bg-white/88 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              今日食谱还没有关联观察。发布食谱后，儿童端完成美食认识观察卡，这里会显示菜品、食材、原因和靠近小步。
            </p>
          )}
        </div>
      </section>

      <section
        hidden={activeTeacherPanel !== "teacher-child-windows"}
        className="order-2 rounded-[2.5rem] bg-[linear-gradient(135deg,#fff8df_0%,#ffffff_56%,#e6fbfa_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700">班级食物观察汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">AI 食物观察分析</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              聚合儿童端“美食认识观察卡”，帮助老师看到高频食物、原因、涉及幼儿和推荐靠近小步。
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            {foodObservationSummaryRows.length} 类食物
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {foodObservationSummaryRows.length > 0 ? (
            foodObservationSummaryRows.map((row) => (
              <article key={row.foodLabel} className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-700">高频食物</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-900">{row.foodLabel}</h3>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    {row.count} 条记录
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                  <p>高频原因：<span className="font-semibold text-slate-900">{row.topReason}</span></p>
                  <p>涉及幼儿：{row.childCount > 0 ? `${row.childCount} 名 · ${row.childNames.join("、")}` : "暂无绑定身份"}</p>
                  <p>最近记录：{row.latestRecord.childName ?? "未选择身份"} · {new Date(row.latestRecord.recordedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="rounded-[1.2rem] bg-emerald-50 px-3 py-2 font-semibold text-emerald-900">
                    推荐靠近小步：{row.recommendedStep}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => bringFoodSummaryToGeneration(row, "food-follow")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                    type="button"
                  >
                    处理 AI 建议
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-[1.8rem] bg-white/88 px-5 py-6 text-sm leading-7 text-slate-600 lg:col-span-3">
              暂无食物观察记录。儿童端完成“美食认识观察卡”后，这里会按食物名称自动汇总。
            </p>
          )}
        </div>
      </section>


      <section
        id="teacher-parent-feedback"
        hidden={activeTeacherPanel !== "teacher-parent-feedback"}
        className="order-4 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_52%,#fff2f5_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose-700">家园共育</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">家园同步与反馈</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">选择一条家长反馈，回复后同步家庭建议。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
              待处理 {newParentFeedbackCount} 条
            </span>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              已回复 {repliedParentFeedbackCount} 条
            </span>
          </div>
        </div>

        <p className="mt-4 rounded-[1.4rem] bg-white/82 px-4 py-3 text-sm font-semibold text-cyan-900">
          {parentSyncStatus}
        </p>
        <p className="mt-3 rounded-[1.4rem] bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          {aiDraftReviewNotice}
        </p>

        <div className="mt-4 rounded-[1.4rem] bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
          <p className="font-semibold">家庭光盘行动汇总</p>
          <p>
            已收到 {familyPlateActionSummary.count} 条家庭光盘行动反馈，涉及{" "}
            {familyPlateActionSummary.childCount} 名幼儿。这里不做排行，只作为个人成长和家园延续证据。
            {familyPlateActionSummary.latest
              ? ` 最近一条：${familyPlateActionSummary.latest.childName} · ${familyPlateActionSummary.latest.content}`
              : " 家长提交后会进入这里和反馈列表。"}
          </p>
        </div>

        <div className="mt-5 rounded-[1.8rem] bg-white/86 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cyan-700">已同步给家长</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">老师建议与居家任务</h3>
            </div>
            <span className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900">
              {parentSyncRecords.length} 条
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {parentSyncRecords.slice(0, 4).map((record) => (
              <article key={record.id} className="rounded-[1.4rem] bg-cyan-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{record.title}</p>
                    <p className="mt-1 text-xs font-semibold text-cyan-900">
                      {record.childName} · {formatParentSyncTime(record.syncedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-900">
                    {record.sourceLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-700">{record.summary}</p>
                <p className="mt-3 rounded-[1.1rem] bg-white/82 px-3 py-2 text-sm leading-7 text-slate-700">
                  家庭小任务：{record.homePractice}
                </p>
              </article>
            ))}
            {parentSyncRecords.length === 0 ? (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600 lg:col-span-2">
                还没有同步给家长的内容。可从互动记录中点击“同步家长”，这里会显示老师建议和家庭小任务。
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-rose-700">家长反馈列表</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">选择要回复的信息</h3>
              </div>
              <span className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
                {parentFeedbackRecords.length} 条
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {latestParentFeedbackRecords.length > 0 ? (
                latestParentFeedbackRecords.map((record) => {
                  const isSelected = selectedParentFeedback?.id === record.id;
                  const isReplied = Boolean(record.teacherReply || record.teacherGuidance);

                  return (
                    <button
                      key={record.id}
                      onClick={() => setSelectedParentFeedbackId(record.id)}
                      className={`rounded-[1.4rem] px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                        isSelected
                          ? "bg-rose-100 ring-2 ring-rose-300"
                          : record.status === "new"
                            ? "bg-rose-50"
                            : "bg-slate-50"
                      }`}
                      type="button"
                    >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {record.childName} · {getParentFeedbackCategoryLabel(record.category)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatParentSyncTime(record.createdAt)}
                          {record.status === "new" ? " · 新反馈" : " · 已读"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          isReplied ? "bg-cyan-100 text-cyan-900" : "bg-white text-rose-800"
                        }`}
                      >
                        {isReplied ? "已回复" : "待回复"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">
                      {record.content}
                    </p>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                  家庭延续还没有提交反馈。家长选择幼儿身份后，可在家庭延续页填写疑惑、想法或在家观察。
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            {selectedParentFeedback ? (
              (() => {
                const draft = getParentFeedbackDraft(selectedParentFeedback);

                return (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-cyan-700">回复与育儿指导</p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-900">
                          {selectedParentFeedback.childName} ·{" "}
                          {getParentFeedbackCategoryLabel(selectedParentFeedback.category)}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatParentSyncTime(selectedParentFeedback.createdAt)}
                          {selectedParentFeedback.status === "new" ? " · 新反馈" : " · 已读"}
                        </p>
                      </div>
                      {selectedParentFeedback.status === "new" ? (
                        <button
                          onClick={() => markParentFeedbackRead(selectedParentFeedback.id)}
                          className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 transition hover:-translate-y-0.5"
                          type="button"
                        >
                          标记已读
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-[1.4rem] bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">家长反馈原文</p>
                      <p className="mt-2 text-sm leading-7 text-slate-800">
                        {selectedParentFeedback.content}
                      </p>
                      {selectedParentFeedback.attachmentDataUrl ? (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-slate-500">
                            家庭观察照片 · {selectedParentFeedback.attachmentName ?? "照片"}
                          </p>
                          <div
                            aria-label={
                              selectedParentFeedback.attachmentName ?? "家庭观察照片"
                            }
                            className="mt-2 h-32 w-32 rounded-[1.2rem] bg-cover bg-center shadow-sm"
                            role="img"
                            style={{
                              backgroundImage: `url(${selectedParentFeedback.attachmentDataUrl})`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {selectedParentFeedback.teacherReply || selectedParentFeedback.teacherGuidance ? (
                      <div className="mt-4 rounded-[1.4rem] bg-cyan-50 px-4 py-3">
                        <p className="text-xs font-semibold text-cyan-800">
                          已保存到家庭延续 ·{" "}
                          {formatParentSyncTime(
                            selectedParentFeedback.teacherRepliedAt ??
                              selectedParentFeedback.createdAt,
                          )}
                        </p>
                        {selectedParentFeedback.teacherReply ? (
                          <p className="mt-2 text-sm leading-7 text-slate-800">
                            回复：{selectedParentFeedback.teacherReply}
                          </p>
                        ) : null}
                        {selectedParentFeedback.teacherGuidance ? (
                          <p className="mt-2 text-sm leading-7 text-slate-800">
                            育儿指导：{selectedParentFeedback.teacherGuidance}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <label className="mt-4 block">
                      <span className="text-sm font-semibold text-slate-700">教师修改 · 老师回复家长</span>
                      <textarea
                        value={draft.reply}
                        onChange={(event) =>
                          updateParentFeedbackDraft(
                            selectedParentFeedback.id,
                            "reply",
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-28 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-rose-300 focus:bg-white"
                        placeholder="先回应家长的担心，再说明老师会如何观察和支持孩子。"
                      />
                    </label>

                    <label className="mt-4 block">
                      <span className="text-sm font-semibold text-slate-700">教师修改 · 家庭育儿指导</span>
                      <textarea
                        value={draft.guidance}
                        onChange={(event) =>
                          updateParentFeedbackDraft(
                            selectedParentFeedback.id,
                            "guidance",
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-28 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-300 focus:bg-white"
                        placeholder="给家长一到两个在家能执行的小建议，避免夸大和贴标签。"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={() => generateParentFeedbackResponse(selectedParentFeedback)}
                        className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={parentFeedbackAiLoadingId === selectedParentFeedback.id}
                        type="button"
                        >
                          {parentFeedbackAiLoadingId === selectedParentFeedback.id
                            ? "生成中..."
                            : "处理 AI 建议"}
                      </button>
                      <button
                        onClick={() => saveParentFeedbackResponse(selectedParentFeedback)}
                        className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                        type="button"
                      >
                        确认并同步家长
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="rounded-[1.4rem] bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-600">
                请先在左侧选择一条家长反馈。选择后，这里会显示家长原话、老师回复和育儿指导输入区。
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        hidden={activeTeacherPanel !== "teacher-child-windows"}
        className="order-5 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fff9_0%,#ffffff_52%,#fff7dc_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">成效变化记录</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">把互动变化沉淀成证据</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              成效证明不做复杂系统，先从提醒次数、主动完成次数、食物接受变化、家园反馈次数形成证据。
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
            最近 {effectChangeRecords.length} 条
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {effectEvidenceStats.map((item) => (
            <div key={item.label} className="rounded-[1.4rem] bg-white/88 px-4 py-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{item.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {effectChangeRecords.map((line, index) => (
            <p
              key={`effect-change-${index}-${line}`}
              className="rounded-[1.4rem] bg-white/88 px-4 py-4 text-sm leading-7 text-slate-700 shadow-sm"
            >
              {line}
            </p>
          ))}
        </div>
      </section>

      <section
        ref={generationSectionRef}
        id="teacher-ai-generate"
        hidden={activeTeacherPanel !== "teacher-ai-generate"}
        className="order-3 scroll-mt-24 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">跟进生成与修改区</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">AI生成建议，教师修改确认</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            只选择年龄阶段和生成类型；生成后由教师修改、确认，再同步、发布或发送。
          </p>
          <p className="mt-3 inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950">
            {aiDraftReviewNotice}
          </p>

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500">1. 年龄阶段</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {teacherAgeOptions.map((item) => (
                <button
                  key={item.label}
                  onClick={() => selectTeacherAge(item.label)}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    teacherAgeGroup === item.label
                      ? "bg-teal-700 text-white"
                      : "bg-teal-50 text-teal-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-teal-700">{getTeacherAgeFocus(teacherAgeGroup)}</p>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500">2. 类型选择</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {teacherTasks.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    selectTeacherTask(item, "任务类型已切换，会自动保存到这台设备。");
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
            <span>
              {isActivityPlanSelected
                ? "建议保留年龄段、时长、主题、已有经验和目标，教师确认后再使用。"
                : "建议写清年龄、场景和目标，教师确认后再使用。"}
            </span>
            <span className={teacherScenarioRemaining < 40 ? "text-amber-700" : "text-slate-500"}>
              还可输入 {teacherScenarioRemaining} 字
            </span>
          </div>

          <button
            onClick={() => void generate()}
            className="mt-5 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={isLoading || !scenario.trim()}
          >
            {isLoading ? "正在生成..." : "AI生成建议"}
          </button>

          <div className="mt-4 rounded-[1.5rem] bg-slate-50 px-4 py-4">
            <p className="text-sm leading-7 text-slate-600">
              小建议：活动目标尽量写成幼儿能做到、看得到的行为，例如“能按顺序模仿洗手步骤”。
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

          <details className="mt-4 rounded-[1.5rem] bg-white/82 p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
              生成历史小折叠 · 最近 {Math.min(filteredSavedResults.length, 6)} 条
            </summary>
            <div className="mt-3 grid gap-3">
              {filteredSavedResults.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => reuseSavedResult(item)}
                  className="rounded-[1.2rem] bg-slate-50 px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-teal-50"
                  type="button"
                >
                  <span className="block font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                    {item.task} · {item.content}
                  </span>
                </button>
              ))}
              {filteredSavedResults.length === 0 ? (
                <p className="rounded-[1.2rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                  还没有生成历史。生成跟进内容后，会保留最近 6 条方便复用。
                </p>
              ) : null}
            </div>
          </details>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#e6fbfa_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-teal-700">生成结果</p>
          {result ? (
            <input
              value={result.title}
              onChange={(event) => {
                const nextTitle = event.target.value.slice(0, 48);
                setResult((current) =>
                  current
                    ? {
                        ...current,
                        title: nextTitle,
                        needsReview: true,
                      }
                    : current,
                );
                setTeacherResultConfirmedAt("");
                setCopyStatus("标题已修改，复制和试播会使用老师确认后的内容。");
              }}
              className="mt-2 w-full rounded-[1.3rem] border border-teal-100 bg-white/90 px-4 py-3 text-xl font-semibold text-slate-900 outline-none transition focus:border-teal-400"
            />
          ) : (
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">还没有生成内容</h2>
          )}

          {result ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  result.fallbackUsed
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {result.fallbackUsed ? "备用草稿，需教师确认" : aiDraftReviewNotice}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                AI 辅助生成，教师负责审核、修改、确认和应用
              </span>
            </div>
          ) : null}

          <div className="mt-5 rounded-[2rem] bg-white/80 p-5">
            {result ? (
              <label className="block">
                <span className="text-xs font-semibold text-teal-700">
                  教师修改 · 确认后再复制、试播、同步或发布
                </span>
                <textarea
                  value={result.content}
                  onChange={(event) => {
                    const nextContent = event.target.value.slice(0, 900);
                    setResult((current) =>
                      current
                        ? {
                            ...current,
                            content: nextContent,
                            needsReview: true,
                          }
                        : current,
                    );
                    setTeacherResultConfirmedAt("");
                    setCopyStatus("生成内容已修改，后续复制和试播会使用修改后的版本。");
                  }}
                  className="mt-3 min-h-72 w-full resize-y rounded-[1.5rem] border border-teal-100 bg-slate-50 px-4 py-3 text-sm leading-8 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                />
              </label>
            ) : (
              <p className="whitespace-pre-line text-sm leading-8 text-slate-700">
                点击左侧按钮后，这里会出现可以继续修改的跟进建议、课堂活动、家园同步话术或鼓励语。
              </p>
            )}
          </div>

          {parentShareLine ? (
            <div className="mt-5 rounded-[1.8rem] bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">活动延伸建议</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{parentShareLine}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void generate()}
              className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? "重新生成中..." : "重新生成"}
            </button>
            {pendingParentSyncRecord ? (
              <button
                onClick={confirmPendingParentSync}
                className="rounded-full bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                disabled={!result}
                type="button"
              >
                确认并同步家长
              </button>
            ) : null}
            <button
              onClick={confirmTeacherResultDraft}
              className="rounded-full bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
              type="button"
            >
              教师确认
            </button>
            <button
              onClick={stashTeacherResultDraft}
              className="rounded-full bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
              type="button"
            >
              暂存草稿
            </button>
            <button
              onClick={exportTeacherAiWord}
              className="rounded-full bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-900 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
              type="button"
            >
              导出 Word（.doc）
            </button>
            <button
              onClick={() => void copyResult()}
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
            >
              复制结果
            </button>
            <button
              onClick={deleteTeacherResultDraft}
              className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
              type="button"
            >
              删除草稿
            </button>
            <button
              onClick={() => void previewResultVoice()}
              className="rounded-full bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={!result}
            >
              {isPreviewSpeaking ? "正在试播..." : "试播结果"}
            </button>
          </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          Word 导出为 Word 可打开的 .doc 兼容格式，包含 AI生成建议、教师修改内容、确认时间和“AI生成，教师确认后使用”标记。
        </p>

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

      <section
        id="teacher-ai-review"
        hidden={activeTeacherPanel !== "teacher-ai-review"}
        className="order-4 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f7fee7_0%,#ffffff_56%,#ecfeff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-lime-700">AI内容审核</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">AI生成内容，教师审核后使用</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              儿童端展示内容应以教师预设任务和知识库内容为主；AI生成内容默认进入教师审核，未经教师确认，不直接作为正式教学评价。
            </p>
            <p className="mt-3 inline-flex rounded-full bg-white/86 px-4 py-2 text-sm font-semibold text-lime-900 shadow-sm">
              AI只做辅助，不替代教师观察、判断和保育教育责任。
            </p>
          </div>
          <span className="rounded-full bg-white/88 px-4 py-2 text-sm font-semibold text-lime-900 shadow-sm">
            已保存 {aiReviewRecords.length} 条
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">内容类型</span>
                <select
                  value={aiReviewContentType}
                  onChange={(event) => setAiReviewContentType(event.target.value as AiReviewContentType)}
                  className="mt-2 w-full rounded-[1.1rem] border border-lime-100 bg-lime-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-lime-300"
                >
                  {aiReviewContentTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">教师审核状态</span>
                <select
                  value={aiReviewStatus}
                  onChange={(event) => setAiReviewStatus(event.target.value as AiReviewStatus)}
                  className="mt-2 w-full rounded-[1.1rem] border border-lime-100 bg-lime-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-lime-300"
                >
                  {aiReviewStatusOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-500">AI生成内容</span>
              <textarea
                value={aiReviewContent}
                onChange={(event) => setAiReviewContent(event.target.value.slice(0, 1200))}
                placeholder="粘贴 AI 生成的闽食介绍、儿歌、故事、家园任务或成长评语。"
                className="mt-2 min-h-40 w-full rounded-[1.4rem] border border-lime-100 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-lime-300"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-500">教师修改意见</span>
              <textarea
                value={aiReviewTeacherNote}
                onChange={(event) => setAiReviewTeacherNote(event.target.value.slice(0, 500))}
                placeholder="写下要改得更儿童化、更安全、更贴合本班情况的地方。"
                className="mt-2 min-h-28 w-full rounded-[1.4rem] border border-lime-100 bg-lime-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-lime-300"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={saveAiReviewRecord}
                className="rounded-full bg-lime-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
                type="button"
              >
                保存审核记录
              </button>
              <button
                onClick={() => {
                  setAiReviewContent("");
                  setAiReviewTeacherNote("");
                  setAiReviewStatus("待审核");
                  setAiReviewMessage("已清空当前填写内容。");
                }}
                className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
                type="button"
              >
                清空当前内容
              </button>
            </div>
            <p className="mt-4 rounded-[1.2rem] bg-lime-50 px-4 py-3 text-sm leading-7 font-semibold text-lime-900">
              {aiReviewMessage}
            </p>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">本地审核记录</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              当前为演示版本，正式部署需接入后端账号系统和加密数据库；这里用于展示参赛所需的“AI生成-教师审核-再使用”链路。
            </p>
            <div className="mt-4 grid gap-3">
              {aiReviewRecords.length > 0 ? (
                aiReviewRecords.map((record) => (
                  <article key={record.id} className="rounded-[1.4rem] bg-lime-50 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {record.contentType} · {record.status}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-lime-800">
                          {new Date(record.updatedAt).toLocaleString("zh-CN")} · {aiConfirmedUseNotice}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => reuseAiReviewRecord(record)}
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-lime-900 shadow-sm"
                          type="button"
                        >
                          继续修改
                        </button>
                        <button
                          onClick={() => removeAiReviewRecord(record.id)}
                          className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800"
                          type="button"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-700">{record.aiContent}</p>
                    {record.teacherNote ? (
                      <p className="mt-2 rounded-[1rem] bg-white/76 px-3 py-2 text-xs leading-6 font-semibold text-slate-600">
                        教师意见：{record.teacherNote}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="rounded-[1.2rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  还没有审核记录。可以先把 AI 生成的闽食介绍、故事或家园任务粘贴进左侧，再保存一条演示记录。
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        id="teacher-published-content"
        hidden={activeTeacherPanel !== "teacher-published-content"}
        className="order-5 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f6f0ff_0%,#ffffff_52%,#e7fbf7_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-violet-700">幼儿想法汇总</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">表达、关键词和需要关注的孩子</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">先看幼儿“对老师说”的表达数据，再创建原创绘本或模板。</p>
            <p className="mt-3 inline-flex rounded-full bg-white/86 px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm">
              {aiDraftReviewNotice}
            </p>
          </div>
          <span className="rounded-full bg-white/88 px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm">
            绘本 {teacherPictureBooks.filter((book) => book.themeId === "habit").length} · 模板 {habitTemplates.length}
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "表达次数", value: childExpressionSummary.total, hint: "对老师说/模板回应" },
              { label: "参与幼儿", value: childExpressionSummary.childCount, hint: "只统计已绑定小名牌" },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.4rem] bg-white/88 px-4 py-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-600">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.hint}</p>
              </div>
            ))}
            <div className="rounded-[1.4rem] bg-white/88 px-4 py-4 shadow-sm sm:col-span-2">
              <p className="text-sm font-semibold text-slate-900">AI摘要</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{childExpressionSummary.summary}</p>
            </div>
          </div>
          <div className="rounded-[1.6rem] bg-white/88 p-5 shadow-sm">
            <p className="text-sm font-semibold text-violet-900">表达关键词</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {childExpressionSummary.keywords.length > 0 ? (
                childExpressionSummary.keywords.map((keyword) => (
                  <span
                    key={keyword.label}
                    className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900"
                  >
                    {keyword.label} · {keyword.value}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                  等待儿童端“对老师说”
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-2">
              {(childExpressionSummary.latest.length > 0
                ? childExpressionSummary.latest
                : ["暂无幼儿表达记录。"]
              ).map((line, index) => (
                <p key={`child-expression-${index}-${line}`} className="rounded-[1.1rem] bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-violet-800">
              需关注幼儿：{childExpressionSummary.focusChildren.join("、") || "暂无"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-violet-700">教师发布绘本</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">AI协助生成绘本，教师修改后发布</h3>
              </div>
              <button
                onClick={() => void fillPictureBookFromResult()}
                className="rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-900 transition hover:-translate-y-0.5"
                type="button"
              >
                AI生成绘本故事
              </button>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-[1.5rem] bg-violet-50 p-4">
                <p className="text-sm font-semibold text-violet-900">左侧：教师输入区</p>
                <div className="mt-3 grid gap-3">
                  <select
                    value={pictureBookThemeId}
                    onChange={() => setPictureBookThemeId("habit")}
                    className="rounded-[1.1rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-300"
                  >
                    <option value="habit">幼习宝绘本</option>
                  </select>
                  <select
                    value={pictureBookAgeGroup}
                    onChange={(event) => setPictureBookAgeGroup(event.target.value)}
                    className="rounded-[1.1rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-300"
                  >
                    <option value="小班 3-4 岁">小班3-4岁</option>
                    <option value="中班 4-5 岁">中班4-5岁</option>
                    <option value="大班 5-6 岁">大班5-6岁</option>
                  </select>
                  <select
                    value={pictureBookType}
                    onChange={(event) => setPictureBookType(event.target.value)}
                    className="rounded-[1.1rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-300"
                  >
                    <option value="生活习惯绘本">生活习惯绘本</option>
                    <option value="情绪表达绘本">情绪表达绘本</option>
                    <option value="区域阅读绘本">区域阅读绘本</option>
                    <option value="闽食文化绘本">闽食文化绘本</option>
                  </select>
                  <input
                    value={pictureBookTitle}
                    onChange={(event) => setPictureBookTitle(event.target.value.slice(0, 36))}
                    placeholder="输入绘本名，如 饭前洗手小星"
                    className="rounded-[1.1rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-300"
                  />
                  <textarea
                    value={pictureBookText}
                    onChange={(event) => setPictureBookText(event.target.value.slice(0, 900))}
                    placeholder="输入绘本名或大概内容，再点 AI 生成绘本草稿。"
                    className="min-h-36 rounded-[1.4rem] border border-violet-100 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-violet-300"
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-violet-900">中间：AI生成草稿区</p>
                <p className="mt-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  {aiConfirmedUseNotice}
                </p>
                <textarea
                  value={pictureBookText}
                  onChange={(event) => setPictureBookText(event.target.value.slice(0, 900))}
                  placeholder="AI生成后，教师在这里修改每页文字。"
                  className="mt-3 min-h-44 w-full rounded-[1.4rem] border border-violet-100 bg-violet-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-violet-300"
                />
                <textarea
                  value={pictureBookImagePrompts}
                  onChange={(event) => setPictureBookImagePrompts(event.target.value.slice(0, 720))}
                  placeholder="每行一个图片提示词：封面、第一页、第二页……"
                  className="mt-3 min-h-28 w-full rounded-[1.4rem] border border-violet-100 bg-violet-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none focus:border-violet-300"
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    value={pictureBookQuestion}
                    onChange={(event) => setPictureBookQuestion(event.target.value.slice(0, 80))}
                    placeholder="阅读后小问题"
                    className="rounded-[1.1rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-300"
                  />
                  <input
                    value={pictureBookTask}
                    onChange={(event) => setPictureBookTask(event.target.value.slice(0, 60))}
                    placeholder="打卡任务"
                    className="rounded-[1.1rem] border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-300"
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-violet-50 p-4">
                <p className="text-sm font-semibold text-violet-900">右侧：发布预览区</p>
                <div className="mt-3 rounded-[1.3rem] bg-white p-4 shadow-sm">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[1.2rem] bg-violet-100 text-5xl">📖</div>
                  <h4 className="mt-3 text-xl font-semibold text-slate-900">
                    {pictureBookTitle.trim() || "待发布绘本"}
                  </h4>
                  <p className="mt-2 text-xs font-semibold text-violet-700">
                    {pictureBookAgeGroup} · {pictureBookType}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {pictureBookText
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(" " ) || "AI生成后，这里会显示绘本预览。"}
                  </p>
                </div>
                <button
                  onClick={publishTeacherPictureBook}
                  className="mt-4 w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  type="button"
                >
                  确认并发布到儿童端/家长端
                </button>
                <p className="mt-3 text-sm font-semibold leading-6 text-violet-900">{pictureBookStatus}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {teacherPictureBooks.filter((book) => book.themeId === "habit").slice(0, 3).map((book) => (
                <article key={book.id} className="rounded-[1.2rem] bg-violet-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{book.title}</p>
                      <p className="mt-1 text-xs font-semibold text-violet-700">
                        幼习宝绘本 · {formatParentSyncTime(book.publishedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeTeacherPictureBook(book.id)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm"
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-white/88 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">教师发布小任务</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">幼儿小练习入口</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              用于临时习惯主题，例如“午睡整理”“排队等待”“轻声表达”。儿童端会提供语音或文字回应入口。
            </p>
            <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
              教师修改后确认发布
            </p>
            <input
              value={habitTemplateFocus}
              onChange={(event) => setHabitTemplateFocus(event.target.value.slice(0, 30))}
              placeholder="习惯主题，如 午睡整理 / 轻声表达"
              className="mt-4 w-full rounded-[1.1rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300"
            />
            <input
              value={habitTemplateChildPrompt}
              onChange={(event) => setHabitTemplateChildPrompt(event.target.value.slice(0, 100))}
              placeholder="幼儿提示语，如 我想对老师说：我今天排队等一等"
              className="mt-3 w-full rounded-[1.1rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-300"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={createHabitTemplate}
                className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                type="button"
              >
                确认并发布到儿童端
              </button>
              <p className="text-sm font-semibold text-emerald-900">{habitTemplateStatus}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {habitTemplates.slice(0, 3).map((template) => (
                <article key={template.id} className="rounded-[1.2rem] bg-emerald-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{template.title}</p>
                      <p className="mt-1 text-xs font-semibold text-emerald-800">
                        {template.childPrompt}
                      </p>
                    </div>
                    <button
                      onClick={() => removeHabitTemplate(template.id)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm"
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        hidden={activeTeacherPanel !== "teacher-settings"}
        className="order-5 rounded-[2.5rem] bg-[linear-gradient(135deg,#edf7ff_0%,#ffffff_52%,#f7fff2_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700">班级账号同步</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">换设备不换账号</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">上传或拉取同一教师账号下的花名册、游戏记录、食谱、家园同步和家长反馈。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void syncClassCloud("push")}
              disabled={isCloudSyncing}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
            >
              上传账号数据
            </button>
            <button
              onClick={() => void syncClassCloud("pull")}
              disabled={isCloudSyncing}
              className="rounded-full bg-cyan-100 px-5 py-3 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
            >
              拉取账号数据
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-[1.4rem] bg-white/86 px-4 py-3 text-sm font-semibold text-cyan-900 shadow-sm">
          {cloudSyncStatus}
        </p>
      </section>

      <section
        id="teacher-settings"
        hidden={activeTeacherPanel !== "teacher-settings"}
        className="order-6 scroll-mt-24 rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-600">基础设置</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">花名册、导入导出与本机账号</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">需要调整名单、绑定码或账号时再展开。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {childRoster.length} 位幼儿
            </span>
          </summary>

          <div className="mt-5 grid gap-3 sm:grid-cols-[0.8fr_1fr_0.7fr_auto]">
            <input
              value={newChildClassName}
              onChange={(event) => setNewChildClassName(event.target.value)}
              placeholder="班级，如 中一班"
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <input
              value={newChildName}
              onChange={(event) => setNewChildName(event.target.value)}
              placeholder="幼儿姓名"
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <input
              value={newChildNumber}
              onChange={(event) => setNewChildNumber(event.target.value)}
              placeholder="号数，如 3"
              inputMode="numeric"
              className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <button
              onClick={addChildToRoster}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              type="button"
            >
              添加
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={downloadRosterTemplate}
              className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-900 transition hover:-translate-y-0.5"
              type="button"
            >
              下载花名册模板
            </button>
            <label className="cursor-pointer rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5">
              上传导入花名册
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={importRosterFile}
                className="sr-only"
              />
            </label>
            <button
              onClick={resetTeacherAccountSetup}
              className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
              type="button"
            >
              重置本机教师账号
            </button>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
              {rosterStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {childRoster.length > 0 ? (
              childRoster.map((child) => (
                <article
                  key={child.id}
                  className="rounded-[1.4rem] bg-slate-50 px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {child.className ? `${child.className} · ` : ""}
                        {formatChildLabel(child)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        班级：{child.className || "未填写"} · 家长端需输入姓名/号数和家庭绑定码后才能查看。
                      </p>
                    </div>
                    <button
                      onClick={() => removeChildFromRoster(child.id)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm"
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                  <div className="mt-3 rounded-[1.1rem] bg-white px-3 py-3">
                    <p className="text-xs font-semibold text-slate-500">家庭绑定码</p>
                    <p className="mt-1 text-2xl font-semibold tracking-[0.18em] text-slate-950">
                      {child.familyBindingCode || "未生成"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => resetChildFamilyBindingCode(child.id)}
                      className="rounded-full bg-cyan-100 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:-translate-y-0.5"
                      type="button"
                    >
                      {child.familyBindingCode ? "重置家庭绑定码" : "生成家庭绑定码"}
                    </button>
                    <button
                      onClick={() => void copyFamilyBindingCode(child)}
                      className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:-translate-y-0.5"
                      type="button"
                    >
                      复制给家长
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
                还没有名单。添加后，儿童端会通过名字或号数匹配小名牌。
              </p>
            )}
          </div>
        </details>
      </section>

      <section
        id="teacher-data-export"
        hidden={activeTeacherPanel !== "teacher-data-export"}
        className="order-7 scroll-mt-24 rounded-[2.5rem] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#fff8e5_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-600">数据导出</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">导出班级数据汇总</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              导出数据仅用于教师教研、班级跟进和家园沟通，请妥善保管。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => exportTeacherDataSummary("xls")}
              className="rounded-full bg-emerald-100 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:-translate-y-0.5"
              type="button"
            >
              导出 Excel（.xls）
            </button>
            <button
              onClick={() => exportTeacherDataSummary("csv")}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              type="button"
            >
              导出 CSV
            </button>
            <button
              onClick={() => exportTeacherDataSummary("json")}
              className="rounded-full bg-amber-100 px-5 py-3 text-sm font-semibold text-amber-900 transition hover:-translate-y-0.5"
              type="button"
            >
              导出 JSON
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          当前导出为 Excel 可打开的 .xls 兼容格式；JSON/CSV 供教研备份和数据核对使用。
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "幼儿人数", value: childRoster.length },
            { label: "今日互动人数", value: classOverview.participatedCount },
            { label: "今日习惯打卡次数", value: classOverview.habitCheckinCount },
            { label: "今日阅读打卡次数", value: classOverview.readingCheckinCount },
            { label: "今日食物观察次数", value: classOverview.foodObservationCount },
            { label: "今日家长反馈次数", value: classOverview.parentFeedbackTodayCount },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.4rem] bg-white/86 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-white/84 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">导出内容</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              "班级概览",
              "幼儿个人汇总",
              "习惯任务数据",
              "阅读打卡数据",
              "闽食观察数据",
              "幼儿对老师说数据",
              "家长反馈数据",
              "AI分析建议",
              "教师确认内容",
            ].map((item) => (
              <span
                key={item}
                className="rounded-[1rem] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

        </div>
        <aside className="order-first lg:order-last lg:sticky lg:top-6 lg:w-[300px]">
          <SectionDirectory
            eyebrow="教师端目录"
            title="快速查看工作区"
            items={teacherDirectoryItems}
            variant="sidebar"
            activeHref={activeTeacherPanel === "home" ? "#teacher-ai-summary" : `#${activeTeacherPanel}`}
            onItemClick={openTeacherDirectoryItem}
          />
        </aside>
      </div>
    </div>
  );
}
