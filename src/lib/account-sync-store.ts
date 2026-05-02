import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const accountSyncPayloadKeys = [
  "childRoster",
  "growthArchive",
  "weeklyMenuEntries",
  "dailyMenuOverrides",
  "parentSyncRecords",
  "parentFeedbackRecords",
  "gameContentConfigs",
  "teacherPictureBooks",
  "habitTemplates",
  "savedResults",
] as const;

export type AccountSyncPayloadKey = typeof accountSyncPayloadKeys[number];
export type AccountSyncPayload = Partial<Record<AccountSyncPayloadKey, string>>;
export type AccountSyncRole = "teacher" | "parent" | "child" | "classroom";

export type AccountSyncMeta = {
  role?: AccountSyncRole;
  deviceId?: string;
  deviceName?: string;
};

type LegacyCloudPayload = Partial<Record<AccountSyncPayloadKey, unknown>>;

type LegacyCloudSnapshot = {
  account: string;
  passcodeHash: string;
  updatedAt: string;
  payload: LegacyCloudPayload;
};

export type AccountSyncDataset = {
  value: string;
  checksum: string;
  version: number;
  updatedAt: string;
  bytes: number;
};

type AccountSyncDevice = {
  id: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  pushCount: number;
  pullCount: number;
};

export type AccountSyncRecord = {
  account: string;
  passcodeHash: string;
  role: AccountSyncRole;
  createdAt: string;
  updatedAt: string;
  devices: AccountSyncDevice[];
  datasets: Partial<Record<AccountSyncPayloadKey, AccountSyncDataset>>;
  syncLog: Array<{
    action: "push" | "pull";
    at: string;
    deviceId?: string;
    datasetKeys: AccountSyncPayloadKey[];
    datasetVersions: Partial<Record<AccountSyncPayloadKey, number>>;
  }>;
};

type AccountSyncStore = Record<string, AccountSyncRecord>;

const syncDir = path.join(process.cwd(), ".tongqu-account-sync");
const syncFile = path.join(syncDir, "accounts.json");
const legacySyncFile = path.join(process.cwd(), ".tongqu-cloud-sync", "class-sync.json");
const maxPayloadItemLength = 600_000;

function normalizeStoreKey(account: string) {
  return account.trim().toLowerCase();
}

function normalizeRole(value: unknown): AccountSyncRole {
  return value === "parent" || value === "child" || value === "classroom" ? value : "teacher";
}

