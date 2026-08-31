-- OCO security, discounts, and contactless inspection foundation.
-- This migration is idempotent where PostgreSQL allows it and is intended to be
-- the source-controlled authority for the live changes made during the audit.

create schema if not exists extensions;
alter extension btree_gist set schema extensions;

-- A manager may edit their name and phone, but may never choose the yard that
-- determines their authorization scope. Only an admin/owner may change it.
create or replace function public.oco_protect_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.location_id is distinct from old.location_id and not public.oco_is_admin() then
    raise exception 'Only an OCO administrator can change a staff yard assignment';
  end if;
  return new;
end;
$$;

drop trigger if exists oco_profiles_protect_scope on public.oco_profiles;
create trigger oco_profiles_protect_scope
before update on public.oco_profiles
for each row execute function public.oco_protect_profile_scope();

revoke all on function public.oco_protect_profile_scope() from public, anon, authenticated;

-- One reusable predicate for reservations. Admins/owners are company-wide;
-- managers are limited to the pickup or return yard assigned by an admin.
create or replace function public.oco_can_access_reservation(p_reservation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.oco_reservations r
    where r.id = p_reservation_id
      and (
        r.customer_id = auth.uid()
        or public.oco_is_admin()
        or public.oco_can_manage_location(r.pickup_location_id)
        or public.oco_can_manage_location(r.return_location_id)
      )
  );
$$;

revoke all on function public.oco_can_access_reservation(uuid) from public, anon;
grant execute on function public.oco_can_access_reservation(uuid) to authenticated;

drop policy if exists "OCO inspections create own" on public.oco_inspections;
drop policy if exists "OCO inspections read own or staff" on public.oco_inspections;
drop policy if exists "OCO inspections update own or staff" on public.oco_inspections;

create policy "OCO inspections scoped read"
on public.oco_inspections for select to authenticated
using (public.oco_can_access_reservation(reservation_id));

create policy "OCO inspections scoped insert"
on public.oco_inspections for insert to authenticated
with check (
  customer_id = auth.uid()
  and public.oco_can_access_reservation(reservation_id)
  and exists (
    select 1 from public.oco_reservations r
    where r.id = reservation_id
      and r.customer_id = customer_id
      and r.trailer_id = trailer_id
  )
);

create policy "OCO inspections scoped update"
on public.oco_inspections for update to authenticated
using (public.oco_can_access_reservation(reservation_id))
with check (
  public.oco_can_access_reservation(reservation_id)
  and exists (
    select 1 from public.oco_reservations r
    where r.id = reservation_id
      and r.customer_id = customer_id
      and r.trailer_id = trailer_id
  )
);

drop policy if exists "OCO inspection photos create own" on public.oco_inspection_photos;
drop policy if exists "OCO inspection photos read own or staff" on public.oco_inspection_photos;

create policy "OCO inspection photos scoped read"
on public.oco_inspection_photos for select to authenticated
using (
  exists (
    select 1 from public.oco_inspections i
    where i.id = inspection_id
      and public.oco_can_access_reservation(i.reservation_id)
  )
);

create policy "OCO inspection photos scoped insert"
on public.oco_inspection_photos for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.oco_inspections i
    where i.id = inspection_id
      and public.oco_can_access_reservation(i.reservation_id)
  )
);

-- Storage objects are linked back to a photo row after upload. Owners of the
-- top-level folder can always read their upload; scoped staff can read it once
-- the database row exists.
create or replace function public.oco_can_view_inspection_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
    from public.oco_inspection_photos p
    join public.oco_inspections i on i.id = p.inspection_id
    where p.storage_path = p_object_name
      and public.oco_can_access_reservation(i.reservation_id)
  );
$$;

revoke all on function public.oco_can_view_inspection_object(text) from public, anon;
grant execute on function public.oco_can_view_inspection_object(text) to authenticated;

drop policy if exists "OCO inspection storage read own or staff" on storage.objects;
create policy "OCO inspection storage scoped read"
on storage.objects for select to authenticated
using (
  bucket_id = 'oco-inspection-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.oco_can_view_inspection_object(name)
  )
);

-- Voice records contain customer PII and must follow the same yard model.
drop policy if exists "OCO voice holds staff manage" on public.oco_voice_holds;
create policy "OCO voice holds scoped staff manage"
on public.oco_voice_holds for all to authenticated
using (public.oco_is_admin() or public.oco_can_manage_location(location_id))
with check (public.oco_is_admin() or public.oco_can_manage_location(location_id));

drop policy if exists "OCO call logs staff manage" on public.oco_call_logs;
create policy "OCO call logs scoped staff manage"
on public.oco_call_logs for all to authenticated
using (
  public.oco_is_admin()
  or exists (
    select 1 from public.oco_voice_holds h
    where h.id = hold_id and public.oco_can_manage_location(h.location_id)
  )
)
with check (
  public.oco_is_admin()
  or exists (
    select 1 from public.oco_voice_holds h
    where h.id = hold_id and public.oco_can_manage_location(h.location_id)
  )
);

-- Keep trailer-registration writes available to all staff as requested.

alter table public.oco_reservations
  add column if not exists discount_id uuid references public.oco_discounts(id) on delete set null,
  add column if not exists discount_code text,
  add column if not exists pre_discount_subtotal numeric(10,2) not null default 0 check (pre_discount_subtotal >= 0),
  add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0);

create index if not exists oco_reservations_discount_id_idx
on public.oco_reservations(discount_id);

drop function if exists public.oco_create_reservation(
  uuid, uuid, uuid, date, date, text, text, text, text, text, text, numeric, text
);

