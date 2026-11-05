import type { Photo } from './types';

const THUMB_MAX = 480;
let nextId = 1;

/** Files that look like images (by MIME type or extension). Folders and other files are skipped. */
export function imageFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter(
    (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(f.name),
  );
}

/**
 * Decodes each file once to check it can be read, get its (EXIF-rotated) size,
 * and make a small thumbnail. Files the browser can't decode are returned in `failed`.
 */
export async function loadPhotos(
  files: File[],
  onProgress: (done: number, total: number) => void,
  /** Photos decoded at once. Keep low on phones, where memory is tight. */
  concurrency = 4,
): Promise<{ photos: Photo[]; failed: string[] }> {
  const results: (Photo | null)[] = new Array(files.length).fill(null);
  const failed: string[] = [];
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < files.length) {
      const i = cursor++;
      const file = files[i];
      try {
        results[i] = await loadOne(file);
      } catch {
        failed.push(file.name);
      }
      onProgress(++done, files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { photos: results.filter((p): p is Photo => p !== null), failed };
}

async function loadOne(file: File): Promise<Photo> {
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, THUMB_MAX / Math.max(bmp.width, bmp.height));
    const tw = Math.max(1, Math.round(bmp.width * scale));
    const th = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, tw, th);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Thumbnail failed');
    return {
      id: nextId++,
      file,
      name: file.name,
      url: URL.createObjectURL(blob),
      width: bmp.width,
      height: bmp.height,
    };
  } finally {
    bmp.close();
  }
}

export function releasePhoto(p: Photo): void {
  URL.revokeObjectURL(p.url);
}
