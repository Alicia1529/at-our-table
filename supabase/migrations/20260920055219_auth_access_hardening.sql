-- Refresh invitation functions with qualified crypto calls and strict identity checks.
create or replace function public.create_space_invitation(target_space_id uuid, invite_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text := encode(extensions.gen_random_bytes(32), 'hex'); normalized_email text := lower(trim(invite_email));
begin
  if not private.is_space_admin(target_space_id) then raise exception 'Only owners can invite members'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  delete from public.space_invitations where space_id = target_space_id and lower(email) = normalized_email and accepted_at is null;
  insert into public.space_invitations(space_id, email, token_hash, invited_by)
  values (target_space_id, normalized_email, encode(extensions.digest(raw_token, 'sha256'), 'hex'), auth.uid());
  return raw_token;
end;
$$;

create or replace function public.accept_space_invitation(raw_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.space_invitations%rowtype; signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Sign in to accept an invitation'; end if;
  select * into invitation from public.space_invitations
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') and accepted_at is null and expires_at > now()
  for update;
  if invitation.id is null then raise exception 'Invitation is invalid or expired'; end if;
  if signed_in_email = '' or signed_in_email <> lower(invitation.email) then raise exception 'Sign in with the invited email address'; end if;
  insert into public.space_members(space_id, user_id, role) values (invitation.space_id, auth.uid(), 'member') on conflict do nothing;
  update public.space_invitations set accepted_at = now() where id = invitation.id;
  return invitation.space_id;
end;
$$;


-- Keep privileged implementations outside the exposed API schema. Public RPCs
-- are invoker wrappers; the private functions enforce membership or share tokens.
alter function public.handle_new_user() set schema private;
alter function public.create_dinner_share_link(uuid, timestamptz) set schema private;
alter function public.get_shared_dinner(text) set schema private;
alter function public.create_space_invitation(uuid, text) set schema private;
alter function public.accept_space_invitation(text) set schema private;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.user_space_ids(), private.is_space_member(uuid), private.is_space_admin(uuid), private.is_space_owner(uuid), private.storage_space_id(text) to authenticated;
grant execute on function private.create_dinner_share_link(uuid, timestamptz), private.create_space_invitation(uuid, text), private.accept_space_invitation(text) to authenticated;
-- This intentionally anonymous function authorizes via an unexpired hashed
-- capability token and returns a curated read-only payload, not table access.
grant execute on function private.get_shared_dinner(text) to anon, authenticated;

create function public.create_dinner_share_link(target_dinner_id uuid, link_expires_at timestamptz default null)
returns text language sql security invoker set search_path = '' as $$
  select private.create_dinner_share_link(target_dinner_id, link_expires_at);
$$;
create function public.get_shared_dinner(raw_token text)
returns jsonb language sql security invoker stable set search_path = '' as $$
  select private.get_shared_dinner(raw_token);
$$;
create function public.create_space_invitation(target_space_id uuid, invite_email text)
returns text language sql security invoker set search_path = '' as $$
  select private.create_space_invitation(target_space_id, invite_email);
$$;
create function public.accept_space_invitation(raw_token text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.accept_space_invitation(raw_token);
$$;
revoke all on function public.create_dinner_share_link(uuid, timestamptz), public.get_shared_dinner(text), public.create_space_invitation(uuid, text), public.accept_space_invitation(text), public.set_updated_at() from public, anon, authenticated;
grant execute on function public.create_dinner_share_link(uuid, timestamptz), public.create_space_invitation(uuid, text), public.accept_space_invitation(text) to authenticated;
grant execute on function public.get_shared_dinner(text) to anon, authenticated;

-- Other members may read opinions but must not impersonate or overwrite a rater.
drop policy "members insert ratings" on public.ratings;
drop policy "members update ratings" on public.ratings;
drop policy "members delete ratings" on public.ratings;
create policy "raters insert own ratings" on public.ratings for insert to authenticated
  with check ((select private.is_space_member(space_id)) and rater_user_id = (select auth.uid()));
create policy "raters update own ratings" on public.ratings for update to authenticated
  using ((select private.is_space_member(space_id)) and rater_user_id = (select auth.uid()))
  with check ((select private.is_space_member(space_id)) and rater_user_id = (select auth.uid()));
create policy "raters delete own ratings" on public.ratings for delete to authenticated
  using ((select private.is_space_member(space_id)) and rater_user_id = (select auth.uid()));

-- Supabase may provision this event-trigger helper in public by default.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
;
