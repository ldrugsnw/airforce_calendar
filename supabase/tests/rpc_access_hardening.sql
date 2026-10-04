begin;
create extension if not exists pgtap;
select plan(22);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password,
 email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('81000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rpc-owner@example.com','',now(),'{}','{}',now(),now()),
 ('81000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rpc-other@example.com','',now(),'{}','{}',now(),now());
select ok(not has_function_privilege('authenticated','public.app_snapshot(uuid)','execute'),'snapshot helper is private');
select ok(not has_function_privilege('anon','public.app_snapshot(uuid)','execute'),'anonymous snapshot is blocked');
select ok(not has_function_privilege('authenticated','public.app_assert_active(uuid)','execute'),'active helper is private');
select ok(not has_function_privilege('authenticated','public.app_validate_state(uuid)','execute'),'validation helper is private');
select ok(not has_function_privilege('authenticated','public.handle_new_auth_user()','execute'),'trigger helper is private');
select ok(not has_function_privilege('authenticated','public.hook_before_user_created(jsonb)','execute'),'auth hook is private');
select ok(has_function_privilege('supabase_auth_admin','public.hook_before_user_created(jsonb)','execute'),'Auth hook remains compatible');
create function public.test_future_helper() returns integer language sql as $$ select 1 $$;
select ok(not has_function_privilege('authenticated','public.test_future_helper()','execute'),'future helper is not exposed to authenticated');
select ok(not has_function_privilege('anon','public.test_future_helper()','execute'),'future helper is not exposed to anonymous');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.api_get_app_snapshot()->'account'->>'userId','81000000-0000-4000-8000-000000000001','supported snapshot returns own account');
select throws_ok($$select public.app_snapshot('81000000-0000-4000-8000-000000000002')$$,'42501',null,'direct other-account snapshot denied');
select is((public.api_mutate_app('82000000-0000-4000-8000-000000000001','leaveGrant/create','{"id":"83000000-0000-4000-8000-000000000001","type":"annual","days":24,"acquiredDate":null,"reason":"","memo":""}')->>'ok')::boolean,true,'existing app create still works');
select is(jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'),1,'snapshot includes own created record');
select is(public.api_mutate_app('82000000-0000-4000-8000-000000000002','leaveGrant/update','{"id":"83000000-0000-4000-8000-000000000001","type":"annual","days":20,"acquiredDate":null,"reason":"","memo":"","expectedRevision":1}')->>'ok','true','existing app update works');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'),0,'other user cannot see created record');
select is(public.api_mutate_app('82000000-0000-4000-8000-000000000003','leaveGrant/delete','{"id":"83000000-0000-4000-8000-000000000001","expectedRevision":2}')->>'code','NOT_FOUND','other user mutation blocked');
reset role;
-- Exercise defense in depth if an accidental grant is introduced in the future.
grant execute on function public.app_snapshot(uuid),public.app_assert_active(uuid),public.app_validate_state(uuid) to authenticated;
set local role authenticated;
select is(public.app_snapshot('81000000-0000-4000-8000-000000000001'),null::jsonb,'owner predicate protects snapshot even with accidental grant');
select throws_ok($$select public.app_assert_active('81000000-0000-4000-8000-000000000001')$$,'P0001','ACCOUNT_FORBIDDEN','active helper checks owner');
select throws_ok($$select public.app_validate_state('81000000-0000-4000-8000-000000000001')$$,'P0001','ACCOUNT_FORBIDDEN','validation helper checks owner');
select is(public.app_snapshot('81000000-0000-4000-8000-000000000002')->'account'->>'userId','81000000-0000-4000-8000-000000000002','owner predicate allows own snapshot');
select set_config('request.jwt.claims','{}',true);
select is(public.app_snapshot('81000000-0000-4000-8000-000000000001'),null::jsonb,'missing caller cannot read snapshot');
select throws_ok($$select public.app_assert_active('81000000-0000-4000-8000-000000000001')$$,'P0001','AUTH_REQUIRED','missing caller denied');
reset role;
select * from finish();
rollback;
