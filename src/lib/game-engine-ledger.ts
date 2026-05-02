import { createHash, randomUUID } from "crypto";
import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type { ChildRecordFields, MiniGameKey } from "@/lib/growth-archive";
import {
  gameEngineSchemaVersion,
  gameEngineVersion,
  getGameEngineDefinition,
  isGameEngineKey,
  type GameEngineClearMode,
  type GameEngineDefinition,
  type GameEngineMechanic,
  type GameEngineMode,
} from "@/lib/game-engine-registry";
import type { ThemeId } from "@/lib/site-data";

export type { GameEngineMode } from "@/lib/game-engine-registry";

export type GameEngineEvent = {
  type: "session.start" | "input.choice" | "input.voice" | "input.upload" | "state.step" | "session.complete";
  at: string;
  label?: string;
  value?: string;
  stepIndex?: number;
};

export type GameEngineAttemptInput = {
  action?: unknown;
  sessionId?: unknown;
  gameKey?: unknown;
  gameInstanceId?: unknown;
  gameInstanceTitle?: unknown;
  gameInstanceMechanic?: unknown;
  badgeName?: unknown;
  themeId?: unknown;
  source?: unknown;
  pickedItems?: unknown;
  detail?: unknown;
  event?: unknown;
  events?: unknown;
  engineMode?: unknown;
  score?: unknown;
  stars?: unknown;
} & Partial<ChildRecordFields>;

export type GameEngineAttemptRecord = {
  id: string;
  sessionId?: string;
  gameKey: MiniGameKey;
  gameInstanceId: string;
  gameInstanceTitle: string;
  gameInstanceMechanic: string;
  badgeName: string;
  themeId: ThemeId;
  source: string;
  engineMode: GameEngineMode;
  score: number;
  stars: number;
  pickedItems: string[];
  events: GameEngineEvent[];
  detail: Record<string, unknown>;
  definitionClearMode: GameEngineClearMode;
  definitionMechanic: GameEngineMechanic;
  definitionRules: string[];
  definitionTitle: string;
  engineVersion: typeof gameEngineVersion;
  schemaVersion: typeof gameEngineSchemaVersion;
  createdAt: string;
} & ChildRecordFields;

export type GameEngineSession = {
  id: string;
  status: "active";
  gameKey: MiniGameKey;
  gameInstanceId: string;
  gameInstanceTitle: string;
  gameInstanceMechanic: string;
  themeId: ThemeId;
  source: string;
  engineMode: GameEngineMode;
  expectedSteps: string[];
  currentStep: number;
  pickedItems: string[];
  events: GameEngineEvent[];
  detail: Record<string, unknown>;
  startedAt: string;
  updatedAt: string;
} & ChildRecordFields;

type GameEngineIndex = {
  updatedAt: string;
  totalsByGameKey: Partial<Record<MiniGameKey, number>>;
  totalsByGameInstanceId: Record<string, number>;
  totalsByMechanic: Partial<Record<GameEngineMechanic, number>>;
  totalsByMode: Partial<Record<GameEngineMode, number>>;
  recentAttempts: GameEngineAttemptRecord[];
};

const ledgerDir = path.join(process.cwd(), ".tongqu-game-engine");
const attemptsFile = path.join(ledgerDir, "attempts.jsonl");
const indexFile = path.join(ledgerDir, "index.json");
const sessionsFile = path.join(ledgerDir, "sessions.json");
const eventTypes = ["session.start", "input.choice", "input.voice", "input.upload", "state.step", "session.complete"];

function text(value: unknown, fallback = "", maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function list(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => text(item, "", 160))
        .filter(Boolean)
        .slice(0, 24)
    : [];
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return Math.min(max, Math.max(min, Math.round(next)));
}

function normalizeSessionId(value: unknown) {
  return text(value, "", 80);
}

function normalizeGameKey(value: unknown): MiniGameKey | null {
  return isGameEngineKey(value) ? value : null;
}

