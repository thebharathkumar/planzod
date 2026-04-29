import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { API_BASE_URL } from "../lib/env";

const fmt = (c: number) => `$${(Number(c) / 100).toFixed(2)}`;

export default function AdminAnalyticsPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [revenue, setRevenue] = useState<any>(null);
  const [discovery, setDiscovery] = useState<any>(null);
  const [marketing, setMarketing] = useState<any>(null);
  const [customers, setCustomers] = useState<any>(null);
  const [organizers, setOrganizers] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.user) return nav("/login?next=/admin/analytics");
    Promise.all([
      auth.apiFetch("/analytics/revenue-trend"),
      auth.apiFetch("/analytics/discovery"),
      auth.apiFetch("/analytics/marketing"),
      auth.apiFetch("/analytics/customers"),
      auth.apiFetch<{ organizers: any[] }>("/analytics/organizers"),
    ]).then(([r, d, m, c, o]: any[]) => {
      setRevenue(r);
      setDiscovery(d);
      setMarketing(m);
      setCustomers(c);
      setOrganizers(o.organizers);
    });
  }, [auth.user]);

  function exportCsv(kind: "events" | "revenue-trend") {
    fetch(`${API_BASE_URL}/analytics/export.csv?kind=${kind}`, {
      headers: { authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${kind}.csv`;
        a.click();
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Analytics</h1>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-sm"
            onClick={() => exportCsv("events")}
          >
            Export events
          </button>
          <button
            className="btn-ghost text-sm"
            onClick={() => exportCsv("revenue-trend")}
          >
            Export revenue
          </button>
        </div>
      </div>

      {revenue && (
        <section className="card">
          <h2 className="font-display text-xl">Revenue by category</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-surface-400">
              <tr>
                <th>Category</th>
                <th>Orders</th>
                <th>Gross</th>
              </tr>
            </thead>
            <tbody>
              {revenue.by_category?.map((c: any) => (
                <tr key={c.category} className="border-t border-surface-800/50">
                  <td className="py-1">{c.category}</td>
                  <td>{c.orders}</td>
                  <td>{fmt(c.gross_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {discovery && (
        <section className="card">
          <h2 className="font-display text-xl">Discovery funnel (30d)</h2>
          <ul className="text-sm">
            {discovery.funnel?.map((f: any) => (
              <li
                key={f.step}
                className="flex justify-between border-t border-surface-800/50 py-1"
              >
                <span>{f.step}</span>
                <span>{f.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {marketing && (
        <section className="card">
          <h2 className="font-display text-xl">Marketing channels</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-surface-400">
              <tr>
                <th>Channel</th>
                <th>Sent</th>
                <th>Opened</th>
                <th>Clicked</th>
                <th>Converted</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {marketing.byChannel?.map((c: any) => (
                <tr
                  key={c.channel ?? "none"}
                  className="border-t border-surface-800/50"
                >
                  <td className="py-1">{c.channel ?? "—"}</td>
                  <td>{c.sent}</td>
                  <td>{c.opened}</td>
                  <td>{c.clicked}</td>
                  <td>{c.converted}</td>
                  <td>{fmt(c.revenue_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {customers && (
        <section className="card">
          <h2 className="font-display text-xl">Customer behaviour</h2>
          <p className="text-sm text-surface-300">
            Repeat purchase rate: {customers.repeat?.repeat_users ?? 0}/
            {customers.repeat?.total_users ?? 0}
          </p>
          <ul className="mt-2 text-sm">
            {customers.by_interaction?.map((i: any) => (
              <li
                key={i.interaction_type}
                className="flex justify-between border-t border-surface-800/50 py-1"
              >
                <span>{i.interaction_type}</span>
                <span>{i.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {organizers.length > 0 && (
        <section className="card">
          <h2 className="font-display text-xl">Top organizers</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-surface-400">
              <tr>
                <th>Organizer</th>
                <th>Events</th>
                <th>Orders</th>
                <th>Gross</th>
                <th>Avg rating</th>
              </tr>
            </thead>
            <tbody>
              {organizers.slice(0, 20).map((o: any) => (
                <tr key={o.id} className="border-t border-surface-800/50">
                  <td className="py-1">{o.display_name}</td>
                  <td>{o.events}</td>
                  <td>{o.orders}</td>
                  <td>{fmt(o.gross_cents)}</td>
                  <td>
                    {o.avg_rating ? Number(o.avg_rating).toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
