import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error Node's strip-types runner requires the explicit TypeScript extension.
import { moveCourse } from "../src/lib/course-order.ts";

const root = new URL("..", import.meta.url).pathname;
const shared = readFileSync(join(root, "src/components/shared-dinner.tsx"), "utf8");
const dinnerDetail = readFileSync(join(root, "src/components/dinner-detail.tsx"), "utf8");
const provider = readFileSync(join(root, "src/components/app-data-provider.tsx"), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(join(root, "supabase/migrations", name), "utf8"))
  .join("\n");

const sample = [{ id: "a" }, { id: "b" }, { id: "c" }];
assert.deepEqual(moveCourse(sample, "c", "a").map((item) => item.id), ["c", "a", "b"]);
assert.deepEqual(moveCourse(sample, "a", "c").map((item) => item.id), ["b", "c", "a"]);

assert.match(shared, /update_shared_dinner_menu/, "shared links must be able to update the scoped menu");
assert.match(shared, /course\.wines/, "shared courses must render their paired wines");
assert.match(shared, /grapes/, "shared wine details must include grape varieties");
assert.match(shared, /SortableCourseList/, "shared courses must be reorderable");
assert.match(dinnerDetail, /SortableCourseList/, "member dinner courses must be reorderable");
assert.match(provider, /reorderCourses/, "app data must persist member course ordering");
assert.match(migrations, /update_shared_dinner_menu/, "database must expose a capability-scoped menu update RPC");
assert.match(migrations, /course_wine_pairings/, "shared payload must include explicit dish-to-wine pairings");

console.log("shared menu capabilities verified");
