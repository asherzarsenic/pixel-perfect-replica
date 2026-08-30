import { EMPTY_ANALYSIS, type BriefAnalysis } from "./brief-types";

const SYSTEM_PROMPT = `You are the analysis engine inside BRIEF BUSTER, a professional utility for freelance designers.

You analyse a client brief and report problems BEFORE work begins. Rules:
- Never invent information that is not present in the brief. Empty is better than fabricated.
- Be calm, professional and analytical. Never call the client difficult or "bad".
- Prioritise the smallest useful set of findings. Do not pad lists.
- For contradictions, explain the conflict in 1-2 sentences and never decide which side is correct.
- "brutal" is a private designer-only view: direct, practical, never insulting or psychoanalysing the client.
- "protectMessage" is a polite, confident, concise message the designer can send to the client asking for clarification.

Respond with ONLY a JSON object matching exactly this shape:
{
  "projectName": string,
  "summary": {
    "deliverables": string[], "quantity": string, "styleDirection": string,
    "requirements": string[], "deadline": string, "platform": string,
    "audience": string, "assetsMentioned": string[]
  },
  "clarifications": [{ "item": string, "whyItMatters": string, "question": string }],
  "contradictions": [{ "title": string, "detail": string }],
  "scopeRisks": [{ "title": string, "detail": string }],
  "translations": [{ "phrase": string, "couldMean": string, "askThis": string }],
  "questions": string[],
  "protectMessage": string,
  "brutal": [{ "problem": string, "risk": string, "recommendation": string }]
}
Use "" or [] where the brief gives no information.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text) ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function asObjectArray<T>(value: unknown, keys: (keyof T & string)[]): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => {
      const out = {} as Record<string, string>;
      for (const k of keys) out[k] = typeof v[k] === "string" ? (v[k] as string) : "";
      return out as T;
    })
    .filter((v) => Object.values(v as Record<string, string>).some((s) => s.trim().length > 0));
}

function normalize(input: unknown): BriefAnalysis {
  const o = (input ?? {}) as Record<string, unknown>;
  const s = (o["summary"] ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    projectName: str(o["projectName"]) || EMPTY_ANALYSIS.projectName,
    summary: {
      deliverables: asStringArray(s["deliverables"]),
      quantity: str(s["quantity"]),
      styleDirection: str(s["styleDirection"]),
      requirements: asStringArray(s["requirements"]),
      deadline: str(s["deadline"]),
      platform: str(s["platform"]),
      audience: str(s["audience"]),
      assetsMentioned: asStringArray(s["assetsMentioned"]),
    },
    clarifications: asObjectArray(o.clarifications, ["item", "whyItMatters", "question"]),
    contradictions: asObjectArray(o.contradictions, ["title", "detail"]),
    scopeRisks: asObjectArray(o.scopeRisks, ["title", "detail"]),
    translations: asObjectArray(o.translations, ["phrase", "couldMean", "askThis"]),
    questions: asStringArray(o["questions"]),
    protectMessage: str(o["protectMessage"]),
    brutal: asObjectArray(o.brutal, ["problem", "risk", "recommendation"]),
  };
}

export async function runBriefAnalysis(
  brief: string,
  context: Record<string, string | undefined>,
): Promise<BriefAnalysis> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const contextLines = Object.entries(context)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const userPrompt = [
    "CLIENT BRIEF:",
    brief.trim(),
    contextLines ? `\nDESIGNER-SUPPLIED CONTEXT (treat as known facts):\n${contextLines}` : "",
  ].join("\n");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
  if (!res.ok) throw new Error(`Analysis failed (${res.status}). Please try again.`);

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("The analysis came back empty. Please try again.");

  return normalize(extractJson(content));
}
