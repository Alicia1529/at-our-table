create table public.dinner_notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  dinner_id uuid not null references public.dinners(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint dinner_notes_dinner_same_space foreign key (dinner_id, space_id) references public.dinners(id, space_id) on delete cascade
);

create table public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index dinner_notes_dinner_created_idx on public.dinner_notes(dinner_id, created_at);
create index space_invitations_space_email_idx on public.space_invitations(space_id, lower(email));

alter table public.dinner_notes enable row level security;
alter table public.space_invitations enable row level security;
revoke all on public.dinner_notes, public.space_invitations from anon, authenticated;
grant select, insert, update, delete on public.dinner_notes to authenticated;
grant select, insert, update, delete on public.space_invitations to authenticated;

create policy "members select dinner notes" on public.dinner_notes for select to authenticated using ((select private.is_space_member(space_id)));
create policy "members insert dinner notes" on public.dinner_notes for insert to authenticated with check ((select private.is_space_member(space_id)) and author_id = (select auth.uid()));
create policy "authors update dinner notes" on public.dinner_notes for update to authenticated using (author_id = (select auth.uid()) and (select private.is_space_member(space_id))) with check (author_id = (select auth.uid()) and (select private.is_space_member(space_id)));
create policy "authors delete dinner notes" on public.dinner_notes for delete to authenticated using (author_id = (select auth.uid()) and (select private.is_space_member(space_id)));

create policy "owners select invitations" on public.space_invitations for select to authenticated using ((select private.is_space_admin(space_id)));
create policy "owners delete invitations" on public.space_invitations for delete to authenticated using ((select private.is_space_admin(space_id)));

create or replace function public.create_space_invitation(target_space_id uuid, invite_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text := encode(gen_random_bytes(32), 'hex'); normalized_email text := lower(trim(invite_email));
begin
  if not private.is_space_admin(target_space_id) then raise exception 'Only owners can invite members'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  delete from public.space_invitations where space_id = target_space_id and lower(email) = normalized_email and accepted_at is null;
  insert into public.space_invitations(space_id, email, token_hash, invited_by)
  values (target_space_id, normalized_email, encode(digest(raw_token, 'sha256'), 'hex'), auth.uid());
  return raw_token;
end;
$$;

create or replace function public.accept_space_invitation(raw_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.space_invitations%rowtype; signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into invitation from public.space_invitations
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex') and accepted_at is null and expires_at > now()
  for update;
  if invitation.id is null then raise exception 'Invitation is invalid or expired'; end if;
  if signed_in_email = '' or signed_in_email <> lower(invitation.email) then raise exception 'Sign in with the invited email address'; end if;
  insert into public.space_members(space_id, user_id, role) values (invitation.space_id, auth.uid(), 'member') on conflict do nothing;
  update public.space_invitations set accepted_at = now() where id = invitation.id;
  return invitation.space_id;
end;
$$;

revoke all on function public.create_space_invitation(uuid, text) from public;
revoke all on function public.accept_space_invitation(text) from public;
grant execute on function public.create_space_invitation(uuid, text) to authenticated;
grant execute on function public.accept_space_invitation(text) to authenticated;
