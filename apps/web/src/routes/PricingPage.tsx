import { Link } from "react-router-dom";

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    tagline: "Best for trying Planzo",
    features: ["Unlimited free events", "AI copy + agenda", "Map discovery listing"],
    highlight: false
  },
  {
    name: "Growth",
    price: "2.9% + $0.00",
    tagline: "Built for paid workshops",
    features: ["Paid tickets + Stripe", "Organizer analytics", "Verified badge eligibility"],
    highlight: true
  },
  {
    name: "Studio",
    price: "$49 / mo",
    tagline: "For recurring organizers",
    features: ["Lower fees", "Featured placement", "Priority support"],
    highlight: false
  }
];

export default function PricingPage() {
  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="badge-brand mb-4 inline-flex">Pricing</div>
        <h1 className="font-display text-3xl font-bold text-surface-50 sm:text-4xl">
          Transparent pricing for workshops & classes
        </h1>
        <p className="mt-3 text-lg text-surface-400">
          Designed so small organizers keep more of every ticket. No per‑ticket fees.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`card flex flex-col ${
              t.highlight ? "border-brand-500/50 ring-2 ring-brand-500/20" : ""
            }`}
          >
            {t.highlight && (
              <span className="badge-brand mb-4 w-fit">Popular</span>
            )}
            <div className="font-display text-xl font-semibold text-surface-50">{t.name}</div>
            <div className="mt-2 font-display text-3xl font-bold text-brand-400">{t.price}</div>
            <div className="mt-1 text-sm text-surface-400">{t.tagline}</div>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-surface-300">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-brand-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <Link
                className={`block w-full text-center ${t.highlight ? "btn-primary" : "btn-secondary"}`}
                to="/organizer"
              >
                Get started
              </Link>
              <Link className="block text-center text-xs text-surface-500 hover:text-brand-400" to="/waitlist">
                Join waitlist
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
