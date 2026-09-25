-- A bottle may belong to the dinner without being paired to a specific course.
-- This keeps the shared collaborator flow aligned with the member wine list.
create or replace function private.add_shared_dinner_wine(
  raw_token text,
  target_course_id uuid,
  existing_wine_id uuid default null,
  wine_profile jsonb default null,
  serving_note text default '',
  pairing_note text default ''
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_dinner_id uuid;
  target_space_id uuid;
  attribution_user_id uuid;
  target_wine_id uuid;
  target_experience_id uuid;
  profile_vintage integer;
  profile_color text;
  profile_grapes text[];
begin
  select share_link.dinner_id, share_link.space_id, share_link.created_by
    into target_dinner_id, target_space_id, attribution_user_id
  from public.share_links share_link
  where share_link.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and share_link.revoked_at is null
    and (share_link.expires_at is null or share_link.expires_at > now())
  for update;
  if target_dinner_id is null then raise exception 'Share link is invalid or expired'; end if;

  if target_course_id is not null and not exists (
    select 1 from public.courses course
    where course.id = target_course_id
      and course.dinner_id = target_dinner_id
      and course.space_id = target_space_id
  ) then raise exception 'Course does not belong to this dinner'; end if;

  if (existing_wine_id is null) = (wine_profile is null) then
    raise exception 'Choose one saved wine or provide one new wine';
  end if;

  if existing_wine_id is not null then
    select wine.id into target_wine_id
    from public.wines wine
    where wine.id = existing_wine_id and wine.space_id = target_space_id;
    if target_wine_id is null then raise exception 'Wine is not available to this shared dinner'; end if;
  else
    if jsonb_typeof(wine_profile) is distinct from 'object'
      or char_length(trim(coalesce(wine_profile ->> 'producer', ''))) not between 1 and 200
      or char_length(trim(coalesce(wine_profile ->> 'cuvee', ''))) > 200
      or char_length(trim(coalesce(wine_profile ->> 'region', ''))) > 160
      or char_length(trim(coalesce(wine_profile ->> 'country', ''))) > 120
      or char_length(coalesce(wine_profile ->> 'description', '')) > 4000
      or char_length(coalesce(wine_profile ->> 'tasting_notes', '')) > 4000
    then raise exception 'Invalid wine profile'; end if;

    if coalesce(wine_profile ->> 'vintage', '') <> '' then
      if (wine_profile ->> 'vintage') !~ '^[0-9]{4}$' then raise exception 'Invalid vintage'; end if;
      profile_vintage := (wine_profile ->> 'vintage')::integer;
      if profile_vintage not between 1800 and 2200 then raise exception 'Invalid vintage'; end if;
    end if;
    profile_color := nullif(lower(trim(coalesce(wine_profile ->> 'color', ''))), '');
    if profile_color = 'rosé' then profile_color := 'rose'; end if;
    if profile_color is not null and profile_color not in ('red', 'white', 'orange', 'rose', 'sparkling', 'fortified') then
      raise exception 'Invalid wine color';
    end if;
    if wine_profile ? 'grapes' and jsonb_typeof(wine_profile -> 'grapes') is distinct from 'array' then
      raise exception 'Grapes must be an array';
    end if;
    if coalesce(jsonb_array_length(coalesce(wine_profile -> 'grapes', '[]'::jsonb)), 0) > 20
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(wine_profile -> 'grapes', '[]'::jsonb)) grape
        where char_length(trim(grape)) not between 1 and 80
      )
    then raise exception 'Invalid grape varieties'; end if;
    select coalesce(array_agg(trim(grape)), '{}'::text[]) into profile_grapes
    from jsonb_array_elements_text(coalesce(wine_profile -> 'grapes', '[]'::jsonb)) grape;

    insert into public.wines (
      space_id, created_by, producer, cuvee, vintage, region, country,
      grapes, color, reference_notes, tasting_notes
    ) values (
      target_space_id, attribution_user_id, trim(wine_profile ->> 'producer'),
      nullif(trim(coalesce(wine_profile ->> 'cuvee', '')), ''), profile_vintage,
      nullif(trim(coalesce(wine_profile ->> 'region', '')), ''),
      nullif(trim(coalesce(wine_profile ->> 'country', '')), ''),
      profile_grapes, profile_color::public.wine_color,
      nullif(trim(coalesce(wine_profile ->> 'description', '')), ''),
      nullif(trim(coalesce(wine_profile ->> 'tasting_notes', '')), '')
    ) returning id into target_wine_id;
  end if;

  select experience.id into target_experience_id
  from public.wine_experiences experience
  where experience.dinner_id = target_dinner_id
    and experience.wine_id = target_wine_id
    and experience.space_id = target_space_id
  order by experience.created_at
  limit 1;

  if target_experience_id is null then
    insert into public.wine_experiences (
      space_id, wine_id, dinner_id, opened_at, serving_notes, created_by
    ) values (
      target_space_id, target_wine_id, target_dinner_id, now(),
      nullif(trim(left(coalesce(serving_note, ''), 2000)), ''), attribution_user_id
    ) returning id into target_experience_id;
  end if;

  if target_course_id is not null then
    insert into public.course_wine_pairings (
      space_id, dinner_id, course_id, wine_experience_id, notes
    ) values (
      target_space_id, target_dinner_id, target_course_id, target_experience_id,
      nullif(trim(left(coalesce(pairing_note, ''), 2000)), '')
    )
    on conflict (course_id, wine_experience_id)
    do update set notes = excluded.notes;
  end if;

  return private.get_shared_dinner(raw_token);
end;
$$;
