import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { JournalFeed } from "@/components/journal-feed";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Dinner journal" };
export default function JournalPage() { return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9 xl:px-10"><PageHeader eyebrow="The journal" title="Dinners worth keeping." description="Menus, bottles, notes, and the small details that made each table yours." action={<Link href="/dinners/new" className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-[var(--wine)] px-5 py-3 text-sm font-bold text-white"><Plus size={17} /> New dinner</Link>} /><JournalFeed /></div>; }
