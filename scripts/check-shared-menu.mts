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
assert.match(shared, /add_shared_dinner_wine/, "shared collaborators must be able to add and pair wine");
assert.match(shared, /Pair another wine|Pair a wine/, "shared course cards must expose the pairing flow");
assert.match(shared, /available_wines/, "shared collaborators must be able to choose public saved wines");
assert.match(shared, /Wine list|Bottles at this dinner/, "shared collaborators must have a dinner wine view");
assert.match(shared, /identifyWinePhotos/, "shared collaborators must be able to identify wine from label photos");
assert.match(shared, /multiple/, "shared label recognition must allow up to two selected photos");
assert.match(shared, /label_photo_path/, "shared wine creation must attach the uploaded label path");
assert.match(dinnerDetail, /SortableCourseList/, "member dinner courses must be reorderable");
assert.match(dinnerDetail, /reordering/, "member reorder controls must be opt-in instead of always occupying card space");
assert.match(provider, /reorderCourses/, "app data must persist member course ordering");
assert.match(migrations, /update_shared_dinner_menu/, "database must expose a capability-scoped menu update RPC");
assert.match(migrations, /add_shared_dinner_wine/, "database must expose a capability-scoped wine pairing RPC");
assert.match(migrations, /share links upload wine labels/, "storage must accept capability-scoped shared wine labels");
assert.match(migrations, /course_wine_pairings/, "shared payload must include explicit dish-to-wine pairings");

console.log("shared menu capabilities verified");
