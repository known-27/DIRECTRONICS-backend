-- Migration: add_user_project_file_fields
-- Adds IdentityDocType, PaymentMode enums, extends User and Project models,
-- adds InvoiceCounter model, and adds paymentMode to payments.

-- ─── New Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "IdentityDocType" AS ENUM ('AADHAR', 'PAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMode" AS ENUM ('GST', 'CASH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Extend User model ────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "fullName"          TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "mobileNumber1"     TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "mobileNumber2"     TEXT,
  ADD COLUMN IF NOT EXISTS "address"           TEXT,
  ADD COLUMN IF NOT EXISTS "identityDocType"   "IdentityDocType",
  ADD COLUMN IF NOT EXISTS "identityDocUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "staticSalary"      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;

-- ─── Extend Project model ─────────────────────────────────────────────────────

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "projectName"        TEXT         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "invoiceNumber"      TEXT         UNIQUE,
  ADD COLUMN IF NOT EXISTS "startDate"          TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "finishDate"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completionImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMode"        "PaymentMode",
  ADD COLUMN IF NOT EXISTS "totalProjectPrice"  DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "makingCost"         DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "manualPayAmount"    DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "approvalNotes"      TEXT;

-- Add index on invoiceNumber
CREATE INDEX IF NOT EXISTS "projects_invoiceNumber_idx" ON "projects"("invoiceNumber");

-- ─── Extend Payment model ─────────────────────────────────────────────────────

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "paymentMode" "PaymentMode";

-- ─── InvoiceCounter model ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_counters" (
  "id"    SERIAL      PRIMARY KEY,
  "year"  INTEGER     NOT NULL,
  "value" INTEGER     NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_counters_year_key" UNIQUE ("year")
);
