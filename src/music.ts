// The optional song: reading it, and how it is fitted to the video.
// No settings on purpose — the song starts with the video, is cut where the video ends
// and fades out over the closing black. A shorter song just ends; the rest is silent.

import { QUALITY_HIGH, canEncodeAudio, type AudioCodec } from 'mediabunny';
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

/** Seconds the song takes to fade out at the end of the video: the closing black, between 1 and 5 s. */
export function fadeOutLength(total: number, leadOut: number): number {
  return Math.min(total, Math.max(1, Math.min(5, leadOut)));
}

/** Song volume (0–1) at time `t` of a video `total` seconds long. */
export function musicGain(t: number, total: number, leadOut: number): number {
  const fade = fadeOutLength(total, leadOut);
  const start = total - fade;
  if (t <= start) return 1;
  return Math.max(0, (total - t) / fade);
}
