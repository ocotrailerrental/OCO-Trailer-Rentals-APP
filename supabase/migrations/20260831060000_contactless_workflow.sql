-- Make the contactless inspection workflow idempotent and keep all identity
-- fields derived from the reservation rather than trusting browser input.
create unique index if not exists oco_inspections_reservation_type_uidx
  on public.oco_inspections (reservation_id, inspection_type);

create or replace function public.oco_start_inspection(
  p_reservation_id uuid,
  p_inspection_type text
)
returns public.oco_inspections
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reservation public.oco_reservations;
  v_inspection public.oco_inspections;
begin
  if p_inspection_type not in ('pickup', 'return') then
    raise exception 'Invalid inspection type';
  end if;

  select * into v_reservation
  from public.oco_reservations
  where id = p_reservation_id;

  if not found then raise exception 'Reservation not found or access denied'; end if;

  insert into public.oco_inspections (
    reservation_id, trailer_id, customer_id, inspection_type
  ) values (
    v_reservation.id, v_reservation.trailer_id, v_reservation.customer_id, p_inspection_type
  )
  on conflict (reservation_id, inspection_type)
  do update set updated_at = now()
  returning * into v_inspection;

  return v_inspection;
end
$$;

revoke all on function public.oco_start_inspection(uuid, text) from public, anon;
grant execute on function public.oco_start_inspection(uuid, text) to authenticated;

comment on table public.oco_discounts is
  'Promotional codes applied atomically by oco_create_reservation. Managed by admins and location-scoped managers.';
