import { NextResponse } from "next/server";

import {
  appendGameEngineSessionEvent,
  completeGameEngineSession,
  startGameEngineSession,
  type GameEngineAttemptInput,
} from "@/lib/game-engine-ledger";
import { gameEngineVersion } from "@/lib/game-engine-registry";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as GameEngineAttemptInput | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "缺少游戏互动记录。" },
      { status: 400 },
    );
  }

  const action = body.action === "start" || body.action === "event" || body.action === "complete"
    ? body.action
    : "complete";

  if (action === "start") {
    const started = await startGameEngineSession(body);

    if (!started.ok) {
      return NextResponse.json(
        { ok: false, error: started.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      engineVersion: gameEngineVersion,
      session: started.session,
    });
  }

  if (action === "event") {
    const updated = await appendGameEngineSessionEvent(body);

    if (!updated.ok) {
      return NextResponse.json(
        { ok: false, error: updated.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      engineVersion: gameEngineVersion,
      session: updated.session,
    });
  }

  const completed = await completeGameEngineSession(body);

  if (!completed.ok) {
    return NextResponse.json(
      { ok: false, error: completed.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    action,
    engineVersion: gameEngineVersion,
    attemptId: completed.record.id,
    createdAt: completed.record.createdAt,
    gameKey: completed.record.gameKey,
    gameInstanceId: completed.record.gameInstanceId,
    gameInstanceTitle: completed.record.gameInstanceTitle,
    score: completed.record.score,
    stars: completed.record.stars,
  });
}