function normalizeTheme(value: unknown, definition: GameEngineDefinition): ThemeId {
  const theme = text(value) as ThemeId;

  return theme === "habit" || theme === "food" ? theme : definition.themeId;
}

function normalizeDetail(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const detail: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value).slice(0, 24)) {
    if (typeof item === "string") {
      detail[key] = item.slice(0, 400);
    } else if (typeof item === "number" || typeof item === "boolean") {
      detail[key] = item;
    } else if (Array.isArray(item)) {
      detail[key] = item.map((entry) => text(entry, "", 160)).filter(Boolean).slice(0, 12);
    }
  }

  return detail;
}

function detailString(detail: Record<string, unknown>, key: string, fallback = "", maxLength = 120) {
  return text(detail[key], fallback, maxLength);
}

function normalizeGameInstanceFields(
  input: GameEngineAttemptInput,
  detail: Record<string, unknown>,
  definition: GameEngineDefinition,
  session?: GameEngineSession,
) {
  const gameInstanceId =
    text(input.gameInstanceId ?? session?.gameInstanceId, "", 80) ||
    detailString(detail, "gameInstanceId", "", 80) ||
    definition.gameKey;
  const gameInstanceTitle =
    text(input.gameInstanceTitle ?? session?.gameInstanceTitle, "", 120) ||
    detailString(detail, "gameInstanceTitle", "", 120) ||
    definition.title;
  const gameInstanceMechanic =
    text(input.gameInstanceMechanic ?? session?.gameInstanceMechanic, "", 80) ||
    detailString(detail, "gameInstanceMechanic", "", 80) ||
    definition.mechanic;

  return {
    gameInstanceId,
    gameInstanceMechanic,
    gameInstanceTitle,
  };
}

function normalizeMode(
  value: unknown,
  pickedItems: string[],
  detail: Record<string, unknown>,
  definition: GameEngineDefinition,
): GameEngineMode {
  const mode = text(value) as GameEngineMode;

  if (definition.modes.includes(mode)) {
    return mode;
  }

  if (text(detail.uploadedFileName) && definition.modes.includes("upload")) {
    return "upload";
  }

  if ((text(detail.childUtterance) || text(detail.aiBroadcastText)) && definition.modes.includes("voice")) {
    return "voice";
  }

  if (pickedItems.length > 1 && definition.modes.includes("sequence")) {
    return "sequence";
  }

  return definition.modes[0] ?? "choice";
}

function normalizeSingleEvent(value: unknown, now: string): GameEngineEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = text(record.type) as GameEngineEvent["type"];

  if (!eventTypes.includes(type)) {
    return null;
  }

  return {
    type,
    at: text(record.at, now, 40),
    label: text(record.label, "", 160) || undefined,
    value: text(record.value, "", 240) || undefined,
    stepIndex: typeof record.stepIndex === "number" ? numberInRange(record.stepIndex, 0, 0, 99) : undefined,
  };
}

function normalizeEvents(value: unknown, pickedItems: string[], now: string): GameEngineEvent[] {
  if (Array.isArray(value)) {
    const events = value
      .map((item) => normalizeSingleEvent(item, now))
      .filter((item): item is GameEngineEvent => Boolean(item))
      .slice(0, 80);

    if (events.length > 0) {
      return events;
    }
  }

  return [
    { type: "session.start", at: now },
    ...pickedItems.map((item, index) => ({
      type: "input.choice" as const,
      at: now,
      label: item,
      value: item,
      stepIndex: index + 1,
    })),
    { type: "session.complete", at: now, label: "complete" },
  ];
}

function scoreAttempt(
  definition: GameEngineDefinition,
  pickedItems: string[],
  events: GameEngineEvent[],
  explicitScore: unknown,
) {
  if (typeof explicitScore === "number" && Number.isFinite(explicitScore)) {
    return numberInRange(explicitScore, 0, 0, definition.maxScore);
  }

  const actionCount = Math.max(
    pickedItems.length,
    events.filter((event) => event.type.startsWith("input.") || event.type === "state.step").length,
  );
  const progress = definition.minActions > 0 ? Math.min(1, actionCount / definition.minActions) : 1;
  const base = actionCount > 0 ? 20 : 0;

  return numberInRange(base + progress * (definition.maxScore - base), 0, 0, definition.maxScore);
}

