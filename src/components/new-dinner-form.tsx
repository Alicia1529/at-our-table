"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Camera, Check, GripVertical, Home, Lightbulb, LoaderCircle, MapPin, Plus, Sparkles, Store, Trash2, Users, Wine, X } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { useAppData } from "@/components/app-data-provider";
import type { Wine as WineRecord, WineColor, WineDraft } from "@/lib/types";
import { suggestWineProfile, type WineRecommendation } from "@/lib/wine-recommendations";
import { identifyWinePhotos, type WinePhotoIdentification } from "@/lib/wine-photo-identification";

type DraftCourse = { id: number; title: string };

type PairingPayload = {
  courseId: string;
  courseTitle: string;
  savedWineId: string;
  producer: string;
  cuvee: string;
  vintage: number;
  region: string;
  country: string;
  grapes: string[];
  color: WineColor;
  description: string;
  tastingNotes: string;
  why: string;
};

export function NewDinnerForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const recommendationsRef = useRef<HTMLDivElement>(null);
  const { addWine, createDinner, openWine, wines } = useAppData();
  const [location, setLocation] = useState<"home" | "restaurant">("home");
  const [courses, setCourses] = useState<DraftCourse[]>([{ id: 1, title: "" }, { id: 2, title: "" }]);
  const [showWines, setShowWines] = useState(false);
  const [selectedWines, setSelectedWines] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [menuPending, setMenuPending] = useState(false);
  const [menuMessage, setMenuMessage] = useState("");
  const [menuError, setMenuError] = useState("");
  const [recommendations, setRecommendations] = useState<WineRecommendation[]>([]);
  const [pairingPending, setPairingPending] = useState(false);
  const [pairingMessage, setPairingMessage] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [showCustomWine, setShowCustomWine] = useState(false);
  const [customWine, setCustomWine] = useState<WineDraft>(emptyWineDraft);
  const [winePending, setWinePending] = useState(false);
  const [wineError, setWineError] = useState("");
  const [scanPending, setScanPending] = useState(false);
  const [scanError, setScanError] = useState("");
  const [recognition, setRecognition] = useState<WinePhotoIdentification | null>(null);
  const [defaultDate] = useState(defaultDinnerDate);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const id = await createDinner({ title: String(form.get("title")), date: String(form.get("scheduled_at")), locationType: location, venue: String(form.get("venue") || (location === "home" ? "Our place" : "")), guests: String(form.get("guests") ?? "").split(",").map((name) => name.trim()).filter(Boolean), courses: courses.map((course) => course.title.trim()).filter(Boolean) });
      for (const wineId of selectedWines) await openWine(id, wineId);
      router.push(`/dinners/${id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create dinner."); setPending(false); }
  };
  const updateCourse = (id: number, title: string) => setCourses(courses.map((course) => course.id === id ? { ...course, title } : course));
  const suggestMenu = async () => {
    if (!formRef.current || menuPending) return;
    const form = new FormData(formRef.current);
    setMenuPending(true); setMenuError(""); setMenuMessage("Creating a fresh menu direction…");
    try {
      const response = await fetch("/api/menu/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationType: location,
          venue: String(form.get("venue") ?? ""),
          title: String(form.get("title") ?? ""),
          guests: String(form.get("guests") ?? ""),
          previousCourses: courses.map((course) => course.title.trim()).filter(Boolean),
        }),
      });
      const data = await response.json() as { courses?: Array<{ title?: string }>; note?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not suggest a menu.");
      const suggestions = (data.courses ?? []).map((course) => String(course.title ?? "").trim()).filter(Boolean);
      if (suggestions.length !== 3) throw new Error("The menu suggestion was incomplete. Please try again.");
      setCourses(suggestions.map((title, index) => ({ id: Date.now() + index, title })));
      setRecommendations([]);
      setPairingMessage("");
      setMenuMessage(data.note || "A new three-course menu is ready. Make it yours.");
    } catch (cause) {
      setMenuMessage("");
      setMenuError(cause instanceof Error ? cause.message : "Could not suggest a menu.");
    } finally { setMenuPending(false); }
  };
  const makeRecommendations = async () => {
    const activeCourses = courses.filter((course) => course.title.trim());
    if (!activeCourses.length) { setPairingError("Add at least one dish before asking for wine recommendations."); return; }
    if (pairingPending) return;
    setPairingPending(true); setPairingError(""); setPairingMessage("Finding a pairing for each dish…");
    try {
      const response = await fetch("/api/wines/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: activeCourses, savedWines: wines }),
      });
      const data = await response.json() as { recommendations?: PairingPayload[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not recommend wines.");
      const next = (data.recommendations ?? []).map((item, index): WineRecommendation => {
        const savedWine = item.savedWineId ? wines.find((wine) => wine.id === item.savedWineId) : undefined;
        const wine: WineRecord = savedWine ?? {
          id: `recommended-${item.courseId}-${index}-${Date.now()}`,
          producer: item.producer,
          cuvee: item.cuvee,
          vintage: item.vintage,
          region: item.region,
          country: item.country,
          grapes: item.grapes,
          color: item.color,
          bottlesOpened: 0,
          description: item.description,
          tastingNotes: item.tastingNotes,
        };
        return { courseId: item.courseId, courseTitle: item.courseTitle, wine, why: item.why, savedWineId: savedWine?.id };
      });
      if (next.length !== activeCourses.length) throw new Error("The recommendations were incomplete. Please try again.");
      setRecommendations(next);
      setPairingMessage(`${next.length} pairing ${next.length === 1 ? "idea is" : "ideas are"} ready.`);
      window.setTimeout(() => recommendationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (cause) {
      setPairingMessage("");
      setPairingError(cause instanceof Error ? cause.message : "Could not recommend wines.");
    } finally { setPairingPending(false); }
  };
  const chooseRecommendation = (recommendation: WineRecommendation) => {
    if (recommendation.savedWineId) { toggleWine(recommendation.savedWineId); return; }
    const wine = recommendation.wine;
    setWineError(""); setRecognition(null);
    setCustomWine({ producer: wine.producer, cuvee: wine.cuvee, vintage: wine.vintage || new Date().getFullYear(), region: wine.region, country: wine.country, grapes: wine.grapes, color: wine.color, description: wine.description, tastingNotes: wine.tastingNotes });
    setShowCustomWine(true);
  };
  const toggleWine = (wineId: string) => setSelectedWines((current) => current.includes(wineId) ? current.filter((id) => id !== wineId) : [...current, wineId]);
  const generateWineDetails = () => { const suggestion = suggestWineProfile(customWine); setCustomWine((current) => ({ ...current, ...suggestion })); };
  const saveCustomWine = async () => { if (!customWine.producer.trim()) { setWineError("Add the producer or bottle name first."); return; } setWinePending(true); setWineError(""); try { const wineId = await addWine(customWine); setSelectedWines((current) => current.includes(wineId) ? current : [...current, wineId]); setCustomWine(emptyWineDraft()); setRecognition(null); setShowCustomWine(false); setShowWines(true); setPairingMessage("Your bottle is in the wine journal and selected for this dinner."); } catch (cause) { setWineError(cause instanceof Error ? cause.message : "Could not add wine."); } finally { setWinePending(false); } };
  const scanWine = async (event: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []).slice(0, 2); if (!files.length) return; setScanPending(true); setScanError(""); try { const result = await identifyWinePhotos(files); setRecognition(result); setCustomWine({ producer: result.producer, cuvee: result.cuvee, vintage: result.vintage || new Date().getFullYear(), region: result.region, country: result.country, grapes: result.grapes, color: result.color === "unknown" ? "red" : result.color, description: result.description, tastingNotes: result.tastingNotes, labelFile: files[0] }); setWineError(""); setShowCustomWine(true); } catch (cause) { setScanError(cause instanceof Error ? cause.message : "Could not read this wine label."); } finally { setScanPending(false); event.target.value = ""; } };

  return <form ref={formRef} onSubmit={save} className="mx-auto max-w-4xl px-4 py-5 sm:px-7 sm:py-9">
    <div className="mb-8 flex items-center justify-between"><Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={17} /> Back</Link><span className="text-xs font-semibold text-[var(--muted)]">Everything stays editable</span></div>
    <header className="border-b hairline pb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--tomato)]">New dinner</p><h1 className="font-editorial mt-2 text-5xl sm:text-6xl">Set the table.</h1><p className="mt-3 text-[var(--muted)]">Start with what you know. Everything can change before, during, or after dinner.</p></header>

    <div className="space-y-10 py-8">
      <section><label htmlFor="title" className="text-sm font-bold">What are you calling it?</label><input id="title" name="title" required placeholder="Friday night with the Chens" className="focus-ring mt-3 w-full border-0 border-b-2 hairline bg-transparent px-0 pb-3 font-editorial text-3xl placeholder:text-[#a99b91] focus:border-[var(--wine)] focus:outline-none sm:text-4xl" /></section>

      <section className="grid gap-6 sm:grid-cols-2"><Field icon={CalendarDays} label="When"><input type="datetime-local" name="scheduled_at" defaultValue={defaultDate} className="field-input" /></Field><Field icon={Users} label="Who's coming?"><input name="guests" placeholder="Add names, separated by commas" className="field-input" /></Field></section>

      <section><p className="text-sm font-bold">Where are you gathering?</p><div className="mt-3 grid grid-cols-2 gap-3">
        <ChoiceButton selected={location === "home"} onClick={() => setLocation("home")} icon={Home} title="At home" detail="Cook, host, linger" />
        <ChoiceButton selected={location === "restaurant"} onClick={() => setLocation("restaurant")} icon={Store} title="At a restaurant" detail="Remember the table" />
      </div><div className="mt-4"><Field icon={MapPin} label={location === "home" ? "Which home?" : "Restaurant name"}><input name="venue" placeholder={location === "home" ? "Our place" : "Bar name and city"} className="field-input" /></Field></div></section>

      <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold">Shape the menu</p><p className="mt-1 text-sm text-[var(--muted)]">Add one course or twelve, or ask for a fresh suggestion.</p></div><div className="flex gap-1"><button type="button" disabled={menuPending} onClick={suggestMenu} className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-[var(--olive)] hover:bg-white/60 disabled:opacity-60">{menuPending ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {menuPending ? "Dreaming up a menu…" : "Suggest menu"}</button><button type="button" onClick={() => setCourses([...courses, { id: Date.now(), title: "" }])} className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-[var(--wine)] hover:bg-white/60"><Plus size={16} /> Course</button></div></div>{menuMessage && <p role="status" aria-live="polite" className="mt-3 text-sm text-[var(--muted)]">{menuMessage}</p>}{menuError && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--tomato)]">{menuError}</p>}
        <div className="mt-4 space-y-2">{courses.map((course, index) => <div key={course.id} className="flex items-center gap-3 rounded-xl border hairline bg-white/55 p-3"><GripVertical size={18} className="text-[#b4a59b]" /><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--paper-deep)] text-xs font-bold">{index + 1}</span><input value={course.title} onChange={(event) => updateCourse(course.id, event.target.value)} placeholder={index === 0 ? "Tomatoes with whipped ricotta" : "Name this course"} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[#9b8c82]" /><button type="button" aria-label="Remove course" disabled={courses.length === 1} onClick={() => setCourses(courses.filter((item) => item.id !== course.id))} className="focus-ring rounded-md p-1 text-[var(--muted)] disabled:opacity-20"><Trash2 size={16} /></button></div>)}</div>
      </section>

      <section className="rounded-2xl bg-[var(--wine-deep)] p-5 text-white sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-white/10"><Wine size={19} /></span><div><p className="font-bold">Choose wine now—or at the table.</p><p className="mt-1 text-sm text-white/65">Get a pairing idea for each dish, with the reason behind it.</p></div></div><button type="button" disabled={pairingPending} onClick={makeRecommendations} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#f4dfbd] px-4 py-2.5 text-sm font-bold text-[var(--wine-deep)] disabled:opacity-65">{pairingPending ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {pairingPending ? "Pairing your menu…" : "Recommend wines"}</button></div>
        {pairingMessage && <p role="status" aria-live="polite" className="mt-4 text-sm text-white/70">{pairingMessage}</p>}{pairingError && <p role="alert" className="mt-4 text-sm font-semibold text-[#f5b7a9]">{pairingError}</p>}
        {recommendations.length > 0 && <div ref={recommendationsRef} className="mt-5 scroll-mt-6 space-y-3"><p className="text-xs font-bold uppercase tracking-[.16em] text-white/55">Recommended for your menu</p>{recommendations.map((recommendation) => { const selected = Boolean(recommendation.savedWineId && selectedWines.includes(recommendation.savedWineId)); return <article key={`${recommendation.courseId}-${recommendation.wine.id}`} className="grid gap-4 rounded-2xl bg-white/10 p-4 sm:grid-cols-[64px_1fr_auto] sm:items-center">{recommendation.wine.imageUrl ? <div aria-label={`${recommendation.wine.producer} label`} className="h-20 w-16 rounded-lg bg-white/10 bg-cover bg-center" style={{ backgroundImage: `url(${recommendation.wine.imageUrl})` }} /> : <div className="grid h-20 w-16 place-items-center rounded-lg bg-white/10"><Wine size={25} className="text-[#e7bc9c]" /></div>}<div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#e7bc9c]">For {recommendation.courseTitle}</p><h3 className="mt-1 font-editorial text-2xl">{recommendation.wine.producer} <span className="text-white/65">{recommendation.wine.cuvee}</span></h3><p className="mt-2 flex gap-2 text-sm leading-5 text-white/72"><Lightbulb size={15} className="mt-0.5 shrink-0 text-[#f4dfbd]" /><span><strong className="text-white">Why:</strong> {recommendation.why}</span></p>{recommendation.wine.tastingNotes && <p className="mt-2 text-xs leading-5 text-white/55"><strong className="text-white/75">Tasting notes:</strong> {recommendation.wine.tastingNotes}</p>}</div><button type="button" onClick={() => chooseRecommendation(recommendation)} className={clsx("focus-ring inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-bold", selected ? "bg-[#d7e0c1] text-[var(--olive)]" : "bg-white text-[var(--wine)]")} >{selected ? <><Check size={14} /> Added</> : <><Plus size={14} /> {recommendation.savedWineId ? "Add bottle" : "Review & add"}</>}</button></article>; })}</div>}
        <div className="mt-5 flex flex-wrap gap-2"><input ref={scanInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={scanWine} hidden /><button type="button" disabled={scanPending} onClick={() => scanInputRef.current?.click()} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#f4dfbd] px-4 py-2.5 text-sm font-bold text-[var(--wine-deep)] disabled:opacity-60">{scanPending ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />} {scanPending ? "Reading label…" : "Scan wine label"}</button><button type="button" onClick={() => setShowWines(!showWines)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[var(--wine)]"><Plus size={16} /> {selectedWines.length ? `${selectedWines.length} selected` : "Choose saved wines"}</button><button type="button" onClick={() => { setWineError(""); setRecognition(null); setCustomWine(emptyWineDraft()); setShowCustomWine(true); }} className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Add manually</button></div>{scanError && <p role="alert" className="mt-3 text-sm font-semibold text-[#f5b7a9]">{scanError}</p>}
        {showWines && <div className="mt-4 grid gap-2 sm:grid-cols-2">{wines.map((wine) => <label key={wine.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/10 p-3 text-sm"><input type="checkbox" checked={selectedWines.includes(wine.id)} onChange={() => toggleWine(wine.id)} className="size-4 accent-[#d64d32]" />{wine.imageUrl ? <span className="h-11 w-9 shrink-0 rounded bg-white/10 bg-cover bg-center" style={{ backgroundImage: `url(${wine.imageUrl})` }} /> : null}<span><strong className="block">{wine.producer}</strong><small className="text-white/60">{wine.cuvee} · {wine.vintage}</small></span></label>)}</div>}
      </section>
    </div>

    {error && <p role="alert" className="mb-3 text-sm font-semibold text-[var(--tomato)]">{error}</p>}<footer className="sticky bottom-20 -mx-4 flex items-center justify-between border-t hairline bg-[#f7f0e5]/95 px-4 py-4 backdrop-blur sm:bottom-0 sm:mx-0 sm:rounded-xl sm:border sm:px-5"><button type="button" onClick={() => router.back()} className="focus-ring rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--muted)]">Cancel</button><button type="submit" disabled={pending} className="focus-ring rounded-full bg-[var(--wine)] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-[var(--wine-deep)] disabled:opacity-60">{pending ? "Creating…" : "Create dinner"}</button></footer>
    {showCustomWine && <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center sm:p-5" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="custom-wine-title" className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-3xl bg-[var(--paper)] p-6 text-[var(--ink)] shadow-2xl sm:rounded-3xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--tomato)]">Your bottle</p><h2 id="custom-wine-title" className="font-editorial mt-1 text-3xl">{recognition ? "Review the scanned wine" : "Add wine to the table"}</h2></div><button type="button" onClick={() => setShowCustomWine(false)} aria-label="Close" className="focus-ring rounded-full p-2"><X size={19} /></button></div>{recognition && <div className="mt-5 rounded-2xl border border-[#b8c59b] bg-[#edf0df] p-4"><p className="flex items-center gap-2 text-sm font-bold text-[var(--olive)]"><Check size={16} /> Label read with {Math.round(recognition.confidence * 100)}% confidence</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Please check the fields before saving. Recognized: {recognition.evidence.slice(0, 4).join(" · ") || "label details"}</p></div>}<div className="mt-6 grid gap-4 sm:grid-cols-2"><WineInput label="Producer or bottle name" value={customWine.producer} onChange={(value) => setCustomWine({ ...customWine, producer: value })} placeholder="Domaine Tempier" wide /><WineInput label="Cuvée" value={customWine.cuvee} onChange={(value) => setCustomWine({ ...customWine, cuvee: value })} placeholder="Bandol Rouge" wide /><WineInput label="Vintage" value={String(customWine.vintage)} onChange={(value) => setCustomWine({ ...customWine, vintage: Number(value) })} type="number" /><label><span className="text-sm font-bold">Color</span><select value={customWine.color} onChange={(event) => setCustomWine({ ...customWine, color: event.target.value as WineColor })} className="field-input mt-2"><option value="red">Red</option><option value="white">White</option><option value="orange">Orange</option><option value="rosé">Rosé</option><option value="sparkling">Sparkling</option></select></label><WineInput label="Region" value={customWine.region} onChange={(value) => setCustomWine({ ...customWine, region: value })} /><WineInput label="Country" value={customWine.country} onChange={(value) => setCustomWine({ ...customWine, country: value })} /><WineInput label="Grapes" value={customWine.grapes.join(", ")} onChange={(value) => setCustomWine({ ...customWine, grapes: value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Mourvèdre, Grenache" wide /><label className="sm:col-span-2"><span className="flex items-center gap-2 text-sm font-bold"><Camera size={16} className="text-[var(--tomato)]" /> Label photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCustomWine({ ...customWine, labelFile: event.target.files?.[0] })} className="mt-2 block w-full rounded-xl border hairline bg-white/55 px-3 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--paper-deep)] file:px-3 file:py-2 file:font-bold" /><small className="mt-2 block text-[var(--muted)]">{customWine.labelFile ? `${customWine.labelFile.name} will be saved as the label photo.` : "Use the clearest front-label image."}</small></label><div className="sm:col-span-2 flex justify-end"><button type="button" onClick={generateWineDetails} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--paper-deep)] px-4 py-2 text-sm font-bold text-[var(--olive)]"><Sparkles size={15} /> Draft introduction & notes</button></div><WineTextarea label="Introduction" value={customWine.description} onChange={(value) => setCustomWine({ ...customWine, description: value })} placeholder="Where it comes from and what makes this bottle worth remembering." /><WineTextarea label="Tasting notes" value={customWine.tastingNotes} onChange={(value) => setCustomWine({ ...customWine, tastingNotes: value })} placeholder="Fruit, texture, aromas, finish…" /></div>{wineError && <p role="alert" className="mt-4 text-sm font-semibold text-[var(--tomato)]">{wineError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowCustomWine(false)} className="focus-ring rounded-full px-4 py-2.5 text-sm font-bold text-[var(--muted)]">Cancel</button><button type="button" disabled={winePending} onClick={saveCustomWine} className="focus-ring rounded-full bg-[var(--wine)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{winePending ? "Adding…" : "Add & select wine"}</button></div></div></div>}
  </form>;
}

function Field({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) { return <label className="block"><span className="flex items-center gap-2 text-sm font-bold"><Icon size={16} className="text-[var(--tomato)]" />{label}</span><div className="mt-2">{children}</div></label>; }
function ChoiceButton({ selected, onClick, icon: Icon, title, detail }: { selected: boolean; onClick: () => void; icon: typeof Home; title: string; detail: string }) { return <button type="button" onClick={onClick} className={clsx("focus-ring flex items-center gap-3 rounded-xl border p-4 text-left", selected ? "border-[var(--wine)] bg-white shadow-sm" : "hairline bg-white/35")}><span className={clsx("grid size-10 place-items-center rounded-full", selected ? "bg-[var(--wine)] text-white" : "bg-[var(--paper-deep)] text-[var(--muted)]")}><Icon size={19} /></span><span><strong className="block text-sm">{title}</strong><small className="mt-1 block text-xs text-[var(--muted)]">{detail}</small></span></button>; }
function WineInput({ label, value, onChange, placeholder, wide, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; wide?: boolean; type?: string }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="text-sm font-bold">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field-input mt-2" /></label>; }
function WineTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="sm:col-span-2"><span className="text-sm font-bold">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="field-input mt-2 resize-y" /></label>; }
function emptyWineDraft(): WineDraft { return { producer: "", cuvee: "", vintage: new Date().getFullYear(), region: "", country: "", grapes: [], color: "red", description: "", tastingNotes: "" }; }
function defaultDinnerDate() { const date = new Date(); date.setDate(date.getDate() + 7); date.setHours(19, 30, 0, 0); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
