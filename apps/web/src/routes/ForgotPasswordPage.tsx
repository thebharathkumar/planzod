import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../lib/env";

export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const tokenInUrl = params.get("token");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(tokenInUrl ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [stage, setStage] = useState<"request" | "reset">(
    tokenInUrl ? "reset" : "request",
  );
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const r = await fetch(`${API_BASE_URL}/account/password/forgot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Request failed");
      setInfo(
        data.devLink
          ? `Reset link (dev mode): ${data.devLink}`
          : "If that email is registered, we sent a reset link.",
      );
      setStage("reset");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const r = await fetch(`${API_BASE_URL}/account/password/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Reset failed");
      setInfo("Password updated. You can now log in.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-3xl">Recover password</h1>
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

      {stage === "request" ? (
        <form onSubmit={requestReset} className="card space-y-3">
          <p className="text-sm text-surface-300">
            Enter your email and we'll send a reset link.
          </p>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-sm">
            <Link to="/login" className="text-brand-300">
              Back to login
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submitReset} className="card space-y-3">
          <input
            className="input"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Reset token"
          />
          <input
            className="input"
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
          />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Updating…" : "Reset password"}
          </button>
          <p className="text-sm">
            <Link to="/login" className="text-brand-300">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
