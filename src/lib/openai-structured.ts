type JsonSchema = Record<string, unknown>;

type StructuredResponseOptions = {
  name: string;
  schema: JsonSchema;
  instructions: string;
  input: unknown;
};

export class AiGenerationError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export async function createStructuredResponse<T>({ name, schema, instructions, input }: StructuredResponseOptions): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiGenerationError("AI suggestions are not configured yet. Add OPENAI_API_KEY to the server environment.", 503);
  const model = process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_WINE_MODEL || "gpt-5-mini";
  const usesReasoningControls = model.startsWith("gpt-5");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        instructions,
        input: JSON.stringify(input),
        max_output_tokens: 6000,
        ...(usesReasoningControls ? { reasoning: { effort: "minimal" } } : {}),
        text: { ...(usesReasoningControls ? { verbosity: "low" } : {}), format: { type: "json_schema", name, strict: true, schema } },
      }),
    });
  } catch {
    throw new AiGenerationError("The AI suggestion service is temporarily unavailable.");
  }

  const data = await response.json() as {
    error?: { code?: string; message?: string };
    status?: string;
    incomplete_details?: { reason?: string };
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (!response.ok) {
    const code = data.error?.code;
    if (code === "insufficient_quota") throw new AiGenerationError("The OpenAI API account has no available quota. Add billing or credits, then try again.", 503);
    if (code === "invalid_api_key") throw new AiGenerationError("The OpenAI API key is invalid. Replace OPENAI_API_KEY, then restart the app.", 503);
    throw new AiGenerationError("The AI suggestion could not be generated right now.");
  }

  const outputText = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens") {
    throw new AiGenerationError("The AI response ran out of room before it finished. Please try again.");
  }
  if (!outputText) throw new AiGenerationError("The AI suggestion returned no usable result.");
  try { return JSON.parse(outputText) as T; }
  catch { throw new AiGenerationError("The AI suggestion returned an unreadable result."); }
}
