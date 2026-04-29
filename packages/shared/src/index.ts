export const USER_ROLES = ["attendee", "organizer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const TICKET_STATUSES = ["issued", "voided"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ORDER_STATUSES = ["pending", "paid", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const EVENT_CATEGORIES = [
  "workshop",
  "class",
  "meetup",
  "concert",
  "community",
  "sports",
  "food",
  "arts",
  "other"
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

