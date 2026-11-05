// Video encoding with WebCodecs via Mediabunny. Everything runs locally in the browser.

import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  StreamTarget,
  WebMOutputFormat,
  canEncodeVideo,
  type StreamTargetChunk,
  type VideoCodec,
} from 'mediabunny';
import { FPS, FrameCache, buildTimeline, drawFrame, frameAt, photosNeeded } from './timeline';
import { OUTPUT_SIZE, type Format, type Photo, type Settings } from './types';

const CODEC_PREFERENCE: Record<Format, VideoCodec[]> = {
  mp4: ['avc'],
  webm: ['vp9', 'vp8'],
};

export const MIME: Record<Format, string> = { mp4: 'video/mp4', webm: 'video/webm' };

/** Returns the codec that will be used for this format/size, or null if the browser can't encode it. */
export async function pickCodec(format: Format, w: number, h: number): Promise<VideoCodec | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of CODEC_PREFERENCE[format]) {
    try {
      if (await canEncodeVideo(codec, { width: w, height: h, quality: QUALITY_HIGH, frameRate: FPS })) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function canChooseSaveLocation(): boolean {
  return typeof window.showSaveFilePicker === 'function';
}

export function suggestedFileName(format: Format, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `flipreel-${stamp}.${format}`;
}

/** Opens the native "Save as" dialog. Returns null if the user cancelled. Must be called from a click. */
export async function askSaveLocation(format: Format, name: string): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker!({
      suggestedName: name,
      types: [
        {
          description: format === 'mp4' ? 'MP4 video' : 'WebM video',
          accept: { [MIME[format]]: [`.${format}`] },
        },
      ],
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

export interface ExportJob {
  photos: Photo[];
  settings: Settings;
  /** Write straight to this file. If omitted, the video is built in memory and returned as a Blob. */
  handle?: FileSystemFileHandle;
  onProgress: (fraction: number) => void;
  isCancelled: () => boolean;
}

export class CancelledError extends Error {}

export async function exportVideo(job: ExportJob): Promise<Blob | null> {
  const { photos, settings, handle } = job;
  const { w, h } = OUTPUT_SIZE[settings.aspect];
  const codec = await pickCodec(settings.format, w, h);
  if (!codec) throw new Error(`No encoder for ${settings.format} at ${w}x${h}`);

  const format = settings.format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const writable = handle ? await handle.createWritable() : null;
  const target = writable
    ? new StreamTarget(writable as unknown as WritableStream<StreamTargetChunk>, { chunked: true })
    : new BufferTarget();
  const output = new Output({ format, target });

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas unavailable');

  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });

  const tl = buildTimeline(photos.length, settings);
  const cache = new FrameCache(photos, w, h, settings.fit, 3);
  const frameCount = Math.max(1, Math.round(tl.total * FPS));
  const dt = 1 / FPS;

  let finished = false;
  try {
    await output.start();
    for (let i = 0; i < frameCount; i++) {
      if (job.isCancelled()) throw new CancelledError();
      const t = i * dt;
      // Sample the middle of each frame so fades are symmetric.
      const ts = t + dt / 2;
      await Promise.all(photosNeeded(tl, ts).map((p) => cache.ensure(p)));
      // Warm up the next photo while encoding the current one.
      const ahead = photosNeeded(tl, Math.min(tl.total - 0.001, ts + 1));
      ahead.forEach((p) => void cache.ensure(p));
      drawFrame(ctx, w, h, frameAt(tl, ts), (p) => cache.peek(p));
      await source.add(t, dt);
      if (i % 5 === 0) job.onProgress(i / frameCount);
    }
    await output.finalize();
    finished = true;
    job.onProgress(1);
  } finally {
    if (!finished) {
      await output.cancel().catch(() => {});
      // If we were writing to a chosen file, remove the half-written file when possible.
      if (writable) await writable.abort?.().catch(() => {});
      if (handle) await (handle as FileSystemFileHandle & { remove?: () => Promise<void> }).remove?.().catch(() => {});
    }
  }

  if (target instanceof BufferTarget) {
    return new Blob([target.buffer!], { type: MIME[settings.format] });
  }
  return null;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
