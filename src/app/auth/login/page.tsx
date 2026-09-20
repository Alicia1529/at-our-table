import { GoogleSignIn } from "@/components/google-sign-in";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return <main className="paper-grain grid min-h-screen place-items-center bg-[var(--wine-deep)] px-5 py-10 text-white"><div className="w-full max-w-md"><p className="text-center text-xs font-bold uppercase tracking-[.2em] text-[#e4a38d]">Private dinner journal</p><h1 className="font-editorial mt-4 text-center text-5xl">At Our Table</h1><p className="mx-auto mt-4 max-w-sm text-center text-sm leading-6 text-white/65">Plan dinner, pair the wine, and remember what you loved.</p><div className="mt-9 rounded-2xl border border-white/10 bg-white/[.06] p-5 backdrop-blur"><GoogleSignIn nextPath={next} /><p className="mt-5 text-center text-xs leading-5 text-white/45">Your dinners and photos stay private to the people in your space.</p></div></div></main>;
}
