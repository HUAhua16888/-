"use client";

import Link from "next/link";
import { useState } from "react";

import { teacherTasks, themes, type ThemeId } from "@/lib/site-data";

type TeacherResponse = {
  title: string;
  content: string;
  tips: string[];
  error?: string;
};

export function TeacherStudio() {
  const [themeId, setThemeId] = useState<ThemeId>("habit");
  const [task, setTask] = useState(teacherTasks[0].label);
  const [scenario, setScenario] = useState(
    "今天午餐前，我想给 4-5 岁幼儿讲一个关于勇敢尝试新食物的小故事。",
  );
  const [result, setResult] = useState<TeacherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function generate() {
    if (!scenario.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "teacher",
          theme: themeId,
          userInput: scenario,
          teacherTask: task,
        }),
      });

      const data = (await response.json()) as TeacherResponse;
      setResult(data);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff7dc_48%,#e5fbfa_100%)] p-8 shadow-[0_28px_90px_rgba(49,93,104,0.18)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            老师 / 家长辅助台
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-semibold text-slate-900 md:text-6xl">
            一键生成
            <span className="mt-2 block text-2xl text-slate-700 md:text-3xl">
              课堂引导、食育故事和家园共育内容
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            这里和儿童端分开，方便老师在备课、餐前提醒、家园沟通时直接拿内容去用。生成出来的文案会尽量短、温柔、适合现场口头表达。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {Object.values(themes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => setThemeId(theme.id)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                  theme.id === themeId
                    ? "bg-slate-900 text-white"
                    : "bg-white/85 text-slate-700 hover:-translate-y-0.5"
                }`}
              >
                {theme.emoji} {theme.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-700">快速入口</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">常用生成任务</h2>
            </div>
            <Link
              href="/adventure"
              className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:-translate-y-0.5"
            >
              去儿童互动页
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {teacherTasks.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTask(item.label);
                  setScenario(item.starter);
                }}
                className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                <p className="font-semibold text-slate-800">{item.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">{item.starter}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-white/90 p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-amber-700">内容生成面板</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">输入你的场景</h2>

          <div className="mt-5 flex flex-wrap gap-3">
            {teacherTasks.map((item) => (
              <button
                key={item.id}
                onClick={() => setTask(item.label)}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                  task === item.label
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:-translate-y-0.5"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            className="mt-5 min-h-48 w-full rounded-[2rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
          />

          <button
            onClick={() => void generate()}
            className="mt-5 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "正在生成..." : "开始生成"}
          </button>
        </div>

        <div className="rounded-[2.5rem] bg-[linear-gradient(180deg,#e6fbfa_0%,#ffffff_100%)] p-6 shadow-[0_24px_80px_rgba(35,88,95,0.12)]">
          <p className="text-sm font-semibold text-teal-700">生成结果</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {result?.title ?? "还没有生成内容"}
          </h2>

          <div className="mt-5 rounded-[2rem] bg-white/80 p-5">
            <p className="text-sm leading-8 text-slate-700">
              {result?.content ?? "点击左侧按钮后，这里会出现可以直接拿去课堂、家长群或餐前使用的内容。"}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {(result?.tips ?? ["建议控制在 1 分钟内说完。", "优先用鼓励式表达。", "结尾加一句家园同步。"]).map((tip) => (
              <div key={tip} className="rounded-[1.5rem] bg-white/70 px-4 py-3 text-sm text-slate-700">
                {tip}
              </div>
            ))}
          </div>

          {result?.error ? (
            <p className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
              接口提醒：{result.error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
