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

export default router;
