# SakanMatch Workspace

## Overview

SakanMatch is a shared housing (colocation) platform for Morocco. Property owners can list rooms and subscribe to Premium monthly via PayPal. Seekers can browse listings, get smart matches, save favorites, send join requests, and message owners directly.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/sakanmatch)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (bcryptjs for password hashing, jsonwebtoken)
- **Payments**: PayPal Subscriptions API (monthly recurring, sandbox mode)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec) — new routes use direct fetch via lib/api.ts
- **Build**: esbuild (ESM bundle)
- **Theme**: CSS variable-based light/dark mode via ThemeProvider context

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port from env PORT)
│   └── sakanmatch/         # React+Vite frontend (previewPath: /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

### users
- id, email, name (optional display name), password (bcrypt hashed), role (owner|seeker)
- isPremium (boolean), premiumActivatedAt, premiumSource
- paypalSubscriptionId, subscriptionStatus, subscriptionPlanId, lastPaymentAt
- createdAt

### listings
- id, title, description (optional text), price, city, images (text[]), ownerId (→ users)
- createdAt

### user_preferences
- id, userId (unique → users), city, budgetMin, budgetMax
- lifestyle (quiet|social|any), smoking (yes|no|any), genderPref (male|female|any)
- updatedAt

### user_profiles (extended roommate profile)
- id, userId (unique → users)
- fullName, age, gender (male|female|other)
- occupation, bio, moveInDate, avatarUrl
- cleanlinessLevel (very_clean|clean|moderate|relaxed)
- sleepSchedule (early_bird|night_owl|flexible)
- noiseTolerance (quiet|moderate|loud)
- guestPreference (rarely|sometimes|often)
- petPreference (love_pets|no_pets|no_preference)
- updatedAt

### favorites
- id, userId (→ users), listingId (→ listings), createdAt

### requests
- id, seekerId (→ users), listingId (→ listings), status (pending|accepted|declined)
- message (optional), createdAt, updatedAt

### messages
- id, senderId (→ users), receiverId (→ users), listingId (optional → listings)
- body, read (boolean), createdAt

### premium_subscriptions
- id, userId (→ users), paypalSubscriptionId (unique), paypalPlanId
- status (pending|active|cancelled|suspended|expired)
- startTime, lastPaymentAt, createdAt, updatedAt

### premium_purchases (legacy, kept for historical records)
- id, userId, paypalOrderId (unique), paypalCaptureId
- invoiceId, amount, currency, status (pending|completed|denied)
- createdAt, updatedAt

## API Routes

### Auth (no auth required except /me)
- POST /api/auth/signup - {email, password, name?, role} → {token, user}
- POST /api/auth/login - {email, password} → {token, user}
- GET /api/auth/me - requires Bearer token

### Listings
- GET /api/listings - public, supports ?city, ?minPrice, ?maxPrice
- GET /api/listings/my - auth required
- GET /api/listings/:id - public
- POST /api/listings - auth required, owners only
- DELETE /api/listings/:id - auth required, owner only

### User Preferences
- GET /api/preferences - auth required → user preferences or null
- PUT /api/preferences - auth required → save/update preferences

### User Profiles (Roommate Profiles)
- GET /api/profile - auth required → {profile, preferences} (merged roommate profile)
- PUT /api/profile - auth required → update extended profile fields
- GET /api/profile/:userId - auth required → public profile view

### People Matching
- GET /api/matches/people - auth required → ranked list of compatible users with score & matchReasons
  - Query params: ?city=Casablanca, ?lifestyle=quiet

### Favorites
- GET /api/favorites - auth required → list of favorited listings
- GET /api/favorites/ids - auth required → array of listing IDs
- POST /api/favorites/:listingId - auth required → add favorite
- DELETE /api/favorites/:listingId - auth required → remove favorite

### Requests
- GET /api/requests - auth required → list of requests (role-aware)
- POST /api/requests - auth required, seekers only → send join request
- PATCH /api/requests/:id - auth required, owners only → {status: accepted|declined}

### Messages
- GET /api/messages/conversations - auth required → conversation list
- GET /api/messages/thread/:otherId - auth required → message thread
- POST /api/messages - auth required → send message

