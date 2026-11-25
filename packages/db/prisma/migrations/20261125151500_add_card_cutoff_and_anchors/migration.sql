-- Add credit card payment anchor date and statement cutoff cycle fields (additive only)
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "paymentAnchorDate" DATE;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "cutoffDayType" "PaymentDayType" DEFAULT 'MONTHLY_DAY';
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "cutoffDay" INTEGER;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "cutoffEveryDays" INTEGER;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "cutoffAnchorDate" DATE;
