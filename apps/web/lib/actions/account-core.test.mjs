import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  anonymizedEmail,
  anonymizeAndDeleteUser,
  DELETED_EMAIL_DOMAIN,
} from "./account-core.ts";
import { db } from "@app/db";

test("anonymizedEmail: deleted_<uuid>@deleted.local format", () => {
  const email = anonymizedEmail();
  assert.match(
    email,
    new RegExp(
      "^deleted_[0-9a-f-]{36}@" +
        DELETED_EMAIL_DOMAIN.replace(/\./g, "\\.") +
        "$",
    ),
  );
});

test("real cascade: user anonymized, sessions/members/keys/verifications removed", async () => {
  // Fixtures: user + session + account + member (own org) + sent invitation + api key + verification
  const email = `dsr-${randomUUID()}@local.test`;
  const user = await db.user.create({
    data: {
      email,
      name: "Deletable",
      emailVerified: true,
    },
  });
  const org = await db.organization.create({
    data: { name: `DSROrg-${randomUUID().slice(0, 8)}` },
  });
  await db.member.create({
    data: { organizationId: org.id, userId: user.id, role: "owner" },
  });
  await db.session.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await db.account.create({
    data: {
      id: randomUUID(),
      accountId: randomUUID(),
      providerId: "google",
      userId: user.id,
    },
  });
  await db.invitation.create({
    data: {
      organizationId: org.id,
      email: `victim-${randomUUID()}@local.test`,
      status: "pending",
      expiresAt: new Date(Date.now() + 3600_000),
      inviterId: user.id,
    },
  });
  await db.apiKey.create({
    data: {
      organizationId: org.id,
      name: "DSR key",
      prefix: "sk_dsrtest",
      keyHash: randomUUID(),
      scopes: ["mcp:org:read"],
      createdById: user.id,
    },
  });
  await db.verification.create({
    data: {
      id: randomUUID(),
      identifier: email,
      value: "hashed-token",
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await db.twoFactor.create({
    data: {
      secret: "KRSXG4A=",
      backupCodes: "code1,code2",
      userId: user.id,
      verified: true,
    },
  });

  // Run
  const result = await anonymizeAndDeleteUser(user.id, email);
  assert.ok(result.email.startsWith("deleted_"), "anonymized email");
  assert.ok(result.deletedAt instanceof Date);

  // Verify the cascade
  const after = await db.user.findUnique({
    where: { id: user.id },
    include: {
      sessions: true,
      accounts: true,
      memberships: true,
      sentInvitations: true,
      createdApiKeys: true,
      roles: true,
    },
  });
  assert.equal(after.sessions.length, 0, "sessions");
  assert.equal(after.accounts.length, 0, "accounts");
  assert.equal(after.memberships.length, 0, "memberships");
  assert.equal(after.sentInvitations.length, 0, "sent invitations");
  assert.equal(after.createdApiKeys.length, 0, "api keys");
  assert.equal(after.roles.length, 0, "roles disconnected");
  assert.equal(after.name, null);
  assert.equal(after.emailVerified, false);
  assert.equal(after.twoFactorEnabled, false, "2FA flag reset");
  assert.ok(after.deletedAt instanceof Date);
  const verif = await db.verification.findMany({ where: { identifier: email } });
  assert.equal(verif.length, 0, "verifications for the email");
  const tf = await db.twoFactor.findMany({ where: { userId: user.id } });
  assert.equal(tf.length, 0, "TOTP secret + backup codes purged");

  // Fixture cleanup (org left without members)
  await db.organization.delete({ where: { id: org.id } }).catch(() => {});
  await db.user.delete({ where: { id: user.id } }).catch(() => {});
});
