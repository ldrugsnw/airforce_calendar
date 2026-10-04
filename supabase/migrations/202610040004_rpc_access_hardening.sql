-- Keep caller isolation even if internal EXECUTE is accidentally granted later.
create or replace function public.app_assert_owner(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user_id is distinct from auth.uid() then raise exception 'ACCOUNT_FORBIDDEN'; end if;
end;
$$;
-- Existing SECURITY DEFINER entry points are owned by postgres.
alter function public.app_assert_owner(uuid) owner to postgres;

create or replace function public.app_assert_active(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.app_assert_owner(p_user_id);
  if p_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_accounts
    where user_id = p_user_id and status = 'active'
  ) then
    raise exception 'ACCOUNT_INACTIVE';
  end if;
end;
$$;

create or replace function public.app_validate_state(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.app_assert_owner(p_user_id);
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

-- JSON field access also supports the pre-onboarding account schema.
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
      'localMigrationFingerprint', a.local_migration_fingerprint,
      'onboardingCompletedAt', to_jsonb(a)->'onboarding_completed_at',
      'onboardingGrantIds', to_jsonb(a)->'onboarding_grant_ids'
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
  from public.user_accounts a where a.user_id = p_user_id and p_user_id = (select auth.uid());
$$;

-- Remote platform defaults granted authenticated access to internal helpers.
-- Explicitly grant only the supported application entry points.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
revoke execute on function public.app_assert_owner(uuid), public.app_assert_active(uuid),
  public.app_validate_state(uuid), public.app_snapshot(uuid), public.handle_new_auth_user()
  from public, anon, authenticated;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
do $$
declare signature text; target regprocedure;
begin
  foreach signature in array array[
    'public.api_get_app_snapshot()', 'public.api_mutate_app(uuid,text,jsonb)',
    'public.api_migrate_local_data(uuid,jsonb)', 'public.api_save_onboarding(uuid,jsonb,jsonb)',
    'public.api_save_onboarding_plan(uuid,jsonb,jsonb,boolean)'
  ] loop
    target := to_regprocedure(signature);
    if target is not null then
      execute format('revoke execute on function %s from public, anon', target);
      execute format('grant execute on function %s to authenticated', target);
    end if;
  end loop;
end;
$$;
