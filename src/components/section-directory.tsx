export type SectionDirectoryItem = {
  label: string;
  description: string;
  href: string;
  icon: string;
  tone?: string;
};

type SectionDirectoryProps = {
  eyebrow: string;
  title: string;
  items: SectionDirectoryItem[];
  className?: string;
  variant?: "grid" | "sidebar";
  onItemClick?: (item: SectionDirectoryItem) => void;
  activeHref?: string;
};

export function SectionDirectory({
  eyebrow,
  title,
  items,
  className = "",
  variant = "grid",
  onItemClick,
  activeHref,
}: SectionDirectoryProps) {
  const listClassName =
    variant === "sidebar"
      ? "mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1"
      : "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4";
  const itemClassName =
    variant === "sidebar"
      ? "flex min-h-[74px] items-start gap-2 rounded-[1.1rem] px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5"
      : "flex min-h-20 items-start gap-3 rounded-[1.2rem] px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5";

  return (
    <nav
      aria-label={title}
      className={`rounded-[1.7rem] border border-white/70 bg-white/88 p-4 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-teal-700">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
        </div>
      </div>
      <div className={listClassName}>
        {items.map((item) => {
          const isActive = activeHref === item.href;
          const content = (
            <>
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-white/86 text-xl shadow-sm"
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 opacity-75">{item.description}</span>
              </span>
            </>
          );
          const itemTone = `${itemClassName} ${item.tone ?? "bg-slate-50 text-slate-800"} ${
            isActive ? "ring-2 ring-slate-900/70" : ""
          }`;

          return onItemClick ? (
            <button
              key={`${item.href}-${item.label}`}
              onClick={() => onItemClick(item)}
              className={itemTone}
              type="button"
              aria-pressed={isActive}
            >
              {content}
            </button>
          ) : (
            <a
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={itemTone}
              aria-current={isActive ? "true" : undefined}
            >
              {content}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
