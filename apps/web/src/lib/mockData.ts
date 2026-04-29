// Default events shown when no API is reachable, so the Vercel-hosted SPA
// still looks alive without a backend. Mirrors the original Figma seed data
// but typed to match the API shape (snake_case, cents) so the same UI works
// against both mock and real data.

export type MockEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  hero_image_url: string;
  lat: number;
  lng: number;
  organizer_id: string;
  organizer_name: string;
  venue_id: string;
  venue_name: string;
  venue_address: string;
  city: string;
  status: "published";
  featured: boolean;
  rating: number;
  review_count: number;
  tags: string[];
  min_price_cents: number | null;
  has_paid: boolean;
  has_free: boolean;
  distance_m: number;
  tiers: Array<{
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    remaining_qty: number;
    sales_start: string;
    sales_end: string | null;
    description: string;
  }>;
};

const inDays = (n: number, hour = 19) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_EVENTS: MockEvent[] = [
  {
    id: "e1",
    title: "Neon Nights Electronic Festival",
    description:
      "A breathtaking electronic music experience with world-class DJs across 3 stages. Immersive light installations, art galleries, and a gourmet food village.",
    category: "concert",
    starts_at: inDays(7, 20),
    ends_at: inDays(8, 2),
    hero_image_url:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&auto=format&fit=crop",
    lat: 25.7617,
    lng: -80.1918,
    organizer_id: "org-pulse",
    organizer_name: "Pulse Events Co.",
    venue_id: "v1",
    venue_name: "Skyline Arena",
    venue_address: "123 Harbor Blvd",
    city: "Miami, FL",
    status: "published",
    featured: true,
    rating: 4.8,
    review_count: 312,
    tags: ["EDM", "Nightlife", "Festival"],
    min_price_cents: 4900,
    has_paid: true,
    has_free: false,
    distance_m: 1200,
    tiers: [
      {
        id: "t1a",
        name: "General",
        price_cents: 4900,
        currency: "usd",
        remaining_qty: 200,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "General admission to all stages",
      },
      {
        id: "t1b",
        name: "VIP",
        price_cents: 14900,
        currency: "usd",
        remaining_qty: 42,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "VIP lounge, premium bar, artist meet & greet",
      },
    ],
  },
  {
    id: "e2",
    title: "Startup Founders Summit 2026",
    description:
      "Connect with 500+ founders, VCs, and innovators. Keynotes from unicorn founders, pitch competitions, and hands-on workshops.",
    category: "meetup",
    starts_at: inDays(14, 9),
    ends_at: inDays(14, 18),
    hero_image_url:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop",
    lat: 37.7749,
    lng: -122.4194,
    organizer_id: "org-techcircle",
    organizer_name: "TechCircle Inc.",
    venue_id: "v2",
    venue_name: "Innovation Hub",
    venue_address: "456 Tech Park Dr",
    city: "San Francisco, CA",
    status: "published",
    featured: true,
    rating: 4.9,
    review_count: 189,
    tags: ["Tech", "Startups", "Networking"],
    min_price_cents: 29900,
    has_paid: true,
    has_free: false,
    distance_m: 800,
    tiers: [
      {
        id: "t2a",
        name: "Standard",
        price_cents: 29900,
        currency: "usd",
        remaining_qty: 150,
        sales_start: new Date(Date.now() - 86400000 * 60).toISOString(),
        sales_end: null,
        description: "Full conference access",
      },
      {
        id: "t2b",
        name: "Founder Pass",
        price_cents: 59900,
        currency: "usd",
        remaining_qty: 28,
        sales_start: new Date(Date.now() - 86400000 * 60).toISOString(),
        sales_end: null,
        description: "Includes dinner, investor speed-dating, afterparty",
      },
    ],
  },
  {
    id: "e3",
    title: "Culinary World Tour: Street Food Edition",
    description:
      "Explore 40+ cuisines from around the world in one vibrant outdoor festival. Live cooking demos, celebrity chefs, and artisan markets.",
    category: "food",
    starts_at: inDays(21, 11),
    ends_at: inDays(21, 22),
    hero_image_url:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop",
    lat: 40.7828,
    lng: -73.9654,
    organizer_id: "org-flavor",
    organizer_name: "Flavor Collective",
    venue_id: "v3",
    venue_name: "Central Park Meadow",
    venue_address: "Central Park West",
    city: "New York, NY",
    status: "published",
    featured: false,
    rating: 4.7,
    review_count: 427,
    tags: ["Food", "Culture", "Outdoor"],
    min_price_cents: 3500,
    has_paid: true,
    has_free: false,
    distance_m: 2400,
    tiers: [
      {
        id: "t3a",
        name: "Day Pass",
        price_cents: 3500,
        currency: "usd",
        remaining_qty: 400,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Full day general access",
      },
      {
        id: "t3b",
        name: "Chef's Table",
        price_cents: 12000,
        currency: "usd",
        remaining_qty: 15,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Private chef demo + 5-course tasting",
      },
    ],
  },
  {
    id: "e4",
    title: "Impressionist Art Exhibition: Light & Shadow",
    description:
      "A curated collection of 200 masterworks from the Impressionist era. Interactive AI guide, artist talks, and guided evening tours.",
    category: "arts",
    starts_at: inDays(10, 10),
    ends_at: inDays(10, 19),
    hero_image_url:
      "https://images.unsplash.com/photo-1602726859144-2bb8c9de3c5c?w=1200&auto=format&fit=crop",
    lat: 42.3601,
    lng: -71.0589,
    organizer_id: "org-arts",
    organizer_name: "Arts Foundation",
    venue_id: "v4",
    venue_name: "Metropolitan Gallery",
    venue_address: "789 Museum Mile",
    city: "Boston, MA",
    status: "published",
    featured: false,
    rating: 4.6,
    review_count: 203,
    tags: ["Art", "Culture", "Exhibition"],
    min_price_cents: 2500,
    has_paid: true,
    has_free: false,
    distance_m: 3100,
    tiers: [
      {
        id: "t4a",
        name: "Adult",
        price_cents: 2500,
        currency: "usd",
        remaining_qty: 300,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Standard entry",
      },
      {
        id: "t4b",
        name: "Premium",
        price_cents: 6500,
        currency: "usd",
        remaining_qty: 40,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Private guided tour + exhibition catalog",
      },
    ],
  },
  {
    id: "e5",
    title: "Sunrise Yoga & Wellness Retreat",
    description:
      "3-day immersive wellness retreat featuring sunrise yoga, meditation, sound healing, and organic farm-to-table meals in the Blue Ridge mountains.",
    category: "sports",
    starts_at: inDays(28, 7),
    ends_at: inDays(30, 17),
    hero_image_url:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop",
    lat: 35.5951,
    lng: -82.5515,
    organizer_id: "org-zenith",
    organizer_name: "Zenith Wellness",
    venue_id: "v5",
    venue_name: "Blue Ridge Mountain Retreat",
    venue_address: "Appalachian Trail Rd",
    city: "Asheville, NC",
    status: "published",
    featured: true,
    rating: 5.0,
    review_count: 87,
    tags: ["Wellness", "Yoga", "Nature"],
    min_price_cents: 7500,
    has_paid: true,
    has_free: false,
    distance_m: 5700,
    tiers: [
      {
        id: "t5a",
        name: "Day Visitor",
        price_cents: 7500,
        currency: "usd",
        remaining_qty: 50,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Single day access",
      },
      {
        id: "t5b",
        name: "Full Retreat",
        price_cents: 45000,
        currency: "usd",
        remaining_qty: 12,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "All 3 days + accommodation + meals",
      },
    ],
  },
  {
    id: "e6",
    title: "Jazz Under the Stars",
    description:
      "An elegant outdoor jazz concert series featuring Grammy-nominated artists, craft cocktails, and picnic-style seating under the open sky.",
    category: "concert",
    starts_at: inDays(5, 19),
    ends_at: inDays(5, 23),
    hero_image_url:
      "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=1200&auto=format&fit=crop",
    lat: 29.9511,
    lng: -90.0715,
    organizer_id: "org-soulful",
    organizer_name: "Soulful Sounds",
    venue_id: "v6",
    venue_name: "Riverside Amphitheater",
    venue_address: "300 River Walk Blvd",
    city: "New Orleans, LA",
    status: "published",
    featured: false,
    rating: 4.8,
    review_count: 156,
    tags: ["Jazz", "Music", "Outdoor"],
    min_price_cents: 5500,
    has_paid: true,
    has_free: false,
    distance_m: 1900,
    tiers: [
      {
        id: "t6a",
        name: "Lawn",
        price_cents: 5500,
        currency: "usd",
        remaining_qty: 180,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Open lawn seating",
      },
      {
        id: "t6b",
        name: "Reserved",
        price_cents: 11000,
        currency: "usd",
        remaining_qty: 35,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Reserved table for two with welcome drinks",
      },
    ],
  },
  {
    id: "e7",
    title: "Indie Game Dev Workshop: Build Your First Game",
    description:
      "An intensive 2-day workshop where you build a complete indie game from scratch using Unity. Mentored by industry veterans. Take home your finished project.",
    category: "workshop",
    starts_at: inDays(12, 10),
    ends_at: inDays(13, 17),
    hero_image_url:
      "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&auto=format&fit=crop",
    lat: 30.2672,
    lng: -97.7431,
    organizer_id: "org-codeplay",
    organizer_name: "Code & Play",
    venue_id: "v7",
    venue_name: "Maker Space HQ",
    venue_address: "222 Creator Ave",
    city: "Austin, TX",
    status: "published",
    featured: false,
    rating: 4.9,
    review_count: 64,
    tags: ["Tech", "Workshops", "Gaming"],
    min_price_cents: 19900,
    has_paid: true,
    has_free: false,
    distance_m: 4300,
    tiers: [
      {
        id: "t7a",
        name: "Workshop",
        price_cents: 19900,
        currency: "usd",
        remaining_qty: 25,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Full 2-day workshop with materials",
      },
    ],
  },
  {
    id: "e8",
    title: "Emerging Designers Fashion Showcase",
    description:
      "Discover the next generation of fashion talent. 20 emerging designers present their debut collections on the runway, followed by a VIP reception.",
    category: "arts",
    starts_at: inDays(18, 18),
    ends_at: inDays(18, 23),
    hero_image_url:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&auto=format&fit=crop",
    lat: 34.0522,
    lng: -118.2437,
    organizer_id: "org-thread",
    organizer_name: "Thread & Vision",
    venue_id: "v8",
    venue_name: "Design District Gallery",
    venue_address: "88 Fashion Row",
    city: "Los Angeles, CA",
    status: "published",
    featured: true,
    rating: 4.7,
    review_count: 93,
    tags: ["Fashion", "Art", "Creatives"],
    min_price_cents: 8900,
    has_paid: true,
    has_free: false,
    distance_m: 2800,
    tiers: [
      {
        id: "t8a",
        name: "Runway",
        price_cents: 8900,
        currency: "usd",
        remaining_qty: 120,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Front-row runway access",
      },
      {
        id: "t8b",
        name: "Designer VIP",
        price_cents: 25000,
        currency: "usd",
        remaining_qty: 8,
        sales_start: new Date(Date.now() - 86400000 * 30).toISOString(),
        sales_end: null,
        description: "Meet designers + exclusive reception",
      },
    ],
  },
  {
    id: "e9",
    title: "Community Coding Bootcamp — Free",
    description:
      "Free intro to web development for newcomers. Bring a laptop, leave with your first deployed website. Mentors provide one-on-one help.",
    category: "class",
    starts_at: inDays(3, 14),
    ends_at: inDays(3, 18),
    hero_image_url:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop",
    lat: 47.6062,
    lng: -122.3321,
    organizer_id: "org-codeforall",
    organizer_name: "Code For All",
    venue_id: "v9",
    venue_name: "Public Library Tech Hub",
    venue_address: "1000 4th Ave",
    city: "Seattle, WA",
    status: "published",
    featured: false,
    rating: 4.9,
    review_count: 142,
    tags: ["Free", "Coding", "Community"],
    min_price_cents: 0,
    has_paid: false,
    has_free: true,
    distance_m: 1500,
    tiers: [
      {
        id: "t9a",
        name: "Free Seat",
        price_cents: 0,
        currency: "usd",
        remaining_qty: 30,
        sales_start: new Date(Date.now() - 86400000 * 14).toISOString(),
        sales_end: null,
        description: "Free admission — first come, first served",
      },
    ],
  },
  {
    id: "e10",
    title: "Saturday Farmers Market & Live Music",
    description:
      "Local growers, artisan goods, and live folk music every Saturday morning. Free to browse, pay-what-you-can for live music tips.",
    category: "community",
    starts_at: inDays(2, 9),
    ends_at: inDays(2, 13),
    hero_image_url:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&auto=format&fit=crop",
    lat: 39.7392,
    lng: -104.9903,
    organizer_id: "org-localfarms",
    organizer_name: "Local Farms Collective",
    venue_id: "v10",
    venue_name: "Downtown Plaza",
    venue_address: "Civic Center Park",
    city: "Denver, CO",
    status: "published",
    featured: false,
    rating: 4.6,
    review_count: 218,
    tags: ["Free", "Outdoor", "Music"],
    min_price_cents: 0,
    has_paid: false,
    has_free: true,
    distance_m: 900,
    tiers: [
      {
        id: "t10a",
        name: "Free Entry",
        price_cents: 0,
        currency: "usd",
        remaining_qty: 999,
        sales_start: new Date(Date.now() - 86400000 * 7).toISOString(),
        sales_end: null,
        description: "Open to the public",
      },
    ],
  },
  {
    id: "e11",
    title: "Photography Walk: Golden Hour Edition",
    description:
      "Capture the city during the magical golden hour. Pro photographer leads a 2-hour walking tour through the most photogenic spots.",
    category: "workshop",
    starts_at: inDays(6, 17),
    ends_at: inDays(6, 19),
    hero_image_url:
      "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&auto=format&fit=crop",
    lat: 41.8781,
    lng: -87.6298,
    organizer_id: "org-shutter",
    organizer_name: "Shutter Society",
    venue_id: "v11",
    venue_name: "Millennium Park (meeting point)",
    venue_address: "201 E Randolph St",
    city: "Chicago, IL",
    status: "published",
    featured: false,
    rating: 4.8,
    review_count: 71,
    tags: ["Photography", "Outdoor", "Creative"],
    min_price_cents: 4500,
    has_paid: true,
    has_free: false,
    distance_m: 2200,
    tiers: [
      {
        id: "t11a",
        name: "Walk + Critique",
        price_cents: 4500,
        currency: "usd",
        remaining_qty: 18,
        sales_start: new Date(Date.now() - 86400000 * 14).toISOString(),
        sales_end: null,
        description: "Includes group critique afterwards",
      },
    ],
  },
  {
    id: "e12",
    title: "Sunday Trail Run & Coffee",
    description:
      "5km easy trail run for all paces, followed by free coffee and pastries. Bring a friend, no registration required.",
    category: "sports",
    starts_at: inDays(4, 8),
    ends_at: inDays(4, 10),
    hero_image_url:
      "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1200&auto=format&fit=crop",
    lat: 45.5152,
    lng: -122.6784,
    organizer_id: "org-runclub",
    organizer_name: "Pacific Run Club",
    venue_id: "v12",
    venue_name: "Forest Park Trailhead",
    venue_address: "NW Thurman St",
    city: "Portland, OR",
    status: "published",
    featured: false,
    rating: 4.9,
    review_count: 56,
    tags: ["Free", "Running", "Community"],
    min_price_cents: 0,
    has_paid: false,
    has_free: true,
    distance_m: 1700,
    tiers: [
      {
        id: "t12a",
        name: "Drop-in",
        price_cents: 0,
        currency: "usd",
        remaining_qty: 999,
        sales_start: new Date(Date.now() - 86400000 * 7).toISOString(),
        sales_end: null,
        description: "Free, no signup required",
      },
    ],
  },
];

export function findMockEvent(id: string): MockEvent | undefined {
  return MOCK_EVENTS.find((e) => e.id === id);
}

export function filterMockEvents(opts: {
  category?: string;
  price?: "any" | "free" | "paid";
  startingSoon?: boolean;
}): MockEvent[] {
  return MOCK_EVENTS.filter((e) => {
    if (opts.category && e.category !== opts.category) return false;
    if (opts.price === "free" && !e.has_free) return false;
    if (opts.price === "paid" && !e.has_paid) return false;
    if (opts.startingSoon) {
      const start = new Date(e.starts_at).getTime();
      const now = Date.now();
      if (start < now || start > now + 6 * 60 * 60 * 1000) return false;
    }
    return true;
  });
}
