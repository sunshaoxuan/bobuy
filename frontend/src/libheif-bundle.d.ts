declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    free(): void;
    get_width(): number;
    get_height(): number;
    display(data: ImageData, callback: (pixels: ImageData | null) => void): void;
  }

  interface HeifContext {
    delete(): void;
  }

  interface HeifModule {
    HeifDecoder: new () => {
      decoder?: HeifContext;
      decode(bytes: Uint8Array): HeifImage[];
    };
    heif_context_free(context: HeifContext): void;
  }

  export default function initialize(options: Record<string, never>): Promise<HeifModule>;
}