function normalizeDeviceText(value: unknown, fallback: string, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function normalizeDeviceId(value: unknown, seed: string) {
  const clean = typeof value === "string" ? value.trim().slice(0, 80) : "";

  return clean || createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function getDatasetVersions(datasets: AccountSyncRecord["datasets"]) {
  const versions: Partial<Record<AccountSyncPayloadKey, number>> = {};

  for (const key of accountSyncPayloadKeys) {
    const dataset = datasets[key];

    if (dataset) {
      versions[key] = dataset.version;
    }
  }

  return versions;
}

function touchDevice(
  devices: AccountSyncDevice[],
  meta: AccountSyncMeta | undefined,
  now: string,
  action: "push" | "pull",
  account: string,
) {
  const name = normalizeDeviceText(meta?.deviceName, "browser");
  const id = normalizeDeviceId(meta?.deviceId, `${account}:${name}`);
  const existing = devices.find((device) => device.id === id);
  const nextDevice: AccountSyncDevice = {
    id,
    name,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    pushCount: (existing?.pushCount ?? 0) + (action === "push" ? 1 : 0),
    pullCount: (existing?.pullCount ?? 0) + (action === "pull" ? 1 : 0),
  };

  return {
    deviceId: id,
    devices: [nextDevice, ...devices.filter((device) => device.id !== id)].slice(0, 12),
  };
}

export function normalizeAccount(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 40) : "";
}

export function normalizePasscode(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

export function hashPasscode(passcode: string) {
  return createHash("sha256").update(`tongqu-growth-web:${passcode}`).digest("hex");
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJsonValue(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function serializeJsonValue(value: unknown, fallback: string) {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function getStringField(record: Record<string, unknown>, field: string) {
  const value = record[field];

  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getLatestTimestamp(record: Record<string, unknown>, fields: string[]) {
  const times = fields
    .map((field) => {
      const value = record[field];

      return typeof value === "string" ? new Date(value).getTime() : Number.NaN;
    })
    .filter((value) => !Number.isNaN(value));

  return times.length > 0 ? Math.max(...times) : 0;
}

function getMergeKey(record: Record<string, unknown>, fallbackFields: string[], index: number) {
  for (const field of ["eventId", "id", "taskId", ...fallbackFields]) {
    const value = getStringField(record, field);

    if (value) {
      return `${field}:${value}`;
    }
  }

  const compact = JSON.stringify(record).slice(0, 160);

  return `row:${index}:${compact}`;
}

function mergeObjectArrays(
  previousItems: unknown,
  incomingItems: unknown,
  fallbackFields: string[] = [],
  timestampFields: string[] = ["updatedAt", "completedAt", "createdAt", "recordedAt", "reviewedAt", "publishedAt"],
) {
  const previousArray = Array.isArray(previousItems) ? previousItems : [];
  const incomingArray = Array.isArray(incomingItems) ? incomingItems : [];
  const merged = new Map<string, Record<string, unknown>>();

  [...previousArray, ...incomingArray].forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return;
    }

    const record = item as Record<string, unknown>;
    const key = getMergeKey(record, fallbackFields, index);
    const current = merged.get(key);

    if (!current) {
      merged.set(key, record);
      return;
    }

    const currentTime = getLatestTimestamp(current, timestampFields);
    const nextTime = getLatestTimestamp(record, timestampFields);

    merged.set(key, nextTime >= currentTime ? { ...current, ...record } : { ...record, ...current });
  });

  return Array.from(merged.values()).sort(
    (left, right) => getLatestTimestamp(right, timestampFields) - getLatestTimestamp(left, timestampFields),
  );
}

function mergeCounts(
  previousValue: unknown,
  incomingValue: unknown,
  keys: string[],
) {
  const previousRecord =
    previousValue && typeof previousValue === "object" && !Array.isArray(previousValue)
      ? previousValue as Record<string, unknown>
      : {};
  const incomingRecord =
    incomingValue && typeof incomingValue === "object" && !Array.isArray(incomingValue)
      ? incomingValue as Record<string, unknown>
      : {};
  const result: Record<string, number> = {};

  for (const key of keys) {
    const previousCount = typeof previousRecord[key] === "number" ? previousRecord[key] as number : 0;
    const incomingCount = typeof incomingRecord[key] === "number" ? incomingRecord[key] as number : 0;

    result[key] = Math.max(previousCount, incomingCount);
  }

  return result;
}

export function mergeGrowthArchiveValue(previousValue: string | undefined, incomingValue: string) {
  const previous = parseJsonValue(previousValue);
  const incoming = parseJsonValue(incomingValue);

  if (!previous || typeof previous !== "object" || Array.isArray(previous)) {
    return incomingValue;
  }

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return previousValue ?? incomingValue;
  }

  const previousRecord = previous as Record<string, unknown>;
  const incomingRecord = incoming as Record<string, unknown>;
  const themeVisits = mergeCounts(previousRecord.themeVisits, incomingRecord.themeVisits, ["habit", "food"]);
  const miniGameProgress = mergeCounts(
    previousRecord.miniGameProgress,
    incomingRecord.miniGameProgress,
    [
      "washSteps",
      "queue",
      "habitJudge",
      "readingCheckin",
      "kindWords",
      "todayMenu",
      "foodObserve",
      "foodClue",
      "foodTrain",
      "foodGuess",
      "foodPreference",
      "foodReporter",
      "foodKitchen",
      "peerEncourage",
      "mealTray",
      "mealManners",
      "habitTrafficLight",
    ],
  );
  const lastUpdated =
    getLatestTimestamp(incomingRecord, ["lastUpdated"]) >= getLatestTimestamp(previousRecord, ["lastUpdated"])
      ? incomingRecord.lastUpdated
      : previousRecord.lastUpdated;
  const merged = {
    ...previousRecord,
    ...incomingRecord,
    badgeRecords: mergeObjectArrays(previousRecord.badgeRecords, incomingRecord.badgeRecords, ["name", "childId", "earnedAt"], ["updatedAt", "earnedAt"]),
    mealReviews: mergeObjectArrays(previousRecord.mealReviews, incomingRecord.mealReviews, ["childId", "reviewedAt", "imageName"], ["updatedAt", "reviewedAt"]),
    foodPreferenceRecords: mergeObjectArrays(
      previousRecord.foodPreferenceRecords,
      incomingRecord.foodPreferenceRecords,
      ["childId", "foodId", "recordedAt"],
      ["updatedAt", "recordedAt"],
    ),
    miniGameRecords: mergeObjectArrays(previousRecord.miniGameRecords, incomingRecord.miniGameRecords, ["childId", "gameKey", "completedAt"], ["updatedAt", "completedAt"]),
    miniGameProgress,
    themeVisits,
    lastUpdated: typeof lastUpdated === "string" ? lastUpdated : new Date().toISOString(),
  };

  return serializeJsonValue(merged, incomingValue);
}

function mergeJsonArrayValue(
  previousValue: string | undefined,
  incomingValue: string,
  fallbackFields: string[] = [],
  timestampFields?: string[],
) {
  const previous = parseJsonValue(previousValue);
  const incoming = parseJsonValue(incomingValue);

  if (!Array.isArray(previous) || !Array.isArray(incoming)) {
    return incomingValue;
  }

  return serializeJsonValue(mergeObjectArrays(previous, incoming, fallbackFields, timestampFields), incomingValue);
}

function mergeAccountDatasetValue(
  key: AccountSyncPayloadKey,
  previousValue: string | undefined,
  incomingValue: string,
  meta?: AccountSyncMeta,
) {
  if (!previousValue) {
    return incomingValue;
  }

  if (!incomingValue) {
    return previousValue;
  }

  if (key === "growthArchive") {
    return mergeGrowthArchiveValue(previousValue, incomingValue);
  }

  if (key === "weeklyMenuEntries" || key === "dailyMenuOverrides") {
    return meta?.role === "teacher"
      ? incomingValue
      : mergeJsonArrayValue(previousValue, incomingValue, ["id", "date", "mealType", "dishName"], ["updatedAt", "publishedAt", "createdAt"]);
  }

  if (key === "childRoster") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["childId", "name", "rosterNumber"], ["updatedAt", "createdAt"]);
  }

  if (key === "parentFeedbackRecords") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["childId", "createdAt", "content"], ["updatedAt", "createdAt"]);
  }

  if (key === "parentSyncRecords") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["childId", "title", "createdAt"], ["updatedAt", "syncedAt", "createdAt"]);
  }

  if (key === "teacherPictureBooks") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["title", "publishedAt"], ["updatedAt", "publishedAt"]);
  }

  if (key === "habitTemplates") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["title", "publishedAt"], ["updatedAt", "publishedAt"]);
  }

  if (key === "gameContentConfigs") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["gameKey", "title"], ["updatedAt", "publishedAt"]);
  }

  if (key === "savedResults") {
    return mergeJsonArrayValue(previousValue, incomingValue, ["title", "createdAt"], ["updatedAt", "confirmedAt", "createdAt"]);
  }

  return incomingValue;
}

