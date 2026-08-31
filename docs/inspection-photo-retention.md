# Inspection photo retention and deletion

Inspection photos are private rental records. Pickup and return inspections require front, rear, driver-side, passenger-side, deck, hitch, and tire views before completion.

Each photo record receives a seven-year retention date. A deletion request cannot be created before that date, and only an administrator or owner can request deletion. After the retention date and an approved request, an administrator must remove the private storage object through the Supabase Storage API before deleting its database record. Direct SQL deletion of storage objects is not supported.

The audit history records uploads, metadata updates, deletion requests, deletions, and inspection completion. Staff can view audit events only for reservations allowed by their server-side role and yard assignment. Customers cannot read staff audit history.

The database and storage policies are the enforcement boundary. The application checklist is an additional usability safeguard, not the security control.