### Storage (Replit Object Storage)
- POST /api/storage/uploads/request-url - auth required, returns presigned GCS upload URL
- GET /api/storage/objects/* - serve uploaded images
- GET /api/storage/public-objects/* - serve public assets

### PayPal (Subscriptions API)
- POST /api/paypal/create-subscription - auth required, owners only
- POST /api/paypal/activate-subscription - auth required
- POST /api/paypal/webhook - PayPal signature verified

### Premium
- GET /api/premium/status - auth required

## Frontend Pages

- / - Landing page with hero, features grid, how-it-works, stats, featured listings, CTA footer
- /login - Login form
- /signup - Signup with role selection
- /dashboard - Protected. Role-aware: seeker sees top matches, suggested roommates, favorites, requests, messages; owner sees listings, requests, messages. Sidebar includes profile completion progress.
- /listings/new - Protected, owners only. Create listing with image uploader
- /listings/:id - Public listing detail with favorites toggle, request-to-join form, contact owner button
- /favorites - Protected. Saved listings for seekers
- /profile/preferences - Protected, seekers only. Set city, budget, lifestyle, smoking, gender prefs
- /profile - Protected. Full roommate profile editor with completion progress bar (personal info, location, lifestyle, preferences, about me sections)
- /profile/:userId - Protected. Read-only public view of another user's roommate profile
- /people - Protected. People Matches page — ranked grid of compatible users with score rings, trait chips, match reasons, filter by city/lifestyle
- /messages - Protected. Conversations list + message thread view
- /premium - Protected, owners only. PayPal subscription flow

## Frontend Components

- `Navbar` - Sticky nav with role-aware links, theme toggle (sun/moon), mobile hamburger menu
- `ListingCard` - Card with heart button for seekers (inline favorite toggle), image, price, city
- `ThemeProvider` (lib/theme.tsx) - React context for light/dark theme, persists to localStorage

## New API Client

New features (preferences, favorites, requests, messages) use `lib/api.ts` direct fetch helper instead of generated Orval hooks, since the OpenAPI spec wasn't updated for these routes.

## Object Storage

- Images are uploaded to Replit Object Storage (Google Cloud Storage)
- Two-step presigned URL flow: frontend requests upload URL, then PUTs file directly to GCS
- Uploaded images served at /api/storage/objects/:path
- Requires DEFAULT_OBJECT_STORAGE_BUCKET_ID, PUBLIC_OBJECT_SEARCH_PATHS, PRIVATE_OBJECT_DIR secrets

## Auth Flow

- JWT token stored in localStorage as `sakanmatch_token`
- Fetch interceptor auto-attaches Authorization header to all /api calls
- On app load: reads token from localStorage, calls GET /api/auth/me to validate
- 30-day JWT expiry
- On invalid/expired token: auto-logout and redirect to /login

## Theme System

- ThemeProvider wraps App.tsx
- Toggles `.dark` class on `<html>` element
- CSS variables in index.css: `:root {}` for light, `.dark {}` for dark
- Persists to localStorage as `sakanmatch_theme`
- Respects system `prefers-color-scheme` as default

## PayPal Subscription Integration

- Uses PayPal Subscriptions API (v1/billing/subscriptions) for monthly recurring payments
- Subscription flow: create-subscription → redirect to PayPal → approve → return with subscription_id → activate-subscription
- Webhook handles subscription lifecycle events
- Premium active only while subscription status is "active"

## Environment Variables / Secrets Required

- DATABASE_URL (auto-provisioned)
- JWT_SECRET (set by user)
- PAYPAL_CLIENT_ID (set by user)
- PAYPAL_CLIENT_SECRET (set by user)
- PAYPAL_WEBHOOK_ID (set by user)
- PAYPAL_PREMIUM_PLAN_ID (optional, auto-created if not set)
- PAYPAL_ENV (default: sandbox)

## Development

```bash
# Push DB schema
pnpm --filter @workspace/db run push-force

# Run codegen
pnpm --filter @workspace/api-spec run codegen

# Build API server
pnpm --filter @workspace/api-server run build
```
