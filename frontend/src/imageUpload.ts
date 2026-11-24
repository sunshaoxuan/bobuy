/** Normal file-picker uploads only. No URL fetching, resizing, or original-file mutation. */
export const IMAGE_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const invalid = () => new Error('gallery.invalid');
const conversionFailed = () => new Error('gallery.conversion_failed');

/** Snapshot the live picker list before any asynchronous work or input reset. */
export const copyFileList = (files: FileList | null): File[] => Array.from(files ?? []);

/** Mirror the existing catalog source rule. Never strip query/fragment to guess a source. */
export function validCatalogImageSource(source: string): boolean {
  try {
    const url = new URL(source);
    return /^https:\/\/[^/\\]/.test(source) && !/[?#\\\s]/.test(source) && source.length <= 2048 && url.href.length <= 2048
      && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

/** Hash the prepared submission bytes, matching server-side asset reuse (also after WebP/AVIF conversion). */
export async function imageUploadSha256(file: File): Promise<string> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw invalid();
  if (!globalThis.crypto?.subtle) throw new Error('gallery.hash_unavailable');
  const bytes = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(invalid());
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(invalid());
    reader.readAsArrayBuffer(file);
  });
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export const prepareCatalogImageUpload = (file: File) => prepareImageUpload(file, true);

export async function prepareImageUpload(file: File, catalog = false): Promise<File> {
  const failure = (key: string) => catalog ? new Error(key) : invalid();
  if (!file.size) throw failure('gallery.file_empty');
  if (file.size > MAX_IMAGE_BYTES) throw failure('gallery.file_too_large');
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP';
  const brands = ascii(4,8) === 'ftyp' ? [ascii(8,12), ...Array.from({length: Math.max(0,Math.floor((Math.min(bytes.length,new DataView(bytes.buffer).getUint32(0)) - 16)/4))},(_,i) => ascii(16+i*4,20+i*4))] : [];
  const avif = brands.includes('avif') || brands.includes('avis');
  const type = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : avif ? 'image/avif' : '';
  if (!type) throw failure('gallery.file_format');
  const browserType=file.type.toLowerCase();
  const genericType=!browserType||(catalog&&browserType==='application/octet-stream');
  if (!genericType&&browserType!==type) throw failure('gallery.mime_mismatch');
  const extension=file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  const expected=type==='image/jpeg'?['jpg','jpeg']:type==='image/png'?['png']:type==='image/webp'?['webp']:['avif'];
  if(catalog&&extension&&!expected.includes(extension))throw failure('gallery.extension_mismatch');
  // Do not silently flatten animated images into a different product picture.
  if ((webp && ascii(12,16) === 'VP8X' && (bytes[20] & 2) !== 0) || brands.includes('avis')) throw failure('gallery.animated');
  if (png || jpeg) return file;
  if (typeof createImageBitmap !== 'function') throw conversionFailed();
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const {width,height} = bitmap;
    if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 24_000_000) throw failure('gallery.dimensions');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw conversionFailed();
    context.drawImage(bitmap,0,0);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(conversionFailed()),'image/png'));
    if (blob.type !== 'image/png' || !blob.size) throw catalog ? conversionFailed() : invalid();
    if(blob.size>MAX_IMAGE_BYTES)throw failure('gallery.converted_too_large');
    // Lossless PNG preserves decoded pixels, dimensions and alpha. Server independently
    // decodes/validates this PNG and hashes the submitted bytes for reference reuse.
    return new File([blob],file.name.replace(/\.[^.]+$/, '')+'.png',{type:'image/png',lastModified:file.lastModified});
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('gallery.')) throw error;
    throw conversionFailed();
  } finally { bitmap?.close(); }
}
