import {
  removeFlatBackground,
  type BackgroundOptions,
} from "../domain/background-removal";
self.onmessage = (
  event: MessageEvent<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
    options: BackgroundOptions;
  }>,
) => {
  try {
    const { data, width, height, options } = event.data;
    const result = removeFlatBackground(data, width, height, options);
    self.postMessage({ result }, { transfer: [result.data.buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