function normalizePayloadItem(value: unknown) {
  if (typeof value === "string") {
    return value.length <= maxPayloadItemLength ? value : null;
  }

  if (value && typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);

      return serialized.length <= maxPayloadItemLength ? serialized : null;
    } catch {
      return null;
    }
  }

  return value === null || value === undefined ? "" : String(value).slice(0, maxPayloadItemLength);
}

export function normalizeAccountPayload(value: unknown): AccountSyncPayload {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  const payload: AccountSyncPayload = {};

  for (const key of accountSyncPayloadKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }

    const item = normalizePayloadItem(record[key]);

    if (item !== null) {
      payload[key] = item;
    }
  }

  return payload;
}

async function readJsonObject(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function buildRecordFromLegacy(snapshot: LegacyCloudSnapshot): AccountSyncRecord {
  const updatedAt = snapshot.updatedAt || new Date().toISOString();
  const payload = normalizeAccountPayload(snapshot.payload);
  const datasets: AccountSyncRecord["datasets"] = {};

  for (const key of accountSyncPayloadKeys) {
    const value = payload[key];

    if (value === undefined) {
      continue;
    }

    datasets[key] = {
      value,
      checksum: checksum(value),
      version: 1,
      updatedAt,
      bytes: Buffer.byteLength(value, "utf8"),
    };
  }

  return {
    account: snapshot.account,
    passcodeHash: snapshot.passcodeHash,
    role: "teacher",
    createdAt: updatedAt,
    updatedAt,
    devices: [],
    datasets,
    syncLog: [
      {
        action: "push",
        at: updatedAt,
        datasetKeys: Object.keys(datasets) as AccountSyncPayloadKey[],
        datasetVersions: getDatasetVersions(datasets),
      },
    ],
  };
}

async function readLegacyStore(): Promise<AccountSyncStore> {
  const parsed = await readJsonObject(legacySyncFile);
  const migrated: AccountSyncStore = {};

  for (const [key, value] of Object.entries(parsed)) {
    const snapshot = value as Partial<LegacyCloudSnapshot>;

    if (
      typeof snapshot.account !== "string" ||
      typeof snapshot.passcodeHash !== "string" ||
      !snapshot.payload ||
      typeof snapshot.payload !== "object"
    ) {
      continue;
    }

    migrated[normalizeStoreKey(key)] = buildRecordFromLegacy(snapshot as LegacyCloudSnapshot);
  }

  return migrated;
}

async function readStore(): Promise<AccountSyncStore> {
  const parsed = await readJsonObject(syncFile);
  const store = parsed as AccountSyncStore;

  if (Object.keys(store).length > 0) {
    return store;
  }

  return readLegacyStore();
}

async function writeStore(store: AccountSyncStore) {
  await mkdir(syncDir, { recursive: true });
  await writeFile(syncFile, JSON.stringify(store, null, 2), "utf8");
}

export async function readAccountRecord(account: string) {
  const store = await readStore();

  return store[normalizeStoreKey(account)];
}

export async function readAllAccountRecords() {
  const store = await readStore();

  return Object.values(store);
}

export function materializeAccountPayload(record: AccountSyncRecord): AccountSyncPayload {
  const payload: AccountSyncPayload = {};

  for (const key of accountSyncPayloadKeys) {
    const dataset = record.datasets[key];

    if (dataset) {
      payload[key] = dataset.value;
    }
  }

  return payload;
}

export async function updateAccountDatasets(
  account: string,
  payload: AccountSyncPayload,
  meta?: AccountSyncMeta,
) {
  const store = await readStore();
  const storeKey = normalizeStoreKey(account);
  const current = store[storeKey];

  if (!current) {
    return undefined;
  }

  const now = new Date().toISOString();
  const datasets: AccountSyncRecord["datasets"] = { ...(current.datasets ?? {}) };
  const payloadKeys = Object.keys(payload) as AccountSyncPayloadKey[];

  for (const key of payloadKeys) {
    const incomingValue = payload[key] ?? "";
    const previous = datasets[key];
    const value = mergeAccountDatasetValue(key, previous?.value, incomingValue, meta);
    const nextChecksum = checksum(value);

    datasets[key] = {
      value,
      checksum: nextChecksum,
      version: previous?.checksum === nextChecksum ? previous.version : (previous?.version ?? 0) + 1,
      updatedAt: previous?.checksum === nextChecksum ? previous.updatedAt : now,
      bytes: Buffer.byteLength(value, "utf8"),
    };
  }

  const touched = touchDevice(current.devices ?? [], meta, now, "push", account);
  const record: AccountSyncRecord = {
    ...current,
    role: current.role ?? normalizeRole(meta?.role),
    updatedAt: now,
    devices: touched.devices,
    datasets,
    syncLog: [
      {
        action: "push" as const,
        at: now,
        deviceId: touched.deviceId,
        datasetKeys: payloadKeys,
        datasetVersions: getDatasetVersions(datasets),
      },
      ...(current.syncLog ?? []),
    ].slice(0, 80),
  };

  store[storeKey] = record;
  await writeStore(store);

  return {
    record,
    updatedAt: now,
    payloadKeys,
  };
}

export async function recordAccountPull(account: string, meta?: AccountSyncMeta) {
  const store = await readStore();
  const storeKey = normalizeStoreKey(account);
  const current = store[storeKey];

  if (!current) {
    return undefined;
  }

  const now = new Date().toISOString();
  const touched = touchDevice(current.devices ?? [], meta, now, "pull", account);
  const record: AccountSyncRecord = {
    ...current,
    role: current.role ?? normalizeRole(meta?.role),
    devices: touched.devices,
    syncLog: [
      {
        action: "pull" as const,
        at: now,
        deviceId: touched.deviceId,
        datasetKeys: Object.keys(current.datasets) as AccountSyncPayloadKey[],
        datasetVersions: getDatasetVersions(current.datasets),
      },
      ...(current.syncLog ?? []),
    ].slice(0, 80),
  };

  store[storeKey] = record;
  await writeStore(store);

  return record;
}

export async function pushAccountDatasets(
  account: string,
  passcodeHash: string,
  payload: AccountSyncPayload,
  meta?: AccountSyncMeta,
) {
  const store = await readStore();
  const storeKey = normalizeStoreKey(account);
  const now = new Date().toISOString();
  const current = store[storeKey];
  const datasets: AccountSyncRecord["datasets"] = { ...(current?.datasets ?? {}) };
  const payloadKeys = Object.keys(payload) as AccountSyncPayloadKey[];

  for (const key of payloadKeys) {
    const incomingValue = payload[key] ?? "";
    const previous = datasets[key];
    const value = mergeAccountDatasetValue(key, previous?.value, incomingValue, meta);
    const nextChecksum = checksum(value);

    datasets[key] = {
      value,
      checksum: nextChecksum,
      version: previous?.checksum === nextChecksum ? previous.version : (previous?.version ?? 0) + 1,
      updatedAt: previous?.checksum === nextChecksum ? previous.updatedAt : now,
      bytes: Buffer.byteLength(value, "utf8"),
    };
  }

  const touched = touchDevice(current?.devices ?? [], meta, now, "push", account);
  const record: AccountSyncRecord = {
    account,
    passcodeHash,
    role: normalizeRole(meta?.role ?? current?.role),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    devices: touched.devices,
    datasets,
    syncLog: [
      {
        action: "push" as const,
        at: now,
        deviceId: touched.deviceId,
        datasetKeys: payloadKeys,
        datasetVersions: getDatasetVersions(datasets),
      },
      ...(current?.syncLog ?? []),
    ].slice(0, 80),
  };

  store[storeKey] = record;
  await writeStore(store);

  return {
    record,
    updatedAt: now,
    payloadKeys,
  };
}
