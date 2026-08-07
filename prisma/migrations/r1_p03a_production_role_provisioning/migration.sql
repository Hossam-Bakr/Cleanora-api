-- CreateTable
CREATE TABLE "staff_admin_bootstrap_closures" (
    "scope_key" VARCHAR(32) NOT NULL,
    "accepted_grant_id" TEXT NOT NULL,
    "accepted_command_hash" CHAR(64) NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_admin_bootstrap_closures_pkey" PRIMARY KEY ("scope_key")
);

-- CreateTable
CREATE TABLE "staff_admin_bootstrap_authorization_uses" (
    "id" TEXT NOT NULL,
    "authorization_fingerprint" CHAR(64) NOT NULL,
    "authorized_target_binding" CHAR(64) NOT NULL,
    "environment_binding" VARCHAR(128) NOT NULL,
    "envelope_expires_at" TIMESTAMP(3) NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminal_outcome" VARCHAR(64),
    "finalized_at" TIMESTAMP(3),
    "request_id" TEXT,
    "approval_reference_hash" CHAR(64),

    CONSTRAINT "staff_admin_bootstrap_authorization_uses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_admin_bootstrap_closures_accepted_grant_id_key" ON "staff_admin_bootstrap_closures"("accepted_grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_admin_bootstrap_closures_accepted_command_hash_key" ON "staff_admin_bootstrap_closures"("accepted_command_hash");

-- CreateIndex
CREATE UNIQUE INDEX "staff_admin_bootstrap_authorization_uses_authorization_fingerprint_key" ON "staff_admin_bootstrap_authorization_uses"("authorization_fingerprint");

-- CreateIndex
CREATE INDEX "staff_admin_bootstrap_authorization_uses_terminal_outcome_idx" ON "staff_admin_bootstrap_authorization_uses"("terminal_outcome");

-- CreateIndex
CREATE INDEX "staff_admin_bootstrap_authorization_uses_claimed_at_idx" ON "staff_admin_bootstrap_authorization_uses"("claimed_at");

-- CreateIndex
CREATE INDEX "staff_admin_bootstrap_authorization_uses_request_id_idx" ON "staff_admin_bootstrap_authorization_uses"("request_id");

-- AddForeignKey
ALTER TABLE "staff_admin_bootstrap_closures" ADD CONSTRAINT "staff_admin_bootstrap_closures_accepted_grant_id_fkey" FOREIGN KEY ("accepted_grant_id") REFERENCES "user_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constrain the closed-only singleton to its sole valid scope.
ALTER TABLE "staff_admin_bootstrap_closures" ADD CONSTRAINT "staff_admin_bootstrap_closures_scope_key_check" CHECK ("scope_key" = 'FIRST_STAFF_ADMIN');
