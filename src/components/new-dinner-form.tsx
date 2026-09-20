"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, GripVertical, Home, MapPin, Plus, Sparkles, Store, Trash2, Users, Wine } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { useAppData } from "@/components/app-data-provider";

type DraftCourse = { id: number; title: string };

export function NewDinnerForm() {
  const router = useRouter();
  const { createDinner, openWine, wines } = useAppData();
  const [location, setLocation] = useState<"home" | "restaurant">("home");
  const [courses, setCourses] = useState<DraftCourse[]>([{ id: 1, title: "" }, { id: 2, title: "" }]);
  const [showWines, setShowWines] = useState(false);
  const [selectedWines, setSelectedWines] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
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
  const suggestMenu = () => { const suggestions = location === "home" ? ["Seasonal vegetables with fresh cheese", "Roast chicken with herbs", "Fruit tart with crème fraîche"] : ["A bright first course", "The house specialty", "Something small and sweet"]; setCourses(suggestions.map((title, index) => ({ id: Date.now() + index, title }))); setSuggestionMessage("A simple three-course draft is ready. Make it yours."); };

  return <form onSubmit={save} className="mx-auto max-w-4xl px-4 py-5 sm:px-7 sm:py-9">
    <div className="mb-8 flex items-center justify-between"><Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={17} /> Back</Link><span className="text-xs font-semibold text-[var(--muted)]">Everything stays editable</span></div>
    <header className="border-b hairline pb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--tomato)]">New dinner</p><h1 className="font-editorial mt-2 text-5xl sm:text-6xl">Set the table.</h1><p className="mt-3 text-[var(--muted)]">Start with what you know. Everything can change before, during, or after dinner.</p></header>

    <div className="space-y-10 py-8">
      <section><label htmlFor="title" className="text-sm font-bold">What are you calling it?</label><input id="title" name="title" required placeholder="Friday night with the Chens" className="focus-ring mt-3 w-full border-0 border-b-2 hairline bg-transparent px-0 pb-3 font-editorial text-3xl placeholder:text-[#a99b91] focus:border-[var(--wine)] focus:outline-none sm:text-4xl" /></section>

      <section className="grid gap-6 sm:grid-cols-2"><Field icon={CalendarDays} label="When"><input type="datetime-local" name="scheduled_at" defaultValue={defaultDate} className="field-input" /></Field><Field icon={Users} label="Who's coming?"><input name="guests" placeholder="Add names, separated by commas" className="field-input" /></Field></section>

      <section><p className="text-sm font-bold">Where are you gathering?</p><div className="mt-3 grid grid-cols-2 gap-3">
        <ChoiceButton selected={location === "home"} onClick={() => setLocation("home")} icon={Home} title="At home" detail="Cook, host, linger" />
        <ChoiceButton selected={location === "restaurant"} onClick={() => setLocation("restaurant")} icon={Store} title="At a restaurant" detail="Remember the table" />
      </div><div className="mt-4"><Field icon={MapPin} label={location === "home" ? "Which home?" : "Restaurant name"}><input name="venue" placeholder={location === "home" ? "Our place" : "Bar name and city"} className="field-input" /></Field></div></section>

      <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold">Shape the menu</p><p className="mt-1 text-sm text-[var(--muted)]">Add one course or twelve, or start with a simple suggestion.</p></div><div className="flex gap-1"><button type="button" onClick={suggestMenu} className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-[var(--olive)] hover:bg-white/60"><Sparkles size={16} /> Suggest menu</button><button type="button" onClick={() => setCourses([...courses, { id: Date.now(), title: "" }])} className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-[var(--wine)] hover:bg-white/60"><Plus size={16} /> Course</button></div></div>{suggestionMessage && <p role="status" className="mt-3 text-sm text-[var(--muted)]">{suggestionMessage}</p>}
        <div className="mt-4 space-y-2">{courses.map((course, index) => <div key={course.id} className="flex items-center gap-3 rounded-xl border hairline bg-white/55 p-3"><GripVertical size={18} className="text-[#b4a59b]" /><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--paper-deep)] text-xs font-bold">{index + 1}</span><input value={course.title} onChange={(event) => updateCourse(course.id, event.target.value)} placeholder={index === 0 ? "Tomatoes with whipped ricotta" : "Name this course"} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[#9b8c82]" /><button type="button" aria-label="Remove course" disabled={courses.length === 1} onClick={() => setCourses(courses.filter((item) => item.id !== course.id))} className="focus-ring rounded-md p-1 text-[var(--muted)] disabled:opacity-20"><Trash2 size={16} /></button></div>)}</div>
      </section>

      <section className="rounded-2xl bg-[var(--wine-deep)] p-5 text-white sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-white/10"><Wine size={19} /></span><div><p className="font-bold">Choose wine now—or at the table.</p><p className="mt-1 text-sm text-white/65">Pair bottles to individual dishes when you&apos;re ready.</p></div></div><button type="button" onClick={() => setShowWines(!showWines)} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[var(--wine)]"><Plus size={16} /> {selectedWines.length ? `${selectedWines.length} selected` : "Add a bottle"}</button>{showWines && <div className="mt-4 grid gap-2 sm:grid-cols-2">{wines.map((wine) => <label key={wine.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/10 p-3 text-sm"><input type="checkbox" checked={selectedWines.includes(wine.id)} onChange={(event) => setSelectedWines(event.target.checked ? [...selectedWines, wine.id] : selectedWines.filter((id) => id !== wine.id))} className="size-4 accent-[#d64d32]" /><span><strong className="block">{wine.producer}</strong><small className="text-white/60">{wine.cuvee} · {wine.vintage}</small></span></label>)}</div>}</section>
    </div>

    {error && <p role="alert" className="mb-3 text-sm font-semibold text-[var(--tomato)]">{error}</p>}<footer className="sticky bottom-20 -mx-4 flex items-center justify-between border-t hairline bg-[#f7f0e5]/95 px-4 py-4 backdrop-blur sm:bottom-0 sm:mx-0 sm:rounded-xl sm:border sm:px-5"><button type="button" onClick={() => router.back()} className="focus-ring rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--muted)]">Cancel</button><button type="submit" disabled={pending} className="focus-ring rounded-full bg-[var(--wine)] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-[var(--wine-deep)] disabled:opacity-60">{pending ? "Creating…" : "Create dinner"}</button></footer>
  </form>;
}

function Field({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) { return <label className="block"><span className="flex items-center gap-2 text-sm font-bold"><Icon size={16} className="text-[var(--tomato)]" />{label}</span><div className="mt-2">{children}</div></label>; }
function ChoiceButton({ selected, onClick, icon: Icon, title, detail }: { selected: boolean; onClick: () => void; icon: typeof Home; title: string; detail: string }) { return <button type="button" onClick={onClick} className={clsx("focus-ring flex items-center gap-3 rounded-xl border p-4 text-left", selected ? "border-[var(--wine)] bg-white shadow-sm" : "hairline bg-white/35")}><span className={clsx("grid size-10 place-items-center rounded-full", selected ? "bg-[var(--wine)] text-white" : "bg-[var(--paper-deep)] text-[var(--muted)]")}><Icon size={19} /></span><span><strong className="block text-sm">{title}</strong><small className="mt-1 block text-xs text-[var(--muted)]">{detail}</small></span></button>; }
function defaultDinnerDate() { const date = new Date(); date.setDate(date.getDate() + 7); date.setHours(19, 30, 0, 0); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
