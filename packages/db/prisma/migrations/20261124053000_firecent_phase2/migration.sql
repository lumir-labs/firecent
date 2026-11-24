-- Firecent Phase 2A (additive only, D10)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "type" "RecordType" NOT NULL DEFAULT 'EXPENSE';
ALTER TABLE "Record" ADD COLUMN IF NOT EXISTS "spendingNature" "SpendingNature";

-- Backfill: categories whose non-deleted records are all INCOME become type = INCOME
UPDATE "Category" c
SET "type" = 'INCOME'
WHERE EXISTS (
  SELECT 1 FROM "Record" r
  WHERE r."categoryId" = c."id" AND r."deletedAt" IS NULL AND r."type" = 'INCOME'
)
AND NOT EXISTS (
  SELECT 1 FROM "Record" r
  WHERE r."categoryId" = c."id" AND r."deletedAt" IS NULL AND r."type" <> 'INCOME'
);
