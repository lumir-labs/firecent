-- Firecent: PWA Web Push Notifications (additive, idempotent)

CREATE TABLE IF NOT EXISTS "notification_preference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" UUID,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "dailyTime" TEXT NOT NULL DEFAULT '08:00',
  "timezone" TEXT NOT NULL DEFAULT 'America/El_Salvador',
  "locale" TEXT NOT NULL DEFAULT 'es',
  "advanceDays" INTEGER NOT NULL DEFAULT 3,
  "notifyCardPayments" BOOLEAN NOT NULL DEFAULT true,
  "notifyCardCutoffs" BOOLEAN NOT NULL DEFAULT true,
  "notifyRecurrings" BOOLEAN NOT NULL DEFAULT true,
  "notifyDebts" BOOLEAN NOT NULL DEFAULT true,
  "notifyInstallments" BOOLEAN NOT NULL DEFAULT false,
  "quietIfEmpty" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3),
  "lastSentDate" TEXT,
  "lastSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preference_userId_key"
  ON "notification_preference"("userId");

CREATE INDEX IF NOT EXISTS "notification_preference_enabled_nextRunAt_idx"
  ON "notification_preference"("enabled", "nextRunAt");

DO $$ BEGIN
  ALTER TABLE "notification_preference"
    ADD CONSTRAINT "notification_preference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "notification_preference"
    ADD CONSTRAINT "notification_preference_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "push_subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscription_endpoint_key"
  ON "push_subscription"("endpoint");

CREATE INDEX IF NOT EXISTS "push_subscription_userId_idx"
  ON "push_subscription"("userId");

DO $$ BEGIN
  ALTER TABLE "push_subscription"
    ADD CONSTRAINT "push_subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
