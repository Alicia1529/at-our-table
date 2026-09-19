"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, GripVertical, Home, MapPin, Plus, Store, Trash2, Users, Wine } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

type DraftCourse = { id: number; title: string };

export function NewDinnerForm() {
  const router = useRouter();
  const [location, setLocation] = useState<"home" | "restaurant">("home");
  const [courses, setCourses] = useState<DraftCourse[]>([{ id: 1, title: "" }, { id: 2, title: "" }]);

  const save = (event: React.FormEvent) => { event.preventDefault(); router.push("/dinners/sunday-supper"); };
  const updateCourse = (id: number, title: string) => setCourses(courses.map((course) => course.id === id ? { ...course, title } : course));

  return <form onSubmit={save} className="mx-auto max-w-4xl px-4 py-5 sm:px-7 sm:py-9">
    <div className="mb-8 flex items-center justify-between"><Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={17} /> Back</Link><span className="text-xs font-semibold text-[var(--muted)]">Saved as you go</span></div>
    <header className="border-b hairline pb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--tomato)]">New dinner</p><h1 className="font-editorial mt-2 text-5xl sm:text-6xl">Set the table.</h1><p className="mt-3 text-[var(--muted)]">Start with what you know. Everything can change before, during, or after dinner.</p></header>

    <div className="space-y-10 py-8">
      <section><label htmlFor="title" className="text-sm font-bold">What are you calling it?</label><input id="title" name="title" required placeholder="Friday night with the Chens" className="focus-ring mt-3 w-full border-0 border-b-2 hairline bg-transparent px-0 pb-3 font-editorial text-3xl placeholder:text-[#a99b91] focus:border-[var(--wine)] focus:outline-none sm:text-4xl" /></section>

      <section className="grid gap-6 sm:grid-cols-2"><Field icon={CalendarDays} label="When"><input type="datetime-local" name="scheduled_at" defaultValue="2026-09-25T19:30" className="field-input" /></Field><Field icon={Users} label="Who's coming?"><input name="guests" placeholder="Add names, separated by commas" className="field-input" /></Field></section>

      <section><p className="text-sm font-bold">Where are you gathering?</p><div className="mt-3 grid grid-cols-2 gap-3">
        <ChoiceButton selected={location === "home"} onClick={() => setLocation("home")} icon={Home} title="At home" detail="Cook, host, linger" />
        <ChoiceButton selected={location === "restaurant"} onClick={() => setLocation("restaurant")} icon={Store} title="At a restaurant" detail="Remember the table" />
      </div><div className="mt-4"><Field icon={MapPin} label={location === "home" ? "Which home?" : "Restaurant name"}><input name="venue" placeholder={location === "home" ? "Our place" : "Bar name and city"} className="field-input" /></Field></div></section>

      <section><div className="flex items-end justify-between"><div><p className="text-sm font-bold">Shape the menu</p><p className="mt-1 text-sm text-[var(--muted)]">Add one course or twelve. You can reorder later.</p></div><button type="button" onClick={() => setCourses([...courses, { id: Date.now(), title: "" }])} className="focus-ring inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-[var(--wine)] hover:bg-white/60"><Plus size={16} /> Course</button></div>
        <div className="mt-4 space-y-2">{courses.map((course, index) => <div key={course.id} className="flex items-center gap-3 rounded-xl border hairline bg-white/55 p-3"><GripVertical size={18} className="text-[#b4a59b]" /><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--paper-deep)] text-xs font-bold">{index + 1}</span><input value={course.title} onChange={(event) => updateCourse(course.id, event.target.value)} placeholder={index === 0 ? "Tomatoes with whipped ricotta" : "Name this course"} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[#9b8c82]" /><button type="button" aria-label="Remove course" disabled={courses.length === 1} onClick={() => setCourses(courses.filter((item) => item.id !== course.id))} className="focus-ring rounded-md p-1 text-[var(--muted)] disabled:opacity-20"><Trash2 size={16} /></button></div>)}</div>
      </section>

      <section className="rounded-2xl bg-[var(--wine-deep)] p-5 text-white sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-white/10"><Wine size={19} /></span><div><p className="font-bold">Choose wine now—or at the table.</p><p className="mt-1 text-sm text-white/65">Pair bottles to individual dishes when you&apos;re ready.</p></div></div><button type="button" className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[var(--wine)]"><Plus size={16} /> Add a bottle</button></section>
    </div>

    <footer className="sticky bottom-20 -mx-4 flex items-center justify-between border-t hairline bg-[#f7f0e5]/95 px-4 py-4 backdrop-blur sm:bottom-0 sm:mx-0 sm:rounded-xl sm:border sm:px-5"><button type="button" onClick={() => router.back()} className="focus-ring rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--muted)]">Cancel</button><button type="submit" className="focus-ring rounded-full bg-[var(--wine)] px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-[var(--wine-deep)]">Create dinner</button></footer>
  </form>;
}

function Field({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) { return <label className="block"><span className="flex items-center gap-2 text-sm font-bold"><Icon size={16} className="text-[var(--tomato)]" />{label}</span><div className="mt-2">{children}</div></label>; }
function ChoiceButton({ selected, onClick, icon: Icon, title, detail }: { selected: boolean; onClick: () => void; icon: typeof Home; title: string; detail: string }) { return <button type="button" onClick={onClick} className={clsx("focus-ring flex items-center gap-3 rounded-xl border p-4 text-left", selected ? "border-[var(--wine)] bg-white shadow-sm" : "hairline bg-white/35")}><span className={clsx("grid size-10 place-items-center rounded-full", selected ? "bg-[var(--wine)] text-white" : "bg-[var(--paper-deep)] text-[var(--muted)]")}><Icon size={19} /></span><span><strong className="block text-sm">{title}</strong><small className="mt-1 block text-xs text-[var(--muted)]">{detail}</small></span></button>; }
