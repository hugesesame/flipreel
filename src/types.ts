export type Aspect = '16:9' | '4:3' | '1:1' | '9:16';
export type Fit = 'fit' | 'fill';
export type Format = 'mp4' | 'webm';
export type Transition = 'cut' | 'fade';

export interface Settings {
  aspect: Aspect;
  fit: Fit;
  format: Format;
  /** Seconds each photo is on screen. */
  duration: number;
  transition: Transition;
  /** Seconds, only used when transition is 'fade'. */
  fadeDuration: number;
  /** Seconds of black at the start. */
  leadIn: number;
  /** Seconds of black at the end. */
  leadOut: number;
}

export interface Photo {
  id: number;
  file: File;
  name: string;
  /** Object URL for thumbnails. */
  url: string;
  width: number;
  height: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aspect: '16:9',
  fit: 'fit',
  format: 'mp4',
  duration: 3,
  transition: 'fade',
  fadeDuration: 0.5,
  leadIn: 1,
  leadOut: 1,
};

/** Output resolution: the short side is always 1080 px. */
export const OUTPUT_SIZE: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '4:3': { w: 1440, h: 1080 },
  '1:1': { w: 1080, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
};

export const LIMITS = {
  duration: { min: 0.5, max: 60, step: 0.5 },
  fade: { min: 0.1, max: 5, step: 0.1 },
  black: { min: 0, max: 10, step: 0.5 },
} as const;

/** The one optional song. */
export interface Music {
  file: File;
  name: string;
  /** Seconds. */
  duration: number;
  /** Object URL of the file, for the preview player. */
  url: string;
}
