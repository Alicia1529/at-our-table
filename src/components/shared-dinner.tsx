"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Edit3, LoaderCircle, LockKeyhole, MapPin, Plus, Save, Wine, X } from "lucide-react";
import { CourseOrderControls, SortableCourseList } from "@/components/sortable-course-list";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatDinnerDateTime } from "@/lib/date-format";
import type { Dinner } from "@/lib/types";
import { identifyWinePhotos, type WinePhotoIdentification } from "@/lib/wine-photo-identification";

type SharedWine = {
  id: string; producer: string; cuvee: string; vintage: number | null; region: string; country: string;
  grapes: string[]; color: string; description: string; tasting_notes?: string; pairing_note?: string;
};
type SharedCourse = { id: string; position: number; title: string; description: string; wines: SharedWine[] };
type SharedPayload = {
  title: string; venue_name: string; scheduled_at: string; summary: string; can_edit_menu: boolean;
  courses: SharedCourse[]; wines: SharedWine[]; available_wines: SharedWine[];
};
type PairMode = "saved" | "manual";

export function SharedDinner({ token }: { token: string }) {
  const [dinner, setDinner] = useState<SharedPayload | null>(null);
  const [draft, setDraft] = useState<SharedCourse[]>([]);
  const [selectedWine, setSelectedWine] = useState<SharedWine | null>(null);
  const [pairingCourseId, setPairingCourseId] = useState<string | null>(null);
  const [pairMode, setPairMode] = useState<PairMode>("saved");
  const [tab, setTab] = useState<"table" | "wines">("table");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [wineMessage, setWineMessage] = useState("");
  const [scanPending, setScanPending] = useState(false);
  const [recognition, setRecognition] = useState<WinePhotoIdentification | null>(null);
  const [scannedLabel, setScannedLabel] = useState<File>();

  useEffect(() => {
    const load = async () => {
      if (isSupabaseConfigured()) {
        const { data, error } = await createClient().rpc("get_shared_dinner", { raw_token: token });
        if (!error && data) {
          const payload = normalizePayload(data as SharedPayload);
          setDinner(payload); setDraft(payload.courses);
        }
      } else {
        const stored = JSON.parse(window.localStorage.getItem("at-our-table-shares-v1") ?? "{}") as Record<string, Dinner>;
        const local = stored[token];
        if (local) {
          const payload: SharedPayload = {
            title: local.title, venue_name: local.venue, scheduled_at: local.date, summary: local.summary,
            can_edit_menu: true, courses: local.courses.map((course) => ({ ...course, wines: [] })),
            wines: [], available_wines: [],
          };
          setDinner(payload); setDraft(payload.courses);
        }
      }
      setLoading(false);
    };
    void load();
  }, [token]);

  const saveMenu = async (courses: SharedCourse[]) => {
    if (!dinner) return;
    setSaving(true); setMessage("");
    const normalized = courses.map((course, index) => ({ ...course, position: index + 1 }));
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await createClient().rpc("update_shared_dinner_menu", {
          raw_token: token,
          menu_courses: normalized.map(({ id, title, description }) => ({ id, title, description })),
        });
        if (error) throw error;
        const payload = normalizePayload(data as SharedPayload);
        setDinner(payload); setDraft(payload.courses);
      } else {
        const stored = JSON.parse(window.localStorage.getItem("at-our-table-shares-v1") ?? "{}") as Record<string, Dinner>;
        const local = stored[token];
        if (!local) throw new Error("This link is no longer available.");
        stored[token] = { ...local, courses: normalized.map(({ id, title, description, position }) => ({ id, title, description, position })) };
        window.localStorage.setItem("at-our-table-shares-v1", JSON.stringify(stored));
        setDinner({ ...dinner, courses: normalized }); setDraft(normalized);
      }
      setMessage("Menu changes saved.");
    } catch (cause) {
      setMessage(errorText(cause, "Could not save the menu.")); throw cause;
    } finally { setSaving(false); }
  };

  const openPairing = (courseId: string) => {
    setPairingCourseId(courseId);
    setPairMode(dinner?.available_wines.length ? "saved" : "manual");
    setWineMessage("");
    setRecognition(null);
    setScannedLabel(undefined);
  };

  const closePairing = () => {
    setPairingCourseId(null);
    setRecognition(null);
    setScannedLabel(undefined);
    setWineMessage("");
  };

  const scanWine = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (files.length > 2) {
      setWineMessage("Choose up to two photos: the front label, or the front and back labels.");
      event.target.value = "";
      return;
    }
    setScanPending(true);
    setWineMessage("");
    try {
      const result = await identifyWinePhotos(files);
      setRecognition(result);
      setScannedLabel(files[0]);
      setPairMode("manual");
    } catch (cause) {
      setWineMessage(errorText(cause, "Could not read this wine label."));
    } finally {
      setScanPending(false);
      event.target.value = "";
    }
  };

  const addWine = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dinner || pairingCourseId === null) return;
    setSaving(true); setWineMessage("");
    const form = new FormData(event.currentTarget);
    const wineProfile = pairMode === "manual" ? {
      producer: String(form.get("producer") ?? "").trim(), cuvee: String(form.get("cuvee") ?? "").trim(),
      vintage: String(form.get("vintage") ?? "").trim(), color: String(form.get("color") ?? "red"),
      region: String(form.get("region") ?? "").trim(), country: String(form.get("country") ?? "").trim(),
      grapes: String(form.get("grapes") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      description: String(form.get("description") ?? "").trim(), tasting_notes: String(form.get("tasting_notes") ?? "").trim(),
    } : null;
    try {
      if (!isSupabaseConfigured()) throw new Error("Wine collaboration is available when the app is connected to Supabase.");
      const supabase = createClient();
      let labelPhotoPath: string | undefined;
      if (pairMode === "manual" && scannedLabel) {
        const { data: prefix, error: prefixError } = await supabase.rpc("get_shared_wine_label_upload_prefix", { raw_token: token });
        if (prefixError || !prefix) throw prefixError ?? new Error("This shared link can no longer upload wine labels.");
        labelPhotoPath = `${prefix}/${crypto.randomUUID()}-${safeFileName(scannedLabel.name)}`;
        const { error: uploadError } = await supabase.storage.from("dinner-media").upload(labelPhotoPath, scannedLabel, {
          contentType: scannedLabel.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { data, error } = await supabase.rpc("add_shared_dinner_wine", {
        raw_token: token, target_course_id: String(form.get("courseId") ?? "") || null,
        existing_wine_id: pairMode === "saved" ? String(form.get("wineId")) : null,
        wine_profile: wineProfile ? { ...wineProfile, label_photo_path: labelPhotoPath } : null, serving_note: String(form.get("servingNote") ?? ""),
        pairing_note: String(form.get("pairingNote") ?? ""),
      });
      if (error) throw error;
      const payload = normalizePayload(data as SharedPayload);
      setDinner(payload); setDraft(payload.courses); closePairing();
      setMessage("Wine added to this dinner.");
    } catch (cause) { setWineMessage(errorText(cause, "Could not add this wine.")); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-[var(--muted)]">Opening the shared dinner…</div>;
  if (!dinner) return <main className="grid min-h-screen place-items-center px-5 text-center"><div><LockKeyhole className="mx-auto text-[var(--wine)]" /><h1 className="font-editorial mt-4 text-4xl">This link is no longer available.</h1><p className="mt-2 text-sm text-[var(--muted)]">It may have expired or been revoked.</p></div></main>;

  const startEditing = () => { setDraft(dinner.courses); setEditing(true); setTab("table"); setMessage(""); };
  return <main className="paper-grain min-h-screen bg-[var(--paper)]">
    <header className="border-b hairline px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><span className="font-editorial text-xl text-[var(--wine)]">At Our Table</span><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Edit3 size={13} /> Collaborative dinner link</span></div></header>
    <article className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--tomato)]">Shared from our table</p><h1 className="font-editorial mt-3 text-5xl leading-[.95] sm:text-6xl">{dinner.title}</h1></div>{tab === "table" && (!editing ? <button type="button" onClick={startEditing} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--wine)] px-4 py-2.5 text-sm font-bold text-white"><Edit3 size={16} /> Edit menu</button> : <div className="flex gap-2"><button type="button" onClick={() => { setDraft(dinner.courses); setEditing(false); }} className="focus-ring inline-flex items-center gap-2 rounded-full border hairline bg-white/60 px-4 py-2.5 text-sm font-bold"><X size={16} /> Cancel</button><button type="button" disabled={saving} onClick={() => void saveMenu(draft).then(() => setEditing(false)).catch(() => undefined)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--wine)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save size={16} /> {saving ? "Saving…" : "Save menu"}</button></div>)}</div>
      <div className="mt-5 flex flex-wrap gap-5 text-sm text-[var(--muted)]"><span className="inline-flex items-center gap-2"><MapPin size={16} />{dinner.venue_name}</span><time dateTime={dinner.scheduled_at}>{formatDinnerDateTime(dinner.scheduled_at, "long")}</time><span className="inline-flex items-center gap-2"><Camera size={16} />Private photos hidden</span><span className="inline-flex items-center gap-2"><Wine size={16} />{dinner.wines.length} wines</span></div>
      <nav className="mt-10 flex gap-7 border-b hairline" aria-label="Shared dinner sections"><button type="button" onClick={() => setTab("table")} className={`focus-ring border-b-2 px-1 pb-3 text-sm font-bold ${tab === "table" ? "border-[var(--wine)] text-[var(--wine)]" : "border-transparent text-[var(--muted)]"}`}>At the table</button><button type="button" onClick={() => { setTab("wines"); setEditing(false); }} className={`focus-ring border-b-2 px-1 pb-3 text-sm font-bold ${tab === "wines" ? "border-[var(--wine)] text-[var(--wine)]" : "border-transparent text-[var(--muted)]"}`}>Wines <span className="ml-1 rounded-full bg-[#efe4d4] px-2 py-0.5 text-xs">{dinner.wines.length}</span></button></nav>
      {message && <p role="status" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#e5ead8] px-4 py-2 text-xs font-bold text-[#48502f]"><Check size={14} />{message}</p>}

      {tab === "table" && (editing ? <SortableCourseList items={draft} onReorder={async (ids) => { const order = new Map(ids.map((id, index) => [id, index])); const next = [...draft].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)); setDraft(next); await saveMenu(next); }} className="mt-8 space-y-3" renderItem={(course, index, controls) => <div className="rounded-2xl border hairline bg-white/55 p-4 sm:p-6"><div className="flex items-start gap-2"><CourseOrderControls controls={controls} label={course.title} /><span className="font-editorial pt-1 text-2xl text-[#ac988d]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1 space-y-2"><input aria-label={`Course ${index + 1} name`} value={course.title} onChange={(event) => setDraft((current) => current.map((item) => item.id === course.id ? { ...item, title: event.target.value } : item))} className="field-input font-editorial text-xl" /><textarea aria-label={`Course ${index + 1} description`} value={course.description ?? ""} onChange={(event) => setDraft((current) => current.map((item) => item.id === course.id ? { ...item, description: event.target.value } : item))} rows={2} className="field-input resize-y text-sm" placeholder="Course details" /></div></div></div>} /> : <section className="mt-8 space-y-4">{dinner.courses.map((course, index) => <article key={course.id} className="rounded-2xl border hairline bg-white/55 p-5 sm:p-6"><div className="flex gap-4"><span className="font-editorial text-3xl text-[#ac988d]">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h2 className="font-editorial text-2xl sm:text-3xl">{course.title}</h2>{course.description && <p className="mt-1 text-sm text-[var(--muted)]">{course.description}</p>}
        {course.wines.length > 0 && <div className="mt-5 grid gap-3">{course.wines.map((wine) => <WineProfileButton key={wine.id} wine={wine} onClick={() => setSelectedWine(wine)} />)}</div>}
        <button type="button" onClick={() => openPairing(course.id)} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full border hairline bg-white/55 px-4 py-2 text-sm font-bold text-[var(--wine)]"><Plus size={16} /> {course.wines.length ? "Pair another wine" : "Pair a wine"}</button>
      </div></div></article>)}</section>)}

      {tab === "wines" && <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--tomato)]">Wine list</p><h2 className="font-editorial mt-1 text-3xl">Bottles at this dinner</h2><p className="mt-2 text-sm text-[var(--muted)]">Profiles are shared; tasting scores and event history stay private.</p></div><button type="button" onClick={() => openPairing("")} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--wine)] px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Add a bottle</button></div>{dinner.wines.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{dinner.wines.map((wine) => <WineProfileButton key={wine.id} wine={wine} onClick={() => setSelectedWine(wine)} />)}</div> : <div className="mt-6 rounded-2xl border border-dashed hairline bg-white/35 p-10 text-center"><Wine size={32} className="mx-auto text-[var(--wine)]" /><h3 className="font-editorial mt-3 text-2xl">No bottles yet</h3><p className="mt-2 text-sm text-[var(--muted)]">Add the first bottle, with or without a course pairing.</p></div>}</section>}

      <p className="mt-12 text-center text-xs leading-5 text-[var(--muted)]">Anyone with this private link can edit the menu, add wines, and view public wine profiles. Photos, notes, ratings, guests, and wine event history stay private. The owner can revoke the link at any time.</p>
    </article>

    {pairingCourseId !== null && <PairWineDialog courses={dinner.courses} availableWines={dinner.available_wines} selectedCourseId={pairingCourseId} pairMode={pairMode} onPairMode={setPairMode} onClose={closePairing} onSubmit={addWine} onScan={scanWine} scanPending={scanPending} recognition={recognition} scannedLabel={scannedLabel} saving={saving} message={wineMessage} />}
    {selectedWine && <WineProfileDialog wine={selectedWine} onClose={() => setSelectedWine(null)} />}
  </main>;
}

