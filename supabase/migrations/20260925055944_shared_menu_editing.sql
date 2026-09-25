-- A share token is a narrow capability: it can read the curated dinner menu and
-- edit existing course titles/descriptions/order. It never exposes member,
-- photo, note, rating, or storage rows.
create or replace function private.get_shared_dinner(raw_token text)
returns jsonb language sql security definer stable set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id,
    'title', d.title,
    'venue_name', d.venue_name,
    'scheduled_at', d.scheduled_at,
    'summary', d.summary,
    'can_edit_menu', true,
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'position', c.position,
          'title', c.title,
          'description', c.description,
          'wines', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', w.id,
                'producer', w.producer,
                'cuvee', w.cuvee,
                'vintage', w.vintage,
                'region', w.region,
                'country', w.country,
                'grapes', w.grapes,
                'color', w.color,
                'description', w.reference_notes,
                'pairing_note', pairing.notes
              ) order by pairing.created_at
            )
            from public.course_wine_pairings pairing
            join public.wine_experiences experience on experience.id = pairing.wine_experience_id
            join public.wines w on w.id = experience.wine_id
            where pairing.course_id = c.id and pairing.dinner_id = d.id
          ), '[]'::jsonb)
        ) order by c.position
      )
      from public.courses c
      where c.dinner_id = d.id
    ), '[]'::jsonb),
    'wines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', w.id,
          'producer', w.producer,
          'cuvee', w.cuvee,
          'vintage', w.vintage,
          'region', w.region,
          'country', w.country,
          'grapes', w.grapes,
          'color', w.color,
          'description', w.reference_notes
        ) order by experience.opened_at
      )
      from public.wine_experiences experience
      join public.wines w on w.id = experience.wine_id
      where experience.dinner_id = d.id
    ), '[]'::jsonb)
  )
  from public.share_links share_link
  join public.dinners d on d.id = share_link.dinner_id
  where share_link.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and share_link.revoked_at is null
    and (share_link.expires_at is null or share_link.expires_at > now())
  limit 1;
$$;

create or replace function private.update_shared_dinner_menu(raw_token text, menu_courses jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_dinner_id uuid;
  expected_count integer;
  requested_count integer;
  matched_count integer;
begin
  if jsonb_typeof(menu_courses) is distinct from 'array' then
    raise exception 'Menu must be an array';
  end if;

  select share_link.dinner_id into target_dinner_id
  from public.share_links share_link
  where share_link.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and share_link.revoked_at is null
    and (share_link.expires_at is null or share_link.expires_at > now())
  for update;
  if target_dinner_id is null then raise exception 'Share link is invalid or expired'; end if;

  requested_count := jsonb_array_length(menu_courses);
  select count(*) into expected_count from public.courses where dinner_id = target_dinner_id;
  if requested_count <> expected_count or requested_count > 50 then
    raise exception 'The complete existing menu is required';
  end if;
  if exists (
    select 1 from jsonb_array_elements(menu_courses) item
    where coalesce(item ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or char_length(trim(coalesce(item ->> 'title', ''))) not between 1 and 160
      or char_length(coalesce(item ->> 'description', '')) > 2000
  ) then raise exception 'Invalid course data'; end if;
  if (select count(distinct item ->> 'id') from jsonb_array_elements(menu_courses) item) <> requested_count then
    raise exception 'Duplicate course';
  end if;
  select count(*) into matched_count
  from public.courses course
  where course.dinner_id = target_dinner_id
    and course.id in (select (item ->> 'id')::uuid from jsonb_array_elements(menu_courses) item);
  if matched_count <> expected_count then raise exception 'Course does not belong to this dinner'; end if;

  -- Move every position out of the way first because (dinner_id, position) is unique.
  update public.courses set position = position + 1000000 where dinner_id = target_dinner_id;
  with requested as (
    select (item ->> 'id')::uuid as id,
      trim(item ->> 'title') as title,
      nullif(trim(coalesce(item ->> 'description', '')), '') as description,
      ordinality::integer as position
    from jsonb_array_elements(menu_courses) with ordinality as payload(item, ordinality)
  )
  update public.courses course
  set title = requested.title, description = requested.description, position = requested.position
  from requested
  where course.id = requested.id and course.dinner_id = target_dinner_id;

  return private.get_shared_dinner(raw_token);
end;
$$;

create or replace function private.reorder_dinner_courses(target_dinner_id uuid, ordered_course_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare target_space_id uuid; expected_count integer;
begin
  select space_id into target_space_id from public.dinners where id = target_dinner_id;
  if target_space_id is null or not private.is_space_member(target_space_id) then raise exception 'Dinner not found'; end if;
  select count(*) into expected_count from public.courses where dinner_id = target_dinner_id;
  if coalesce(cardinality(ordered_course_ids), 0) <> expected_count
    or (select count(distinct id) from unnest(ordered_course_ids) id) <> expected_count
    or (select count(*) from public.courses where dinner_id = target_dinner_id and id = any(ordered_course_ids)) <> expected_count
  then raise exception 'The complete existing course order is required'; end if;

  update public.courses set position = position + 1000000 where dinner_id = target_dinner_id;
  update public.courses course set position = requested.position
  from unnest(ordered_course_ids) with ordinality as requested(id, position)
  where course.id = requested.id and course.dinner_id = target_dinner_id;
end;
$$;

create function public.update_shared_dinner_menu(raw_token text, menu_courses jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.update_shared_dinner_menu(raw_token, menu_courses);
$$;
create function public.reorder_dinner_courses(target_dinner_id uuid, ordered_course_ids uuid[])
returns void language sql security invoker set search_path = '' as $$
  select private.reorder_dinner_courses(target_dinner_id, ordered_course_ids);
$$;

revoke all on function private.update_shared_dinner_menu(text, jsonb), private.reorder_dinner_courses(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.update_shared_dinner_menu(text, jsonb), public.reorder_dinner_courses(uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.update_shared_dinner_menu(text, jsonb) to anon, authenticated;
grant execute on function public.update_shared_dinner_menu(text, jsonb) to anon, authenticated;
grant execute on function private.reorder_dinner_courses(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_dinner_courses(uuid, uuid[]) to authenticated;

-- Replacing the private reader preserves its narrow execute grants explicitly.
revoke all on function private.get_shared_dinner(text) from public, anon, authenticated;
grant execute on function private.get_shared_dinner(text) to anon, authenticated;
