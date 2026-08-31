# OCO test accounts and automated checks

The Supabase project contains confirmed, non-customer audit identities:

- audit-customer@oco.test
- audit-manager@oco.test (Omaha only)
- audit-admin@oco.test

Their password is stored only in the local/CI secret OCO_AUDIT_PASSWORD; it is not committed. These accounts must never receive real payment methods or be used to create real charges.

Run npm test, npm run lint, npm run build, and npm run test:e2e.

The browser suite uses PLAYWRIGHT_BASE_URL when supplied and otherwise starts the local Vite server. The SQL assertions in supabase/tests/rls_and_workflow.sql are read-only and dependency-free. They verify critical grants, RLS, the private photo bucket, manager scope, discount storage, and the btree_gist schema.
