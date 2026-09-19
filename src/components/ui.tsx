import clsx from "clsx";
import { Star } from "lucide-react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div>{eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[var(--tomato)]">{eyebrow}</p>}<h1 className="font-editorial text-4xl leading-[1.02] sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-[.97rem] leading-6 text-[var(--muted)]">{description}</p>}</div>
    {action}
  </header>;
}

export function Rating({ value, label }: { value: number; label?: string }) {
  return <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--wine)]"><Star size={14} fill="currentColor" />{value.toFixed(1)}{label && <span className="font-normal text-[var(--muted)]">{label}</span>}</span>;
}

export function AvatarStack({ names, limit = 4 }: { names: string[]; limit?: number }) {
  return <div className="flex items-center"><div className="flex -space-x-2">{names.slice(0, limit).map((name, index) => <span key={name} title={name} className={clsx("grid size-8 place-items-center rounded-full border-2 border-[var(--paper)] text-xs font-bold", ["bg-[#d9b08c]", "bg-[#a9b38a]", "bg-[#bb8e9b]", "bg-[#91aab5]"][index % 4])}>{name[0]}</span>)}</div>{names.length > limit && <span className="ml-2 text-xs text-[var(--muted)]">+{names.length - limit}</span>}</div>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "wine" | "olive" }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tone === "wine" && "bg-[#ecd9dc] text-[var(--wine)]", tone === "olive" && "bg-[#dfe4d2] text-[#48502f]", tone === "neutral" && "bg-black/[.055] text-[var(--muted)]")}>{children}</span>;
}
