import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 20 * 1024 * 1024;
export const maxDuration = 300;

// Use the author's full, pinned skill prompt at runtime instead of redistributing
// or loosely paraphrasing it in this public repository.
// Personal/non-commercial license: https://github.com/ZzzLc0405/photo-abstract-editorial
const editorialSkillPromptUrl = "https://raw.githubusercontent.com/ZzzLc0405/photo-abstract-editorial/49e55073d6d0330274d31f75d27f5dd6eb35fd6d/references/photo-abstract-editorial-prompt.en.md";

async function loadEditorialSkillPrompt() {
  const response = await fetch(editorialSkillPromptUrl, { cache: "force-cache", headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`Photo Abstract Editorial prompt returned ${response.status}.`);
  const prompt = await response.text();
  if (prompt.length < 5000 || !prompt.includes("DECONSTRUCT") || !prompt.includes("CLEAN mode")) throw new Error("Photo Abstract Editorial prompt did not pass validation.");
  return prompt;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Editorial cover generation is not configured yet." }, { status: 503 });

  let body: { dinnerId?: string; photoId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "The cover request could not be read." }, { status: 400 }); }
  if (!body.dinnerId || !body.photoId) return NextResponse.json({ error: "Choose a dinner photo for the cover." }, { status: 400 });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sign in to create a cover." }, { status: 401 });

  const [{ data: dinner, error: dinnerError }, { data: photo, error: photoError }] = await Promise.all([
    supabase.from("dinners").select("id,space_id,cover_photo_path").eq("id", body.dinnerId).single(),
    supabase.from("photos").select("id,dinner_id,storage_path").eq("id", body.photoId).eq("dinner_id", body.dinnerId).single(),
  ]);
  if (dinnerError || photoError || !dinner || !photo) return NextResponse.json({ error: "This dinner photo is not available in your space." }, { status: 404 });

  const { data: source, error: downloadError } = await supabase.storage.from("dinner-media").download(photo.storage_path);
  if (downloadError || !source) return NextResponse.json({ error: "The selected photo could not be opened." }, { status: 502 });
  if (!allowedTypes.has(source.type) || source.size > maxPhotoBytes) return NextResponse.json({ error: "Choose a JPEG, PNG, or WebP photo smaller than 20 MB." }, { status: 400 });

  let normalizedSource: Buffer;
  try {
    normalizedSource = await sharp(Buffer.from(await source.arrayBuffer()))
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#f3f0e8" })
      .toColourspace("srgb")
      .png()
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "This photo could not be decoded. Try exporting it as a standard JPEG or PNG." }, { status: 400 });
  }

  let editorialPrompt: string;
  try { editorialPrompt = await loadEditorialSkillPrompt(); }
  catch { return NextResponse.json({ error: "The Photo Abstract Editorial style instructions are temporarily unavailable. Try again in a moment." }, { status: 503 }); }

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst");
  const normalizedBytes = Uint8Array.from(normalizedSource);
  form.append("image[]", new Blob([normalizedBytes], { type: "image/png" }), "dinner-photo.png");
  form.append("prompt", editorialPrompt);
  form.append("size", "1024x1536");
  form.append("quality", "high");
  form.append("output_format", "webp");

  let imageResponse: Response;
  try { imageResponse = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form }); }
  catch { return NextResponse.json({ error: "The editorial cover service is temporarily unavailable." }, { status: 502 }); }

  const imageResult = await imageResponse.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  if (!imageResponse.ok) return NextResponse.json({ error: imageResult.error?.message || "The editorial cover could not be created." }, { status: 502 });
  const encoded = imageResult.data?.[0]?.b64_json;
  if (!encoded) return NextResponse.json({ error: "The editorial cover service returned no image." }, { status: 502 });

  const coverPath = `${dinner.space_id}/${dinner.id}/covers/${crypto.randomUUID()}.webp`;
  let coverBytes: Buffer;
  try {
    const generated = sharp(Buffer.from(encoded, "base64"));
    const metadata = await generated.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Missing generated image dimensions.");

    // The skill creates a faithful photo + abstract memory panel. At Our Table
    // uses only that lower panel as the reusable journal cover.
    const panelHeight = Math.max(1, Math.round(metadata.height / 3));
    coverBytes = await generated
      .extract({ left: 0, top: metadata.height - panelHeight, width: metadata.width, height: panelHeight })
      .webp({ quality: 92 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "The generated editorial panel could not be prepared." }, { status: 502 });
  }
  const { error: uploadError } = await supabase.storage.from("dinner-media").upload(coverPath, coverBytes, { contentType: "image/webp" });
  if (uploadError) return NextResponse.json({ error: "The generated cover could not be saved." }, { status: 502 });

  const { error: updateError } = await supabase.from("dinners").update({ cover_photo_path: coverPath }).eq("id", dinner.id).eq("space_id", dinner.space_id);
  if (updateError) { await supabase.storage.from("dinner-media").remove([coverPath]); return NextResponse.json({ error: "The dinner cover could not be updated." }, { status: 502 }); }
  if (dinner.cover_photo_path && dinner.cover_photo_path !== coverPath) await supabase.storage.from("dinner-media").remove([dinner.cover_photo_path]);

  const { data: signed, error: signedError } = await supabase.storage.from("dinner-media").createSignedUrl(coverPath, 3600);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "The saved cover could not be displayed." }, { status: 502 });
  return NextResponse.json({ coverImage: signed.signedUrl });
}
