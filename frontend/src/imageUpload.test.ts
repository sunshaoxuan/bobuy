import {afterEach,expect,it,vi} from 'vitest';
import {prepareImageUpload} from './imageUpload';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const file=(bytes:number[],type='image/webp')=>{
 const value=new File([new Uint8Array(bytes)],'synthetic.webp',{type});
 Object.defineProperty(value,'slice',{value:()=>({arrayBuffer:async()=>new Uint8Array(bytes).buffer})});return value;
};
const webp=[82,73,70,70,22,0,0,0,87,69,66,80,86,80,56,88,10,0,0,0,0,0,0,0,127,0,0,95,0,0];
it('rejects animated WebP without decoding or uploading a flattened frame',async()=>{
 const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);const bytes=[...webp];bytes[20]=2;
 await expect(prepareImageUpload(file(bytes))).rejects.toThrow('gallery.invalid');expect(decode).not.toHaveBeenCalled();
});
it('rejects an AVIF sequence even when avis is only a compatible brand',async()=>{
 const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);
 const bytes=[0,0,0,24,...new TextEncoder().encode('ftypavif'),0,0,0,0,...new TextEncoder().encode('avisavif')];
 await expect(prepareImageUpload(file(bytes,'image/avif'))).rejects.toThrow('gallery.invalid');expect(decode).not.toHaveBeenCalled();
});
it('rejects oversized decoded dimensions and always releases the bitmap',async()=>{
 const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({width:8193,height:1,close}));
 const context=vi.spyOn(HTMLCanvasElement.prototype,'getContext');
 await expect(prepareImageUpload(file(webp))).rejects.toThrow('gallery.invalid');expect(close).toHaveBeenCalledOnce();expect(context).not.toHaveBeenCalled();
});
it('reports unsupported or failed decoding honestly',async()=>{
 vi.stubGlobal('createImageBitmap',undefined);await expect(prepareImageUpload(file(webp))).rejects.toThrow('gallery.conversion_failed');
 vi.stubGlobal('createImageBitmap',vi.fn().mockRejectedValue(new Error('bad codec')));await expect(prepareImageUpload(file(webp))).rejects.toThrow('gallery.conversion_failed');
});
it('rejects a PNG conversion exceeding the server byte limit and releases resources',async()=>{
 const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({width:128,height:96,close}));
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as any);
 vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(new Blob([new Uint8Array(8*1024*1024+1)],{type:'image/png'})));
 await expect(prepareImageUpload(file(webp))).rejects.toThrow('gallery.invalid');expect(close).toHaveBeenCalledOnce();
});
