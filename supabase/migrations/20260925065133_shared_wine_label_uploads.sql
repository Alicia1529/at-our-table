-- A share token remains the capability boundary for label uploads. Files use
-- the normal space-first path so authenticated members can read them, while a
-- token hash in the third segment scopes anonymous inserts to an active link.
create or replace function private.can_upload_shared_wine_label(object_name text)
returns boolean language sql security definer stable set search_path = '' as $$
  select coalesce(
    array_length(string_to_array(object_name, '/'), 1) = 4
    and split_part(object_name, '/', 2) = 'shared-wine-labels'
    and exists (
      select 1
      from public.share_links share_link
      where share_link.space_id::text = split_part(object_name, '/', 1)
        and share_link.token_hash = split_part(object_name, '/', 3)
        and share_link.revoked_at is null
        and (share_link.expires_at is null or share_link.expires_at > now())
    ), false
  );
$$;

create or replace function private.get_shared_wine_label_upload_prefix(raw_token text)
returns text language sql security definer stable set search_path = '' as $$
  select share_link.space_id::text || '/shared-wine-labels/' || share_link.token_hash
  from public.share_links share_link
  where share_link.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and share_link.revoked_at is null
    and (share_link.expires_at is null or share_link.expires_at > now())
  limit 1;
$$;

create function public.get_shared_wine_label_upload_prefix(raw_token text)
returns text language sql security invoker set search_path = '' as $$
  select private.get_shared_wine_label_upload_prefix(raw_token);
$$;

drop policy if exists "share links upload wine labels" on storage.objects;
create policy "share links upload wine labels"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'dinner-media'
  and (select private.can_upload_shared_wine_label(name))
);

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
  profile_label_path text;
  required_label_prefix text;
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

    profile_label_path := nullif(trim(coalesce(wine_profile ->> 'label_photo_path', '')), '');
    required_label_prefix := target_space_id::text || '/shared-wine-labels/'
      || encode(extensions.digest(raw_token, 'sha256'), 'hex') || '/';
    if profile_label_path is not null and (
      char_length(profile_label_path) > 700
      or left(profile_label_path, char_length(required_label_prefix)) <> required_label_prefix
      or array_length(string_to_array(profile_label_path, '/'), 1) <> 4
      or profile_label_path !~* '\.(jpe?g|png|webp)$'
    ) then raise exception 'Invalid shared wine label path'; end if;

    insert into public.wines (
      space_id, created_by, producer, cuvee, vintage, region, country,
      grapes, color, reference_notes, tasting_notes, label_photo_path
    ) values (
      target_space_id, attribution_user_id, trim(wine_profile ->> 'producer'),
      nullif(trim(coalesce(wine_profile ->> 'cuvee', '')), ''), profile_vintage,
      nullif(trim(coalesce(wine_profile ->> 'region', '')), ''),
      nullif(trim(coalesce(wine_profile ->> 'country', '')), ''),
      profile_grapes, profile_color::public.wine_color,
      nullif(trim(coalesce(wine_profile ->> 'description', '')), ''),
      nullif(trim(coalesce(wine_profile ->> 'tasting_notes', '')), ''),
      profile_label_path
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

revoke all on function private.can_upload_shared_wine_label(text) from public, anon, authenticated;
revoke all on function private.get_shared_wine_label_upload_prefix(text) from public, anon, authenticated;
revoke all on function public.get_shared_wine_label_upload_prefix(text) from public, anon, authenticated;
grant execute on function private.can_upload_shared_wine_label(text) to anon, authenticated;
grant execute on function private.get_shared_wine_label_upload_prefix(text) to anon, authenticated;
grant execute on function public.get_shared_wine_label_upload_prefix(text) to anon, authenticated;
