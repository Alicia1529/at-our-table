create extension if not exists pgcrypto;
create schema if not exists private;

create type public.space_role as enum ('owner', 'member');
create type public.dinner_location as enum ('home', 'restaurant');
create type public.dinner_status as enum ('planning', 'happening', 'remembered');
create type public.wine_color as enum ('red', 'white', 'orange', 'rose', 'sparkling', 'fortified');
create type public.rating_target as enum ('course', 'wine_experience', 'pairing');

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  tagline text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.space_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table public.dinners (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 160),
  location_type public.dinner_location not null default 'home',
  venue_name text,
  scheduled_at timestamptz,
  status public.dinner_status not null default 'planning',
  summary text,
  cover_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dinner_guests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dinner_id, position)
);

create table public.wines (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  producer text not null,
  cuvee text,
  vintage smallint check (vintage between 1800 and 2200),
  region text,
  country text,
  grapes text[] not null default '{}',
  color public.wine_color,
  reference_notes text,
  label_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wine_experiences (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  wine_id uuid not null references public.wines(id) on delete cascade,
  dinner_id uuid references public.dinners(id) on delete set null,
  opened_at timestamptz not null default now(),
  serving_notes text,
  bottle_photo_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_wine_pairings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  wine_experience_id uuid not null references public.wine_experiences(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (course_id, wine_experience_id)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  target_type public.rating_target not null,
  course_id uuid references public.courses(id) on delete cascade,
  wine_experience_id uuid references public.wine_experiences(id) on delete cascade,
  pairing_id uuid references public.course_wine_pairings(id) on delete cascade,
  rater_user_id uuid references auth.users(id) on delete cascade,
  dinner_guest_id uuid references public.dinner_guests(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(course_id, wine_experience_id, pairing_id) = 1),
  check (num_nonnulls(rater_user_id, dinner_guest_id) = 1),
  check ((target_type = 'course' and course_id is not null) or (target_type = 'wine_experience' and wine_experience_id is not null) or (target_type = 'pairing' and pairing_id is not null))
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null unique,
  caption text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references auth.users(id),
  storage_path text not null unique,
  transcript text,
  duration_seconds integer check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Composite keys keep every relationship inside its declared space, even when a
-- client knows an object UUID from another tenant.
alter table public.dinners add constraint dinners_id_space_key unique (id, space_id);
alter table public.dinner_guests add constraint dinner_guests_id_space_key unique (id, space_id);
alter table public.courses add constraint courses_id_space_key unique (id, space_id);
alter table public.wines add constraint wines_id_space_key unique (id, space_id);
alter table public.wine_experiences add constraint wine_experiences_id_space_key unique (id, space_id);
alter table public.course_wine_pairings add constraint pairings_id_space_key unique (id, space_id);
alter table public.dinner_guests add constraint guests_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;
alter table public.courses add constraint courses_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;
alter table public.wine_experiences add constraint experiences_wine_same_space foreign key (wine_id, space_id) references public.wines(id, space_id) on delete cascade;
alter table public.wine_experiences add constraint experiences_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete set null (dinner_id);
alter table public.course_wine_pairings add constraint pairings_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;
alter table public.course_wine_pairings add constraint pairings_course_same_space foreign key (course_id, space_id) references public.courses(id, space_id) on delete cascade;
alter table public.course_wine_pairings add constraint pairings_experience_same_space foreign key (wine_experience_id, space_id) references public.wine_experiences(id, space_id) on delete cascade;
alter table public.ratings add constraint ratings_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;
alter table public.ratings add constraint ratings_course_same_space foreign key (course_id, space_id) references public.courses(id, space_id) on delete cascade;
alter table public.ratings add constraint ratings_experience_same_space foreign key (wine_experience_id, space_id) references public.wine_experiences(id, space_id) on delete cascade;
alter table public.ratings add constraint ratings_pairing_same_space foreign key (pairing_id, space_id) references public.course_wine_pairings(id, space_id) on delete cascade;
alter table public.ratings add constraint ratings_guest_same_space foreign key (dinner_guest_id, space_id) references public.dinner_guests(id, space_id) on delete cascade;
alter table public.photos add constraint photos_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;
alter table public.photos add constraint photos_course_same_space foreign key (course_id, space_id) references public.courses(id, space_id) on delete set null (course_id);
alter table public.voice_notes add constraint voice_notes_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;
alter table public.voice_notes add constraint voice_notes_course_same_space foreign key (course_id, space_id) references public.courses(id, space_id) on delete set null (course_id);
alter table public.share_links add constraint share_links_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade;

create index on public.space_members(user_id, space_id);
create index on public.dinners(space_id, scheduled_at desc);
create index on public.courses(dinner_id, position);
create index on public.wines(space_id, producer);
create index on public.wine_experiences(wine_id, opened_at desc);
create index on public.wine_experiences(dinner_id);
create index on public.course_wine_pairings(dinner_id);
create index on public.ratings(dinner_id);
create index on public.photos(dinner_id, captured_at);

create or replace function private.user_space_ids()
returns setof uuid language sql security definer stable set search_path = '' as $$
  select sm.space_id from public.space_members sm where sm.user_id = (select auth.uid());
$$;
create or replace function private.is_space_member(target_space_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.space_members sm where sm.space_id = target_space_id and sm.user_id = (select auth.uid()));
$$;
create or replace function private.is_space_admin(target_space_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.space_members sm where sm.space_id = target_space_id and sm.user_id = (select auth.uid()) and sm.role = 'owner');
$$;
create or replace function private.is_space_owner(target_space_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.spaces s where s.id = target_space_id and s.created_by = (select auth.uid()));
$$;
create or replace function private.storage_space_id(object_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin return split_part(object_name, '/', 1)::uuid; exception when invalid_text_representation then return null; end;
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.user_space_ids() to authenticated;
grant execute on function private.is_space_member(uuid) to authenticated;
grant execute on function private.is_space_admin(uuid) to authenticated;
grant execute on function private.is_space_owner(uuid) to authenticated;
grant execute on function private.storage_space_id(text) to authenticated;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.dinners enable row level security;
alter table public.dinner_guests enable row level security;
alter table public.courses enable row level security;
alter table public.wines enable row level security;
alter table public.wine_experiences enable row level security;
alter table public.course_wine_pairings enable row level security;
alter table public.ratings enable row level security;
alter table public.photos enable row level security;
alter table public.voice_notes enable row level security;
alter table public.share_links enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy "members select spaces" on public.spaces for select to authenticated using ((select private.is_space_member(id)) or created_by = (select auth.uid()));
create policy "users create spaces" on public.spaces for insert to authenticated with check (created_by = (select auth.uid()));
create policy "owners update spaces" on public.spaces for update to authenticated using ((select private.is_space_admin(id)) or created_by = (select auth.uid())) with check ((select private.is_space_admin(id)) or created_by = (select auth.uid()));
create policy "owners delete spaces" on public.spaces for delete to authenticated using ((select private.is_space_admin(id)) or created_by = (select auth.uid()));

create policy "members select memberships" on public.space_members for select to authenticated using (space_id in (select private.user_space_ids()));
create policy "owners insert memberships" on public.space_members for insert to authenticated with check ((select private.is_space_admin(space_id)) or (select private.is_space_owner(space_id)));
create policy "owners update memberships" on public.space_members for update to authenticated using ((select private.is_space_admin(space_id))) with check ((select private.is_space_admin(space_id)));
create policy "owners delete memberships" on public.space_members for delete to authenticated using ((select private.is_space_admin(space_id)));

do $$
declare table_name text;
begin
  foreach table_name in array array['dinners','dinner_guests','courses','wines','wine_experiences','course_wine_pairings','ratings','photos','voice_notes','share_links'] loop
    execute format('create policy "members select %1$s" on public.%1$I for select to authenticated using ((select private.is_space_member(space_id)))', table_name);
    execute format('create policy "members insert %1$s" on public.%1$I for insert to authenticated with check ((select private.is_space_member(space_id)))', table_name);
    execute format('create policy "members update %1$s" on public.%1$I for update to authenticated using ((select private.is_space_member(space_id))) with check ((select private.is_space_member(space_id)))', table_name);
    execute format('create policy "members delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_space_member(space_id)))', table_name);
  end loop;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger spaces_updated_at before update on public.spaces for each row execute function public.set_updated_at();
create trigger dinners_updated_at before update on public.dinners for each row execute function public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger wines_updated_at before update on public.wines for each row execute function public.set_updated_at();
create trigger wine_experiences_updated_at before update on public.wine_experiences for each row execute function public.set_updated_at();
create trigger ratings_updated_at before update on public.ratings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_space_id uuid;
begin
  insert into public.spaces(name, tagline, created_by) values ('Our table', 'The dinners we want to remember', new.id) returning id into new_space_id;
  insert into public.space_members(space_id, user_id, role) values (new_space_id, new.id, 'owner');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_dinner_share_link(target_dinner_id uuid, link_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text := encode(extensions.gen_random_bytes(32), 'hex'); target_space_id uuid;
begin
  select d.space_id into target_space_id from public.dinners d where d.id = target_dinner_id;
  if target_space_id is null or not private.is_space_member(target_space_id) then raise exception 'Dinner not found'; end if;
  insert into public.share_links(space_id, dinner_id, token_hash, created_by, expires_at)
  values (target_space_id, target_dinner_id, encode(extensions.digest(raw_token, 'sha256'), 'hex'), auth.uid(), link_expires_at);
  return raw_token;
end;
$$;

create or replace function public.get_shared_dinner(raw_token text)
returns jsonb language sql security definer stable set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id, 'title', d.title, 'venue_name', d.venue_name, 'scheduled_at', d.scheduled_at, 'summary', d.summary,
    'courses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'position', c.position, 'title', c.title, 'description', c.description) order by c.position) from public.courses c where c.dinner_id = d.id), '[]'::jsonb),
    'wines', coalesce((select jsonb_agg(jsonb_build_object('producer', w.producer, 'cuvee', w.cuvee, 'vintage', w.vintage, 'serving_notes', we.serving_notes) order by we.opened_at) from public.wine_experiences we join public.wines w on w.id = we.wine_id where we.dinner_id = d.id), '[]'::jsonb)
  )
  from public.share_links sl join public.dinners d on d.id = sl.dinner_id
  where sl.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') and sl.revoked_at is null and (sl.expires_at is null or sl.expires_at > now())
  limit 1;
$$;

revoke all on function public.create_dinner_share_link(uuid, timestamptz) from public;
grant execute on function public.create_dinner_share_link(uuid, timestamptz) to authenticated;
revoke all on function public.get_shared_dinner(text) from public;
grant execute on function public.get_shared_dinner(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dinner-media', 'dinner-media', false, 26214400, array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg'])
on conflict (id) do nothing;

create policy "members read private dinner media" on storage.objects for select to authenticated using (bucket_id = 'dinner-media' and (select private.is_space_member(private.storage_space_id(name))));
create policy "members upload private dinner media" on storage.objects for insert to authenticated with check (bucket_id = 'dinner-media' and (select private.is_space_member(private.storage_space_id(name))));
create policy "members update private dinner media" on storage.objects for update to authenticated using (bucket_id = 'dinner-media' and (select private.is_space_member(private.storage_space_id(name)))) with check (bucket_id = 'dinner-media' and (select private.is_space_member(private.storage_space_id(name))));
create policy "members delete private dinner media" on storage.objects for delete to authenticated using (bucket_id = 'dinner-media' and (select private.is_space_member(private.storage_space_id(name))));
