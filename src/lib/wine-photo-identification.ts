import type { WineColor } from "@/lib/types";

export type WinePhotoIdentification = {
  producer: string;
  cuvee: string;
  vintage: number;
  region: string;
  country: string;
  grapes: string[];
  color: WineColor | "unknown";
  description: string;
  tastingNotes: string;
  confidence: number;
  evidence: string[];
};

export async function identifyWinePhotos(files: File[]) {
  if (!files.length) throw new Error("Take or choose at least one wine-label photo.");
  const form = new FormData();
  files.slice(0, 2).forEach((file) => form.append("photos", file));
  const response = await fetch("/api/wines/identify", { method: "POST", body: form });
  let payload: WinePhotoIdentification & { error?: string };
  try { payload = await response.json() as WinePhotoIdentification & { error?: string }; }
  catch { throw new Error("The wine recognition service returned an unreadable response."); }
  if (!response.ok) throw new Error(payload.error || "Could not read this wine label.");
  return payload;
}
