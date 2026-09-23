"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignIn({ nextPath = "/", forceAccountChoice = false, label = "Continue with Google" }: { nextPath?: string; forceAccountChoice?: boolean; label?: string }) {
  const [message, setMessage] = useState("");
  const signIn = async () => {
    try {
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", nextPath.startsWith("/") ? nextPath : "/");
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString(), ...(forceAccountChoice && { queryParams: { prompt: "select_account" } }) } });
      if (error) setMessage(error.message);
    } catch { setMessage("Connect Supabase in .env.local to enable Google sign-in. The app is currently in preview mode."); }
  };
  return <div><button type="button" onClick={signIn} className="focus-ring flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3.5 text-sm font-bold text-[var(--ink)] shadow-sm"><span className="grid size-6 place-items-center rounded-full border hairline font-serif text-[var(--tomato)]">G</span>{label}</button>{message && <p role="status" className="mt-3 text-center text-xs leading-5 text-white/65">{message}</p>}</div>;
}
