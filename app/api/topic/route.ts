import { createTypeSafeAi } from "@ai-sdk/typesafe-ai";
import { experimental_evaluate as evaluate } from "ai";
import { createRateLimiter } from "@/lib/rateLimit";
import { OTHER, sanitizeTopics, type Distribution, type TopicReading } from "@/lib/topics";

// Jev through OpenRouter's TypeSafe-compatible endpoint (POST /api/v1/systemone).
const jev = createTypeSafeAi({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
}).evaluationModel("~typesafe/jev-latest");

const MAX_CHARS = 600;
const rateLimited = createRateLimiter(240, 60_000);

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "OPENROUTER_API_KEY is not set on the server." }, { status: 500 });
  }
  if (rateLimited(req)) {
    return Response.json({ error: "Too many requests. Pause for a minute." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    current?: unknown;
    previous?: unknown;
    topics?: unknown;
  } | null;
  const current = typeof body?.current === "string" ? body.current.trim().slice(-MAX_CHARS) : "";
  const previous = Array.isArray(body?.previous)
    ? body.previous.filter((p): p is string => typeof p === "string").slice(-2).map((p) => p.slice(-MAX_CHARS))
    : [];
  if (!current) {
    return Response.json({ error: "Nothing to classify." }, { status: 400 });
  }
  const topics = sanitizeTopics(body?.topics);
  if (!topics) {
    return Response.json({ error: "Topics need 2 to 7 named entries." }, { status: 400 });
  }

  const options = [...topics, OTHER];
  const criteria = Object.fromEntries(
    options.map((t) => [t.id, t.description ? `${t.label}: ${t.description}` : t.label]),
  );

  const started = performance.now();
  try {
    const result = await evaluate({
      model: jev,
      state: { current, previous },
      questions: {
        topic: {
          type: "choice",
          instructions:
            "Which topic is the speaker talking about in `current`? Use `previous` only as context for short or ambiguous phrases.",
          criteria,
        },
      },
      abortSignal: req.signal,
      maxRetries: 0,
    });

    const answer = result.answers.topic;
    const confidence = (result.providerMetadata?.typesafe?.confidence as Record<string, number> | undefined)?.topic;
    const reading: TopicReading = {
      topic: answer.choice,
      probabilities:
        (answer.probabilities as Distribution | undefined) ??
        Object.fromEntries(options.map((t) => [t.id, t.id === answer.choice ? 1 : 0])),
      confidence: typeof confidence === "number" ? confidence : null,
      ms: Math.round(performance.now() - started),
    };
    return Response.json(reading);
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    const message = err instanceof Error ? err.message : String(err);
    console.error("[jev]", message);
    const hint = /limit|credit|402/i.test(message)
      ? "Jev stopped: the OpenRouter key has reached its spending limit."
      : "Jev could not classify that phrase.";
    return Response.json({ error: hint }, { status: 502 });
  }
}
