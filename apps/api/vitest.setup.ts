process.env.PORT ??= "4000";
process.env.DATABASE_URL ??= "postgres://planzo:planzo@localhost:5432/planzo";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

process.env.JWT_ACCESS_SECRET ??= "test_access_secret_please_change";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_please_change";
process.env.JWT_ACCESS_TTL ??= "15m";
process.env.JWT_REFRESH_TTL ??= "30d";

process.env.WEB_BASE_URL ??= "http://localhost:5173";
process.env.TICKET_QR_SECRET ??= "test_ticket_qr_secret_please_change";

