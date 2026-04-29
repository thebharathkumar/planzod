import crypto from "node:crypto";
import { EVENT_CATEGORIES } from "@planzo/shared";

type SeededRandom = () => number;

function createSeededRandom(seed: string): SeededRandom {
  let state = crypto.createHash("sha256").update(seed).digest();
  return () => {
    state = crypto.createHash("sha256").update(state).digest();
    return state.readUInt32BE(0) / 0xffffffff;
  };
}

function pick<T>(rand: SeededRandom, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

function pickMany<T>(rand: SeededRandom, list: T[], count: number): T[] {
  const copy = [...list];
  const out: T[] = [];
  while (copy.length && out.length < count) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

const TAGS = [
  "Beginner-friendly",
  "Hands-on",
  "Networking",
  "Limited seats",
  "Family-friendly",
  "Interactive",
  "Local spotlight",
  "Community-powered",
  "Expert-led",
  "After-hours"
];

const THEMES = [
  "creative",
  "tech",
  "wellness",
  "outdoor",
  "career",
  "music",
  "food",
  "entrepreneurship",
  "design",
  "community"
];

const OPENERS = [
  "Join us for an immersive experience that blends learning, connection, and fun.",
  "An intimate gathering crafted for curious minds and local community builders.",
  "A high‑energy session built to help you level up quickly.",
  "A relaxed, hands‑on event where you can learn by doing."
];

const DESCRIPTIONS = [
  "Expect guided activities, small-group collaboration, and time to meet fellow attendees.",
  "We’ll move fast, but keep things approachable with structured checkpoints and helpers on hand.",
  "Bring your questions—this is designed to be interactive from start to finish.",
  "You’ll leave with practical takeaways, fresh contacts, and a plan for what’s next."
];

const OUTCOMES = [
  "a clear action plan",
  "new local connections",
  "a set of practical skills",
  "hands‑on practice",
  "confidence to keep going",
  "templates you can reuse"
];

const FAQS = [
  {
    q: "Who is this for?",
    a: "Anyone interested in learning something new and meeting people nearby. No prior experience required."
  },
  {
    q: "What should I bring?",
    a: "A laptop if you want to follow along, plus a positive attitude. We’ll provide the rest."
  },
  {
    q: "Are refunds available?",
    a: "Yes—full refunds up to 48 hours before the event start time."
  },
  {
    q: "Is there a waitlist?",
    a: "If tickets sell out, you can join the waitlist and we’ll notify you if a seat opens."
  }
];

const AGENDA_BLOCKS = [
  "Check‑in & coffee",
  "Welcome + overview",
  "Hands‑on session",
  "Break",
  "Deep‑dive workshop",
  "Networking",
  "Wrap‑up + next steps"
];

const PRICING_TIERS = [
  { name: "General Admission", priceCents: 2500, qty: 60 },
  { name: "Early Bird", priceCents: 1500, qty: 20 },
  { name: "VIP + Q&A", priceCents: 5000, qty: 10 }
];

export function generateEventCopy(input: {
  title: string;
  category?: string;
  audience?: string;
  lengthMinutes?: number;
  seed?: string;
}) {
  const seed = input.seed ?? `${input.title}-${input.category ?? "other"}`;
  const rand = createSeededRandom(seed);
  const theme = pick(rand, THEMES);
  const tags = pickMany(rand, TAGS, 4);
  const opener = pick(rand, OPENERS);
  const desc = pick(rand, DESCRIPTIONS);
  const outcomes = pickMany(rand, OUTCOMES, 3).join(", ");

  const description = [
    opener,
    `This ${theme}-focused session is built for ${input.audience ?? "curious locals"} who want ${outcomes}.`,
    desc
  ].join(" ");

  const agenda = pickMany(rand, AGENDA_BLOCKS, 5).map((item, idx) => ({
    time: idx === 0 ? "00:00" : `00:${String(idx * 20).padStart(2, "0")}`,
    item
  }));

  const faqs = pickMany(rand, FAQS, 3);

  const suggestedCategory = EVENT_CATEGORIES.includes((input.category ?? "other") as any)
    ? input.category
    : pick(rand, EVENT_CATEGORIES);

  return {
    description,
    tags,
    agenda,
    faqs,
    suggestedCategory
  };
}

export function generateTicketTiers(seed: string) {
  const rand = createSeededRandom(seed);
  return pickMany(rand, PRICING_TIERS, 2);
}

export function generateEventName(seed: string) {
  const rand = createSeededRandom(seed);
  const adjectives = ["Local", "Spark", "Next‑Gen", "Neighborhood", "Creative", "Momentum", "Weekend"];
  const nouns = ["Lab", "Session", "Meetup", "Showcase", "Studio", "Pop‑Up", "Series"];
  return `${pick(rand, adjectives)} ${pick(rand, nouns)}`;
}

const CATEGORY_HINTS: Array<{ category: string; keywords: string[] }> = [
  { category: "workshop", keywords: ["workshop", "hands-on", "bootcamp", "lab", "training"] },
  { category: "class", keywords: ["class", "course", "lesson", "learn", "tutorial"] },
  { category: "meetup", keywords: ["meetup", "networking", "community", "social", "coffee"] },
  { category: "concert", keywords: ["concert", "music", "live", "gig", "band", "dj"] },
  { category: "community", keywords: ["community", "neighborhood", "volunteer", "local"] },
  { category: "sports", keywords: ["sports", "run", "fitness", "workout", "yoga", "cycling"] },
  { category: "food", keywords: ["food", "tasting", "cooking", "dinner", "brunch"] },
  { category: "arts", keywords: ["art", "design", "gallery", "painting", "creative"] }
];

export function suggestCategoryFromText(text: string) {
  const normalized = text.toLowerCase();
  for (const entry of CATEGORY_HINTS) {
    if (entry.keywords.some((k) => normalized.includes(k))) {
      return entry.category;
    }
  }
  return "other";
}
