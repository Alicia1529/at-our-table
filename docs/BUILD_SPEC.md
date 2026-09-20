# V1 build spec

## Product intent

At Our Table is a private shared journal for people who remember dinners through dishes, bottles, and conversation. The primary loop is: create a dinner before it happens, update the same object at the table, then return to it as a memory. Home and restaurant dinners follow the same model.

## Included surfaces

- Home: next dinner, recent memories, and a bottle worth revisiting.
- New dinner: location, date, guests, arbitrary course count, a lightweight menu suggestion scaffold, explainable course-level wine recommendations, and an optional starting wine list.
- Dinner detail: Plan / At the table / Memory modes, mutable dinner and course details, explicit dish-to-wine pairings, member-specific 5-point ratings, photos, notes, and browser voice recording.
- Journal feed: home/restaurant filtering and dinner history.
- Wine journal and wine detail: canonical wine records with private label images, introductions, and tasting notes, plus every distinct opening experience.
- Our Taste: explainable patterns derived from ratings and notes.
- Space settings: shared-space identity, members, and privacy language.
- Authentication and sharing: Google OAuth entry point and revocable read-only dinner links.

## Domain model

- `Dinner` is mutable throughout planning, happening, and remembered states.
- `Course` belongs to a dinner and uses an integer position, so menus can contain any number of courses.
- `Wine` is the stable bottle identity: producer, cuvée, vintage, grapes, origin, label image, introduction, and reusable tasting profile.
- `WineExperience` records one opening of one wine, optionally attached to a dinner. Serving notes belong here, not on the canonical wine.
- `CourseWinePairing` explicitly connects a course to a wine experience and carries pairing-specific notes.
- `Rating` belongs to one person and exactly one course, wine experience, or pairing. A rater may be a signed-in member or a named dinner guest.
- Photos and voice notes use private Storage paths and retain dinner/course context in Postgres.

## Access model

Every private record carries `space_id`. RLS uses security-definer membership helpers to avoid recursive policies on `space_members`. Authenticated members can read and write rows in their spaces; non-members cannot. The private Storage bucket uses the first path segment as the space boundary and applies the same membership check.

Share and invitation tokens are stored only as SHA-256 hashes. `get_shared_dinner(raw_token)` is a narrow read-only RPC that returns a curated dinner payload for unexpired, non-revoked links; anonymous users receive no direct table or Storage access. Invitations can only be accepted by an authenticated account whose email matches the invitation.

## Runtime modes and V1 boundary

The app has two runtime modes behind one interface:

- Demo mode requires no service credentials and stores complete interactive state in the browser. It is intended for product review, not durable or cross-device storage.
- Live mode activates automatically when the two public Supabase variables are present. All product mutations use Postgres and private Storage under member-scoped RLS; Google OAuth protects application routes.

V1 supplies deterministic menu suggestions and a transparent keyword-and-style wine matcher. Pairing recommendations are generated from the entered dish and the space's own wine journal, and always show a human-readable reason. The wine profile helper drafts editable introductions and tasting notes from user-entered bottle details; it does not pretend to identify a label or query an external catalog. Voice notes retain playable audio but are not transcribed. Invitations produce a secure private URL for the owner to send; transactional email delivery, remote wine-catalog enrichment, and model-backed recommendation quality are intentionally later work.
