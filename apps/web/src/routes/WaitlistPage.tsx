import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../lib/env";

export default function WaitlistPage() {
  const [params] = useSearchParams();
  const referralCode = params.get("ref") ?? "";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<{ referral_code: string; referrals: number; tier: string }[]>([]);
  const [progress, setProgress] = useState<{ referrals: number; tier: string } | null>(null);

  function getNextTierInfo(referrals: number) {
    if (referrals >= 15) return { tier: "Platinum", nextAt: 15, progress: 1 };
    if (referrals >= 8) return { tier: "Gold", nextAt: 15, progress: (referrals - 8) / (15 - 8) };
    if (referrals >= 4) return { tier: "Silver", nextAt: 8, progress: (referrals - 4) / (8 - 4) };
    return { tier: "Bronze", nextAt: 4, progress: referrals / 4 };
  }

  useEffect(() => {
    if (referralCode) {
      setStatus(`Referred by ${referralCode}`);
    }
  }, [referralCode]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE_URL}/waitlist/leaderboard`, { headers: { accept: "application/json" } });
      const data = await res.json();
      if (res.ok) setLeaders(data.leaders ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="card text-center">
        <div className="badge-brand mb-4 inline-flex">Waitlist</div>
        <h1 className="font-display text-3xl font-bold text-surface-50">Get early access to Planzo</h1>
        <p className="mt-2 text-surface-400">
          Join the list and get a referral link to move up the queue.
        </p>
      </div>

      {status ? (
        <div className="rounded-xl border border-surface-700 bg-surface-900/50 px-4 py-3 text-sm text-surface-300">
          {status}
        </div>
      ) : null}

      <form
        className="card space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus(null);
          const res = await fetch(`${API_BASE_URL}/waitlist`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ email, referralCode })
          });
          const data = await res.json();
          if (!res.ok) {
            setStatus(data?.message ?? "Failed to join waitlist");
            return;
          }
          setReferralLink(data.referralLink);
          const statusRes = await fetch(`${API_BASE_URL}/waitlist/status?email=${encodeURIComponent(email)}`, {
            headers: { accept: "application/json" }
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setProgress({ referrals: statusData.referrals ?? 0, tier: statusData.tier ?? "Bronze" });
          }
          setStatus("You're in! Share your referral link.");
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-surface-300">Email</span>
          <input
            className="input mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <button type="submit" className="btn-primary w-full">
          Join waitlist
        </button>
      </form>

      {referralLink ? (
        <div className="card space-y-4">
          <h2 className="font-display text-lg font-semibold text-surface-50">Your referral link</h2>
          <div className="break-all rounded-xl border border-surface-700 bg-surface-950/50 p-3 text-sm text-surface-300">
            {referralLink}
          </div>
          <button
            className="btn-primary w-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(referralLink);
                setStatus("Referral link copied.");
              } catch {
                setStatus(referralLink);
              }
            }}
          >
            Copy link
          </button>
          {progress ? (
            <div className="text-sm text-surface-400">
              Tier: <span className="font-medium text-surface-200">{progress.tier}</span> • Referrals:{" "}
              <span className="font-medium text-surface-200">{progress.referrals}</span>
            </div>
          ) : null}
          {progress ? (
            <div>
              {(() => {
                const info = getNextTierInfo(progress.referrals);
                const pct = Math.min(100, Math.max(0, info.progress * 100));
                return (
                  <>
                    <div className="mb-1 text-xs text-surface-500">Next tier: {info.nextAt} referrals</div>
                    <div className="h-2 w-full rounded-full bg-surface-800">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
          <button
            className="btn-secondary w-full"
            onClick={async () => {
              const res = await fetch(`${API_BASE_URL}/waitlist/rewards/send`, {
                method: "POST",
                headers: { "content-type": "application/json", accept: "application/json" },
                body: JSON.stringify({ email })
              });
              const data = await res.json();
              if (!res.ok) {
                setStatus(data?.error ?? "Reward email not sent");
                return;
              }
              setStatus(`Reward email sent for ${data.tier} tier.`);
            }}
          >
            Email me my reward status
          </button>
        </div>
      ) : null}

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-surface-50">Referral leaderboard</h2>
        <p className="mt-1 text-sm text-surface-500">Top community champions</p>
        {leaders.length === 0 ? (
          <p className="mt-4 text-surface-400">No referrals yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {leaders.map((l, idx) => (
              <li
                key={l.referral_code}
                className="flex items-center justify-between rounded-xl border border-surface-700 bg-surface-950/50 px-4 py-3"
              >
                <span className="font-medium text-surface-200">
                  #{idx + 1} · {l.referral_code}
                </span>
                <span className="flex items-center gap-2">
                  <span className="badge-brand">{l.tier}</span>
                  <span className="text-sm text-surface-400">{l.referrals} referrals</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-surface-500">
        Already organizing?{" "}
        <Link className="font-medium text-brand-400 hover:text-brand-300" to="/organizer">
          Go to dashboard
        </Link>
      </p>
    </div>
  );
}
