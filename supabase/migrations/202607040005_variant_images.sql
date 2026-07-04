alter table public.variants
  add column if not exists image text;

update public.variants v
set image = m.image
from public.models m
where v.model_id = m.id
  and nullif(v.image, '') is null
  and nullif(m.image, '') is not null;
