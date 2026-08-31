-- Public customers can browse active catalog rows. Once signed in as staff,
-- managers must not inherit that public visibility across yards.
drop policy if exists "OCO trailers public read" on public.oco_trailers;
create policy "OCO trailers anonymous active read"
on public.oco_trailers for select to anon
using (is_active = true);
create policy "OCO trailers authenticated scoped read"
on public.oco_trailers for select to authenticated
using (
  (not public.oco_is_staff() and is_active = true)
  or public.oco_is_admin()
  or public.oco_can_manage_location(location_id)
);

drop policy if exists "OCO locations public read" on public.oco_locations;
create policy "OCO locations anonymous active read"
on public.oco_locations for select to anon
using (is_active = true);
create policy "OCO locations authenticated scoped read"
on public.oco_locations for select to authenticated
using (
  (not public.oco_is_staff() and is_active = true)
  or public.oco_is_admin()
  or public.oco_can_manage_location(id)
);
