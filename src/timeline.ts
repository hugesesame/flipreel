// Timeline model and frame drawing, shared by the preview player and the exporter.
//
// The video is a sequence of segments: [black lead-in] [photo 1] … [photo N] [black lead-out].
// A Fade cross-dissolves across each segment boundary (centred on it), so fades
// never change the total length: total = leadIn + N × duration + leadOut.

import type { Photo, Settings } from './types';

export const FPS = 30;

export interface Segment {
  /** Photo index, or null for black. */
  photo: number | null;
  start: number;
  end: number;
}

export interface Timeline {
  segments: Segment[];
  total: number;
  /** Half-length of the dissolve at each boundary (boundary i sits between segment i and i+1). */
  halves: number[];
}

export function buildTimeline(photoCount: number, s: Settings): Timeline {
  const segments: Segment[] = [];
  let t = 0;
  const push = (photo: number | null, len: number) => {
    if (len <= 0) return;
    segments.push({ photo, start: t, end: t + len });
    t += len;
  };
  push(null, s.leadIn);
  for (let i = 0; i < photoCount; i++) push(i, s.duration);
  push(null, s.leadOut);

  const halves: number[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    if (s.transition === 'cut') {
      halves.push(0);
      continue;
    }
    const a = segments[i];
    const b = segments[i + 1];
    halves.push(Math.min(s.fadeDuration / 2, (a.end - a.start) / 2, (b.end - b.start) / 2));
  }
  return { segments, total: t, halves };
}

export interface FrameState {
  /** Base layer (photo index or null = black). */
  a: number | null;
  /** Layer blended over `a`. */
  b: number | null;
  /** Opacity of `b`, 0–1. */
  mix: number;
}

export function frameAt(tl: Timeline, t: number): FrameState {
  const { segments, halves } = tl;
  if (segments.length === 0) return { a: null, b: null, mix: 0 };
  let k = segments.findIndex((seg) => t < seg.end);
  if (k === -1) k = segments.length - 1;
  const seg = segments[k];

  const hNext = k < halves.length ? halves[k] : 0;
  if (hNext > 0 && t > seg.end - hNext) {
    return { a: seg.photo, b: segments[k + 1].photo, mix: (t - (seg.end - hNext)) / (2 * hNext) };
  }
  const hPrev = k > 0 ? halves[k - 1] : 0;
  if (hPrev > 0 && t < seg.start + hPrev) {
    return { a: segments[k - 1].photo, b: seg.photo, mix: (t - (seg.start - hPrev)) / (2 * hPrev) };
  }
  return { a: seg.photo, b: null, mix: 0 };
}

/** Photo indices needed to draw time t (for preloading). */
export function photosNeeded(tl: Timeline, t: number): number[] {
  const f = frameAt(tl, t);
  const out: number[] = [];
  if (f.a !== null) out.push(f.a);
  if (f.mix > 0 && f.b !== null) out.push(f.b);
  return out;
}

export type FrameLookup = (photoIndex: number) => CanvasImageSource | null;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function drawFrame(ctx: Ctx2D, w: number, h: number, f: FrameState, lookup: FrameLookup): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const layer = (idx: number | null, alpha: number) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    if (idx === null) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    } else {
      const img = lookup(idx);
      if (img) ctx.drawImage(img, 0, 0, w, h);
    }
  };
  layer(f.a, 1);
  if (f.mix > 0) layer(f.b, Math.min(1, f.mix));
  ctx.globalAlpha = 1;
}

/**
 * Caches photos pre-composed onto a black frame of the output size (with Fit/Fill applied),
 * so drawing a frame is a single drawImage per layer. Keeps only a few in memory.
 */
export class FrameCache {
  private ready = new Map<number, OffscreenCanvas>();
  private pending = new Map<number, Promise<OffscreenCanvas | null>>();
  private order: number[] = [];

  constructor(
    private photos: Photo[],
    private w: number,
    private h: number,
    private fit: Settings['fit'],
    private maxItems: number,
  ) {}

  peek(i: number): OffscreenCanvas | null {
    return this.ready.get(i) ?? null;
  }

  ensure(i: number): Promise<OffscreenCanvas | null> {
    const hit = this.ready.get(i);
    if (hit) {
      this.touch(i);
      return Promise.resolve(hit);
    }
    const p = this.pending.get(i);
    if (p) return p;
    const job = this.compose(i)
      .catch(() => null)
      .then((c) => {
        this.pending.delete(i);
        if (c) {
          this.ready.set(i, c);
          this.touch(i);
          this.evict();
        }
        return c;
      });
    this.pending.set(i, job);
    return job;
  }

  /** Keep `keep` pinned; drop the least recently used beyond the limit. */
  private evict(keep: number[] = []): void {
    while (this.order.length > this.maxItems) {
      const victim = this.order.find((i) => !keep.includes(i));
      if (victim === undefined) break;
      this.order = this.order.filter((i) => i !== victim);
      this.ready.delete(victim);
    }
  }

  private touch(i: number): void {
    this.order = this.order.filter((x) => x !== i);
    this.order.push(i);
  }

  private async compose(i: number): Promise<OffscreenCanvas> {
    const photo = this.photos[i];
    const bmp = await createImageBitmap(photo.file);
    try {
      const c = new OffscreenCanvas(this.w, this.h);
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('2D canvas unavailable');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const r = placeImage(bmp.width, bmp.height, this.w, this.h, this.fit);
      ctx.drawImage(bmp, r.x, r.y, r.w, r.h);
      return c;
    } finally {
      bmp.close();
    }
  }
}

export function placeImage(iw: number, ih: number, w: number, h: number, fit: Settings['fit']) {
  const scale = fit === 'fit' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}