function PairWineDialog({ courses, availableWines, selectedCourseId, pairMode, onPairMode, onClose, onSubmit, onScan, scanPending, recognition, scannedLabel, saving, message }: {
  courses: SharedCourse[]; availableWines: SharedWine[]; selectedCourseId: string; pairMode: PairMode;
  onPairMode: (mode: PairMode) => void; onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onScan: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  scanPending: boolean; recognition: WinePhotoIdentification | null; scannedLabel?: File; saving: boolean; message: string;
}) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center sm:p-5"><form onSubmit={(event) => void onSubmit(event)} role="dialog" aria-modal="true" aria-labelledby="pair-wine-title" className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-[var(--paper)] p-6 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--tomato)]">Shared dinner</p><h2 id="pair-wine-title" className="font-editorial mt-1 text-3xl">Pair a wine</h2></div><button type="button" onClick={onClose} aria-label="Close" className="focus-ring rounded-full p-2"><X size={19} /></button></div>
    <label className="mt-6 block"><span className="text-sm font-bold">Course pairing</span><select name="courseId" defaultValue={selectedCourseId} className="field-input mt-2"><option value="">Enjoyed on its own</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
    <div className="mt-5 grid grid-cols-2 rounded-full bg-[#eadfce] p-1"><button type="button" disabled={!availableWines.length} onClick={() => onPairMode("saved")} className={`focus-ring rounded-full px-3 py-2 text-sm font-bold disabled:opacity-45 ${pairMode === "saved" ? "bg-white text-[var(--wine)] shadow-sm" : "text-[var(--muted)]"}`}>Choose saved wine</button><button type="button" onClick={() => onPairMode("manual")} className={`focus-ring rounded-full px-3 py-2 text-sm font-bold ${pairMode === "manual" ? "bg-white text-[var(--wine)] shadow-sm" : "text-[var(--muted)]"}`}>Add new wine</button></div>
    {pairMode === "saved" ? <label className="mt-5 block"><span className="text-sm font-bold">Wine</span><select name="wineId" required className="field-input mt-2">{availableWines.map((wine) => <option key={wine.id} value={wine.id}>{wine.producer} · {wine.cuvee || "Untitled cuvée"}{wine.vintage ? ` · ${wine.vintage}` : ""}</option>)}</select></label> : <div className="mt-5"><label className="focus-ring flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#b89580] bg-[#f1dfbb]/60 px-4 py-4 text-sm font-bold text-[var(--wine)]"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void onScan(event)} className="sr-only" />{scanPending ? <LoaderCircle size={18} className="animate-spin" /> : <Camera size={18} />}{scanPending ? "Reading label…" : "Choose 1–2 label photos"}</label><p className="mt-2 text-center text-xs text-[var(--muted)]">Choose photos from your phone; the clearest front label becomes the saved wine image.</p>{recognition && <div className="mt-4 rounded-2xl border border-[#b8c59b] bg-[#edf0df] p-4"><p className="flex items-center gap-2 text-sm font-bold text-[var(--olive)]"><Check size={16} /> Label read with {Math.round(recognition.confidence * 100)}% confidence</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Review before saving. Recognized: {recognition.evidence.slice(0, 4).join(" · ") || "label details"}</p>{scannedLabel && <p className="mt-1 text-xs text-[var(--muted)]">{scannedLabel.name} will be saved with this wine.</p>}</div>}<div key={recognition ? `${recognition.producer}-${recognition.vintage}-${recognition.confidence}` : "manual"} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-sm font-bold">Producer</span><input name="producer" required defaultValue={recognition?.producer} className="field-input mt-2" placeholder="Domaine Tempier" /></label><label className="sm:col-span-2"><span className="text-sm font-bold">Cuvée</span><input name="cuvee" defaultValue={recognition?.cuvee} className="field-input mt-2" placeholder="Bandol Rouge" /></label><label><span className="text-sm font-bold">Vintage</span><input name="vintage" type="number" min="1800" max="2200" defaultValue={recognition?.vintage || ""} className="field-input mt-2" /></label><label><span className="text-sm font-bold">Color</span><select name="color" defaultValue={recognition?.color === "unknown" ? "red" : recognition?.color || "red"} className="field-input mt-2"><option value="red">Red</option><option value="white">White</option><option value="orange">Orange</option><option value="rose">Rosé</option><option value="sparkling">Sparkling</option><option value="fortified">Fortified</option></select></label><label><span className="text-sm font-bold">Region</span><input name="region" defaultValue={recognition?.region} className="field-input mt-2" /></label><label><span className="text-sm font-bold">Country</span><input name="country" defaultValue={recognition?.country} className="field-input mt-2" /></label><label className="sm:col-span-2"><span className="text-sm font-bold">Grape varieties</span><input name="grapes" defaultValue={recognition?.grapes.join(", ")} className="field-input mt-2" placeholder="Chardonnay, Pinot Noir" /></label><label className="sm:col-span-2"><span className="text-sm font-bold">Introduction</span><textarea name="description" defaultValue={recognition?.description} rows={3} className="field-input mt-2 resize-y" placeholder="The story and style of this bottle." /></label><label className="sm:col-span-2"><span className="text-sm font-bold">Tasting notes</span><textarea name="tasting_notes" defaultValue={recognition?.tastingNotes} rows={3} className="field-input mt-2 resize-y" placeholder="Fruit, texture, aromas, finish…" /></label></div></div>}
    <div className="mt-5 grid gap-4"><label><span className="text-sm font-bold">Serving note <span className="font-normal text-[var(--muted)]">(private to this dinner)</span></span><input name="servingNote" className="field-input mt-2" placeholder="Decanted 45 minutes" /></label><label><span className="text-sm font-bold">Why it works</span><textarea name="pairingNote" rows={3} className="field-input mt-2 resize-y" placeholder="What makes this pairing sing?" /></label></div>
    {message && <p role="alert" className="mt-4 rounded-xl border border-[#e8b5a8] bg-[#fff0eb] p-3 text-sm font-semibold text-[var(--tomato)]">{message}</p>}
    <button disabled={saving || (pairMode === "saved" && !availableWines.length)} className="focus-ring mt-6 w-full rounded-full bg-[var(--wine)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Adding…" : "Add wine to dinner"}</button>
  </form></div>;
}

