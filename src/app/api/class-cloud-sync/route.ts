import { NextResponse } from "next/server";

import {
  hashPasscode,
  materializeAccountPayload,
  normalizeAccount,
  normalizeAccountPayload,
  normalizePasscode,
  pushAccountDatasets,
  recordAccountPull,
  readAccountRecord,
} from "@/lib/account-sync-store";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    account?: unknown;
    deviceId?: unknown;
    deviceName?: unknown;
    passcode?: unknown;
    payload?: unknown;
  } | null;
  const action = body?.action;
  const account = normalizeAccount(body?.account);
  const passcode = normalizePasscode(body?.passcode);

  if (action !== "push" && action !== "pull") {
    return NextResponse.json(
      { ok: false, error: "请选择上传或拉取班级账号同步数据。" },
      { status: 400 },
    );
  }

  if (!account || !passcode) {
    return NextResponse.json(
      { ok: false, error: "请先填写教师账号和口令。" },
      { status: 400 },
    );
  }

  const passcodeHash = hashPasscode(passcode);
  const current = await readAccountRecord(account);
  const syncMeta = {
    role: "teacher" as const,
    deviceId: typeof body?.deviceId === "string" ? body.deviceId : undefined,
    deviceName: typeof body?.deviceName === "string"
      ? body.deviceName
      : request.headers.get("user-agent") ?? "browser",
  };

  if (current && current.passcodeHash !== passcodeHash) {
    return NextResponse.json(
      { ok: false, error: "账号同步口令不匹配，请确认本班教师账号口令。" },
      { status: 403 },
    );
  }

  if (action === "pull") {
    const pulled = current ? await recordAccountPull(account, syncMeta) : undefined;

    if (!pulled) {
      return NextResponse.json(
        { ok: false, error: "还没有班级账号同步数据，请先在原设备上传一次。" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      account: pulled.account,
      updatedAt: pulled.updatedAt,
      payload: materializeAccountPayload(pulled),
    });
  }

  const payload = normalizeAccountPayload(body?.payload);
  const result = await pushAccountDatasets(account, passcodeHash, payload, syncMeta);

  return NextResponse.json({
    ok: true,
    account,
    updatedAt: result.updatedAt,
    payloadKeys: result.payloadKeys,
  });
}
