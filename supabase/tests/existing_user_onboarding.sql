begin;
create extension if not exists pgtap;
select plan(16);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('70000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'existing-onboarding@example.com', '', now(), '{}', '{}', now(), now());
insert into public.leave_grants(id,user_id,type,days,acquired_date,reason,memo) values
  ('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','annual',24,'2026-09-01','original annual','keep memo'),
  ('71000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','annual',10,null,'second annual',''),
  ('71000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','performance',7,null,'performance',''),
  ('71000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000001','reward',3,null,'other preserved','');
insert into public.leave_usages(id,user_id,leave_grant_id,start_date,end_date,canceled,canceled_at) values
  ('72000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','2026-10-10','2026-10-11',false,null),
  ('72000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','2026-10-13','2026-10-13',true,now());
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('test.reviewed', (public.api_get_app_snapshot() - 'account' - 'syncedAt')::text, true);
select set_config('test.items', '[{"key":"a","id":"71000000-0000-4000-8000-000000000001","type":"annual","days":20},{"key":"b","id":"71000000-0000-4000-8000-000000000002","type":"annual","days":9},{"key":"p","id":"71000000-0000-4000-8000-000000000003","type":"performance","days":null}]', true);
select is(public.api_get_app_snapshot()->'account'->>'onboardingCompletedAt', null, 'having old records does not complete onboarding');
select is(public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000001', current_setting('test.items')::jsonb,
  current_setting('test.reviewed')::jsonb,false)->>'code', 'CONFIRMATION_REQUIRED', 'server requires explicit confirmation of existing changes');
select is((select days from public.leave_grants where id='71000000-0000-4000-8000-000000000001'),24,'unconfirmed change leaves original untouched');
select is((public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000001', current_setting('test.items')::jsonb,
  current_setting('test.reviewed')::jsonb,true)->>'ok')::boolean,true,'confirmed plan updates existing IDs and deletes deselected grant');
select is((select count(*)::integer from public.leave_grants),3,'multiple annual grants stay separate and reward is preserved');
select is((select reason||':'||memo||':'||acquired_date from public.leave_grants where id='71000000-0000-4000-8000-000000000001'),
  'original annual:keep memo:2026-09-01','acquired date reason and memo are preserved');
select is((select leave_grant_id::text from public.leave_usages where id='72000000-0000-4000-8000-000000000001'),
  '71000000-0000-4000-8000-000000000001','active usage still references the same grant');
select is((select count(*)::integer from public.leave_usages where canceled),0,'confirmed deletion cascades reviewed canceled history');
select is((public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000001', current_setting('test.items')::jsonb,
  current_setting('test.reviewed')::jsonb,true)->>'ok')::boolean,true,'lost response replay returns success with stale reviewed state');
select is((select revision from public.leave_grants where id='71000000-0000-4000-8000-000000000001'),2,'replay does not increment revisions');
select is(public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000002',
  '[{"key":"b","id":"71000000-0000-4000-8000-000000000002","type":"annual","days":8},{"key":"a","id":"71000000-0000-4000-8000-000000000001","type":"annual","days":null}]',
  public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','ACTIVE_USAGE_EXISTS','active usage prevents deletion even after confirmation');
select is((select days from public.leave_grants where id='71000000-0000-4000-8000-000000000002'),9,'earlier operation rolls back on protected deletion');
select is(public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000003',
  '[{"key":"a","id":"71000000-0000-4000-8000-000000000001","type":"annual","days":1}]',
  public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','INSUFFICIENT_DAYS','reducing below active usage is blocked');
select set_config('test.reviewed', (public.api_get_app_snapshot()-'account'-'syncedAt')::text,true);
select public.api_mutate_app('73000000-0000-4000-8000-000000000004','outing/create',
  '{"id":"74000000-0000-4000-8000-000000000001","date":"2026-10-20","reason":"new after review"}');
select is(public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000005', '[]',
  current_setting('test.reviewed')::jsonb,true)->>'code','REVISION_CONFLICT','changed schedules invalidate old confirmation');
select is(public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000006',
  '[{"key":"x","id":"75000000-0000-4000-8000-000000000001","type":"annual","days":3}]',
  public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','NOT_FOUND','unregistered IDs cannot create duplicate existing leave');
select is(public.api_save_onboarding_plan('73000000-0000-4000-8000-000000000007',
  '[{"key":"a","id":"71000000-0000-4000-8000-000000000001","type":"annual","days":20},{"key":"a","id":"71000000-0000-4000-8000-000000000001","type":"annual","days":20}]',
  public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','INVALID_SELECTION','duplicate plan items are rejected');
select * from finish();
rollback;
