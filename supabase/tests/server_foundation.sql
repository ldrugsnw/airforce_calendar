begin;
create extension if not exists pgtap;
select plan(9);

select has_table('public', 'leave_grants', 'leave_grants table exists');
select has_table('public', 'mutation_requests', 'mutation request table exists');

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alpha@example.com', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bravo@example.com', '', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

select is(
  (select count(*)::integer from public.user_accounts),
  2,
  'auth trigger creates app accounts without an allowlist'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (public.api_mutate_app(
    'aaaaaaaa-0000-0000-0000-000000000001',
    'leaveGrant/create',
    '{"id":"aaaaaaaa-1111-1111-1111-111111111111","type":"annual","days":5,"acquiredDate":"2026-08-01","reason":"test","memo":""}'
  )->>'ok')::boolean,
  true,
  'owner creates a leave grant through RPC'
);

select is(
  jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'),
  1,
  'snapshot returns owner data'
);

select is(
  (public.api_mutate_app(
    'aaaaaaaa-0000-0000-0000-000000000002',
    'leaveUsage/create',
    '{"id":"aaaaaaaa-2222-2222-2222-222222222222","leaveGrantId":"aaaaaaaa-1111-1111-1111-111111111111","startDate":"2026-08-10","endDate":"2026-08-12"}'
  )->>'ok')::boolean,
  true,
  'owner creates a valid leave usage'
);

select is(
  public.api_mutate_app(
    'aaaaaaaa-0000-0000-0000-000000000003',
    'outing/create',
    '{"id":"aaaaaaaa-3333-3333-3333-333333333333","date":"2026-08-11","reason":"conflict"}'
  )->>'code',
  'OUTING_OVERLAP',
  'server rejects outing and leave overlap'
);

select is(
  public.api_mutate_app(
    'aaaaaaaa-0000-0000-0000-000000000004',
    'leaveGrant/update',
    '{"id":"aaaaaaaa-1111-1111-1111-111111111111","expectedRevision":99,"type":"annual","days":5,"acquiredDate":"2026-08-01","reason":"stale","memo":""}'
  )->>'code',
  'REVISION_CONFLICT',
  'server rejects stale revisions'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(public.api_get_app_snapshot()->'leaveGrants'),
  0,
  'another user cannot read the first user data'
);

select * from finish();
rollback;
