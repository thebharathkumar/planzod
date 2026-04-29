import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Refund = {
  id: string;
  order_id: string;
  reason: string;
  amount_cents: number;
  status: string;
  organizer_decision_note: string | null;
  created_at: string;
  decided_at: string | null;
  refund_executed_at: string | null;
  event_title: string;
};

export default function RefundsPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [refunds, setRefunds] = useState<Refund[]>([]);

  useEffect(() => {
    if (!auth.user) return nav("/login?next=/refunds");
    auth
      .apiFetch<{ refunds: Refund[] }>("/refunds/mine")
      .then((r) => setRefunds(r.refunds));
  }, [auth.user]);

  async function cancel(id: string) {
    try {
      await auth.apiFetch(`/refunds/${id}/cancel`, { method: "POST" });
      setRefunds((r) =>
        r.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)),
      );
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const badge = (s: string) => {
    const map: Record<string, string> = {
      requested: "bg-surface-700/40 text-surface-200",
      approved: "bg-emerald-700/30 text-emerald-300",
      denied: "bg-red-700/30 text-red-300",
      refunded: "bg-amber-700/30 text-amber-300",
      cancelled: "bg-surface-700/40 text-surface-400",
    };
    return map[s] ?? "bg-surface-700/40";
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Refund requests</h1>
      <p className="text-sm text-surface-400">
        <Link to="/bookings" className="text-brand-300">
          Back to bookings
        </Link>
      </p>
      {refunds.length === 0 ? (
        <p className="text-surface-400">No refund requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {refunds.map((r) => (
            <li key={r.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.event_title}</p>
                  <p className="text-sm text-surface-400">{r.reason}</p>
                  <p className="text-xs text-surface-500">
                    Requested {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.organizer_decision_note && (
                    <p className="mt-1 text-sm text-surface-300">
                      Organizer: {r.organizer_decision_note}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${(r.amount_cents / 100).toFixed(2)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${badge(r.status)}`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
              {r.status === "requested" && (
                <div className="mt-2 flex justify-end">
                  <button
                    className="btn-ghost text-sm"
                    onClick={() => cancel(r.id)}
                  >
                    Cancel request
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
