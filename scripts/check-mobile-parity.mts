import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error Node's type-stripping runner accepts explicit TypeScript imports here.
import { fromDatetimeLocal, toDatetimeLocal } from "../src/lib/date-format.ts";

const source = readFileSync(new URL("../src/components/dinner-detail.tsx", import.meta.url), "utf8");
const provider = readFileSync(new URL("../src/components/app-data-provider.tsx", import.meta.url), "utf8");
const appShell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const wineJournal = readFileSync(new URL("../src/components/wine-journal.tsx", import.meta.url), "utf8");

const localDinnerTime = "2026-09-19T19:30";
const storedDinnerTime = fromDatetimeLocal(localDinnerTime);

assert.equal(
  storedDinnerTime,
  "2026-09-20T02:30:00.000Z",
  "7:30 PM Los Angeles must be stored as the matching UTC instant",
);
assert.equal(
  toDatetimeLocal(storedDinnerTime),
  localDinnerTime,
  "stored dinner time must round-trip back to 7:30 PM in Los Angeles",
);

assert.match(provider, /deleteCourse/, "the data layer must expose course deletion");
assert.match(source, /Delete course/, "the dinner UI must expose course deletion");
assert.match(source, /data-mobile-quick-capture/, "photo and note capture must be discoverable on mobile");
assert.match(appShell, /aria-label="Space settings"/, "space settings must have a mobile entry point");
assert.doesNotMatch(wineJournal, /aria-label="Filter by wine color" className="[^"]*hidden/, "wine color filtering must not be hidden on mobile");

console.log("PASS: mobile feature parity and local dinner time round-trip");
