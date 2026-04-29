import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Workshops & classes, first",
    description: "Purpose‑built for skill‑based events with a faster path from idea to tickets."
  },
  {
    title: "AI‑assisted creation",
    description: "Generate event copy, agendas, tags, and tier ideas in seconds."
  },
  {
    title: "Payments + tickets",
    description: "Stripe Checkout, QR tickets, and organizer check‑in for real‑world workshops."
  }
];

const STEPS = [
  {
    title: "Create",
    body: "Draft a workshop, add a venue pin, and let AI polish the details."
  },
  {
    title: "Launch",
    body: "Publish and accept payments instantly. Tickets issue automatically."
  },
  {
    title: "Run",
    body: "Open Scanner Mode and check in attendees in seconds."
  }
];

const TESTIMONIALS = [
  {
    quote: "Planzo feels like a pro platform without the complexity.",
    name: "Leah K.",
    role: "Community Organizer"
  },
  {
    quote: "The AI copy is good enough that we just ship the draft.",
    name: "Marcus D.",
    role: "Workshop Host"
  },
  {
    quote: "We sold out in 48 hours — the map discovery is killer.",
    name: "Priya S.",
    role: "Local Studio"
  }
];

export default function MarketingPage() {
  return (
    <div className="space-y-16">
      <section className="card overflow-hidden bg-gradient-to-br from-surface-900 via-surface-900 to-surface-950">
        <div className="max-w-2xl space-y-5">
          <div className="badge-brand inline-flex">Planzo</div>
          <h1 className="font-display text-4xl font-bold leading-tight text-surface-50 sm:text-5xl">
            The workshop platform that feels like a big‑tech product
          </h1>
          <p className="text-lg text-surface-400">
            Map‑first discovery, AI‑assisted creation, and instant ticketing — built for local workshops, classes, and
            training sessions.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link className="btn-primary" to="/organizer">
              Start organizing
            </Link>
            <Link className="btn-secondary" to="/waitlist">
              Join waitlist
            </Link>
            <Link className="btn-ghost" to="/">
              Explore events
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold text-surface-50">Why teams choose Planzo</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-hover">
              <h3 className="font-display text-lg font-semibold text-surface-50">{f.title}</h3>
              <p className="mt-2 text-surface-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-2xl font-semibold text-surface-50">Product tour</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, idx) => (
            <div key={s.title} className="rounded-xl border border-surface-700 bg-surface-950/50 p-5">
              <div className="badge-brand mb-3">Step {idx + 1}</div>
              <h3 className="font-display text-lg font-semibold text-surface-50">{s.title}</h3>
              <p className="mt-2 text-surface-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold text-surface-50">Loved by local teams</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card">
              <p className="text-surface-200">"{t.quote}"</p>
              <p className="mt-4 text-sm text-surface-500">
                {t.name} · {t.role}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
