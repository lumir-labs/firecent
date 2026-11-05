import assert from "node:assert/strict";
import { test } from "node:test";
import { WEEK_ACTIVITY, WEEK_TOTAL } from "./demo-week.ts";

test("7 days, values 0..100, deterministic (stable screenshots)", () => {
  assert.equal(WEEK_ACTIVITY.length, 7);
  for (const d of WEEK_ACTIVITY) {
    assert.ok(d.day >= 0 && d.day <= 6);
    assert.ok(d.value >= 0 && d.value <= 100);
  }
  assert.equal(
    WEEK_TOTAL,
    WEEK_ACTIVITY.filter((d) => d.value > 0).length,
  );
  // Deterministic: same import twice would give the same array.
  assert.deepEqual(
    WEEK_ACTIVITY.map((d) => d.value),
    [42, 68, 35, 80, 57, 90, 64],
  );
});
