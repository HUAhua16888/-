import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

type ClassCloudPayload = {
  childRoster?: unknown;
  growthArchive?: unknown;
  weeklyMenuEntries?: unknown;
  parentSyncRecords?: unknown;
  parentFeedbackRecords?: unknown;
  gameContentConfigs?: unknown;
  teacherPictureBooks?: unknown;
  habitTemplates?: unknown;
  savedResults?: unknown;
};

type StoredClassSnapshot = {
  account: string;
  passcodeHash: string;
  updatedAt: string;
  payload: ClassCloudPayload;
};

type CloudSyncStore = Record<string, StoredClassSnapshot>;

const syncDir = path.join(process.cwd(), ".tongqu-cloud-sync");
const syncFile = path.join(syncDir, "class-sync.json");
const allowedPayloadKeys = [
  "childRoster",
  "growthArchive",
  "weeklyMenuEntries",
  "parentSyncRecords",
  "parentFeedbackRecords",
  "gameContentConfigs",
  "teacherPictureBooks",
  "habitTemplates",
  "savedResults",
] as const;
const maxPayloadItemLength = 600_000;

function normalizeAccount(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 40) : "";
}

function normalizePasscode(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function hashPasscode(passcode: string) {
  return createHash("sha256").update(`tongqu-growth-web:${passcode}`).digest("hex");
}

function normalizePayloadItem(value: unknown) {
  if (typeof value === "string") {
    return value.length <= maxPayloadItemLength ? value : "";
  }

  if (value && typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      return serialized.length <= maxPayloadItemLength ? serialized : "";
    } catch {
      return "";
    }
  }

  return "";
}

function normalizePayload(value: unknown): ClassCloudPayload {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const payload: ClassCloudPayload = {};

  for (const key of allowedPayloadKeys) {
    const item = normalizePayloadItem(record[key]);

    if (item) {
      payload[key] = item;
    }
  }

  return payload;
}

async function readStore(): Promise<CloudSyncStore> {
  try {
    const raw = await readFile(syncFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as CloudSyncStore
      : {};
  } catch {
    return {};
  }
}

async function writeStore(store: CloudSyncStore) {
  await mkdir(syncDir, { recursive: true });
  await writeFile(syncFile, JSON.stringify(store, null, 2), "utf8");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    account?: unknown;
    passcode?: unknown;
    payload?: unknown;
  } | null;
  const action = body?.action;
  const account = normalizeAccount(body?.account);
  const passcode = normalizePasscode(body?.passcode);

  if (action !== "push" && action !== "pull") {
    return NextResponse.json(
      { ok: false, error: "请选择上传或拉取班级快照。" },
      { status: 400 },
    );
  }

  if (!account || !passcode) {
    return NextResponse.json(
      { ok: false, error: "请先填写教师账号和口令。" },
      { status: 400 },
    );
  }

  const store = await readStore();
  const key = account.toLowerCase();
  const passcodeHash = hashPasscode(passcode);
  const current = store[key];

  if (current && current.passcodeHash !== passcodeHash) {
    return NextResponse.json(
      { ok: false, error: "云同步口令不匹配，请确认本班教师账号口令。" },
      { status: 403 },
    );
  }

  if (action === "pull") {
    if (!current) {
      return NextResponse.json(
        { ok: false, error: "还没有云同步快照，请先在原设备上传一次。" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      account: current.account,
      updatedAt: current.updatedAt,
      payload: current.payload,
    });
  }

  const payload = normalizePayload(body?.payload);
  const updatedAt = new Date().toISOString();

  store[key] = {
    account,
    passcodeHash,
    updatedAt,
    payload,
  };
  await writeStore(store);

  return NextResponse.json({
    ok: true,
    account,
    updatedAt,
    payloadKeys: Object.keys(payload),
  });
}
