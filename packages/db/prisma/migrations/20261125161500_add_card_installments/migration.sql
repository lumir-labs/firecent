-- Add credit card installment plans (con o sin intereses)
CREATE TABLE IF NOT EXISTS "CardInstallment" (
    "id" SERIAL NOT NULL,
    "organizationId" UUID NOT NULL,
    "accountId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "monthlyAmount" INTEGER NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" DATE NOT NULL,
    "includedInBalance" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CardInstallment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CardInstallment_organizationId_idx" ON "CardInstallment"("organizationId");
CREATE INDEX IF NOT EXISTS "CardInstallment_accountId_idx" ON "CardInstallment"("accountId");

DO $$ BEGIN
  ALTER TABLE "CardInstallment"
    ADD CONSTRAINT "CardInstallment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CardInstallment"
    ADD CONSTRAINT "CardInstallment_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
