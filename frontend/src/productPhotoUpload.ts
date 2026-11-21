import { MAX_IMAGE_BYTES, prepareImageUpload } from './imageUpload';

const invalid = () => new Error('gallery.invalid');
const conversionFailed = () => new Error('gallery.conversion_failed');
const heifBrands = ['heic', 'heix', 'heim', 'heis', 'mif1'];

function isHeifPhoto(bytes: Uint8Array): boolean {
  const ascii = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 16 || ascii(4) !== 'ftyp') return false;
  const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (boxSize < 16 || boxSize > bytes.length) return false;
  const brands = [ascii(8)];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(ascii(offset));
  return brands.some(brand => heifBrands.includes(brand)) && !brands.some(brand => brand === 'avif' || brand === 'avis');
}

export async function prepareProductPhotoUpload(file: File): Promise<File> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw invalid();
  const header = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (!isHeifPhoto(header)) return prepareImageUpload(file);

  try {
    const { default: initHeif } = await import('libheif-js/libheif-wasm/libheif-bundle.mjs');
    const heif = await initHeif({});
    const decoder = new heif.HeifDecoder();
    const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
    try {
      if (images.length !== 1) throw invalid();
      const [image] = images;
      const width = image.get_width();
      const height = image.get_height();
      if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 50_000_000) throw invalid();

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const output = Math.max(width, height) > 4096 ? document.createElement('canvas') : canvas;
      try {
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw conversionFailed();
        const pixels = context.createImageData(width, height);
        await new Promise<void>((resolve, reject) => image.display(pixels, value => value ? resolve() : reject(conversionFailed())));
        context.putImageData(pixels, 0, 0);
        if (output !== canvas) {
          const scale = 4096 / Math.max(width, height);
          output.width = Math.max(1, Math.round(width * scale));
          output.height = Math.max(1, Math.round(height * scale));
          const outputContext = output.getContext('2d', { alpha: false });
          if (!outputContext) throw conversionFailed();
          outputContext.drawImage(canvas, 0, 0, output.width, output.height);
        }
        const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/jpeg', 0.88));
        if (blob?.type !== 'image/jpeg' || !blob.size || blob.size > MAX_IMAGE_BYTES) throw invalid();
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        output.width = 0;
        output.height = 0;
      }
    } finally {
      images.forEach(image => image.free());
      if (decoder.decoder) heif.heif_context_free(decoder.decoder);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('gallery.')) throw error;
    throw conversionFailed();
  }
}
