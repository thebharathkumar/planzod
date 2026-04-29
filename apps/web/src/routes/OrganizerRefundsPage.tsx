import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Refund = {
  id: string;
  order_id: string;
  reason: string;
  amount_cents: number;
  status: string;
  attendee_email: string;
  event_title: string;
  created_at: string;
};

export default function OrganizerRefundsPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filter, setFilter] = useState("requested");
  const [openNote, setOpenNote] = useState<{
    id: string;
    decision: "approve" | "deny";
  } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!auth.user) return nav("/login?next=/organizer/refunds");
    refresh();
  }, [auth.user, filter]);

  async function refresh() {
    const r = await auth.apiFetch<{ refunds: Refund[] }>(
      `/refunds/organizer?status=${filter}`,
    );
    setRefunds(r.refunds);
  }

  async function decide() {
    if (!openNote) return;
    try {
      await auth.apiFetch(`/refunds/${openNote.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: openNote.decision, note }),
      });
      setOpenNote(null);
      setNote("");
      await refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Refund requests</h1>
      <div className="flex gap-2">
        {["requested", "approved", "denied", "refunded"].map((s) => (
          <button
            key={s}
            className={`btn-${filter === s ? "primary" : "ghost"} text-sm`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {refunds.length === 0 ? (
        <p className="text-surface-400">No requests in this state.</p>
      ) : (
        <ul className="space-y-3">
          {refunds.map((r) => (
            <li key={r.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.event_title}</p>
                  <p className="text-sm text-surface-400">
                    From {r.attendee_email}
                  </p>
                  <p className="mt-1 text-sm">{r.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${(r.amount_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-surface-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {r.status === "requested" && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary text-sm"
                    onClick={() =>
                      setOpenNote({ id: r.id, decision: "approve" })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => setOpenNote({ id: r.id, decision: "deny" })}
                  >
                    Deny
                  </button>
                </div>
              )}
              {openNote?.id === r.id && (
                <div className="mt-3 space-y-2 rounded border border-surface-800/60 bg-surface-900/40 p-3">
                  <p className="text-sm text-surface-300">
                    Add a note for the attendee:
                  </p>
                  <textarea
                    className="input"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      openNote.decision === "approve"
                        ? "Optional note"
                        : "Reason for denial"
                    }
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary text-sm" onClick={decide}>
                      Confirm {openNote.decision}
                    </button>
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => {
                        setOpenNote(null);
                        setNote("");
                      }}
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
