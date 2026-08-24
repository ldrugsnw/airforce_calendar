create extension if not exists pgcrypto;

create table public.beta_allowlist (
  normalized_email text primary key check (normalized_email = lower(trim(normalized_email))),
  invited_at timestamptz not null default now(),
  used_by uuid unique references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  check ((used_by is null) = (used_at is null))
);

create table public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'pending_deletion')),
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz,
  local_migration_completed_at timestamptz,
  local_migration_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and deletion_requested_at is null and deletion_scheduled_for is null)
    or
    (status = 'pending_deletion' and deletion_requested_at is not null and deletion_scheduled_for is not null)
  ),
  check ((local_migration_completed_at is null) = (local_migration_fingerprint is null))
);

create table public.leave_grants (
  id uuid primary key,
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  type text not null check (type in ('annual', 'reward', 'consolation', 'official', 'petition', 'performance', 'other')),
  days integer not null check (days > 0),
  acquired_date date not null,
  reason text not null default '',
  memo text not null default '',
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.leave_usages (
  id uuid primary key,
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  leave_grant_id uuid not null,
  start_date date not null,
  end_date date not null,
  canceled boolean not null default false,
  canceled_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (leave_grant_id, user_id)
    references public.leave_grants(id, user_id) on delete cascade,
  check (end_date >= start_date),
  check ((canceled and canceled_at is not null) or (not canceled and canceled_at is null))
);

create table public.outings (
  id uuid primary key,
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  date date not null,
  reason text not null check (length(trim(reason)) > 0),
  canceled boolean not null default false,
  canceled_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((canceled and canceled_at is not null) or (not canceled and canceled_at is null))
);

create unique index outings_one_active_per_day
  on public.outings(user_id, date) where not canceled;

create table public.mutation_requests (
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.beta_allowlist enable row level security;
alter table public.user_accounts enable row level security;
alter table public.leave_grants enable row level security;
alter table public.leave_usages enable row level security;
alter table public.outings enable row level security;
alter table public.mutation_requests enable row level security;

create policy user_accounts_select_own on public.user_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy leave_grants_select_own on public.leave_grants
  for select to authenticated using ((select auth.uid()) = user_id);
create policy leave_usages_select_own on public.leave_usages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy outings_select_own on public.outings
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.beta_allowlist from anon, authenticated;
revoke all on public.user_accounts from anon, authenticated;
revoke all on public.leave_grants from anon, authenticated;
revoke all on public.leave_usages from anon, authenticated;
revoke all on public.outings from anon, authenticated;
revoke all on public.mutation_requests from anon, authenticated;
grant select on public.user_accounts, public.leave_grants, public.leave_usages, public.outings to authenticated;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_value text := lower(trim(event->'user'->>'email'));
begin
  if not exists (
    select 1 from public.beta_allowlist
    where normalized_email = email_value
      and revoked_at is null
      and used_by is null
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', '현재 비공개 베타에 가입할 수 없습니다.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant select, update on public.beta_allowlist to supabase_auth_admin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_value text := lower(trim(new.email));
begin
  update public.beta_allowlist
  set used_by = new.id, used_at = now()
  where normalized_email = email_value
    and revoked_at is null
    and used_by is null;

  if not found then
    raise exception 'BETA_NOT_ALLOWED';
  end if;

  insert into public.user_accounts(user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.app_assert_active(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_accounts
    where user_id = p_user_id and status = 'active'
  ) then
    raise exception 'ACCOUNT_INACTIVE';
  end if;
end;
$$;

create or replace function public.app_snapshot(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'account', jsonb_build_object(
      'userId', a.user_id,
      'status', a.status,
      'localMigrationCompletedAt', a.local_migration_completed_at,
      'localMigrationFingerprint', a.local_migration_fingerprint
    ),
    'leaveGrants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'type', g.type, 'days', g.days,
        'acquiredDate', g.acquired_date, 'reason', g.reason, 'memo', g.memo,
        'revision', g.revision, 'createdAt', g.created_at, 'updatedAt', g.updated_at
      ) order by g.created_at, g.id)
      from public.leave_grants g where g.user_id = p_user_id
    ), '[]'::jsonb),
    'leaveUsages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'leaveGrantId', u.leave_grant_id,
        'startDate', u.start_date, 'endDate', u.end_date,
        'canceled', u.canceled, 'canceledAt', u.canceled_at,
        'revision', u.revision, 'createdAt', u.created_at, 'updatedAt', u.updated_at
      ) order by u.created_at, u.id)
      from public.leave_usages u where u.user_id = p_user_id
    ), '[]'::jsonb),
    'outings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'date', o.date, 'reason', o.reason,
        'canceled', o.canceled, 'canceledAt', o.canceled_at,
        'revision', o.revision, 'createdAt', o.created_at, 'updatedAt', o.updated_at
      ) order by o.created_at, o.id)
      from public.outings o where o.user_id = p_user_id
    ), '[]'::jsonb),
    'syncedAt', now()
  )
  from public.user_accounts a where a.user_id = p_user_id;
