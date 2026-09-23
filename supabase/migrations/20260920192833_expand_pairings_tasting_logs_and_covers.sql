-- A course may have more than one wine. The table-level
-- (course_id, wine_experience_id) constraint still prevents duplicates.
drop index if exists public.pairings_one_primary_wine_per_course_idx;

-- Tasting ratings are an append-only activity stream in the application.
-- This supports the dinner and wine-detail timelines without scanning every
-- rating in a space.
create index if not exists ratings_wine_experience_created_at_idx
  on public.ratings(wine_experience_id, created_at desc)
  where wine_experience_id is not null;
