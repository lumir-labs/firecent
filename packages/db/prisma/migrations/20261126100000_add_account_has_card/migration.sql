-- Allow savings accounts to opt into debit card visuals
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "hasCard" BOOLEAN NOT NULL DEFAULT false;
