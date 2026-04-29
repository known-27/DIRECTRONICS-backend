-- ============================================================
-- Migration: partial_payment_integer_amounts
-- 
-- 1. Rename PROCESSED → PAID in the PaymentStatus enum
-- 2. Round existing Decimal values to integers
-- 3. Restructure payments table (drop amount, add new Int cols)
-- 4. Create payment_transactions table
-- 5. Add new Int columns to projects and update users
-- ============================================================

-- ─── Step 1: Rename enum value PROCESSED → PAID ─────────────
-- Postgres cannot rename enum values directly before v14 
-- without recreating. We use the ALTER TYPE ... RENAME VALUE approach.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'PROCESSED' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentStatus')
  ) THEN
    ALTER TYPE "PaymentStatus" RENAME VALUE 'PROCESSED' TO 'PAID';
  END IF;
END $$;

-- Add PARTIAL to PaymentStatus enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'PARTIAL' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentStatus')
  ) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';
  END IF;
END $$;

-- ─── Step 2: Round Decimal columns on projects ───────────────
UPDATE projects
SET
  "totalProjectPrice" = ROUND("totalProjectPrice"),
  "makingCost"        = ROUND("makingCost"),
  "manualPayAmount"   = ROUND("manualPayAmount"),
  "calculatedAmount"  = ROUND("calculatedAmount")
WHERE TRUE;

-- ─── Step 3: Restructure payments table ─────────────────────
-- Add new Int columns with defaults based on existing amount
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS "calculatedAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalPaid"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pendingAmount"    INTEGER;

-- Populate from existing amount column (round it)
UPDATE payments
SET
  "calculatedAmount" = ROUND(amount::NUMERIC),
  "pendingAmount"    = CASE
    WHEN status = 'PAID' THEN 0
    ELSE ROUND(amount::NUMERIC)
  END,
  "totalPaid"        = CASE
    WHEN status = 'PAID' THEN ROUND(amount::NUMERIC)
    ELSE 0
  END;

-- Make non-nullable now that data is populated
ALTER TABLE payments
  ALTER COLUMN "calculatedAmount" SET NOT NULL,
  ALTER COLUMN "pendingAmount"    SET NOT NULL;

-- Drop the old amount column
ALTER TABLE payments DROP COLUMN IF EXISTS amount;

-- ─── Step 4: Change project monetary columns from Decimal to Int
ALTER TABLE projects
  ALTER COLUMN "totalProjectPrice" TYPE INTEGER USING ROUND("totalProjectPrice"::NUMERIC)::INTEGER,
  ALTER COLUMN "makingCost"        TYPE INTEGER USING ROUND("makingCost"::NUMERIC)::INTEGER,
  ALTER COLUMN "manualPayAmount"   TYPE INTEGER USING ROUND("manualPayAmount"::NUMERIC)::INTEGER,
  ALTER COLUMN "calculatedAmount"  TYPE INTEGER USING ROUND("calculatedAmount"::NUMERIC)::INTEGER;

-- ─── Step 5: Change user staticSalary from Decimal to Int
ALTER TABLE users
  ALTER COLUMN "staticSalary" TYPE INTEGER USING ROUND("staticSalary"::NUMERIC)::INTEGER;

-- ─── Step 6: Create payment_transactions table ───────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
  id          TEXT         NOT NULL,
  "paymentId" TEXT         NOT NULL,
  "projectId" TEXT         NOT NULL,
  "employeeId" TEXT        NOT NULL,
  "paidById"  TEXT         NOT NULL,
  amount      INTEGER      NOT NULL,
  note        TEXT,
  "paidAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_transactions_paymentId_fkey
    FOREIGN KEY ("paymentId") REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT payment_transactions_paidById_fkey
    FOREIGN KEY ("paidById") REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS payment_transactions_paymentId_idx  ON payment_transactions ("paymentId");
CREATE INDEX IF NOT EXISTS payment_transactions_projectId_idx  ON payment_transactions ("projectId");
CREATE INDEX IF NOT EXISTS payment_transactions_employeeId_idx ON payment_transactions ("employeeId");
