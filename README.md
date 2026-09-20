# At Our Table

Plan dinner, pair the wine, and remember what you loved.

A mobile-first private dinner journal built with Next.js, TypeScript, Tailwind CSS, and Supabase. V1 centers the dinner memory: menus, explicit dish-to-wine pairings, photos, voice-note-ready capture, and person-specific ratings. Wine records are intentionally separate from the experience of opening a bottle at a particular dinner.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no environment variables, the app runs as a fully interactive demo and persists dinners, wines, ratings, notes, photos, invitations, shares, and preferences in the browser. Add a Supabase project URL and publishable key to switch to Google sign-in, Postgres, private Storage, and row-level security.

```bash
npm run typecheck
npm run lint
npm run build
```

## Supabase setup

1. Create a Supabase project and enable the Google provider.
2. Add `http://localhost:3000/auth/callback` and the production callback URL to the redirect allow list.
3. Apply every SQL file in `supabase/migrations` in filename order.
4. Create `.env.local` from `.env.example`.

The migration creates a private `dinner-media` bucket. Object paths must start with the space UUID: `<space-id>/<dinner-id>/<file>`.

The database bootstrap automatically creates a private space for each new account. Invitations are email-bound, share tokens are stored as hashes, and anonymous share pages receive only a curated read-only payload—never direct table or Storage access.

## Functional V1

- Create home or restaurant dinners with any number of courses, guests, and starting wines.
- Edit the same dinner before, during, and after the meal, including its courses and remembered status.
- Keep canonical wine records separate from dinner-specific wine experiences.
- Pair a dish to a wine explicitly, then save a member-specific 1–5 rating and notes.
- Capture many private photos, browser-recorded voice notes, and quick written memories.
- Search and filter the dinner journal and wine history; derive the shared taste view from saved data.
- Manage space identity and members, accept private invitation links, and create read-only dinner share links.
- Start a menu with a simple built-in suggestion; richer AI recommendations are intentionally outside V1.

See [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) for scope and architectural decisions.
