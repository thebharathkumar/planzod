import { Router } from "express";
import authRouter from "./auth";
import organizerRouter from "./organizer";
import eventsRouter from "./events";
import searchRouter from "./search";
import ticketTiersRouter from "./ticketTiers";
import checkoutRouter from "./checkout";
import meRouter from "./me";
import ticketsRouter from "./tickets";
import aiRouter from "./ai";
import shareRouter from "./share";
import waitlistRouter from "./waitlist";
import emailRouter from "./emails";
import accountRouter from "./account";
import supportRouter from "./support";
import refundsRouter from "./refunds";
import eventReviewsRouter from "./eventReviews";
import announcementsRouter from "./announcements";
import campaignsRouter from "./campaigns";
import recommendationsRouter from "./recommendations";
import financeRouter from "./finance";
import analyticsRouter from "./analytics";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.use("/auth", authRouter);
router.use("/organizer", organizerRouter);
router.use("/events", eventsRouter);
router.use("/search", searchRouter);
router.use(ticketTiersRouter);
router.use("/checkout", checkoutRouter);
router.use("/me", meRouter);
router.use("/tickets", ticketsRouter);
router.use("/ai", aiRouter);
router.use("/share", shareRouter);
router.use("/waitlist", waitlistRouter);
router.use("/emails", emailRouter);

// New feature modules
router.use("/account", accountRouter);
router.use("/support", supportRouter);
router.use("/refunds", refundsRouter);
router.use(eventReviewsRouter); // mounts /events/:id/reviews
router.use(announcementsRouter); // mounts /events/:id/announcements
router.use("/campaigns", campaignsRouter);
router.use(recommendationsRouter); // mounts /interactions and /recommendations
router.use("/finance", financeRouter);
router.use("/analytics", analyticsRouter);

export default router;
