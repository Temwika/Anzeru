import { deflateSync } from "node:zlib";

/**
 * Tiny PNG painter for demo data: hand-drawn-looking signatures and NRC card
 * photos, so the seeded applications show real images without bundling files.
 */
class Canvas {
  readonly px: Buffer;
  constructor(
    readonly w: number,
    readonly h: number,
    bg: [number, number, number, number],
  ) {
    this.px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) this.px.set(bg, i * 4);
  }

  dot(x: number, y: number, r: number, c: [number, number, number]) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const X = Math.round(x + dx);
        const Y = Math.round(y + dy);
        if (dx * dx + dy * dy > r * r || X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        this.px.set([...c, 255], (Y * this.w + X) * 4);
      }
  }

  rect(x: number, y: number, w: number, h: number, c: [number, number, number]) {
    for (let Y = y; Y < y + h; Y++)
      for (let X = x; X < x + w; X++) if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.px.set([...c, 255], (Y * this.w + X) * 4);
  }

  png() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) this.px.copy(raw, y * (this.w * 4 + 1) + 1, y * this.w * 4, (y + 1) * this.w * 4);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Buffer) {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A flowing pen stroke that differs per seed, as a PNG data URL (transparent background). */
export function demoSignature(seed: number) {
  const c = new Canvas(360, 120, [255, 255, 255, 0]);
  const ink: [number, number, number] = [28, 37, 84];
  const loops = 3 + (seed % 3);
  let prev: [number, number] | null = null;
  for (let t = 0; t <= 1; t += 0.0015) {
    const x = 30 + t * 290;
    const y = 64 + Math.sin(t * Math.PI * 2 * loops + seed) * 26 * (1 - t * 0.5) + Math.sin(t * 37 + seed * 1.7) * 6;
    if (prev) for (let s = 0; s <= 1; s += 0.25) c.dot(prev[0] + (x - prev[0]) * s, prev[1] + (y - prev[1]) * s, 1.6, ink);
    prev = [x, y];
  }
  for (let x = 60; x < 300; x += 1) c.dot(x, 100 + Math.sin(x / 30 + seed) * 2, 1, ink);
  return `data:image/png;base64,${c.png().toString("base64")}`;
}

/** A stylised green Zambian NRC card photo, as an uploaded-file object. */
export function demoNrcCard(name: string, seed: number) {
  const c = new Canvas(480, 300, [236, 238, 232, 255]);
  c.rect(20, 20, 440, 260, [190, 222, 196]);
  c.rect(20, 20, 440, 44, [36, 120, 72]);
  c.rect(40, 90, 110, 140, [148, 160, 150]);
  c.dot(95, 140, 26, [96, 84, 74]);
  c.rect(60, 175, 70, 55, [96, 84, 74]);
  for (let i = 0; i < 6; i++) c.rect(175, 95 + i * 26, 160 + ((seed * (i + 3)) % 90), 10, [70, 92, 78]);
  c.rect(360, 200, 80, 60, [214, 170, 60]);
  const buffer = c.png();
  return { originalname: name, mimetype: "image/png", size: buffer.length, buffer } as Express.Multer.File;
}
