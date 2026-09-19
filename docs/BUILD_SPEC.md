# V1 build spec

## Product intent

At Our Table is a private shared journal for people who remember dinners through dishes, bottles, and conversation. The primary loop is: create a dinner before it happens, update the same object at the table, then return to it as a memory. Home and restaurant dinners follow the same model.

## Included surfaces

- Home: next dinner, recent memories, and a bottle worth revisiting.
- New dinner: location, date, guests, arbitrary course count, and an optional starting wine list.
- Dinner detail: Plan / At the table / Memory modes, explicit dish-to-wine pairings, individual 5-point ratings, photos, notes, and voice-note-ready capture.
- Journal feed: home/restaurant filtering and dinner history.
- Wine journal and wine detail: canonical wine records plus every distinct opening experience.
- Our Taste: explainable patterns derived from ratings and notes.
- Space settings: shared-space identity, members, and privacy language.
- Authentication and sharing: Google OAuth entry point and revocable read-only dinner links.

## Domain model

- `Dinner` is mutable throughout planning, happening, and remembered states.
- `Course` belongs to a dinner and uses an integer position, so menus can contain any number of courses.
- `Wine` is the stable bottle identity: producer, cuvée, vintage, grapes, and origin.
- `WineExperience` records one opening of one wine, optionally attached to a dinner. Serving notes belong here, not on the canonical wine.
- `CourseWinePairing` explicitly connects a course to a wine experience and carries pairing-specific notes.
- `Rating` belongs to one person and exactly one course, wine experience, or pairing. A rater may be a signed-in member or a named dinner guest.
- Photos and voice notes use private Storage paths and retain dinner/course context in Postgres.

## Access model

Every private record carries `space_id`. RLS uses security-definer membership helpers to avoid recursive policies on `space_members`. Authenticated members can read and write rows in their spaces; non-members cannot. The private Storage bucket uses the first path segment as the space boundary and applies the same membership check.

Share tokens are stored only as SHA-256 hashes. `get_shared_dinner(raw_token)` is a narrow read-only RPC that returns a curated dinner payload for unexpired, non-revoked links; anonymous users receive no direct table or Storage access.

## V1 boundary

The UI currently uses realistic mock data so the complete flow can be reviewed before a Supabase project is connected. The schema, OAuth callback, session refresh proxy, and RLS/storage policies are ready to connect. AI menu generation is intentionally represented only as future-compatible product copy; recommendation quality, transcription, upload orchestration, invitations by email, and production data mutations are follow-on integration work.
