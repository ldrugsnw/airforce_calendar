begin;
create extension if not exists pgtap;
select plan(13);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('91000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','legacy-fixture@example.com','',now(),'{}','{}',now(),now());
alter table public.leave_grants drop constraint leave_grants_days_range_check, drop constraint leave_grants_acquired_date_range_check;
insert into public.leave_grants(id,user_id,type,days,acquired_date,reason,memo) values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','annual',500,'9999-01-01','keep reason','keep memo'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','reward',500,'2026-09-01','keep reward','keep memo');
alter table public.leave_grants add constraint leave_grants_days_range_check check(days between 1 and 365) not valid,
 add constraint leave_grants_acquired_date_range_check check(acquired_date is null or acquired_date between date '2000-01-01' and date '2999-12-31') not valid;
insert into public.leave_usages(id,user_id,leave_grant_id,start_date,end_date) values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','2026-10-10','2026-10-11');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'),2,'legacy records can be read without correction');
select is((select days from public.leave_grants where id='92000000-0000-4000-8000-000000000001'),500,'initial values preserved');
select set_config('test.items','[{"key":"grant-92000000-0000-4000-8000-000000000001","id":"92000000-0000-4000-8000-000000000001","type":"annual","days":20,"acquiredDate":"2026-09-01"},{"key":"grant-92000000-0000-4000-8000-000000000002","id":"92000000-0000-4000-8000-000000000002","type":"reward","days":3}]',true);
select is(public.api_save_onboarding_plan('94000000-0000-4000-8000-000000000001',current_setting('test.items')::jsonb,public.api_get_app_snapshot()-'account'-'syncedAt',false)->>'code','CONFIRMATION_REQUIRED','owner must confirm changed days and date');
select is(public.api_save_onboarding_plan('94000000-0000-4000-8000-000000000002','[{"key":"x","id":"92000000-0000-4000-8000-000000000001","type":"annual","days":20,"acquiredDate":null}]',public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','LEGACY_CORRECTION_REQUIRED','out of range acquisition date requires a real replacement');
select is(public.api_save_onboarding_plan('94000000-0000-4000-8000-000000000003','[{"key":"x","id":"92000000-0000-4000-8000-000000000001","type":"annual","days":null,"acquiredDate":"2026-09-01"}]',public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','LEGACY_CORRECTION_REQUIRED','legacy record cannot be deleted by onboarding');
select is(public.api_save_onboarding_plan('94000000-0000-4000-8000-000000000004','[{"key":"x","id":"92000000-0000-4000-8000-000000000001","type":"annual","days":20,"acquiredDate":"2026-09-01"}]',public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'code','LEGACY_CORRECTION_REQUIRED','remaining legacy reward prevents completion');
select is((select days from public.leave_grants where id='92000000-0000-4000-8000-000000000001'),500,'partial correction rolls back');
select is(public.api_get_app_snapshot()->'account'->>'onboardingCompletedAt',null,'failed save never completes');
select is(public.api_save_onboarding_plan('94000000-0000-4000-8000-000000000005',current_setting('test.items')::jsonb,public.api_get_app_snapshot()-'account'-'syncedAt',true)->>'ok','true','confirmed corrections save all types atomically');
select is((select reason||':'||memo||':'||acquired_date from public.leave_grants where id='92000000-0000-4000-8000-000000000001'),'keep reason:keep memo:2026-09-01','only confirmed date and days change');
select is((select leave_grant_id::text from public.leave_usages where id='93000000-0000-4000-8000-000000000001'),'92000000-0000-4000-8000-000000000001','usage reference preserved');
select is(public.api_mutate_app('94000000-0000-4000-8000-000000000006','leaveGrant/create','{"id":"95000000-0000-4000-8000-000000000001","type":"annual","days":500,"acquiredDate":"2026-09-01"}')->>'ok','false','NOT VALID still blocks new out of range grants');
select is((select count(*)::integer from public.leave_grants),2,'no duplicate grants');
reset role;
select * from finish();
rollback;
