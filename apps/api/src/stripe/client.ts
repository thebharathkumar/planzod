import Stripe from "stripe";
import { env } from "../env";

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

