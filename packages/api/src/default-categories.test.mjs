import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_SYSTEM_CATEGORIES,
  localizeCategoryName,
  seedDefaultCategories,
} from "./default-categories.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("default categories have unique bilingual names and exclude tithe/diezmo", () => {
  const enNames = new Set();
  const esNames = new Set();

  assert.ok(DEFAULT_SYSTEM_CATEGORIES.length > 0);

  for (const cat of DEFAULT_SYSTEM_CATEGORIES) {
    assert.ok(cat.nameEn.trim().length > 0);
    assert.ok(cat.nameEs.trim().length > 0);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(cat.color), `invalid hex color: ${cat.color}`);
    assert.ok(!/diezmo|tithe/i.test(cat.nameEn), `excluded term in ${cat.nameEn}`);
    assert.ok(!/diezmo|tithe/i.test(cat.nameEs), `excluded term in ${cat.nameEs}`);

    const enKey = cat.nameEn.toLowerCase();
    const esKey = cat.nameEs.toLowerCase();
    assert.ok(!enNames.has(enKey), `duplicate nameEn: ${cat.nameEn}`);
    assert.ok(!esNames.has(esKey), `duplicate nameEs: ${cat.nameEs}`);
    enNames.add(enKey);
    esNames.add(esKey);

    for (const sub of cat.children ?? []) {
      assert.ok(sub.nameEn.trim().length > 0);
      assert.ok(sub.nameEs.trim().length > 0);
      assert.ok(!/diezmo|tithe/i.test(sub.nameEn), `excluded term in ${sub.nameEn}`);
      assert.ok(!/diezmo|tithe/i.test(sub.nameEs), `excluded term in ${sub.nameEs}`);

      const subEnKey = sub.nameEn.toLowerCase();
      const subEsKey = sub.nameEs.toLowerCase();
      assert.ok(!enNames.has(subEnKey), `duplicate nameEn: ${sub.nameEn}`);
      assert.ok(!esNames.has(subEsKey), `duplicate nameEs: ${sub.nameEs}`);
      enNames.add(subEnKey);
      esNames.add(subEsKey);
    }
  }
});

test("every default category icon exists in web CategoryIcon map", () => {
  const iconFile = readFileSync(
    join(root, "apps/web/components/finance/category-icon.tsx"),
    "utf8",
  );
  const iconsBlock = iconFile.slice(
    iconFile.indexOf("const ICONS:"),
    iconFile.indexOf("};", iconFile.indexOf("const ICONS:")) + 2,
  );

  const allIcons = DEFAULT_SYSTEM_CATEGORIES.flatMap((c) => [
    c.icon,
    ...(c.children ?? []).map((sub) => sub.icon),
  ]);

  for (const icon of allIcons) {
    const quoted = `"${icon}":`;
    const bare = `${icon}:`;
    assert.ok(
      iconsBlock.includes(quoted) || iconsBlock.includes(bare),
      `icon "${icon}" is missing from apps/web/components/finance/category-icon.tsx`,
    );
  }
});

test("seedDefaultCategories inserts parents & children with inherited color and nature, and is idempotent", async () => {
  let nextId = 1;
  const rows = [];

  const mockTx = {
    category: {
      async count({ where }) {
        return rows.filter(
          (r) => r.organizationId === where.organizationId && r.deletedAt == null,
        ).length;
      },
      async createManyAndReturn({ data }) {
        return data.map((row) => {
          const created = { ...row, id: nextId++, deletedAt: null };
          rows.push(created);
          return { id: created.id, name: created.name };
        });
      },
      async createMany({ data }) {
        for (const row of data) {
          rows.push({ ...row, id: nextId++, deletedAt: null });
        }
        return { count: data.length };
      },
    },
  };

  const first = await seedDefaultCategories(mockTx, "org-1", {
    createdBy: "user-1",
  });

  const expectedParents = DEFAULT_SYSTEM_CATEGORIES.length;
  const expectedChildren = DEFAULT_SYSTEM_CATEGORIES.reduce(
    (sum, c) => sum + (c.children?.length ?? 0),
    0,
  );

  assert.equal(first.seeded, true);
  assert.equal(first.parents, expectedParents);
  assert.equal(first.children, expectedChildren);
  assert.equal(rows.length, expectedParents + expectedChildren);

  for (const r of rows) {
    assert.equal(r.organizationId, "org-1");
    assert.equal(r.isSystem, true);
    assert.equal(r.createdBy, "user-1");
    if (r.type === "INCOME") {
      assert.equal(r.spendingNature, null);
    } else {
      assert.ok(["DEBO", "NECESITO", "QUIERO"].includes(r.spendingNature));
    }
  }

  // Subcategories inherit parent's color and link to parent's id
  const pets = rows.find((r) => r.nameEn === "Pets");
  const family = rows.find((r) => r.nameEn === "Family & Personal");
  assert.ok(pets && family);
  assert.equal(pets.parentId, family.id);
  assert.equal(pets.color, family.color);
  assert.equal(pets.nameEs, "Mascotas");

  // Second call on the same org is a no-op
  const second = await seedDefaultCategories(mockTx, "org-1");
  assert.deepEqual(second, { seeded: false, parents: 0, children: 0 });
  assert.equal(rows.length, expectedParents + expectedChildren);
});

test("localizeCategoryName resolves locale correctly", () => {
  const cat = { name: "Food & Dining", nameEn: "Food & Dining", nameEs: "Comida" };
  assert.equal(localizeCategoryName(cat, "es"), "Comida");
  assert.equal(localizeCategoryName(cat, "es-SV"), "Comida");
  assert.equal(localizeCategoryName(cat, "en"), "Food & Dining");
  assert.equal(localizeCategoryName({ name: "Custom" }, "es"), "Custom");
});
