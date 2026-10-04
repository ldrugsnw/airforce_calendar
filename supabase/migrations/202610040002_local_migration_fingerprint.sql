-- pgcrypto may live in extensions rather than public. Use pg_catalog built-ins
-- so the existing security-definer RPC works with its empty search_path.
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
  fingerprint text := encode(sha256(convert_to(p_data::text, 'UTF8')), 'hex');
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
