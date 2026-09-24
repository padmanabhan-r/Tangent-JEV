// Per-instance sliding window. Good enough to slow down a single abuser; the OpenRouter
// key's own spending cap is the hard backstop.
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > max;
  };
}
