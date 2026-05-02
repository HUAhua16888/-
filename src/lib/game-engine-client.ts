import type { ChildRecordFields, MiniGameKey, MiniGameRecord } from "@/lib/growth-archive";
import { getGameEngineDefinition } from "@/lib/game-engine-registry";
import type { ThemeId } from "@/lib/site-data";

type GameEngineClientInput = {
  gameKey: MiniGameKey;
  gameInstanceId?: string;
  gameInstanceTitle?: string;
  gameInstanceMechanic?: string;
  badgeName: string;
  themeId: ThemeId;
  source: string;
  pickedItems?: string[];
  detail?: Partial<Omit<MiniGameRecord, "completedAt" | "gameKey" | "badgeName" | "themeId" | "pickedItems">>;
} & ChildRecordFields;

function inferEngineMode(input: GameEngineClientInput) {
  if (input.detail?.uploadedFileName) {
    return "upload";
  }

  if (input.detail?.childUtterance || input.detail?.aiBroadcastText) {
    return "voice";
  }

  return (input.pickedItems?.length ?? 0) > 1 ? "sequence" : "choice";
}

function buildEngineEvents(input: GameEngineClientInput) {
  const now = new Date().toISOString();
  const pickedItems = input.pickedItems ?? [];
  const definition = getGameEngineDefinition(input.gameKey);
  const instanceTitle = input.gameInstanceTitle ?? input.detail?.gameInstanceTitle;

  return [
    {
      type: "session.start",
      at: now,
      label: instanceTitle ?? definition?.title ?? input.source,
    },
    ...(definition?.steps ?? []).slice(0, pickedItems.length).map((step, index) => ({
      type: "state.step",
      at: now,
      label: step,
      value: pickedItems[index],
      stepIndex: index + 1,
    })),
    ...(input.detail?.childUtterance ? [{
      type: "input.voice",
      at: now,
      label: "childUtterance",
      value: input.detail.childUtterance,
    }] : []),
    ...(input.detail?.uploadedFileName ? [{
      type: "input.upload",
      at: now,
      label: "uploadedFileName",
      value: input.detail.uploadedFileName,
    }] : []),
    ...pickedItems.map((item, index) => ({
      type: "input.choice",
      at: now,
      label: item,
      value: item,
      stepIndex: index + 1,
    })),
    {
      type: "session.complete",
      at: now,
      label: input.badgeName,
    },
  ];
}

export async function recordGameEngineAttempt(input: GameEngineClientInput) {
  const definition = getGameEngineDefinition(input.gameKey);
  const actionCount = Math.max(input.pickedItems?.length ?? 0, input.detail?.childUtterance ? 1 : 0);
  const progress = definition ? Math.min(1, actionCount / definition.minActions) : 1;
  const score = Math.round((definition?.maxScore ?? 100) * progress);

  try {
    await fetch("/api/game-engine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        action: "complete",
        engineMode: inferEngineMode(input),
        events: buildEngineEvents(input),
        score: Math.min(100, Math.max(20, score)),
        stars: Math.min(3, Math.max(1, Math.ceil(score / 34))),
      }),
    });
  } catch {
    // Game play must not fail just because the support ledger is unavailable.
  }
}
