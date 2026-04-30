import type { ThemeId } from "@/lib/site-data";

export const teacherPictureBooksStorageKey = "tongqu-growth-web-teacher-picture-books";
export const habitTemplatesStorageKey = "tongqu-growth-web-habit-templates";

export type TeacherPictureBook = {
  id: string;
  themeId: ThemeId;
  title: string;
  storyText: string;
  question: string;
  options: string[];
  habitTask: string;
  publishedAt: string;
};

export type HabitCheckinTemplate = {
  id: string;
  title: string;
  habitFocus: string;
  childPrompt: string;
  teacherPrompt: string;
  storyText: string;
  answerCards: string[];
  habitTask: string;
  publishedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanLongText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .slice(0, maxLength)
        .trim()
    : "";
}

function cleanOptions(value: unknown, fallback: string[]) {
  const source = Array.isArray(value) ? value : [];
  const options = source
    .map((item) => cleanText(item, 22))
    .filter(Boolean)
    .slice(0, 4);

  return options.length >= 2 ? options : fallback;
}

export function parseTeacherPictureBooks(raw: string | null): TeacherPictureBook[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): TeacherPictureBook | null => {
        if (!isRecord(item)) {
          return null;
        }

        const id = cleanText(item.id, 80);
        const title = cleanText(item.title, 36);
        const storyText = cleanLongText(item.storyText, 900);
        const publishedAt = cleanText(item.publishedAt, 40);

        if (!id || !title || !storyText || !publishedAt) {
          return null;
        }

        return {
          id,
          themeId: item.themeId === "food" ? "food" : "habit",
          title,
          storyText,
          question: cleanText(item.question, 80) || "听完故事后，你想选择哪一张卡？",
          options: cleanOptions(item.options, ["我听到了一个角色", "我看到了一个画面", "我愿意试一个小任务"]),
          habitTask: cleanText(item.habitTask, 60) || "把图书送回原位",
          publishedAt,
        };
      })
      .filter((item): item is TeacherPictureBook => Boolean(item))
      .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
      .slice(0, 24);
  } catch {
    return [];
  }
}

export function parseHabitTemplates(raw: string | null): HabitCheckinTemplate[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): HabitCheckinTemplate | null => {
        if (!isRecord(item)) {
          return null;
        }

        const id = cleanText(item.id, 80);
        const title = cleanText(item.title, 36);
        const habitFocus = cleanText(item.habitFocus, 36);
        const publishedAt = cleanText(item.publishedAt, 40);

        if (!id || !title || !habitFocus || !publishedAt) {
          return null;
        }

        return {
          id,
          title,
          habitFocus,
          childPrompt: cleanText(item.childPrompt, 120) || `我想对老师说：我今天练习了${habitFocus}。`,
          teacherPrompt: cleanText(item.teacherPrompt, 180) || `请观察幼儿是否愿意表达${habitFocus}相关经验。`,
          storyText: cleanLongText(item.storyText, 800) || buildHabitTemplateStory(habitFocus),
          answerCards: cleanOptions(item.answerCards, [`我愿意练${habitFocus}`, "我想请老师帮忙", "我完成了一小步"]),
          habitTask: cleanText(item.habitTask, 60) || `完成一个${habitFocus}小动作`,
          publishedAt,
        };
      })
      .filter((item): item is HabitCheckinTemplate => Boolean(item))
      .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
      .slice(0, 24);
  } catch {
    return [];
  }
}

export function buildHabitTemplateStory(habitFocus: string) {
  const focus = cleanText(habitFocus, 30) || "好习惯";

  return `《${focus}小任务》开始啦。幼习宝小星来到区域里，看见小朋友正在练习${focus}。小星没有催促，只说：“我们先做一小步，再把想法告诉老师。”小朋友试了试，发现自己可以慢慢学会。故事讲完啦，请选一张答案卡，再完成一个${focus}小动作。`;
}

export function buildHabitTemplateFromFocus(habitFocus: string, childPrompt: string): HabitCheckinTemplate {
  const focus = cleanText(habitFocus, 30) || "好习惯";
  const prompt = cleanText(childPrompt, 100) || `我想对老师说：我今天练习了${focus}。`;
  const now = new Date().toISOString();

  return {
    id: `habit-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${focus}待定模板`,
    habitFocus: focus,
    childPrompt: prompt,
    teacherPrompt: `请根据幼儿关于“${focus}”的语音或文字表达，观察是否愿意说出需要、完成一小步，并给出温和鼓励。`,
    storyText: buildHabitTemplateStory(focus),
    answerCards: [`我愿意练${focus}`, "我想对老师说", "我完成了一小步"],
    habitTask: `完成一个${focus}小动作`,
    publishedAt: now,
  };
}

export function buildTeacherPictureBook(
  themeId: ThemeId,
  title: string,
  storyText: string,
): TeacherPictureBook {
  const cleanTitle = cleanText(title, 30) || (themeId === "food" ? "闽食自主绘本" : "好习惯自主绘本");
  const cleanStory = cleanLongText(storyText, 900) || "老师还没有填写故事正文。";
  const now = new Date().toISOString();

  return {
    id: `picture-book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    themeId,
    title: cleanTitle,
    storyText: cleanStory,
    question: themeId === "food" ? "听完闽食绘本，你发现了什么？" : "听完好习惯绘本，你想做哪一小步？",
    options:
      themeId === "food"
        ? ["我认识一种食物", "我看到一种食材", "我想闻一闻"]
        : ["我听到一个角色", "我愿意练一小步", "我把图书送回家"],
    habitTask: themeId === "food" ? "说出一种食物或食材" : "完成一个好习惯小动作",
    publishedAt: now,
  };
}
