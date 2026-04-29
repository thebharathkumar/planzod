import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Booking = {
  id: string;
  event: { id: string; title: string; startsAt: string; venueName: string };
  status: string;
  amountTotalCents: number;
  refundAmountCents: number;
  currency: string;
  createdAt: string;
  items: { name: string; qty: number; unit_price_cents: number }[];
  tickets: { id: string; status: string }[];
};

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export default function BookingsPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return nav("/login?next=/bookings");
    auth
      .apiFetch<{ bookings: Booking[] }>("/me/bookings")
      .then((r) => setBookings(r.bookings));
  }, [auth.user]);

  async function requestRefund(orderId: string) {
    if (!reasonText.trim()) {
      alert("Please describe why you need a refund.");
      return;
    }
    try {
      await auth.apiFetch("/refunds", {
        method: "POST",
        body: JSON.stringify({ orderId, reason: reasonText }),
      });
      setInfo("Refund request submitted. The organizer will review it.");
      setReasonFor(null);
      setReasonText("");
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Booking history</h1>
        <Link to="/refunds" className="btn-ghost">
          View refunds
        </Link>
      </div>
      {info && (
        <p className="rounded border border-emerald-700 bg-emerald-950/40 p-3 text-emerald-300">
          {info}
        </p>
      )}

      {bookings.length === 0 ? (
        <p className="text-surface-400">
          No bookings yet.{" "}
          <Link to="/" className="text-brand-300">
            Browse events
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/events/${b.event.id}`}
                    className="font-medium text-surface-100 hover:underline"
                  >
                    {b.event.title}
                  </Link>
                  <p className="text-sm text-surface-400">
                    {new Date(b.event.startsAt).toLocaleString()} ·{" "}
                    {b.event.venueName}
                  </p>
                  <p className="text-sm text-surface-500">
                    Booked {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {fmt(b.amountTotalCents, b.currency)}
                  </p>
                  {b.refundAmountCents > 0 && (
                    <p className="text-xs text-amber-300">
                      refunded {fmt(b.refundAmountCents, b.currency)}
                    </p>
                  )}
                  <span
                    className={
                      b.status === "paid"
                        ? "rounded bg-emerald-700/30 px-2 py-0.5 text-xs text-emerald-300"
                        : b.status === "refunded"
                          ? "rounded bg-amber-700/30 px-2 py-0.5 text-xs text-amber-300"
                          : "rounded bg-surface-700/40 px-2 py-0.5 text-xs"
                    }
                  >
                    {b.status}
                  </span>
                </div>
              </div>
              <ul className="text-sm text-surface-300">
                {b.items.map((it, i) => (
                  <li key={i}>
                    {it.qty}× {it.name} @ {fmt(it.unit_price_cents, b.currency)}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-surface-800/50 pt-2">
                <span className="text-sm text-surface-400">
                  {b.tickets.length} ticket{b.tickets.length !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <Link to="/my/tickets" className="btn-ghost text-sm">
                    View tickets
                  </Link>
                  {b.status === "paid" &&
                    b.refundAmountCents < b.amountTotalCents && (
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => setReasonFor(b.id)}
                      >
                        Request refund
                      </button>
                    )}
                </div>
              </div>
              {reasonFor === b.id && (
                <div className="mt-2 space-y-2 rounded border border-surface-800/60 bg-surface-900/40 p-3">
                  <textarea
                    className="input"
                    placeholder="Why are you requesting this refund?"
                    rows={3}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary"
                      onClick={() => requestRefund(b.id)}
                    >
                      Submit
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setReasonFor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
