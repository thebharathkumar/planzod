import { pool } from "./pool";

const DEMO_EVENTS = [
  {
    title: "Local Creative Lab",
    description: "A hands‑on session for makers, designers, and curious builders.",
    category: "design",
    startsAt: new Date(Date.now() + 5 * 24 * 3600 * 1000),
    endsAt: new Date(Date.now() + 5 * 24 * 3600 * 1000 + 2 * 3600 * 1000),
    venue: {
      name: "Downtown Studio",
      address: "123 Market St",
      lat: 37.7749,
      lng: -122.4194
    }
  },
  {
    title: "Neighborhood Fitness Pop‑Up",
    description: "A friendly outdoor workout + community hangout.",
    category: "wellness",
    startsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000 + 90 * 60 * 1000),
    venue: {
      name: "Central Park",
      address: "456 Park Ave",
      lat: 37.7694,
      lng: -122.4862
    }
  }
];

async function ensureDemoOrganizer(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM users WHERE email = $1", ["demo@planzo.app"]);
  let userId = rows[0]?.id;
  if (!userId) {
    const userRes = await pool.query<{ id: string }>(
      "INSERT INTO users(email, password_hash, role) VALUES ($1, $2, 'organizer') RETURNING id",
      ["demo@planzo.app", "demo_hash_change_me"]
    );
    userId = userRes.rows[0].id;
  }

  const organizerRes = await pool.query<{ id: string }>("SELECT id FROM organizers WHERE user_id = $1", [userId]);
  if (organizerRes.rows[0]) return organizerRes.rows[0].id;

  const created = await pool.query<{ id: string }>(
    "INSERT INTO organizers(user_id, display_name) VALUES ($1, $2) RETURNING id",
    [userId, "Planzo Demo Organizer"]
  );
  return created.rows[0].id;
}

async function seed() {
  const organizerId = await ensureDemoOrganizer();

  for (const e of DEMO_EVENTS) {
    const venueRes = await pool.query<{ id: string }>(
      "INSERT INTO venues(name, address, lat, lng) VALUES ($1,$2,$3,$4) RETURNING id",
      [e.venue.name, e.venue.address, e.venue.lat, e.venue.lng]
    );
    const venueId = venueRes.rows[0].id;

    const eventRes = await pool.query<{ id: string }>(
      `
        INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, lat, lng)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8,$9)
        RETURNING id
      `,
      [
        organizerId,
        venueId,
        e.title,
        e.description,
        e.category,
        e.startsAt.toISOString(),
        e.endsAt.toISOString(),
        e.venue.lat,
        e.venue.lng
      ]
    );
    const eventId = eventRes.rows[0].id;

    await pool.query(
      `
        INSERT INTO ticket_tiers(event_id, name, price_cents, currency, total_qty, remaining_qty, sales_start)
        VALUES ($1, 'General Admission', 2500, 'usd', 50, 50, now())
      `,
      [eventId]
    );
  }
}

seed()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Demo seed completed.");
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

