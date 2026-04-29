import { Link, Route, Routes } from "react-router-dom";
import { useAuth } from "../lib/auth";
import HomePage from "./HomePage";
import EventPage from "./EventPage";
import CheckoutSuccessPage from "./CheckoutSuccessPage";
import EmailPreviewsPage from "./EmailPreviewsPage";
import LoginPage from "./LoginPage";
import MarketingPage from "./MarketingPage";
import MyTicketsPage from "./MyTicketsPage";
import OrganizerDashboardPage from "./OrganizerDashboardPage";
import OrganizerEventEditPage from "./OrganizerEventEditPage";
import OrganizerEventNewPage from "./OrganizerEventNewPage";
import OrganizerPublicPage from "./OrganizerPublicPage";
import PricingPage from "./PricingPage";
import RegisterPage from "./RegisterPage";
import ScannerPage from "./ScannerPage";
import WaitlistPage from "./WaitlistPage";

export default function App() {
  const auth = useAuth();

  return (
    <div className="min-h-full bg-surface-950 text-surface-100">
      <header className="sticky top-0 z-50 border-b border-surface-800/80 bg-surface-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-surface-50 transition-colors hover:text-brand-400"
          >
            Planzo
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link className="btn-ghost hidden py-2 sm:inline-flex" to="/product">
              Product
            </Link>
            <Link className="btn-ghost hidden py-2 sm:inline-flex" to="/pricing">
              Pricing
            </Link>
            <Link className="btn-ghost hidden py-2 sm:inline-flex" to="/waitlist">
              Waitlist
            </Link>
            <Link className="btn-ghost py-2 sm:inline-flex" to="/my/tickets">
              My Tickets
            </Link>
            <Link className="btn-ghost py-2 sm:inline-flex" to="/organizer">
              Organizer
            </Link>
            <Link className="btn-ghost py-2 sm:inline-flex" to="/scanner">
              Scanner
            </Link>
            <Link className="btn-ghost hidden py-2 sm:inline-flex" to="/emails">
              Emails
            </Link>
            {auth.user ? (
              <>
                <span className="hidden truncate max-w-[140px] text-surface-400 text-sm md:inline">
                  {auth.user.email}
                </span>
                <button type="button" className="btn-secondary ml-2" onClick={() => auth.logout()}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link className="btn-ghost py-2" to="/login">
                  Login
                </Link>
                <Link className="btn-primary ml-2" to="/register">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product" element={<MarketingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/emails" element={<EmailPreviewsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/events/:id" element={<EventPage />} />
          <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="/my/tickets" element={<MyTicketsPage />} />
          <Route path="/organizer" element={<OrganizerDashboardPage />} />
          <Route path="/organizer/events/new" element={<OrganizerEventNewPage />} />
          <Route path="/organizer/events/:id/edit" element={<OrganizerEventEditPage />} />
          <Route path="/organizers/:id" element={<OrganizerPublicPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
        </Routes>
      </main>
    </div>
  );
}
