// Resilient fetch wrapper. If the API is unreachable we transparently
// fall back to mock data so the SPA still demos a full experience even
// when deployed alone (e.g. Vercel) without a backend.
import { API_BASE_URL } from "./env";
import { MOCK_EVENTS, filterMockEvents, findMockEvent } from "./mockData";

let apiAvailable: boolean | null = null;

async function probe(): Promise<boolean> {
  if (apiAvailable !== null) return apiAvailable;
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    apiAvailable = res.ok;
  } catch {
    apiAvailable = false;
  }
  return apiAvailable;
}

export function isMockMode(): boolean {
  return apiAvailable === false;
}

export async function searchEvents(params: {
  category?: string;
  price?: "any" | "free" | "paid";
  startingSoon?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}): Promise<{ results: any[]; mock: boolean }> {
  if (await probe()) {
    try {
      const search = new URLSearchParams();
      if (params.lat) search.set("lat", String(params.lat));
      if (params.lng) search.set("lng", String(params.lng));
      if (params.radiusKm) search.set("radiusKm", String(params.radiusKm));
      if (params.price) search.set("price", params.price);
      if (params.category) search.set("category", params.category);
      if (params.startingSoon) {
        const now = new Date();
        const soonEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        search.set("from", now.toISOString());
        search.set("to", soonEnd.toISOString());
      }
      const res = await fetch(
        `${API_BASE_URL}/search/events?${search.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        return { results: data.results ?? [], mock: false };
      }
    } catch {
      apiAvailable = false;
    }
  }
  return {
    results: filterMockEvents({
      category: params.category,
      price: params.price,
      startingSoon: params.startingSoon,
    }),
    mock: true,
  };
}

export async function getEvent(id: string): Promise<{
  event: any;
  ticketTiers: any[];
  aiFaqs: any[];
  mock: boolean;
} | null> {
  if (await probe()) {
    try {
      const res = await fetch(`${API_BASE_URL}/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        return { ...data, mock: false };
      }
    } catch {
      apiAvailable = false;
    }
  }
  const e = findMockEvent(id);
  if (!e) return null;
  return {
    event: e,
    ticketTiers: e.tiers,
    aiFaqs: [
      {
        q: "Who is this for?",
        a: "Anyone interested in " + e.tags.join(", ").toLowerCase() + ".",
      },
      {
        q: "Are refunds available?",
        a: "Full refunds up to 48 hours before the start time.",
      },
      { q: "What should I bring?", a: "Just yourself and your enthusiasm." },
    ],
    mock: true,
  };
}

export async function getRecommendedEvents(): Promise<{
  events: any[];
  mock: boolean;
}> {
  if (await probe()) {
    try {
      const res = await fetch(`${API_BASE_URL}/recommendations?limit=6`);
      if (res.ok) {
        const data = await res.json();
        return { events: data.events ?? [], mock: false };
      }
    } catch {
      apiAvailable = false;
    }
  }
  return { events: MOCK_EVENTS.slice(0, 6), mock: true };
}

export async function getFeaturedEvents(): Promise<any[]> {
  if (await probe()) {
    try {
      const res = await fetch(`${API_BASE_URL}/campaigns/featured-events`);
      if (res.ok) {
        const data = await res.json();
        if (data.events?.length) return data.events;
      }
    } catch {
      // fall through
    }
  }
  return MOCK_EVENTS.filter((e) => e.featured);
}
