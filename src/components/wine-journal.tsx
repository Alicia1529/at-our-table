"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Grape, Search, Wine } from "lucide-react";
import { useAppData } from "@/components/app-data-provider";
import { Pill, Rating } from "@/components/ui";

const swatches = { red: "#651c2b", white: "#d7b25f", orange: "#c4662d", rosé: "#c97d87", sparkling: "#809168" };

export function WineJournal() {
  const [query, setQuery] = useState("");
  const [color, setColor] = useState("all");
  const { wines, wineExperiences } = useAppData();
  const visible = useMemo(() => wines.filter((wine) => (color === "all" || wine.color === color) && `${wine.producer} ${wine.cuvee} ${wine.region}`.toLowerCase().includes(query.toLowerCase())), [query, color, wines]);
  return <><div className="mt-7 flex items-center gap-3"><label className="relative max-w-lg flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Producer, cuvée, or region" className="field-input pl-10" /></label><select value={color} onChange={(event) => setColor(event.target.value)} aria-label="Filter by wine color" className="focus-ring hidden rounded-full border hairline bg-white/50 px-4 py-3 text-sm font-semibold sm:block"><option value="all">All bottles</option><option value="red">Red</option><option value="white">White</option><option value="orange">Orange</option><option value="rosé">Rosé</option><option value="sparkling">Sparkling</option></select></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((wine) => { const ratings = wineExperiences.filter((experience) => experience.wineId === wine.id && experience.rating > 0).map((experience) => experience.rating); const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0; return <Link key={wine.id} href={`/wines/${wine.id}`} className="lift focus-ring group relative overflow-hidden rounded-2xl border hairline bg-white/55 p-5"><div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: swatches[wine.color] }} /><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-full bg-[#efe2d0]"><Wine size={20} style={{ color: swatches[wine.color] }} /></span><ArrowUpRight size={18} className="text-[var(--muted)] group-hover:text-[var(--wine)]" /></div><p className="mt-7 text-xs font-bold uppercase tracking-[.15em] text-[var(--muted)]">{wine.region} · {wine.vintage}</p><h2 className="font-editorial mt-2 text-3xl leading-tight group-hover:text-[var(--wine)]">{wine.producer}</h2><p className="mt-1 text-sm text-[var(--muted)]">{wine.cuvee}</p><div className="mt-6 flex items-end justify-between border-t hairline pt-4"><div>{ratings.length ? <Rating value={average} /> : <span className="text-sm font-semibold text-[var(--muted)]">Not rated yet</span>}<p className="mt-1 text-xs text-[var(--muted)]">Across {wine.bottlesOpened} dinners</p></div><Pill tone="olive">{wine.color}</Pill></div></Link>; })}</div>
    {visible.length === 0 && <div className="mt-8 rounded-2xl border border-dashed hairline p-12 text-center"><Grape className="mx-auto text-[var(--muted)]" /><p className="font-editorial mt-3 text-2xl">No bottles found.</p><p className="mt-1 text-sm text-[var(--muted)]">Try a broader search.</p></div>}</>;
}
