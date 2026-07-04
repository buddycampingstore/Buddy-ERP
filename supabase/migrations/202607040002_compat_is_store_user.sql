do $$
begin
  if to_regprocedure('public.is_store_user()') is null then
    execute $function$
      create function public.is_store_user()
      returns boolean
      language sql
      security definer
      set search_path = public
      as $body$
        select auth.role() = 'authenticated';
      $body$
    $function$;
  end if;
end $$;

grant execute on function public.is_store_user() to authenticated;
