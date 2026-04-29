import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-surface-50">Create account</h1>
        <p className="mt-1 text-surface-400">Join Planzo and discover local workshops</p>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : null}
      <form
        className="card space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await auth.register(email, password);
            navigate("/");
          } catch (err: any) {
            setError(err?.message ?? "Registration failed");
          }
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-surface-300">Email</span>
          <input
            className="input mt-1.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-surface-300">Password</span>
          <input
            className="input mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
      </form>
      <p className="text-center text-sm text-surface-400">
        Already have an account?{" "}
        <Link className="font-medium text-brand-400 hover:text-brand-300" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
