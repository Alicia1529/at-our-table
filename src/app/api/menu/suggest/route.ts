import { NextResponse } from "next/server";
import { createStructuredResponse, AiGenerationError } from "@/lib/openai-structured";
import { createClient } from "@/lib/supabase/server";

const menuSchema = {
  type: "object",
  properties: {
    courses: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      },
    },
    note: { type: "string" },
  },
  required: ["courses", "note"],
  additionalProperties: false,
};

type MenuRequest = {
  locationType?: "home" | "restaurant";
  venue?: string;
  title?: string;
  guests?: string;
  previousCourses?: string[];
};

type MenuResponse = { courses: Array<{ title: string }>; note: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before asking for a menu suggestion." }, { status: 401 });

  let body: MenuRequest;
  try { body = await request.json() as MenuRequest; }
  catch { return NextResponse.json({ error: "The dinner details could not be read." }, { status: 400 }); }

  try {
    const result = await createStructuredResponse<MenuResponse>({
      name: "dinner_menu_suggestion",
      schema: menuSchema,
      instructions: [
        "You are the thoughtful menu editor for At Our Table.",
        "Create exactly three concise, cookable dinner course names: a first course, a main course, and a dessert.",
        "Use the gathering context when it is present. Keep each title under 70 characters.",
        "The menu should feel coherent, seasonal, and specific rather than generic.",
        "Never repeat any title in previousCourses. If previousCourses are present, change the ingredients and overall direction substantially.",
        "The note is one short editorial sentence describing the menu's point of view.",
      ].join(" "),
      input: {
        locationType: body.locationType === "restaurant" ? "restaurant" : "home",
        venue: String(body.venue ?? "").slice(0, 160),
        dinnerTitle: String(body.title ?? "").slice(0, 160),
        guests: String(body.guests ?? "").slice(0, 300),
        previousCourses: Array.isArray(body.previousCourses) ? body.previousCourses.map((item) => String(item).slice(0, 100)).slice(0, 12) : [],
        variationCue: `${new Date().toISOString()}-${crypto.randomUUID()}`,
      },
    });
    return NextResponse.json(result);
  } catch (cause) {
    const error = cause instanceof AiGenerationError ? cause : new AiGenerationError("The menu suggestion could not be generated.");
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}
