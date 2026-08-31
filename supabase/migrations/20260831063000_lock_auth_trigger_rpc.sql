-- Trigger functions run as their owner and do not need client EXECUTE grants.
-- Keep the Auth profile handler out of PostgREST RPC discovery.
revoke all on function public.oco_handle_new_user() from public, anon, authenticated;
