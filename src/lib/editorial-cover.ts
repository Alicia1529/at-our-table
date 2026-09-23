import sharp from "sharp";

export type EditorialPanelCrop = { left: number; top: number; width: number; height: number };

const colourDistance = (red: number, green: number, blue: number, background: [number, number, number]) => {
  const redDelta = red - background[0];
  const greenDelta = green - background[1];
  const blueDelta = blue - background[2];
  return Math.sqrt(redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta);
};

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

export async function findEditorialPanelCrop(input: Buffer): Promise<EditorialPanelCrop> {
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: "#f3f0e8" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (!width || !height || channels < 3) throw new Error("Missing editorial image dimensions.");

  const edgeWidth = Math.max(4, Math.round(width * 0.08));
  const edgeHeight = Math.max(4, Math.round(height * 0.05));
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  for (let y = height - edgeHeight; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x >= edgeWidth && x < width - edgeWidth) continue;
      const offset = (y * width + x) * channels;
      red.push(data[offset]); green.push(data[offset + 1]); blue.push(data[offset + 2]);
    }
  }
  const background: [number, number, number] = [median(red), median(green), median(blue)];
  const xStep = Math.max(1, Math.floor(width / 240));
  const rowBackgroundShare = (y: number) => {
    let matches = 0; let samples = 0;
    for (let x = 0; x < width; x += xStep) {
      const offset = (y * width + x) * channels;
      if (colourDistance(data[offset], data[offset + 1], data[offset + 2], background) <= 34) matches += 1;
      samples += 1;
    }
    return matches / samples;
  };

  const searchStart = Math.round(height * 0.38);
  const searchEnd = Math.round(height * 0.82);
  const requiredRun = Math.max(8, Math.round(height * 0.025));
  let runStart = -1; let runLength = 0; let boundary = -1;
  for (let y = searchStart; y < searchEnd; y += 1) {
    if (rowBackgroundShare(y) >= 0.86) {
      if (runStart < 0) runStart = y;
      runLength += 1;
      if (runLength >= requiredRun) { boundary = runStart; break; }
    } else {
      runStart = -1; runLength = 0;
    }
  }

  // The skill allows the photo to occupy up to roughly three quarters of a
  // portrait composition. The fallback intentionally favors a clean panel
  // over retaining a sliver of the source photograph.
  const detectedTop = boundary >= 0 ? boundary : Math.round(height * 0.76);
  const top = Math.min(height - 1, detectedTop + Math.max(1, Math.round(height * 0.004)));
  return { left: 0, top, width, height: height - top };
}
