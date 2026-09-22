// Cover images are only ever shown as dashboard card thumbnails, but they were
// stored as full-resolution base64 (the example's 2816x1536 PNG is ~9MB of
// text), which every project save, load and dashboard listing then carried.
const MAX_WIDTH = 800;
const QUALITY = 0.82;
// Data URLs under this size are already thumbnail-sized; leave them alone.
export const COVER_SIZE_LIMIT = 300_000;

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => (await fetch(dataUrl)).blob();

/** Downscales a cover to a small JPEG data URL. Returns the input unchanged if it can't. */
export const shrinkCoverImage = async (source: Blob | string): Promise<string> => {
  const original = typeof source === 'string' ? source : null;
  try {
    if (original !== null && (!original.startsWith('data:image/') || original.length <= COVER_SIZE_LIMIT)) {
      return original;
    }
    const blob = typeof source === 'string' ? await dataUrlToBlob(source) : source;
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', QUALITY);
  } catch (err) {
    console.warn('[coverImage] Could not shrink cover image, keeping original', err);
    if (original !== null) return original;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(source as Blob);
    });
  }
};
