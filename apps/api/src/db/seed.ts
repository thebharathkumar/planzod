import bcrypt from "bcryptjs";
import { pool } from "./pool";

type SeedEvent = {
  title: string;
  description: string;
  category: string;
  daysFromNow: number;
  startHour: number;
  durationHours: number;
  heroImageUrl: string;
  featured: boolean;
  venue: {
    name: string;
    address: string;
    city: string;
    lat: number;
    lng: number;
  };
  tiers: Array<{
    name: string;
    priceCents: number;
    qty: number;
    description?: string;
  }>;
};

const DEMO_EVENTS: SeedEvent[] = [
  {
    title: "Neon Nights Electronic Festival",
    description:
      "World-class DJs across 3 stages with immersive light installations, art galleries, and a gourmet food village.",
    category: "concert",
    daysFromNow: 7,
    startHour: 20,
    durationHours: 6,
    heroImageUrl:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&auto=format&fit=crop",
    featured: true,
    venue: {
      name: "Skyline Arena",
      address: "123 Harbor Blvd",
      city: "Miami, FL",
      lat: 25.7617,
      lng: -80.1918,
    },
    tiers: [
      {
        name: "General",
        priceCents: 4900,
        qty: 500,
        description: "All stages",
      },
      {
        name: "VIP",
        priceCents: 14900,
        qty: 100,
        description: "VIP lounge + meet & greet",
      },
    ],
  },
  {
    title: "Startup Founders Summit 2026",
    description:
      "500+ founders, VCs, and innovators. Keynotes, pitch competitions, and hands-on workshops.",
    category: "meetup",
    daysFromNow: 14,
    startHour: 9,
    durationHours: 9,
    heroImageUrl:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop",
    featured: true,
    venue: {
      name: "Innovation Hub",
      address: "456 Tech Park Dr",
      city: "San Francisco, CA",
      lat: 37.7749,
      lng: -122.4194,
    },
    tiers: [
      {
        name: "Standard",
        priceCents: 29900,
        qty: 300,
        description: "Full conference access",
      },
      {
        name: "Founder Pass",
        priceCents: 59900,
        qty: 50,
        description: "Includes investor speed-dating",
      },
    ],
  },
  {
    title: "Culinary World Tour: Street Food Edition",
    description:
      "40+ cuisines in one outdoor festival. Live cooking demos, celebrity chefs, artisan markets.",
    category: "food",
    daysFromNow: 21,
    startHour: 11,
    durationHours: 11,
    heroImageUrl:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Central Park Meadow",
      address: "Central Park West",
      city: "New York, NY",
      lat: 40.7828,
      lng: -73.9654,
    },
    tiers: [
      { name: "Day Pass", priceCents: 3500, qty: 800 },
      {
        name: "Chef's Table",
        priceCents: 12000,
        qty: 30,
        description: "Private 5-course tasting",
      },
    ],
  },
  {
    title: "Impressionist Art Exhibition: Light & Shadow",
    description:
      "200 masterworks from the Impressionist era with interactive AI guide and evening tours.",
    category: "arts",
    daysFromNow: 10,
    startHour: 10,
    durationHours: 9,
    heroImageUrl:
      "https://images.unsplash.com/photo-1602726859144-2bb8c9de3c5c?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Metropolitan Gallery",
      address: "789 Museum Mile",
      city: "Boston, MA",
      lat: 42.3601,
      lng: -71.0589,
    },
    tiers: [
      { name: "Adult", priceCents: 2500, qty: 500 },
      {
        name: "Premium",
        priceCents: 6500,
        qty: 80,
        description: "Guided tour + catalog",
      },
    ],
  },
  {
    title: "Sunrise Yoga & Wellness Retreat",
    description:
      "3-day immersive retreat with sunrise yoga, meditation, sound healing, and farm-to-table meals.",
    category: "sports",
    daysFromNow: 28,
    startHour: 7,
    durationHours: 60,
    heroImageUrl:
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop",
    featured: true,
    venue: {
      name: "Blue Ridge Mountain Retreat",
      address: "Appalachian Trail Rd",
      city: "Asheville, NC",
      lat: 35.5951,
      lng: -82.5515,
    },
    tiers: [
      { name: "Day Visitor", priceCents: 7500, qty: 100 },
      {
        name: "Full Retreat",
        priceCents: 45000,
        qty: 40,
        description: "All 3 days + room + meals",
      },
    ],
  },
  {
    title: "Jazz Under the Stars",
    description:
      "Outdoor jazz with Grammy-nominated artists, craft cocktails, and picnic-style seating.",
    category: "concert",
    daysFromNow: 5,
    startHour: 19,
    durationHours: 4,
    heroImageUrl:
      "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Riverside Amphitheater",
      address: "300 River Walk Blvd",
      city: "New Orleans, LA",
      lat: 29.9511,
      lng: -90.0715,
    },
    tiers: [
      { name: "Lawn", priceCents: 5500, qty: 300 },
      {
        name: "Reserved",
        priceCents: 11000,
        qty: 80,
        description: "Reserved table for two",
      },
    ],
  },
  {
    title: "Indie Game Dev Workshop",
    description:
      "2-day Unity workshop where you build a complete indie game from scratch. Take home your project.",
    category: "workshop",
    daysFromNow: 12,
    startHour: 10,
    durationHours: 14,
    heroImageUrl:
      "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Maker Space HQ",
      address: "222 Creator Ave",
      city: "Austin, TX",
      lat: 30.2672,
      lng: -97.7431,
    },
    tiers: [
      {
        name: "Workshop",
        priceCents: 19900,
        qty: 40,
        description: "2-day workshop with materials",
      },
    ],
  },
  {
    title: "Emerging Designers Fashion Showcase",
    description:
      "20 emerging designers present debut collections on the runway. VIP reception included.",
    category: "arts",
    daysFromNow: 18,
    startHour: 18,
    durationHours: 5,
    heroImageUrl:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&auto=format&fit=crop",
    featured: true,
    venue: {
      name: "Design District Gallery",
      address: "88 Fashion Row",
      city: "Los Angeles, CA",
      lat: 34.0522,
      lng: -118.2437,
    },
    tiers: [
      { name: "Runway", priceCents: 8900, qty: 200 },
      {
        name: "Designer VIP",
        priceCents: 25000,
        qty: 20,
        description: "Exclusive reception",
      },
    ],
  },
  {
    title: "Community Coding Bootcamp — Free",
    description:
      "Free intro to web development. Bring a laptop, leave with your first deployed website.",
    category: "class",
    daysFromNow: 3,
    startHour: 14,
    durationHours: 4,
    heroImageUrl:
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Public Library Tech Hub",
      address: "1000 4th Ave",
      city: "Seattle, WA",
      lat: 47.6062,
      lng: -122.3321,
    },
    tiers: [
      {
        name: "Free Seat",
        priceCents: 0,
        qty: 30,
        description: "First come, first served",
      },
    ],
  },
  {
    title: "Saturday Farmers Market & Live Music",
    description:
      "Local growers, artisan goods, and live folk music. Free to browse, pay-what-you-can for music tips.",
    category: "community",
    daysFromNow: 2,
    startHour: 9,
    durationHours: 4,
    heroImageUrl:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Downtown Plaza",
      address: "Civic Center Park",
      city: "Denver, CO",
      lat: 39.7392,
      lng: -104.9903,
    },
    tiers: [
      {
        name: "Free Entry",
        priceCents: 0,
        qty: 999,
        description: "Open to the public",
      },
    ],
  },
  {
    title: "Photography Walk: Golden Hour",
    description:
      "Pro photographer leads a 2-hour walking tour through the city's most photogenic spots.",
    category: "workshop",
    daysFromNow: 6,
    startHour: 17,
    durationHours: 2,
    heroImageUrl:
      "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Millennium Park (meeting point)",
      address: "201 E Randolph St",
      city: "Chicago, IL",
      lat: 41.8781,
      lng: -87.6298,
    },
    tiers: [{ name: "Walk + Critique", priceCents: 4500, qty: 18 }],
  },
  {
    title: "Sunday Trail Run & Coffee",
    description:
      "5km easy trail run for all paces, followed by free coffee and pastries. Bring a friend.",
    category: "sports",
    daysFromNow: 4,
    startHour: 8,
    durationHours: 2,
    heroImageUrl:
      "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1200&auto=format&fit=crop",
    featured: false,
    venue: {
      name: "Forest Park Trailhead",
      address: "NW Thurman St",
      city: "Portland, OR",
      lat: 45.5152,
      lng: -122.6784,
    },
    tiers: [
      {
        name: "Drop-in",
        priceCents: 0,
        qty: 999,
        description: "Free, no signup",
      },
    ],
  },
];

