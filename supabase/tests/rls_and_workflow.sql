-- Dependency-free, read-only security assertions. Any failed condition raises
-- and fails CI without requiring pgTAP in production.
begin;
do $$
begin
  assert exists(select 1 from pg_trigger where tgname = 'oco_profiles_protect_scope'), 'manager yard assignment trigger is missing';
  assert not has_function_privilege('anon', 'public.oco_create_reservation(uuid,uuid,uuid,date,date,text,text,text,text,text,text,numeric,text,text)', 'EXECUTE'), 'anonymous reservation creation is exposed';
  assert has_function_privilege('authenticated', 'public.oco_create_reservation(uuid,uuid,uuid,date,date,text,text,text,text,text,text,numeric,text,text)', 'EXECUTE'), 'authenticated reservation creation is unavailable';
  assert not has_function_privilege('anon', 'public.oco_handle_new_user()', 'EXECUTE'), 'auth trigger is exposed as anonymous RPC';
  assert not has_function_privilege('anon', 'public.oco_is_admin()', 'EXECUTE'), 'admin helper is exposed to anonymous RPC';
  assert not has_function_privilege('anon', 'public.oco_can_manage_location(uuid)', 'EXECUTE'), 'yard helper is exposed to anonymous RPC';
  assert (select extnamespace::regnamespace::text from pg_extension where extname='btree_gist') = 'extensions', 'btree_gist is not in extensions';
  assert (select relrowsecurity from pg_class where oid='public.oco_inspections'::regclass), 'inspection RLS is disabled';
  assert (select relrowsecurity from pg_class where oid='public.oco_inspection_photos'::regclass), 'photo RLS is disabled';
  assert (select not public from storage.buckets where id='oco-inspection-photos'), 'inspection bucket is public';
  assert (select file_size_limit from storage.buckets where id='oco-inspection-photos') = 10485760, 'inspection bucket limit is not 10 MB';
  assert exists(select 1 from pg_policies where tablename='oco_voice_holds' and policyname='OCO voice holds scoped staff manage'), 'voice holds are not yard scoped';
  assert exists(select 1 from pg_policies where tablename='oco_call_logs' and policyname='OCO call logs scoped staff manage'), 'call logs are not yard scoped';
  assert exists(select 1 from information_schema.columns where table_name='oco_reservations' and column_name='discount_amount'), 'discount results are not stored';
  assert exists(select 1 from pg_policies where tablename='oco_trailers' and policyname='OCO trailers authenticated scoped read'), 'signed-in trailer catalog is not role scoped';
  assert exists(select 1 from pg_trigger where tgname='oco_inspection_required_photos_trigger'), 'required inspection photo trigger is missing';
  assert exists(select 1 from pg_trigger where tgname='oco_inspection_photo_audit_trigger'), 'photo audit trigger is missing';
  assert (select relrowsecurity from pg_class where oid='public.oco_inspection_photo_audit'::regclass), 'photo audit RLS is disabled';
  assert not has_function_privilege('anon', 'public.oco_request_photo_deletion(uuid)', 'EXECUTE'), 'photo deletion request is anonymous';
  assert exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='OCO inspection storage retention delete'), 'storage retention delete policy is missing';
end
$$;
rollback;
