// Video encoding with WebCodecs via Mediabunny. Everything runs locally in the browser.

import {
  AudioSample,
  AudioSampleSource,
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
import { AUDIO_CHANNELS, AUDIO_RATE, decodeSong, musicGain, pickAudioCodec } from './music';
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
  /** Optional song, fitted to the video length. */
  music?: File | null;
  onProgress: (fraction: number) => void;
  isCancelled: () => boolean;
}

export class CancelledError extends Error {}
/** The browser can't encode sound for this format. */
export class AudioUnsupportedError extends Error {}

/**
 * Feeds the song to the encoder in one-second pieces, so that sound and pictures stay interleaved.
 * The song is cut at the end of the video and fades out; after a shorter song, the rest is silence.
 */
class SongFeeder {
  private pos = 0; // in sample frames
  private readonly end: number;
  private readonly channels: Float32Array[];

  constructor(
    private source: AudioSampleSource,
    song: AudioBuffer,
    private total: number,
    private leadOut: number,
  ) {
    this.end = Math.round(total * AUDIO_RATE);
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
          const k = this.pos + i;
          out[i] = k < src.length ? src[k] * musicGain(k / AUDIO_RATE, this.total, this.leadOut) : 0;
        }
      }
      const sample = new AudioSample({ data, format: 'f32-planar', numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_RATE, timestamp: this.pos / AUDIO_RATE });
      await this.source.add(sample);
      sample.close();
      this.pos += n;
    }
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

  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });

  const tl = buildTimeline(photos.length, settings);
  let feeder: SongFeeder | null = null;
  if (song && audioCodec) {
    const audioSource = new AudioSampleSource({ codec: audioCodec, quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
    feeder = new SongFeeder(audioSource, song, tl.total, settings.leadOut);
    song = null; // the feeder holds what it needs
  }
  const cache = new FrameCache(photos, w, h, settings.fit, 3);
  const frameCount = Math.max(1, Math.round(tl.total * FPS));
  const dt = 1 / FPS;

  let finished = false;
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
      drawFrame(ctx, w, h, frameAt(tl, ts), (p) => cache.peek(p));
      await source.add(t, dt);
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
