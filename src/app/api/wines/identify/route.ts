import { NextResponse } from "next/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 10 * 1024 * 1024;

const wineSchema = {
  type: "object",
  properties: {
    producer: { type: "string" },
    cuvee: { type: "string" },
    vintage: { type: "integer", minimum: 0, maximum: 2200 },
    region: { type: "string" },
    country: { type: "string" },
    grapes: { type: "array", items: { type: "string" } },
    color: { type: "string", enum: ["red", "white", "orange", "rosé", "sparkling", "unknown"] },
    description: { type: "string" },
    tastingNotes: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" } },
  },
  required: ["producer", "cuvee", "vintage", "region", "country", "grapes", "color", "description", "tastingNotes", "confidence", "evidence"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Wine photo recognition is not configured yet. Add OPENAI_API_KEY to the server environment." }, { status: 503 });
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (process.env.NODE_ENV === "production" && !supabaseConfigured) return NextResponse.json({ error: "Wine photo recognition requires sign-in in production." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxPhotoBytes * 2 + 1_000_000) return NextResponse.json({ error: "The wine photos are too large." }, { status: 413 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "The uploaded wine photos could not be read." }, { status: 400 }); }
  const photos = form.getAll("photos").filter((value): value is File => value instanceof File).slice(0, 2);
  if (!photos.length) return NextResponse.json({ error: "Add a clear photo of the front label." }, { status: 400 });
  for (const photo of photos) {
    if (!allowedTypes.has(photo.type)) return NextResponse.json({ error: "Wine photos must be JPEG, PNG, or WebP." }, { status: 400 });
    if (photo.size > maxPhotoBytes) return NextResponse.json({ error: "Each wine photo must be smaller than 10 MB." }, { status: 400 });
  }

  const imageInputs = await Promise.all(photos.map(async (photo) => ({
    type: "input_image",
    detail: "high",
    image_url: `data:${photo.type};base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`,
  })));

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_WINE_MODEL || "gpt-5-mini",
        store: false,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Read these front/back wine bottle photos as one bottle. Extract only facts visible on the labels. Use empty strings, an empty array, vintage 0, or color unknown when uncertain; never invent a producer, vintage, or grapes. Then draft a concise editorial introduction and a clearly provisional tasting profile using only the visible region, color, and grapes. Preserve accent marks. Evidence should list the short label phrases that support the identity. Confidence is overall label-reading confidence from 0 to 1." },
            ...imageInputs,
          ],
        }],
        text: { format: { type: "json_schema", name: "wine_label_identification", strict: true, schema: wineSchema } },
      }),
    });
  } catch { return NextResponse.json({ error: "The wine recognition service is temporarily unavailable." }, { status: 502 }); }

  const data = await response.json() as { error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (!response.ok) return NextResponse.json({ error: data.error?.message || "The wine recognition service could not read this label." }, { status: 502 });
  const outputText = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!outputText) return NextResponse.json({ error: "The wine recognition service returned no label details." }, { status: 502 });
  try { return NextResponse.json(JSON.parse(outputText)); }
  catch { return NextResponse.json({ error: "The wine recognition result could not be read." }, { status: 502 }); }
}
