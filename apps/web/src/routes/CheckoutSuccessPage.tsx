import { Link } from "react-router-dom";

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="card">
        <div className="text-4xl">✓</div>
        <h1 className="mt-4 font-display text-2xl font-bold text-surface-50">Payment received</h1>
        <p className="mt-2 text-surface-400">
          Your ticket is issued via Stripe webhook processing. It may take a few seconds to appear.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className="btn-primary" to="/my/tickets">
            View my tickets
          </Link>
          <Link className="btn-secondary" to="/">
            Back to search
          </Link>
        </div>
      </div>
    </div>
  );
}
