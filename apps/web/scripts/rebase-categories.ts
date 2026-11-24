import "@app/env";
import { db } from "@app/db";
import { DEFAULT_SYSTEM_CATEGORIES } from "@app/api";

/**
 * Safe, idempotent category rebase for non-demo Spaces:
 * 1. Soft-deletes legacy non-system categories (`deletedAt = now()`) so every
 *    historical `Record` keeps its original category name & icon untouched.
 * 2. Seeds the canonical bilingual (EN/ES) system categories & subcategories.
 */
async function main() {
  // Ensure active-only unique index so soft-deleted legacy names never collide.
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Category_organizationId_name_active_key"
    ON "Category" ("organizationId", "name")
    WHERE "deletedAt" IS NULL;
  `);

  const orgs = await db.organization.findMany({
    where: {
      deletedAt: null,
      OR: [{ slug: null }, { NOT: { slug: { startsWith: "demo-" } } }],
    },
    select: { id: true, name: true },
  });

  const beforeRecords = await db.record.count();

  for (const org of orgs) {
    const existingSystem = await db.category.count({
      where: { organizationId: org.id, isSystem: true, deletedAt: null },
    });
    if (existingSystem > 0) {
      console.log(`[skip] ${org.name}: already has ${existingSystem} active system categories.`);
      continue;
    }

    await db.$transaction(async (tx) => {
      const softDeleted = await tx.category.updateMany({
        where: {
          organizationId: org.id,
          isSystem: false,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      let createdParents = 0;
      let createdChildren = 0;

      for (const cat of DEFAULT_SYSTEM_CATEGORIES) {
        const parent = await tx.category.create({
          data: {
            organizationId: org.id,
            name: cat.nameEn,
            nameEn: cat.nameEn,
            nameEs: cat.nameEs,
            isSystem: true,
            icon: cat.icon,
            color: cat.color,
            type: cat.type,
            spendingNature: cat.type === "EXPENSE" ? (cat.spendingNature ?? "NECESITO") : null,
          },
          select: { id: true },
        });
        createdParents += 1;

        for (const sub of cat.children ?? []) {
          await tx.category.create({
            data: {
              organizationId: org.id,
              parentId: parent.id,
              name: sub.nameEn,
              nameEn: sub.nameEn,
              nameEs: sub.nameEs,
              isSystem: true,
              icon: sub.icon,
              color: cat.color,
              type: cat.type,
              spendingNature:
                cat.type === "EXPENSE"
                  ? (sub.spendingNature ?? cat.spendingNature ?? "NECESITO")
                  : null,
            },
          });
          createdChildren += 1;
        }
      }

      console.log(
        `[ok] ${org.name}: soft-deleted ${softDeleted.count} legacy categories; created ${createdParents} parents + ${createdChildren} subcategories.`,
      );
    });
  }

  const afterRecords = await db.record.count();
  console.log(`Records unchanged: ${beforeRecords} -> ${afterRecords}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
