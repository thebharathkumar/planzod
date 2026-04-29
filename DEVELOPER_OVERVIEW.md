# Developer Overview: Planzo Platform

Welcome to the Planzo development team. This document provides a high-level overview of our architecture, technology stack, and core features to help you get up to speed quickly.

## 🏗 Project Architecture

Planzo is structured as a **Monorepo** to keep our frontend, backend, and infrastructure code synchronized.

### Folder Structure
- **`apps/api/`**: The Node.js/Postgres backend. This handles our business logic, database migrations, and AI-driven data generation.
- **`apps/web/`**: The main Vite-based React frontend. This is our primary user-facing application.
- **`src/app/`**: Our core frontend logic folder. It contains global state (`store.tsx`), shared `components`, and our routing/page system.
- **`packages/shared/`**: Shared TypeScript types and utilities used across both the API and Web applications.

## 🛠 Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS (v4), Motion (for animations).
- **State Management**: Redux Toolkit (or custom store logic in `store.tsx`).
- **Backend**: Node.js, Express, PostgreSQL, Prisma (or raw PostGIS for spatial data).
- **Maps**: Leaflet and Cobe (for 3D globe visualization).
- **Icons**: Lucide-react and MUI Icons.

## 🌟 Core Features

- **Event Discovery**: Interactive mapping for finding local events.
- **3D Globe**: Global exploration of events via an interactive Cobe globe.
- **Dashboards**: Dedicated interfaces for Marketing, Admin, Finance, and Organizers.
- **Checkouts**: Integrated payment flow via Stripe.
- **Support Portal**: A comprehensive FAQ and customer support center.

## 🚀 Getting Started

1.  **Dependencies**: Run `npm install` at the root.
2.  **Environment**: Copy `.env.example` to `.env` and fill in your local secrets.
3.  **Local Development**: Run `npm run dev` to start the development servers.
4.  **Backend Only**: Use `npm run dev:api`.
5.  **Frontend Only**: Use `npm run dev:web`.

## 🎨 Coding Guidelines

- **Component First**: Favor small, reusable components in `src/app/components`.
- **Aesthetics**: Follow our design tokens in `src/styles/theme.css` to maintain visual consistency.
- **Type Safety**: Prefer strict TypeScript types for all new features. 
