begin;
create extension if not exists pgtap;
select plan(21);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'onboarding-sql@example.com', '', now(), '{}', '{}', now(), now()),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'onboarding-other@example.com', '', now(), '{}', '{}', now(), now());
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(public.api_get_app_snapshot()->'account'->>'onboardingCompletedAt', null, 'new account is incomplete');
select is((public.api_save_onboarding('40000000-0000-4000-8000-000000000001',
  '{"annual":24,"performance":366}', '{"annual":0,"performance":0}')->>'ok')::boolean,
  false, 'invalid second grant fails the transaction');
select is(jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'), 0, 'first grant also rolls back');
select is(public.api_get_app_snapshot()->'account'->>'onboardingCompletedAt', null, 'completion rolls back');
select is(public.api_get_app_snapshot()->'account'->>'onboardingGrantIds', null, 'ID allocation rolls back');

select is((public.api_save_onboarding('40000000-0000-4000-8000-000000000001',
  '{"annual":24,"performance":7}', '{"annual":0,"performance":0}')->>'ok')::boolean,
  true, 'failed request can retry successfully');
select is(jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'), 2, 'two selected grants saved');
select isnt(public.api_get_app_snapshot()->'account'->>'onboardingCompletedAt', null, 'completion is stored on account');
select is((public.api_save_onboarding('40000000-0000-4000-8000-000000000001',
  '{"annual":24,"performance":7}', '{"annual":0,"performance":0}')->>'ok')::boolean,
  true, 'lost response retry is idempotent');
select is((select sum(revision)::integer from public.leave_grants), 2, 'retry does not increment revisions');
select is(public.api_save_onboarding('40000000-0000-4000-8000-000000000002',
  '{"annual":20,"performance":5}', '{"annual":0,"performance":0}')->>'code',
  'REVISION_CONFLICT', 'another tab stale state cannot overwrite saved grants');
select is((public.api_save_onboarding('40000000-0000-4000-8000-000000000003',
  '{"annual":20,"performance":5}', '{"annual":1,"performance":1}')->>'ok')::boolean,
  true, 'both days update with expected revisions');
select is((select sum(days)::integer from public.leave_grants), 25, 'updated days persisted');

-- If the second operation cannot delete a used grant, roll back the first edit.
select public.api_mutate_app('40000000-0000-4000-8000-000000000004', 'leaveUsage/create',
  jsonb_build_object('id', '50000000-0000-4000-8000-000000000001',
    'leaveGrantId', public.api_get_app_snapshot()->'account'->'onboardingGrantIds'->>'performance',
    'startDate', '2026-10-10', 'endDate', '2026-10-10'));
select is(public.api_save_onboarding('40000000-0000-4000-8000-000000000005',
  '{"annual":19,"performance":null}', '{"annual":2,"performance":2}')->>'code',
  'ACTIVE_USAGE_EXISTS', 'deselection respects active usage protection');
select is((select days from public.leave_grants where type = 'annual'), 20, 'first edit rolls back when second deletion fails');
select public.api_mutate_app('40000000-0000-4000-8000-000000000006', 'leaveUsage/cancel',
  '{"id":"50000000-0000-4000-8000-000000000001","expectedRevision":1}');
select is((public.api_save_onboarding('40000000-0000-4000-8000-000000000005',
  '{"annual":19,"performance":null}', '{"annual":2,"performance":2}')->>'ok')::boolean,
  true, 'deselection deletes server grant after cancellation');
select is(jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'), 1, 'deselected grant is gone');

reset role;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is(public.api_get_app_snapshot()->'account'->>'onboardingCompletedAt', null, 'other user completion is independent');
select is((public.api_migrate_local_data('40000000-0000-4000-8000-000000000007',
  '{"version":3,"leaveGrants":[{"id":"60000000-0000-4000-8000-000000000001","type":"annual","days":24,"acquiredDate":null,"reason":"","memo":"","createdAt":"2026-10-04T00:00:00Z","updatedAt":"2026-10-04T00:00:00Z"}],"leaveUsages":[],"outings":[]}'
)->>'ok')::boolean, true, 'local migration fingerprint works with empty search_path');
select isnt(public.api_get_app_snapshot()->'account'->>'localMigrationCompletedAt', null, 'migration completion persists');
select is(public.api_save_onboarding('40000000-0000-4000-8000-000000000008',
  '{"annual":24,"performance":7}', '{"annual":0,"performance":0}')->>'code',
  'MIGRATION_SERVER_NOT_EMPTY', 'onboarding cannot alter a migrated existing account');
select * from finish();
rollback;
