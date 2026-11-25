export interface BackgroundOptions {
  tolerance: number;
  includeEnclosed: boolean;
}
export function removeFlatBackground(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  options: BackgroundOptions,
) {
  const count = width * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 2 ||
    width > 4096 ||
    height > 4096 ||
    height < 2 ||
    count > 4_000_000 ||
    input.length !== count * 4
  )
    throw new Error("Use a PNG between 2px and 4 megapixels.");
  if (
    !Number.isFinite(options.tolerance) ||
    options.tolerance < 4 ||
    options.tolerance > 80 ||
    typeof options.includeEnclosed !== "boolean"
  )
    throw new Error("Invalid background-removal settings.");
  const edge: number[] = [];
  for (let x = 0; x < width; x++) edge.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++)
    edge.push(y * width, y * width + width - 1);
  const opaque = edge.filter((index) => input[index * 4 + 3] > 240);
  if (opaque.length < edge.length * 0.8)
    throw new Error(
      "The image already has transparent or mixed edges. Keep its existing alpha or use another source.",
    );
  const color = [0, 1, 2].map((channel) => {
    const values = opaque
      .map((index) => input[index * 4 + channel])
      .sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const distance = (index: number) =>
    Math.max(
      Math.abs(input[index * 4] - color[0]),
      Math.abs(input[index * 4 + 1] - color[1]),
      Math.abs(input[index * 4 + 2] - color[2]),
    );
  if (
    opaque.filter((index) => distance(index) <= options.tolerance).length <
    opaque.length * 0.9
  )
    throw new Error(
      "The border is not a uniform color. Flat-background removal is unsuitable for this image.",
    );
  const softness = 12;
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let head = 0,
    tail = 0;
  const add = (index: number) => {
    if (index < 0 || index >= count || visited[index]) return;
    visited[index] = 1;
    if (
      distance(index) < options.tolerance + softness ||
      input[index * 4 + 3] === 0
    )
      queue[tail++] = index;
  };
  if (options.includeEnclosed)
    for (let index = 0; index < count; index++) add(index);
  else edge.forEach(add);
  const output = new Uint8ClampedArray(input);
  let removed = 0;
  while (head < tail) {
    const index = queue[head++];
    const alpha = Math.max(
      0,
      Math.min(1, (distance(index) - options.tolerance) / softness),
    );
    const previousAlpha = input[index * 4 + 3];
    output[index * 4 + 3] = Math.round(previousAlpha * alpha);
    removed += (previousAlpha - output[index * 4 + 3]) / 255;
    if (alpha > 0 && alpha < 1)
      for (let channel = 0; channel < 3; channel++)
        output[index * 4 + channel] = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (input[index * 4 + channel] - color[channel] * (1 - alpha)) /
                alpha,
            ),
          ),
        );
    if (!options.includeEnclosed) {
      if (index % width > 0) add(index - 1);
      if (index % width < width - 1) add(index + 1);
      add(index - width);
      add(index + width);
    }
  }
  let remaining = 0;
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  for (let index = 0; index < count; index++) {
    remaining += output[index * 4 + 3] / 255;
    if (output[index * 4 + 3] > 0) {
      const x = index % width,
        y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (remaining < Math.max(1, count * 0.001))
    throw new Error(
      "Removal would leave no usable foreground. Reduce tolerance or keep the original.",
    );
  return {
    data: output,
    removedFraction: removed / count,
    color,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}
