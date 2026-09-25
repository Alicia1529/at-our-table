"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Edit3, LockKeyhole, MapPin, Save, Wine, X } from "lucide-react";
import { CourseOrderControls, SortableCourseList } from "@/components/sortable-course-list";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatDinnerDateTime } from "@/lib/date-format";
import type { Dinner } from "@/lib/types";

type SharedWine = {
  id: string; producer: string; cuvee: string; vintage: number; region: string; country: string;
  grapes: string[]; color: string; description: string; pairing_note?: string;
};
type SharedCourse = { id: string; position: number; title: string; description: string; wines: SharedWine[] };
type SharedPayload = { title: string; venue_name: string; scheduled_at: string; summary: string; can_edit_menu: boolean; courses: SharedCourse[]; wines: SharedWine[] };

export function SharedDinner({ token }: { token: string }) {
  const [dinner, setDinner] = useState<SharedPayload | null>(null);
  const [draft, setDraft] = useState<SharedCourse[]>([]);
  const [selectedWine, setSelectedWine] = useState<SharedWine | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { const load = async () => {
    if (isSupabaseConfigured()) {
      const { data, error } = await createClient().rpc("get_shared_dinner", { raw_token: token });
      if (!error && data) { const payload = data as SharedPayload; setDinner(payload); setDraft(payload.courses); }
    } else {
      const stored = JSON.parse(window.localStorage.getItem("at-our-table-shares-v1") ?? "{}") as Record<string, Dinner>;
      const local = stored[token];
      if (local) { const payload: SharedPayload = { title: local.title, venue_name: local.venue, scheduled_at: local.date, summary: local.summary, can_edit_menu: true, courses: local.courses.map((course) => ({ ...course, wines: [] })), wines: [] }; setDinner(payload); setDraft(payload.courses); }
    }
    setLoading(false);
  }; void load(); }, [token]);

  const saveMenu = async (courses: SharedCourse[]) => {
    if (!dinner) return;
    setSaving(true); setMessage("");
    const normalized = courses.map((course, index) => ({ ...course, position: index + 1 }));
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await createClient().rpc("update_shared_dinner_menu", { raw_token: token, menu_courses: normalized.map(({ id, title, description }) => ({ id, title, description })) });
        if (error) throw error;
        const payload = data as SharedPayload; setDinner(payload); setDraft(payload.courses);
      } else {
        const stored = JSON.parse(window.localStorage.getItem("at-our-table-shares-v1") ?? "{}") as Record<string, Dinner>;
        const local = stored[token]; if (!local) throw new Error("This link is no longer available.");
        stored[token] = { ...local, courses: normalized.map(({ id, title, description, position }) => ({ id, title, description, position })) };
        window.localStorage.setItem("at-our-table-shares-v1", JSON.stringify(stored));
        setDinner({ ...dinner, courses: normalized }); setDraft(normalized);
      }
      setMessage("Menu changes saved.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not save the menu."); throw cause; }
    finally { setSaving(false); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Opening the shared menu…</div>;
  if (!dinner) return <main className="grid min-h-screen place-items-center px-5 text-center"><div><LockKeyhole className="mx-auto text-[var(--wine)]" /><h1 className="font-editorial mt-4 text-4xl">This link is no longer available.</h1><p className="mt-2 text-sm text-[var(--muted)]">It may have expired or been revoked.</p></div></main>;

  const startEditing = () => { setDraft(dinner.courses); setEditing(true); setMessage(""); };
  return <main className="paper-grain min-h-screen bg-[var(--paper)]">
    <header className="border-b hairline px-5 py-4"><div className="mx-auto flex max-w-4xl items-center justify-between gap-3"><span className="font-editorial text-xl text-[var(--wine)]">At Our Table</span><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Edit3 size={13} /> Menu edit link</span></div></header>
    <article className="mx-auto max-w-4xl px-5 py-10 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--tomato)]">Shared from our table</p><h1 className="font-editorial mt-3 text-5xl leading-[.95] sm:text-6xl">{dinner.title}</h1></div>{!editing ? <button type="button" onClick={startEditing} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--wine)] px-4 py-2.5 text-sm font-bold text-white"><Edit3 size={16} /> Edit menu</button> : <div className="flex gap-2"><button type="button" onClick={() => { setDraft(dinner.courses); setEditing(false); }} className="focus-ring inline-flex items-center gap-2 rounded-full border hairline bg-white/60 px-4 py-2.5 text-sm font-bold"><X size={16} /> Cancel</button><button type="button" disabled={saving} onClick={() => void saveMenu(draft).then(() => setEditing(false)).catch(() => undefined)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--wine)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save size={16} /> {saving ? "Saving…" : "Save menu"}</button></div>}</div>
      <div className="mt-5 flex flex-wrap gap-5 text-sm text-[var(--muted)]"><span className="inline-flex items-center gap-2"><MapPin size={16} />{dinner.venue_name}</span><time dateTime={dinner.scheduled_at}>{formatDinnerDateTime(dinner.scheduled_at, "long")}</time><span className="inline-flex items-center gap-2"><Camera size={16} />Private photos hidden</span><span className="inline-flex items-center gap-2"><Wine size={16} />{dinner.wines.length} wines</span></div>
      <blockquote className="font-editorial mt-10 border-l-2 border-[var(--tomato)] pl-6 text-3xl leading-tight">“{dinner.summary || "A dinner worth remembering."}”</blockquote>
      {message && <p role="status" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#e5ead8] px-4 py-2 text-xs font-bold text-[#48502f]"><Check size={14} />{message}</p>}
      {editing ? <SortableCourseList items={draft} onReorder={async (ids) => { const order = new Map(ids.map((id, index) => [id, index])); const next = [...draft].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)); setDraft(next); await saveMenu(next); }} className="mt-10 space-y-3" renderItem={(course, index, controls) => <div className="rounded-xl border hairline bg-white/55 p-4"><div className="flex items-start gap-2"><CourseOrderControls controls={controls} label={course.title} /><span className="font-editorial pt-1 text-2xl text-[#ac988d]">{index + 1}</span><div className="min-w-0 flex-1 space-y-2"><input aria-label={`Course ${index + 1} name`} value={course.title} onChange={(event) => setDraft((current) => current.map((item) => item.id === course.id ? { ...item, title: event.target.value } : item))} className="field-input font-editorial text-xl" /><textarea aria-label={`Course ${index + 1} description`} value={course.description ?? ""} onChange={(event) => setDraft((current) => current.map((item) => item.id === course.id ? { ...item, description: event.target.value } : item))} rows={2} className="field-input resize-y text-sm" placeholder="Course details" /></div></div></div>} /> : <section className="mt-10 space-y-3">{dinner.courses.map((course, index) => <div key={course.id} className="rounded-xl border hairline bg-white/45 p-4"><div className="flex gap-4"><span className="font-editorial text-2xl text-[#ac988d]">{index + 1}</span><div className="min-w-0 flex-1"><h2 className="font-editorial text-xl">{course.title}</h2>{course.description && <p className="mt-1 text-sm text-[var(--muted)]">{course.description}</p>}</div></div>{course.wines.length > 0 && <div className="mt-4 grid gap-2 border-t hairline pt-4">{course.wines.map((wine) => <button type="button" key={wine.id} onClick={() => setSelectedWine(wine)} className="focus-ring flex w-full items-start gap-3 rounded-xl bg-[#efe4d4] p-3 text-left hover:bg-[#e7d7c1]"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--wine)] text-white"><Wine size={17} /></span><span className="min-w-0"><strong className="block text-sm text-[var(--wine)]">{wine.producer} · {wine.vintage}</strong><span className="block text-sm text-[var(--muted)]">{wine.cuvee}</span><span className="mt-1 block text-xs font-semibold text-[var(--olive)]">{wine.grapes.join(", ") || "Grapes not noted"}</span>{wine.pairing_note && <span className="mt-2 block text-xs italic leading-5">“{wine.pairing_note}”</span>}</span></button>)}</div>}</div>)}</section>}
      <p className="mt-12 text-center text-xs leading-5 text-[var(--muted)]">Anyone with this private link can edit this menu and view its public wine profiles. Photos, notes, ratings, guests, and other dinner events stay private. The owner can revoke the link at any time.</p>
    </article>
    {selectedWine && <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center sm:p-5" onClick={() => setSelectedWine(null)}><section role="dialog" aria-modal="true" aria-label={`${selectedWine.producer} wine details`} onClick={(event) => event.stopPropagation()} className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-[var(--paper)] p-6 sm:rounded-3xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--tomato)]">{selectedWine.region}{selectedWine.country ? ` · ${selectedWine.country}` : ""}</p><h2 className="font-editorial mt-2 text-4xl leading-tight">{selectedWine.producer}</h2><p className="mt-1 text-[var(--muted)]">{selectedWine.cuvee} · {selectedWine.vintage}</p></div><button type="button" onClick={() => setSelectedWine(null)} aria-label="Close wine details" className="focus-ring rounded-full p-2"><X size={20} /></button></div><dl className="mt-7 grid gap-4 rounded-2xl bg-[#efe4d4] p-5"><div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Grape varieties</dt><dd className="mt-1 font-semibold">{selectedWine.grapes.join(", ") || "Not noted"}</dd></div>{selectedWine.color && <div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Style</dt><dd className="mt-1 capitalize">{selectedWine.color}</dd></div>}{selectedWine.description && <div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">About this wine</dt><dd className="mt-1 text-sm leading-6">{selectedWine.description}</dd></div>}</dl></section></div>}
  </main>;
}
