import { NextResponse } from "next/server";
import { createStructuredResponse, AiGenerationError } from "@/lib/openai-structured";
import { createClient } from "@/lib/supabase/server";

const recommendationSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          courseId: { type: "string" },
          courseTitle: { type: "string" },
          savedWineId: { type: "string" },
          producer: { type: "string" },
          cuvee: { type: "string" },
          vintage: { type: "integer", minimum: 0, maximum: 2200 },
          region: { type: "string" },
          country: { type: "string" },
          grapes: { type: "array", items: { type: "string" } },
          color: { type: "string", enum: ["red", "white", "orange", "rosé", "sparkling"] },
          description: { type: "string" },
          tastingNotes: { type: "string" },
          why: { type: "string" },
        },
        required: ["courseId", "courseTitle", "savedWineId", "producer", "cuvee", "vintage", "region", "country", "grapes", "color", "description", "tastingNotes", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
};

type RecommendationRequest = {
  courses?: Array<{ id?: string | number; title?: string }>;
  savedWines?: Array<Record<string, unknown>>;
};

type RecommendationResponse = {
  recommendations: Array<{
    courseId: string;
    courseTitle: string;
    savedWineId: string;
    producer: string;
    cuvee: string;
    vintage: number;
    region: string;
    country: string;
    grapes: string[];
    color: "red" | "white" | "orange" | "rosé" | "sparkling";
    description: string;
    tastingNotes: string;
    why: string;
  }>;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before asking for wine recommendations." }, { status: 401 });

  let body: RecommendationRequest;
  try { body = await request.json() as RecommendationRequest; }
  catch { return NextResponse.json({ error: "The menu could not be read." }, { status: 400 }); }

  const courses = (body.courses ?? [])
    .map((course) => ({ id: String(course.id ?? ""), title: String(course.title ?? "").trim().slice(0, 140) }))
    .filter((course) => course.id && course.title)
    .slice(0, 12);
  if (!courses.length) return NextResponse.json({ error: "Add at least one dish before asking for wine recommendations." }, { status: 400 });

  const savedWines = (body.savedWines ?? []).slice(0, 50).map((wine) => ({
    id: String(wine.id ?? ""),
    producer: String(wine.producer ?? ""),
    cuvee: String(wine.cuvee ?? ""),
    vintage: Number(wine.vintage ?? 0),
    region: String(wine.region ?? ""),
    country: String(wine.country ?? ""),
    grapes: Array.isArray(wine.grapes) ? wine.grapes.map(String).slice(0, 12) : [],
    color: String(wine.color ?? ""),
    description: String(wine.description ?? "").slice(0, 500),
    tastingNotes: String(wine.tastingNotes ?? "").slice(0, 500),
  }));

  try {
    const result = await createStructuredResponse<RecommendationResponse>({
      name: "dish_wine_recommendations",
      schema: recommendationSchema,
      instructions: [
        "You are the wine editor for At Our Table. Return exactly one thoughtful wine pairing for every supplied course, preserving each courseId and courseTitle exactly.",
        "Explain the pairing in one concrete sentence covering acidity, texture, sweetness, tannin, or aroma as relevant.",
        "Prefer a suitable saved wine when there is a genuine match; when using one, copy its id into savedWineId and copy all bottle facts exactly.",
        "Do not force an unsuitable saved wine. For a new recommendation, leave savedWineId empty and recommend a clear wine style or real producer/cuvée without inventing a vintage; use vintage 0 when uncertain.",
        "Avoid repeating the same wine across courses unless it is intentionally versatile and no better alternative exists.",
        "Description and tastingNotes should each be concise and useful. Never claim a bottle is owned or available unless its savedWineId is supplied.",
      ].join(" "),
      input: { courses, savedWines },
    });
    const byCourse = new Map(result.recommendations.map((item) => [item.courseId, item]));
    const ordered = courses.map((course) => byCourse.get(course.id)).filter((item): item is RecommendationResponse["recommendations"][number] => Boolean(item));
    if (ordered.length !== courses.length) throw new AiGenerationError("The AI did not return a pairing for every dish.");
    return NextResponse.json({ recommendations: ordered });
  } catch (cause) {
    const error = cause instanceof AiGenerationError ? cause : new AiGenerationError("The wine recommendations could not be generated.");
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}
