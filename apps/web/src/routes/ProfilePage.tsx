import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

type Profile = {
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  marketing_opt_in: boolean;
};

type Prefs = {
  email_event_reminders: boolean;
  email_order_receipts: boolean;
  email_marketing: boolean;
  email_organizer_updates: boolean;
  push_event_reminders: boolean;
  push_marketing: boolean;
  sms_event_reminders: boolean;
};

type PaymentMethod = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
};

export default function ProfilePage() {
  const auth = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) {
      nav("/login?next=/account");
      return;
    }
    Promise.all([
      auth.apiFetch<{ profile: Profile }>("/account/profile"),
      auth.apiFetch<{ preferences: Prefs }>("/account/notifications"),
      auth.apiFetch<{ paymentMethods: PaymentMethod[] }>(
        "/account/payment-methods",
      ),
    ])
      .then(([p, n, pm]) => {
        setProfile(p.profile);
        setPrefs(n.preferences);
        setMethods(pm.paymentMethods);
      })
      .catch((e) => setError(e.message));
  }, [auth.user]);

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    try {
      await auth.apiFetch("/account/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName: profile.display_name,
          phone: profile.phone,
          bio: profile.bio,
          city: profile.city,
          country: profile.country,
          marketingOptIn: profile.marketing_opt_in,
        }),
      });
      setInfo("Profile saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrefs() {
    if (!prefs) return;
    setSavingPrefs(true);
    try {
      await auth.apiFetch("/account/notifications", {
        method: "PUT",
        body: JSON.stringify({
          emailEventReminders: prefs.email_event_reminders,
          emailOrderReceipts: prefs.email_order_receipts,
          emailMarketing: prefs.email_marketing,
          emailOrganizerUpdates: prefs.email_organizer_updates,
          pushEventReminders: prefs.push_event_reminders,
          pushMarketing: prefs.push_marketing,
          smsEventReminders: prefs.sms_event_reminders,
        }),
      });
      setInfo("Preferences saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function removeMethod(id: string) {
    await auth.apiFetch(`/account/payment-methods/${id}`, { method: "DELETE" });
    setMethods((m) => m.filter((x) => x.id !== id));
  }

  async function makeDefault(id: string) {
    await auth.apiFetch(`/account/payment-methods/${id}/default`, {
      method: "POST",
    });
    setMethods((m) => m.map((x) => ({ ...x, is_default: x.id === id })));
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account? Your tickets remain valid."))
      return;
    try {
      await auth.apiFetch("/account/delete", {
        method: "POST",
        body: JSON.stringify({
          password: deletePassword,
          reason: deleteReason,
        }),
      });
      await auth.logout();
      nav("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!profile || !prefs) return <p className="text-surface-300">Loading…</p>;

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl">Account</h1>
      {error && (
        <p className="rounded border border-red-700 bg-red-950/40 p-3 text-red-300">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded border border-emerald-700 bg-emerald-950/40 p-3 text-emerald-300">
          {info}
        </p>
      )}

      <section className="card space-y-4">
        <h2 className="font-display text-xl">Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Display name"
            value={profile.display_name ?? ""}
            onChange={(v) => setProfile({ ...profile, display_name: v })}
          />
          <Field
            label="Phone"
            value={profile.phone ?? ""}
            onChange={(v) => setProfile({ ...profile, phone: v })}
          />
          <Field
            label="City"
            value={profile.city ?? ""}
            onChange={(v) => setProfile({ ...profile, city: v })}
          />
          <Field
            label="Country"
            value={profile.country ?? ""}
            onChange={(v) => setProfile({ ...profile, country: v })}
          />
        </div>
        <label className="block text-sm">
          <span className="text-surface-300">Bio</span>
          <textarea
            className="mt-1 input"
            rows={3}
            value={profile.bio ?? ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-surface-200">
          <input
            type="checkbox"
            checked={profile.marketing_opt_in}
            onChange={(e) =>
              setProfile({ ...profile, marketing_opt_in: e.target.checked })
            }
          />
          Allow marketing emails
        </label>
        <button
          className="btn-primary"
          onClick={saveProfile}
          disabled={savingProfile}
        >
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">Notification preferences</h2>
        {Object.entries(prefs).map(([key, val]) => (
          <label
            key={key}
            className="flex items-center justify-between border-b border-surface-800/50 py-2 text-sm"
          >
            <span className="text-surface-200">{key.replace(/_/g, " ")}</span>
            <input
              type="checkbox"
              checked={val}
              onChange={(e) =>
                setPrefs({ ...prefs, [key]: e.target.checked } as Prefs)
              }
            />
          </label>
        ))}
        <button
          className="btn-primary"
          onClick={savePrefs}
          disabled={savingPrefs}
        >
          {savingPrefs ? "Saving…" : "Save preferences"}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">Saved payment methods</h2>
        {methods.length === 0 ? (
          <p className="text-surface-400 text-sm">
            No saved cards yet. Cards are saved automatically when you opt in at
            checkout.
          </p>
        ) : (
          methods.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b border-surface-800/50 py-2"
            >
              <div>
                <span className="font-medium">
                  {m.brand ?? "Card"} •••• {m.last4 ?? "????"}
                </span>
                {m.exp_month && m.exp_year && (
                  <span className="ml-3 text-surface-400 text-sm">
                    exp {m.exp_month}/{m.exp_year}
                  </span>
                )}
                {m.is_default && (
                  <span className="ml-3 rounded bg-brand-600/20 px-2 py-0.5 text-xs text-brand-300">
                    default
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {!m.is_default && (
                  <button
                    className="btn-ghost text-sm"
                    onClick={() => makeDefault(m.id)}
                  >
                    Set default
                  </button>
                )}
                <button
                  className="btn-ghost text-sm text-red-300"
                  onClick={() => removeMethod(m.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card space-y-3 border-red-900/40">
        <h2 className="font-display text-xl text-red-300">Delete account</h2>
        <p className="text-sm text-surface-400">
          This anonymizes your account and revokes login. Past tickets and
          orders remain valid for organizers.
        </p>
        <input
          type="password"
          placeholder="Confirm password"
          className="input"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
        <input
          type="text"
          placeholder="Reason (optional)"
          className="input"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
        />
        <button
          className="btn-secondary border-red-700 text-red-300"
          onClick={deleteAccount}
        >
          Permanently delete my account
        </button>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-surface-300">{label}</span>
      <input
        className="mt-1 input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