function WineProfileButton({ wine, onClick }: { wine: SharedWine; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="focus-ring flex w-full items-start gap-3 rounded-xl bg-[#efe4d4] p-4 text-left hover:bg-[#e7d7c1]"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--wine)] text-white"><Wine size={17} /></span><span className="min-w-0"><strong className="block text-sm text-[var(--wine)]">{wine.producer}{wine.vintage ? ` · ${wine.vintage}` : ""}</strong><span className="block text-sm text-[var(--muted)]">{wine.cuvee}</span><span className="mt-1 block text-xs font-semibold text-[var(--olive)]">{wine.grapes?.join(", ") || "Grapes not noted"}</span>{wine.pairing_note && <span className="mt-2 block text-xs italic leading-5">“{wine.pairing_note}”</span>}<span className="mt-2 block text-xs font-bold text-[var(--wine)]">View wine details →</span></span></button>;
}

function WineProfileDialog({ wine, onClose }: { wine: SharedWine; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center sm:p-5" onClick={onClose}><section role="dialog" aria-modal="true" aria-label={`${wine.producer} wine details`} onClick={(event) => event.stopPropagation()} className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-t-3xl bg-[var(--paper)] p-6 sm:rounded-3xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--tomato)]">{wine.region}{wine.country ? ` · ${wine.country}` : ""}</p><h2 className="font-editorial mt-2 text-4xl leading-tight">{wine.producer}</h2><p className="mt-1 text-[var(--muted)]">{wine.cuvee}{wine.vintage ? ` · ${wine.vintage}` : ""}</p></div><button type="button" onClick={onClose} aria-label="Close wine details" className="focus-ring rounded-full p-2"><X size={20} /></button></div><dl className="mt-7 grid gap-4 rounded-2xl bg-[#efe4d4] p-5"><div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Grape varieties</dt><dd className="mt-1 font-semibold">{wine.grapes?.join(", ") || "Not noted"}</dd></div>{wine.color && <div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Style</dt><dd className="mt-1 capitalize">{wine.color}</dd></div>}{wine.description && <div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">About this wine</dt><dd className="mt-1 text-sm leading-6">{wine.description}</dd></div>}{wine.tasting_notes && <div><dt className="text-xs font-bold uppercase tracking-[.14em] text-[var(--muted)]">Tasting notes</dt><dd className="mt-1 text-sm leading-6">{wine.tasting_notes}</dd></div>}</dl><div className="mt-5 rounded-xl border hairline bg-white/50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-[var(--wine)]"><LockKeyhole size={16} /> Dinner history stays private</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">This shared profile never includes other dinners, opening history, ratings, or personal notes.</p></div></section></div>;
}

function normalizePayload(payload: SharedPayload): SharedPayload {
  return { ...payload, courses: payload.courses ?? [], wines: payload.wines ?? [], available_wines: payload.available_wines ?? [] };
}

function errorText(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "wine-label.jpg";
}