async function readJsonObject<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

async function readIndex(): Promise<GameEngineIndex> {
  const fallback: GameEngineIndex = {
    updatedAt: new Date().toISOString(),
    totalsByGameKey: {},
    totalsByGameInstanceId: {},
    totalsByMechanic: {},
    totalsByMode: {},
    recentAttempts: [],
  };
  const parsed = await readJsonObject<Partial<GameEngineIndex>>(indexFile, fallback);

  return {
    updatedAt: text(parsed.updatedAt, fallback.updatedAt, 40),
    totalsByGameKey: parsed.totalsByGameKey ?? {},
    totalsByGameInstanceId: parsed.totalsByGameInstanceId ?? {},
    totalsByMechanic: parsed.totalsByMechanic ?? {},
    totalsByMode: parsed.totalsByMode ?? {},
    recentAttempts: Array.isArray(parsed.recentAttempts) ? parsed.recentAttempts.slice(0, 200) : [],
  };
}

async function readSessions() {
  return readJsonObject<Record<string, GameEngineSession>>(sessionsFile, {});
}

async function writeSessions(sessions: Record<string, GameEngineSession>) {
  await mkdir(ledgerDir, { recursive: true });
  await writeFile(sessionsFile, JSON.stringify(sessions, null, 2), "utf8");
}

export function normalizeGameEngineAttempt(input: GameEngineAttemptInput, session?: GameEngineSession) {
  const gameKey = normalizeGameKey(input.gameKey ?? session?.gameKey);

  if (!gameKey) {
    return { ok: false as const, error: "缺少有效的游戏标识。" };
  }

  const definition = getGameEngineDefinition(gameKey);

  if (!definition) {
    return { ok: false as const, error: "这个游戏还在准备中，可以先玩旁边的小任务。" };
  }

  const now = new Date().toISOString();
  const pickedItems = [...(session?.pickedItems ?? []), ...list(input.pickedItems)].slice(0, 32);
  const detail = {
    ...(session?.detail ?? {}),
    ...normalizeDetail(input.detail),
  };
  const gameInstance = normalizeGameInstanceFields(input, detail, definition, session);
  const events = [
    ...(session?.events ?? []),
    ...normalizeEvents(input.events, pickedItems, now),
  ].slice(-100);
  const score = scoreAttempt(definition, pickedItems, events, input.score);

  return {
    ok: true as const,
    record: {
      id: createHash("sha256").update(`${randomUUID()}:${gameKey}:${now}`).digest("hex").slice(0, 24),
      sessionId: normalizeSessionId(input.sessionId) || session?.id || undefined,
      gameKey,
      ...gameInstance,
      badgeName: text(input.badgeName, definition.title, 80),
      themeId: normalizeTheme(input.themeId ?? session?.themeId, definition),
      source: text(input.source ?? session?.source, "child-game", 120),
      engineMode: normalizeMode(input.engineMode ?? session?.engineMode, pickedItems, detail, definition),
      score,
      stars: numberInRange(input.stars, Math.max(1, Math.ceil(score / 34)), 0, 3),
      pickedItems,
      events,
      detail,
      definitionClearMode: definition.clearMode,
      definitionMechanic: definition.mechanic,
      definitionRules: definition.rules,
      definitionTitle: definition.title,
      engineVersion: gameEngineVersion,
      schemaVersion: gameEngineSchemaVersion,
      childId: text(input.childId ?? session?.childId, "", 80) || undefined,
      childName: text(input.childName ?? session?.childName, "", 80) || undefined,
      createdAt: now,
    } satisfies GameEngineAttemptRecord,
  };
}

