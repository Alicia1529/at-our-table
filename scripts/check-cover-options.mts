import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
// @ts-expect-error Node's type-stripping runner accepts explicit TypeScript imports here.
import { findEditorialPanelCrop } from "../src/lib/editorial-cover.ts";

const width = 120;
const height = 200;
const photoHeight = 124;
const ivory = { r: 243, g: 240, b: 232 };

const photo = await sharp({
  create: { width, height: photoHeight, channels: 3, background: { r: 74, g: 42, b: 30 } },
}).png().toBuffer();
const panel = await sharp({
  create: { width, height: height - photoHeight, channels: 3, background: ivory },
}).png().toBuffer();
const composite = await sharp({
  create: { width, height, channels: 3, background: ivory },
}).composite([{ input: photo, top: 0, left: 0 }, { input: panel, top: photoHeight, left: 0 }]).png().toBuffer();

const crop = await findEditorialPanelCrop(composite);
assert.ok(crop.top >= photoHeight, `abstract crop must not retain the photo (top=${crop.top})`);
assert.equal(crop.height, height - crop.top, "abstract crop must keep only the lower generated panel");

const detailSource = await readFile(new URL("../src/components/dinner-detail.tsx", import.meta.url), "utf8");
assert.match(detailSource, /Use abstract panel/, "memory UI must offer the generated abstract panel");
assert.match(detailSource, /Use original photo/, "memory UI must allow the original photo as the thumbnail");

console.log("PASS: editorial cover uses only the lower panel and original photos remain selectable");
