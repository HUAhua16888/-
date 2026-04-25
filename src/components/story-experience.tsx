"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { AmbientMusicToggle } from "@/components/ambient-music-toggle";
import {
  countUniqueBadges,
  createEmptyGrowthArchive,
  getMiniGameCompletionTotal,
  growthArchiveStorageKey,
  parseGrowthArchive,
  recordBadge,
  recordMealReview,
  recordMiniGameCompletion,
  recordThemeVisit,
  type GrowthArchive,
  type MiniGameKey,
} from "@/lib/growth-archive";
import { fetchPremiumSpeechAudio } from "@/lib/voice-client";
import { defaultPremiumVoiceLabel } from "@/lib/voice";
import {
  adventureFeaturePills,
  foodBadgeCards,
  habitSkillCards,
  kindPhrases,
  mealTrayOptions,
  mealPhotoChecklist,
  queueOrder,
  rewardStickerCards,
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

type MealPhotoReviewResponse = {
  ok?: boolean;
  mode?: "demo" | "ai";
  message?: string;
  filename?: string;
  sizeKb?: number;
  summary?: string;
  plateState?: string;
  confidenceLabel?: string;
  highlightTags?: string[];
  scoreCards?: Array<{
    label: string;
    value: number;
  }>;
  guessedFoods?: string[];
  stickers?: string[];
  nextMission?: string;
  tips?: string[];
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  fallbackUsed?: boolean;
  warning?: string;
  warningCode?: "vision_provider_failed" | "vision_response_invalid";
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
const storyInputMaxLength = 120;
const supportedMealPhotoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const supportedMealPhotoExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const maxMealPhotoSizeBytes = 8 * 1024 * 1024;

function canAwardMealReviewBadge(review: MealPhotoReviewResponse) {
  if (review.fallbackUsed || review.mode !== "ai") {
    return false;
  }

  return !/结构化分析中|不确定|低把握|仅供参考|示例|基础分析/.test(
    review.confidenceLabel ?? "",
  );
}

function buildMealPhotoEncouragement(review: MealPhotoReviewResponse) {
  const firstFood = review.guessedFoods?.[0];

  if (firstFood) {
    return `可以对孩子说：“你愿意观察${firstFood}，已经是很棒的尝试啦。”`;
  }

  if (review.plateState) {
    return `可以对孩子说：“你把餐盘观察得很认真，${review.plateState}也被记录下来啦。”`;
  }

  return "可以对孩子说：“谢谢你愿意一起看一看、说一说，尝试本身就很勇敢。”";
}

function HabitVisualBoard() {
  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-700">成长图卡</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">习惯能力星图</h3>
        </div>
        <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          8 个习惯主题
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {habitSkillCards.map((item) => (
          <article
            key={item.title}
            className="story-card rounded-[1.7rem] bg-[linear-gradient(180deg,#fffdf7_0%,#f5fffe_100%)] p-4 shadow-sm"
          >
            <div
              className={`inline-flex h-12 w-12 items-center justify-center rounded-[1.1rem] text-2xl ${item.tone}`}
            >
              {item.icon}
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.hint}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function HabitMissionPoster({ badges, missions }: { badges: string[]; missions: string[] }) {
  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#dff8f7_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <p className="text-sm font-semibold text-teal-700">今日任务海报</p>
      <h3 className="mt-1 text-2xl font-semibold text-slate-900">今日习惯闯关</h3>
      <div className="mt-5 rounded-[2rem] bg-white/80 p-5">
        <div className="flex flex-wrap gap-3">
          {missions.map((mission, index) => (
            <div
              key={mission}
              className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              {index + 1}. {mission}
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.6rem] bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">上课图示</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              先坐好，再看老师，再举小手，最后认真听任务。
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-800">喝水打卡</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              一口一口慢慢喝，喝完记得放回小水杯。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(badges.length > 0 ? badges : ["坐姿闪亮章", "礼貌微笑章", "阅读小书虫"]).map((badge) => (
          <span
            key={badge}
            className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  );
}

function RewardStickerShelf({ badges }: { badges: string[] }) {
  const stickerPool =
    badges.length > 0
      ? badges.map((badge, index) => ({
          ...rewardStickerCards[index % rewardStickerCards.length],
          title: badge,
        }))
      : rewardStickerCards;

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-rose-700">奖励贴纸墙</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">孩子最爱看的成果区</h3>
        </div>
        <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
          随玩随点亮
        </div>
      </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stickerPool.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="story-card rounded-[1.7rem] bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] p-4 shadow-sm"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-[1rem] text-2xl ${item.tone}`}
              >
                {item.icon}
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">完成一个小任务，就能把它点亮。</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

function FoodBadgeWall() {
  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-rose-700">闽食小勋章</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">闽食探索勋章墙</h3>
        </div>
        <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800">
          家园共育可一起完成
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {foodBadgeCards.map((item) => (
          <article
            key={item.title}
            className="story-card rounded-[1.8rem] bg-[linear-gradient(180deg,#fff9ec_0%,#ffffff_100%)] p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-amber-100 text-3xl">
                {item.icon}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">{item.title}</h4>
                <p className="mt-1 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MealPhotoBooth({
  onReviewLogged,
}: {
  onReviewLogged?: (review: MealPhotoReviewResponse, fileName: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [reviewStatus, setReviewStatus] = useState("上传一张餐盘照片，看看光盘和闽食识别结果。");
  const [reviewTips, setReviewTips] = useState<string[]>(mealPhotoChecklist);
  const [reviewResult, setReviewResult] = useState<MealPhotoReviewResponse | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canAwardReviewSticker = reviewResult ? canAwardMealReviewBadge(reviewResult) : false;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function resetSelectedPhoto(status: string) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    setPreviewUrl("");
    setFileName("");
    setReviewStatus(status);
    setReviewResult(null);
    setReviewTips(mealPhotoChecklist);
  }

  function getPhotoValidationMessage(file: File) {
    const normalizedName = file.name.toLowerCase();
    const typeSupported = file.type ? supportedMealPhotoTypes.has(file.type) : false;
    const extensionSupported = supportedMealPhotoExtensions.some((extension) =>
      normalizedName.endsWith(extension),
    );

    if (!typeSupported && !extensionSupported) {
      return "当前支持 JPG、PNG、WebP 或 HEIC 图片，请重新选择照片。";
    }

    if (file.size > maxMealPhotoSizeBytes) {
      return "这张照片超过 8MB，请先压缩或换一张更小的照片。";
    }

    return "";
  }

  function handleSelectPhoto(file: File | null) {
    if (!file) {
      return;
    }

    const validationMessage = getPhotoValidationMessage(file);
    if (validationMessage) {
      resetSelectedPhoto(validationMessage);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    setFileName(file.name);
    setReviewStatus("照片已选好，可以点按钮上传检查。");
    setReviewResult(null);
  }

  async function reviewPhoto() {
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setReviewStatus("先选一张孩子餐盘或闽食作品照片。");
      return;
    }

    const validationMessage = getPhotoValidationMessage(file);
    if (validationMessage) {
      resetSelectedPhoto(validationMessage);
      return;
    }

    setIsReviewing(true);
    setReviewStatus("正在上传照片并检查拍图任务...");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/meal-photo-review", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as MealPhotoReviewResponse;

      if (!response.ok) {
        throw new Error(data.error || "照片检查暂时失败了");
      }

      setReviewResult(data);
      setReviewStatus(
        `${data.message ?? "照片上传成功。"}${data.sizeKb ? ` 当前文件约 ${data.sizeKb}KB。` : ""}`,
      );
      setReviewTips(data.tips && data.tips.length > 0 ? data.tips : mealPhotoChecklist);

      if (data.ok && !data.fallbackUsed) {
        onReviewLogged?.(data, file.name);
      }
    } catch (error) {
      setReviewStatus(error instanceof Error ? error.message : "照片检查暂时失败了");
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#e6fbfa_0%,#ffffff_50%,#fff7dc_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-cyan-700">闽食光盘打卡</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">拍图上传台</h3>
        </div>
        <div className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800">
          支持手机直接拍照
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.8rem] bg-white/80 p-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="餐盘上传预览"
              className="h-64 w-full rounded-[1.4rem] object-cover"
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-cyan-200 bg-white/70 text-center">
              <div className="text-4xl">🍱</div>
              <p className="mt-3 text-lg font-semibold text-slate-700">拍一张餐盘照片</p>
              <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                适合记录孩子光盘、闽食制作或闽食宣传打卡。
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">
              选择照片
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => handleSelectPhoto(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={() => void reviewPhoto()}
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              disabled={isReviewing || !fileName}
            >
              {isReviewing ? "检查中..." : "上传看看"}
            </button>
          </div>
          {fileName ? (
            <p className="mt-3 text-sm font-semibold text-slate-600">当前照片：{fileName}</p>
          ) : null}
          <p className="mt-3 text-xs leading-6 font-semibold text-slate-500">
            支持 JPG、PNG、WebP、HEIC，单张不超过 8MB。请只上传餐盘或闽食作品照片。
          </p>
          <p className="mt-2 text-xs leading-6 font-semibold text-amber-800">
            拍照时尽量避开孩子正脸、姓名牌和班级牌，只记录餐盘或作品。
          </p>
        </div>

        <div className="rounded-[1.8rem] bg-white/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">当前状态</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                reviewResult?.mode === "ai"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {reviewResult?.fallbackUsed
                ? "基础分析卡"
                : reviewResult?.mode === "ai"
                  ? "AI 识图结果"
                  : "示例分析卡"}
            </span>
          </div>
          <p aria-live="polite" className="mt-3 text-base leading-8 font-semibold text-slate-900">
            {reviewStatus}
          </p>

          {reviewResult?.fallbackUsed ? (
            <div className="mt-5 rounded-[1.5rem] bg-amber-50 px-4 py-4">
              <p className="text-sm font-semibold text-amber-900">当前使用基础分析</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {reviewResult.warning ?? "AI 视觉分析暂时不可用，当前先返回基础分析卡。"}
              </p>
              <p className="mt-2 text-xs leading-6 font-semibold text-amber-900">
                这次结果仅供参考，不会写入孩子成长记录册。
              </p>
            </div>
          ) : null}

          {reviewResult?.summary ? (
            <div className="mt-5 rounded-[1.5rem] bg-cyan-50 px-4 py-4">
              <p className="text-sm font-semibold text-cyan-800">分析结论</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{reviewResult.summary}</p>
            </div>
          ) : null}

          {reviewResult?.plateState || reviewResult?.confidenceLabel ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">餐盘状态</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {reviewResult?.plateState ?? "等待分析"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">识图把握</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {reviewResult?.confidenceLabel ?? "等待分析"}
                </p>
              </div>
            </div>
          ) : null}

          {reviewResult?.highlightTags && reviewResult.highlightTags.length > 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">照片亮点</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewResult.highlightTags.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-cyan-100 px-3 py-2 text-sm font-semibold text-cyan-900"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {reviewResult?.scoreCards && reviewResult.scoreCards.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {reviewResult.scoreCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-center shadow-sm"
                >
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {reviewResult?.guessedFoods && reviewResult.guessedFoods.length > 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">识别候选</p>
                {reviewResult.mode === "demo" ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    示例候选
                  </span>
                ) : null}
              </div>
              {reviewResult.mode === "demo" ? (
                <p className="mt-2 text-xs leading-6 font-semibold text-slate-500">
                  当前是基础分析示例，不代表真实识别结果。
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewResult.guessedFoods.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {reviewResult?.stickers && reviewResult.stickers.length > 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">
                  {canAwardReviewSticker ? "点亮勋章" : "观察贴纸"}
                </p>
                {!canAwardReviewSticker ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                    暂不点亮
                  </span>
                ) : null}
              </div>
              {!canAwardReviewSticker ? (
                <p className="mt-2 text-xs leading-6 font-semibold text-slate-500">
                  这次只记录观察，不写入勋章。
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewResult.stickers.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {reviewResult?.nextMission ? (
            <div className="mt-5 rounded-[1.5rem] bg-slate-900 px-4 py-4 text-white">
              <p className="text-sm font-semibold text-white/70">下一步挑战</p>
              <p className="mt-2 text-sm leading-7 text-white/90">{reviewResult.nextMission}</p>
            </div>
          ) : null}

          {reviewResult ? (
            <div className="mt-5 rounded-[1.5rem] bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-800">下一句鼓励话术</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {buildMealPhotoEncouragement(reviewResult)}
              </p>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {reviewTips.map((tip) => (
              <div
                key={tip}
                className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
              >
                {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShuffleStepsGame({ onComplete }: { onComplete?: () => void }) {
  const [shuffled, setShuffled] = useState(initialWashOrder);
  const [selected, setSelected] = useState<string[]>([]);
  const completionReportedRef = useRef(false);
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
    completionReportedRef.current = false;
  }

  const isCorrect = completed && selected.every((step, index) => step === washSteps[index]);

  useEffect(() => {
    if (completed && isCorrect && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [completed, isCorrect, onComplete]);

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

function QueueGame({ onComplete }: { onComplete?: () => void }) {
  const [currentOrder, setCurrentOrder] = useState(initialQueueOrder);
  const completionReportedRef = useRef(false);
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

  function resetGame() {
    setCurrentOrder(initialQueueOrder);
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (correct && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [correct, onComplete]);

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cyan-700">小游戏 2</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">排队不拥挤</h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-200"
        >
          重新开始
        </button>
      </div>
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

function KindWordsGame({ onComplete }: { onComplete?: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const completionReportedRef = useRef(false);

  function handlePick(index: number, positive: boolean) {
    if (picked.includes(index)) {
      return;
    }

    setPicked((current) => [...current, index]);
    if (positive) {
      setScore((current) => current + 1);
    }
  }

  function resetGame() {
    setPicked([]);
    setScore(0);
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (picked.length === kindPhrases.length && score >= 2 && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [onComplete, picked.length, score]);

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-rose-700">小游戏 3</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">勇敢尝一口</h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-200"
        >
          重新开始
        </button>
      </div>
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

function MealTrayGame({ onComplete }: { onComplete?: () => void }) {
  const [pickedItems, setPickedItems] = useState<string[]>([]);
  const completionReportedRef = useRef(false);
  const pickedCount = pickedItems.length;
  const completed = pickedCount === 3;
  const healthyCount = pickedItems.filter((item) =>
    mealTrayOptions.find((option) => option.label === item)?.isHealthy,
  ).length;

  function handlePick(item: string) {
    if (pickedItems.includes(item) || completed) {
      return;
    }

    setPickedItems((current) => [...current, item]);
  }

  function resetGame() {
    setPickedItems([]);
    completionReportedRef.current = false;
  }

  useEffect(() => {
    if (completed && healthyCount >= 2 && !completionReportedRef.current) {
      completionReportedRef.current = true;
      onComplete?.();
    }
  }, [completed, healthyCount, onComplete]);

  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-700">小游戏 4</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">午餐小餐盘</h3>
        </div>
        <button
          onClick={resetGame}
          className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-200"
        >
          重新搭配
        </button>
      </div>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        从下面选 3 样食物，帮小朋友搭一个更勇敢、更均衡的小餐盘。
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {mealTrayOptions.map((item) => (
          <button
            key={item.label}
            onClick={() => handlePick(item.label)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              pickedItems.includes(item.label)
                ? item.isHealthy
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-700"
                : "bg-orange-50 text-slate-700 hover:-translate-y-0.5 hover:bg-orange-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700">你选的餐盘</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pickedCount === 0 ? (
            <span className="text-sm text-slate-400">还没有选食物，点上面的食物按钮。</span>
          ) : (
            pickedItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {item}
              </span>
            ))
          )}
        </div>
      </div>

      {completed ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            healthyCount >= 2 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {healthyCount >= 2
            ? "搭配得很棒，这是一份很适合鼓励孩子尝试的小餐盘。"
            : "这份餐盘还可以更均衡一点，换一换会更好。"}
        </p>
      ) : null}
    </div>
  );
}

function buildGrowthArchiveSummary(archive: GrowthArchive) {
  const uniqueBadgeCount = countUniqueBadges(archive);
  const totalMiniGames = getMiniGameCompletionTotal(archive);
  const latestBadges = archive.badgeRecords.slice(0, 3).map((item) => item.name);
  const latestReview = archive.mealReviews[0];
  const totalThemeVisits = archive.themeVisits.food + archive.themeVisits.habit;
  const strongerTheme =
    archive.themeVisits.food > archive.themeVisits.habit ? "闽食成长岛" : "习惯成长岛";
  const nextFocus =
    totalMiniGames < 2
      ? "下次可以优先完成 1 个小游戏，把故事体验转成可见的小任务。"
      : uniqueBadgeCount < 3
        ? "下次可以继续点亮新勋章，帮助孩子看到自己的进步。"
        : "下次可以让孩子自己复述今天学到的一句话，强化表达和记忆。";

  return [
    "童趣成长乐园成长小结",
    latestBadges.length > 0 ? `孩子刚刚点亮了${latestBadges[0]}，值得被看见和鼓励。` : "孩子正在开始自己的成长任务，可以先从一个小尝试被看见。",
    `本次记录中，孩子已点亮 ${uniqueBadgeCount} 枚不同勋章，完成 ${totalMiniGames} 次小游戏。`,
    totalThemeVisits > 0
      ? `孩子更常进入的是${strongerTheme}，可以围绕这个兴趣继续延伸。`
      : "孩子还在探索两个成长岛，可以先观察他更喜欢习惯任务还是闽食任务。",
    latestBadges.length > 0 ? `最近点亮：${latestBadges.join("、")}。` : "最近还没有点亮勋章，可以先从一个简单任务开始。",
    latestReview
      ? `最近拍图打卡：${latestReview.plateState}，${latestReview.summary}`
      : "暂时还没有拍图打卡记录，后续可以补一张餐盘或闽食作品照片。",
    `下一步建议：${nextFocus}`,
    `回家延伸：${buildHomeExtensionPrompt(archive)}`,
  ].join("\n");
}

function buildHomeExtensionPrompt(archive: GrowthArchive) {
  const latestBadge = archive.badgeRecords[0]?.name;
  const latestReview = archive.mealReviews[0];

  if (latestReview) {
    return `可以问孩子：“今天这张餐盘里，你最愿意再尝试哪一种食物？”`;
  }

  if (latestBadge) {
    return `可以问孩子：“你今天拿到${latestBadge}时，做了哪件勇敢的小事？”`;
  }

  return "可以问孩子：“今天你最想把哪个好习惯带回家试一试？”";
}

function buildGrowthArchiveExportJson(archive: GrowthArchive) {
  const summaryText = buildGrowthArchiveSummary(archive);

  return JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: "tongqu-growth-web",
      summaryText,
      archive,
    },
    null,
    2,
  );
}

function GrowthArchivePanel({
  archive,
  onClear,
}: {
  archive: GrowthArchive;
  onClear: () => void;
}) {
  const uniqueBadgeCount = countUniqueBadges(archive);
  const totalMiniGames = getMiniGameCompletionTotal(archive);
  const latestBadges = archive.badgeRecords.slice(0, 4);
  const latestReviews = archive.mealReviews.slice(0, 2);
  const archiveSummary = buildGrowthArchiveSummary(archive);
  const archiveExportJson = buildGrowthArchiveExportJson(archive);
  const homeExtensionPrompt = buildHomeExtensionPrompt(archive);
  const latestMiniGameBadge = archive.badgeRecords.find((item) => item.source === "mini-game");
  const nextFocus =
    totalMiniGames < 2
      ? "先完成一个小游戏"
      : uniqueBadgeCount < 3
        ? "继续点亮新勋章"
        : "鼓励孩子复述收获";
  const [copySummaryStatus, setCopySummaryStatus] = useState("");
  const [archiveActionStatus, setArchiveActionStatus] = useState("");
  const [clearConfirming, setClearConfirming] = useState(false);

  async function copyArchiveSummary() {
    try {
      await navigator.clipboard.writeText(archiveSummary);
      setCopySummaryStatus("成长小结已复制，可以直接发给家长或贴进观察记录。");
    } catch {
      setCopySummaryStatus("复制失败，可以手动选中下方小结内容。");
    }
  }

  async function copyFullArchive() {
    setClearConfirming(false);

    try {
      await navigator.clipboard.writeText(archiveExportJson);
      setArchiveActionStatus("完整成长档案 JSON 已复制，可以粘贴到本地文档留存。");
    } catch {
      setArchiveActionStatus("复制完整档案失败，可以改用导出 JSON 文件。");
    }
  }

  function exportArchiveJson() {
    setClearConfirming(false);

    if (typeof document === "undefined") {
      return;
    }

    const blob = new Blob([archiveExportJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const exportDate = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `tongqu-growth-archive-${exportDate}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setArchiveActionStatus("成长档案 JSON 已导出，可用于本机备份或转交给老师。");
  }

  function confirmClearArchive() {
    if (!clearConfirming) {
      setClearConfirming(true);
      setArchiveActionStatus("再次点击“确认清空”会删除这台设备上的成长记录。");
      return;
    }

    setClearConfirming(false);
    setArchiveActionStatus("");
    onClear();
  }

  return (
    <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_55%,#e6fbfa_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-700">成长记录册</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">孩子下次再来，也能接着成长</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void copyFullArchive()}
            className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
          >
            复制完整档案
          </button>
          <button
            onClick={exportArchiveJson}
            className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            导出 JSON
          </button>
          <button
            onClick={confirmClearArchive}
            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${
              clearConfirming ? "bg-amber-100 text-amber-900" : "bg-white/85 text-slate-700"
            }`}
          >
            {clearConfirming ? "确认清空" : "清空记录册"}
          </button>
        </div>
      </div>
      {archiveActionStatus ? (
        <p className="mt-4 rounded-2xl bg-teal-100 px-4 py-3 text-sm font-semibold text-teal-800">
          {archiveActionStatus}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">点亮勋章</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{uniqueBadgeCount}</p>
        </div>
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">小游戏完成</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalMiniGames}</p>
          {latestMiniGameBadge ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              最近：{latestMiniGameBadge.name}
            </p>
          ) : null}
        </div>
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">习惯岛进入</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{archive.themeVisits.habit}</p>
        </div>
        <div className="rounded-[1.6rem] bg-white/85 p-4 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">闽食岛进入</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{archive.themeVisits.food}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[1.8rem] bg-white/82 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">最近点亮的勋章</p>
          <div className="mt-4 space-y-3">
            {latestBadges.length > 0 ? (
              latestBadges.map((item) => (
                <div
                  key={`${item.name}-${item.earnedAt}`}
                  className="rounded-[1.3rem] bg-slate-50 px-4 py-3"
                >
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.themeId === "habit" ? "习惯成长岛" : "闽食成长岛"} ·{" "}
                    {item.source === "story"
                      ? "故事解锁"
                      : item.source === "meal-review"
                        ? "拍图打卡"
                        : "小游戏完成"}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                还没有历史记录，先聊一轮故事或完成一个小游戏吧。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[1.8rem] bg-white/82 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">最近拍图打卡</p>
          <div className="mt-4 space-y-3">
            {latestReviews.length > 0 ? (
              latestReviews.map((item) => (
                <div
                  key={`${item.reviewedAt}-${item.imageName}`}
                  className="rounded-[1.3rem] bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.plateState}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.mode === "ai"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.mode === "ai" ? "AI 分析" : "结构化分析"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.summary}</p>
                  {item.guessedFoods.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.guessedFoods.map((food) => (
                        <span
                          key={food}
                          className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900"
                        >
                          {food}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-[1.3rem] bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
                还没有拍图记录，等你上传第一张餐盘照片后，这里会自动保存。
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.8rem] bg-white/85 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-700">家园共育小结</p>
              <h4 className="mt-1 text-xl font-semibold text-slate-900">一键带走本次成长反馈</h4>
            </div>
            <button
              onClick={() => void copyArchiveSummary()}
              className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              复制成长小结
            </button>
          </div>
          <div className="mt-4 whitespace-pre-line rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
            {archiveSummary}
          </div>
          {copySummaryStatus ? (
            <p className="mt-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
              {copySummaryStatus}
            </p>
          ) : null}
        </div>

        <div className="rounded-[1.8rem] bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm font-semibold text-white/70">下次推荐</p>
          <h4 className="mt-2 text-2xl font-semibold">{nextFocus}</h4>
          <p className="mt-4 text-sm leading-7 text-white/85">
            记录册会保存在这台设备上。老师或家长可以先看这里的建议，再决定下一轮进入故事、小游戏，还是拍图打卡。
          </p>
          <div className="mt-5 rounded-[1.4rem] bg-white/10 px-4 py-4">
            <p className="text-sm font-semibold text-white/70">回家延伸一句话</p>
            <p className="mt-2 text-sm leading-7 text-white/90">{homeExtensionPrompt}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StoryExperience() {
  const imageFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_IMAGE_GENERATION === "true";
  const premiumTtsEnabled = process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TTS === "true";
  const premiumVoiceLabel = process.env.NEXT_PUBLIC_TTS_VOICE_LABEL ?? defaultPremiumVoiceLabel;
  const growthArchiveHydratedRef = useRef(false);
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
  const [lastImagePrompt, setLastImagePrompt] = useState("");
  const [status, setStatus] = useState("准备出发啦。");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [usePremiumVoice, setUsePremiumVoice] = useState(premiumTtsEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [latestBadgeFeedback, setLatestBadgeFeedback] = useState("");
  const [latestGrowthFeedbackSource, setLatestGrowthFeedbackSource] = useState<
    "story" | "mini-game" | "meal-review" | ""
  >("");
  const [growthArchive, setGrowthArchive] = useState<GrowthArchive>(createEmptyGrowthArchive());
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);

  const activeTheme = themes[themeId];
  const activeMissions = storyMissionMap[themeId];
  const unlockedChapterCount = Math.max(
    1,
    messages.filter((message) => message.role === "assistant").length,
  );
  const lastAssistantMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant")?.content ?? "",
    [messages],
  );
  const storyInputRemaining = storyInputMaxLength - input.length;
  const completedMiniGameCount = getMiniGameCompletionTotal(growthArchive);
  const teacherExtensionHref = `/teachers?theme=${themeId}&from=mini-game`;

  function cleanupAudioPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  function stopSpeaking() {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    cleanupAudioPlayback();

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  }

  async function playPremiumSpeech(text: string) {
    const controller = new AbortController();
    speechAbortRef.current = controller;
    const blob = await fetchPremiumSpeechAudio(text, "child");

    if (controller.signal.aborted) {
      return;
    }

    cleanupAudioPlayback();
    const nextUrl = URL.createObjectURL(blob);
    const audio = new Audio(nextUrl);

    audioUrlRef.current = nextUrl;
    audioRef.current = audio;

    audio.onended = () => {
      speechAbortRef.current = null;
      cleanupAudioPlayback();
      setIsSpeaking(false);
    };

    audio.onerror = () => {
      speechAbortRef.current = null;
      cleanupAudioPlayback();
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    await audio.play();
  }

  function playBrowserSpeech(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function startSpeechPlayback(text: string) {
    if (!text) {
      return;
    }

    stopSpeaking();

    if (usePremiumVoice && premiumTtsEnabled) {
      try {
        setStatus(`正在用 ${premiumVoiceLabel} 播报故事...`);
        await playPremiumSpeech(text);
        return;
      } catch (error) {
        const message =
          error instanceof Error && error.message ? error.message : "高质量播报暂时没接通，当前先用浏览器播报。";
        setStatus(message);
      }
    }

    playBrowserSpeech(text);
  }

  const playAutoReply = useEffectEvent(async (text: string) => {
    await startSpeechPlayback(text);
  });

  useEffect(() => {
    if (!lastAssistantMessage || !autoSpeak) {
      return;
    }

    const playbackHandle = window.setTimeout(() => {
      void playAutoReply(lastAssistantMessage);
    }, 0);

    return () => window.clearTimeout(playbackHandle);
  }, [autoSpeak, lastAssistantMessage]);

  useEffect(() => {
    return () => {
      speechAbortRef.current?.abort();
      cleanupAudioPlayback();

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const restoreHandle = window.setTimeout(() => {
      const savedArchive = window.localStorage.getItem(growthArchiveStorageKey);
      setGrowthArchive(parseGrowthArchive(savedArchive));
      growthArchiveHydratedRef.current = true;
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !growthArchiveHydratedRef.current) {
      return;
    }

    window.localStorage.setItem(growthArchiveStorageKey, JSON.stringify(growthArchive));
  }, [growthArchive]);

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
        lastImagePrompt?: string;
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

        if (typeof parsed.lastImagePrompt === "string") {
          setLastImagePrompt(parsed.lastImagePrompt);
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
      lastImagePrompt,
      status,
      badges,
    };

    window.localStorage.setItem(storyStateStorageKey, JSON.stringify(payload));
  }, [badges, imageUrl, lastImagePrompt, messages, quickChoices, status, themeId]);

  function updateGrowthArchive(updater: (current: GrowthArchive) => GrowthArchive) {
    setGrowthArchive((current) => updater(current));
  }

  function logThemeVisit(nextTheme: ThemeId) {
    updateGrowthArchive((current) => recordThemeVisit(current, nextTheme));
  }

  function logBadgeRecords(nextBadges: string[], source: "story" | "meal-review" | "mini-game") {
    if (nextBadges.length === 0) {
      return;
    }

    updateGrowthArchive((current) =>
      nextBadges.reduce(
        (draft, badge) => recordBadge(draft, badge, themeId, source),
        current,
      ),
    );
  }

  function logMiniGameCompletion(gameKey: MiniGameKey, badgeName: string) {
    updateGrowthArchive((current) => {
      const withGame = recordMiniGameCompletion(current, gameKey);
      return recordBadge(withGame, badgeName, themeId, "mini-game");
    });
    setBadges((current) => (current.includes(badgeName) ? current : [...current, badgeName]));
    setLatestBadgeFeedback(`刚刚点亮：${badgeName}`);
    setLatestGrowthFeedbackSource("mini-game");
    setStatus(`完成啦，点亮了${badgeName}。`);
  }

  function handleMealReviewLogged(review: MealPhotoReviewResponse, imageName: string) {
    if (review.fallbackUsed) {
      return;
    }

    const nextStickers = review.stickers && review.stickers.length > 0 ? review.stickers : ["闽食观察员"];
    const shouldAwardBadges = canAwardMealReviewBadge(review);
    const recordedStickers = shouldAwardBadges ? nextStickers : [];

    updateGrowthArchive((current) => {
      const withReview = recordMealReview(current, {
        reviewedAt: new Date().toISOString(),
        mode: review.mode ?? "demo",
        summary: review.summary ?? "餐盘照片已完成一次分析。",
        guessedFoods: review.guessedFoods ?? [],
        stickers: recordedStickers,
        plateState: review.plateState ?? "等待分析",
        imageName,
      });

      if (!shouldAwardBadges) {
        return withReview;
      }

      return nextStickers.reduce((draft, sticker) => recordBadge(draft, sticker, "food", "meal-review"), withReview);
    });

    const firstSticker = nextStickers[0];

    if (shouldAwardBadges) {
      setBadges((current) =>
        nextStickers.reduce(
          (draft, sticker) => (draft.includes(sticker) ? draft : [...draft, sticker]),
          current,
        ),
      );
      setLatestBadgeFeedback(`刚刚完成拍图打卡：${firstSticker}`);
      setStatus(`拍图打卡完成啦，点亮了${firstSticker}。`);
    } else {
      setLatestBadgeFeedback("拍图观察已记录，暂不点亮勋章。");
      setStatus("拍图观察已记录，这次先不点亮勋章。");
    }

    setLatestGrowthFeedbackSource("meal-review");
  }

  function clearGrowthArchive() {
    setGrowthArchive(createEmptyGrowthArchive());

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(growthArchiveStorageKey);
    }

    setStatus("成长记录册已经清空了，新的成长记录会从现在重新开始。");
  }

  function switchTheme(nextTheme: ThemeId) {
    stopSpeaking();
    setThemeId(nextTheme);
    setMessages([
      {
        role: "assistant",
        content: themes[nextTheme].starter,
      },
    ]);
    setQuickChoices(themes[nextTheme].choices);
    setInput("");
    setImageUrl("");
    setLastImagePrompt("");
    setStatus(`${themes[nextTheme].label}准备好了。`);
    logThemeVisit(nextTheme);
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
    setLastImagePrompt("");
    setStatus("准备出发啦。");
    setBadges([]);
    setLatestBadgeFeedback("");
    setLatestGrowthFeedbackSource("");
    stopSpeaking();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storyStateStorageKey);
    }
  }

  async function sendMessage(messageText: string) {
    const cleanText = messageText.trim();

    if (!cleanText || isLoading) {
      return;
    }

    if (cleanText.length > storyInputMaxLength) {
      setStatus(`故事请求太长啦，请控制在 ${storyInputMaxLength} 个字以内。`);
      return;
    }

    setMessages((current) => [...current, { role: "user", content: cleanText }]);
    setInput("");
    setIsLoading(true);
    setStatus("故事伙伴正在想下一段...");

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

      if (data.badge && !badges.includes(data.badge)) {
        logBadgeRecords([data.badge], "story");
        setLatestBadgeFeedback(`刚刚点亮：${data.badge}`);
        setLatestGrowthFeedbackSource("story");
      }

      setStatus(
        data.error
          ? `故事已经接上啦，不过还有一点小提醒：${data.error}`
          : data.badge && !badges.includes(data.badge)
            ? `太棒啦，点亮了${data.badge}。`
            : "新的故事节点已经解锁。",
      );
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

    const prompt = `${activeTheme.imagePrompt} 当前剧情：${lastAssistantMessage || activeTheme.starter}`;

    if (imageUrl && lastImagePrompt === prompt) {
      setStatus("这一章的插图已经画好了，不用重复等待啦。");
      return;
    }

    setIsPainting(true);
    setStatus("正在画本章插图，漂亮的画面会多等一小会儿...");

    try {
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
      setLastImagePrompt(prompt);
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

    stopSpeaking();

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
                {activeTheme.subtitle} 这一版已经支持 AI 对话、浏览器语音输入、语音播报和 4 个轻量小游戏。
                {imageFeatureEnabled ? " 图片生成功能已开启。" : " 为了保证对外稳定体验，图片生成功能当前先关闭。"}
                {premiumTtsEnabled ? ` 当前默认幼儿播报音色是 ${premiumVoiceLabel}。` : ""}
              </p>
            </div>

            <div className="w-full max-w-xs rounded-[2rem] bg-white/85 p-5 shadow-[0_16px_50px_rgba(43,104,98,0.12)]">
              <p className="text-sm font-semibold text-slate-500">今日成长状态</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">{status}</p>
              {latestBadgeFeedback ? (
                <p className="mt-3 rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {latestBadgeFeedback}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-500">当前主题</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{activeTheme.label}</p>
                </div>
                <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-500">解锁章节</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{unlockedChapterCount}</p>
                </div>
                <div className="rounded-[1.2rem] bg-slate-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-500">勋章数量</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{badges.length}</p>
                </div>
              </div>
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
                      {latestBadgeFeedback.includes(badge) ? " · 最新点亮" : ""}
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
                    暂不画图
                  </span>
                )}
                <button
                  onClick={() => {
                    setAutoSpeak((current) => {
                      const next = !current;
                      if (!next) {
                        stopSpeaking();
                      }

                      return next;
                    });
                  }}
                  className="rounded-full bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:-translate-y-0.5"
                >
                  {autoSpeak ? "关闭播报" : "开启播报"}
                </button>
                {premiumTtsEnabled ? (
                  <button
                    onClick={() => {
                      stopSpeaking();
                      setUsePremiumVoice((current) => !current);
                    }}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      usePremiumVoice
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {usePremiumVoice ? `${premiumVoiceLabel} 已启用` : "切回浏览器播报"}
                  </button>
                ) : null}
                <button
                  onClick={() => void startSpeechPlayback(lastAssistantMessage)}
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!lastAssistantMessage}
                >
                  {isSpeaking ? "正在播报..." : "重听上一句"}
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

          <div className="mt-6 max-w-xl">
            <AmbientMusicToggle scene={themeId} />
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
                alt="故事插图"
                className="h-[320px] w-full rounded-[1.5rem] object-cover"
              />
            ) : (
              <div className="flex h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-teal-200 bg-white/70 text-center">
                {imageFeatureEnabled ? (
                  <>
                    <p className="text-lg font-semibold text-slate-700">点击“生成本章插图”</p>
                    <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                      我会给当前故事章节画一张绘本风插图，漂亮的画面会多等一小会儿。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-slate-700">当前为对外稳定版</p>
                    <p className="mt-2 max-w-xs text-sm leading-7 text-slate-500">
                      为了让孩子体验更稳定，今天先保留聊天、语音和小游戏主流程。
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
              <p className="text-sm font-semibold text-amber-700">互动故事</p>
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
                  故事伙伴正在想下一段...
                </div>
              </div>
            ) : null}
          </div>

          {latestBadgeFeedback ? (
            <div
              aria-live="polite"
              className="mt-5 rounded-[1.8rem] bg-emerald-50 px-5 py-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-emerald-800">成长勋章点亮</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                这是你认真尝试的小小成长印记，可以继续下一步啦。
              </p>
            </div>
          ) : null}

          <div className="mt-5 rounded-[1.8rem] bg-white/80 p-4">
            <p className="text-sm font-semibold text-teal-700">点一个成长任务</p>
            <div className="mt-3 flex flex-wrap gap-3">
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
              maxLength={storyInputMaxLength}
              className="h-14 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
            />
            <button
              onClick={() => void sendMessage(input)}
              className="h-14 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || !input.trim()}
            >
              发送故事
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span>建议一句话说清楚孩子想听什么，故事伙伴会继续编短故事。</span>
            <span className={storyInputRemaining < 20 ? "text-amber-700" : "text-slate-500"}>
              还可输入 {storyInputRemaining} 字
            </span>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#fff7dc_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-rose-700">玩法说明</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">怎么和网站互动</h2>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
            <li>1. 先选一个故事主题线，再发一句话。</li>
            <li>2. 可以直接点快捷选项，也可以自己输入内容。</li>
            <li>3. 想让孩子开口说话时，点击语音按钮开始听写，或者直接点“重听上一句”。</li>
            <li>
              4. {imageFeatureEnabled ? "到一个新章节后，点击右上角按钮画绘本插图。" : "今天先听故事、玩小游戏，画面晚一点再来。"}
            </li>
            <li>5. 底部还有 4 个小游戏，可以一起配合课堂或家里练习。</li>
          </ul>

          <div className="mt-6 rounded-[1.8rem] bg-white/80 p-4">
            <p className="text-sm font-semibold text-slate-500">本轮成长任务</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(themeId === "food"
                ? ["闽食探索", "表达练习", "家园共育"]
                : ["习惯养成", "生活练习", "家园共育"]
              ).map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"
                >
                  {item}
                </span>
              ))}
            </div>
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

          <div className="mt-6 rounded-[1.8rem] bg-slate-900 px-4 py-4 text-white">
            <p className="text-sm font-semibold text-white/70">使用小提示</p>
            <p className="mt-2 text-sm leading-7 text-white/90">
              先点快捷选项进入剧情，再切到插图、小游戏和拍图打卡，孩子会更容易被吸引。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="rounded-[2.2rem] border border-white/70 bg-[linear-gradient(135deg,#fff7dc_0%,#ffffff_50%,#dff8f7_100%)] p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-700">互动能力条</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">这一页能怎么玩</h3>
            </div>
            <div className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              一页看懂主要功能
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {adventureFeaturePills.map((item) => (
              <div
                key={item.label}
                className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {themeId === "habit" ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <HabitVisualBoard />
          <HabitMissionPoster badges={badges} missions={activeMissions} />
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <FoodBadgeWall />
          <div className="grid gap-5">
            <MealPhotoBooth onReviewLogged={handleMealReviewLogged} />
            {latestGrowthFeedbackSource === "meal-review" && latestBadgeFeedback ? (
              <div
                aria-live="polite"
                className="rounded-[2rem] bg-emerald-50 p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-emerald-800">拍图打卡成长反馈</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  你愿意观察餐盘和闽食，这个小尝试已经被记录下来啦。
                </p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <section className="grid gap-6">
        <RewardStickerShelf badges={badges} />
        <GrowthArchivePanel archive={growthArchive} onClear={clearGrowthArchive} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {latestGrowthFeedbackSource === "mini-game" && latestBadgeFeedback ? (
          <div
            aria-live="polite"
            className="rounded-[2rem] bg-amber-50 p-5 shadow-sm xl:col-span-2"
          >
            <p className="text-sm font-semibold text-amber-900">小游戏成长反馈</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{latestBadgeFeedback}</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              你认真完成了这个小挑战，可以带着这个好习惯继续玩啦。
            </p>
            <p className="mt-2 text-xs leading-6 font-semibold text-amber-900">
              老师或家长可以在下方生成一段家园同步话术，把这次小进步带回家。
            </p>
          </div>
        ) : null}
        <ShuffleStepsGame onComplete={() => logMiniGameCompletion("washSteps", "洗手闪亮章")} />
        <QueueGame onComplete={() => logMiniGameCompletion("queue", "排队小队长")} />
        <KindWordsGame onComplete={() => logMiniGameCompletion("kindWords", "礼貌微笑章")} />
        <MealTrayGame onComplete={() => logMiniGameCompletion("mealTray", "均衡小餐盘")} />
      </section>

      <section className="rounded-[2.2rem] bg-white/90 p-6 shadow-[0_18px_50px_rgba(35,88,95,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">家园共育延伸</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-900">
              把孩子刚完成的小任务，变成老师和家长能接住的话
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              {completedMiniGameCount > 0
                ? `孩子已经完成 ${completedMiniGameCount} 次小游戏，可以生成一段课堂延伸或家长同步话术。`
                : "完成洗手、排队、礼貌表达或均衡餐盘后，可以到老师辅助页生成一段班级提醒或家长同步话术。"}
            </p>
          </div>
          <Link
            href={teacherExtensionHref}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            生成家园同步话术
          </Link>
        </div>
      </section>
    </div>
  );
}
