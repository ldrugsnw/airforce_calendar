-- Completion belongs to the account, never to the browser's local onboarding key.
alter table public.user_accounts
  add column onboarding_completed_at timestamptz,
  add column onboarding_grant_ids jsonb;

-- Existing data or a completed migration is sufficient evidence of prior setup.
update public.user_accounts a set onboarding_completed_at = now()
where a.local_migration_completed_at is not null
  or exists (select 1 from public.leave_grants where user_id = a.user_id)
  or exists (select 1 from public.leave_usages where user_id = a.user_id)
  or exists (select 1 from public.outings where user_id = a.user_id);

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
      'onboardingCompletedAt', a.onboarding_completed_at,
      'onboardingGrantIds', a.onboarding_grant_ids
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

-- Reconcile both selected types and account completion atomically. IDs survive
-- deselection and are server-owned, so refreshes, tabs and retries cannot duplicate grants.
create or replace function public.api_save_onboarding(
  p_request_id uuid, p_selection jsonb, p_expected_revisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ids jsonb;
  kind text;
  target_id uuid;
  grant_row public.leave_grants%rowtype;
  selected_days integer;
  result jsonb;
  operation text;
begin
  perform public.app_assert_active(uid);
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  if exists (select 1 from public.mutation_requests where user_id = uid and request_id = p_request_id) then
    return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
  end if;
  if jsonb_typeof(p_selection) is distinct from 'object'
    or not (p_selection ? 'annual' and p_selection ? 'performance')
    or (p_selection->>'annual' is null and p_selection->>'performance' is null)
    then raise exception 'INVALID_SELECTION'; end if;

  select onboarding_grant_ids into ids from public.user_accounts where user_id = uid for update;
  if ids is null then
    if exists (select 1 from public.user_accounts where user_id = uid and
        (onboarding_completed_at is not null or local_migration_completed_at is not null))
      or exists (select 1 from public.leave_grants where user_id = uid)
      or exists (select 1 from public.leave_usages where user_id = uid)
      or exists (select 1 from public.outings where user_id = uid)
      then raise exception 'MIGRATION_SERVER_NOT_EMPTY'; end if;
    ids := jsonb_build_object('annual', gen_random_uuid(), 'performance', gen_random_uuid());
    update public.user_accounts set onboarding_grant_ids = ids where user_id = uid;
  end if;

  foreach kind in array array['annual', 'performance'] loop
    target_id := (ids->>kind)::uuid;
    select * into grant_row from public.leave_grants where id = target_id and user_id = uid;
    if (p_expected_revisions->>kind)::integer is distinct from coalesce(grant_row.revision, 0)
      then raise exception 'REVISION_CONFLICT'; end if;
    selected_days := (p_selection->>kind)::integer;
    if selected_days is not null and (selected_days < 1 or selected_days > 365)
      then raise exception 'INVALID_SELECTION'; end if;
    if selected_days is null then
      if grant_row.id is null then continue; end if;
      operation := 'leaveGrant/delete';
    elsif grant_row.id is null then
      operation := 'leaveGrant/create';
    elsif grant_row.days = selected_days then
      continue;
    else
      operation := 'leaveGrant/update';
    end if;
    result := public.api_mutate_app(gen_random_uuid(), operation, jsonb_build_object(
      'id', target_id, 'type', kind, 'days', selected_days,
      'acquiredDate', grant_row.acquired_date, 'reason', coalesce(grant_row.reason, ''),
      'memo', coalesce(grant_row.memo, ''), 'expectedRevision', grant_row.revision
    ));
    if result->>'ok' is distinct from 'true' then raise exception '%', result->>'code'; end if;
  end loop;
  update public.user_accounts set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    updated_at = now() where user_id = uid;
  insert into public.mutation_requests(user_id, request_id, operation) values (uid, p_request_id, 'onboarding/save');
  return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
exception when others then
  -- PL/pgSQL rolls back the entire block, including nested mutation calls.
  return jsonb_build_object('ok', false, 'code', sqlerrm);
end;
$$;
revoke execute on function public.api_save_onboarding(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.api_save_onboarding(uuid, jsonb, jsonb) to authenticated;