$$;

create or replace function public.api_get_app_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  perform public.app_assert_active(uid);
  return public.app_snapshot(uid);
end;
$$;

create or replace function public.app_validate_state(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.leave_usages a join public.leave_usages b
      on a.user_id = b.user_id and a.id < b.id
      and not a.canceled and not b.canceled
      and a.start_date <= b.end_date and b.start_date <= a.end_date
    where a.user_id = p_user_id
  ) then raise exception 'DATE_OVERLAP'; end if;

  if exists (
    select 1 from public.outings o join public.leave_usages u
      on o.user_id = u.user_id and not o.canceled and not u.canceled
      and u.start_date <= o.date and o.date <= u.end_date
    where o.user_id = p_user_id
  ) then raise exception 'OUTING_OVERLAP'; end if;

  if exists (
    select 1 from public.leave_grants g
    where g.user_id = p_user_id and (
      select coalesce(sum(u.end_date - u.start_date + 1), 0)
      from public.leave_usages u
      where u.leave_grant_id = g.id and u.user_id = g.user_id and not u.canceled
    ) > g.days
  ) then raise exception 'INSUFFICIENT_DAYS'; end if;
end;
$$;

create or replace function public.api_mutate_app(
  p_request_id uuid,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target_id uuid := (p_payload->>'id')::uuid;
  expected_revision integer := nullif(p_payload->>'expectedRevision', '')::integer;
  current_revision integer;
  grant_id uuid;
begin
  perform public.app_assert_active(uid);
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (
    select 1 from public.mutation_requests
    where user_id = uid and request_id = p_request_id
  ) then
    return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
  end if;

  if p_operation = 'leaveGrant/create' then
    insert into public.leave_grants(
      id, user_id, type, days, acquired_date, reason, memo
    ) values (
      target_id, uid, p_payload->>'type', (p_payload->>'days')::integer,
      (p_payload->>'acquiredDate')::date, coalesce(p_payload->>'reason', ''),
      coalesce(p_payload->>'memo', '')
    );
  elsif p_operation = 'leaveGrant/update' then
    select revision into current_revision from public.leave_grants
      where id = target_id and user_id = uid for update;
    if current_revision is null then raise exception 'NOT_FOUND'; end if;
    if current_revision <> expected_revision then raise exception 'REVISION_CONFLICT'; end if;
    update public.leave_grants set
      type = p_payload->>'type', days = (p_payload->>'days')::integer,
      acquired_date = (p_payload->>'acquiredDate')::date,
      reason = coalesce(p_payload->>'reason', ''), memo = coalesce(p_payload->>'memo', ''),
      revision = revision + 1, updated_at = now()
    where id = target_id and user_id = uid;
  elsif p_operation = 'leaveGrant/delete' then
    select revision into current_revision from public.leave_grants
      where id = target_id and user_id = uid for update;
    if current_revision is null then raise exception 'NOT_FOUND'; end if;
    if current_revision <> expected_revision then raise exception 'REVISION_CONFLICT'; end if;
    if exists (select 1 from public.leave_usages where user_id = uid and leave_grant_id = target_id and not canceled)
      then raise exception 'ACTIVE_USAGE_EXISTS'; end if;
    delete from public.leave_grants where id = target_id and user_id = uid;
  elsif p_operation in ('leaveUsage/create', 'leaveUsage/update') then
    grant_id := (p_payload->>'leaveGrantId')::uuid;
    if not exists (select 1 from public.leave_grants where id = grant_id and user_id = uid)
      then raise exception 'LEAVE_GRANT_NOT_FOUND'; end if;
    if p_operation = 'leaveUsage/create' then
      insert into public.leave_usages(
        id, user_id, leave_grant_id, start_date, end_date
      ) values (
        target_id, uid, grant_id, (p_payload->>'startDate')::date, (p_payload->>'endDate')::date
      );
    else
      select revision into current_revision from public.leave_usages
        where id = target_id and user_id = uid and not canceled for update;
      if current_revision is null then raise exception 'NOT_FOUND'; end if;
      if current_revision <> expected_revision then raise exception 'REVISION_CONFLICT'; end if;
      update public.leave_usages set
        leave_grant_id = grant_id, start_date = (p_payload->>'startDate')::date,
        end_date = (p_payload->>'endDate')::date,
        revision = revision + 1, updated_at = now()
      where id = target_id and user_id = uid;
    end if;
  elsif p_operation = 'leaveUsage/cancel' then
    select revision into current_revision from public.leave_usages
      where id = target_id and user_id = uid and not canceled for update;
    if current_revision is null then raise exception 'NOT_FOUND'; end if;
    if current_revision <> expected_revision then raise exception 'REVISION_CONFLICT'; end if;
    update public.leave_usages set canceled = true, canceled_at = now(),
      revision = revision + 1, updated_at = now()
    where id = target_id and user_id = uid;
  elsif p_operation in ('outing/create', 'outing/update') then
    if p_operation = 'outing/create' then
      insert into public.outings(id, user_id, date, reason)
      values (target_id, uid, (p_payload->>'date')::date, trim(p_payload->>'reason'));
    else
      select revision into current_revision from public.outings
        where id = target_id and user_id = uid and not canceled for update;
      if current_revision is null then raise exception 'NOT_FOUND'; end if;
      if current_revision <> expected_revision then raise exception 'REVISION_CONFLICT'; end if;
      update public.outings set date = (p_payload->>'date')::date,
        reason = trim(p_payload->>'reason'), revision = revision + 1, updated_at = now()
      where id = target_id and user_id = uid;
    end if;
  elsif p_operation = 'outing/cancel' then
    select revision into current_revision from public.outings
      where id = target_id and user_id = uid and not canceled for update;
    if current_revision is null then raise exception 'NOT_FOUND'; end if;
    if current_revision <> expected_revision then raise exception 'REVISION_CONFLICT'; end if;
    update public.outings set canceled = true, canceled_at = now(),
      revision = revision + 1, updated_at = now()
    where id = target_id and user_id = uid;
  else
    raise exception 'UNKNOWN_OPERATION';
  end if;

  perform public.app_validate_state(uid);
  insert into public.mutation_requests(user_id, request_id, operation)
  values (uid, p_request_id, p_operation);
  return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
exception
  when others then
    return jsonb_build_object('ok', false, 'code', sqlerrm);
end;
$$;

create or replace function public.api_migrate_local_data(
  p_request_id uuid,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fingerprint text := encode(digest(p_data::text, 'sha256'), 'hex');
  item jsonb;
begin
  perform public.app_assert_active(uid);
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (select 1 from public.mutation_requests where user_id = uid and request_id = p_request_id) then
    return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
  end if;
  if exists (select 1 from public.user_accounts where user_id = uid and local_migration_completed_at is not null)
    then raise exception 'MIGRATION_ALREADY_COMPLETED'; end if;
  if exists (select 1 from public.leave_grants where user_id = uid)
    or exists (select 1 from public.leave_usages where user_id = uid)
    or exists (select 1 from public.outings where user_id = uid)
    then raise exception 'MIGRATION_SERVER_NOT_EMPTY'; end if;
  if (p_data->>'version')::integer <> 3 then raise exception 'MIGRATION_INVALID_VERSION'; end if;

  for item in select value from jsonb_array_elements(p_data->'leaveGrants') loop
    insert into public.leave_grants(
      id, user_id, type, days, acquired_date, reason, memo, created_at, updated_at
    ) values (
      (item->>'id')::uuid, uid, item->>'type', (item->>'days')::integer,
      (item->>'acquiredDate')::date, coalesce(item->>'reason', ''), coalesce(item->>'memo', ''),
      (item->>'createdAt')::timestamptz, (item->>'updatedAt')::timestamptz
    );
  end loop;
  for item in select value from jsonb_array_elements(p_data->'leaveUsages') loop
    insert into public.leave_usages(
      id, user_id, leave_grant_id, start_date, end_date, canceled, canceled_at, created_at, updated_at
    ) values (
      (item->>'id')::uuid, uid, (item->>'leaveGrantId')::uuid,
      (item->>'startDate')::date, (item->>'endDate')::date,
      (item->>'canceled')::boolean, (item->>'canceledAt')::timestamptz,
      (item->>'createdAt')::timestamptz, (item->>'updatedAt')::timestamptz
    );
  end loop;
  for item in select value from jsonb_array_elements(p_data->'outings') loop
    insert into public.outings(
      id, user_id, date, reason, canceled, canceled_at, created_at, updated_at
    ) values (
      (item->>'id')::uuid, uid, (item->>'date')::date, trim(item->>'reason'),
      (item->>'canceled')::boolean, (item->>'canceledAt')::timestamptz,
      (item->>'createdAt')::timestamptz, (item->>'updatedAt')::timestamptz
    );
  end loop;

  perform public.app_validate_state(uid);
  update public.user_accounts set local_migration_completed_at = now(),
    local_migration_fingerprint = fingerprint, updated_at = now()
  where user_id = uid;
  insert into public.mutation_requests(user_id, request_id, operation)
  values (uid, p_request_id, 'localData/migrate');
  return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
exception
  when others then
    return jsonb_build_object('ok', false, 'code', sqlerrm);
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.api_get_app_snapshot() to authenticated;
grant execute on function public.api_mutate_app(uuid, text, jsonb) to authenticated;
grant execute on function public.api_migrate_local_data(uuid, jsonb) to authenticated;
