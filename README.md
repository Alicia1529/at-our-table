# At Our Table

Plan dinner, pair the wine, and remember what you loved.

A mobile-first private dinner journal built with Next.js, TypeScript, Tailwind CSS, and Supabase. V1 centers the dinner memory: menus, explicit dish-to-wine pairings, photos, voice-note-ready capture, and person-specific ratings. Wine records are intentionally separate from the experience of opening a bottle at a particular dinner.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app runs with representative mock data when Supabase variables are absent. Add a Supabase project URL and publishable key to enable Google sign-in and apply the migration in `supabase/migrations` before connecting live data.

```bash
npm run typecheck
npm run lint
npm run build
```

## Supabase setup

1. Create a Supabase project and enable the Google provider.
2. Add `http://localhost:3000/auth/callback` and the production callback URL to the redirect allow list.
3. Apply `supabase/migrations/20260919000000_initial_schema.sql`.
4. Create `.env.local` from `.env.example`.

The migration creates a private `dinner-media` bucket. Object paths must start with the space UUID: `<space-id>/<dinner-id>/<file>`.

See [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) for scope and architectural decisions.
