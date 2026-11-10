/** Normal file-picker uploads only. No URL fetching, resizing, or original-file mutation. */
export const IMAGE_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/avif';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const invalid = () => new Error('gallery.invalid');
const conversionFailed = () => new Error('gallery.conversion_failed');

export async function prepareImageUpload(file: File): Promise<File> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw invalid();
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP';
  const brands = ascii(4,8) === 'ftyp' ? [ascii(8,12), ...Array.from({length: Math.max(0,Math.floor((Math.min(bytes.length,new DataView(bytes.buffer).getUint32(0)) - 16)/4))},(_,i) => ascii(16+i*4,20+i*4))] : [];
  const avif = brands.includes('avif') || brands.includes('avis');
  const type = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : avif ? 'image/avif' : '';
  if (!type || (file.type && file.type !== type)) throw invalid();
  // Do not silently flatten animated images into a different product picture.
  if ((webp && ascii(12,16) === 'VP8X' && (bytes[20] & 2) !== 0) || brands.includes('avis')) throw invalid();
  if (png || jpeg) return file;
  if (typeof createImageBitmap !== 'function') throw conversionFailed();
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const {width,height} = bitmap;
    if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 24_000_000) throw invalid();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw conversionFailed();
    context.drawImage(bitmap,0,0);
    const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(conversionFailed()),'image/png'));
    if (blob.type !== 'image/png' || !blob.size || blob.size > MAX_IMAGE_BYTES) throw invalid();
    // Lossless PNG preserves decoded pixels, dimensions and alpha. Server independently
    // decodes/validates this PNG and hashes the submitted bytes for reference reuse.
    return new File([blob],file.name.replace(/\.[^.]+$/, '')+'.png',{type:'image/png',lastModified:file.lastModified});
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('gallery.')) throw error;
    throw conversionFailed();
  } finally { bitmap?.close(); }
}
