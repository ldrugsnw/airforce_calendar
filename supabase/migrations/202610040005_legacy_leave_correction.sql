-- Correct historical values only after the owner reviews the exact changes.
-- Keep original grant IDs, metadata and usage references; refuse legacy deletion.
create or replace function public.api_save_onboarding_plan(
  p_request_id uuid, p_items jsonb, p_expected_state jsonb, p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ids jsonb;
  item jsonb;
  item_key text;
  kind text;
  target_id uuid;
  selected_days integer;
  grant_row public.leave_grants%rowtype;
  result jsonb;
  operation text;
  selected_date date;
  legacy boolean;
  processed_ids uuid[] := '{}';
  processed_keys text[] := '{}';
begin
  perform public.app_assert_active(uid);
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  if exists (select 1 from public.mutation_requests where user_id = uid and request_id = p_request_id) then
    return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
  end if;
  -- Bind confirmation to the entire reviewed state, including canceled usages
  -- that a grant deletion would cascade. Never delete an unreviewed new record.
  if p_expected_state is distinct from (public.app_snapshot(uid) - 'account' - 'syncedAt')
    then raise exception 'REVISION_CONFLICT'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_SELECTION'; end if;

  select onboarding_grant_ids into ids from public.user_accounts where user_id = uid for update;
  if ids is null then
    ids := jsonb_build_object(
      'annual', coalesce((select id from public.leave_grants where user_id = uid and type = 'annual' order by created_at, id limit 1), gen_random_uuid()),
      'performance', coalesce((select id from public.leave_grants where user_id = uid and type = 'performance' order by created_at, id limit 1), gen_random_uuid())
    );
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    item_key := item->>'key';
    kind := item->>'type';
    if item_key is null or length(item_key) > 256 or item_key = any(processed_keys)
      or kind is null or kind not in ('annual','performance','reward','consolation','official','petition','other') or not (item ? 'days')
      then raise exception 'INVALID_SELECTION'; end if;
    processed_keys := array_append(processed_keys, item_key);
    target_id := (item->>'id')::uuid;
    if target_id is null then
      if kind not in ('annual','performance') then raise exception 'INVALID_SELECTION'; end if;
      if item_key <> kind then raise exception 'INVALID_SELECTION'; end if;
      target_id := (ids->>item_key)::uuid;
    end if;
    if target_id is null or target_id = any(processed_ids) then raise exception 'INVALID_SELECTION'; end if;
    processed_ids := array_append(processed_ids, target_id);
    select * into grant_row from public.leave_grants where id = target_id and user_id = uid;
    if grant_row.id is not null then
      if grant_row.type <> kind then raise exception 'REVISION_CONFLICT'; end if;
      ids := ids || jsonb_build_object(item_key, target_id);
    elsif ids->>item_key is distinct from target_id::text then
      -- Restoring a deselected onboarding item is allowed only for its recorded ID.
      raise exception 'NOT_FOUND';
    end if;
    legacy := grant_row.id is not null and (grant_row.days > 365 or
      (grant_row.acquired_date is not null and grant_row.acquired_date not between date '2000-01-01' and date '2999-12-31'));
    selected_date := case when item ? 'acquiredDate' then (item->>'acquiredDate')::date else grant_row.acquired_date end;
    if selected_date is not null and selected_date not between date '2000-01-01' and date '2999-12-31'
      then raise exception 'LEGACY_CORRECTION_REQUIRED'; end if;
    if legacy and grant_row.acquired_date not between date '2000-01-01' and date '2999-12-31' and selected_date is null
      then raise exception 'LEGACY_CORRECTION_REQUIRED'; end if;
    selected_days := (item->>'days')::integer;
    if selected_days is not null and (selected_days < 1 or selected_days > 365)
      then raise exception 'INVALID_SELECTION'; end if;
    if legacy and selected_days is null then raise exception 'LEGACY_CORRECTION_REQUIRED'; end if;
    if selected_days is null then
      if grant_row.id is null then continue; end if;
      operation := 'leaveGrant/delete';
    elsif grant_row.id is null then
      if item_key = kind and exists (select 1 from public.leave_grants where user_id = uid and type = kind)
        then raise exception 'REVISION_CONFLICT'; end if;
      operation := 'leaveGrant/create';
    elsif grant_row.days = selected_days and grant_row.acquired_date is not distinct from selected_date then
      continue;
    else
      operation := 'leaveGrant/update';
    end if;
    if grant_row.id is not null and p_confirmed is distinct from true
      then raise exception 'CONFIRMATION_REQUIRED'; end if;
    result := public.api_mutate_app(gen_random_uuid(), operation, jsonb_build_object(
      'id', target_id, 'type', kind, 'days', selected_days,
      'acquiredDate', selected_date, 'reason', coalesce(grant_row.reason, ''),
      'memo', coalesce(grant_row.memo, ''), 'expectedRevision', grant_row.revision
    ));
    if result->>'ok' is distinct from 'true' then raise exception '%', result->>'code'; end if;
  end loop;
  if not exists (select 1 from public.leave_grants where user_id = uid) then raise exception 'INVALID_SELECTION'; end if;
  if exists (select 1 from public.leave_grants where user_id = uid and
    (days not between 1 and 365 or (acquired_date is not null and acquired_date not between date '2000-01-01' and date '2999-12-31')))
    then raise exception 'LEGACY_CORRECTION_REQUIRED'; end if;
  update public.user_accounts set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    onboarding_grant_ids = ids, updated_at = now() where user_id = uid;
  insert into public.mutation_requests(user_id, request_id, operation) values (uid, p_request_id, 'onboarding/plan');
  return jsonb_build_object('ok', true, 'snapshot', public.app_snapshot(uid));
exception when others then
  return jsonb_build_object('ok', false, 'code', sqlerrm);
end;
$$;
revoke execute on function public.api_save_onboarding_plan(uuid, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.api_save_onboarding_plan(uuid, jsonb, jsonb, boolean) to authenticated;
