"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, MapPin, Search } from "lucide-react";
import clsx from "clsx";
import { useAppData } from "@/components/app-data-provider";
import { AvatarStack, Pill } from "@/components/ui";

export function JournalFeed() {
  const [filter, setFilter] = useState<"all" | "home" | "restaurant">("all");
  const [query, setQuery] = useState("");
  const { dinners } = useAppData();
  const visible = dinners.filter((dinner) => (filter === "all" || dinner.locationType === filter) && `${dinner.title} ${dinner.venue} ${dinner.summary}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2">{(["all", "home", "restaurant"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={clsx("focus-ring rounded-full px-4 py-2 text-sm font-semibold capitalize", filter === item ? "bg-[var(--wine)] text-white" : "border hairline bg-white/45 text-[var(--muted)]")}>{item}</button>)}</div><label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories" className="field-input pl-9 sm:w-64" /></label></div>
    <div className="mt-8 space-y-5">{visible.map((dinner, index) => <article key={dinner.id} className="lift overflow-hidden rounded-2xl border hairline bg-white/55 md:grid md:grid-cols-[260px_1fr]"><Link href={`/dinners/${dinner.id}`} className="relative block min-h-56 overflow-hidden"><Image src={dinner.coverImage} alt="Candlelit dinner memory" fill className={clsx("object-cover", index === 1 && "scale-110 object-right")} sizes="260px" /><div className="absolute inset-0 bg-black/10" /><span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur"><Camera size={13} /> {dinner.photoCount}</span></Link><div className="flex flex-col p-5 sm:p-7"><div className="flex items-center justify-between"><Pill>{dinner.locationType === "home" ? "At home" : "Restaurant"}</Pill><time className="text-xs font-semibold text-[var(--muted)]">{new Date(dinner.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></div><Link href={`/dinners/${dinner.id}`}><h2 className="font-editorial mt-4 text-3xl hover:text-[var(--wine)] sm:text-4xl">{dinner.title}</h2></Link><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{dinner.summary || "A new dinner waiting to be remembered."}</p><div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6"><div><span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"><MapPin size={14} /> {dinner.venue}</span><p className="mt-2 text-xs font-medium text-[var(--muted)]">{dinner.courses.length} courses · {dinner.wineExperienceIds.length} wines</p></div><AvatarStack names={dinner.guests} /></div></div></article>)}{visible.length === 0 && <div className="rounded-2xl border border-dashed hairline p-10 text-center text-sm text-[var(--muted)]">No dinners match that search.</div>}</div></>;
}
