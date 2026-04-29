import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { API_BASE_URL } from "../lib/env";

type CommissionTotals = {
  gross_cents: number;
  refund_cents: number;
  net_cents: number;
  commission_cents: number;
  processing_fee_cents: number;
  organizer_net_cents: number;
  orders: number;
};

type Payout = {
  id: string;
  organizer_id: string;
  organizer_name: string | null;
  amount_cents: number;
  status: string;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  stripe_transfer_id: string | null;
};

type Settlement = {
  id: string;
  order_id: string;
  organizer_id: string;
  gross_cents: number;
  commission_cents: number;
  processing_fee_cents: number;
  refund_cents: number;
  net_organizer_cents: number;
  status: string;
  event_title: string;
  payout_id: string | null;
};

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AdminFinancePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [totals, setTotals] = useState<CommissionTotals | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reconcilePayoutId, setReconcilePayoutId] = useState("");

  useEffect(() => {
    if (!auth.user) return nav("/login?next=/admin/finance");
    refresh();
  }, [auth.user]);

  async function refresh() {
    const [c, p, s] = await Promise.all([
      auth.apiFetch<{ totals: CommissionTotals }>("/finance/commission"),
      auth.apiFetch<{ payouts: Payout[] }>("/finance/payouts"),
      auth.apiFetch<{ settlements: Settlement[] }>("/finance/settlements"),
    ]);
    setTotals(c.totals);
    setPayouts(p.payouts);
    setSettlements(s.settlements);
  }

  async function markPaid(id: string) {
    const ref = prompt("Stripe transfer id (optional)") || undefined;
    await auth.apiFetch(`/finance/payouts/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "paid", stripeTransferId: ref }),
    });
    await refresh();
  }

  async function reconcile() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!reconcilePayoutId || ids.length === 0) {
      alert("Pick a payout id and at least one settlement.");
      return;
    }
    await auth.apiFetch("/finance/reconcile", {
      method: "POST",
      body: JSON.stringify({ payoutId: reconcilePayoutId, settlementIds: ids }),
    });
    setSelected({});
    setReconcilePayoutId("");
    await refresh();
  }

  function downloadCsv() {
    const url = `${API_BASE_URL}/finance/reports/financial.csv`;
    fetch(url, { headers: { authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "financial-report.csv";
        a.click();
      });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Finance</h1>

      {totals && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Gross" value={fmt(totals.gross_cents)} />
          <Stat label="Refunds" value={fmt(totals.refund_cents)} />
          <Stat label="Commission" value={fmt(totals.commission_cents)} />
          <Stat
            label="Net to organizers"
            value={fmt(totals.organizer_net_cents)}
          />
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Reports</h2>
          <button className="btn-primary" onClick={downloadCsv}>
            Export CSV
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="font-display text-xl">Payouts</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-surface-400">
            <tr>
              <th>Organizer</th>
              <th>Period</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t border-surface-800/50">
                <td className="py-2">{p.organizer_name ?? p.organizer_id}</td>
                <td>
                  {new Date(p.period_start).toLocaleDateString()} –{" "}
                  {new Date(p.period_end).toLocaleDateString()}
                </td>
                <td>{fmt(p.amount_cents)}</td>
                <td>{p.status}</td>
                <td>
                  {p.status !== "paid" && p.status !== "cancelled" && (
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => markPaid(p.id)}
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-surface-400">
                  No payouts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="font-display text-xl">Settlements / Reconciliation</h2>
        <div className="my-2 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Payout id to reconcile into"
            value={reconcilePayoutId}
            onChange={(e) => setReconcilePayoutId(e.target.value)}
          />
          <button className="btn-primary" onClick={reconcile}>
            Reconcile selected
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-surface-400">
            <tr>
              <th></th>
              <th>Event</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id} className="border-t border-surface-800/50">
                <td>
                  <input
                    type="checkbox"
                    disabled={s.status !== "unsettled"}
                    checked={!!selected[s.id]}
                    onChange={(e) =>
                      setSelected({ ...selected, [s.id]: e.target.checked })
                    }
                  />
                </td>
                <td>{s.event_title}</td>
                <td>{fmt(s.gross_cents)}</td>
                <td>{fmt(s.net_organizer_cents)}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-surface-400">{label}</p>
      <p className="text-2xl font-display">{value}</p>
    </div>
  );
}
