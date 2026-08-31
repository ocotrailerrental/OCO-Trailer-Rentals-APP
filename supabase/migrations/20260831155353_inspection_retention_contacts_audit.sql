-- Explicitly published profile contacts. Profiles remain private; this narrow
-- RPC returns only rows the owner has opted into public display.
alter table public.oco_profiles
  add column if not exists is_public_contact boolean not null default false;

create or replace function public.oco_public_contacts()
returns table (
  full_name text,
  email text,
  phone text,
  role text,
  location_id uuid,
  location_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.email, p.phone, p.role, p.location_id, l.name
  from public.oco_profiles p
  left join public.oco_locations l on l.id = p.location_id
  where p.is_public_contact
    and p.role in ('manager', 'admin', 'owner')
    and (p.email is not null or p.phone is not null)
  order by case p.role when 'owner' then 1 when 'admin' then 2 else 3 end, p.full_name;
$$;

revoke all on function public.oco_public_contacts() from public;
grant execute on function public.oco_public_contacts() to anon, authenticated;

-- Seven years is the default evidence-retention window. Objects are never
-- deleted with SQL: deletion must go through the Storage API so blob data and
-- metadata remain consistent.
alter table public.oco_inspection_photos
  add column if not exists retention_until timestamptz not null default (now() + interval '7 years'),
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_requested_by uuid references auth.users(id);

create table if not exists public.oco_inspection_photo_audit (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid,
  inspection_id uuid not null,
  reservation_id uuid not null,
  storage_path text,
  event_type text not null check (event_type in (
    'photo_uploaded', 'photo_updated', 'deletion_requested',
    'photo_deleted', 'inspection_completed'
  )),
  actor_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.oco_inspection_photo_audit enable row level security;
revoke all on table public.oco_inspection_photo_audit from anon, authenticated;
grant select on table public.oco_inspection_photo_audit to authenticated;

create index if not exists oco_photo_audit_reservation_created_idx
  on public.oco_inspection_photo_audit (reservation_id, created_at desc);

create policy "OCO photo audit scoped staff read"
on public.oco_inspection_photo_audit for select to authenticated
using (
  public.oco_is_staff()
  and public.oco_can_access_reservation(reservation_id)
);

create or replace function public.oco_record_photo_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.oco_inspection_photos;
  v_reservation_id uuid;
  v_event text;
begin
  v_photo := case when tg_op = 'DELETE' then old else new end;
  select i.reservation_id into v_reservation_id
  from public.oco_inspections i where i.id = v_photo.inspection_id;

  v_event := case
    when tg_op = 'INSERT' then 'photo_uploaded'
    when tg_op = 'DELETE' then 'photo_deleted'
    when new.deletion_requested_at is distinct from old.deletion_requested_at then 'deletion_requested'
    else 'photo_updated'
  end;

  insert into public.oco_inspection_photo_audit (
    photo_id, inspection_id, reservation_id, storage_path, event_type, actor_id, details
  ) values (
    v_photo.id, v_photo.inspection_id, v_reservation_id, v_photo.storage_path,
    v_event, auth.uid(),
    jsonb_build_object('category', v_photo.photo_category, 'retention_until', v_photo.retention_until)
  );
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function public.oco_record_photo_audit() from public, anon, authenticated;

drop trigger if exists oco_inspection_photo_audit_trigger on public.oco_inspection_photos;
create trigger oco_inspection_photo_audit_trigger
after insert or update or delete on public.oco_inspection_photos
for each row execute function public.oco_record_photo_audit();

create or replace function public.oco_enforce_required_inspection_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if new.completed_at is not null and old.completed_at is null then
    select array_agg(required_view order by required_view) into v_missing
    from unnest(array['front','rear','driver_side','passenger_side','deck','hitch','tires']) required_view
    where not exists (
      select 1 from public.oco_inspection_photos p
      where p.inspection_id = new.id and p.photo_category = required_view
    );
    if coalesce(array_length(v_missing, 1), 0) > 0 then
      raise exception 'Required inspection photos missing: %', array_to_string(v_missing, ', ');
    end if;

    insert into public.oco_inspection_photo_audit (
      inspection_id, reservation_id, event_type, actor_id, details
    ) values (
      new.id, new.reservation_id, 'inspection_completed', auth.uid(),
      jsonb_build_object('inspection_type', new.inspection_type, 'condition_status', new.condition_status)
    );
  end if;
  return new;
end
$$;

revoke all on function public.oco_enforce_required_inspection_photos() from public, anon, authenticated;

drop trigger if exists oco_inspection_required_photos_trigger on public.oco_inspections;
create trigger oco_inspection_required_photos_trigger
before update of completed_at on public.oco_inspections
for each row execute function public.oco_enforce_required_inspection_photos();

create or replace function public.oco_request_photo_deletion(p_photo_id uuid)
returns public.oco_inspection_photos
language plpgsql
security definer
set search_path = ''
as $$
declare v_photo public.oco_inspection_photos;
begin
  if auth.uid() is null or not public.oco_is_admin() then
    raise exception 'Owner or admin access required';
  end if;
  select * into v_photo from public.oco_inspection_photos where id = p_photo_id for update;
  if not found then raise exception 'Photo not found'; end if;
  if v_photo.retention_until > now() then
    raise exception 'Photo is retained until %', v_photo.retention_until;
  end if;
  update public.oco_inspection_photos
  set deletion_requested_at = now(), deletion_requested_by = auth.uid()
  where id = p_photo_id returning * into v_photo;
  return v_photo;
end
$$;

revoke all on function public.oco_request_photo_deletion(uuid) from public, anon;
grant execute on function public.oco_request_photo_deletion(uuid) to authenticated;

create policy "OCO expired requested photos admin delete"
on public.oco_inspection_photos for delete to authenticated
using (
  public.oco_is_admin()
  and retention_until <= now()
  and deletion_requested_at is not null
);

drop policy if exists "OCO inspection storage retention delete" on storage.objects;
create policy "OCO inspection storage retention delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'oco-inspection-photos'
  and public.oco_is_admin()
  and exists (
    select 1 from public.oco_inspection_photos p
    where p.storage_path = name
      and p.retention_until <= now()
      and p.deletion_requested_at is not null
  )
);
