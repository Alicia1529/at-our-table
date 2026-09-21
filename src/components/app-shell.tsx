"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Grape, Home, Plus, Settings, SlidersHorizontal, Utensils } from "lucide-react";
import clsx from "clsx";
import { useAppData } from "@/components/app-data-provider";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/wines", label: "Wine", icon: Grape },
  { href: "/taste", label: "Our taste", icon: SlidersHorizontal },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { space, viewer } = useAppData();
  const active = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="paper-grain min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r hairline bg-[#f2e8d9]/95 px-5 py-7 backdrop-blur lg:flex">
        <Link href="/" className="focus-ring block rounded-sm px-2">
          <span className="font-editorial text-[1.65rem] leading-none text-[var(--wine)]">At Our Table</span>
          <span className="mt-2 block text-[0.68rem] uppercase tracking-[0.16em] text-[var(--muted)]">Dinner, wine, memory</span>
        </Link>
        <Link href="/dinners/new" className="focus-ring mt-9 flex items-center justify-center gap-2 rounded-full bg-[var(--wine)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(101,28,43,.22)] hover:bg-[var(--wine-deep)]">
          <Plus size={17} /> New dinner
        </Link>
        <nav className="mt-8 space-y-1" aria-label="Main navigation">
          {nav.map((item) => <NavItem key={item.href} item={item} selected={active(item.href)} />)}
        </nav>
        <div className="mt-auto border-t hairline pt-5">
          <Link href="/settings" className={clsx("focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", active("/settings") ? "bg-white/65 font-semibold" : "text-[var(--muted)] hover:bg-white/45") }>
            <Settings size={18} /> Space settings
          </Link>
          <div className="mt-5 flex items-center gap-3 px-3">
            <div className="grid size-9 place-items-center rounded-full bg-[var(--tomato)] text-sm font-bold text-white">{viewer.name[0]?.toUpperCase()}</div>
            <div><p className="max-w-32 truncate text-sm font-semibold">{viewer.name}</p><p className="max-w-32 truncate text-xs text-[var(--muted)]">{space.name}</p></div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 pb-24 lg:col-start-2 lg:pb-0"><div className="flex items-center justify-between border-b hairline px-4 py-3 lg:hidden"><Link href="/" className="font-editorial text-xl text-[var(--wine)]">At Our Table</Link><Link href="/settings" aria-label="Space settings" className={clsx("focus-ring inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold", active("/settings") ? "bg-[var(--wine)] text-white" : "bg-white/60 text-[var(--muted)]")}><span className="grid size-6 place-items-center rounded-full bg-[var(--tomato)] text-[.68rem] text-white">{viewer.name[0]?.toUpperCase()}</span><Settings size={16} /> Settings</Link></div>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t hairline bg-[#f8f1e7]/95 px-2 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {nav.slice(0, 2).map((item) => <MobileNavItem key={item.href} item={item} selected={active(item.href)} />)}
        <Link href="/dinners/new" aria-label="New dinner" className="focus-ring mx-auto -mt-6 grid size-14 place-items-center rounded-full border-[5px] border-[#f8f1e7] bg-[var(--wine)] text-white shadow-lg"><Utensils size={21} /></Link>
        {nav.slice(2).map((item) => <MobileNavItem key={item.href} item={item} selected={active(item.href)} />)}
      </nav>
    </div>
  );
}

function NavItem({ item, selected }: { item: typeof nav[number]; selected: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href} className={clsx("focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", selected ? "bg-white/70 font-semibold text-[var(--wine)] shadow-sm" : "text-[var(--muted)] hover:bg-white/45 hover:text-[var(--ink)]")}><Icon size={18} />{item.label}</Link>;
}

function MobileNavItem({ item, selected }: { item: typeof nav[number]; selected: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href} className={clsx("focus-ring flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[.68rem]", selected ? "font-semibold text-[var(--wine)]" : "text-[var(--muted)]")}><Icon size={19} />{item.label}</Link>;
}
