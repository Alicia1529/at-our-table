create unique index if not exists wine_experiences_one_wine_per_dinner_idx
  on public.wine_experiences(dinner_id, wine_id)
  where dinner_id is not null;

create unique index if not exists pairings_one_primary_wine_per_course_idx
  on public.course_wine_pairings(course_id);

create unique index if not exists ratings_one_member_pairing_idx
  on public.ratings(rater_user_id, pairing_id)
  where rater_user_id is not null and pairing_id is not null;

create unique index if not exists ratings_one_guest_pairing_idx
  on public.ratings(dinner_guest_id, pairing_id)
  where dinner_guest_id is not null and pairing_id is not null;
