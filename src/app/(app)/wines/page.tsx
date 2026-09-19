import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { WineJournal } from "@/components/wine-journal";

export const metadata: Metadata = { title: "Wine journal" };
export default function WinesPage() { return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9 xl:px-10"><PageHeader eyebrow="Wine journal" title="Every bottle tells it differently." description="A wine is the bottle. An experience is the night you opened it, who shared it, and what made it sing." action={<button className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-[var(--wine)] px-5 py-3 text-sm font-bold text-white"><Plus size={17} /> Add wine</button>} /><WineJournal /></div>; }