create function public.oco_create_reservation(
  p_trailer_id uuid,
  p_pickup_location_id uuid,
  p_return_location_id uuid,
  p_start_date date,
  p_end_date date,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pickup_method text,
  p_payment_method text,
  p_delivery_address text default null,
  p_delivery_miles numeric default 0,
  p_customer_notes text default null,
  p_discount_code text default null
)
returns public.oco_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trailer public.oco_trailers%rowtype;
  v_discount public.oco_discounts%rowtype;
  v_days integer;
  v_remaining integer;
  v_pre_discount numeric(10,2) := 0;
  v_discount_amount numeric(10,2) := 0;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 0;
  v_payment_status text;
  v_reservation public.oco_reservations%rowtype;
begin
  if v_user_id is null then raise exception 'You must sign in before creating a reservation'; end if;
  if p_end_date < p_start_date then raise exception 'Return date must be on or after pickup date'; end if;
  if p_pickup_method not in ('self_pickup', 'delivery') then raise exception 'Invalid pickup method'; end if;
  if p_payment_method not in ('card', 'cash') then raise exception 'Invalid payment method'; end if;
  if p_pickup_method = 'delivery' and nullif(trim(coalesce(p_delivery_address, '')), '') is null then
    raise exception 'A delivery address is required';
  end if;

  select * into v_trailer from public.oco_trailers
  where id = p_trailer_id and location_id = p_pickup_location_id
    and is_active = true and status = 'available' for update;
  if not found then raise exception 'Trailer is not available at the selected pickup location'; end if;

  if exists (
    select 1 from public.oco_reservations r
    where r.trailer_id = p_trailer_id
      and r.reservation_status in ('pending', 'confirmed', 'active')
      and daterange(r.start_date, r.end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then raise exception 'Trailer is no longer available for those dates'; end if;

  v_days := (p_end_date - p_start_date) + 1;
  v_remaining := v_days;
  if v_remaining >= 30 then
    v_pre_discount := v_pre_discount + floor(v_remaining / 30.0) * v_trailer.monthly_rate;
    v_remaining := v_remaining % 30;
  end if;
  if v_remaining >= 7 then
    v_pre_discount := v_pre_discount + floor(v_remaining / 7.0) * v_trailer.weekly_rate;
    v_remaining := v_remaining % 7;
  end if;
  v_pre_discount := v_pre_discount + v_remaining * v_trailer.daily_rate;

  if nullif(upper(trim(coalesce(p_discount_code, ''))), '') is not null then
    select * into v_discount from public.oco_discounts
    where upper(code) = upper(trim(p_discount_code))
      and is_active = true
      and (location_id is null or location_id = p_pickup_location_id)
      and (starts_on is null or starts_on <= p_start_date)
      and (ends_on is null or ends_on >= p_start_date)
      and (min_days is null or min_days <= v_days)
      and (max_uses is null or times_used < max_uses)
    for update;
    if not found then raise exception 'Discount code is invalid or unavailable for this rental'; end if;
    v_discount_amount := least(
      v_pre_discount,
      case when v_discount.kind = 'percent'
        then round(v_pre_discount * v_discount.value / 100.0, 2)
        else v_discount.value end
    );
  end if;

  v_subtotal := v_pre_discount - v_discount_amount;
  if p_pickup_method = 'delivery' then
    v_delivery_fee := round(greatest(coalesce(p_delivery_miles, 0), 0) * 0.50, 2);
  end if;
  v_payment_status := case when p_payment_method = 'cash' then 'pending_cash' else 'unpaid' end;

  insert into public.oco_reservations (
    customer_id, trailer_id, pickup_location_id, return_location_id,
    customer_name, customer_email, customer_phone, start_date, end_date,
    pickup_method, delivery_address, delivery_miles, delivery_fee,
    pre_discount_subtotal, discount_id, discount_code, discount_amount,
    rental_subtotal, security_deposit, taxes, total,
    payment_method, payment_status, reservation_status, customer_notes
  ) values (
    v_user_id, p_trailer_id, p_pickup_location_id, p_return_location_id,
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone),
    p_start_date, p_end_date, p_pickup_method,
    nullif(trim(coalesce(p_delivery_address, '')), ''),
    case when p_pickup_method = 'delivery' then greatest(coalesce(p_delivery_miles, 0), 0) else 0 end,
    v_delivery_fee, v_pre_discount, v_discount.id,
    case when v_discount.id is null then null else upper(trim(p_discount_code)) end,
    v_discount_amount, v_subtotal, v_trailer.security_deposit, 0,
    v_subtotal + v_delivery_fee + v_trailer.security_deposit,
    p_payment_method, v_payment_status, 'pending', nullif(trim(coalesce(p_customer_notes, '')), '')
  ) returning * into v_reservation;

  if v_discount.id is not null then
    update public.oco_discounts set times_used = times_used + 1, updated_at = now()
    where id = v_discount.id;
  end if;
  return v_reservation;
exception when exclusion_violation then
  raise exception 'Trailer is no longer available for those dates';
end;
$$;

revoke all on function public.oco_create_reservation(
  uuid, uuid, uuid, date, date, text, text, text, text, text, text, numeric, text, text
) from public, anon;
grant execute on function public.oco_create_reservation(
  uuid, uuid, uuid, date, date, text, text, text, text, text, text, numeric, text, text
) to authenticated;

-- Internal authorization and trigger helpers should not be public RPCs.
revoke execute on function public.oco_is_admin() from anon;
revoke execute on function public.oco_is_staff() from anon;
revoke execute on function public.oco_manager_location() from anon;
revoke execute on function public.oco_can_manage_location(uuid) from anon;
revoke execute on function public.oco_handle_new_user() from anon, authenticated;
revoke execute on function public.oco_sync_profile_email() from anon, authenticated;
revoke execute on function public.oco_prevent_role_escalation() from anon, authenticated;

