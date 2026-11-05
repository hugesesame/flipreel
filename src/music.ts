// The optional song: reading it, and how it is fitted to the video.
// No settings on purpose. The opening black is silent; the song starts as the first photo
// appears (fading in with it), and starts fading out as the last photo goes dark, finishing
// in the closing black. A shorter song just ends; the rest is silent.

import { QUALITY_HIGH, canEncodeAudio, type AudioCodec } from 'mediabunny';
import type { Timeline } from './timeline';
import type { Format, Music } from './types';

/** Songs are decoded and encoded at this rate (AAC and Opus both accept it). */
export const AUDIO_RATE = 48_000;
export const AUDIO_CHANNELS = 2;

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|wave|ogg|oga|opus|flac|aif|aiff|caf|weba)$/i;

/** Files that look like audio (by MIME type or extension). */
export function audioFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter((f) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
}

/** Decodes the whole song to 48 kHz. Throws if the browser can't read it. */
export async function decodeSong(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(AUDIO_CHANNELS, 1, AUDIO_RATE);
  return await ctx.decodeAudioData(data);
}

/** Reads a song once to check it can be decoded and to get its length. */
export async function loadMusic(file: File): Promise<Music> {
  const buf = await decodeSong(file);
  if (!(buf.duration > 0)) throw new Error('Empty audio');
  return { file, name: file.name, duration: buf.duration, url: URL.createObjectURL(file) };
}

const AUDIO_CODECS: Record<Format, AudioCodec[]> = {
  mp4: ['aac'],
  webm: ['opus', 'vorbis'],
};

/** The audio codec to use with this video format, or null if the browser can't encode any. */
export async function pickAudioCodec(format: Format): Promise<AudioCodec | null> {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const codec of AUDIO_CODECS[format]) {
    try {
      if (await canEncodeAudio(codec, { numberOfChannels: AUDIO_CHANNELS, sampleRate: AUDIO_RATE, quality: QUALITY_HIGH })) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Where the song sits in the video. All times are seconds of video time. */
export interface SongPlan {
  /** The song begins here (as the first photo starts to appear). */
  start: number;
  fadeIn: number;
  /** The fade-out begins here (as the last photo starts to go dark)… */
  fadeOutStart: number;
  /** …and is silent from here on. */
  fadeOutEnd: number;
}

/** Preferred fade-out length: a fade as quick as the pictures' (0.5 s) sounds like the song was cut off. */
const FADE_OUT = 2;
/** If less than this is left after the last photo starts to go dark, fade out earlier instead. */
const MIN_FADE_OUT = 1;
/** With Cut there is no picture fade; ramp up just enough to avoid a click. */
const CLICK_FREE = 0.05;

export function songPlan(tl: Timeline): SongPlan {
  const { segments: seg, halves, total } = tl;
  const firstPhoto = seg.findIndex((s) => s.photo !== null);
  let lastPhoto = -1;
  for (let i = seg.length - 1; i >= 0; i--) if (seg[i].photo !== null) { lastPhoto = i; break; }
  if (firstPhoto < 0) return { start: 0, fadeIn: CLICK_FREE, fadeOutStart: total, fadeOutEnd: total };

  // Start: where the opening black begins to dissolve into the first photo.
  const hIn = firstPhoto > 0 ? halves[firstPhoto - 1] : 0;
  const start = seg[firstPhoto].start - hIn;
  const fadeIn = Math.max(CLICK_FREE, 2 * hIn);

  // End: the fade-out begins as the last photo begins to go dark, and takes about 2 s
  // (longer if the picture fade is longer), but must be over by the end of the video.
  const hOut = lastPhoto < seg.length - 1 ? halves[lastPhoto] : 0;
  const darkens = seg[lastPhoto].end - hOut;
  const wanted = Math.max(FADE_OUT, 2 * hOut);
  if (total - darkens >= MIN_FADE_OUT) {
    return { start, fadeIn, fadeOutStart: darkens, fadeOutEnd: Math.min(total, darkens + wanted) };
  }
  // Little or no closing black: fade out so it ends exactly with the video.
  const fadeOutStart = Math.max(start, total - wanted);
  return { start, fadeIn, fadeOutStart, fadeOutEnd: total };
}

/** Song volume (0–1) at video time `t`. */
export function musicGain(t: number, p: SongPlan): number {
  if (t < p.start || t >= p.fadeOutEnd) return 0;
  const up = Math.min(1, (t - p.start) / p.fadeIn);
  const down = t <= p.fadeOutStart ? 1 : (p.fadeOutEnd - t) / (p.fadeOutEnd - p.fadeOutStart);
  return Math.max(0, Math.min(up, down));
}

/** Whether the song is still playing when the fade-out begins (otherwise it just ends early). */
export function songReachesEnd(p: SongPlan, songDuration: number): boolean {
  return p.start + songDuration > p.fadeOutStart;
}
