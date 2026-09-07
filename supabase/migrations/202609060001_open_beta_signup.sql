-- Open the feedback beta to anyone who has the shared application link.
-- Keep this compatibility hook until the remote Auth Hook is disabled in Dashboard.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select '{}'::jsonb;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_accounts(user_id) values (new.id);
  return new;
end;
$$;

revoke all on public.beta_allowlist from supabase_auth_admin;

