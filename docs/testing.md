# OCO test accounts and automated checks

The Supabase project contains confirmed, non-customer audit identities:

- audit-customer@oco.test
- audit-manager@oco.test (Omaha only)
- audit-admin@oco.test

Their password is stored only in the local/CI secret OCO_AUDIT_PASSWORD; it is not committed. These accounts must never receive real payment methods or be used to create real charges.

Run npm test, npm run lint, npm run build, and npm run test:e2e.

The browser suite uses PLAYWRIGHT_BASE_URL when supplied and otherwise starts the local Vite server. The SQL assertions in supabase/tests/rls_and_workflow.sql are read-only and dependency-free. They verify critical grants, RLS, the private photo bucket, manager scope, discount storage, and the btree_gist schema.

GitHub Actions runs the lint, unit-test, and production-build checks for every push and pull request. Browser and SQL checks run when these repository secrets are configured:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- OCO_AUDIT_PASSWORD
- SUPABASE_DB_URL

Vercel also runs the local verification and build commands before creating a deployment. A successful Vercel deployment triggers the browser and SQL workflow against the deployed preview when its required secrets are available.
