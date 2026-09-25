import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import WebSocket from "ws";
import { isLanguage } from "@/lib/languages";
import { createRateLimiter } from "@/lib/rateLimit";

// A WebSocket relay: the browser streams 16 kHz mono PCM here, and this function forwards it to
// Sarvam's realtime speech-to-text with the API key in a header. Sarvam has no short-lived browser
// tokens, so the key must never reach the page.
export const maxDuration = 300;

// Sarvam credits are limited: a session ends after 3 minutes (the browser says why, and the user
// can start again), and each visitor gets a handful of sessions an hour.

const SARVAM_URL = "wss://api.sarvam.ai/speech-to-text-realtime/ws";
const SESSION_MS = 180_000; // closes with 4001 "limit"
const FORWARD = new Set(["transcript.partial", "transcript.final", "vad.speech_start", "vad.speech_end", "error"]);
const rateLimited = createRateLimiter(6, 60 * 60_000);

function sameSite(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    const o = new URL(origin);
    return o.host === host || o.hostname === "localhost";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return new Response("SARVAM_API_KEY is not set on the server.", { status: 500 });
  if (!sameSite(req)) return new Response("Forbidden", { status: 403 });
  if (rateLimited(req)) return new Response("Too many Sarvam sessions this hour.", { status: 429 });

  const language = new URL(req.url).searchParams.get("language");
  const params = new URLSearchParams({
    language_code: isLanguage(language) ? language : "auto",
    model: "saaras:v3-realtime",
    mode: "transcribe",
    stream_type: "fast",
    encoding: "linear16",
    sample_rate: "16000",
    silence_duration_ms: "700",
  });

  return experimental_upgradeWebSocket((client) => {
    const upstream = new WebSocket(`${SARVAM_URL}?${params}`, { headers: { "api-subscription-key": key } });
    const queue: string[] = [];
    let closed = false;

    const close = (code = 1000, reason = "") => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(JSON.stringify({ event: "end" }));
        upstream.close();
      } else if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    };
    const timer = setTimeout(() => close(4001, "limit"), SESSION_MS);

    upstream.on("open", () => {
      for (const m of queue.splice(0)) upstream.send(m);
      client.send(JSON.stringify({ event: "ready" }));
    });
    upstream.on("message", (data: WebSocket.RawData) => {
      let msg: { event?: string };
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.event && FORWARD.has(msg.event) && client.readyState === WebSocket.OPEN) client.send(JSON.stringify(msg));
    });
    upstream.on("unexpected-response", (_r, res) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ event: "error", message: `Sarvam refused the connection (${res.statusCode}).` }));
      close(1011, "upstream");
    });
    upstream.on("error", () => close(1011, "upstream"));
    upstream.on("close", () => close(1000, "done"));

    client.on("message", (data: WebSocketData, isBinary: boolean) => {
      if (!isBinary) return;
      const buf = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
      if (buf.length === 0 || buf.length > 64_000) return; // ~2 s of 16 kHz PCM at most per frame
      const m = JSON.stringify({ event: "audio_input", audio: buf.toString("base64") });
      if (upstream.readyState === WebSocket.OPEN) upstream.send(m);
      else if (upstream.readyState === WebSocket.CONNECTING && queue.length < 50) queue.push(m);
    });
    client.on("close", () => close());
    client.on("error", () => close());
  });
}
