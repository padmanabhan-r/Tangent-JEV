# Tangent

Talk in English or an Indian language, and watch every phrase get highlighted by its topic while you're still speaking.

Tangent streams your voice through **ElevenLabs Scribe v2 Realtime** or, for Indian languages, **Sarvam's saaras:v3-realtime**, and sends each phrase to **Jev**, TypeSafe AI's decision model. Jev answers "which topic is this?" with a probability for every topic in a few hundred milliseconds. The highlight can change mid-sentence, and the bars follow where the conversation drifts.

**Live demo:** [tangent-jev.vercel.app](https://tangent-jev.vercel.app)

![Tangent highlighting a spoken conversation by topic](docs/screenshot.jpg)

## How it works

```
microphone ──► ElevenLabs Scribe v2 Realtime ─────────────┐
          └──► /api/listen relay ──► Sarvam saaras:v3 ────┤ partial + final transcripts
                                                          │
                                                          ▼
                         /api/topic ──► Jev (via OpenRouter) ──► one topic + probabilities
                                                        │
                                                        ▼
                                  highlight the phrase, update the topic bars
```

- **Two listening engines.** A switch at the top chooses **ElevenLabs** (the default) or **Sarvam (Indian languages)**. ElevenLabs: the browser gets a single-use token from `/api/scribe-token` and streams the mic straight to Scribe v2 Realtime. Sarvam: Sarvam has no short-lived browser tokens, so the browser streams 16 kHz PCM to `/api/listen`, a WebSocket relay on Vercel that adds the API key server-side and forwards to Sarvam. Both return partial text as you speak and a final phrase when you pause.
- **Indian languages, classified directly.** With Sarvam you can speak Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Urdu, Assamese, Nepali or English, or let it auto-detect. Jev classifies the text in its own script, with no translation step; Hindi, Tamil, Telugu, Kannada and Hinglish all scored 100% in testing. Picking the language shows live text in its own script; auto-detect shows live text in Latin letters until each phrase is final.
- **Classification while you talk.** Every time the partial text changes (debounced to ~220 ms), the phrase is sent to Jev as one `choice` question, together with the two previous phrases for context. Newer requests cancel older ones, so the highlight always reflects the latest words.
- **Typed answers, not text.** Jev returns the chosen topic plus a probability for every option. The probabilities drive the bars, smoothed so they drift instead of jump.
- **Your own topics.** Visitors can replace the default topics (up to 7, plus a built-in "Other") from the **Edit topics** panel. Topics live only in that browser tab.
- **Nothing is stored.** There is no database. Transcripts exist only in the page.

## Stack

- [Next.js](https://nextjs.org) (App Router) and React, styled with Tailwind CSS
- [ElevenLabs Scribe v2 Realtime](https://elevenlabs.io/realtime-speech-to-text) via `@elevenlabs/react`
- [Sarvam speech-to-text](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming) (`saaras:v3-realtime`), through a WebSocket relay built on `experimental_upgradeWebSocket` from `@vercel/functions`
- Noto Serif fonts for each Indian script, loaded only when that script is on screen
- [Jev](https://openrouter.ai/~typesafe/jev-latest) by TypeSafe AI, called through [OpenRouter](https://openrouter.ai) with the AI SDK's `experimental_evaluate` and `@ai-sdk/typesafe-ai`
- [Vercel](https://vercel.com) for hosting and Web Analytics

## Run it locally

You need Node.js 22 or newer and up to three API keys:

| Variable | Where to get it |
|---|---|
| `ELEVENLABS_API_KEY` | [ElevenLabs → API keys](https://elevenlabs.io/app/settings/api-keys). Needs speech-to-text access. |
| `OPENROUTER_API_KEY` | [OpenRouter → Keys](https://openrouter.ai/settings/keys). Set a credit limit on the key; see [Cost](#cost). |
| `SARVAM_API_KEY` | [Sarvam dashboard](https://dashboard.sarvam.ai). Optional: only needed for the Sarvam engine. |

```bash
git clone https://github.com/padmanabhan-r/Tangent-JEV.git
cd Tangent-JEV
npm install
cp .env.example .env.local   # then paste your keys into .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), press **Start talking** and allow the microphone. No mic? Type into the box under the transcript and press Enter; it goes through the same pipeline.

The Sarvam relay needs Vercel's runtime for WebSocket upgrades, so under `npm run dev` only the ElevenLabs engine can listen. Test Sarvam on a Vercel deployment.

## Deploy to Vercel

```bash
npm i -g vercel
vercel link
vercel env add ELEVENLABS_API_KEY production
vercel env add OPENROUTER_API_KEY production
vercel env add SARVAM_API_KEY production      # optional, for the Sarvam engine
vercel deploy --prod
```

Hosting runs on Vercel's free Hobby plan. To see visitors by country, referrer and device, open your project's **Analytics** tab in the Vercel dashboard and enable Web Analytics; the `<Analytics />` component is already in `app/layout.tsx`.

## Customising topics

- **In the app:** press **Edit topics**, name up to 7 topics and add a few words of description for each (descriptions help Jev tell similar topics apart). Presets for News, Startup and Sports are one click away.
- **Defaults and presets:** edit `PRESETS` in `lib/topics.ts`. The first preset is the default.

Tip: avoid topics that overlap heavily (for example "Finance" and "Business" as separate topics). Jev will split its probability between them and the highlight will flicker.

## Cost

Jev on OpenRouter costs about **$0.042 per million input tokens**, and output is free. A Tangent call is roughly 400 input tokens, so:

| Usage | Approximate cost |
|---|---|
| One classification | $0.000017 |
| 10 minutes of continuous talking (~1,500 calls) | $0.025 |
| $2 of credit | ~118,000 calls |

Give your OpenRouter key a spending limit. When it's reached, the app shows "Jev stopped: the OpenRouter key has reached its spending limit" instead of failing silently. The `/api/topic` route also limits each visitor to 240 calls a minute. ElevenLabs transcription is billed to your ElevenLabs account per minute of audio.

Sarvam bills by the length of audio streamed, silence included, so an open microphone keeps costing. To protect limited credits, a Sarvam session ends after 3 minutes (the page says so and the visitor can start again) and each visitor gets 6 Sarvam sessions an hour. Change `SESSION_MS` and the rate limit in `app/api/listen/route.ts`.

## Project structure

```
app/
  api/scribe-token/route.ts   single-use ElevenLabs Scribe token
  api/listen/route.ts         WebSocket relay to Sarvam (keeps the key server-side)
  api/topic/route.ts          validates topics and asks Jev for the topic of a phrase
  layout.tsx                  fonts (incl. Indian scripts), metadata, Vercel Analytics
components/
  Tangent.tsx                 transcript, topic panel, start popup, type-instead box
  TopicEditor.tsx             the Edit topics dialog
lib/
  useTangent.ts               mic → speech-to-text → Jev pipeline, engine switch, smoothing
  useSarvam.ts                mic capture (AudioWorklet, 16 kHz PCM) and the Sarvam relay client
  languages.ts                languages Sarvam can transcribe
  topics.ts                   presets, validation, colours
  rateLimit.ts                per-visitor rate limiting
```
