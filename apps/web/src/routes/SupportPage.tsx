import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { API_BASE_URL } from "../lib/env";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
};

export default function SupportPage() {
  const auth = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [email, setEmail] = useState(auth.user?.email ?? "");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return;
    auth
      .apiFetch<{ tickets: Ticket[] }>("/support/mine")
      .then((r) => setTickets(r.tickets))
      .catch(() => {});
  }, [auth.user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const r = await fetch(`${API_BASE_URL}/support`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(auth.accessToken
            ? { authorization: `Bearer ${auth.accessToken}` }
            : {}),
        },
        body: JSON.stringify({ email, subject, category, message }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Submit failed");
      setInfo(`Ticket #${data.ticketId.slice(0, 8)} created`);
      setSubject("");
      setMessage("");
      if (auth.user) {
        const refreshed = await auth.apiFetch<{ tickets: Ticket[] }>(
          "/support/mine",
        );
        setTickets(refreshed.tickets);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Customer support</h1>
      {err && (
        <p className="rounded border border-red-700 bg-red-950/40 p-3 text-red-300">
          {err}
        </p>
      )}
      {info && (
        <p className="rounded border border-emerald-700 bg-emerald-950/40 p-3 text-emerald-300">
          {info}
        </p>
      )}

      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-display text-xl">Contact us</h2>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
        />
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="general">General question</option>
          <option value="billing">Billing &amp; refunds</option>
          <option value="event">Event issue</option>
          <option value="technical">Technical problem</option>
          <option value="feedback">Feedback</option>
        </select>
        <input
          className="input"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
        <textarea
          className="input"
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send message"}
        </button>
      </form>

      {auth.user && tickets.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-display text-xl">Your previous tickets</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-surface-400">
              <tr>
                <th>Subject</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-surface-800/50">
                  <td className="py-2">{t.subject}</td>
                  <td>{t.category}</td>
                  <td>{t.status}</td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
