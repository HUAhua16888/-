import type { ChildProfile } from "@/lib/growth-archive";

export function formatChildLabel(child: ChildProfile) {
  return `${child.rosterNumber ? `${child.rosterNumber}号 ` : ""}${child.name}`;
}

function normalizeIdentityText(value: string) {
  return value.replace(/[\s，。,.、：:；;！!？?“”"'（）()]/g, "").toLowerCase();
}

function parseChineseNumber(value: string) {
  const digits: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (value === "十") {
    return 10;
  }

  if (value.includes("十")) {
    const [left, right] = value.split("十");
    const tens = left ? digits[left] ?? 0 : 1;
    const ones = right ? digits[right] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return digits[value] ?? Number.NaN;
}

function extractRosterNumberCandidates(transcript: string) {
  const candidates = new Set<string>();

  for (const match of transcript.matchAll(/(\d{1,2})\s*(?:号|號|名|位)?/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) {
      candidates.add(String(value));
    }
  }

  for (const match of transcript.matchAll(/([一二两三四五六七八九十]{1,3})\s*(?:号|號|名|位)/g)) {
    const value = parseChineseNumber(match[1]);
    if (Number.isFinite(value) && value > 0) {
      candidates.add(String(value));
    }
  }

  return candidates;
}

export function findChildIdentitySuggestions(transcript: string, roster: ChildProfile[]) {
  const normalizedTranscript = normalizeIdentityText(transcript);
  const numberCandidates = extractRosterNumberCandidates(transcript);
  const matches = roster.filter((child) => {
    const normalizedName = normalizeIdentityText(child.name);
    const normalizedNumber = child.rosterNumber ? String(Number(child.rosterNumber)) : "";
    const numberMatched = normalizedNumber ? numberCandidates.has(normalizedNumber) : false;
    const nameMatched =
      normalizedName.length > 0 &&
      (normalizedTranscript.includes(normalizedName) ||
        (normalizedTranscript.length >= 2 && normalizedName.includes(normalizedTranscript)));

    return numberMatched || nameMatched;
  });

  return Array.from(new Map(matches.map((child) => [child.id, child])).values()).slice(0, 6);
}
