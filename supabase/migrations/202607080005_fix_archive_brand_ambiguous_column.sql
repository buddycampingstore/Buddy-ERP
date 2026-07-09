-- Fix: archive_brand raised "column reference archived_at is ambiguous".
--
-- Its first statement is `UPDATE public.variants v ... FROM public.models m`.
-- Because BOTH variants and models have archived_at / archived_by columns, the
-- unqualified `coalesce(archived_at, now())` / `coalesce(archived_by, auth.uid())`
-- on the right-hand side is ambiguous and Postgres refuses to run it, so hiding
-- a brand failed entirely. Qualify those reads with the target alias `v.`.
-- (The models/brands statements below have no FROM clause, so they were fine.)

create or replace function public.archive_brand(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_user() then
    raise exception 'Authentication required';
  end if;

  update public.variants v
  set is_active = false,
      archived_at = coalesce(v.archived_at, now()),
      archived_by = coalesce(v.archived_by, auth.uid())
  from public.models m
  where v.model_id = m.id
    and m.brand_id = p_brand_id;

  update public.models
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where brand_id = p_brand_id;

  update public.brands
  set is_active = false,
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, auth.uid())
  where id = p_brand_id;
end;
$$;

grant execute on function public.archive_brand(uuid) to authenticated;