async function ensureUser(
  email: string,
  password: string,
  role: "attendee" | "organizer" | "admin",
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  if (rows[0]) return rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const created = await pool.query<{ id: string }>(
    "INSERT INTO users(email, password_hash, role) VALUES ($1,$2,$3) RETURNING id",
    [email, hash, role],
  );
  return created.rows[0].id;
}

async function ensureOrganizer(
  userId: string,
  displayName: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM organizers WHERE user_id = $1",
    [userId],
  );
  if (rows[0]) return rows[0].id;
  const created = await pool.query<{ id: string }>(
    "INSERT INTO organizers(user_id, display_name) VALUES ($1,$2) RETURNING id",
    [userId, displayName],
  );
  return created.rows[0].id;
}

async function seed() {
  // Demo accounts (login: demo@planzo.app / password123, etc.)
  const organizerUserId = await ensureUser(
    "demo@planzo.app",
    "password123",
    "organizer",
  );
  await ensureUser("attendee@planzo.app", "password123", "attendee");
  await ensureUser("admin@planzo.app", "password123", "admin");

  const organizerId = await ensureOrganizer(
    organizerUserId,
    "Planzo Demo Organizer",
  );

  for (const e of DEMO_EVENTS) {
    const startsAt = new Date(Date.now() + e.daysFromNow * 86400 * 1000);
    startsAt.setHours(e.startHour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + e.durationHours * 3600 * 1000);

    // Skip if an event with the same title already exists for this organizer.
    const existing = await pool.query(
      "SELECT 1 FROM events WHERE title = $1 AND organizer_id = $2",
      [e.title, organizerId],
    );
    if (existing.rowCount && existing.rowCount > 0) continue;

    const venueRes = await pool.query<{ id: string }>(
      "INSERT INTO venues(name, address, lat, lng) VALUES ($1,$2,$3,$4) RETURNING id",
      [
        e.venue.name,
        `${e.venue.address}, ${e.venue.city}`,
        e.venue.lat,
        e.venue.lng,
      ],
    );
    const venueId = venueRes.rows[0].id;

    const eventRes = await pool.query<{ id: string }>(
      `INSERT INTO events(organizer_id, venue_id, title, description, category,
                          starts_at, ends_at, status, hero_image_url, lat, lng, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9,$10,$11)
       RETURNING id`,
      [
        organizerId,
        venueId,
        e.title,
        e.description,
        e.category,
        startsAt.toISOString(),
        endsAt.toISOString(),
        e.heroImageUrl,
        e.venue.lat,
        e.venue.lng,
        e.featured,
      ],
    );
    const eventId = eventRes.rows[0].id;

    for (const t of e.tiers) {
      await pool.query(
        `INSERT INTO ticket_tiers(event_id, name, price_cents, currency,
                                  total_qty, remaining_qty, sales_start)
         VALUES ($1,$2,$3,'usd',$4,$4, now())`,
        [eventId, t.name, t.priceCents, t.qty],
      );
    }
  }
}

seed()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(
      `Seed complete: ${DEMO_EVENTS.length} events, demo accounts ` +
        `(demo@planzo.app / attendee@planzo.app / admin@planzo.app — pw: password123)`,
    );
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
