import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Announcement = {
  id: string;
  subject: string;
  body: string;
  channel: string;
  recipient_count: number;
  sent_at: string;
};

export default function OrganizerAnnouncementsPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Announcement[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"email" | "push" | "sms">("email");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return nav("/login");
    if (!id) return;
    refresh();
  }, [auth.user, id]);

  async function refresh() {
    if (!id) return;
    const r = await auth.apiFetch<{ announcements: Announcement[] }>(
      `/events/${id}/announcements`,
    );
    setItems(r.announcements);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const r = await auth.apiFetch<{ recipients: number }>(
        `/events/${id}/announcements`,
        {
          method: "POST",
          body: JSON.stringify({ subject, body, channel }),
        },
      );
      setInfo(`Sent to ${r.recipients} recipients.`);
      setSubject("");
      setBody("");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Send updates</h1>
        <Link to={`/organizer/events/${id}/edit`} className="btn-ghost">
          Back to event
        </Link>
      </div>
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

      <form onSubmit={send} className="card space-y-3">
        <select
          className="input"
          value={channel}
          onChange={(e) => setChannel(e.target.value as any)}
        >
          <option value="email">Email</option>
          <option value="push">Push notification</option>
          <option value="sms">SMS</option>
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
          rows={6}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's the update?"
        />
        <button className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send to attendees"}
        </button>
      </form>

      <section className="card">
        <h2 className="font-display text-xl">History</h2>
        {items.length === 0 ? (
          <p className="text-surface-400 text-sm">No announcements sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id} className="border-t border-surface-800/50 pt-2">
                <p className="font-medium">{a.subject}</p>
                <p className="text-xs text-surface-400">
                  {a.channel} · {a.recipient_count} recipients ·{" "}
                  {new Date(a.sent_at).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-surface-300 whitespace-pre-line">
                  {a.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
