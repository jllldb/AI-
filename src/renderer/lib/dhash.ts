/**
 * Compute 256-bit perceptual hash (dhash) of a canvas frame.
 * Compares adjacent horizontal pixels to produce a difference hash.
 */
export function computeDhash(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const tc = document.createElement('canvas');
  tc.width = 17; tc.height = 17;
  const tctx = tc.getContext('2d')!;
  tctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, 17, 17);
  const pixels = tctx.getImageData(0, 0, 17, 17).data;
  const gray: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    gray.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }
  let hash = 0n;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (gray[y * 17 + x] > gray[y * 17 + x + 1]) {
        hash |= (1n << BigInt(255 - (y * 16 + x)));
      }
    }
  }
  return hash.toString(16).padStart(64, '0');
}
