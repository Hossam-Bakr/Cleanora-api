-- Idempotent cleanup for superseded signed-envelope bootstrap tables (DEC-030).
-- Lexicographically after r1_p03a_production_role_provisioning so fresh applies
-- create-then-drop correctly. Safe on databases that already ran the earlier
-- mis-ordered drop migration.

ALTER TABLE IF EXISTS "staff_admin_bootstrap_closures"
  DROP CONSTRAINT IF EXISTS "staff_admin_bootstrap_closures_accepted_grant_id_fkey";

DROP TABLE IF EXISTS "staff_admin_bootstrap_authorization_uses";
DROP TABLE IF EXISTS "staff_admin_bootstrap_closures";
