"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { GoogleSignIn } from "@/components/google-sign-in";

export function InviteView({ token }: { token: string }) {
  const router = useRouter(); const [signedIn, setSignedIn] = useState(false); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const live = isSupabaseConfigured();
  useEffect(() => { if (!live) return; void createClient().auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user))); }, [live]);
  const accept = async () => { if (!live) { setMessage("Invitation accepted in demo mode."); window.setTimeout(() => router.push("/"), 700); return; } setPending(true); const { error } = await createClient().rpc("accept_space_invitation", { raw_token: token }); if (error) { setMessage(error.message); setPending(false); } else router.push("/"); };
  return <main className="paper-grain grid min-h-screen place-items-center bg-[var(--wine-deep)] px-5 text-white"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.07] p-7 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white/10"><Users /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#e4a38d]">Invitation</p><h1 className="font-editorial mt-2 text-4xl">Join the table.</h1><p className="mt-3 text-sm leading-6 text-white/65">You’ve been invited to share dinners, wine notes, ratings, and memories.</p><div className="mt-7">{live && !signedIn ? <GoogleSignIn nextPath={`/invite/${token}`} /> : <button disabled={pending} onClick={accept} className="focus-ring w-full rounded-full bg-white px-5 py-3 text-sm font-bold text-[var(--wine)] disabled:opacity-60">{pending ? "Joining…" : "Accept invitation"}</button>}</div>{message && <p role="status" className="mt-4 text-sm text-white/70">{message}</p>}</div></main>;
}
