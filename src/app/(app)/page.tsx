import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, MapPin, Sparkles, Wine } from "lucide-react";
import { AvatarStack, Pill, Rating } from "@/components/ui";
import { dinners, wines } from "@/lib/mock-data";

export default function HomePage() {
  return <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-7 sm:py-8 xl:px-10">
    <header className="mb-6 flex items-center justify-between lg:mb-8">
      <div><p className="text-sm text-[var(--muted)]">Saturday, September 19</p><h1 className="font-editorial mt-1 text-3xl sm:text-4xl">Good evening, Alicia.</h1></div>
      <Link href="/dinners/new" className="focus-ring hidden rounded-full bg-[var(--wine)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--wine-deep)] sm:inline-flex">Plan a dinner</Link>
    </header>

    <section className="relative min-h-[470px] overflow-hidden rounded-[1.5rem] bg-[var(--wine-deep)] text-white sm:min-h-[520px]">
      <Image src="/table-hero.jpg" alt="A candlelit dinner table with shared plates and wine" fill priority className="object-cover" sizes="(min-width: 1024px) 80vw, 100vw" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#1d0b0a]/95 via-[#301412]/60 to-transparent" />
      <div className="relative flex min-h-[470px] max-w-2xl flex-col justify-between p-6 sm:min-h-[520px] sm:p-10 lg:p-12">
        <div className="flex items-center justify-between"><Pill tone="wine">Next at our table</Pill><span className="text-xs uppercase tracking-[.16em] text-white/70">In 6 days</span></div>
        <div>
          <p className="mb-4 text-sm font-semibold text-[#f2b49f]">Friday · 7:30 PM</p>
          <h2 className="font-editorial max-w-xl text-5xl leading-[.95] sm:text-6xl">A first night of autumn</h2>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/80"><span className="inline-flex items-center gap-2"><MapPin size={16} /> Our place</span><span className="inline-flex items-center gap-2"><Wine size={16} /> 3 bottles waiting</span></div>
          <div className="mt-7 flex items-center justify-between border-t border-white/20 pt-6"><AvatarStack names={["Alicia", "Maya", "Theo", "Jon", "Nina"]} /><Link href="/dinners/sunday-supper" className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[var(--wine)]">Open dinner <ArrowRight size={16} /></Link></div>
        </div>
      </div>
    </section>

    <div className="mt-8 grid gap-8 xl:grid-cols-[1.35fr_.65fr]">
      <section><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--tomato)]">From the journal</p><h2 className="font-editorial mt-1 text-3xl">Recent dinners</h2></div><Link href="/journal" className="text-sm font-semibold text-[var(--wine)] hover:underline">See all</Link></div>
        <div className="grid gap-4 md:grid-cols-2">{dinners.map((item) => <Link key={item.id} href={`/dinners/${item.id}`} className="lift focus-ring group rounded-2xl border hairline bg-white/60 p-5">
          <div className="flex items-center justify-between"><Pill>{item.locationType === "home" ? "At home" : "Restaurant"}</Pill><span className="text-xs text-[var(--muted)]">{item.photoCount} photos</span></div>
          <h3 className="font-editorial mt-5 text-2xl leading-tight group-hover:text-[var(--wine)]">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
          <div className="mt-5 flex items-center justify-between"><AvatarStack names={item.guests} limit={3} /><span className="text-xs font-medium text-[var(--muted)]">{item.courses.length} courses · {item.wineExperienceIds.length} wines</span></div>
        </Link>)}</div>
      </section>

      <aside className="rounded-2xl border hairline bg-[#efe3d2] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--olive)]">Bottle to remember</p><h2 className="font-editorial mt-1 text-2xl">From your cellar notes</h2></div><Sparkles className="text-[var(--tomato)]" /></div>
        <Link href={`/wines/${wines[0].id}`} className="focus-ring mt-6 block rounded-xl bg-[var(--wine-deep)] p-5 text-white"><p className="text-xs uppercase tracking-[.15em] text-white/55">{wines[0].region} · {wines[0].vintage}</p><h3 className="font-editorial mt-3 text-3xl">{wines[0].producer}</h3><p className="mt-1 text-sm text-white/75">{wines[0].cuvee}</p><div className="mt-6 flex items-end justify-between"><Rating value={4.8} /><span className="text-xs text-white/60">Opened 3 times</span></div></Link>
        <div className="mt-5 flex items-center gap-3 border-t hairline pt-5 text-sm text-[var(--muted)]"><Camera size={18} className="text-[var(--tomato)]" /><span>You added <strong className="text-[var(--ink)]">25 photos</strong> this month.</span></div>
      </aside>
    </div>
  </div>;
}
