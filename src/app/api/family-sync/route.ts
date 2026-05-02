import { NextResponse } from "next/server";

import { findChildIdentitySuggestions } from "@/lib/child-identity";
import {
  materializeAccountPayload,
  readAllAccountRecords,
  recordAccountPull,
  updateAccountDatasets,
  type AccountSyncPayload,
} from "@/lib/account-sync-store";
import { parseChildRoster, parseGrowthArchive, type ChildProfile } from "@/lib/growth-archive";
import {
  addParentFeedbackRecord,
  parseParentFeedbackRecords,
  parseParentSyncRecords,
  type ParentFeedbackRecord,
} from "@/lib/parent-sync";

export const runtime = "nodejs";
export const maxDuration = 10;

type FamilySyncBody = {
  action?: unknown;
  bindingCode?: unknown;
  childId?: unknown;
  childQuery?: unknown;
  deviceId?: unknown;
  deviceName?: unknown;
  feedback?: unknown;
};

function text(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeBindingCode(value: unknown) {
  return text(value, 24).toUpperCase();
}

function getFamilyPayload(payload: AccountSyncPayload, child: ChildProfile): AccountSyncPayload {
  const parentSyncRecords = parseParentSyncRecords(payload.parentSyncRecords ?? null)
    .filter((record) => record.childId === child.id);
  const parentFeedbackRecords = parseParentFeedbackRecords(payload.parentFeedbackRecords ?? null)
    .filter((record) => record.childId === child.id);
  const growthArchive = parseGrowthArchive(payload.growthArchive ?? null);
  const childGrowthArchive = {
    ...growthArchive,
    badgeRecords: growthArchive.badgeRecords.filter((record) => record.childId === child.id),
    mealReviews: growthArchive.mealReviews.filter((record) => record.childId === child.id),
    foodPreferenceRecords: growthArchive.foodPreferenceRecords.filter((record) => record.childId === child.id),
    miniGameRecords: growthArchive.miniGameRecords.filter((record) => record.childId === child.id),
  };

  return {
    childRoster: JSON.stringify([child]),
    growthArchive: JSON.stringify(childGrowthArchive),
    parentSyncRecords: JSON.stringify(parentSyncRecords),
    parentFeedbackRecords: JSON.stringify(parentFeedbackRecords),
    teacherPictureBooks: payload.teacherPictureBooks ?? "",
    weeklyMenuEntries: payload.weeklyMenuEntries ?? "",
    dailyMenuOverrides: payload.dailyMenuOverrides ?? "",
  };
}

function normalizeFeedback(value: unknown, child: ChildProfile): ParentFeedbackRecord | null {
  const [record] = parseParentFeedbackRecords(JSON.stringify([value]));

  if (!record) {
    return null;
  }

  return {
    ...record,
    childId: child.id,
    childName: child.name,
    status: "new",
  };
}

async function findFamilyAccount(body: FamilySyncBody) {
  const bindingCode = normalizeBindingCode(body.bindingCode);
  const childQuery = text(body.childQuery, 80);
  const childId = text(body.childId, 80);

  if (!bindingCode || (!childQuery && !childId)) {
    return undefined;
  }

  const accounts = await readAllAccountRecords();

  for (const account of accounts) {
    const payload = materializeAccountPayload(account);
    const roster = parseChildRoster(payload.childRoster ?? null);
    const candidates = childId
      ? roster.filter((child) => child.id === childId)
      : findChildIdentitySuggestions(childQuery, roster);
    const child = candidates.find(
      (item) => normalizeBindingCode(item.familyBindingCode) === bindingCode,
    );

    if (child) {
      return { account, child, payload };
    }
  }

  return undefined;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as FamilySyncBody | null;
  const action = body?.action === "feedback" ? "feedback" : "pull";

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "缺少家庭同步信息。" },
      { status: 400 },
    );
  }

  const matched = await findFamilyAccount(body);

  if (!matched) {
    return NextResponse.json({
      ok: false,
      error: "没有找到匹配的幼儿身份或家庭绑定码。",
    });
  }

  const syncMeta = {
    role: "parent" as const,
    deviceId: text(body.deviceId, 80) || undefined,
    deviceName: text(body.deviceName, 120) || request.headers.get("user-agent") || "parent-browser",
  };

  if (action === "pull") {
    const pulled = await recordAccountPull(matched.account.account, syncMeta);
    const payload = materializeAccountPayload(pulled ?? matched.account);

    return NextResponse.json({
      ok: true,
      action,
      child: matched.child,
      updatedAt: (pulled ?? matched.account).updatedAt,
      payload: getFamilyPayload(payload, matched.child),
    });
  }

  const feedback = normalizeFeedback(body.feedback, matched.child);

  if (!feedback) {
    return NextResponse.json(
      { ok: false, error: "家庭反馈内容无效。" },
      { status: 400 },
    );
  }

  const currentFeedback = parseParentFeedbackRecords(matched.payload.parentFeedbackRecords ?? null);
  const nextFeedback = addParentFeedbackRecord(
    currentFeedback.filter((record) => record.id !== feedback.id),
    feedback,
  );
  const updated = await updateAccountDatasets(
    matched.account.account,
    { parentFeedbackRecords: JSON.stringify(nextFeedback) },
    syncMeta,
  );
  const nextPayload = materializeAccountPayload(updated?.record ?? matched.account);

  return NextResponse.json({
    ok: true,
    action,
    child: matched.child,
    updatedAt: updated?.updatedAt ?? matched.account.updatedAt,
    payload: getFamilyPayload(nextPayload, matched.child),
  });
}
