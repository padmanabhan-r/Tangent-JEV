export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY is not set on the server." }, { status: 500 });
  }

  const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    return Response.json({ error: `ElevenLabs refused the token request (${res.status}).` }, { status: 502 });
  }

  const { token } = (await res.json()) as { token: string };
  return Response.json({ token });
}
