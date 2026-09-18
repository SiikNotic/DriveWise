-- Advisor findings from the previous two migrations:
-- 1. set_updated_at had a mutable search_path (function_search_path_mutable).
-- 2. handle_new_user, though a trigger function that errors if called
--    directly outside trigger context, still had default EXECUTE granted
--    to anon/authenticated via its SECURITY DEFINER RPC surface — the
--    "never SECURITY DEFINER in public without revoking PUBLIC's default
--    EXECUTE grant" rule from the Supabase security skill, which the
--    original migration's comment called out but didn't actually apply.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, first_name, last_name, phone, country, state)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'country',
    new.raw_user_meta_data ->> 'state'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
