export type Topic = { id: string; label: string; description: string };

export const OTHER: Topic = {
  id: "other",
  label: "Other",
  description: "Greetings, small talk, filler, or anything outside the other topics",
};

export const MAX_TOPICS = 7;
export const MAX_LABEL = 30;
export const MAX_DESCRIPTION = 120;

export const PRESETS: { name: string; topics: Omit<Topic, "id">[] }[] = [
  {
    name: "News",
    topics: [
      { label: "Business & Finance", description: "Companies, markets, stocks, the economy, banking, money, jobs, trade" },
      { label: "Technology", description: "Tech companies, AI, software, gadgets, the internet, startups, cybersecurity" },
      { label: "Health", description: "Medicine, hospitals, disease, fitness, diet, sleep, mental health" },
      { label: "Education", description: "Schools, universities, teachers, students, exams, learning" },
      { label: "Politics", description: "Government, elections, parties, policy, laws, ministers, diplomacy" },
      { label: "Sports", description: "Cricket, football, tennis, matches, players, tournaments, scores" },
    ],
  },
  {
    name: "Startup",
    topics: [
      { label: "Product", description: "Features, roadmap, users, design, feedback, launches" },
      { label: "Fundraising", description: "Investors, VCs, pitch decks, valuation, rounds, runway" },
      { label: "Hiring", description: "Recruiting, interviews, team, culture, salaries" },
      { label: "Marketing", description: "Growth, ads, social media, brand, content, SEO" },
      { label: "Engineering", description: "Code, bugs, infrastructure, deploys, architecture" },
    ],
  },
  {
    name: "Sports",
    topics: [
      { label: "Cricket", description: "Batting, bowling, wickets, overs, IPL, Test matches" },
      { label: "Football", description: "Goals, transfers, Premier League, World Cup, strikers" },
      { label: "Tennis", description: "Grand Slams, serves, sets, Wimbledon, rallies" },
      { label: "Formula 1", description: "Races, drivers, pit stops, qualifying, teams, cars" },
      { label: "Fitness", description: "Training, gym, running, recovery, nutrition" },
    ],
  },
];

export function slugify(label: string, taken: Set<string>) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "topic";
  let id = base;
  for (let n = 2; taken.has(id) || id === OTHER.id; n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

export function withIds(topics: Omit<Topic, "id">[]): Topic[] {
  const taken = new Set<string>();
  return topics.map((t) => ({ ...t, id: slugify(t.label, taken) }));
}

export const DEFAULT_TOPICS = withIds(PRESETS[0].topics);

// Validates topics sent by the browser. Returns null when they can't be used.
export function sanitizeTopics(input: unknown): Topic[] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > MAX_TOPICS) return null;
  const topics: Topic[] = [];
  const ids = new Set<string>();
  for (const raw of input) {
    const t = raw as Partial<Topic> | null;
    if (!t || typeof t.id !== "string" || typeof t.label !== "string") return null;
    if (!/^[a-z0-9_]{1,30}$/.test(t.id) || t.id === OTHER.id || ids.has(t.id)) return null;
    const label = t.label.trim().slice(0, MAX_LABEL);
    if (!label) return null;
    const description = typeof t.description === "string" ? t.description.trim().slice(0, MAX_DESCRIPTION) : "";
    ids.add(t.id);
    topics.push({ id: t.id, label, description });
  }
  return topics;
}

export type Distribution = Record<string, number>;

export type TopicReading = {
  topic: string;
  probabilities: Distribution;
  confidence: number | null;
  ms: number;
};

export function evenDistribution(ids: string[]): Distribution {
  return Object.fromEntries(ids.map((id) => [id, 1 / ids.length]));
}

// Palette slots defined in globals.css (--p0 … --p6); Other always uses --t-other.
export function colorVar(topics: Topic[], id: string | null | undefined) {
  const i = topics.findIndex((t) => t.id === id);
  return i === -1 ? "var(--t-other)" : `var(--p${i})`;
}
