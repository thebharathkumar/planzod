import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  scheduled_at: string | null;
  total_sends: number;
  opens: number;
  clicks: number;
  conversions: number;
};

export default function AdminMarketingPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return nav("/login?next=/admin/marketing");
    refresh();
  }, [auth.user]);

  async function refresh() {
    const r = await auth.apiFetch<{ campaigns: Campaign[] }>("/campaigns");
    setCampaigns(r.campaigns);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await auth.apiFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify({ name, channel, eventId: eventId || undefined }),
      });
      setName("");
      setEventId("");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function launch(id: string) {
    if (!confirm("Launch campaign now?")) return;
    try {
      const r = await auth.apiFetch<{ audience: number; success: number }>(
        `/campaigns/${id}/launch`,
        { method: "POST" },
      );
      alert(`Sent to ${r.success} of ${r.audience}`);
      await refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function pause(id: string) {
    await auth.apiFetch(`/campaigns/${id}/pause`, { method: "POST" });
    await refresh();
  }

  async function complete(id: string) {
    await auth.apiFetch(`/campaigns/${id}/complete`, { method: "POST" });
    await refresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this campaign permanently?")) return;
    await auth.apiFetch(`/campaigns/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function featureEvent() {
    const id = prompt("Event id to feature");
    if (!id) return;
    await auth.apiFetch("/campaigns/feature-event", {
      method: "POST",
      body: JSON.stringify({ eventId: id, featured: true }),
    });
    alert("Event featured");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Marketing</h1>
        <button className="btn-ghost" onClick={featureEvent}>
          Feature an event
        </button>
      </div>
      {err && (
        <p className="rounded border border-red-700 bg-red-950/40 p-3 text-red-300">
          {err}
        </p>
      )}

      <form onSubmit={create} className="card space-y-2">
        <h2 className="font-display text-xl">New campaign</h2>
        <input
          className="input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <select
          className="input"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="email">Email</option>
          <option value="push">Push</option>
          <option value="sms">SMS</option>
          <option value="digital">Digital channel</option>
          <option value="homepage_feature">Homepage feature</option>
        </select>
        <input
          className="input"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Event id (optional)"
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "Creating…" : "Create"}
        </button>
      </form>

      <section className="card">
        <h2 className="font-display text-xl">Campaigns</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-surface-400">
            <tr>
              <th>Name</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Opens</th>
              <th>Clicks</th>
              <th>Conversions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-surface-800/50">
                <td className="py-2">{c.name}</td>
                <td>{c.channel}</td>
                <td>{c.status}</td>
                <td>{c.total_sends}</td>
                <td>{c.opens}</td>
                <td>{c.clicks}</td>
                <td>{c.conversions}</td>
                <td className="space-x-1">
                  {(c.status === "draft" || c.status === "paused") && (
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => launch(c.id)}
                    >
                      Launch
                    </button>
                  )}
                  {c.status === "active" && (
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => pause(c.id)}
                    >
                      Pause
                    </button>
                  )}
                  {(c.status === "active" || c.status === "paused") && (
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => complete(c.id)}
                    >
                      Complete
                    </button>
                  )}
                  <button
                    className="btn-ghost text-xs text-red-300"
                    onClick={() => del(c.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-surface-400">
                  No campaigns yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
