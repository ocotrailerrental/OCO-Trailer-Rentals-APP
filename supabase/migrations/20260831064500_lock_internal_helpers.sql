-- Internal RLS helpers must not be anonymously callable as SECURITY DEFINER RPCs.
revoke all on function public.oco_can_manage_location(uuid) from public, anon;
revoke all on function public.oco_is_admin() from public, anon;
revoke all on function public.oco_is_staff() from public, anon;
revoke all on function public.oco_manager_location() from public, anon;
revoke all on function public.oco_can_access_reservation(uuid) from public, anon;
revoke all on function public.oco_can_view_inspection_object(text) from public, anon;

grant execute on function public.oco_can_manage_location(uuid) to authenticated;
grant execute on function public.oco_is_admin() to authenticated;
grant execute on function public.oco_is_staff() to authenticated;
grant execute on function public.oco_manager_location() to authenticated;
grant execute on function public.oco_can_access_reservation(uuid) to authenticated;
grant execute on function public.oco_can_view_inspection_object(text) to authenticated;

revoke all on function public.oco_prevent_role_escalation() from public, anon, authenticated;
revoke all on function public.oco_sync_profile_email() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- The original table already has an equivalent unique constraint.
drop index if exists public.oco_inspections_reservation_type_uidx;
