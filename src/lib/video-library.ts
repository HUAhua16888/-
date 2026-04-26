import type { ThemeId } from "@/lib/site-data";

export const videoLibraryStorageKey = "tongqu-growth-web-teacher-video-library";

export type TeacherVideoResource = {
  id: string;
  themeId: ThemeId;
  title: string;
  description: string;
  sourceType: "upload" | "prompt";
  fileName?: string;
  prompt?: string;
  createdAt: string;
};

export function parseVideoLibrary(raw: string | null): TeacherVideoResource[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is TeacherVideoResource =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              (item.themeId === "habit" || item.themeId === "food") &&
              typeof item.title === "string" &&
              typeof item.description === "string" &&
              (item.sourceType === "upload" || item.sourceType === "prompt") &&
              typeof item.createdAt === "string",
          ),
      )
      .map((item) => ({
        ...item,
        title: item.title.trim().slice(0, 40),
        description: item.description.trim().slice(0, 180),
        fileName: typeof item.fileName === "string" ? item.fileName.trim().slice(0, 120) : undefined,
        prompt: typeof item.prompt === "string" ? item.prompt.trim().slice(0, 500) : undefined,
      }))
      .filter((item) => item.id.trim() && item.title)
      .slice(0, 24);
  } catch {
    return [];
  }
}
