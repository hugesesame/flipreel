// Video encoding with WebCodecs via Mediabunny. Everything runs locally in the browser.

import {
  AudioSample,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  Quality,
  StreamTarget,
  WebMOutputFormat,
  canEncodeVideo,
  type StreamTargetChunk,
  type VideoCodec,
} from 'mediabunny';
import { AUDIO_CHANNELS, AUDIO_RATE, decodeSong, musicGain, pickAudioCodec, songPlan, type SongPlan } from './music';
import { FPS, FrameCache, buildTimeline, drawFrame, frameAt, photosNeeded } from './timeline';
import { OUTPUT_SIZE, type Format, type Photo, type Settings } from './types';

const CODEC_PREFERENCE: Record<Format, VideoCodec[]> = {
  mp4: ['avc'],
  webm: ['vp9', 'vp8'],
};

export const MIME: Record<Format, string> = { mp4: 'video/mp4', webm: 'video/webm' };

/** Safari (and every browser on iPhone/iPad) — they all use Apple's WebKit engine and its video encoder. */
const isWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(navigator.userAgent)
  || /iPhone|iPad/.test(navigator.userAgent);

/**
 * Encoding quality. Chrome encodes H.264 at a fixed quality (quantizer), which handles fades well.
 * Apple's encoder only takes a target bitrate, undershoots it, and starves fades (they turn blurry and
 * blocky, then snap sharp at the next keyframe). Give it a generous bitrate instead: ~12 Mbps at 1080p.
 */
function videoQuality(codec: VideoCodec, w: number, h: number): Quality {
  if (codec === 'avc' && isWebKit) return new Quality({ bitrate: Math.round((12_000_000 * (w * h)) / (1920 * 1080)) });
  return QUALITY_HIGH;
}

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
  /** Optional song, fitted to the video length. */
  music?: File | null;
  /** Index of the photo used as the cover (the file's thumbnail in file lists). Default: the first. */
  cover?: number;
  onProgress: (fraction: number) => void;
  isCancelled: () => boolean;
}

export class CancelledError extends Error {}
/** The browser can't encode sound for this format. */
export class AudioUnsupportedError extends Error {}

/**
 * Feeds the song to the encoder in one-second pieces, so that sound and pictures stay interleaved.
 * Placement and fades follow `songPlan`: silent opening black, in with the first photo,
 * out with the last. After a shorter song, the rest is silence.
 */
class SongFeeder {
  private pos = 0; // in sample frames
  private readonly end: number;
  private readonly offset: number; // where the song starts, in sample frames of video time
  private readonly channels: Float32Array[];

  constructor(
    private source: AudioSampleSource,
    song: AudioBuffer,
    total: number,
    private plan: SongPlan,
  ) {
    this.end = Math.round(total * AUDIO_RATE);
    this.offset = Math.round(plan.start * AUDIO_RATE);
    this.channels = Array.from({ length: AUDIO_CHANNELS }, (_, c) => song.getChannelData(Math.min(c, song.numberOfChannels - 1)));
  }

  /** Adds sound up to `untilSec` (clamped to the video length). */
  async fillTo(untilSec: number): Promise<void> {
    const until = Math.min(this.end, Math.round(untilSec * AUDIO_RATE));
    while (this.pos < until) {
      const n = Math.min(AUDIO_RATE, until - this.pos);
      const data = new Float32Array(n * AUDIO_CHANNELS); // planar: all of channel 0, then channel 1
      for (let c = 0; c < AUDIO_CHANNELS; c++) {
        const src = this.channels[c];
        const out = data.subarray(c * n, (c + 1) * n);
        for (let i = 0; i < n; i++) {
          const k = this.pos + i - this.offset;
          out[i] = k >= 0 && k < src.length ? src[k] * musicGain((this.pos + i) / AUDIO_RATE, this.plan) : 0;
        }
      }
      const sample = new AudioSample({ data, format: 'f32-planar', numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_RATE, timestamp: this.pos / AUDIO_RATE });
      await this.source.add(sample);
      sample.close();
      this.pos += n;
    }
  }
}

/** The cover photo as it appears in the video (size, Fit/Fill), as a JPEG. Null if it can't be made. */
async function coverImage(cache: FrameCache, index: number): Promise<{ data: Uint8Array; mimeType: string } | null> {
  try {
    const canvas = await cache.ensure(index);
    if (!canvas) return null;
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    return { data: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || 'image/jpeg' };
  } catch (e) {
    console.warn('Cover image', e);
    return null;
  }
}

export async function exportVideo(job: ExportJob): Promise<Blob | null> {
  const { photos, settings, handle } = job;
  const { w, h } = OUTPUT_SIZE[settings.aspect];
  const codec = await pickCodec(settings.format, w, h);
  if (!codec) throw new Error(`No encoder for ${settings.format} at ${w}x${h}`);
  const audioCodec = job.music ? await pickAudioCodec(settings.format) : null;
  if (job.music && !audioCodec) throw new AudioUnsupportedError(`No audio encoder for ${settings.format}`);
  // The song was already read once when it was added, so decoding it again here is expected to work.
  let song: AudioBuffer | null = job.music ? await decodeSong(job.music) : null;

  const format = settings.format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const writable = handle ? await handle.createWritable() : null;
  const target = writable
    ? new StreamTarget(writable as unknown as WritableStream<StreamTargetChunk>, { chunked: true })
    : new BufferTarget();
  const output = new Output({ format, target });

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas unavailable');

  const source = new CanvasSource(canvas, { codec, quality: videoQuality(codec, w, h), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });

  const tl = buildTimeline(photos.length, settings);
  let feeder: SongFeeder | null = null;
  if (song && audioCodec) {
    const audioSource = new AudioSampleSource({ codec: audioCodec, quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
    feeder = new SongFeeder(audioSource, song, tl.total, songPlan(tl));
    song = null; // the feeder holds what it needs
  }
  const cache = new FrameCache(photos, w, h, settings.fit, 3);
  // Cover art: file lists (Finder, Windows, …) show it instead of the video's first frame, which may be black.
  const cover = await coverImage(cache, job.cover ?? 0);
  if (cover) output.setMetadataTags({ images: [{ ...cover, kind: 'coverFront' }] });
  const frameCount = Math.max(1, Math.round(tl.total * FPS));
  const dt = 1 / FPS;

  let finished = false;
  let wasFading = false;
  try {
    await output.start();
    for (let i = 0; i < frameCount; i++) {
      if (job.isCancelled()) throw new CancelledError();
      const t = i * dt;
      // Keep the sound about a second ahead of the pictures.
      if (feeder) await feeder.fillTo(t + 1);
      // Sample the middle of each frame so fades are symmetric.
      const ts = t + dt / 2;
      await Promise.all(photosNeeded(tl, ts).map((p) => cache.ensure(p)));
      // Warm up the next photo while encoding the current one.
      const ahead = photosNeeded(tl, Math.min(tl.total - 0.001, ts + 1));
      ahead.forEach((p) => void cache.ensure(p));
      const frame = frameAt(tl, ts);
      drawFrame(ctx, w, h, frame, (p) => cache.peek(p));
      // Start a fresh keyframe the moment a fade has finished, so the new photo is sharp at once
      // instead of slowly sharpening (or waiting for the next regular keyframe).
      const settled = frame.mix === 0 && wasFading;
      wasFading = frame.mix > 0;
      await source.add(t, dt, settled ? { keyFrame: true } : undefined);
      if (i % 5 === 0) job.onProgress(i / frameCount);
    }
    if (feeder) await feeder.fillTo(tl.total);
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
