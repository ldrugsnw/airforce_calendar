-- Close the production privilege drift before data-limit decisions.
-- No application data or function bodies are changed.
-- Remote platform defaults granted authenticated access to internal helpers.
-- Explicitly grant only the supported application entry points.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
revoke execute on function public.app_assert_active(uuid),
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