export async function startGameEngineSession(input: GameEngineAttemptInput) {
  const gameKey = normalizeGameKey(input.gameKey);

  if (!gameKey) {
    return { ok: false as const, error: "缺少有效的游戏标识。" };
  }

  const definition = getGameEngineDefinition(gameKey);

  if (!definition) {
    return { ok: false as const, error: "这个游戏还在准备中，可以先玩旁边的小任务。" };
  }

  const now = new Date().toISOString();
  const detail = normalizeDetail(input.detail);
  const gameInstance = normalizeGameInstanceFields(input, detail, definition);
  const session: GameEngineSession = {
    id: createHash("sha256").update(`${randomUUID()}:${gameKey}:${now}`).digest("hex").slice(0, 24),
    status: "active",
    gameKey,
    ...gameInstance,
    themeId: normalizeTheme(input.themeId, definition),
    source: text(input.source, "child-game", 120),
    engineMode: normalizeMode(input.engineMode, [], detail, definition),
    expectedSteps: definition.steps,
    currentStep: 0,
    pickedItems: [],
    events: [{ type: "session.start", at: now, label: definition.title }],
    detail,
    childId: text(input.childId, "", 80) || undefined,
    childName: text(input.childName, "", 80) || undefined,
    startedAt: now,
    updatedAt: now,
  };
  const sessions = await readSessions();

  sessions[session.id] = session;
  await writeSessions(sessions);

  return { ok: true as const, session };
}

export async function appendGameEngineSessionEvent(input: GameEngineAttemptInput) {
  const sessionId = normalizeSessionId(input.sessionId);

  if (!sessionId) {
    return { ok: false as const, error: "缺少游戏会话。" };
  }

  const sessions = await readSessions();
  const session = sessions[sessionId];

  if (!session) {
    return { ok: false as const, error: "游戏会话不存在或已结束。" };
  }

  const now = new Date().toISOString();
  const event = normalizeSingleEvent(input.event, now);
  const pickedItems = [...session.pickedItems, ...list(input.pickedItems)].slice(0, 32);
  const nextEvents = event ? [...session.events, event] : session.events;
  const stepIndex = event?.stepIndex ?? session.currentStep;
  const nextSession: GameEngineSession = {
    ...session,
    pickedItems,
    events: nextEvents.slice(-100),
    currentStep: Math.max(session.currentStep, stepIndex),
    updatedAt: now,
  };

  sessions[sessionId] = nextSession;
  await writeSessions(sessions);

  return { ok: true as const, session: nextSession };
}

export async function completeGameEngineSession(input: GameEngineAttemptInput) {
  const sessionId = normalizeSessionId(input.sessionId);
  const sessions = await readSessions();
  const session = sessionId ? sessions[sessionId] : undefined;
  const normalized = normalizeGameEngineAttempt(input, session);

  if (!normalized.ok) {
    return normalized;
  }

  const record = await appendGameEngineAttempt(normalized.record);

  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
    await writeSessions(sessions);
  }

  return { ok: true as const, record };
}

export async function appendGameEngineAttempt(record: GameEngineAttemptRecord) {
  await mkdir(ledgerDir, { recursive: true });
  await appendFile(attemptsFile, `${JSON.stringify(record)}\n`, "utf8");

  const index = await readIndex();
  const nextIndex: GameEngineIndex = {
    updatedAt: record.createdAt,
    totalsByGameKey: {
      ...index.totalsByGameKey,
      [record.gameKey]: (index.totalsByGameKey[record.gameKey] ?? 0) + 1,
    },
    totalsByGameInstanceId: {
      ...index.totalsByGameInstanceId,
      [record.gameInstanceId]: (index.totalsByGameInstanceId[record.gameInstanceId] ?? 0) + 1,
    },
    totalsByMechanic: {
      ...index.totalsByMechanic,
      [record.definitionMechanic]: (index.totalsByMechanic[record.definitionMechanic] ?? 0) + 1,
    },
    totalsByMode: {
      ...index.totalsByMode,
      [record.engineMode]: (index.totalsByMode[record.engineMode] ?? 0) + 1,
    },
    recentAttempts: [record, ...index.recentAttempts].slice(0, 200),
  };

  await writeFile(indexFile, JSON.stringify(nextIndex, null, 2), "utf8");

  return record;
}
